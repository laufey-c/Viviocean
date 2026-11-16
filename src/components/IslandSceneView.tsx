import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor,
  CloudFog,
  CloudLightning,
  CloudRain,
  Coins,
  Compass,
  Flame,
  Snowflake,
  Sun,
  Swords,
  Wind,
} from 'lucide-react';
import { computeWeatherDebuff, getCharacterSpriteScale, getRankInfo } from '../game/sim';
import {
  getBossForIsland,
  getIslandRecommendedDays,
  getIslandSizeTier,
  getMiniBossesForIsland,
  getNpcsForIsland,
  getRegionalWeather,
  getShortStageName,
} from '../game/worldData';
import type {
  BodyBuild,
  HatStyle,
  Island,
  IslandBiome,
  IslandMissionId,
  IslandZoneId,
  OutfitStyle,
  Pirate,
  PirateRace,
  WeatherType,
} from '../game/types';
import { PirateAvatarSvg } from './PirateAvatarSvg';

interface IslandSceneViewProps {
  island: Island;
  pirate: Pirate;
  day?: number;
  minuteOfDay?: number;
  sidePanelOpen?: boolean;
  sameIslandPeers: Pirate[];
  onSelectSpotMission: (zone: IslandZoneId, missionId: IslandMissionId) => void;
  onMoveToSpot: (zone: IslandZoneId) => void;
  onSelectNpcQuest?: (questId: string) => void;
  onChallengeMiniBoss?: (miniBossId: string) => void;
}

interface ZoneCoord {
  id: IslandZoneId;
  missionId: IslandMissionId;
  label: string;
  labelX: number;
  labelY: number;
  standX: number;
  standY: number;
}

/**
 * Uniform 16-bit character scale across the entire island stage so Player,
 * Boss, Mini-Bosses, NPCs, Peers, and Residents share consistent proportions.
 */
const UNIFORM_ISLAND_SPRITE_SIZE = 24;

// Coordinates strictly mapped to the 2:1 interior island plateau (360x180 SVG)
const ZONE_COORDS: ZoneCoord[] = [
  { id: 'ruinas', missionId: 'explorar', label: 'Ruinas', labelX: 18, labelY: 7, standX: 21, standY: 32 },
  { id: 'dojo', missionId: 'entrenar', label: 'Dojo', labelX: 50, labelY: 6, standX: 50, standY: 31 },
  { id: 'taberna', missionId: 'taberna', label: 'Taberna', labelX: 18, labelY: 82, standX: 29, standY: 64 },
  { id: 'puerto', missionId: 'duelo', label: 'Muelle', labelX: 82, labelY: 82, standX: 77, standY: 67 },
  { id: 'jefe', missionId: 'jefe', label: 'Jefe', labelX: 82, labelY: 7, standX: 77, standY: 36 },
];

// Non-overlapping NPC Quest slots strictly inside the green island terrain (x: 13..66%, y: 26..74%)
const NPC_STAGE_SLOTS: Array<{ x: number; y: number }> = [
  { x: 13, y: 49 },
  { x: 43, y: 27 },
  { x: 69, y: 27 },
  { x: 50, y: 74 },
  { x: 34, y: 50 },
  { x: 66, y: 51 },
];

// Non-overlapping Mini-Boss slots strictly inside the green island terrain
const MINIBOSS_STAGE_SLOTS: Array<{ x: number; y: number }> = [
  { x: 83, y: 55 },
  { x: 24, y: 53 },
  { x: 50, y: 55 },
];

interface AmbientResident {
  id: string;
  baseX: number;
  baseY: number;
  race: PirateRace;
  hatStyle: HatStyle;
  outfitStyle: OutfitStyle;
  outfitColor: string;
  hairColor: string;
  skinTone: string;
  bodyBuild: BodyBuild;
}

function buildAmbientResidents(island: Island): AmbientResident[] {
  const tier = getIslandSizeTier(island);
  const count =
    tier === 'colosal' ? 5 : tier === 'grande' ? 4 : tier === 'mediana' ? 3 : 2;
  let hash = 0;
  for (let i = 0; i < island.id.length; i++) {
    hash = (hash * 31 + island.id.charCodeAt(i)) >>> 0;
  }

  const isElbaph = island.id === 'elbaph';
  const isWano = island.biome === 'pagoda';
  const isMarine = island.biome === 'marine';
  const isGyojin = island.id === 'isla-hombres-pez';
  const isMink = island.id === 'zou';
  const isSky = island.biome === 'sky';

  const baseCoords = [
    { x: 42, y: 41 },
    { x: 58, y: 61 },
    { x: 28, y: 38 },
    { x: 71, y: 60 },
    { x: 42, y: 64 },
  ];
  const outfitColors = isMarine
    ? ['#f8fafc', '#2563eb', '#cbd5e1']
    : isWano
    ? ['#dc2626', '#7c3aed', '#0d9488']
    : isElbaph
    ? ['#b45309', '#991b1b', '#15803d']
    : ['#0284c7', '#16a34a', '#d97706', '#9333ea'];
  const hairColors = ['#1c1917', '#78350f', '#facc15', '#b91c1c', '#2563eb'];
  const skinTones = ['#ffd6b0', '#f3c18c', '#d59c67', '#b67848'];

  return Array.from({ length: count }, (_, idx) => {
    const seed = hash + idx * 53;
    const coord = baseCoords[idx % baseCoords.length];
    return {
      id: `amb_${island.id}_${idx}`,
      baseX: coord.x,
      baseY: coord.y,
      race: isElbaph
        ? 'gigante'
        : isGyojin
        ? 'gyojin'
        : isMink
        ? 'mink'
        : isSky
        ? 'skypiea'
        : 'humano',
      hatStyle: isMarine
        ? 'marine'
        : isElbaph
        ? 'none'
        : idx % 3 === 0
        ? 'bandana'
        : 'none',
      outfitStyle: isMarine ? 'marine' : isWano ? 'kimono' : idx % 2 === 0 ? 'vest' : 'shirt',
      outfitColor: outfitColors[(seed + idx) % outfitColors.length],
      hairColor: hairColors[(seed >> 1) % hairColors.length],
      skinTone: skinTones[(seed >> 2) % skinTones.length],
      bodyBuild: isElbaph ? 'robust' : idx % 3 === 0 ? 'slim' : 'normal',
    };
  });
}

interface BiomePalette {
  oceanDeep: string;
  oceanMid: string;
  reef: string;
  foam: string;
  sand: string;
  sandCliff: string;
  turf: string;
  turfLight: string;
  turfDark: string;
  path: string;
  pathEdge: string;
}

function getBiomePalette(biome: IslandBiome): BiomePalette {
  switch (biome) {
    case 'desert':
      return {
        oceanDeep: '#092b52',
        oceanMid: '#104478',
        reef: '#0d9488',
        foam: '#93c5fd',
        sand: '#e8c067',
        sandCliff: '#9a6320',
        turf: '#d99b1e',
        turfLight: '#facc15',
        turfDark: '#a16207',
        path: '#f5e193',
        pathEdge: '#92400e',
      };
    case 'volcano':
      return {
        oceanDeep: '#091122',
        oceanMid: '#13233f',
        reef: '#1e293b',
        foam: '#64748b',
        sand: '#44403c',
        sandCliff: '#1c1917',
        turf: '#293241',
        turfLight: '#3b485e',
        turfDark: '#161e2b',
        path: '#57534e',
        pathEdge: '#b91c1c',
      };
    case 'sky':
      return {
        oceanDeep: '#0b4775',
        oceanMid: '#1c6ba3',
        reef: '#93c5fd',
        foam: '#e0f2fe',
        sand: '#cbd5e1',
        sandCliff: '#64748b',
        turf: '#e2e8f0',
        turfLight: '#f8fafc',
        turfDark: '#94a3b8',
        path: '#f3e3b3',
        pathEdge: '#64748b',
      };
    case 'candy':
      return {
        oceanDeep: '#0c3457',
        oceanMid: '#155080',
        reef: '#2dd4bf',
        foam: '#f9a8d4',
        sand: '#edd07b',
        sandCliff: '#b45309',
        turf: '#db4b94',
        turfLight: '#f472b6',
        turfDark: '#9d174d',
        path: '#fde68a',
        pathEdge: '#9d174d',
      };
    case 'marine':
      return {
        oceanDeep: '#072445',
        oceanMid: '#0f3968',
        reef: '#0f766e',
        foam: '#bae6fd',
        sand: '#94a3b8',
        sandCliff: '#475569',
        turf: '#64748b',
        turfLight: '#94a3b8',
        turfDark: '#334155',
        path: '#cbd5e1',
        pathEdge: '#1d4ed8',
      };
    case 'pagoda':
      return {
        oceanDeep: '#08274a',
        oceanMid: '#103e70',
        reef: '#0d9488',
        foam: '#93c5fd',
        sand: '#d4b276',
        sandCliff: '#7c5c2f',
        turf: '#3b6e42',
        turfLight: '#528f58',
        turfDark: '#264d2c',
        path: '#e6cb9a',
        pathEdge: '#7c5c2f',
      };
    case 'fire_ice':
      return {
        oceanDeep: '#092442',
        oceanMid: '#113761',
        reef: '#0284c7',
        foam: '#93c5fd',
        sand: '#475569',
        sandCliff: '#1e293b',
        turf: '#66240e',
        turfLight: '#853014',
        turfDark: '#381105',
        path: '#64748b',
        pathEdge: '#0f172a',
      };
    case 'colosseum':
      return {
        oceanDeep: '#092c52',
        oceanMid: '#114378',
        reef: '#0d9488',
        foam: '#93c5fd',
        sand: '#dbb97f',
        sandCliff: '#8a622c',
        turf: '#4c803b',
        turfLight: '#68a352',
        turfDark: '#315426',
        path: '#e6c88e',
        pathEdge: '#92400e',
      };
    case 'fortress':
      return {
        oceanDeep: '#082647',
        oceanMid: '#103b6b',
        reef: '#0284c7',
        foam: '#93c5fd',
        sand: '#64748b',
        sandCliff: '#334155',
        turf: '#475569',
        turfLight: '#64748b',
        turfDark: '#1e293b',
        path: '#94a3b8',
        pathEdge: '#0f172a',
      };
    case 'treasure':
      return {
        oceanDeep: '#08264a',
        oceanMid: '#103c6e',
        reef: '#0f766e',
        foam: '#93c5fd',
        sand: '#d4b87c',
        sandCliff: '#7d5d28',
        turf: '#2e6f3d',
        turfLight: '#438c52',
        turfDark: '#1c4a27',
        path: '#d1b071',
        pathEdge: '#78350f',
      };
    default:
      return {
        oceanDeep: '#092b52',
        oceanMid: '#114275',
        reef: '#0d9488',
        foam: '#93c5fd',
        sand: '#dbb97d',
        sandCliff: '#7d5c2b',
        turf: '#3b7542',
        turfLight: '#549658',
        turfDark: '#254f2b',
        path: '#d8ba7c',
        pathEdge: '#785626',
      };
  }
}

const PixelShip: React.FC<{ sailColor: string; className?: string }> = ({
  sailColor,
  className = '',
}) => (
  <svg
    width="26"
    height="22"
    viewBox="0 0 18 16"
    shapeRendering="crispEdges"
    style={{ imageRendering: 'pixelated' }}
    className={`select-none ${className}`}
    aria-hidden="true"
  >
    <rect x={2} y={13} width={14} height={2} fill="rgba(6, 20, 42, 0.45)" />
    <rect x={2} y={10} width={14} height={2} fill="#7c3a14" />
    <rect x={3} y={12} width={12} height={1} fill="#4a2008" />
    <rect x={8} y={2} width={2} height={8} fill="#4a2008" />
    <rect x={4} y={3} width={10} height={6} fill={sailColor || '#f8fafc'} />
    <rect x={4} y={7} width={10} height={2} fill="rgba(15, 23, 42, 0.25)" />
    <rect x={8} y={1} width={3} height={1} fill="#dc2626" />
  </svg>
);

const PixelPalmTree: React.FC<{ x: number; y: number; sakura?: boolean; candy?: boolean }> = ({
  x,
  y,
  sakura = false,
  candy = false,
}) => {
  const leaf = sakura ? '#f472b6' : candy ? '#fb7185' : '#22c55e';
  const leafDark = sakura ? '#db2777' : candy ? '#e11d48' : '#15803d';
  const leafLight = sakura ? '#fbcfe8' : candy ? '#fecdd3' : '#86efac';
  const trunk = candy ? '#f8fafc' : '#78350f';
  return (
    <g>
      <rect x={x + 1} y={y + 8} width={5} height={1} fill="rgba(10,16,30,0.38)" />
      <rect x={x + 2} y={y + 4} width={2} height={4} fill={trunk} />
      <rect x={x + 1} y={y + 1} width={5} height={3} fill={leaf} />
      <rect x={x} y={y + 2} width={7} height={2} fill={leafDark} />
      <rect x={x + 1} y={y} width={5} height={2} fill={leaf} />
      <rect x={x + 2} y={y} width={2} height={1} fill={leafLight} />
    </g>
  );
};

// Shrunk Nordic pixel conifer so Elbaph's colossal Giants & Treasure Tree Adam dwarf surrounding woods
const PixelPineTree: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <rect x={x + 1} y={y + 6} width={3} height={1} fill="rgba(6, 12, 24, 0.42)" />
    <rect x={x + 2} y={y + 4} width={1} height={2} fill="#451a03" />
    <rect x={x} y={y + 3} width={5} height={2} fill="#0f3d23" />
    <rect x={x + 1} y={y + 1} width={3} height={2} fill="#14532d" />
    <rect x={x + 2} y={y} width={1} height={1} fill="#166534" />
  </g>
);

function renderWeatherIcon(type: WeatherType, className = 'h-3.5 w-3.5') {
  switch (type) {
    case 'lluvia':
      return <CloudRain className={`${className} text-sky-300`} />;
    case 'tormenta':
      return <CloudLightning className={`${className} text-indigo-300`} />;
    case 'nieve':
      return <Snowflake className={`${className} text-cyan-100`} />;
    case 'viento':
      return <Wind className={`${className} text-teal-300`} />;
    case 'calor':
      return <Flame className={`${className} text-orange-300`} />;
    case 'niebla':
      return <CloudFog className={`${className} text-slate-300`} />;
    default:
      return <Sun className={`${className} text-amber-300`} />;
  }
}

export const IslandSceneView: React.FC<IslandSceneViewProps> = ({
  island,
  pirate,
  day = 1,
  minuteOfDay = 480,
  sidePanelOpen = true,
  sameIslandPeers,
  onSelectSpotMission,
  onMoveToSpot,
  onSelectNpcQuest,
  onChallengeMiniBoss,
}) => {
  const boss = useMemo(() => getBossForIsland(island), [island]);
  const npcQuests = useMemo(() => getNpcsForIsland(island), [island]);
  const miniBosses = useMemo(() => getMiniBossesForIsland(island), [island]);
  const ambientResidents = useMemo(() => buildAmbientResidents(island), [island]);
  const sizeTier = useMemo(() => getIslandSizeTier(island), [island]);
  const recommendedDays = useMemo(() => getIslandRecommendedDays(island), [island]);
  const pal = useMemo(() => getBiomePalette(island.biome), [island.biome]);
  const weather = useMemo(
    () => getRegionalWeather(island, day, minuteOfDay),
    [island, day, minuteOfDay]
  );
  const weatherDebuff = useMemo(
    () => computeWeatherDebuff(weather, pirate),
    [weather, pirate]
  );
  const rank = getRankInfo(pirate.level || 1);

  const arrivedDay = pirate.arrivedDay ?? 1;
  const daysOnIsland = Math.max(1, day - arrivedDay + 1);
  const completedQuestSet = useMemo(
    () => new Set(pirate.completedQuestIds ?? []),
    [pirate.completedQuestIds]
  );
  const defeatedMiniBossSet = useMemo(
    () => new Set(pirate.defeatedMiniBossIds ?? []),
    [pirate.defeatedMiniBossIds]
  );

  const zoneCoords = useMemo(
    () =>
      island.id === 'elbaph'
        ? ZONE_COORDS.map((z) =>
            z.id === 'dojo' ? { ...z, labelX: 34, labelY: 6, standX: 34, standY: 30 } : z
          )
        : ZONE_COORDS,
    [island.id]
  );

  const initialSpot = useMemo(
    () => zoneCoords.find((z) => z.id === pirate.islandSpot) ?? zoneCoords[2],
    [zoneCoords, pirate.islandSpot]
  );

  const [pos, setPos] = useState<{ x: number; y: number }>({
    x: initialSpot.standX,
    y: initialSpot.standY,
  });
  const [facing, setFacing] = useState<'right' | 'left'>('right');
  const [isWalking, setIsWalking] = useState(false);
  const [bubbleText, setBubbleText] = useState('...');
  const [ambientPhase, setAmbientPhase] = useState(0);
  const walkTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => {
      setAmbientPhase((p) => (p + 1) % 4);
    }, 3200);
    return () => window.clearInterval(t);
  }, [island.id]);

  useEffect(() => {
    const z = zoneCoords.find((item) => item.id === pirate.islandSpot);
    if (!z) return;
    setIsWalking(true);
    setPos((prev) => {
      if (Math.abs(z.standX - prev.x) > 0.5) {
        setFacing(z.standX >= prev.x ? 'right' : 'left');
      }
      return { x: z.standX, y: z.standY };
    });
    if (walkTimeoutRef.current) window.clearTimeout(walkTimeoutRef.current);
    walkTimeoutRef.current = window.setTimeout(() => {
      setIsWalking(false);
    }, 1100);
  }, [pirate.islandSpot, pirate.id, zoneCoords]);

  useEffect(() => {
    if (pirate.manualMode) {
      setIsWalking(false);
      setBubbleText('Quieto');
      return;
    }

    setBubbleText('...');
    const wanderTimer = window.setInterval(() => {
      const targetZone = ZONE_COORDS[Math.floor(Math.random() * 4)];
      const jitterX = (Math.random() - 0.5) * 6;
      const jitterY = (Math.random() - 0.5) * 4;
      const nextX = Math.max(17, Math.min(79, targetZone.standX + jitterX));
      const nextY = Math.max(30, Math.min(72, targetZone.standY + jitterY));
      setIsWalking(true);
      setPos((prev) => {
        if (Math.abs(nextX - prev.x) > 0.5) {
          setFacing(nextX >= prev.x ? 'right' : 'left');
        }
        return { x: nextX, y: nextY };
      });
      if (walkTimeoutRef.current) window.clearTimeout(walkTimeoutRef.current);
      walkTimeoutRef.current = window.setTimeout(() => {
        setIsWalking(false);
      }, 1300);
    }, 3400);

    return () => {
      window.clearInterval(wanderTimer);
      if (walkTimeoutRef.current) window.clearTimeout(walkTimeoutRef.current);
    };
  }, [pirate.manualMode, pirate.id]);

  useEffect(() => {
    return () => {
      if (walkTimeoutRef.current) window.clearTimeout(walkTimeoutRef.current);
    };
  }, []);

  const handleZoneClick = (zone: ZoneCoord) => {
    setIsWalking(true);
    setPos((prev) => {
      if (Math.abs(zone.standX - prev.x) > 0.5) {
        setFacing(zone.standX >= prev.x ? 'right' : 'left');
      }
      return { x: zone.standX, y: zone.standY };
    });
    if (walkTimeoutRef.current) window.clearTimeout(walkTimeoutRef.current);
    walkTimeoutRef.current = window.setTimeout(() => setIsWalking(false), 1100);

    if (pirate.manualMode) {
      onMoveToSpot(zone.id);
    } else {
      onSelectSpotMission(zone.id, zone.missionId);
    }
  };

  // Subtle coastline expansion by canon island tier while keeping all playable ground bounded
  const coastExpand =
    sizeTier === 'colosal' ? 6 : sizeTier === 'grande' ? 4 : sizeTier === 'mediana' ? 0 : -4;

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{
        backgroundColor: pal.oceanDeep,
      }}
      data-testid="island-scene-view"
    >
      {/* Crisp 16-bit Pixel Ocean Tile Backdrop (Zero gradients, zero anti-aliasing) */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 360 200"
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
        style={{ imageRendering: 'pixelated' }}
        aria-hidden="true"
      >
        <rect x={0} y={0} width={360} height={200} fill={pal.oceanDeep} />
        <rect x={0} y={20} width={360} height={156} fill={pal.oceanMid} />
        {[
          [14, 14, 12],
          [88, 26, 16],
          [266, 20, 14],
          [326, 44, 12],
          [20, 66, 14],
          [318, 82, 16],
          [12, 114, 12],
          [324, 128, 14],
          [34, 160, 16],
          [278, 166, 12],
          [168, 184, 18],
        ].map(([wx, wy, ww], idx) => (
          <g key={idx}>
            <rect x={wx} y={wy} width={ww} height={2} fill={pal.foam} opacity="0.32" />
            <rect x={wx + 2} y={wy + 2} width={ww - 4} height={1} fill={pal.reef} opacity="0.28" />
          </g>
        ))}
        <rect x={14} y={44} width={8} height={5} fill={pal.reef} opacity="0.4" />
        <rect x={16} y={45} width={4} height={2} fill={pal.sandCliff} />
        <rect x={338} y={96} width={10} height={5} fill={pal.reef} opacity="0.4" />
        <rect x={340} y={97} width={5} height={2} fill={pal.sandCliff} />
      </svg>

      {/* Humid & Darker Coastal Vignette + Subtle Sea Mist Layer */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(10, 30, 56, 0.04) 44%, rgba(3, 10, 22, 0.46) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Atmospheric Weather Tint Layer (Full viewport so no rectangular stage frame shows) */}
      {(weather.type === 'lluvia' ||
        weather.type === 'tormenta' ||
        weather.type === 'calor' ||
        weather.type === 'niebla') && (
        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            backgroundColor:
              weather.type === 'tormenta'
                ? 'rgba(10, 18, 44, 0.36)'
                : weather.type === 'lluvia'
                ? 'rgba(12, 34, 68, 0.22)'
                : weather.type === 'calor'
                ? 'rgba(234, 88, 12, 0.11)'
                : 'rgba(203, 213, 225, 0.16)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Full-Viewport Island Container (Centered in open center/right area away from left panel!) */}
      <div
        className={`relative z-[4] flex h-full w-full flex-col items-center justify-center pt-16 px-3 transition-[padding] duration-200 ${
          sidePanelOpen ? 'pb-[42vh] md:pb-6 md:pl-[430px]' : 'pb-6 md:pl-[74px]'
        }`}
      >
        {/* Island Name, Size Tier, Multi-day Stay, Weather & Devil Fruit Debuff Strip */}
        <div className="pointer-events-none mb-2 flex flex-wrap items-center justify-center gap-1.5 max-w-[96%] shrink-0">
          <div className="flex items-center gap-1.5 bg-[#081221]/92 border border-slate-600 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-slate-100 whitespace-nowrap">
            <Compass className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-300 shrink-0" />
            <span className="truncate">{island.name}</span>
            <span className="text-slate-500">·</span>
            <span className="text-sky-300 capitalize">{sizeTier}</span>
            <span className="text-slate-500">·</span>
            <span className="text-amber-200">
              Día {daysOnIsland}/{recommendedDays}
            </span>
          </div>

          <div
            data-testid="island-weather-badge"
            className="flex items-center gap-1.5 bg-[#081221]/92 border px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-slate-100 whitespace-nowrap"
            style={{ borderColor: weather.color }}
          >
            {renderWeatherIcon(weather.type, 'h-3 w-3 sm:h-3.5 sm:w-3.5')}
            <span style={{ color: weather.color }}>{weather.label}</span>
          </div>

          {weatherDebuff.active && (
            <div
              data-testid="island-weather-debuff"
              className={`border px-2 py-0.5 text-[10px] font-black whitespace-nowrap ${
                weatherDebuff.combatDelta < 0
                  ? 'border-rose-400 bg-rose-950/95 text-rose-200'
                  : 'border-teal-400 bg-teal-950/95 text-teal-200'
              }`}
            >
              {weatherDebuff.label}
            </div>
          )}
        </div>

        {/* Aspect-Locked 2:1 Coordinate Container so SVG Landmass and HTML Character % Positions Match 1:1 */}
        <div
          className="relative flex flex-1 min-h-0 w-full items-center justify-center"
          style={{ containerType: 'size' }}
        >
          <div
            className="relative"
            data-testid="island-stage-box"
            style={{
              width: 'min(100cqw, calc(100cqh * 2))',
              height: 'min(100cqh, calc(100cqw * 0.5))',
            }}
          >
            {/* Enlarged Retro 16-Bit Pixel Island Tilemap SVG (360x180 exact 2:1) */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 360 180"
              preserveAspectRatio="none"
              shapeRendering="crispEdges"
              style={{ imageRendering: 'pixelated' }}
              aria-hidden="true"
            >
              {/* Landmass & Biome Layers */}

              {/* Stepped Pixel Reef & Sea Foam Coastline */}
              <rect
                x={12 - coastExpand}
                y={10}
                width={332 + coastExpand * 2}
                height={158}
                fill={pal.reef}
                opacity="0.38"
              />
              <rect
                x={4 - coastExpand}
                y={26}
                width={348 + coastExpand * 2}
                height={126}
                fill={pal.reef}
                opacity="0.38"
              />
              <rect
                x={16 - coastExpand}
                y={14}
                width={324 + coastExpand * 2}
                height={150}
                fill={pal.foam}
                opacity="0.56"
              />
              <rect
                x={8 - coastExpand}
                y={30}
                width={340 + coastExpand * 2}
                height={118}
                fill={pal.foam}
                opacity="0.56"
              />

              {/* Southern Cliff Depth Shadow */}
              <rect
                x={18 - coastExpand}
                y={22}
                width={320 + coastExpand * 2}
                height={140}
                fill={pal.sandCliff}
              />
              <rect
                x={10 - coastExpand}
                y={34}
                width={336 + coastExpand * 2}
                height={114}
                fill={pal.sandCliff}
              />

              {/* Broad Sandy Beach Shorelines */}
              <rect
                x={18 - coastExpand}
                y={17}
                width={320 + coastExpand * 2}
                height={138}
                fill={pal.sand}
              />
              <rect
                x={10 - coastExpand}
                y={29}
                width={336 + coastExpand * 2}
                height={112}
                fill={pal.sand}
              />
              <rect
                x={44 - Math.round(coastExpand * 0.5)}
                y={10}
                width={268 + coastExpand}
                height={152}
                fill={pal.sand}
              />

              {/* Expansive Elevated Biome Turf Plateau (x: 24..332, y: 15..152) */}
              <rect
                x={26 - coastExpand}
                y={22}
                width={304 + coastExpand * 2}
                height={130}
                fill={pal.turfDark}
              />
              <rect
                x={26 - coastExpand}
                y={18}
                width={304 + coastExpand * 2}
                height={130}
                fill={pal.turf}
              />
              <rect
                x={18 - coastExpand}
                y={30}
                width={320 + coastExpand * 2}
                height={106}
                fill={pal.turf}
              />
              <rect
                x={50 - Math.round(coastExpand * 0.5)}
                y={12}
                width={256 + coastExpand}
                height={142}
                fill={pal.turf}
              />

              {/* Punk Hazard Split-Biome Right Glacier Half */}
              {island.biome === 'fire_ice' && (
                <g>
                  <rect x={180} y={18} width={150 + coastExpand} height={130} fill="#38bdf8" />
                  <rect x={180} y={30} width={158 + coastExpand} height={106} fill="#7dd3fc" />
                  <rect x={180} y={12} width={126 + Math.round(coastExpand * 0.5)} height={142} fill="#bae6fd" />
                  <rect x={228} y={76} width={6} height={12} fill="#e0f2fe" />
                  <rect x={230} y={71} width={2} height={5} fill="#ffffff" />
                  <rect x={84} y={78} width={16} height={3} fill="#f97316" />
                  <rect x={92} y={80} width={10} height={2} fill="#fde047" />
                </g>
              )}

              {/* Pixel Turf Texture Patches & Tiny Pixel Flowers */}
              {island.biome !== 'fire_ice' && (
                <g>
                  <rect x={96} y={42} width={168} height={82} fill={pal.turfLight} opacity="0.38" />
                  <rect x={42} y={66} width={12} height={4} fill={pal.turfLight} />
                  <rect x={302} y={98} width={14} height={4} fill={pal.turfLight} />
                  <rect x={136} y={72} width={2} height={2} fill="#fef08a" opacity="0.85" />
                  <rect x={226} y={56} width={2} height={2} fill="#fef08a" opacity="0.85" />
                  <rect x={146} y={108} width={2} height={2} fill="#fef08a" opacity="0.85" />
                </g>
              )}

              {/* Stepped Pixel Dirt/Stone Paths Connecting All Landmarks */}
              <rect x={58} y={50} width={242} height={8} fill={pal.pathEdge} />
              <rect x={58} y={51} width={242} height={6} fill={pal.path} />
              <rect x={52} y={84} width={254} height={8} fill={pal.pathEdge} />
              <rect x={52} y={85} width={254} height={6} fill={pal.path} />
              <rect x={64} y={120} width={236} height={8} fill={pal.pathEdge} />
              <rect x={64} y={121} width={236} height={6} fill={pal.path} />
              <rect x={174} y={40} width={12} height={88} fill={pal.pathEdge} />
              <rect x={176} y={40} width={8} height={88} fill={pal.path} />
              <rect x={66} y={42} width={10} height={86} fill={pal.pathEdge} />
              <rect x={68} y={42} width={6} height={86} fill={pal.path} />
              <rect x={282} y={42} width={10} height={86} fill={pal.pathEdge} />
              <rect x={284} y={42} width={6} height={86} fill={pal.path} />

              {/* Wooden Harbor Pier Extending East from Beach into Sea */}
              <rect x={330} y={118} width={28} height={11} fill="#451a03" />
              <rect x={330} y={120} width={26} height={7} fill="#92400e" />
              <rect x={334} y={121} width={4} height={5} fill="#b45309" />
              <rect x={342} y={121} width={4} height={5} fill="#b45309" />
              <rect x={350} y={121} width={4} height={5} fill="#b45309" />
              <rect x={338} y={116} width={2} height={13} fill="#291206" />
              <rect x={352} y={116} width={2} height={13} fill="#291206" />

              {/* CANON ICONIC ISLAND LANDMARKS */}
              {island.id === 'elbaph' && (
                <g>
                  {/* Shrunk Pine Forest Clusters around Viking Village & Adam Tree Roots */}
                  {[
                    [88, 92], [94, 95], [100, 92], [92, 100], [98, 102],
                    [134, 96], [140, 99], [145, 95],
                    [236, 94], [242, 97], [248, 93], [240, 102], [246, 104],
                    [254, 96], [260, 100], [252, 108], [234, 108],
                    [184, 106], [190, 109],
                  ].map(([px, py], i) => (
                    <PixelPineTree key={`pin-${i}`} x={px} y={py} />
                  ))}

                  {/* Left-Center Viking A-Frame Thatched Huts with Crossed Gables, Warm Glowing Doors & Shields */}
                  {[
                    { hx: 94, hy: 66, s1: '#2563eb', s2: '#dc2626' },
                    { hx: 118, hy: 58, s1: '#eab308', s2: '#16a34a' },
                    { hx: 142, hy: 62, s1: '#dc2626', s2: '#0d9488' },
                    { hx: 106, hy: 96, s1: '#2563eb', s2: '#eab308' },
                    { hx: 138, hy: 98, s1: '#16a34a', s2: '#dc2626' },
                  ].map((hut, idx) => (
                    <g key={`vhut-${idx}`}>
                      <rect x={hut.hx - 1} y={hut.hy + 14} width={18} height={2} fill="rgba(6, 12, 24, 0.35)" />
                      <rect x={hut.hx + 1} y={hut.hy + 7} width={14} height={7} fill="#6b3e1b" />
                      <polygon
                        points={`${hut.hx},${hut.hy + 8} ${hut.hx + 8},${hut.hy} ${hut.hx + 16},${hut.hy + 8}`}
                        fill="#92400e"
                      />
                      <polygon
                        points={`${hut.hx + 2},${hut.hy + 8} ${hut.hx + 8},${hut.hy + 2} ${hut.hx + 14},${hut.hy + 8}`}
                        fill="#b45309"
                      />
                      <line
                        x1={hut.hx + 6}
                        y1={hut.hy - 3}
                        x2={hut.hx + 10}
                        y2={hut.hy + 2}
                        stroke="#78350f"
                        strokeWidth="1.2"
                      />
                      <line
                        x1={hut.hx + 10}
                        y1={hut.hy - 3}
                        x2={hut.hx + 6}
                        y2={hut.hy + 2}
                        stroke="#78350f"
                        strokeWidth="1.2"
                      />
                      <rect x={hut.hx + 6} y={hut.hy + 9} width={4} height={5} fill="#ea580c" />
                      <rect x={hut.hx + 7} y={hut.hy + 10} width={2} height={4} fill="#fdba74" />
                      <rect x={hut.hx + 2} y={hut.hy + 10} width={2} height={2} fill={hut.s1} />
                      <rect x={hut.hx + 12} y={hut.hy + 10} width={2} height={2} fill={hut.s2} />
                    </g>
                  ))}

                  {/* Central Stone-Ringed Campfire & Smoke between Viking Huts */}
                  <g>
                    <rect x={122} y={84} width={8} height={5} fill="#475569" />
                    <rect x={123} y={85} width={6} height={3} fill="#ea580c" />
                    <rect x={125} y={83} width={2} height={3} fill="#fde047" />
                    <rect x={125} y={79 - (ambientPhase % 2)} width={2} height={2} fill="rgba(226, 232, 240, 0.55)" />
                  </g>

                  {/* Colossal Treasure Tree Adam positioned cleanly between Dojo (x=104..140) and Boss Fortress (x=274..310) */}
                  <g>
                    {/* Flared Roots & Trunk Shadow */}
                    <rect x={196} y={114} width={36} height={5} fill="rgba(6, 12, 24, 0.35)" />
                    <rect x={198} y={108} width={32} height={7} fill="#451a03" />
                    <rect x={202} y={102} width={24} height={11} fill="#5c3317" />
                    {/* Main Massive Ridged Trunk */}
                    <rect x={204} y={56} width={20} height={56} fill="#5c3317" />
                    <rect x={207} y={56} width={6} height={56} fill="#78350f" />
                    <rect x={215} y={56} width={5} height={56} fill="#4a250d" />
                    {/* Flared Upper Boughs */}
                    <polygon points="204,64 176,48 184,48 208,58" fill="#5c3317" />
                    <polygon points="224,64 252,48 244,48 220,58" fill="#5c3317" />
                    {/* Dark Base Entrance Archway */}
                    <rect x={211} y={104} width={6} height={9} fill="#1c0d06" />
                    {/* 4 Tiny Warm Glowing Golden Window Specks Along Trunk Height */}
                    <rect x={216} y={64} width={2} height={2} fill="#fde047" />
                    <rect x={209} y={76} width={2} height={2} fill="#fbbf24" />
                    <rect x={217} y={88} width={2} height={2} fill="#fde047" />
                    <rect x={208} y={96} width={2} height={2} fill="#fbbf24" />

                    {/* Vast Tiered Emerald Green Canopy (x: 158..268, y: 12..56) */}
                    <rect x={158} y={32} width={110} height={24} fill="#0f3d23" />
                    <rect x={162} y={24} width={102} height={26} fill="#14532d" />
                    <rect x={170} y={17} width={86} height={24} fill="#15803d" />
                    <rect x={182} y={13} width={62} height={14} fill="#166534" />
                    <rect x={194} y={11} width={38} height={6} fill="#22c55e" />
                    {/* Canopy Leaf Highlights */}
                    <rect x={174} y={22} width={16} height={4} fill="#22c55e" opacity="0.55" />
                    <rect x={232} y={24} width={14} height={4} fill="#22c55e" opacity="0.55" />
                    <rect x={200} y={16} width={20} height={4} fill="#4ade80" opacity="0.45" />

                    {/* Dotted Rope Bridges Linking Canopy Treehouses */}
                    <line
                      x1={174}
                      y1={32}
                      x2={212}
                      y2={23}
                      stroke="#92400e"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1={214}
                      y1={23}
                      x2={252}
                      y2={32}
                      stroke="#92400e"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1={174}
                      y1={32}
                      x2={190}
                      y2={46}
                      stroke="#92400e"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <line
                      x1={192}
                      y1={46}
                      x2={242}
                      y2={46}
                      stroke="#92400e"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />

                    {/* 5 Colored Canopy Treehouses */}
                    {[
                      { tx: 168, ty: 26, roof: '#0d9488' },
                      { tx: 208, ty: 16, roof: '#7c3aed' },
                      { tx: 246, ty: 26, roof: '#dc2626' },
                      { tx: 184, ty: 40, roof: '#d97706' },
                      { tx: 236, ty: 40, roof: '#dc2626' },
                    ].map((th, i) => (
                      <g key={`th-${i}`}>
                        <rect x={th.tx} y={th.ty + 4} width={10} height={6} fill="#e2e8f0" />
                        <polygon
                          points={`${th.tx - 1},${th.ty + 4} ${th.tx + 5},${th.ty} ${th.tx + 11},${th.ty + 4}`}
                          fill={th.roof}
                        />
                        <rect x={th.tx + 4} y={th.ty + 6} width={2} height={4} fill="#f59e0b" />
                      </g>
                    ))}

                    {/* Long Vertical Rope Ladders Hanging from Canopy to Ground */}
                    {[170, 256].map((lx) => (
                      <g key={`lad-${lx}`}>
                        <rect x={lx} y={54} width={1} height={58} fill="#78350f" />
                        <rect x={lx + 3} y={54} width={1} height={58} fill="#78350f" />
                        {Array.from({ length: 14 }, (_, r) => (
                          <rect key={r} x={lx} y={56 + r * 4} width={4} height={1} fill="#b45309" />
                        ))}
                      </g>
                    ))}

                    {/* Semi-Translucent Floating Mist Clouds Across Lower Canopy */}
                    <g fill="rgba(226, 232, 240, 0.36)">
                      <circle cx={162} cy={49} r={6} />
                      <circle cx={170} cy={48} r={7} />
                      <circle cx={179} cy={50} r={5} />
                      <circle cx={208} cy={47} r={7} />
                      <circle cx={219} cy={48} r={8} />
                      <circle cx={231} cy={49} r={6} />
                      <circle cx={250} cy={50} r={6} />
                      <circle cx={259} cy={49} r={5} />
                    </g>
                  </g>
                </g>
              )}

              {island.id === 'pais-de-wano' && (
                <g>
                  <rect x={210} y={60} width={28} height={12} fill="#475569" />
                  <rect x={216} y={54} width={16} height={6} fill="#cbd5e1" />
                  <rect x={221} y={51} width={6} height={3} fill="#ffffff" />
                </g>
              )}

              {island.id === 'reino-arabasta' && (
                <g>
                  <rect x={142} y={96} width={24} height={14} fill="#fef3c7" />
                  <rect x={148} y={91} width={12} height={5} fill="#eab308" />
                  <rect x={153} y={88} width={2} height={3} fill="#fde047" />
                </g>
              )}

              {/* BIOME-SPECIFIC PIXEL AMBIANCE PROPS */}
              {island.biome === 'village' && (
                <g>
                  {/* Windmill + Well + Village Cottage */}
                  <rect x={142} y={92} width={12} height={18} fill="#cbd5e1" />
                  <rect x={141} y={88} width={14} height={5} fill="#b91c1c" />
                  <rect x={145} y={84} width={6} height={4} fill="#dc2626" />
                  <rect x={147} y={90} width={2} height={12} fill="#78350f" />
                  <rect x={140} y={95} width={16} height={2} fill="#78350f" />
                  <rect x={146} y={102} width={4} height={8} fill="#451a03" />
                  <rect x={158} y={100} width={7} height={5} fill="#64748b" />
                  <rect x={159} y={98} width={5} height={2} fill="#92400e" />
                  <PixelPalmTree x={36} y={96} />
                  <PixelPalmTree x={214} y={94} />
                  <PixelPalmTree x={306} y={96} />
                </g>
              )}

              {island.biome === 'pagoda' && (
                <g>
                  <PixelPalmTree x={36} y={96} sakura />
                  <PixelPalmTree x={214} y={94} sakura />
                  <PixelPalmTree x={306} y={96} sakura />
                  <rect x={142} y={96} width={16} height={2} fill="#dc2626" />
                  <rect x={140} y={94} width={20} height={2} fill="#b91c1c" />
                  <rect x={144} y={98} width={2} height={11} fill="#991b1b" />
                  <rect x={154} y={98} width={2} height={11} fill="#991b1b" />
                  {/* Stone Lantern */}
                  <rect x={224} y={102} width={4} height={6} fill="#94a3b8" />
                  <rect x={225} y={103} width={2} height={2} fill="#fde047" />
                </g>
              )}

              {island.biome === 'desert' && (
                <g>
                  <rect x={208} y={94} width={26} height={12} fill="#0284c7" />
                  <rect x={210} y={96} width={22} height={8} fill="#38bdf8" />
                  <PixelPalmTree x={232} y={86} />
                  <rect x={38} y={96} width={4} height={11} fill="#15803d" />
                  <rect x={35} y={98} width={3} height={3} fill="#166534" />
                  <rect x={42} y={100} width={3} height={3} fill="#166534" />
                  {/* Sandstone Market Stall */}
                  <rect x={92} y={98} width={12} height={8} fill="#fef3c7" />
                  <rect x={91} y={96} width={14} height={3} fill="#d97706" />
                </g>
              )}

              {island.biome === 'volcano' && (
                <g>
                  <rect x={208} y={94} width={24} height={12} fill="#991b1b" />
                  <rect x={212} y={96} width={16} height={8} fill="#ea580c" />
                  <rect x={216} y={98} width={8} height={4} fill="#fde047" />
                  <rect x={38} y={92} width={7} height={14} fill="#1e293b" />
                  <rect x={40} y={88} width={3} height={4} fill="#475569" />
                  <rect x={144} y={98} width={8} height={10} fill="#0f172a" />
                  <rect x={147} y={94} width={2} height={4} fill="#ef4444" />
                </g>
              )}

              {island.biome === 'sky' && (
                <g>
                  <rect x={24} y={144} width={30} height={8} fill="#e2e8f0" />
                  <rect x={30} y={140} width={18} height={4} fill="#f8fafc" />
                  <rect x={302} y={24} width={30} height={8} fill="#e2e8f0" />
                  <rect x={308} y={20} width={18} height={4} fill="#f8fafc" />
                  {/* Shandora Golden Bell Belfry */}
                  <rect x={212} y={94} width={14} height={13} fill="#b45309" />
                  <rect x={215} y={96} width={8} height={8} fill="#eab308" />
                  <rect x={217} y={98} width={4} height={4} fill="#fef08a" />
                </g>
              )}

              {island.biome === 'candy' && (
                <g>
                  <PixelPalmTree x={36} y={96} candy />
                  <PixelPalmTree x={214} y={94} candy />
                  <PixelPalmTree x={306} y={96} candy />
                  <rect x={144} y={94} width={4} height={14} fill="#f8fafc" />
                  <rect x={144} y={96} width={4} height={2} fill="#ef4444" />
                  <rect x={144} y={100} width={4} height={2} fill="#ef4444" />
                  <rect x={144} y={104} width={4} height={2} fill="#ef4444" />
                  <rect x={224} y={97} width={10} height={9} fill="#fbcfe8" />
                  <rect x={223} y={95} width={12} height={3} fill="#db2777" />
                </g>
              )}

              {island.biome === 'marine' && (
                <g>
                  <rect x={36} y={95} width={14} height={11} fill="#e2e8f0" />
                  <rect x={36} y={93} width={14} height={2} fill="#1d4ed8" />
                  <rect x={41} y={99} width={4} height={7} fill="#334155" />
                  <rect x={214} y={95} width={18} height={11} fill="#cbd5e1" />
                  <rect x={214} y={93} width={18} height={2} fill="#1d4ed8" />
                  <rect x={218} y={98} width={10} height={3} fill="#0f172a" />
                </g>
              )}

              {(island.biome === 'colosseum' ||
                island.biome === 'fortress' ||
                island.biome === 'treasure') &&
                island.id !== 'elbaph' && (
                  <g>
                    <PixelPalmTree x={36} y={96} />
                    <PixelPalmTree x={306} y={96} />
                    <rect x={210} y={95} width={16} height={10} fill="#92400e" />
                    <rect x={212} y={93} width={12} height={4} fill="#eab308" />
                    <rect x={216} y={98} width={4} height={4} fill="#fde047" />
                  </g>
                )}

              {/* 1. RUINAS (Detailed Mossy Temple, Columns, Pediment, Glowing Relic) */}
              <g>
                <rect x={46} y={44} width={36} height={3} fill="#1e293b" />
                <rect x={48} y={26} width={32} height={18} fill="#334155" />
                <rect x={51} y={29} width={26} height={14} fill="#1e293b" />
                <polygon points="46,24 64,16 82,24" fill="#64748b" />
                <polygon points="50,24 64,18 78,24" fill="#94a3b8" />
                <rect x={49} y={24} width={5} height={19} fill="#cbd5e1" />
                <rect x={57} y={26} width={3} height={17} fill="#94a3b8" />
                <rect x={74} y={24} width={5} height={19} fill="#cbd5e1" />
                <rect x={68} y={26} width={3} height={17} fill="#94a3b8" />
                {/* Moss & Relic Altar */}
                <rect x={50} y={24} width={4} height={2} fill="#4d7c0f" />
                <rect x={75} y={32} width={3} height={2} fill="#4d7c0f" />
                <rect x={59} y={36} width={10} height={8} fill="#78350f" />
                <rect x={60} y={35} width={8} height={3} fill="#facc15" />
                <rect x={63} y={36} width={2} height={2} fill="#fef08a" />
              </g>

              {/* 2. DOJO (Shifted left on Elbaph so Treasure Tree Adam canopy & treehouses remain completely unobstructed) */}
              {(() => {
                const dx = island.id === 'elbaph' ? -58 : 0;
                return (
                  <g transform={dx !== 0 ? `translate(${dx}, 0)` : undefined}>
                    <rect x={164} y={41} width={32} height={2} fill="#1e293b" />
                    <rect x={162} y={23} width={36} height={5} fill="#7f1d1d" />
                    <polygon points="160,24 180,15 200,24" fill="#991b1b" />
                    <polygon points="165,23 180,17 195,23" fill="#dc2626" />
                    <rect x={177} y={14} width={6} height={2} fill="#facc15" />
                    <rect x={167} y={28} width={26} height={13} fill="#f1f5f9" />
                    <rect x={167} y={28} width={26} height={2} fill="#78350f" />
                    <rect x={167} y={28} width={2} height={13} fill="#78350f" />
                    <rect x={191} y={28} width={2} height={13} fill="#78350f" />
                    <rect x={176} y={32} width={8} height={9} fill="#5c3317" />
                    <rect x={179} y={32} width={2} height={9} fill="#291206" />
                    {/* Lit Shoji Windows */}
                    <rect x={170} y={31} width={4} height={5} fill="#fde68a" />
                    <rect x={186} y={31} width={4} height={5} fill="#fde68a" />
                    {/* Red Paper Lantern */}
                    <rect x={163} y={29} width={3} height={4} fill="#ef4444" />
                    <rect x={194} y={29} width={3} height={4} fill="#ef4444" />
                  </g>
                );
              })()}

              {/* 3. GUARIDA DEL JEFE (Crenellated Dark Basalt Fortress, Watchtowers, Crimson Banner, Braziers) */}
              <g>
                <rect x={274} y={44} width={36} height={3} fill="#090d16" />
                <rect x={276} y={25} width={32} height={20} fill="#1e293b" />
                <rect x={274} y={19} width={8} height={26} fill="#334155" />
                <rect x={302} y={19} width={8} height={26} fill="#334155" />
                {/* Battlements */}
                <rect x={274} y={17} width={3} height={3} fill="#475569" />
                <rect x={279} y={17} width={3} height={3} fill="#475569" />
                <rect x={302} y={17} width={3} height={3} fill="#475569" />
                <rect x={307} y={17} width={3} height={3} fill="#475569" />
                <rect x={282} y={22} width={20} height={4} fill="#475569" />
                {/* Arch Gate & Crimson Emblem */}
                <rect x={284} y={30} width={16} height={15} fill="#450a0a" />
                <rect x={288} y={33} width={8} height={12} fill="#1c0606" />
                <rect x={289} y={25} width={6} height={4} fill="#dc2626" />
                <rect x={291} y={26} width={2} height={2} fill="#fde047" />
                {/* Glowing Braziers */}
                <rect x={280} y={39} width={3} height={4} fill="#f97316" />
                <rect x={281} y={38} width={1} height={2} fill="#fde047" />
                <rect x={301} y={39} width={3} height={4} fill="#f97316" />
                <rect x={302} y={38} width={1} height={2} fill="#fde047" />
              </g>

              {/* 4. TABERNA (Pitched Timber Roof, Chimney Smoke, Glowing Windows, Hanging Sign, Rum Barrels) */}
              <g>
                <rect x={46} y={136} width={40} height={2} fill="#1e293b" />
                {/* Stone Chimney & Smoke */}
                <rect x={74} y={102} width={5} height={10} fill="#475569" />
                <rect x={75} y={98 - (ambientPhase % 2)} width={3} height={2} fill="rgba(226, 232, 240, 0.5)" />
                {/* Walls & Half-Timber Beams */}
                <rect x={48} y={114} width={36} height={22} fill="#5c3317" />
                <rect x={51} y={117} width={30} height={17} fill="#78350f" />
                <rect x={51} y={117} width={30} height={2} fill="#451a03" />
                {/* Pitched Shingled Roof */}
                <polygon points="44,115 66,104 88,115" fill="#92400e" />
                <polygon points="48,114 66,106 84,114" fill="#b45309" />
                <rect x={45} y={114} width={42} height={2} fill="#d97706" />
                {/* Glowing Mullioned Windows & Plank Door */}
                <rect x={54} y={121} width={7} height={6} fill="#fbbf24" />
                <rect x={57} y={121} width={1} height={6} fill="#451a03" />
                <rect x={54} y={124} width={7} height={1} fill="#451a03" />
                <rect x={66} y={122} width={8} height={12} fill="#291206" />
                <rect x={68} y={123} width={4} height={11} fill="#451a03" />
                <rect x={76} y={121} width={4} height={5} fill="#fbbf24" />
                {/* Tavern Sign & Side Rum Barrels */}
                <rect x={66} y={117} width={8} height={3} fill="#fde047" />
                <rect x={85} y={127} width={6} height={8} fill="#92400e" />
                <rect x={85} y={129} width={6} height={1} fill="#1e293b" />
                <rect x={85} y={132} width={6} height={1} fill="#1e293b" />
              </g>

              {/* 5. MUELLE PUESTO PORTUARIO (Customs Warehouse, Striped Awning, Cargo Crates, Pier Lantern) */}
              <g>
                <rect x={282} y={132} width={32} height={2} fill="#1e293b" />
                <rect x={284} y={116} width={28} height={16} fill="#5c3317" />
                <rect x={286} y={118} width={24} height={13} fill="#78350f" />
                <polygon points="280,117 298,109 316,117" fill="#0369a1" />
                <rect x={282} y={115} width={32} height={3} fill="#0284c7" />
                <rect x={286} y={115} width={4} height={3} fill="#e0f2fe" />
                <rect x={296} y={115} width={4} height={3} fill="#e0f2fe" />
                <rect x={306} y={115} width={4} height={3} fill="#e0f2fe" />
                <rect x={287} y={120} width={8} height={6} fill="#fde68a" />
                <rect x={299} y={120} width={9} height={11} fill="#291206" />
                {/* Pier Crates & Lantern Post */}
                <rect x={315} y={125} width={5} height={6} fill="#b45309" />
                <rect x={326} y={112} width={2} height={10} fill="#1e293b" />
                <rect x={325} y={111} width={4} height={3} fill="#fde047" />
              </g>

              {/* Translucent Sky Rainbow Arch over Elbaph / Skypiea / Wano / Sabaody (unclipped above crown) */}
              {island.hasRainbow && (
                <g opacity={island.id === 'elbaph' ? '0.66' : '0.58'} fill="none">
                  {[
                    { rOff: 0, color: '#ef4444' },
                    { rOff: 2, color: '#f97316' },
                    { rOff: 4, color: '#eab308' },
                    { rOff: 6, color: '#22c55e' },
                    { rOff: 8, color: '#38bdf8' },
                    { rOff: 10, color: '#a855f7' },
                  ].map((band) => (
                    <path
                      key={band.color}
                      d={`M ${30 + band.rOff} 106 A ${150 - band.rOff} ${98 - band.rOff * 0.55} 0 0 1 ${330 - band.rOff} 106`}
                      stroke={band.color}
                      strokeWidth="2"
                    />
                  ))}
                  {/* Tiny Rainbow Sparkles */}
                  <rect x={165} y={5} width={2} height={2} fill="#fef08a" opacity="0.9" />
                  <rect x={198} y={6} width={2} height={2} fill="#e0f2fe" opacity="0.9" />
                  <rect x={76} y={36} width={2} height={2} fill="#fbcfe8" opacity="0.85" />
                  <rect x={282} y={38} width={2} height={2} fill="#bae6fd" opacity="0.85" />
                </g>
              )}
            </svg>

            {/* Moored Pixel Ships cleanly in ocean water outside the Eastern Harbor Pier */}
            <div className="pointer-events-none absolute -right-5 sm:-right-7 top-[46%]">
              <PixelShip sailColor={pirate.flagColor || '#f8fafc'} />
            </div>
            <div className="pointer-events-none absolute -right-4 sm:-right-6 top-[72%]">
              <PixelShip sailColor="#eab308" />
            </div>

            {/* Ambient Strolling Villagers / Warriors (race & Elbaph scaled) */}
            {ambientResidents.map((res, idx) => {
              const patrolDir = (ambientPhase + idx) % 2 === 0 ? 1 : -1;
              const shiftX = ((ambientPhase + idx) % 4) - 1.5;
              const xClamped = Math.max(12, Math.min(84, res.baseX + shiftX * 1.8));
              const yClamped = Math.max(22, Math.min(76, res.baseY + (idx % 2 === 0 ? 0.5 : -0.5)));
              const resSize = Math.round(
                UNIFORM_ISLAND_SPRITE_SIZE * getCharacterSpriteScale(res.race, island.id)
              );
              return (
                <div
                  key={res.id}
                  style={{
                    left: `${xClamped}%`,
                    top: `${yClamped}%`,
                    transition: 'left 2.4s steps(8, end)',
                  }}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 opacity-90 z-[6]"
                  aria-hidden="true"
                >
                  <PirateAvatarSvg
                    name={res.id}
                    flagColor={res.outfitColor}
                    race={res.race}
                    hatStyle={res.hatStyle}
                    skinTone={res.skinTone}
                    hairColor={res.hairColor}
                    outfitStyle={res.outfitStyle}
                    outfitColor={res.outfitColor}
                    bodyBuild={res.bodyBuild}
                    facing={patrolDir > 0 ? 'right' : 'left'}
                    size={resSize}
                  />
                </div>
              );
            })}

            {/* Clickable Landmark Nodes */}
            {zoneCoords.filter((z) => z.id !== 'jefe').map((zone) => {
              const isCurrent = pirate.islandSpot === zone.id;
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => handleZoneClick(zone)}
                  title={
                    pirate.manualMode
                      ? `Mover personaje a ${zone.label}`
                      : `Iniciar misión en ${zone.label}`
                  }
                  style={{ left: `${zone.labelX}%`, top: `${zone.labelY}%` }}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer z-10"
                >
                  <span
                    className={`flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold tracking-tight transition-colors border ${
                      isCurrent
                        ? 'bg-[#f5b82e] border-[#fef08a] text-slate-950'
                        : 'bg-[#0b1526]/95 border-slate-500 text-slate-100 group-hover:border-amber-300'
                    }`}
                  >
                    {zone.id === 'dojo' && (
                      <Swords className={`h-2.5 w-2.5 ${isCurrent ? 'text-slate-950' : 'text-sky-300'}`} />
                    )}
                    {zone.id === 'ruinas' && (
                      <Coins className={`h-2.5 w-2.5 ${isCurrent ? 'text-slate-950' : 'text-amber-300'}`} />
                    )}
                    {zone.id === 'taberna' && (
                      <Flame className={`h-2.5 w-2.5 ${isCurrent ? 'text-slate-950' : 'text-orange-300'}`} />
                    )}
                    {zone.id === 'puerto' && (
                      <Anchor className={`h-2.5 w-2.5 ${isCurrent ? 'text-slate-950' : 'text-teal-300'}`} />
                    )}
                    <span>{zone.label}</span>
                  </span>
                </button>
              );
            })}

            {/* Clickable NPC Quest Givers (race & Elbaph scaled) */}
            {npcQuests.map((quest, idx) => {
              const slot = NPC_STAGE_SLOTS[idx % NPC_STAGE_SLOTS.length];
              const done = completedQuestSet.has(quest.id);
              const npcSize = Math.round(
                UNIFORM_ISLAND_SPRITE_SIZE * getCharacterSpriteScale(quest.race, island.id)
              );
              return (
                <button
                  key={quest.id}
                  type="button"
                  onClick={() => onSelectNpcQuest?.(quest.id)}
                  title={`${quest.npcName}: ${quest.title}`}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer z-[11]"
                >
                  <span
                    className={`mb-0.5 px-1 py-0 text-[8px] font-black leading-tight border whitespace-nowrap ${
                      done
                        ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                        : 'bg-amber-400 border-amber-100 text-slate-950 group-hover:bg-amber-300'
                    }`}
                  >
                    {done ? '✓' : '!'} {getShortStageName(quest.npcName)}
                  </span>
                  <PirateAvatarSvg
                    name={quest.npcName}
                    flagColor={quest.outfitColor}
                    race={quest.race}
                    hatStyle={quest.hatStyle}
                    hatColor={quest.hatColor}
                    skinTone={quest.skinTone}
                    hairStyle={quest.hairStyle}
                    hairColor={quest.hairColor}
                    bodyBuild={quest.bodyBuild}
                    outfitStyle={quest.outfitStyle}
                    outfitColor={quest.outfitColor}
                    accessory={quest.accessory}
                    accessoryColor={quest.accessoryColor}
                    capeStyle={quest.capeStyle}
                    capeColor={quest.capeColor}
                    weaponStyle={quest.weaponStyle}
                    facing={slot.x > 50 ? 'left' : 'right'}
                    size={npcSize}
                  />
                </button>
              );
            })}

            {/* Clickable Island Mini-Bosses (race & Elbaph scaled) */}
            {miniBosses.map((mb, idx) => {
              const slot = MINIBOSS_STAGE_SLOTS[idx % MINIBOSS_STAGE_SLOTS.length];
              const defeated = defeatedMiniBossSet.has(mb.id);
              const mbSize = Math.round(
                UNIFORM_ISLAND_SPRITE_SIZE * getCharacterSpriteScale(mb.race, island.id)
              );
              return (
                <button
                  key={mb.id}
                  type="button"
                  onClick={() => onChallengeMiniBoss?.(mb.id)}
                  title={`Subjefe: ${mb.name} (${mb.title})`}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer z-[12]"
                >
                  <span
                    className={`mb-0.5 px-1 py-0 text-[8px] font-black leading-tight border whitespace-nowrap ${
                      defeated
                        ? 'bg-slate-900/95 border-emerald-400/70 text-emerald-300'
                        : 'bg-orange-950/95 border-orange-400 text-orange-200 group-hover:bg-orange-800'
                    }`}
                  >
                    {defeated ? '✓ ' : 'SUB: '}
                    {getShortStageName(mb.name)}
                  </span>
                  <PirateAvatarSvg
                    name={mb.name}
                    flagColor={mb.outfitColor}
                    race={mb.race}
                    hatStyle={mb.hatStyle}
                    hatColor={mb.hatColor}
                    skinTone={mb.skinTone}
                    hairStyle={mb.hairStyle}
                    hairColor={mb.hairColor}
                    bodyBuild={mb.bodyBuild}
                    outfitStyle={mb.outfitStyle ?? 'coat'}
                    outfitColor={mb.outfitColor}
                    accessory={mb.accessory}
                    accessoryColor={mb.accessoryColor}
                    capeStyle={mb.capeStyle}
                    capeColor={mb.capeColor}
                    weaponStyle={mb.weaponStyle}
                    facing="left"
                    size={mbSize}
                  />
                </button>
              );
            })}

            {/* Island Boss Sprite stationed strictly inside Boss Fortress terrace (race & Elbaph scaled) */}
            <button
              type="button"
              onClick={() => handleZoneClick(zoneCoords[4])}
              style={{ left: '83%', top: '34%' }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer z-[13] group"
              title={`Desafiar a ${boss.name} (${boss.title})`}
            >
              <span className="mb-0.5 bg-rose-950 border border-rose-400 px-1 py-0 text-[8px] font-black leading-tight text-rose-100 whitespace-nowrap group-hover:bg-rose-800">
                JEFE: {getShortStageName(boss.name)}
              </span>
              <PirateAvatarSvg
                name={boss.name}
                flagColor={boss.outfitColor}
                race={boss.race}
                hatStyle={boss.hatStyle}
                hatColor={boss.hatColor}
                skinTone={boss.skinTone}
                hairStyle={boss.hairStyle}
                hairColor={boss.hairColor}
                outfitColor={boss.outfitColor}
                bodyBuild={boss.bodyBuild ?? 'robust'}
                outfitStyle={boss.outfitStyle ?? 'coat'}
                accessory={boss.accessory}
                accessoryColor={boss.accessoryColor}
                capeStyle={boss.capeStyle}
                capeColor={boss.capeColor}
                weaponStyle={boss.weaponStyle}
                facing="left"
                size={Math.round(
                  UNIFORM_ISLAND_SPRITE_SIZE * getCharacterSpriteScale(boss.race, island.id)
                )}
              />
            </button>

            {/* Other Player Characters Docked on Same Island (race & Elbaph scaled) */}
            {sameIslandPeers.slice(0, 3).map((peer, idx) => {
              const offsetX = 40 + idx * 10;
              const offsetY = 63 + (idx % 2) * 6;
              const peerSize = Math.round(
                UNIFORM_ISLAND_SPRITE_SIZE * getCharacterSpriteScale(peer.race, island.id)
              );
              return (
                <div
                  key={peer.id}
                  style={{ left: `${offsetX}%`, top: `${offsetY}%` }}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-[14]"
                >
                  <span className="mb-0.5 bg-[#081221]/90 border border-sky-400/50 px-1 py-0 text-[8px] font-bold leading-tight text-sky-200 whitespace-nowrap">
                    @{peer.name}
                  </span>
                  <PirateAvatarSvg
                    name={peer.name}
                    flagColor={peer.flagColor}
                    race={peer.race}
                    hatStyle={peer.hatStyle}
                    hatColor={peer.hatColor}
                    skinTone={peer.skinTone}
                    hairStyle={peer.hairStyle}
                    hairColor={peer.hairColor}
                    bodyBuild={peer.bodyBuild}
                    outfitStyle={peer.outfitStyle}
                    outfitColor={peer.outfitColor}
                    accessory={peer.accessory}
                    accessoryColor={peer.accessoryColor}
                    capeStyle={peer.capeStyle}
                    capeColor={peer.capeColor}
                    weaponStyle={peer.weaponStyle}
                    role={peer.role}
                    hasEquippedWeapon={Boolean(peer.equipped?.arma)}
                    size={peerSize}
                  />
                </div>
              );
            })}

            {/* Active Player Character (race & Elbaph scaled) */}
            {(() => {
              const playerScale = getCharacterSpriteScale(pirate.race, island.id);
              const playerSpriteSize = Math.round(UNIFORM_ISLAND_SPRITE_SIZE * playerScale);
              return (
                <div
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transition: 'left 1.15s steps(16, end), top 1.15s steps(16, end)',
                  }}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
                  data-testid="active-island-character"
                  data-walking={isWalking ? 'true' : 'false'}
                  data-race={pirate.race ?? 'humano'}
                  data-sprite-size={playerSpriteSize}
                >
                  <div className="mb-0.5 border border-amber-400/80 bg-[#0b1526]/95 px-1 py-0 text-[8px] font-bold leading-tight text-amber-200 whitespace-nowrap">
                    @{pirate.name} · {rank.title}
                  </div>

                  <div className="relative mb-0.5 border border-[#0f172a] bg-white px-1 py-0 text-[8px] font-black leading-tight text-slate-950">
                    {bubbleText}
                  </div>

                  <div
                    className="relative flex flex-col items-center"
                    style={{
                      animation: isWalking ? 'pirateStepHop 0.36s steps(2, end) infinite' : 'none',
                    }}
                  >
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
                      weaponStyle={pirate.weaponStyle}
                      role={pirate.role}
                      hasEquippedWeapon={Boolean(pirate.equipped?.arma)}
                      facing={facing}
                      size={playerSpriteSize}
                    />
                    {/* Crisp Pixel Selection Tile Under Character */}
                    <svg
                      width={Math.round(20 * playerScale)}
                      height={Math.max(3, Math.round(4 * playerScale))}
                      viewBox="0 0 10 2"
                      shapeRendering="crispEdges"
                      className="-mt-0.5"
                      aria-hidden="true"
                    >
                      <rect x={1} y={0} width={8} height={1} fill="#facc15" opacity="0.85" />
                      <rect x={0} y={1} width={10} height={1} fill="#facc15" opacity="0.95" />
                    </svg>
                  </div>
                </div>
              );
            })()}

            {/* Crisp 16-bit Pixel Weather Foreground Overlay */}
            {weather.type !== 'despejado' && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full z-[25]"
                viewBox="0 0 360 180"
                preserveAspectRatio="none"
                shapeRendering="crispEdges"
                style={{ imageRendering: 'pixelated' }}
                aria-hidden="true"
              >
                {(weather.type === 'lluvia' || weather.type === 'tormenta') && (
                  <g opacity={weather.type === 'tormenta' ? 0.85 : 0.68}>
                    {Array.from({ length: weather.type === 'tormenta' ? 42 : 28 }, (_, i) => {
                      const x = ((i * 37 + ambientPhase * 17) % 352) + 4;
                      const y = ((i * 53 + ambientPhase * 29) % 166) + 4;
                      return (
                        <g key={i}>
                          <rect x={x} y={y} width={1} height={5} fill="#bae6fd" />
                          <rect x={x - 1} y={y + 4} width={1} height={4} fill="#7dd3fc" />
                        </g>
                      );
                    })}
                    {weather.type === 'tormenta' && ambientPhase % 2 === 0 && (
                      <g fill="#fef08a">
                        <rect x={280} y={4} width={3} height={10} />
                        <rect x={276} y={12} width={5} height={3} />
                        <rect x={274} y={15} width={3} height={10} />
                      </g>
                    )}
                  </g>
                )}

                {weather.type === 'nieve' && (
                  <g opacity="0.9">
                    {Array.from({ length: 34 }, (_, i) => {
                      const x = ((i * 41 + ambientPhase * 11) % 352) + 4;
                      const y = ((i * 29 + ambientPhase * 19) % 168) + 4;
                      return (
                        <rect
                          key={i}
                          x={x}
                          y={y}
                          width={i % 3 === 0 ? 2 : 1}
                          height={i % 3 === 0 ? 2 : 1}
                          fill="#f8fafc"
                        />
                      );
                    })}
                  </g>
                )}

                {weather.type === 'viento' && (
                  <g opacity="0.65">
                    {Array.from({ length: 14 }, (_, i) => {
                      const x = ((i * 59 + ambientPhase * 34) % 330) + 6;
                      const y = ((i * 23 + 10) % 156) + 10;
                      return (
                        <rect key={i} x={x} y={y} width={18 + (i % 3) * 6} height={1} fill="#99f6e4" />
                      );
                    })}
                  </g>
                )}

                {weather.type === 'calor' && (
                  <g opacity="0.55">
                    <rect x={24} y={16} width={48} height={2} fill="#fde047" />
                    <rect x={260} y={28} width={60} height={2} fill="#fde047" />
                    <rect x={140} y={148} width={40} height={2} fill="#fb923c" />
                  </g>
                )}

                {weather.type === 'niebla' && (
                  <g opacity="0.32">
                    <rect x={18} y={24} width={84} height={8} fill="#cbd5e1" />
                    <rect x={180} y={76} width={96} height={8} fill="#e2e8f0" />
                    <rect x={60} y={132} width={88} height={8} fill="#cbd5e1" />
                  </g>
                )}
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
