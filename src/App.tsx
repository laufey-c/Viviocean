import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { CharacterMenu } from './components/CharacterMenu';
import { CharacterScreen } from './components/CharacterScreen';
import { CreatePirateModal } from './components/CreatePirateModal';
import { GlobeCanvas, type CameraTargetRequest } from './components/GlobeCanvas';
import { PauseModal } from './components/PauseModal';
import { TitleOverlay } from './components/TitleOverlay';
import { soundEngine } from './game/audio';
import {
  BASE_SAIL_SPEED,
  type PirateBuildPatch,
  challengeMiniBoss,
  createInitialWorld,
  equipPirateItem,
  movePirateInIsland,
  removePirateFromWorld,
  runIslandMission,
  runNpcQuest,
  setPirateManualMode,
  spawnPlayerPirate,
  startPirateVoyage,
  stepSimulation,
  unequipPirateSlot,
  updatePirateBuild,
  updatePirateCrew,
  updatePirateProfile,
} from './game/sim';
import { GRAND_LINE_ISLANDS, getDefaultAppearance } from './game/worldData';
import type {
  CreatePirateInput,
  EquipmentSlot,
  GameState,
  IslandMissionId,
  IslandZoneId,
  Pirate,
  PirateRole,
  WorldState,
} from './game/types';
import {
  deletePirateFromFirestore,
  publishWorldEventToFirestore,
  savePirateToFirestore,
  signInWithGoogle,
  signOutCaptain,
  subscribeAuth,
  subscribeUserPirates,
  syncPirateProgressToFirestore,
  updatePirateBuildInFirestore,
  updatePirateCrewInFirestore,
  updatePirateInventoryInFirestore,
  updatePirateProfileInFirestore,
} from './services/firebase';

const LOCAL_STORAGE_PREFIX = 'vivid_ocean_player_pirates_v2_';

const LEGACY_ISLAND_MAP: Record<string, string> = {
  'villa-molino': 'isla-dawn',
  'isla-mandarina': 'islas-conomi',
  loguetown: 'islas-polestar',
  sabaody: 'archipielago-sabaody',
  'water-seven': 'water-7',
  'alabasta-dunas': 'reino-arabasta',
  'skypiea-nube': 'skypiea',
  'reino-juguetes': 'dressrosa',
  'isla-fuego-hielo': 'punk-hazard',
  'wano-kuni': 'pais-de-wano',
  'reino-dulces': 'totto-land',
  'laugh-tale': 'isla-lodestar',
};

function getStorageKey(uid: string | null): string {
  return `${LOCAL_STORAGE_PREFIX}${uid ?? 'guest'}`;
}

function loadSavedPlayerPirates(uid: string | null): Pirate[] {
  try {
    const raw =
      localStorage.getItem(getStorageKey(uid)) ??
      (uid === null ? localStorage.getItem('vivid_ocean_player_pirates_v1') : null);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p: Partial<Pirate>) => p && p.isPlayerOwned !== false)
      .map((p: Partial<Pirate>) => {
        const rawId = p.islandId || 'isla-dawn';
        const resolvedIslandId = LEGACY_ISLAND_MAP[rawId] ?? rawId;
        const isl = GRAND_LINE_ISLANDS.find((i) => i.id === resolvedIslandId);
        const fallback = getDefaultAppearance(p.name || 'Pirata', p.flagColor || '#dc2626');
        return {
          ...p,
          isPlayerOwned: true,
          ownerId: uid ?? p.ownerId ?? 'local-player',
          faction: p.faction || 'piratas',
          islandId: resolvedIslandId,
          islandSpot: p.islandSpot || 'taberna',
          islandActivity: p.islandActivity || `En la taberna de ${isl?.name ?? 'la isla'}`,
          manualMode: Boolean(p.manualMode),
          level: Math.max(1, Number(p.level || 1)),
          xp: Math.max(0, Number(p.xp || 0)),
          bossesDefeated: Math.max(0, Number(p.bossesDefeated || 0)),
          sailSpeed: Number(p.sailSpeed || BASE_SAIL_SPEED),
          physicalTraits:
            Array.isArray(p.physicalTraits) && p.physicalTraits.length > 0
              ? p.physicalTraits
              : ['fuerte'],
          mentalTraits:
            Array.isArray(p.mentalTraits) && p.mentalTraits.length > 0
              ? p.mentalTraits
              : ['astuto'],
          race: p.race || 'humano',
          hatStyle: p.hatStyle || 'straw',
          hatColor: p.hatColor || undefined,
          skinTone: p.skinTone || fallback.skinTone,
          hairStyle: p.hairStyle || fallback.hairStyle,
          hairColor: p.hairColor || fallback.hairColor,
          bodyBuild: p.bodyBuild || fallback.bodyBuild,
          outfitStyle: p.outfitStyle || fallback.outfitStyle,
          outfitColor: p.outfitColor || fallback.outfitColor,
          accessory: p.accessory || 'none',
          accessoryColor: p.accessoryColor || undefined,
          capeStyle: p.capeStyle || 'none',
          capeColor: p.capeColor || undefined,
          weaponStyle: p.weaponStyle || undefined,
          inventory: Array.isArray(p.inventory) ? p.inventory : [],
          equipped: p.equipped && typeof p.equipped === 'object' ? p.equipped : {},
          arrivedDay: Math.max(1, Number(p.arrivedDay || 1)),
          completedQuestIds: Array.isArray(p.completedQuestIds) ? p.completedQuestIds : [],
          defeatedMiniBossIds: Array.isArray(p.defeatedMiniBossIds) ? p.defeatedMiniBossIds : [],
          sailingToIslandId:
            p.sailingToIslandId === 'laugh-tale'
              ? 'isla-lodestar'
              : p.sailingToIslandId ?? null,
        };
      }) as Pirate[];
  } catch {
    return [];
  }
}

function formatGoogleAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Se cerró la ventana de Google antes de completar el inicio de sesión.';
  }
  if (code === 'auth/popup-blocked') {
    return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Este dominio aún no está autorizado en Firebase Auth.';
  }
  return 'No se pudo iniciar sesión con Google en este navegador.';
}

type ViewMode = 'menu' | 'character';

export default function App() {
  const initialAutostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const [gameState, setGameState] = useState<GameState>(
    initialAutostart ? 'playing' : 'title'
  );
  const [viewMode, setViewMode] = useState<ViewMode>('menu');
  const [mapView, setMapView] = useState<'island' | 'globe'>('island');
  const [activePirateId, setActivePirateId] = useState<string | null>(null);

  const [world, setWorld] = useState<WorldState>(() => {
    const base = createInitialWorld();
    const saved = loadSavedPlayerPirates(null);
    return {
      ...base,
      totalPiratesCount: saved.length,
      pirates: saved,
    };
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPirate, setEditingPirate] = useState<Pirate | null>(null);
  const [characterSideOpen, setCharacterSideOpen] = useState(true);
  const [muted, setMuted] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<CameraTargetRequest | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const cameraNonceRef = useRef(1);
  const migratedGuestIdsRef = useRef<Set<string>>(new Set());
  const lastSyncedProgressRef = useRef<Map<string, string>>(new Map());
  const lastSimTickRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : Date.now());

  // Mirror state machine onto document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const flyToLatLon = useCallback((lat: number, lon: number, distance = 8.8) => {
    cameraNonceRef.current += 1;
    setCameraTarget({
      lat,
      lon,
      distance,
      nonce: cameraNonceRef.current,
    });
  }, []);

  const focusIslandById = useCallback(
    (islandId: string, distance?: number) => {
      const isl = world.islands.find((i) => i.id === islandId);
      if (!isl) return;
      const dist =
        distance ??
        Math.min(7.3, Math.max(5.85, 5.75 + (isl.scale ?? 1.0) * 0.45));
      flyToLatLon(isl.lat, isl.lon, dist);
    },
    [world.islands, flyToLatLon]
  );

  const focusPirate = useCallback(
    (pirate: Pirate) => {
      const isl = world.islands.find((i) => i.id === pirate.islandId);
      if (isl) {
        const dist = Math.min(7.3, Math.max(5.9, 5.8 + (isl.scale ?? 1.0) * 0.45));
        flyToLatLon(isl.lat, isl.lon, dist);
      }
    },
    [world.islands, flyToLatLon]
  );

  // Firebase Auth listener
  useEffect(() => {
    const unsubAuth = subscribeAuth((u) => {
      setUser(u);
    });
    return () => unsubAuth();
  }, []);

  // Load & sync pirates for the signed-in Google account (or guest local storage)
  useEffect(() => {
    if (!user) {
      const guestPirates = loadSavedPlayerPirates(null);
      setWorld((prev) => ({
        ...prev,
        pirates: guestPirates,
        totalPiratesCount: guestPirates.length,
        events: prev.events.filter((ev) =>
          guestPirates.some((gp) => gp.id === ev.pirateId)
        ),
      }));
      setActivePirateId((curr) =>
        curr && guestPirates.some((p) => p.id === curr) ? curr : null
      );
      return;
    }

    const guestPirates = loadSavedPlayerPirates(null);
    if (guestPirates.length > 0) {
      guestPirates.forEach((gp) => {
        if (!migratedGuestIdsRef.current.has(gp.id)) {
          migratedGuestIdsRef.current.add(gp.id);
          const owned: Pirate = { ...gp, ownerId: user.uid, isPlayerOwned: true };
          void savePirateToFirestore(owned, user).catch((err) => {
            console.warn('Guest pirate migration notice:', err);
          });
        }
      });
      localStorage.removeItem(getStorageKey(null));
    }

    const cachedUserPirates = loadSavedPlayerPirates(user.uid);
    const cachedMap = new Map(cachedUserPirates.map((cp) => [cp.id, cp]));
    if (cachedUserPirates.length > 0) {
      setWorld((prev) => {
        const existingIds = new Set(prev.pirates.map((p) => p.id));
        const merged = [
          ...prev.pirates.map((p) => ({ ...p, ownerId: user.uid, isPlayerOwned: true })),
          ...cachedUserPirates.filter((cp) => !existingIds.has(cp.id)),
        ];
        return {
          ...prev,
          pirates: merged,
          totalPiratesCount: merged.length,
        };
      });
    }

    const unsubPirates = subscribeUserPirates(user.uid, (cloudPirates) => {
      setWorld((prev) => {
        const prevMap = new Map(prev.pirates.map((p) => [p.id, p]));
        const nextPirates: Pirate[] = cloudPirates.map((cp) => {
          const live = prevMap.get(cp.id) ?? cachedMap.get(cp.id);
          if (live) {
            return {
              ...cp,
              bounty: Math.max(cp.bounty, live.bounty),
              berries: Math.max(cp.berries, live.berries),
              wins: Math.max(cp.wins, live.wins),
              losses: Math.max(cp.losses, live.losses),
              level: Math.max(cp.level, live.level || 1),
              xp: live.xp || cp.xp,
              bossesDefeated: Math.max(cp.bossesDefeated, live.bossesDefeated || 0),
              manualMode: live.manualMode,
              islandSpot: live.islandSpot || cp.islandSpot,
              islandActivity: live.islandActivity || cp.islandActivity,
              devilFruit: live.devilFruit || cp.devilFruit,
              islandId: live.islandId || cp.islandId,
              sailingToIslandId: live.sailingToIslandId,
              sailProgress: live.sailProgress,
              cooldownSec: live.cooldownSec,
              arrivedDay: live.arrivedDay ?? 1,
              completedQuestIds: live.completedQuestIds ?? [],
              defeatedMiniBossIds: live.defeatedMiniBossIds ?? [],
              inventory:
                (live.inventory?.length ?? 0) >= (cp.inventory?.length ?? 0)
                  ? live.inventory ?? []
                  : cp.inventory ?? [],
              equipped: live.equipped ?? cp.equipped ?? {},
              race: live.race || cp.race || 'humano',
            };
          }
          return cp;
        });

        for (const p of prev.pirates) {
          if (
            p.ownerId === user.uid &&
            !nextPirates.some((np) => np.id === p.id) &&
            Date.now() - p.createdAtMs < 15000
          ) {
            nextPirates.unshift(p);
          }
        }

        return {
          ...prev,
          pirates: nextPirates,
          totalPiratesCount: nextPirates.length,
        };
      });
    });

    return () => {
      unsubPirates();
    };
  }, [user]);

  // Persist player pirates locally under current account scope
  useEffect(() => {
    try {
      const key = getStorageKey(user?.uid ?? null);
      localStorage.setItem(key, JSON.stringify(world.pirates));
    } catch {
      // Ignore storage quota errors
    }
  }, [world.pirates, user?.uid]);

  // Sync character progress to Firestore when signed in
  useEffect(() => {
    if (!user || !user.emailVerified) return;
    for (const p of world.pirates) {
      if (p.ownerId !== user.uid) continue;
      const sig = `${p.bounty}|${p.berries}|${p.wins}|${p.losses}|${p.devilFruit}|${p.islandId}|${(p.inventory ?? []).join(',')}|${p.equipped?.arma ?? ''},${p.equipped?.armadura ?? ''},${p.equipped?.amuleto ?? ''}`;
      const prevSig = lastSyncedProgressRef.current.get(p.id);
      if (prevSig === undefined) {
        lastSyncedProgressRef.current.set(p.id, sig);
        continue;
      }
      if (prevSig !== sig) {
        lastSyncedProgressRef.current.set(p.id, sig);
        void syncPirateProgressToFirestore(p, user).catch((err) => {
          console.warn('Firestore progress sync notice:', err);
        });
      }
    }
  }, [world.pirates, user]);

  // Exact Real-Time Autonomous Simulation Loop (12 real hours = 1 in-game week; respects manualMode!)
  useEffect(() => {
    if (gameState !== 'playing' || world.pirates.length === 0) return;
    lastSimTickRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const interval = window.setInterval(() => {
      const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsedSec = Math.max(0.1, Math.min(5, (nowPerf - lastSimTickRef.current) / 1000));
      lastSimTickRef.current = nowPerf;

      setWorld((prev) => {
        if (prev.pirates.length === 0) return prev;
        const { world: nextWorld, newEvents } = stepSimulation(
          prev,
          elapsedSec,
          Math.random,
          Date.now()
        );
        if (newEvents.length > 0) {
          const topEv = newEvents[0];
          if (topEv.pirateId === activePirateId) {
            if (topEv.type === 'duel' || topEv.type === 'boss') soundEngine.playDuelClash();
            else if (
              topEv.type === 'treasure' ||
              topEv.type === 'devil_fruit' ||
              topEv.type === 'drop'
            ) {
              soundEngine.playCoinChime();
            }
          }
        }
        return nextWorld;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [gameState, world.pirates.length, activePirateId]);

  const handleStart = useCallback(() => {
    soundEngine.playStartFanfare();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setGameState('playing');
    setViewMode('menu');
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (isTyping) return;

      if (gameState === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleStart();
        return;
      }

      if (e.key === 'Escape') {
        if (showCreateModal) {
          setShowCreateModal(false);
          setEditingPirate(null);
          return;
        }
        if (gameState === 'playing' && viewMode === 'character') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        if (gameState === 'playing' && viewMode === 'character') setGameState('paused');
        else if (gameState === 'paused') setGameState('playing');
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, viewMode, showCreateModal, handleStart, handleToggleMute]);

  const handleCreateOrSavePirate = async (input: CreatePirateInput) => {
    if (editingPirate) {
      soundEngine.playClick();
      const targetId = editingPirate.id;
      const result = updatePirateProfile(world, targetId, input, Date.now());
      setWorld(result.world);
      setEditingPirate(null);
      setShowCreateModal(false);

      if (user && result.pirate && result.pirate.ownerId === user.uid) {
        try {
          await updatePirateProfileInFirestore(result.pirate, user);
        } catch (err) {
          console.warn('Firestore profile update notice:', err);
        }
      }
      return;
    }

    soundEngine.playStartFanfare();
    const result = spawnPlayerPirate(
      world,
      input,
      user?.uid ?? 'local-player',
      Date.now()
    );
    setWorld(result.world);
    setShowCreateModal(false);

    // Stay inside the new character's solo screen immediately after creating!
    setActivePirateId(result.pirate.id);
    setViewMode('character');
    setMapView('island');
    setGameState('playing');

    const startIsl = result.world.islands.find((i) => i.id === result.pirate.islandId);
    if (startIsl) {
      flyToLatLon(startIsl.lat, startIsl.lon, 8.2);
    }

    if (user) {
      try {
        await savePirateToFirestore(result.pirate, user);
        await publishWorldEventToFirestore(result.event, user);
      } catch (err) {
        console.warn('Firestore save notice:', err);
      }
    }
  };

  const handleOpenEditCharacter = (pirate: Pirate) => {
    soundEngine.playClick();
    setEditingPirate(pirate);
    setShowCreateModal(true);
  };

  const handleSelectCharacter = (pirate: Pirate) => {
    soundEngine.playClick();
    setActivePirateId(pirate.id);
    setViewMode('character');
    setMapView(pirate.sailingToIslandId ? 'globe' : 'island');
    focusPirate(pirate);
  };

  const handleDeleteCharacter = async (pirateId: string) => {
    soundEngine.playClick();
    setWorld((prev) => removePirateFromWorld(prev, pirateId));
    lastSyncedProgressRef.current.delete(pirateId);

    if (activePirateId === pirateId) {
      setActivePirateId(null);
      setViewMode('menu');
    }

    if (user) {
      try {
        await deletePirateFromFirestore(pirateId, user);
      } catch (err) {
        console.warn('Firestore delete notice:', err);
      }
    }
  };

  const handleToggleManualMode = (pirateId: string, manualMode: boolean) => {
    soundEngine.playClick();
    setWorld((prev) => setPirateManualMode(prev, pirateId, manualMode));
  };

  const handleMoveInIsland = (pirateId: string, zone: IslandZoneId) => {
    soundEngine.playClick();
    setWorld((prev) => movePirateInIsland(prev, pirateId, zone));
  };

  const handleRunMission = (pirateId: string, missionId: IslandMissionId) => {
    setWorld((prev) => {
      const res = runIslandMission(prev, pirateId, missionId, Math.random, Date.now());
      if (res.event) {
        if (res.event.type === 'duel' || res.event.type === 'boss') {
          soundEngine.playDuelClash();
        } else {
          soundEngine.playCoinChime();
        }
      }
      return res.world;
    });
  };

  const handleRunNpcQuest = (pirateId: string, questId: string) => {
    setWorld((prev) => {
      const res = runNpcQuest(prev, pirateId, questId, Math.random, Date.now());
      if (res.event) {
        soundEngine.playCoinChime();
      }
      return res.world;
    });
  };

  const handleChallengeMiniBoss = (pirateId: string, miniBossId: string) => {
    setWorld((prev) => {
      const res = challengeMiniBoss(prev, pirateId, miniBossId, Math.random, Date.now());
      if (res.event) {
        soundEngine.playDuelClash();
      }
      return res.world;
    });
  };

  const handleStartVoyage = (pirateId: string, destIslandId: string) => {
    soundEngine.playStartFanfare();
    setWorld((prev) => startPirateVoyage(prev, pirateId, destIslandId, Date.now()).world);
    flyToLatLon(0, 0, 12.2);
  };

  const handleUpdateCrew = async (
    pirateId: string,
    payload: { crewName: string; role: PirateRole; flagColor: string }
  ) => {
    soundEngine.playClick();
    let updatedPirate: Pirate | null = null;
    setWorld((prev) => {
      const res = updatePirateCrew(prev, pirateId, payload, Date.now());
      updatedPirate = res.pirate;
      return res.world;
    });

    if (user && updatedPirate && (updatedPirate as Pirate).ownerId === user.uid) {
      try {
        await updatePirateCrewInFirestore(updatedPirate, user);
      } catch (err) {
        console.warn('Firestore crew sync notice:', err);
      }
    }
  };

  const handleEquipItem = (pirateId: string, itemId: string) => {
    soundEngine.playCoinChime();
    let updatedPirate: Pirate | null = null;
    setWorld((prev) => {
      const res = equipPirateItem(prev, pirateId, itemId);
      updatedPirate = res.pirate;
      return res.world;
    });
    if (user && updatedPirate && (updatedPirate as Pirate).ownerId === user.uid) {
      void updatePirateInventoryInFirestore(updatedPirate, user).catch((err) => {
        console.warn('Firestore equip sync notice:', err);
      });
    }
  };

  const handleUnequipSlot = (pirateId: string, slot: EquipmentSlot) => {
    soundEngine.playClick();
    let updatedPirate: Pirate | null = null;
    setWorld((prev) => {
      const res = unequipPirateSlot(prev, pirateId, slot);
      updatedPirate = res.pirate;
      return res.world;
    });
    if (user && updatedPirate && (updatedPirate as Pirate).ownerId === user.uid) {
      void updatePirateInventoryInFirestore(updatedPirate, user).catch((err) => {
        console.warn('Firestore unequip sync notice:', err);
      });
    }
  };

  const handleUpdateBuild = (pirateId: string, patch: PirateBuildPatch) => {
    soundEngine.playClick();
    let updatedPirate: Pirate | null = null;
    setWorld((prev) => {
      const res = updatePirateBuild(prev, pirateId, patch);
      updatedPirate = res.pirate;
      return res.world;
    });
    if (user && updatedPirate && (updatedPirate as Pirate).ownerId === user.uid) {
      void updatePirateBuildInFirestore(updatedPirate, user).catch((err) => {
        console.warn('Firestore build sync notice:', err);
      });
    }
  };

  const handleAuthAction = async () => {
    setAuthNotice(null);
    setAuthBusy(true);
    try {
      if (user) {
        await signOutCaptain();
      } else {
        await signInWithGoogle();
      }
    } catch (err) {
      setAuthNotice(formatGoogleAuthError(err));
      console.warn('Auth error:', err);
    } finally {
      setAuthBusy(false);
    }
  };

  const activePirate: Pirate | null = useMemo(
    () => world.pirates.find((p) => p.id === activePirateId) ?? null,
    [world.pirates, activePirateId]
  );

  useEffect(() => {
    if (viewMode === 'character' && !activePirate) {
      setViewMode('menu');
    }
  }, [viewMode, activePirate]);

  const visibleGlobePirates = useMemo(() => {
    if (gameState === 'title') return [];
    if (viewMode === 'character' && activePirate) return [activePirate];
    return world.pirates;
  }, [gameState, viewMode, activePirate, world.pirates]);

  const visibleGlobeEvents = useMemo(() => {
    if (gameState === 'title') return [];
    if (viewMode === 'character' && activePirate) {
      return world.events.filter((ev) => ev.pirateId === activePirate.id);
    }
    return world.events;
  }, [gameState, viewMode, activePirate, world.events]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#060d18] select-none">
      {/* Isolated Full-Bleed 3D Vivid Ocean Globe */}
      <GlobeCanvas
        islands={world.islands}
        pirates={visibleGlobePirates}
        events={visibleGlobeEvents}
        selectedIslandId={
          viewMode === 'character' && activePirate ? activePirate.islandId : null
        }
        selectedPirateId={
          viewMode === 'character' && activePirate ? activePirate.id : null
        }
        cameraTarget={cameraTarget}
        isTitleScreen={gameState === 'title'}
        drawerOpen={false}
        leftMenuOpen={gameState !== 'title' && viewMode === 'menu'}
        characterFocus={gameState !== 'title' && viewMode === 'character'}
        characterSideOpen={characterSideOpen}
        day={world.day}
        minuteOfDay={world.minuteOfDay}
        onSelectIsland={(id) => {
          soundEngine.playClick();
          focusIslandById(id);
        }}
        onSelectPirate={(id) => {
          soundEngine.playClick();
          const p = world.pirates.find((x) => x.id === id);
          if (p) {
            if (viewMode === 'menu') {
              handleSelectCharacter(p);
            } else {
              focusPirate(p);
            }
          }
        }}
      />

      {/* Title Screen */}
      {gameState === 'title' && (
        <TitleOverlay
          totalPirates={world.pirates.length}
          totalIslands={world.islands.length}
          user={user}
          authBusy={authBusy}
          authNotice={authNotice}
          onStart={handleStart}
          onAuthAction={handleAuthAction}
        />
      )}

      {/* Character Hub Menu */}
      {gameState !== 'title' && viewMode === 'menu' && (
        <CharacterMenu
          pirates={world.pirates}
          islands={world.islands}
          user={user}
          authBusy={authBusy}
          authNotice={authNotice}
          muted={muted}
          onCreateNew={() => {
            soundEngine.playClick();
            setEditingPirate(null);
            setShowCreateModal(true);
          }}
          onSelectCharacter={handleSelectCharacter}
          onEditCharacter={handleOpenEditCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onAuthAction={handleAuthAction}
          onToggleMute={handleToggleMute}
          onReturnTitle={() => {
            soundEngine.playClick();
            setGameState('title');
          }}
        />
      )}

      {/* Dedicated Single-Character Screen (Island Interior + New Reference UI) */}
      {gameState !== 'title' && viewMode === 'character' && activePirate && (
        <CharacterScreen
          pirate={activePirate}
          allPirates={world.pirates}
          islands={world.islands}
          events={world.events}
          day={world.day}
          minuteOfDay={world.minuteOfDay}
          muted={muted}
          user={user}
          authBusy={authBusy}
          authNotice={authNotice}
          mapView={mapView}
          characterSideOpen={characterSideOpen}
          onChangeCharacterSideOpen={setCharacterSideOpen}
          onChangeMapView={setMapView}
          onBackToMenu={() => {
            soundEngine.playClick();
            setViewMode('menu');
            setActivePirateId(null);
            flyToLatLon(14, 32, 14.8);
          }}
          onFocusMyShip={() => {
            soundEngine.playClick();
            focusPirate(activePirate);
          }}
          onFocusFullGlobe={() => {
            soundEngine.playClick();
            flyToLatLon(14, 32, 15.2);
          }}
          onFocusWorldCenter={() => {
            soundEngine.playClick();
            flyToLatLon(0, 0, 11.2);
          }}
          onFocusIsland={(id) => {
            soundEngine.playClick();
            focusIslandById(id);
          }}
          onToggleManualMode={handleToggleManualMode}
          onMoveInIsland={handleMoveInIsland}
          onRunMission={handleRunMission}
          onRunNpcQuest={handleRunNpcQuest}
          onChallengeMiniBoss={handleChallengeMiniBoss}
          onStartVoyage={handleStartVoyage}
          onUpdateCrew={handleUpdateCrew}
          onUpdateBuild={handleUpdateBuild}
          onEquipItem={handleEquipItem}
          onUnequipSlot={handleUnequipSlot}
          onEditCharacter={handleOpenEditCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onToggleMute={handleToggleMute}
          onPause={() => setGameState('paused')}
          onAuthAction={handleAuthAction}
        />
      )}

      {/* Character Creator / Editor Modal */}
      {showCreateModal && (
        <CreatePirateModal
          editingPirate={editingPirate}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPirate(null);
          }}
          onCreate={handleCreateOrSavePirate}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          world={world}
          activePirate={activePirate}
          onResume={() => setGameState('playing')}
          onGoMenu={() => {
            setGameState('playing');
            setViewMode('menu');
            setActivePirateId(null);
          }}
          onReturnTitle={() => setGameState('title')}
        />
      )}
    </div>
  );
}
