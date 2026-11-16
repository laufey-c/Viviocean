import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Anchor,
  ArrowLeft,
  Backpack,
  Check,
  CloudFog,
  CloudLightning,
  CloudRain,
  Coins,
  Compass,
  Edit3,
  Flame,
  Globe,
  Hand,
  Map as MapIcon,
  MoreHorizontal,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Shield,
  Skull,
  SlidersHorizontal,
  Snowflake,
  Sun,
  Swords,
  Target,
  Trash2,
  User as UserIcon,
  Users,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import {
  type PirateBuildPatch,
  computePirateStats,
  computeWeatherDebuff,
  formatBounty,
  formatClock,
  formatShortBounty,
  getEquippedItems,
  getIslandWeather,
  getNavigationPathCoords,
  getRankInfo,
  getSeaBadgeColor,
  getWeekAndDay,
  xpForNextLevel,
} from '../game/sim';
import {
  ACCESSORY_OPTIONS,
  CAPE_OPTIONS,
  FLAG_COLORS,
  HAIR_STYLES,
  HAT_OPTIONS,
  OUTFIT_COLORS,
  OUTFIT_STYLES,
  PIRATE_ROLES,
  getBossDropPool,
  getBossForIsland,
  getEquipmentItem,
  getFactionInfo,
  getIslandMissions,
  getIslandRecommendedDays,
  getIslandSizeTier,
  getItemColorLabel,
  getMiniBossesForIsland,
  getNextCycleColor,
  getNpcsForIsland,
  getRaceInfo,
  getTraitOption,
} from '../game/worldData';
import type {
  EquipmentItem,
  EquipmentRarity,
  EquipmentSlot,
  Faction,
  Island,
  IslandMissionId,
  IslandZoneId,
  Pirate,
  PirateRole,
  SeaName,
  WeatherType,
  WorldEvent,
} from '../game/types';
import { HorizontalOptionRail } from './HorizontalOptionRail';
import { IslandSceneView } from './IslandSceneView';
import { PirateAvatarSvg } from './PirateAvatarSvg';

export type CharacterTab =
  | 'estado'
  | 'inventario'
  | 'build'
  | 'misiones'
  | 'noticias'
  | 'mapa'
  | 'mas';

interface CharacterScreenProps {
  pirate: Pirate;
  allPirates: Pirate[];
  islands: Island[];
  events: WorldEvent[];
  day: number;
  minuteOfDay: number;
  muted: boolean;
  user: User | null;
  authBusy: boolean;
  authNotice: string | null;
  mapView: 'island' | 'globe';
  characterSideOpen: boolean;
  onChangeCharacterSideOpen: (open: boolean) => void;
  onChangeMapView: (mode: 'island' | 'globe') => void;
  onBackToMenu: () => void;
  onFocusMyShip: () => void;
  onFocusFullGlobe: () => void;
  onFocusWorldCenter: () => void;
  onFocusIsland: (islandId: string) => void;
  onToggleManualMode: (pirateId: string, manualMode: boolean) => void;
  onMoveInIsland: (pirateId: string, zone: IslandZoneId) => void;
  onRunMission: (pirateId: string, missionId: IslandMissionId) => void;
  onRunNpcQuest: (pirateId: string, questId: string) => void;
  onChallengeMiniBoss: (pirateId: string, miniBossId: string) => void;
  onStartVoyage: (pirateId: string, destIslandId: string) => void;
  onUpdateCrew: (
    pirateId: string,
    payload: { crewName: string; role: PirateRole; flagColor: string }
  ) => void;
  onUpdateBuild: (pirateId: string, patch: PirateBuildPatch) => void;
  onEquipItem: (pirateId: string, itemId: string) => void;
  onUnequipSlot: (pirateId: string, slot: EquipmentSlot) => void;
  onEditCharacter: (pirate: Pirate) => void;
  onDeleteCharacter: (pirateId: string) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onAuthAction: () => void;
}

const SEAS_ORDER: SeaName[] = [
  'Mar del Este',
  'Mar del Norte',
  'Mar del Sur',
  'Mar del Oeste',
  'Paraíso',
  'Nuevo Mundo',
];

const RARITY_STYLES: Record<
  EquipmentRarity,
  { badge: string; border: string; label: string }
> = {
  comun: {
    badge: 'bg-slate-700 text-slate-200',
    border: 'border-slate-700',
    label: 'Común',
  },
  raro: {
    badge: 'bg-sky-500/20 text-sky-300 border border-sky-400/40',
    border: 'border-sky-500/40',
    label: 'Raro',
  },
  epico: {
    badge: 'bg-purple-500/20 text-purple-300 border border-purple-400/40',
    border: 'border-purple-500/45',
    label: 'Épico',
  },
  legendario: {
    badge: 'bg-amber-500/20 text-amber-300 border border-amber-400/50',
    border: 'border-amber-400/55',
    label: 'Legendario',
  },
};

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  arma: 'Arma',
  armadura: 'Armadura',
  amuleto: 'Amuleto',
};

function renderFactionMiniIcon(faction: Faction) {
  switch (faction) {
    case 'marines':
      return <Shield className="h-3.5 w-3.5 text-sky-400 shrink-0" />;
    case 'revolucionarios':
      return <Flame className="h-3.5 w-3.5 text-teal-400 shrink-0" />;
    case 'aventureros':
      return <Compass className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
    default:
      return <Skull className="h-3.5 w-3.5 text-rose-400 shrink-0" />;
  }
}

function renderWeatherIcon(type: WeatherType, color: string) {
  switch (type) {
    case 'lluvia':
      return <CloudRain className="h-4 w-4 shrink-0" style={{ color }} />;
    case 'tormenta':
      return <CloudLightning className="h-4 w-4 shrink-0" style={{ color }} />;
    case 'nieve':
      return <Snowflake className="h-4 w-4 shrink-0" style={{ color }} />;
    case 'niebla':
      return <CloudFog className="h-4 w-4 shrink-0" style={{ color }} />;
    case 'viento':
      return <Wind className="h-4 w-4 shrink-0" style={{ color }} />;
    default:
      return <Sun className="h-4 w-4 shrink-0" style={{ color }} />;
  }
}

function formatItemStatTags(item: EquipmentItem): string[] {
  const tags: string[] = [];
  if (item.fuerzaBonus) tags.push(`+${item.fuerzaBonus} Fue`);
  if (item.agilidadBonus) tags.push(`+${item.agilidadBonus} Agi`);
  if (item.aguanteBonus) tags.push(`+${item.aguanteBonus} Agu`);
  if (item.ingenioBonus) tags.push(`+${item.ingenioBonus} Ing`);
  if (item.combatBonus) tags.push(`+${item.combatBonus} Comb`);
  return tags;
}

export const CharacterScreen: React.FC<CharacterScreenProps> = ({
  pirate,
  allPirates,
  islands,
  events,
  day,
  minuteOfDay,
  muted,
  user,
  authBusy,
  authNotice,
  mapView,
  characterSideOpen,
  onChangeCharacterSideOpen,
  onChangeMapView,
  onBackToMenu,
  onFocusMyShip,
  onFocusFullGlobe,
  onFocusWorldCenter,
  onFocusIsland,
  onToggleManualMode,
  onMoveInIsland,
  onRunMission,
  onRunNpcQuest,
  onChallengeMiniBoss,
  onStartVoyage,
  onUpdateCrew,
  onUpdateBuild,
  onEquipItem,
  onUnequipSlot,
  onEditCharacter,
  onDeleteCharacter,
  onToggleMute,
  onPause,
  onAuthAction,
}) => {
  const [activeTab, setActiveTab] = useState<CharacterTab>('estado');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingCrew, setEditingCrew] = useState(false);
  const [crewInput, setCrewInput] = useState(
    pirate.crewName === 'Sin tripulación' ? '' : pirate.crewName
  );
  const [roleInput, setRoleInput] = useState<PirateRole>(pirate.role);
  const [colorInput, setColorInput] = useState(pirate.flagColor);
  const [selectedSeaFilter, setSelectedSeaFilter] = useState<SeaName>(
    islands.find((i) => i.id === pirate.islandId)?.sea ?? 'Mar del Este'
  );

  useEffect(() => {
    setCrewInput(pirate.crewName === 'Sin tripulación' ? '' : pirate.crewName);
    setRoleInput(pirate.role);
    setColorInput(pirate.flagColor);
    setEditingCrew(false);
  }, [pirate.id, pirate.crewName, pirate.role, pirate.flagColor]);

  const currIsland = islands.find((i) => i.id === pirate.islandId) ?? islands[0];
  const destIsland = pirate.sailingToIslandId
    ? islands.find((i) => i.id === pirate.sailingToIslandId)
    : null;

  const sameIslandPeers = useMemo(
    () =>
      allPirates.filter(
        (other) =>
          other.id !== pirate.id && !other.sailingToIslandId && other.islandId === currIsland.id
      ),
    [allPirates, pirate.id, currIsland.id]
  );

  const characterEvents = useMemo(
    () => events.filter((ev) => ev.pirateId === pirate.id || ev.targetPirateId === pirate.id),
    [events, pirate.id]
  );

  const factionInfo = getFactionInfo(pirate.faction);
  const raceInfo = getRaceInfo(pirate.race);
  const hasCrew = Boolean(pirate.crewName && pirate.crewName !== 'Sin tripulación');
  const level = pirate.level || 1;
  const xp = pirate.xp || 0;
  const xpNeeded = xpForNextLevel(level);
  const xpPct = Math.min(100, Math.round((xp / xpNeeded) * 100));
  const rank = getRankInfo(level);

  const weather = useMemo(
    () => getIslandWeather(currIsland, day, minuteOfDay),
    [currIsland, day, minuteOfDay]
  );
  const weatherDebuff = useMemo(
    () => computeWeatherDebuff(weather, pirate),
    [weather, pirate]
  );
  const stats = computePirateStats(pirate, weather);
  const equippedItems = useMemo(() => getEquippedItems(pirate.equipped), [pirate.equipped]);
  const inventoryItems = useMemo(
    () =>
      (pirate.inventory ?? [])
        .map((id) => getEquipmentItem(id))
        .filter((it): it is EquipmentItem => Boolean(it)),
    [pirate.inventory]
  );

  const boss = getBossForIsland(currIsland);
  const bossDrops = useMemo(
    () =>
      getBossDropPool(currIsland, boss)
        .map((id) => getEquipmentItem(id))
        .filter((it): it is EquipmentItem => Boolean(it)),
    [currIsland, boss]
  );
  const islandMissions = useMemo(() => getIslandMissions(currIsland), [currIsland]);
  const npcQuests = useMemo(() => getNpcsForIsland(currIsland), [currIsland]);
  const miniBosses = useMemo(() => getMiniBossesForIsland(currIsland), [currIsland]);
  const sizeTier = getIslandSizeTier(currIsland);
  const recommendedDays = getIslandRecommendedDays(currIsland);
  const daysHere = Math.max(1, day - (pirate.arrivedDay ?? 1) + 1);
  const completedQuestsSet = useMemo(
    () => new Set(pirate.completedQuestIds ?? []),
    [pirate.completedQuestIds]
  );
  const defeatedMiniBossesSet = useMemo(
    () => new Set(pirate.defeatedMiniBossIds ?? []),
    [pirate.defeatedMiniBossIds]
  );
  const doneQuestsCount = npcQuests.filter((q) => completedQuestsSet.has(q.id)).length;
  const weekInfo = getWeekAndDay(day);

  const isGrandLine = currIsland.sea === 'Paraíso' || currIsland.sea === 'Nuevo Mundo';
  const targetLevelGate = currIsland.sea === 'Paraíso' ? 20 : 10;
  const levelsMissing = Math.max(0, targetLevelGate - level);
  const gatePct = Math.min(100, Math.round((level / targetLevelGate) * 100));

  const showGlobeViewport = Boolean(pirate.sailingToIslandId) || mapView === 'globe';
  const hasEquippedWeapon = Boolean(pirate.equipped?.arma);

  const handleTabSelect = (tab: CharacterTab) => {
    if (tab === 'mapa') {
      if (characterSideOpen && activeTab === 'mapa') {
        onChangeCharacterSideOpen(false);
      } else {
        setActiveTab('mapa');
        onChangeCharacterSideOpen(true);
        onChangeMapView('globe');
        onFocusMyShip();
      }
      return;
    }

    if (characterSideOpen && activeTab === tab) {
      onChangeCharacterSideOpen(false);
      return;
    }

    setActiveTab(tab);
    onChangeCharacterSideOpen(true);
    if (mapView === 'globe' && !pirate.sailingToIslandId) {
      onChangeMapView('island');
    }
  };

  const handleSaveCrew = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCrew(pirate.id, {
      crewName: crewInput.trim() || 'Sin tripulación',
      role: roleInput,
      flagColor: colorInput,
    });
    setEditingCrew(false);
  };

  const statMax = Math.max(25, stats.fuerza, stats.agilidad, stats.aguante, stats.ingenio);

  const gearTotals = equippedItems.reduce(
    (acc, item) => ({
      fuerza: acc.fuerza + (item.fuerzaBonus ?? 0),
      agilidad: acc.agilidad + (item.agilidadBonus ?? 0),
      aguante: acc.aguante + (item.aguanteBonus ?? 0),
      ingenio: acc.ingenio + (item.ingenioBonus ?? 0),
    }),
    { fuerza: 0, agilidad: 0, aguante: 0, ingenio: 0 }
  );

  const navItems: Array<{
    id: CharacterTab;
    label: string;
    icon: React.ReactNode;
    badge: string | null;
  }> = [
    {
      id: 'estado',
      label: 'Estado',
      icon: <UserIcon className="h-4 w-4" />,
      badge: null,
    },
    {
      id: 'inventario',
      label: 'Inventario',
      icon: <Backpack className="h-4 w-4" />,
      badge: inventoryItems.length > 0 ? String(inventoryItems.length) : null,
    },
    {
      id: 'build',
      label: 'Build',
      icon: <SlidersHorizontal className="h-4 w-4" />,
      badge: null,
    },
    {
      id: 'misiones',
      label: 'Misiones',
      icon: <Target className="h-4 w-4" />,
      badge: null,
    },
    {
      id: 'noticias',
      label: 'Noticias',
      icon: <Newspaper className="h-4 w-4" />,
      badge:
        characterEvents.length > 9
          ? '9+'
          : characterEvents.length > 0
            ? String(characterEvents.length)
            : null,
    },
    {
      id: 'mapa',
      label: 'Mapa',
      icon: <MapIcon className="h-4 w-4" />,
      badge: null,
    },
    {
      id: 'mas',
      label: 'Más',
      icon: <MoreHorizontal className="h-4 w-4" />,
      badge: null,
    },
  ];

  const renderPanelContent = () => (
    <div className="flex-1 overflow-y-auto nautical-scroll p-3.5 space-y-3">
      {/* Character Identity Header */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-[#081221] p-1">
            <PirateAvatarSvg
              name={pirate.name}
              flagColor={pirate.flagColor}
              race={pirate.race}
              hatStyle={pirate.hatStyle}
              hatColor={pirate.hatColor}
              skinTone={pirate.skinTone}
              hairStyle={pirate.hairStyle}
              hairColor={pirate.hairColor}
              bodyBuild={pirate.bodyBuild}
              outfitStyle={pirate.outfitStyle}
              outfitColor={pirate.outfitColor}
              accessory={pirate.accessory}
              accessoryColor={pirate.accessoryColor}
              capeStyle={pirate.capeStyle}
              capeColor={pirate.capeColor}
              role={pirate.role}
              hasEquippedWeapon={hasEquippedWeapon}
              variant="stage"
              size={54}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="font-display truncate text-lg font-black tracking-wide text-white uppercase">
                {pirate.name}
              </h1>
              <span className="font-mono-num text-[11px] font-black text-[#f5b82e]">
                {formatBounty(pirate.bounty)}
              </span>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] font-semibold text-slate-200">
              {renderFactionMiniIcon(pirate.faction)}
              <span>
                {factionInfo.singular} · {raceInfo.label} · {rank.title}
              </span>
            </div>

            <div className="mt-0.5 truncate text-[11px] text-slate-400">
              {hasCrew ? `${pirate.crewName} (${pirate.role})` : `En solitario · ${pirate.role}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEditCharacter(pirate)}
            aria-label={`Editar aspecto y rasgos de ${pirate.name}`}
            title="Editar ficha completa"
            className="flex items-center gap-1 rounded-lg border border-teal-400/40 bg-teal-950/50 px-2 py-1 text-[10px] font-bold text-teal-200 hover:bg-teal-900/60 cursor-pointer whitespace-nowrap"
          >
            <Edit3 className="h-3 w-3" />
            <span className="hidden sm:inline">Ficha</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeCharacterSideOpen(false)}
            aria-label="Ocultar panel de personaje"
            title="Ocultar panel lateral"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Location Strip + Manual Mode Toggle */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-[#1d3557] bg-[#11223b] px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold text-white">
            {pirate.islandActivity || `En la taberna de ${currIsland.name}`}
          </div>
          <div className="truncate text-[10px] text-slate-400">
            {currIsland.name} ({currIsland.sea} · {sizeTier}) · Día {daysHere}/{recommendedDays} ·{' '}
            {doneQuestsCount}/{npcQuests.length} encargos
          </div>
        </div>

        <button
          type="button"
          aria-pressed={pirate.manualMode}
          onClick={() => onToggleManualMode(pirate.id, !pirate.manualMode)}
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            pirate.manualMode
              ? 'bg-amber-400 text-slate-950 shadow'
              : 'border border-teal-400/40 bg-teal-400/15 text-teal-200 hover:bg-teal-400/25'
          }`}
        >
          {pirate.manualMode ? (
            <>
              <Hand className="h-3 w-3" />
              <span>Manual</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              <span>Auto</span>
            </>
          )}
        </button>
      </div>

      {/* Section Title Strip */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
        <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
          {activeTab === 'estado' && 'Estado, Clima y Estadísticas'}
          {activeTab === 'inventario' && 'Inventario, Equipo y Rasgos'}
          {activeTab === 'build' && 'Build: Ropa, Cicatrices y Equipo'}
          {activeTab === 'misiones' && `Misiones y Rutas · ${currIsland.name}`}
          {activeTab === 'noticias' && 'Noticias y Bitácora'}
          {activeTab === 'mapa' && 'Mapa Global 3D'}
          {activeTab === 'mas' && 'Opciones del Personaje'}
        </span>
        <span className="text-[10px] font-mono-num text-slate-400">
          {pirate.berries} monedones
        </span>
      </div>

      {/* TAB: ESTADO */}
      {activeTab === 'estado' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#1d3557] bg-[#101f37] p-3 space-y-2.5">
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-white">
                {rank.title} · {raceInfo.label}
              </div>
              <div className="text-[11px] text-slate-300">{rank.nextHint}</div>
            </div>

            {/* LEVEL + XP BAR */}
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-display text-base font-black text-[#f5b82e] whitespace-nowrap">
                  NIVEL {level}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-[#f5d061] transition-all duration-300"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
                <span className="font-mono-num text-[11px] font-bold text-slate-300 whitespace-nowrap">
                  {xp} / {xpNeeded}
                </span>
              </div>
            </div>

            {/* Sea Crossing Gate Progress */}
            <div>
              <div className="text-[11px] text-slate-200">
                {currIsland.sea === 'Nuevo Mundo' ? (
                  <>Dominando el Nuevo Mundo · Nivel {level}</>
                ) : (
                  <>
                    {isGrandLine
                      ? 'Para cruzar al Nuevo Mundo: nivel 20 · '
                      : 'Para cruzar al Paraíso: nivel 10 · '}
                    <span className="font-semibold text-teal-300">
                      {levelsMissing === 0 ? '¡Listo para zarpar!' : `le faltan ${levelsMissing}`}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-[#14b8a6] transition-all duration-300"
                  style={{ width: `${currIsland.sea === 'Nuevo Mundo' ? 100 : gatePct}%` }}
                />
              </div>
            </div>

            {/* Regional Weather & Devil Fruit Status */}
            <div
              data-testid="estado-weather-card"
              className="rounded-lg border border-[#1d3557] bg-[#0b1629] p-2.5 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                  {renderWeatherIcon(weather.type, weather.color)}
                  <span>Clima en {currIsland.name}: {weather.label}</span>
                </span>
              </div>
              <p className="text-[10px] leading-snug text-slate-400">{weather.description}</p>

              {weatherDebuff.active ? (
                <div
                  data-testid="estado-weather-debuff"
                  className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                    weatherDebuff.combatDelta < 0
                      ? 'border border-rose-500/45 bg-rose-950/50 text-rose-200'
                      : 'border border-emerald-500/45 bg-emerald-950/45 text-emerald-200'
                  }`}
                >
                  <div>{weatherDebuff.label}</div>
                  <div className="mt-0.5 font-mono-num text-[10px] opacity-90">
                    {[
                      weatherDebuff.fuerzaDelta !== 0
                        ? `Fuerza ${weatherDebuff.fuerzaDelta > 0 ? '+' : ''}${weatherDebuff.fuerzaDelta}`
                        : null,
                      weatherDebuff.agilidadDelta !== 0
                        ? `Agilidad ${weatherDebuff.agilidadDelta > 0 ? '+' : ''}${weatherDebuff.agilidadDelta}`
                        : null,
                      weatherDebuff.aguanteDelta !== 0
                        ? `Aguante ${weatherDebuff.aguanteDelta > 0 ? '+' : ''}${weatherDebuff.aguanteDelta}`
                        : null,
                      weatherDebuff.ingenioDelta !== 0
                        ? `Ingenio ${weatherDebuff.ingenioDelta > 0 ? '+' : ''}${weatherDebuff.ingenioDelta}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              ) : pirate.devilFruit ? (
                <div className="text-[10px] text-purple-300">
                  Usuario de <strong>{pirate.devilFruit}</strong>: sin penalización en este clima (la lluvia/tormenta te debilitan).
                </div>
              ) : null}
            </div>

            {/* 4 RPG Stats Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-0.5">
              {[
                {
                  label: 'Fuerza',
                  val: stats.fuerza,
                  gear: gearTotals.fuerza,
                  wDelta: weatherDebuff.fuerzaDelta,
                },
                {
                  label: 'Agilidad',
                  val: stats.agilidad,
                  gear: gearTotals.agilidad,
                  wDelta: weatherDebuff.agilidadDelta,
                },
                {
                  label: 'Aguante',
                  val: stats.aguante,
                  gear: gearTotals.aguante,
                  wDelta: weatherDebuff.aguanteDelta,
                },
                {
                  label: 'Ingenio',
                  val: stats.ingenio,
                  gear: gearTotals.ingenio,
                  wDelta: weatherDebuff.ingenioDelta,
                },
              ].map((st) => (
                <div key={st.label} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-200">{st.label}</span>
                    <span className="font-mono-num font-bold text-white">
                      {st.val}
                      {st.gear > 0 && (
                        <span className="ml-1 text-[9px] text-amber-300">(+{st.gear})</span>
                      )}
                      {st.wDelta !== 0 && (
                        <span
                          className={`ml-1 text-[9px] ${
                            st.wDelta < 0 ? 'text-rose-400' : 'text-emerald-300'
                          }`}
                        >
                          ({st.wDelta > 0 ? '+' : ''}
                          {st.wDelta})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-[#2dd4bf]"
                      style={{ width: `${Math.min(100, Math.round((st.val / statMax) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Active Equipment Summary */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[10px]">
              <span className="text-slate-400 truncate">
                Equipo: {equippedItems.length > 0 ? equippedItems.map((i) => i.name).join(', ') : 'Sin equipo'}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('inventario')}
                className="shrink-0 font-bold text-amber-300 hover:underline cursor-pointer"
              >
                Abrir inventario
              </button>
            </div>

            {/* Quick Mission Shortcut */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400 truncate">
                Jefe local: <strong className="text-rose-300">{boss.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('misiones')}
                className="rounded-lg bg-[#f5b82e] px-2.5 py-1 text-[11px] font-black text-slate-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
              >
                Elegir misión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: INVENTARIO (Gear Slots, Boss Drops, Devil Fruit & Traits) */}
      {activeTab === 'inventario' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-[#1d3557] bg-[#101f37] p-2">
              <div className="text-[10px] uppercase text-slate-400">Monedones</div>
              <div className="mt-0.5 font-mono-num text-sm font-black text-emerald-300">
                {pirate.berries}
              </div>
            </div>
            <div className="rounded-xl border border-[#1d3557] bg-[#101f37] p-2">
              <div className="text-[10px] uppercase text-slate-400">Jefes</div>
              <div className="mt-0.5 font-mono-num text-sm font-black text-rose-300">
                {pirate.bossesDefeated || 0}
              </div>
            </div>
            <div className="rounded-xl border border-[#1d3557] bg-[#101f37] p-2">
              <div className="text-[10px] uppercase text-slate-400">Fruta</div>
              <div className="mt-0.5 truncate text-[11px] font-bold text-purple-300">
                {pirate.devilFruit || 'Ninguna'}
              </div>
            </div>
          </div>

          {/* Equipped Slots */}
          <section className="rounded-xl border border-[#1d3557] bg-[#101f37] p-3 space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-amber-300">
              Equipo Activo (3 ranuras)
            </div>
            {(['arma', 'armadura', 'amuleto'] as EquipmentSlot[]).map((slot) => {
              const equippedId = pirate.equipped?.[slot];
              const item = getEquipmentItem(equippedId);
              const style = item ? RARITY_STYLES[item.rarity] : null;
              return (
                <div
                  key={slot}
                  data-testid={`equipped-slot-${slot}`}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${
                    style ? `${style.border} bg-[#091324]` : 'border-slate-800 bg-[#08101e]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-300">
                        {SLOT_LABELS[slot]}
                      </span>
                      {item ? (
                        <>
                          <span className="truncate text-xs font-bold text-white">{item.name}</span>
                          {style && (
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${style.badge}`}>
                              {style.label}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-500">Ranura vacía</span>
                      )}
                    </div>
                    {item && (
                      <div className="mt-0.5 text-[10px] font-mono-num text-teal-300">
                        {formatItemStatTags(item).join(' · ')}
                      </div>
                    )}
                  </div>

                  {item && (
                    <button
                      type="button"
                      onClick={() => onUnequipSlot(pirate.id, slot)}
                      className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold text-slate-200 hover:border-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              );
            })}
          </section>

          {/* Obtained Inventory Loot */}
          <section className="rounded-xl border border-[#1d3557] bg-[#101f37] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-teal-300">
                Botín Obtenido ({inventoryItems.length})
              </span>
            </div>

            {inventoryItems.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-[#091324] p-2.5 text-[11px] text-slate-400 leading-relaxed">
                Aún no tienes piezas de equipo. Derrota a <strong className="text-rose-300">{boss.name}</strong> o a los Subjefes en <strong className="text-amber-300">Misiones</strong> para conseguir espadas, armaduras y amuletos.
              </div>
            ) : (
              <div className="space-y-2">
                {inventoryItems.map((item) => {
                  const isEquipped = pirate.equipped?.[item.slot] === item.id;
                  const style = RARITY_STYLES[item.rarity];
                  return (
                    <div
                      key={item.id}
                      data-testid={`inventory-item-${item.id}`}
                      className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 bg-[#091324] ${style.border}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-black text-white">{item.name}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${style.badge}`}>
                            {style.label}
                          </span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">
                            {SLOT_LABELS[item.slot]}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-400">{item.description}</p>
                        <div className="mt-0.5 text-[10px] font-mono-num font-bold text-teal-300">
                          {formatItemStatTags(item).join(' · ')}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isEquipped}
                        onClick={() => onEquipItem(pirate.id, item.id)}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-black cursor-pointer ${
                          isEquipped
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                            : 'bg-[#f5b82e] text-slate-950 hover:bg-amber-300'
                        }`}
                      >
                        {isEquipped ? 'Equipado' : 'Equipar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Local Boss Possible Drops Hint */}
            {bossDrops.length > 0 && (
              <div className="pt-1.5 border-t border-slate-800/80">
                <div className="text-[10px] font-bold text-slate-400 mb-1">
                  Drops posibles de {boss.name} en {currIsland.name}:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {bossDrops.map((drop) => (
                    <span
                      key={drop.id}
                      className="rounded border border-slate-700 bg-[#08101e] px-2 py-0.5 text-[10px] text-slate-300"
                    >
                      {drop.name} ({SLOT_LABELS[drop.slot]})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Traits with Advantage & Disadvantage */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Rasgos de Personaje
            </div>
            {[...pirate.physicalTraits, ...pirate.mentalTraits].map((id) => {
              const opt = getTraitOption(id);
              if (!opt) return null;
              return (
                <div
                  key={id}
                  className="rounded-xl border border-[#1d3557] bg-[#101f37] px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{opt.label}</span>
                    <span className="text-[10px] uppercase text-slate-400">
                      {opt.category === 'physical' ? 'Físico' : 'Psicológico'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-emerald-300">+ {opt.advantage}</div>
                  <div className="text-[10px] text-rose-300">- {opt.disadvantage}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: BUILD (In-Map Basic Editing: Clothes, Hats, Scars & Crew; Race & Hair locked at creation) */}
      {activeTab === 'build' && (
        <div className="space-y-3">
          {/* Live Stage Preview + Read-Only Creation Traits */}
          <div className="flex items-center gap-3 rounded-xl border border-[#1d3557] bg-[#0b1628] p-3">
            <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-[#060f1d]">
              <PirateAvatarSvg
                name={pirate.name}
                flagColor={pirate.flagColor}
                race={pirate.race}
                hatStyle={pirate.hatStyle}
                hatColor={pirate.hatColor}
                skinTone={pirate.skinTone}
                hairStyle={pirate.hairStyle}
                hairColor={pirate.hairColor}
                bodyBuild={pirate.bodyBuild}
                outfitStyle={pirate.outfitStyle}
                outfitColor={pirate.outfitColor}
                accessory={pirate.accessory}
                accessoryColor={pirate.accessoryColor}
                capeStyle={pirate.capeStyle}
                capeColor={pirate.capeColor}
                role={pirate.role}
                hasEquippedWeapon={hasEquippedWeapon}
                variant="stage"
                size={74}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-xs font-black text-white">
                {raceInfo.label} ·{' '}
                {HAIR_STYLES.find((h) => h.id === pirate.hairStyle)?.label ?? pirate.hairStyle}
              </div>
              <p className="text-[10px] text-amber-300/90 font-semibold leading-snug" data-testid="build-locked-notice">
                Raza y pelo fijados al crear el personaje
              </p>
              <p className="text-[10px] text-slate-400 leading-snug">{raceInfo.hint}</p>
              <div className="text-[10px] font-bold text-teal-300">
                {[
                  raceInfo.fuerzaBonus !== 0
                    ? `${raceInfo.fuerzaBonus > 0 ? '+' : ''}${raceInfo.fuerzaBonus} Fue`
                    : null,
                  raceInfo.agilidadBonus !== 0
                    ? `${raceInfo.agilidadBonus > 0 ? '+' : ''}${raceInfo.agilidadBonus} Agi`
                    : null,
                  raceInfo.aguanteBonus !== 0
                    ? `${raceInfo.aguanteBonus > 0 ? '+' : ''}${raceInfo.aguanteBonus} Agu`
                    : null,
                  raceInfo.ingenioBonus !== 0
                    ? `${raceInfo.ingenioBonus > 0 ? '+' : ''}${raceInfo.ingenioBonus} Ing`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>

          {/* Ropa, Color y Capa */}
          <div className="rounded-xl border border-[#1d3557] bg-[#101f37] p-2.5 space-y-2.5">
            <HorizontalOptionRail label="Ropa y Atuendo" testId="build-rail-outfit">
              {OUTFIT_STYLES.map((out) => (
                <button
                  key={out.id}
                  type="button"
                  data-testid={`build-outfit-${out.id}`}
                  onClick={() => onUpdateBuild(pirate.id, { outfitStyle: out.id })}
                  className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                    pirate.outfitStyle === out.id
                      ? 'border-sky-300 bg-sky-400 text-slate-950'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {out.label}
                </button>
              ))}
            </HorizontalOptionRail>

            <div className="flex flex-wrap gap-1.5">
              {OUTFIT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  aria-label={`Color de ropa ${c.label}`}
                  onClick={() => onUpdateBuild(pirate.id, { outfitColor: c.hex })}
                  className={`h-5 w-5 rounded-full border-2 cursor-pointer ${
                    pirate.outfitColor === c.hex ? 'border-amber-300 scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            <div className="pt-1.5 border-t border-slate-800">
              <HorizontalOptionRail
                label="Capa o Abrigo en Espalda"
                testId="build-rail-cape"
                rightHint={
                  (pirate.capeStyle ?? 'none') !== 'none' ? (
                    <span
                      data-testid="build-cape-color-hint"
                      className="flex items-center gap-1 text-[10px] font-bold text-amber-200"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm border border-white/40"
                        style={{
                          backgroundColor:
                            pirate.capeColor ??
                            CAPE_OPTIONS.find((c) => c.id === pirate.capeStyle)?.defaultColor ??
                            '#1e293b',
                        }}
                      />
                      <span>
                        {getItemColorLabel(
                          pirate.capeColor ??
                            CAPE_OPTIONS.find((c) => c.id === pirate.capeStyle)?.defaultColor
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400">Re-clic para color</span>
                  )
                }
              >
                {CAPE_OPTIONS.map((cOpt) => {
                  const activeCape = pirate.capeStyle ?? 'none';
                  const selected = activeCape === cOpt.id;
                  return (
                    <button
                      key={cOpt.id}
                      type="button"
                      data-testid={`build-cape-${cOpt.id}`}
                      onClick={() => {
                        if (selected && cOpt.id !== 'none') {
                          onUpdateBuild(pirate.id, {
                            capeColor: getNextCycleColor(pirate.capeColor, cOpt.defaultColor),
                          });
                        } else {
                          onUpdateBuild(pirate.id, {
                            capeStyle: cOpt.id,
                            capeColor: cOpt.id === 'none' ? undefined : cOpt.defaultColor,
                          });
                        }
                      }}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'border-amber-200 bg-[#f5b82e] text-slate-950'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {selected && cOpt.id !== 'none' && (
                        <span
                          className="h-2.5 w-2.5 rounded-sm border border-slate-950/60"
                          style={{ backgroundColor: pirate.capeColor ?? cOpt.defaultColor }}
                        />
                      )}
                      <span>{cOpt.label}</span>
                    </button>
                  );
                })}
              </HorizontalOptionRail>
            </div>
          </div>

          {/* Sombrero, Cicatrices y Marcas (Re-click cycles color) */}
          <div className="rounded-xl border border-[#1d3557] bg-[#101f37] p-2.5 space-y-2.5">
            <HorizontalOptionRail
              label="Sombrero o Corona"
              testId="build-rail-hat"
              rightHint={
                pirate.hatStyle !== 'none' ? (
                  <span
                    data-testid="build-hat-color-hint"
                    className="flex items-center gap-1 text-[10px] font-bold text-teal-200"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm border border-white/40"
                      style={{
                        backgroundColor:
                          pirate.hatColor ??
                          HAT_OPTIONS.find((h) => h.id === pirate.hatStyle)?.defaultColor ??
                          '#1e293b',
                      }}
                    />
                    <span>
                      {getItemColorLabel(
                        pirate.hatColor ??
                          HAT_OPTIONS.find((h) => h.id === pirate.hatStyle)?.defaultColor
                      )}
                    </span>
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-400">Re-clic para color</span>
                )
              }
            >
              {HAT_OPTIONS.map((hat) => {
                const selected = pirate.hatStyle === hat.id;
                return (
                  <button
                    key={hat.id}
                    type="button"
                    data-testid={`build-hat-${hat.id}`}
                    onClick={() => {
                      if (selected && hat.id !== 'none') {
                        onUpdateBuild(pirate.id, {
                          hatColor: getNextCycleColor(pirate.hatColor, hat.defaultColor),
                        });
                      } else {
                        onUpdateBuild(pirate.id, {
                          hatStyle: hat.id,
                          hatColor: hat.id === 'none' ? undefined : hat.defaultColor,
                        });
                      }
                    }}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                      selected
                        ? 'border-teal-200 bg-teal-400 text-slate-950'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {selected && hat.id !== 'none' && (
                      <span
                        className="h-2.5 w-2.5 rounded-sm border border-slate-950/60"
                        style={{ backgroundColor: pirate.hatColor ?? hat.defaultColor }}
                      />
                    )}
                    <span>{hat.label}</span>
                  </button>
                );
              })}
            </HorizontalOptionRail>

            <div className="pt-1.5 border-t border-slate-800">
              <HorizontalOptionRail
                label="Cicatrices y Accesorios"
                testId="build-rail-accessory"
                rightHint={
                  pirate.accessory !== 'none' ? (
                    <span
                      data-testid="build-acc-color-hint"
                      className="flex items-center gap-1 text-[10px] font-bold text-amber-200"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm border border-white/40"
                        style={{
                          backgroundColor:
                            pirate.accessoryColor ??
                            ACCESSORY_OPTIONS.find((a) => a.id === pirate.accessory)
                              ?.defaultColor ??
                            '#b91c1c',
                        }}
                      />
                      <span>
                        {getItemColorLabel(
                          pirate.accessoryColor ??
                            ACCESSORY_OPTIONS.find((a) => a.id === pirate.accessory)?.defaultColor
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400">Re-clic para color</span>
                  )
                }
              >
                {ACCESSORY_OPTIONS.map((acc) => {
                  const selected = pirate.accessory === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      data-testid={`build-acc-${acc.id}`}
                      onClick={() => {
                        if (selected && acc.id !== 'none') {
                          onUpdateBuild(pirate.id, {
                            accessoryColor: getNextCycleColor(
                              pirate.accessoryColor,
                              acc.defaultColor
                            ),
                          });
                        } else {
                          onUpdateBuild(pirate.id, {
                            accessory: acc.id,
                            accessoryColor: acc.id === 'none' ? undefined : acc.defaultColor,
                          });
                        }
                      }}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'border-amber-200 bg-amber-400 text-slate-950'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {selected && acc.id !== 'none' && (
                        <span
                          className="h-2.5 w-2.5 rounded-sm border border-slate-950/60"
                          style={{ backgroundColor: pirate.accessoryColor ?? acc.defaultColor }}
                        />
                      )}
                      <span>{acc.label}</span>
                    </button>
                  );
                })}
              </HorizontalOptionRail>
            </div>
          </div>

          {/* In-World Crew Management */}
          <section className="rounded-xl border border-teal-500/35 bg-[#0e2036] p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-teal-300">
                <Users className="h-3.5 w-3.5" />
                Tripulación y Rol
              </span>
              {!editingCrew && (
                <button
                  type="button"
                  onClick={() => setEditingCrew(true)}
                  className="flex items-center gap-1 rounded-lg border border-teal-400/40 bg-teal-400/15 px-2 py-0.5 text-[10px] font-bold text-teal-200 hover:bg-teal-400/25 cursor-pointer"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>{hasCrew ? 'Editar' : 'Formar'}</span>
                </button>
              )}
            </div>

            {editingCrew ? (
              <form onSubmit={handleSaveCrew} className="space-y-2">
                <input
                  type="text"
                  maxLength={48}
                  value={crewInput}
                  onChange={(e) => setCrewInput(e.target.value)}
                  placeholder={`Ej. Banda de ${pirate.name}`}
                  className="w-full rounded-lg border border-slate-700 bg-[#081221] px-2.5 py-1.5 text-xs text-white focus:border-teal-400 focus:outline-none"
                />
                <div className="flex flex-wrap gap-1">
                  {PIRATE_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleInput(r)}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                        roleInput === r
                          ? 'bg-teal-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex gap-1.5">
                    {FLAG_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        aria-label={c.label}
                        onClick={() => setColorInput(c.hex)}
                        className={`h-4 w-4 rounded-full border-2 cursor-pointer ${
                          colorInput === c.hex ? 'border-amber-300 scale-110' : 'border-slate-600'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingCrew(false)}
                      className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1 rounded-md bg-teal-400 px-2 py-1 text-[10px] font-black text-slate-950 cursor-pointer"
                    >
                      <Check className="h-3 w-3 stroke-[3]" />
                      Guardar
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white truncate">
                  {hasCrew ? pirate.crewName : 'En solitario'}
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  {pirate.role}
                </span>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB: NOTICIAS */}
      {activeTab === 'noticias' && (
        <div className="space-y-2">
          {characterEvents.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#101f37] p-4 text-xs text-slate-400">
              Aún no hay sucesos registrados. Selecciona una misión o deja que explore la isla.
            </div>
          ) : (
            characterEvents.slice(0, 25).map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => {
                  onChangeMapView('globe');
                  onFocusIsland(ev.islandId);
                }}
                className={`w-full text-left rounded-xl border p-2.5 transition-colors cursor-pointer ${
                  ev.type === 'drop'
                    ? 'border-amber-400/50 bg-amber-950/25 hover:border-amber-300'
                    : 'border-[#1d3557] bg-[#101f37] hover:border-amber-400/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-bold" style={{ color: getSeaBadgeColor(ev.sea) }}>
                    {ev.sea} · Día {ev.day} ({ev.timeLabel})
                  </span>
                  {ev.bountyDelta > 0 && (
                    <span className="font-mono-num font-black text-amber-300">
                      +{formatShortBounty(ev.bountyDelta)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-200">{ev.message}</p>
              </button>
            ))
          )}
        </div>
      )}

      {/* TAB: MISIONES */}
      {activeTab === 'misiones' && (
        <div className="space-y-3.5">
          {/* Island Canon Size & Multi-Day Stay Banner */}
          <div className="rounded-xl border border-teal-500/35 bg-[#0e2036] px-3 py-2 text-[11px] text-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-black text-teal-300 capitalize">Isla {sizeTier}</span>
              <span className="text-slate-400">
                {' '}
                · {currIsland.canonSizeNote || currIsland.description}
              </span>
            </div>
            <span className="font-mono-num font-black text-amber-300 shrink-0 whitespace-nowrap">
              Día {daysHere}/{recommendedDays}
            </span>
          </div>

          {/* NPC Quests Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-300">
              <span>Encargos de Habitantes (NPC)</span>
              <span className="font-mono-num text-slate-400">
                {doneQuestsCount}/{npcQuests.length}
              </span>
            </div>
            {npcQuests.map((q) => {
              const done = completedQuestsSet.has(q.id);
              return (
                <div
                  key={q.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border p-2 ${
                    done
                      ? 'border-emerald-500/40 bg-emerald-950/20'
                      : 'border-[#1d3557] bg-[#101f37]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#081221]">
                      <PirateAvatarSvg
                        name={q.npcName}
                        flagColor={q.outfitColor}
                        race={q.race}
                        hatStyle={q.hatStyle}
                        hatColor={q.hatColor}
                        skinTone={q.skinTone}
                        hairStyle={q.hairStyle}
                        hairColor={q.hairColor}
                        bodyBuild={q.bodyBuild}
                        outfitStyle={q.outfitStyle}
                        outfitColor={q.outfitColor}
                        accessory={q.accessory}
                        accessoryColor={q.accessoryColor}
                        capeStyle={q.capeStyle}
                        capeColor={q.capeColor}
                        weaponStyle={q.weaponStyle}
                        size={34}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-xs font-black text-white">
                        <span className="truncate">{q.title}</span>
                        {done && (
                          <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] text-emerald-300 shrink-0">
                            Hecha
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {q.npcName} ({q.npcRole})
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-1.5 text-[9px] font-mono-num font-bold">
                        <span className="text-sky-300">+{q.xpReward} XP</span>
                        <span className="text-emerald-300">+{q.berriesReward} mon</span>
                        {q.bountyReward > 0 && (
                          <span className="text-amber-300">
                            +{formatShortBounty(q.bountyReward)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(pirate.sailingToIslandId)}
                    onClick={() => onRunNpcQuest(pirate.id, q.id)}
                    className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-black cursor-pointer disabled:opacity-50 ${
                      done
                        ? 'border border-emerald-400/40 bg-emerald-950/60 text-emerald-200 hover:bg-emerald-900/60'
                        : 'bg-teal-400 text-slate-950 hover:bg-teal-300'
                    }`}
                  >
                    {done ? 'Repetir' : 'Cumplir'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Mini-Bosses Section */}
          {miniBosses.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-300">
                Subjefes de {currIsland.name}
              </div>
              {miniBosses.map((mb) => {
                const defeated = defeatedMiniBossesSet.has(mb.id);
                const mbDrops = (mb.dropPool ?? [])
                  .map((id) => getEquipmentItem(id)?.name)
                  .filter(Boolean);
                return (
                  <div
                    key={mb.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-2 ${
                      defeated
                        ? 'border-emerald-500/40 bg-emerald-950/15'
                        : 'border-orange-500/40 bg-orange-950/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-500/40 bg-[#081221]">
                        <PirateAvatarSvg
                          name={mb.name}
                          flagColor={mb.outfitColor}
                          race={mb.race}
                          hatStyle={mb.hatStyle}
                          hatColor={mb.hatColor}
                          skinTone={mb.skinTone}
                          hairStyle={mb.hairStyle ?? 'spiky'}
                          hairColor={mb.hairColor}
                          bodyBuild={mb.bodyBuild}
                          outfitStyle={mb.outfitStyle ?? 'coat'}
                          outfitColor={mb.outfitColor}
                          accessory={mb.accessory}
                          accessoryColor={mb.accessoryColor}
                          capeStyle={mb.capeStyle}
                          capeColor={mb.capeColor}
                          weaponStyle={mb.weaponStyle}
                          hasEquippedWeapon
                          size={34}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-xs font-black text-white">
                          <span className="truncate">{mb.name}</span>
                          {defeated && (
                            <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] text-emerald-300">
                              Vencido
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {mb.title} · Poder {mb.power}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-[9px] font-mono-num font-bold">
                          <span className="text-sky-300">+{mb.xpReward} XP</span>
                          <span className="text-amber-300">
                            +{formatShortBounty(mb.bountyReward)}
                          </span>
                          {mbDrops.length > 0 && (
                            <span className="text-purple-300 truncate">Drop: {mbDrops[0]}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(pirate.sailingToIslandId)}
                      onClick={() => onChallengeMiniBoss(pirate.id, mb.id)}
                      className="shrink-0 rounded-lg bg-orange-500 px-2 py-1.5 text-[10px] font-black text-slate-950 hover:bg-orange-400 cursor-pointer disabled:opacity-50"
                    >
                      Desafiar
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* General Missions */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Misiones generales en {currIsland.name}
            </div>
            {islandMissions.map((m) => (
              <div
                key={m.id}
                className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${
                  m.id === 'jefe'
                    ? 'border-rose-500/45 bg-rose-950/25'
                    : 'border-[#1d3557] bg-[#101f37]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-white">
                    {m.id === 'jefe' && <Skull className="h-3.5 w-3.5 text-rose-400 shrink-0" />}
                    {m.id === 'duelo' && <Swords className="h-3.5 w-3.5 text-amber-300 shrink-0" />}
                    <span className="truncate">{m.title}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400 leading-snug">{m.subtitle}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[9px] font-mono-num font-bold">
                    <span className="text-sky-300">+{m.xpReward} XP</span>
                    <span className="text-emerald-300">+{m.berriesReward} mon</span>
                    <span
                      className={
                        m.id === 'jefe' || m.id === 'duelo' ? 'text-amber-300' : 'text-slate-500'
                      }
                    >
                      {m.bountyNote}
                    </span>
                    {m.id === 'jefe' && bossDrops.length > 0 && (
                      <span className="text-purple-300">
                        Botín: {bossDrops.map((d) => d.name).join(' / ')}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={Boolean(pirate.sailingToIslandId)}
                  onClick={() => onRunMission(pirate.id, m.id)}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-black cursor-pointer disabled:opacity-50 ${
                    m.id === 'jefe'
                      ? 'bg-rose-500 text-white hover:bg-rose-400'
                      : 'bg-[#f5b82e] text-slate-950 hover:bg-amber-300'
                  }`}
                >
                  Aceptar
                </button>
              </div>
            ))}
          </div>

          {/* Voyage Selector */}
          <div className="rounded-xl border border-[#1d3557] bg-[#101f37] p-2.5 space-y-2">
            <span className="text-xs font-black text-sky-300 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" />
              Zarpar a otra isla (en orden canónico)
            </span>

            <div className="flex flex-wrap gap-1">
              {SEAS_ORDER.map((sea) => (
                <button
                  key={sea}
                  type="button"
                  onClick={() => setSelectedSeaFilter(sea)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold cursor-pointer ${
                    selectedSeaFilter === sea
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {sea}
                </button>
              ))}
            </div>

            <div className="max-h-40 overflow-y-auto nautical-scroll space-y-1.5 pr-1">
              {islands
                .filter((isl) => isl.sea === selectedSeaFilter && isl.id !== currIsland.id)
                .map((isl) => {
                  const viaCenter = getNavigationPathCoords(currIsland, isl).length > 2;
                  const islTier = getIslandSizeTier(isl);
                  const islDays = getIslandRecommendedDays(isl);
                  return (
                    <div
                      key={isl.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#0b1526] px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-bold text-white">
                          {isl.canonOrder ? `#${isl.canonOrder} ` : ''}
                          {isl.name}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          <span className="capitalize text-teal-300">{islTier}</span> · ~{islDays}d ·
                          Peligro {isl.dangerTier}/5
                          {viaCenter ? ' · Centro' : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(pirate.sailingToIslandId)}
                        onClick={() => {
                          onStartVoyage(pirate.id, isl.id);
                          onChangeMapView('globe');
                          setActiveTab('mapa');
                        }}
                        className="shrink-0 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-black text-slate-950 hover:bg-sky-400 cursor-pointer disabled:opacity-50"
                      >
                        Zarpar
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: MAPA */}
      {activeTab === 'mapa' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#1d3557] bg-[#101f37] p-3 text-xs space-y-2">
            <div className="font-bold text-amber-300">Navegación Mundial y Paso Central</div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Para cruzar de un lado del mundo al otro, tu barco traza la ruta pasando por el{' '}
              <strong>Centro del Mundo (Montaña Invertida)</strong>. Haz zoom a cualquier isla para ver su clima e interior en 3D.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={onFocusMyShip}
                className="rounded-lg bg-[#f5b82e] px-2.5 py-1.5 text-[11px] font-black text-slate-950 cursor-pointer"
              >
                Centrar en mi barco
              </button>
              <button
                type="button"
                onClick={onFocusWorldCenter}
                className="rounded-lg border border-sky-400/50 bg-sky-500/15 px-2.5 py-1.5 text-[11px] font-bold text-sky-200 cursor-pointer"
              >
                Centro (0°, 0°)
              </button>
              <button
                type="button"
                onClick={onFocusFullGlobe}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 cursor-pointer"
              >
                Globo completo
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('misiones')}
            className="w-full rounded-xl border border-amber-400/40 bg-amber-400/10 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/20 cursor-pointer"
          >
            Elegir isla destino para zarpar
          </button>
        </div>
      )}

      {/* TAB: MÁS */}
      {activeTab === 'mas' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#1d3557] bg-[#101f37] py-2 text-xs font-bold text-slate-200 hover:border-amber-400 cursor-pointer"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-teal-300" />
              )}
              <span>{muted ? 'Sonido off' : 'Sonido on'}</span>
            </button>
            <button
              type="button"
              onClick={onPause}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#1d3557] bg-[#101f37] py-2 text-xs font-bold text-slate-200 hover:border-amber-400 cursor-pointer"
            >
              <Pause className="h-4 w-4 text-amber-300" />
              <span>Pausar</span>
            </button>
          </div>

          <button
            type="button"
            disabled={authBusy}
            onClick={onAuthAction}
            className="w-full rounded-xl border border-[#1d3557] bg-[#101f37] px-3 py-2 text-xs font-bold text-slate-200 hover:border-amber-400 cursor-pointer text-left flex items-center justify-between gap-2"
          >
            <span className="truncate">
              {user
                ? `Google: ${user.email || user.displayName}`
                : 'Conectar Google para guardar progreso'}
            </span>
            <span className="text-amber-300 font-black shrink-0">
              {user ? 'Salir' : 'Conectar'}
            </span>
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onEditCharacter(pirate)}
                className="flex items-center gap-1 rounded-xl border border-teal-400/45 bg-teal-950/45 px-3 py-1.5 text-xs font-bold text-teal-200 hover:bg-teal-900/60 cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Editar ficha</span>
              </button>
              <button
                type="button"
                onClick={onBackToMenu}
                className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Menú</span>
              </button>
            </div>

            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onDeleteCharacter(pirate.id)}
                  className="rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl border border-slate-700 px-2 py-1.5 text-xs text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 rounded-xl border border-rose-500/40 bg-rose-950/30 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-900/50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Borrar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* Full-Viewport Seamless Island Backdrop (only mounted when viewing Island) */}
      {!showGlobeViewport && (
        <div className="pointer-events-auto absolute inset-0 z-0">
          <IslandSceneView
            island={currIsland}
            pirate={pirate}
            day={day}
            minuteOfDay={minuteOfDay}
            sidePanelOpen={characterSideOpen}
            sameIslandPeers={sameIslandPeers}
            onMoveToSpot={(zone) => onMoveInIsland(pirate.id, zone)}
            onSelectSpotMission={(_, missionId) => {
              onRunMission(pirate.id, missionId);
            }}
            onSelectNpcQuest={(questId) => {
              onRunNpcQuest(pirate.id, questId);
            }}
            onChallengeMiniBoss={(miniBossId) => {
              onChallengeMiniBoss(pirate.id, miniBossId);
            }}
          />
        </div>
      )}

      {/* Top Floating HUD Bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2.5 sm:p-3.5">
        {/* Left Compact Brand + Badge + Day/Clock */}
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[#22395d] bg-[#0c172a]/95 px-3 py-1.5 shadow-xl">
          <button
            type="button"
            onClick={onBackToMenu}
            aria-label="Volver al menú de personajes"
            className="flex items-center gap-1.5 text-left hover:opacity-90 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-600 bg-slate-900 font-display text-[10px] font-black text-amber-300">
              VO
            </span>
            <span className="hidden sm:inline font-display text-xs font-black tracking-wide text-white leading-tight">
              VIVID OCEAN
            </span>
          </button>

          <span className="rounded-full bg-[#eab308]/20 border border-[#eab308]/60 px-2.5 py-0.5 font-mono-num text-xs font-black text-[#facc15] whitespace-nowrap">
            {formatShortBounty(pirate.bounty)}
          </span>

          <div className="border-l border-slate-700/80 pl-2.5 font-mono-num text-[11px] leading-tight text-slate-300 whitespace-nowrap">
            <div>
              Sem {weekInfo.week} · D{weekInfo.dayOfWeek}/7
            </div>
            <div className="font-bold text-white">{formatClock(minuteOfDay)}</div>
          </div>
        </div>

        {/* Right Action Cluster: View Toggle + Audio + Google G */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (showGlobeViewport) {
                onChangeMapView('island');
                if (activeTab === 'mapa') setActiveTab('estado');
              } else {
                onChangeMapView('globe');
                onFocusMyShip();
              }
            }}
            className="flex items-center gap-1.5 rounded-xl border border-[#22395d] bg-[#0c172a]/95 px-2.5 py-2 text-xs font-bold text-slate-100 hover:border-amber-400 cursor-pointer shadow-lg whitespace-nowrap"
          >
            {showGlobeViewport ? (
              <>
                <Anchor className="h-3.5 w-3.5 text-amber-300" />
                <span>Ver Isla</span>
              </>
            ) : (
              <>
                <Globe className="h-3.5 w-3.5 text-sky-300" />
                <span>Globo 3D</span>
              </>
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Activar sonido [M]' : 'Silenciar sonido [M]'}
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-[#22395d] bg-[#0c172a]/95 text-slate-200 hover:border-amber-400 cursor-pointer shadow-lg"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            disabled={authBusy}
            onClick={onAuthAction}
            title={
              user
                ? `Conectado: ${user.displayName || user.email} (clic para cerrar sesión)`
                : 'Entrar con Google para guardar tu cuenta'
            }
            aria-label={user ? 'Cuenta Google conectada' : 'Entrar con Google'}
            className={`flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl px-2.5 text-sm font-black shadow-lg cursor-pointer transition-transform active:scale-95 ${
              user
                ? 'border border-emerald-400/60 bg-emerald-600 text-white'
                : 'bg-[#ea5a3a] text-white hover:bg-[#f16a4c]'
            }`}
          >
            <span>G</span>
            {user && (
              <span className="hidden md:inline max-w-[90px] truncate text-xs font-semibold">
                {user.displayName?.split(' ')[0] || 'Google'}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sailing Progress Overlay when sailing on 3D Globe */}
      {destIsland && (
        <div
          className={`pointer-events-auto fixed bottom-16 md:bottom-4 right-4 z-30 w-[90%] max-w-sm rounded-xl border border-amber-400/50 bg-[#081221]/95 px-3.5 py-2 shadow-xl ${
            characterSideOpen ? 'md:left-[445px] md:right-auto' : 'md:left-[88px] md:right-auto'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-200">
            <span className="flex items-center gap-1.5 truncate">
              <Compass className="h-3.5 w-3.5 text-amber-300 shrink-0" />
              Rumbo a {destIsland.name} ({destIsland.sea})
            </span>
            <span className="font-mono-num text-white ml-2">
              {Math.min(100, Math.round(pirate.sailProgress * 100))}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-[#f5b82e] transition-all"
              style={{ width: `${Math.min(100, Math.round(pirate.sailProgress * 100))}%` }}
            />
          </div>
        </div>
      )}

      {authNotice && (
        <div
          role="status"
          className="pointer-events-auto fixed right-3 top-14 z-30 max-w-xs rounded-lg border border-amber-400/50 bg-[#081221]/95 px-3 py-1.5 text-[11px] text-amber-200 shadow-lg"
        >
          {authNotice}
        </div>
      )}

      {/* DESKTOP: Left-Side Docked Vertical Tab Rail + Collapsible Character Card */}
      <div className="pointer-events-none hidden md:flex fixed left-2.5 top-[68px] bottom-3 z-30 items-stretch gap-2">
        {/* Vertical Tab Rail */}
        <nav
          aria-label="Secciones del personaje"
          className="pointer-events-auto flex w-[62px] shrink-0 flex-col items-center justify-between rounded-2xl border border-[#22395d] bg-[#0a1426]/95 py-2 px-1 shadow-2xl"
        >
          <button
            type="button"
            data-testid="toggle-side-panel"
            onClick={() => onChangeCharacterSideOpen(!characterSideOpen)}
            title={characterSideOpen ? 'Contraer panel' : 'Desplegar panel de personaje'}
            aria-label={characterSideOpen ? 'Contraer panel' : 'Desplegar panel'}
            className="flex h-8 w-11 items-center justify-center rounded-lg border border-slate-700/80 bg-[#101f37] text-amber-300 hover:border-amber-400 cursor-pointer mb-1"
          >
            {characterSideOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>

          <div className="flex flex-1 flex-col items-center justify-start gap-1 w-full overflow-y-auto">
            {navItems.map((tab) => {
              const isSelected = characterSideOpen && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`tab-${tab.id}`}
                  aria-current={isSelected ? 'page' : undefined}
                  onClick={() => handleTabSelect(tab.id)}
                  className={`relative flex w-full flex-col items-center justify-center gap-0.5 rounded-xl py-2 px-0.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#f5b82e]/18 text-[#f5b82e] border border-[#f5b82e]/50'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent'
                  }`}
                >
                  <div className="relative">
                    {tab.icon}
                    {tab.badge && (
                      <span className="absolute -right-2.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[8px] font-black text-white">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-bold leading-none tracking-tight">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-1 border-t border-slate-800/80 w-full flex flex-col items-center">
            <span className="font-mono-num text-[9px] font-bold text-emerald-300 flex items-center gap-0.5">
              <Coins className="h-2.5 w-2.5" />
              {pirate.berries}
            </span>
          </div>
        </nav>

        {/* Collapsible Side Character Card */}
        {characterSideOpen && (
          <section
            data-testid="character-side-panel"
            aria-label={`Panel lateral de ${pirate.name}`}
            className="pointer-events-auto flex w-[348px] lg:w-[366px] flex-col rounded-2xl border border-[#22395d] bg-[#0c172a]/95 text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.72)] overflow-hidden"
          >
            {renderPanelContent()}
          </section>
        )}
      </div>

      {/* MOBILE: Collapsible Bottom Drawer + Compact Horizontal Tab Bar */}
      <div className="pointer-events-none md:hidden fixed inset-x-0 bottom-0 z-30 flex flex-col">
        {characterSideOpen ? (
          <section
            data-testid="character-mobile-panel"
            aria-label={`Panel de ${pirate.name}`}
            className="pointer-events-auto mx-2 mb-1.5 flex max-h-[44vh] flex-col rounded-2xl border border-[#22395d] bg-[#0c172a]/95 text-slate-100 shadow-2xl overflow-hidden"
          >
            {renderPanelContent()}
          </section>
        ) : (
          <div className="pointer-events-auto mb-1.5 flex justify-center">
            <button
              type="button"
              onClick={() => onChangeCharacterSideOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-[#22395d] bg-[#0c172a]/95 px-3 py-1 text-[11px] font-bold text-amber-300 shadow-lg cursor-pointer"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
              <span>Abrir {pirate.name}</span>
            </button>
          </div>
        )}

        <nav
          aria-label="Navegación móvil del personaje"
          className="pointer-events-auto grid grid-cols-7 border-t border-[#1d3254] bg-[#0a1426] px-1 py-1.5 shadow-2xl"
        >
          {navItems.map((tab) => {
            const active = characterSideOpen && activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`mobile-tab-${tab.id}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => handleTabSelect(tab.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors cursor-pointer ${
                  active
                    ? 'text-[#f5b82e] bg-amber-400/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  {tab.icon}
                  {tab.badge && (
                    <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#ef4444] px-0.5 text-[8px] font-black text-white">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-semibold leading-none truncate max-w-full px-0.5">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
