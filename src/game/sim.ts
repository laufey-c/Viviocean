import {
  DEVIL_FRUITS,
  FLAG_COLORS,
  FLAG_EMBLEMS,
  GRAND_LINE_ISLANDS,
  MENTAL_TRAITS,
  PHYSICAL_TRAITS,
  getBossDropPool,
  getBossForIsland,
  getDefaultAppearance,
  getEquipmentItem,
  getFactionInfo,
  getMiniBossesForIsland,
  getNpcsForIsland,
  getRaceInfo,
  getRegionalWeather,
  getTraitBattlePhrase,
  getTraitOption,
} from './worldData';
import type {
  AccessoryStyle,
  CapeStyle,
  CreatePirateInput,
  EquipmentItem,
  EquipmentSlot,
  EquippedGear,
  HatStyle,
  Island,
  IslandMissionId,
  IslandZoneId,
  OutfitStyle,
  Pirate,
  PirateRace,
  PirateRole,
  PirateStats,
  SeaName,
  WeaponStyle,
  WeatherDebuffSummary,
  WeatherStatus,
  WorldEvent,
  WorldState,
} from './types';

export const MAX_TRAITS_PER_CATEGORY = 2;
export const BASE_SAIL_SPEED = 0.018; // Slow, unhurried ocean navigation
export const IN_GAME_DAYS_PER_12_REAL_HOURS = 7;
// Exact rate: 12 real hours (43,200s) = 1 in-game week (7 days * 1,440 min = 10,080 min)
export const GAME_MINUTES_PER_REAL_SECOND = (IN_GAME_DAYS_PER_12_REAL_HOURS * 1440) / (12 * 3600);

export function getWeekAndDay(day: number): { week: number; dayOfWeek: number } {
  const safeDay = Math.max(1, Math.floor(day));
  return {
    week: Math.floor((safeDay - 1) / 7) + 1,
    dayOfWeek: ((safeDay - 1) % 7) + 1,
  };
}

export interface ComputedTraitModifiers {
  combatDelta: number;
  speedMult: number;
  treasureBonus: number;
  treasureWeightDelta: number;
  duelWeightDelta: number;
  fruitChanceDelta: number;
  duelRiskDelta: number;
  bountyMult: number;
}

export function computeTraitModifiers(
  pirate: Pick<Pirate, 'physicalTraits' | 'mentalTraits'>
): ComputedTraitModifiers {
  const result: ComputedTraitModifiers = {
    combatDelta: 0,
    speedMult: 1,
    treasureBonus: 0,
    treasureWeightDelta: 0,
    duelWeightDelta: 0,
    fruitChanceDelta: 0,
    duelRiskDelta: 0,
    bountyMult: 1,
  };

  for (const id of [...pirate.physicalTraits, ...pirate.mentalTraits]) {
    const opt = getTraitOption(id);
    if (!opt) continue;
    const fx = opt.effects;
    if (fx.combatDelta) result.combatDelta += fx.combatDelta;
    if (fx.speedMult) result.speedMult *= fx.speedMult;
    if (fx.treasureBonus) result.treasureBonus += fx.treasureBonus;
    if (fx.treasureWeightDelta) result.treasureWeightDelta += fx.treasureWeightDelta;
    if (fx.duelWeightDelta) result.duelWeightDelta += fx.duelWeightDelta;
    if (fx.fruitChanceDelta) result.fruitChanceDelta += fx.fruitChanceDelta;
    if (fx.duelRiskDelta) result.duelRiskDelta += fx.duelRiskDelta;
    if (fx.bountyMult) result.bountyMult *= fx.bountyMult;
  }

  result.speedMult = Math.max(0.65, Math.min(1.65, result.speedMult));
  result.bountyMult = Math.max(0.75, Math.min(1.5, result.bountyMult));
  return result;
}

export function getCharacterSpriteScale(race?: PirateRace, islandId?: string): number {
  if (race === 'gigante') {
    return islandId === 'elbaph' ? 1.58 : 1.78;
  }
  if (islandId === 'elbaph') {
    return 0.65;
  }
  return 1.0;
}

export function xpForNextLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return 20 + (safeLevel - 1) * 14;
}

export function getRankInfo(level: number): {
  title: string;
  nextHint: string;
} {
  if (level < 3) {
    return {
      title: 'Novato',
      nextHint: 'Siguiente: Oficial · nivel 3',
    };
  }
  if (level < 5) {
    return {
      title: 'Oficial',
      nextHint: 'Siguiente: Capitán · nivel 5 y liderar una tripulación',
    };
  }
  if (level < 10) {
    return {
      title: 'Capitán',
      nextHint: 'Siguiente: Supernova · nivel 10 para cruzar al Paraíso',
    };
  }
  if (level < 20) {
    return {
      title: 'Supernova',
      nextHint: 'Siguiente: Leyenda · nivel 20 para dominar el Nuevo Mundo',
    };
  }
  return {
    title: 'Leyenda',
    nextHint: 'Rango máximo alcanzado en los Cuatro Mares y el Grand Line',
  };
}

export function getIslandWeather(
  island: Island,
  day: number,
  minuteOfDay: number
): WeatherStatus {
  return getRegionalWeather(island, day, minuteOfDay);
}

export function computeWeatherDebuff(
  weather: WeatherStatus,
  pirate: Pick<Pirate, 'devilFruit' | 'race'>
): WeatherDebuffSummary {
  const hasFruit = Boolean(pirate.devilFruit && pirate.devilFruit.trim() !== '');
  if (hasFruit) {
    if (weather.type === 'lluvia') {
      return {
        active: true,
        label: 'Debilitado por Lluvia (Fruta del Diablo)',
        fuerzaDelta: -3,
        agilidadDelta: -2,
        aguanteDelta: 0,
        ingenioDelta: 0,
        combatDelta: -2.5,
      };
    }
    if (weather.type === 'tormenta') {
      return {
        active: true,
        label: 'Aturdido por Tormenta (Fruta del Diablo)',
        fuerzaDelta: -4,
        agilidadDelta: -3,
        aguanteDelta: -1,
        ingenioDelta: 0,
        combatDelta: -3.5,
      };
    }
    if (weather.type === 'nieve') {
      return {
        active: true,
        label: 'Entumecido por Ventisca (Fruta del Diablo)',
        fuerzaDelta: -1,
        agilidadDelta: -2,
        aguanteDelta: 0,
        ingenioDelta: 0,
        combatDelta: -1.5,
      };
    }
    if (weather.type === 'niebla') {
      return {
        active: true,
        label: 'Desorientado por Niebla (Fruta del Diablo)',
        fuerzaDelta: 0,
        agilidadDelta: -1,
        aguanteDelta: 0,
        ingenioDelta: -1,
        combatDelta: -1.0,
      };
    }
  } else if (
    pirate.race === 'gyojin' &&
    (weather.type === 'lluvia' || weather.type === 'tormenta')
  ) {
    return {
      active: true,
      label: 'Impulso Gyojin bajo la Lluvia',
      fuerzaDelta: 1,
      agilidadDelta: 1,
      aguanteDelta: 0,
      ingenioDelta: 0,
      combatDelta: 1.0,
    };
  }

  return {
    active: false,
    label: '',
    fuerzaDelta: 0,
    agilidadDelta: 0,
    aguanteDelta: 0,
    ingenioDelta: 0,
    combatDelta: 0,
  };
}

export function getEquippedItems(equipped?: EquippedGear | null): EquipmentItem[] {
  if (!equipped) return [];
  const ids = [equipped.arma, equipped.armadura, equipped.amuleto];
  const items: EquipmentItem[] = [];
  for (const id of ids) {
    const item = getEquipmentItem(id);
    if (item) items.push(item);
  }
  return items;
}

export function computePirateStats(
  pirate: Pick<
    Pirate,
    | 'level'
    | 'wins'
    | 'bossesDefeated'
    | 'devilFruit'
    | 'physicalTraits'
    | 'mentalTraits'
    | 'bodyBuild'
    | 'race'
    | 'equipped'
  >,
  activeWeather?: WeatherStatus | null
): PirateStats {
  const lv = Math.max(1, pirate.level || 1);
  const traits = new Set([...pirate.physicalTraits, ...pirate.mentalTraits]);

  let fuerza = 4 + lv * 2 + Math.floor(pirate.wins * 0.4) + (pirate.bossesDefeated || 0);
  let agilidad = 4 + Math.floor(lv * 1.5);
  let aguante = 4 + Math.floor(lv * 1.3);
  let ingenio = 4 + Math.floor(lv * 1.3);

  const raceInfo = getRaceInfo(pirate.race);
  fuerza += raceInfo.fuerzaBonus;
  agilidad += raceInfo.agilidadBonus;
  aguante += raceInfo.aguanteBonus;
  ingenio += raceInfo.ingenioBonus;

  if (pirate.bodyBuild === 'robust') {
    fuerza += 2;
    aguante += 2;
    agilidad = Math.max(3, agilidad - 1);
  } else if (pirate.bodyBuild === 'slim') {
    agilidad += 2;
    ingenio += 1;
  }

  if (traits.has('fuerte')) fuerza += 4;
  if (traits.has('golpe_demoledor')) fuerza += 5;
  if (traits.has('rapido')) agilidad += 4;
  if (traits.has('agil')) agilidad += 4;
  if (traits.has('zancada_gigante')) agilidad += 5;
  if (traits.has('grandes_reflejos')) agilidad += 3;
  if (traits.has('resistente')) aguante += 4;
  if (traits.has('cuerpo_ferreo')) {
    aguante += 4;
    fuerza += 2;
  }
  if (traits.has('pulmones_profundos')) aguante += 3;
  if (traits.has('astuto')) ingenio += 4;
  if (traits.has('estratega')) ingenio += 4;
  if (traits.has('ojo_halcon')) ingenio += 3;
  if (traits.has('navegante_nato')) {
    ingenio += 3;
    agilidad += 1;
  }
  if (traits.has('instinto_haki')) {
    fuerza += 3;
    aguante += 2;
  }
  if (traits.has('sangre_fria')) {
    aguante += 2;
    ingenio += 2;
  }
  if (traits.has('suerte_pirata')) ingenio += 2;
  if (traits.has('temerario')) fuerza += 2;
  if (traits.has('ambicioso')) ingenio += 2;

  if (pirate.devilFruit) {
    fuerza += 3;
    ingenio += 2;
  }

  for (const gear of getEquippedItems(pirate.equipped)) {
    fuerza += gear.fuerzaBonus ?? 0;
    agilidad += gear.agilidadBonus ?? 0;
    aguante += gear.aguanteBonus ?? 0;
    ingenio += gear.ingenioBonus ?? 0;
  }

  if (activeWeather) {
    const wx = computeWeatherDebuff(activeWeather, pirate);
    fuerza += wx.fuerzaDelta;
    agilidad += wx.agilidadDelta;
    aguante += wx.aguanteDelta;
    ingenio += wx.ingenioDelta;
  }

  return {
    fuerza: Math.max(1, Math.round(fuerza)),
    agilidad: Math.max(1, Math.round(agilidad)),
    aguante: Math.max(1, Math.round(aguante)),
    ingenio: Math.max(1, Math.round(ingenio)),
  };
}

export function awardXpToPirate(
  pirate: Pirate,
  xpGain: number
): { pirate: Pirate; leveledUp: boolean } {
  let level = Math.max(1, pirate.level || 1);
  let xp = Math.max(0, (pirate.xp || 0) + Math.max(0, Math.round(xpGain)));
  let leveledUp = false;

  while (xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level);
    level += 1;
    leveledUp = true;
  }

  return {
    leveledUp,
    pirate: {
      ...pirate,
      level,
      xp,
    },
  };
}

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function formatBounty(bounty: number): string {
  const safe = Math.max(0, Math.round(bounty));
  return `฿ ${safe.toLocaleString('en-US')}`;
}

export function formatShortBounty(bounty: number): string {
  const safe = Math.max(0, Math.round(bounty));
  if (safe >= 1_000_000_000) return `฿ ${(safe / 1_000_000_000).toFixed(2)}B`;
  if (safe >= 1_000_000) return `฿ ${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000) return `฿ ${(safe / 1_000).toFixed(0)}K`;
  return `฿ ${safe}`;
}

export function formatClock(minuteOfDay: number): string {
  const m = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function latLonToXYZ(latDeg: number, lonDeg: number, radius = 1): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const x = radius * Math.cos(lat) * Math.sin(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.cos(lon);
  return [x, y, z];
}

export function slerpUnitVec(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const theta = Math.acos(dot);
  if (theta < 0.0001) {
    return [a[0], a[1], a[2]];
  }
  const sinTheta = Math.sin(theta);
  const wA = Math.sin((1 - clamped) * theta) / sinTheta;
  const wB = Math.sin(clamped * theta) / sinTheta;
  const x = wA * a[0] + wB * b[0];
  const y = wA * a[1] + wB * b[1];
  const z = wA * a[2] + wB * b[2];
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

function isBlueSea(sea: SeaName): boolean {
  return (
    sea === 'Mar del Este' ||
    sea === 'Mar del Norte' ||
    sea === 'Mar del Sur' ||
    sea === 'Mar del Oeste'
  );
}

/**
 * Returns lat/lon waypoints ensuring any voyage crossing to the other side of the world
 * or between seas routes cleanly through the central gateway (0, 0) / Grand Line equator
 * instead of cutting across poles or continents.
 */
export function getNavigationPathCoords(
  fromIsland: Island,
  toIsland: Island
): Array<[number, number]> {
  if (fromIsland.id === toIsland.id) {
    return [[fromIsland.lat, fromIsland.lon]];
  }

  const sameSea = fromIsland.sea === toIsland.sea;
  const sameSideLon = fromIsland.lon * toIsland.lon >= 0;
  const sameSideLat = fromIsland.lat * toIsland.lat >= 0;

  // Within the exact same sea & quadrant, sail directly inside that sea
  if (sameSea && sameSideLon && (sameSideLat || !isBlueSea(fromIsland.sea))) {
    return [
      [fromIsland.lat, fromIsland.lon],
      [toIsland.lat, toIsland.lon],
    ];
  }

  // Crossing between Paraíso and Nuevo Mundo via the far Red Line gap or Reverse Mountain center
  if (
    (fromIsland.sea === 'Paraíso' && toIsland.sea === 'Nuevo Mundo') ||
    (fromIsland.sea === 'Nuevo Mundo' && toIsland.sea === 'Paraíso')
  ) {
    // Route via central Grand Line passage (0, 0) if closer to front center, else (0, ±178)
    const frontCenterDist = Math.abs(fromIsland.lon) + Math.abs(toIsland.lon);
    if (frontCenterDist <= 170) {
      return [
        [fromIsland.lat, fromIsland.lon],
        [0, 0],
        [toIsland.lat, toIsland.lon],
      ];
    }
    if (fromIsland.sea === 'Paraíso') {
      return [
        [fromIsland.lat, fromIsland.lon],
        [0, 178],
        [0, -178],
        [toIsland.lat, toIsland.lon],
      ];
    }
    return [
      [fromIsland.lat, fromIsland.lon],
      [0, -178],
      [0, 178],
      [toIsland.lat, toIsland.lon],
    ];
  }

  // Any crossing between Blues, hemispheres, or Blue <-> Grand Line routes through World Center (0, 0)
  const points: Array<[number, number]> = [[fromIsland.lat, fromIsland.lon]];

  // If leaving deep Grand Line, trace back along equator toward center (0,0)
  if (fromIsland.sea === 'Paraíso' && fromIsland.lon > 85) {
    points.push([0, 90]);
  } else if (fromIsland.sea === 'Nuevo Mundo' && fromIsland.lon < -85) {
    points.push([0, -90]);
  }

  points.push([0, 0]);

  if (toIsland.sea === 'Paraíso' && toIsland.lon > 85) {
    points.push([0, 90]);
  } else if (toIsland.sea === 'Nuevo Mundo' && toIsland.lon < -85) {
    points.push([0, -90]);
  }

  points.push([toIsland.lat, toIsland.lon]);
  return points;
}

export function sampleNavigationPathXYZ(
  coords: Array<[number, number]>,
  progress: number,
  radius = 1
): [number, number, number] {
  if (coords.length === 0) return [0, 0, radius];
  if (coords.length === 1) return latLonToXYZ(coords[0][0], coords[0][1], radius);

  const vecs = coords.map(([lat, lon]) => latLonToXYZ(lat, lon, 1));
  const segLens: number[] = [];
  let totalLen = 0;

  for (let i = 0; i < vecs.length - 1; i++) {
    const a = vecs[i];
    const b = vecs[i + 1];
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const angle = Math.max(0.001, Math.acos(dot));
    segLens.push(angle);
    totalLen += angle;
  }

  const clampedP = Math.max(0, Math.min(1, progress));
  const targetArc = clampedP * totalLen;
  let acc = 0;

  for (let i = 0; i < segLens.length; i++) {
    const segLen = segLens[i];
    if (acc + segLen >= targetArc || i === segLens.length - 1) {
      const localT = segLen > 0 ? Math.max(0, Math.min(1, (targetArc - acc) / segLen)) : 0;
      const p = slerpUnitVec(vecs[i], vecs[i + 1], localT);
      return [p[0] * radius, p[1] * radius, p[2] * radius];
    }
    acc += segLen;
  }

  const last = vecs[vecs.length - 1];
  return [last[0] * radius, last[1] * radius, last[2] * radius];
}

export function getPiratePositionXYZ(
  pirate: Pirate,
  islands: Island[],
  radius = 1
): [number, number, number] {
  const fromIsland = islands.find((i) => i.id === pirate.islandId) ?? islands[0];
  if (!pirate.sailingToIslandId) {
    return latLonToXYZ(fromIsland.lat, fromIsland.lon, radius);
  }
  const toIsland = islands.find((i) => i.id === pirate.sailingToIslandId) ?? fromIsland;
  const coords = getNavigationPathCoords(fromIsland, toIsland);
  return sampleNavigationPathXYZ(coords, pirate.sailProgress, radius);
}

export function getPirateHeadingXYZ(
  pirate: Pirate,
  islands: Island[],
  radius = 1
): [number, number, number] | null {
  if (!pirate.sailingToIslandId) return null;
  const fromIsland = islands.find((i) => i.id === pirate.islandId) ?? islands[0];
  const toIsland = islands.find((i) => i.id === pirate.sailingToIslandId) ?? fromIsland;
  const coords = getNavigationPathCoords(fromIsland, toIsland);
  const ahead = Math.min(1, pirate.sailProgress + 0.025);
  return sampleNavigationPathXYZ(coords, ahead, radius);
}

export function getIslandForNewPirate(sea: Pirate['originSea'], islands: Island[]): Island {
  return islands.find((i) => i.sea === sea) ?? islands[0];
}

const VALID_PHYSICAL_IDS = new Set(PHYSICAL_TRAITS.map((t) => t.id));
const VALID_MENTAL_IDS = new Set(MENTAL_TRAITS.map((t) => t.id));

export function validateCreatePirateInput(input: CreatePirateInput): string | null {
  const trimmedName = input.name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 32) {
    return 'El nombre del personaje debe tener entre 2 y 32 caracteres.';
  }
  if (input.epithet.trim().length > 40) {
    return 'El apodo no puede superar los 40 caracteres.';
  }
  if (input.dream.trim().length > 120) {
    return 'El sueño no puede superar los 120 caracteres.';
  }
  if (
    input.physicalTraits.length < 1 ||
    input.physicalTraits.length > MAX_TRAITS_PER_CATEGORY ||
    !input.physicalTraits.every((t) => VALID_PHYSICAL_IDS.has(t))
  ) {
    return 'Elige entre 1 y 2 rasgos físicos.';
  }
  if (
    input.mentalTraits.length < 1 ||
    input.mentalTraits.length > MAX_TRAITS_PER_CATEGORY ||
    !input.mentalTraits.every((t) => VALID_MENTAL_IDS.has(t))
  ) {
    return 'Elige entre 1 y 2 rasgos psicológicos.';
  }
  return null;
}

export function spawnPlayerPirate(
  world: WorldState,
  input: CreatePirateInput,
  ownerId = 'local-player',
  nowMs = Date.now()
): { world: WorldState; pirate: Pirate; event: WorldEvent } {
  const err = validateCreatePirateInput(input);
  if (err) {
    throw new Error(err);
  }
  const startIsland = getIslandForNewPirate(input.originSea, world.islands);
  const cleanName = input.name.trim();
  const factionInfo = getFactionInfo(input.faction);
  const cleanEpithet = input.epithet.trim() || factionInfo.defaultEpithet;
  const id = `pirate_${nowMs.toString(36)}_${Math.floor(Math.random() * 10000)}`;
  const flagColor = input.flagColor || factionInfo.defaultColor || FLAG_COLORS[0].hex;
  const fallbackAppearance = getDefaultAppearance(cleanName, flagColor);
  const mods = computeTraitModifiers({
    physicalTraits: input.physicalTraits,
    mentalTraits: input.mentalTraits,
  });

  const pirate: Pirate = {
    id,
    ownerId,
    isPlayerOwned: true,
    name: cleanName,
    epithet: cleanEpithet,
    faction: factionInfo.id,
    role: input.role ?? 'Capitán',
    race: input.race ?? 'humano',
    originSea: input.originSea,
    dream: input.dream.trim() || 'Explorar cada rincón de Vivid Ocean.',
    physicalTraits: [...input.physicalTraits],
    mentalTraits: [...input.mentalTraits],
    bounty: 500_000,
    berries: 5,
    wins: 0,
    losses: 0,
    level: 1,
    xp: 0,
    bossesDefeated: 0,
    devilFruit: '',
    crewName: (input.crewName?.trim() || 'Sin tripulación').slice(0, 48),
    islandId: startIsland.id,
    islandSpot: 'taberna',
    islandActivity: `En la taberna de ${startIsland.name}`,
    manualMode: false,
    flagColor,
    flagEmblem: input.flagEmblem || FLAG_EMBLEMS[0].id,
    directive: 'libre',
    status: 'active',
    sailingToIslandId: null,
    sailProgress: 0,
    sailSpeed: Number((BASE_SAIL_SPEED * mods.speedMult).toFixed(4)),
    cooldownSec: 8,
    hatStyle: input.hatStyle ?? 'straw',
    hatColor:
      (input.hatStyle ?? 'straw') === 'none' ? undefined : input.hatColor || undefined,
    skinTone: input.skinTone || fallbackAppearance.skinTone,
    hairStyle: input.hairStyle || fallbackAppearance.hairStyle,
    hairColor: input.hairColor || fallbackAppearance.hairColor,
    bodyBuild: input.bodyBuild || fallbackAppearance.bodyBuild,
    outfitStyle: input.outfitStyle || fallbackAppearance.outfitStyle,
    outfitColor: input.outfitColor || fallbackAppearance.outfitColor,
    accessory: input.accessory ?? 'none',
    accessoryColor:
      !input.accessory || input.accessory === 'none'
        ? undefined
        : input.accessoryColor || undefined,
    capeStyle: input.capeStyle ?? 'none',
    capeColor:
      !input.capeStyle || input.capeStyle === 'none'
        ? undefined
        : input.capeColor || undefined,
    weaponStyle: input.weaponStyle ?? 'none',
    inventory: [],
    equipped: {},
    createdAtMs: nowMs,
    arrivedDay: world.day,
    completedQuestIds: [],
    defeatedMiniBossIds: [],
  };

  const factionPhrase =
    pirate.faction === 'marines'
      ? `como ${factionInfo.singular} en ${startIsland.name}`
      : pirate.faction === 'revolucionarios'
      ? `en los Revolucionarios en ${startIsland.name}`
      : pirate.faction === 'aventureros'
      ? `como ${factionInfo.singular} en ${startIsland.name}`
      : `en ${startIsland.name}`;

  const event: WorldEvent = {
    id: `ev_${nowMs.toString(36)}_${Math.floor(Math.random() * 10000)}`,
    type: 'launch',
    sea: startIsland.sea,
    islandId: startIsland.id,
    pirateId: pirate.id,
    pirateName: pirate.name,
    isPlayerRelated: true,
    message: `${pirate.name} «${pirate.epithet}» comienza su aventura ${factionPhrase} con fama inicial de ฿ 500,000.`,
    bountyDelta: 500_000,
    day: world.day,
    timeLabel: formatClock(world.minuteOfDay),
    createdAtMs: nowMs,
  };

  return {
    pirate,
    event,
    world: {
      ...world,
      totalPiratesCount: world.totalPiratesCount + 1,
      pirates: [pirate, ...world.pirates],
      events: [event, ...world.events].slice(0, 80),
      lastCameraFocusEventId: event.id,
    },
  };
}

export function updatePirateCrew(
  world: WorldState,
  pirateId: string,
  payload: { crewName: string; role: PirateRole; flagColor: string },
  nowMs = Date.now()
): { world: WorldState; pirate: Pirate | null; event: WorldEvent | null } {
  const cleanCrew = payload.crewName.trim().slice(0, 48) || 'Sin tripulación';
  let updated: Pirate | null = null;
  const pirates = world.pirates.map((p) => {
    if (p.id !== pirateId) return p;
    updated = {
      ...p,
      crewName: cleanCrew,
      role: payload.role,
      flagColor: payload.flagColor || p.flagColor,
    };
    return updated;
  });

  if (!updated) {
    return { world, pirate: null, event: null };
  }

  const target = updated as Pirate;
  const currIsland = world.islands.find((i) => i.id === target.islandId) ?? world.islands[0];
  const event: WorldEvent = {
    id: `ev_${nowMs.toString(36)}_crew_${Math.floor(Math.random() * 99999)}`,
    type: 'crew',
    sea: currIsland.sea,
    islandId: currIsland.id,
    pirateId: target.id,
    pirateName: target.name,
    isPlayerRelated: target.isPlayerOwned,
    message:
      cleanCrew === 'Sin tripulación'
        ? `${target.name} decide operar en solitario (${target.role}).`
        : `${target.name} actualiza su tripulación «${cleanCrew}» como ${target.role}.`,
    bountyDelta: 0,
    day: world.day,
    timeLabel: formatClock(world.minuteOfDay),
    createdAtMs: nowMs,
  };

  return {
    pirate: target,
    event,
    world: {
      ...world,
      pirates,
      events: [event, ...world.events].slice(0, 80),
    },
  };
}

export function updatePirateProfile(
  world: WorldState,
  pirateId: string,
  input: CreatePirateInput,
  nowMs = Date.now()
): { world: WorldState; pirate: Pirate | null; event: WorldEvent | null } {
  const cleanName = input.name.trim().slice(0, 32);
  if (cleanName.length < 2) {
    return { world, pirate: null, event: null };
  }

  const factionInfo = getFactionInfo(input.faction);
  const cleanEpithet = (input.epithet.trim() || factionInfo.defaultEpithet).slice(0, 40);
  const mods = computeTraitModifiers({
    physicalTraits: input.physicalTraits,
    mentalTraits: input.mentalTraits,
  });

  let updated: Pirate | null = null;
  const pirates = world.pirates.map((p) => {
    if (p.id !== pirateId) return p;
    updated = {
      ...p,
      name: cleanName,
      epithet: cleanEpithet,
      faction: factionInfo.id,
      role: input.role ?? p.role,
      // Race, hair, skin tone, and body build are locked once created
      race: p.race ?? 'humano',
      originSea: input.originSea,
      dream: input.dream.trim() || p.dream,
      physicalTraits: [...input.physicalTraits],
      mentalTraits: [...input.mentalTraits],
      flagColor: input.flagColor || factionInfo.defaultColor || p.flagColor,
      hatStyle: input.hatStyle ?? p.hatStyle,
      hatColor:
        (input.hatStyle ?? p.hatStyle) === 'none'
          ? undefined
          : 'hatColor' in input
            ? input.hatColor || undefined
            : p.hatColor,
      skinTone: p.skinTone,
      hairStyle: p.hairStyle,
      hairColor: p.hairColor,
      bodyBuild: p.bodyBuild,
      outfitStyle: input.outfitStyle || p.outfitStyle,
      outfitColor: input.outfitColor || p.outfitColor,
      accessory: input.accessory ?? p.accessory,
      accessoryColor:
        (input.accessory ?? p.accessory) === 'none'
          ? undefined
          : 'accessoryColor' in input
            ? input.accessoryColor || undefined
            : p.accessoryColor,
      capeStyle: input.capeStyle ?? p.capeStyle ?? 'none',
      capeColor:
        (input.capeStyle ?? p.capeStyle ?? 'none') === 'none'
          ? undefined
          : 'capeColor' in input
            ? input.capeColor || undefined
            : p.capeColor,
      sailSpeed: Number((BASE_SAIL_SPEED * mods.speedMult).toFixed(4)),
    };
    return updated;
  });

  if (!updated) {
    return { world, pirate: null, event: null };
  }

  const target = updated as Pirate;
  const currIsland = world.islands.find((i) => i.id === target.islandId) ?? world.islands[0];
  const event: WorldEvent = {
    id: `ev_${nowMs.toString(36)}_edit_${Math.floor(Math.random() * 99999)}`,
    type: 'crew',
    sea: currIsland.sea,
    islandId: currIsland.id,
    pirateId: target.id,
    pirateName: target.name,
    isPlayerRelated: target.isPlayerOwned,
    message: `${target.name} actualiza su aspecto, rol (${target.role}) y rasgos en ${currIsland.name}.`,
    bountyDelta: 0,
    day: world.day,
    timeLabel: formatClock(world.minuteOfDay),
    createdAtMs: nowMs,
  };

  return {
    pirate: target,
    event,
    world: {
      ...world,
      pirates,
      events: [event, ...world.events].slice(0, 80),
    },
  };
}

export interface PirateBuildPatch {
  hatStyle?: HatStyle;
  hatColor?: string;
  accessory?: AccessoryStyle;
  accessoryColor?: string;
  capeStyle?: CapeStyle;
  capeColor?: string;
  outfitStyle?: OutfitStyle;
  outfitColor?: string;
}

export function updatePirateBuild(
  world: WorldState,
  pirateId: string,
  patch: PirateBuildPatch
): { world: WorldState; pirate: Pirate | null } {
  let updated: Pirate | null = null;
  const pirates = world.pirates.map((p) => {
    if (p.id !== pirateId) return p;
    const nextHat = patch.hatStyle ?? p.hatStyle;
    const nextAcc = patch.accessory ?? p.accessory;
    const nextCape = patch.capeStyle ?? p.capeStyle ?? 'none';
    updated = {
      ...p,
      hatStyle: nextHat,
      hatColor:
        nextHat === 'none'
          ? undefined
          : 'hatColor' in patch
            ? patch.hatColor || undefined
            : p.hatColor,
      outfitStyle: patch.outfitStyle ?? p.outfitStyle,
      outfitColor: patch.outfitColor ?? p.outfitColor,
      accessory: nextAcc,
      accessoryColor:
        nextAcc === 'none'
          ? undefined
          : 'accessoryColor' in patch
            ? patch.accessoryColor || undefined
            : p.accessoryColor,
      capeStyle: nextCape,
      capeColor:
        nextCape === 'none'
          ? undefined
          : 'capeColor' in patch
            ? patch.capeColor || undefined
            : p.capeColor,
    };
    return updated;
  });
  return {
    pirate: updated,
    world: updated ? { ...world, pirates } : world,
  };
}

export function equipPirateItem(
  world: WorldState,
  pirateId: string,
  itemId: string
): { world: WorldState; pirate: Pirate | null } {
  const item = getEquipmentItem(itemId);
  if (!item) return { world, pirate: null };
  let updated: Pirate | null = null;
  const pirates = world.pirates.map((p) => {
    if (p.id !== pirateId) return p;
    const inv = p.inventory ?? [];
    if (!inv.includes(item.id)) return p;
    const prevEquipped = p.equipped ?? {};
    updated = {
      ...p,
      equipped: {
        ...prevEquipped,
        [item.slot]: item.id,
      },
    };
    return updated;
  });
  return {
    pirate: updated,
    world: updated ? { ...world, pirates } : world,
  };
}

export function unequipPirateSlot(
  world: WorldState,
  pirateId: string,
  slot: EquipmentSlot
): { world: WorldState; pirate: Pirate | null } {
  let updated: Pirate | null = null;
  const pirates = world.pirates.map((p) => {
    if (p.id !== pirateId) return p;
    const prevEquipped = p.equipped ?? {};
    updated = {
      ...p,
      equipped: {
        ...prevEquipped,
        [slot]: null,
      },
    };
    return updated;
  });
  return {
    pirate: updated,
    world: updated ? { ...world, pirates } : world,
  };
}

export function setPirateManualMode(
  world: WorldState,
  pirateId: string,
  manualMode: boolean
): WorldState {
  return {
    ...world,
    pirates: world.pirates.map((p) => {
      if (p.id !== pirateId) return p;
      const isl = world.islands.find((i) => i.id === p.islandId);
      return {
        ...p,
        manualMode,
        islandActivity: manualMode
          ? `En espera manual en ${isl?.name ?? 'la isla'}`
          : `Recorriendo ${isl?.name ?? 'la isla'}`,
      };
    }),
  };
}

export function movePirateInIsland(
  world: WorldState,
  pirateId: string,
  spot: IslandZoneId,
  activityLabel?: string
): WorldState {
  return {
    ...world,
    pirates: world.pirates.map((p) => {
      if (p.id !== pirateId || p.sailingToIslandId) return p;
      const isl = world.islands.find((i) => i.id === p.islandId);
      const defaultLabels: Record<IslandZoneId, string> = {
        taberna: `En la taberna de ${isl?.name ?? 'la isla'}`,
        dojo: `En el dojo de ${isl?.name ?? 'la isla'}`,
        ruinas: `En las ruinas de ${isl?.name ?? 'la isla'}`,
        puerto: `En el puerto de ${isl?.name ?? 'la isla'}`,
        jefe: `Frente a la guarida del Jefe en ${isl?.name ?? 'la isla'}`,
      };
      return {
        ...p,
        islandSpot: spot,
        islandActivity: activityLabel || defaultLabels[spot],
      };
    }),
  };
}

export function startPirateVoyage(
  world: WorldState,
  pirateId: string,
  destIslandId: string,
  nowMs = Date.now()
): { world: WorldState; started: boolean; reason?: string } {
  const pirate = world.pirates.find((p) => p.id === pirateId);
  const dest = world.islands.find((i) => i.id === destIslandId);
  if (!pirate || !dest) return { world, started: false };
  if (pirate.islandId === dest.id) {
    return { world, started: false, reason: 'Ya te encuentras en esa isla.' };
  }
  if (pirate.sailingToIslandId) {
    return { world, started: false, reason: 'Tu barco ya está en plena travesía.' };
  }

  const fromIsland = world.islands.find((i) => i.id === pirate.islandId) ?? world.islands[0];
  const path = getNavigationPathCoords(fromIsland, dest);
  const viaCenter = path.length > 2;
  const mods = computeTraitModifiers(pirate);

  const event: WorldEvent = {
    id: `ev_${nowMs.toString(36)}_voy_${Math.floor(Math.random() * 99999)}`,
    type: 'voyage',
    sea: fromIsland.sea,
    islandId: dest.id,
    pirateId: pirate.id,
    pirateName: pirate.name,
    isPlayerRelated: true,
    message: viaCenter
      ? `${pirate.name} zarpa de ${fromIsland.name} rumbo a ${dest.name} pasando por el centro del mundo.`
      : `${pirate.name} zarpa de ${fromIsland.name} rumbo a ${dest.name}.`,
    bountyDelta: 0,
    day: world.day,
    timeLabel: formatClock(world.minuteOfDay),
    createdAtMs: nowMs,
  };

  return {
    started: true,
    world: {
      ...world,
      pirates: world.pirates.map((p) =>
        p.id === pirateId
          ? {
              ...p,
              sailingToIslandId: dest.id,
              sailProgress: 0,
              sailSpeed: Number((BASE_SAIL_SPEED * mods.speedMult).toFixed(4)),
              islandActivity: viaCenter
                ? `Navegando por el centro hacia ${dest.name}`
                : `Navegando hacia ${dest.name}`,
            }
          : p
      ),
      events: [event, ...world.events].slice(0, 80),
      lastCameraFocusEventId: event.id,
    },
  };
}

export function removePirateFromWorld(world: WorldState, pirateId: string): WorldState {
  const nextPirates = world.pirates.filter((p) => p.id !== pirateId);
  const nextEvents = world.events.filter((ev) => ev.pirateId !== pirateId);
  return {
    ...world,
    pirates: nextPirates,
    events: nextEvents,
    totalPiratesCount: nextPirates.length,
    lastCameraFocusEventId: nextEvents.length > 0 ? nextEvents[0].id : null,
  };
}

export function createInitialWorld(): WorldState {
  return {
    day: 1,
    minuteOfDay: 480,
    totalPiratesCount: 0,
    islands: GRAND_LINE_ISLANDS,
    pirates: [],
    events: [],
    lastCameraFocusEventId: null,
  };
}

function scorePirateCombatPower(
  p: Pirate,
  rng: () => number,
  activeWeather?: WeatherStatus | null
): number {
  const stats = computePirateStats(p, activeWeather);
  const mods = computeTraitModifiers(p);
  const gearCombat = getEquippedItems(p.equipped).reduce(
    (sum, item) => sum + (item.combatBonus ?? 0),
    0
  );
  const wxCombat = activeWeather ? computeWeatherDebuff(activeWeather, p).combatDelta : 0;
  return (
    stats.fuerza * 0.55 +
    stats.agilidad * 0.35 +
    stats.aguante * 0.3 +
    stats.ingenio * 0.25 +
    mods.combatDelta +
    gearCombat +
    wxCombat +
    rng() * 8
  );
}

function rollBossDrop(
  pirate: Pirate,
  pool: string[],
  dropChance: number,
  rng: () => number
): {
  nextInventory: string[];
  droppedItem: EquipmentItem | null;
  isNew: boolean;
  bonusCoins: number;
} {
  const prevInv = pirate.inventory ?? [];
  if (pool.length === 0 || rng() >= dropChance) {
    return { nextInventory: prevInv, droppedItem: null, isNew: false, bonusCoins: 0 };
  }

  const unowned = pool.filter((id) => !prevInv.includes(id));
  const candidateId =
    unowned.length > 0
      ? unowned[Math.floor(rng() * unowned.length)]
      : pool[Math.floor(rng() * pool.length)];
  const item = getEquipmentItem(candidateId);
  if (!item) {
    return { nextInventory: prevInv, droppedItem: null, isNew: false, bonusCoins: 0 };
  }

  if (prevInv.includes(item.id)) {
    return { nextInventory: prevInv, droppedItem: item, isNew: false, bonusCoins: 2 };
  }
  return {
    nextInventory: [...prevInv, item.id],
    droppedItem: item,
    isNew: true,
    bonusCoins: 0,
  };
}

function resolvePvpDuel(
  attacker: Pirate,
  defender: Pirate,
  island: Island,
  rng: () => number,
  activeWeather?: WeatherStatus | null
): { winner: Pirate; loser: Pirate; reason: string; bountyGain: number } {
  const atkScore = scorePirateCombatPower(attacker, rng, activeWeather);
  const defScore = scorePirateCombatPower(defender, rng, activeWeather);

  const winner = atkScore >= defScore ? attacker : defender;
  const loser = winner.id === attacker.id ? defender : attacker;

  const allWinnerTraits = [...winner.physicalTraits, ...winner.mentalTraits];
  let reason = 'Se impuso en el duelo';
  if (winner.devilFruit && rng() < 0.35) {
    reason = `Usó el poder de su ${winner.devilFruit}`;
  } else if (allWinnerTraits.length > 0) {
    const picked = allWinnerTraits[Math.floor(rng() * allWinnerTraits.length)];
    reason = `Venció ${getTraitBattlePhrase(picked)}`;
  }

  const winnerMods = computeTraitModifiers(winner);
  const bountyGain = Math.round(
    (250_000 + island.dangerTier * 220_000 + Math.min(2_500_000, loser.bounty * 0.03)) *
      (0.85 + rng() * 0.3) *
      winnerMods.bountyMult
  );

  return { winner, loser, reason, bountyGain };
}

export function runIslandMission(
  world: WorldState,
  pirateId: string,
  missionId: IslandMissionId,
  rng: () => number = Math.random,
  nowMs = Date.now()
): { world: WorldState; event: WorldEvent | null } {
  const target = world.pirates.find((p) => p.id === pirateId);
  if (!target || target.sailingToIslandId) {
    return { world, event: null };
  }

  const island = world.islands.find((i) => i.id === target.islandId) ?? world.islands[0];
  const activeWeather = getIslandWeather(island, world.day, world.minuteOfDay);
  const mods = computeTraitModifiers(target);
  const timeLabel = formatClock(world.minuteOfDay);
  let nextWorld = world;
  let createdEvent: WorldEvent | null = null;

  const updateSinglePirate = (updated: Pirate, ev: WorldEvent) => {
    createdEvent = ev;
    nextWorld = {
      ...world,
      pirates: world.pirates.map((p) => (p.id === updated.id ? updated : p)),
      events: [ev, ...world.events].slice(0, 80),
      lastCameraFocusEventId: ev.id,
    };
  };

  if (missionId === 'taberna') {
    const xpRes = awardXpToPirate(target, 5);
    const updated: Pirate = {
      ...xpRes.pirate,
      berries: xpRes.pirate.berries + 1,
      islandSpot: 'taberna',
      islandActivity: `En la taberna de ${island.name}`,
      cooldownSec: 10,
    };
    const ev: WorldEvent = {
      id: `ev_${nowMs.toString(36)}_tav_${Math.floor(rng() * 99999)}`,
      type: 'dock',
      sea: island.sea,
      islandId: island.id,
      pirateId: updated.id,
      pirateName: updated.name,
      isPlayerRelated: true,
      message: `${updated.name} descansa en la taberna de ${island.name} y gana +5 XP${xpRes.leveledUp ? ` (¡Sube a Nivel ${updated.level}!)` : ''}.`,
      bountyDelta: 0,
      day: world.day,
      timeLabel,
      createdAtMs: nowMs,
    };
    updateSinglePirate(updated, ev);
    return { world: nextWorld, event: createdEvent };
  }

  if (missionId === 'entrenar') {
    const xpGain = 9 + island.dangerTier * 2;
    const xpRes = awardXpToPirate(target, xpGain);
    const updated: Pirate = {
      ...xpRes.pirate,
      berries: xpRes.pirate.berries + 1,
      islandSpot: 'dojo',
      islandActivity: `Entrenando en el dojo de ${island.name}`,
      cooldownSec: 11,
    };
    const ev: WorldEvent = {
      id: `ev_${nowMs.toString(36)}_trn_${Math.floor(rng() * 99999)}`,
      type: xpRes.leveledUp ? 'level_up' : 'dock',
      sea: island.sea,
      islandId: island.id,
      pirateId: updated.id,
      pirateName: updated.name,
      isPlayerRelated: true,
      message: `${updated.name} entrena duro en ${island.name} (+${xpGain} XP)${xpRes.leveledUp ? ` ¡Alcanza el Nivel ${updated.level}!` : ''}.`,
      bountyDelta: 0,
      day: world.day,
      timeLabel,
      createdAtMs: nowMs,
    };
    updateSinglePirate(updated, ev);
    return { world: nextWorld, event: createdEvent };
  }

  if (missionId === 'explorar') {
    const fruitChance = !target.devilFruit
      ? Math.max(0.01, 0.03 + island.dangerTier * 0.008 + mods.fruitChanceDelta)
      : 0;

    if (!target.devilFruit && rng() < fruitChance) {
      const fruit = DEVIL_FRUITS[Math.floor(rng() * DEVIL_FRUITS.length)];
      const xpRes = awardXpToPirate(target, 14 + island.dangerTier * 2);
      const updated: Pirate = {
        ...xpRes.pirate,
        devilFruit: fruit,
        berries: xpRes.pirate.berries + 3,
        islandSpot: 'ruinas',
        islandActivity: `Explorando ruinas de ${island.name}`,
        cooldownSec: 12,
      };
      const ev: WorldEvent = {
        id: `ev_${nowMs.toString(36)}_df_${Math.floor(rng() * 99999)}`,
        type: 'devil_fruit',
        sea: island.sea,
        islandId: island.id,
        pirateId: updated.id,
        pirateName: updated.name,
        isPlayerRelated: true,
        message: `¡Hallazgo histórico en ${island.name}! ${updated.name} descubre la ${fruit}.`,
        bountyDelta: 0,
        day: world.day,
        timeLabel,
        createdAtMs: nowMs,
      };
      updateSinglePirate(updated, ev);
      return { world: nextWorld, event: createdEvent };
    }

    const coins = 2 + Math.max(0, mods.treasureBonus) + Math.floor(rng() * (1 + island.dangerTier));
    const xpGain = 7 + island.dangerTier * 2;
    const xpRes = awardXpToPirate(target, xpGain);
    const updated: Pirate = {
      ...xpRes.pirate,
      berries: xpRes.pirate.berries + coins,
      islandSpot: 'ruinas',
      islandActivity: `Explorando las costas de ${island.name}`,
      cooldownSec: 12,
    };
    const ev: WorldEvent = {
      id: `ev_${nowMs.toString(36)}_exp_${Math.floor(rng() * 99999)}`,
      type: 'treasure',
      sea: island.sea,
      islandId: island.id,
      pirateId: updated.id,
      pirateName: updated.name,
      isPlayerRelated: true,
      message: `${updated.name} explora ${island.name}, reúne ${coins} monedones y +${xpGain} XP${xpRes.leveledUp ? ` (¡Nivel ${updated.level}!)` : ''}.`,
      bountyDelta: 0,
      day: world.day,
      timeLabel,
      createdAtMs: nowMs,
    };
    updateSinglePirate(updated, ev);
    return { world: nextWorld, event: createdEvent };
  }

  if (missionId === 'duelo') {
    const rivals = world.pirates.filter(
      (other) => other.id !== target.id && !other.sailingToIslandId && other.islandId === island.id
    );
    if (rivals.length > 0) {
      const rival = rivals[Math.floor(rng() * rivals.length)];
      const { winner, loser, reason, bountyGain } = resolvePvpDuel(
        target,
        rival,
        island,
        rng,
        activeWeather
      );
      const winXp = awardXpToPirate(winner, 14 + island.dangerTier * 3);
      const loseXp = awardXpToPirate(loser, 5);
      const updatedWinner: Pirate = {
        ...winXp.pirate,
        wins: winXp.pirate.wins + 1,
        bounty: winXp.pirate.bounty + bountyGain,
        berries: winXp.pirate.berries + 2 + island.dangerTier,
        islandSpot: 'puerto',
        islandActivity: `Victorioso en el puerto de ${island.name}`,
        cooldownSec: 12,
      };
      const updatedLoser: Pirate = {
        ...loseXp.pirate,
        losses: loseXp.pirate.losses + 1,
        islandSpot: 'puerto',
        islandActivity: `Recuperándose en ${island.name}`,
        cooldownSec: 14,
      };
      const ev: WorldEvent = {
        id: `ev_${nowMs.toString(36)}_pvp_${Math.floor(rng() * 99999)}`,
        type: 'duel',
        sea: island.sea,
        islandId: island.id,
        pirateId: updatedWinner.id,
        pirateName: updatedWinner.name,
        targetPirateId: updatedLoser.id,
        isPlayerRelated: true,
        message: `Duelo entre personajes en ${island.name}: ${updatedWinner.name} vence a ${updatedLoser.name}. ${reason}.`,
        bountyDelta: bountyGain,
        day: world.day,
        timeLabel,
        createdAtMs: nowMs,
      };
      return {
        event: ev,
        world: {
          ...world,
          pirates: world.pirates.map((p) =>
            p.id === updatedWinner.id ? updatedWinner : p.id === updatedLoser.id ? updatedLoser : p
          ),
          events: [ev, ...world.events].slice(0, 80),
          lastCameraFocusEventId: ev.id,
        },
      };
    }

    // No other character docked here: duel a wandering sea rival in port for modest bounty
    const power = scorePirateCombatPower(target, rng, activeWeather);
    const won = power >= 9 + island.dangerTier * 2.5;
    if (won) {
      const bountyGain = Math.round((180_000 + island.dangerTier * 150_000) * mods.bountyMult);
      const xpRes = awardXpToPirate(target, 12 + island.dangerTier * 2);
      const updated: Pirate = {
        ...xpRes.pirate,
        wins: xpRes.pirate.wins + 1,
        bounty: xpRes.pirate.bounty + bountyGain,
        berries: xpRes.pirate.berries + 2,
        islandSpot: 'puerto',
        islandActivity: `Celebrando victoria en ${island.name}`,
        cooldownSec: 12,
      };
      const ev: WorldEvent = {
        id: `ev_${nowMs.toString(36)}_duel_${Math.floor(rng() * 99999)}`,
        type: 'duel',
        sea: island.sea,
        islandId: island.id,
        pirateId: updated.id,
        pirateName: updated.name,
        isPlayerRelated: true,
        message: `${updated.name} derrota a un rival en el puerto de ${island.name} (+${formatShortBounty(bountyGain)}).`,
        bountyDelta: bountyGain,
        day: world.day,
        timeLabel,
        createdAtMs: nowMs,
      };
      updateSinglePirate(updated, ev);
      return { world: nextWorld, event: createdEvent };
    } else {
      const xpRes = awardXpToPirate(target, 5);
      const updated: Pirate = {
        ...xpRes.pirate,
        losses: xpRes.pirate.losses + 1,
        islandSpot: 'puerto',
        islandActivity: `Reponiéndose en el puerto de ${island.name}`,
        cooldownSec: 13,
      };
      const ev: WorldEvent = {
        id: `ev_${nowMs.toString(36)}_duel_${Math.floor(rng() * 99999)}`,
        type: 'duel',
        sea: island.sea,
        islandId: island.id,
        pirateId: updated.id,
        pirateName: updated.name,
        isPlayerRelated: true,
        message: `${updated.name} cae en un duelo en ${island.name}, pero gana +5 XP de experiencia.`,
        bountyDelta: 0,
        day: world.day,
        timeLabel,
        createdAtMs: nowMs,
      };
      updateSinglePirate(updated, ev);
      return { world: nextWorld, event: createdEvent };
    }
  }

  // BOSS MISSION: primary source of bounty + boss equipment drops!
  const boss = getBossForIsland(island);
  const playerPower = scorePirateCombatPower(target, rng, activeWeather);
  const wonBoss = playerPower >= boss.power * 0.72;

  if (wonBoss) {
    const bountyGain = Math.round(boss.bountyReward * mods.bountyMult);
    const xpRes = awardXpToPirate(target, boss.xpReward);
    const dropRes = rollBossDrop(target, getBossDropPool(island, boss), 0.78, rng);
    const updated: Pirate = {
      ...xpRes.pirate,
      wins: xpRes.pirate.wins + 1,
      bossesDefeated: (xpRes.pirate.bossesDefeated || 0) + 1,
      bounty: xpRes.pirate.bounty + bountyGain,
      berries: xpRes.pirate.berries + boss.berriesReward + dropRes.bonusCoins,
      inventory: dropRes.nextInventory,
      islandSpot: 'jefe',
      islandActivity: `Derrotó a ${boss.name} en ${island.name}`,
      cooldownSec: 14,
    };
    const dropText = dropRes.droppedItem
      ? dropRes.isNew
        ? ` ¡Botín del Jefe: ${dropRes.droppedItem.name}!`
        : ` (${dropRes.droppedItem.name} duplicado → +2 monedones)`
      : '';
    const ev: WorldEvent = {
      id: `ev_${nowMs.toString(36)}_boss_${Math.floor(rng() * 99999)}`,
      type: dropRes.droppedItem && dropRes.isNew ? 'drop' : 'boss',
      sea: island.sea,
      islandId: island.id,
      pirateId: updated.id,
      pirateName: updated.name,
      isPlayerRelated: true,
      message: `¡Jefe derrotado en ${island.name}! ${updated.name} vence a ${boss.name} (${boss.title}) y suma +${formatShortBounty(bountyGain)} de recompensa.${dropText}`,
      bountyDelta: bountyGain,
      day: world.day,
      timeLabel,
      createdAtMs: nowMs,
    };
    updateSinglePirate(updated, ev);
    return { world: nextWorld, event: createdEvent };
  }

  // Boss defeat: still grants consolation XP
  const xpRes = awardXpToPirate(target, 6);
  const updated: Pirate = {
    ...xpRes.pirate,
    losses: xpRes.pirate.losses + 1,
    islandSpot: 'jefe',
    islandActivity: `Repuesto tras desafiar a ${boss.name}`,
    cooldownSec: 15,
  };
  const ev: WorldEvent = {
    id: `ev_${nowMs.toString(36)}_bossl_${Math.floor(rng() * 99999)}`,
    type: 'boss',
    sea: island.sea,
    islandId: island.id,
    pirateId: updated.id,
    pirateName: updated.name,
    isPlayerRelated: true,
    message: `${updated.name} enfrenta al Jefe ${boss.name} en ${island.name} y cae en combate (+6 XP para seguir entrenando).`,
    bountyDelta: 0,
    day: world.day,
    timeLabel,
    createdAtMs: nowMs,
  };
  updateSinglePirate(updated, ev);
  return { world: nextWorld, event: createdEvent };
}

export function runNpcQuest(
  world: WorldState,
  pirateId: string,
  questId: string,
  rng: () => number = Math.random,
  nowMs = Date.now()
): { world: WorldState; event: WorldEvent | null } {
  const target = world.pirates.find((p) => p.id === pirateId);
  if (!target || target.sailingToIslandId) {
    return { world, event: null };
  }

  const island = world.islands.find((i) => i.id === target.islandId) ?? world.islands[0];
  const quest = getNpcsForIsland(island).find((q) => q.id === questId);
  if (!quest) {
    return { world, event: null };
  }

  const prevCompleted = target.completedQuestIds ?? [];
  const alreadyDone = prevCompleted.includes(quest.id);
  const mods = computeTraitModifiers(target);
  const timeLabel = formatClock(world.minuteOfDay);

  const xpGain = alreadyDone ? Math.max(4, Math.round(quest.xpReward * 0.35)) : quest.xpReward;
  const berriesGain = alreadyDone ? 1 : quest.berriesReward;
  const bountyGain =
    !alreadyDone && quest.bountyReward > 0
      ? Math.round(quest.bountyReward * mods.bountyMult)
      : 0;

  const xpRes = awardXpToPirate(target, xpGain);
  const updated: Pirate = {
    ...xpRes.pirate,
    bounty: xpRes.pirate.bounty + bountyGain,
    berries: xpRes.pirate.berries + berriesGain,
    islandSpot: quest.zone,
    islandActivity: `Ayudando a ${quest.npcName} en ${island.name}`,
    cooldownSec: 12,
    completedQuestIds: alreadyDone ? prevCompleted : [...prevCompleted, quest.id],
  };

  const bountyText = bountyGain > 0 ? ` y +${formatShortBounty(bountyGain)}` : '';
  const ev: WorldEvent = {
    id: `ev_${nowMs.toString(36)}_npc_${Math.floor(rng() * 99999)}`,
    type: bountyGain > 0 ? 'treasure' : xpRes.leveledUp ? 'level_up' : 'dock',
    sea: island.sea,
    islandId: island.id,
    pirateId: updated.id,
    pirateName: updated.name,
    isPlayerRelated: updated.isPlayerOwned,
    message: `${updated.name} ${alreadyDone ? 'repasa el encargo' : 'completa la misión'} «${quest.title}» para ${quest.npcName} en ${island.name} (+${xpGain} XP, +${berriesGain} monedones${bountyText})${xpRes.leveledUp ? ` ¡Nivel ${updated.level}!` : ''}.`,
    bountyDelta: bountyGain,
    day: world.day,
    timeLabel,
    createdAtMs: nowMs,
  };

  return {
    event: ev,
    world: {
      ...world,
      pirates: world.pirates.map((p) => (p.id === updated.id ? updated : p)),
      events: [ev, ...world.events].slice(0, 80),
      lastCameraFocusEventId: ev.id,
    },
  };
}

export function challengeMiniBoss(
  world: WorldState,
  pirateId: string,
  miniBossId: string,
  rng: () => number = Math.random,
  nowMs = Date.now()
): { world: WorldState; event: WorldEvent | null } {
  const target = world.pirates.find((p) => p.id === pirateId);
  if (!target || target.sailingToIslandId) {
    return { world, event: null };
  }

  const island = world.islands.find((i) => i.id === target.islandId) ?? world.islands[0];
  const activeWeather = getIslandWeather(island, world.day, world.minuteOfDay);
  const miniBoss = getMiniBossesForIsland(island).find((mb) => mb.id === miniBossId);
  if (!miniBoss) {
    return { world, event: null };
  }

  const mods = computeTraitModifiers(target);
  const timeLabel = formatClock(world.minuteOfDay);
  const playerPower = scorePirateCombatPower(target, rng, activeWeather);
  const won = playerPower >= miniBoss.power * 0.72;

  if (won) {
    const prevDefeated = target.defeatedMiniBossIds ?? [];
    const alreadyDefeated = prevDefeated.includes(miniBoss.id);
    const bountyGain = Math.round(
      (alreadyDefeated ? miniBoss.bountyReward * 0.25 : miniBoss.bountyReward) * mods.bountyMult
    );
    const xpGain = alreadyDefeated ? Math.round(miniBoss.xpReward * 0.5) : miniBoss.xpReward;
    const xpRes = awardXpToPirate(target, xpGain);
    const dropPool = miniBoss.dropPool && miniBoss.dropPool.length > 0
      ? miniBoss.dropPool
      : getBossDropPool(island);
    const dropRes = rollBossDrop(target, dropPool, 0.48, rng);

    const updated: Pirate = {
      ...xpRes.pirate,
      wins: xpRes.pirate.wins + 1,
      bounty: xpRes.pirate.bounty + bountyGain,
      berries: xpRes.pirate.berries + miniBoss.berriesReward + dropRes.bonusCoins,
      inventory: dropRes.nextInventory,
      islandSpot: miniBoss.zone,
      islandActivity: `Derrotó al subjefe ${miniBoss.name} en ${island.name}`,
      cooldownSec: 13,
      defeatedMiniBossIds: alreadyDefeated ? prevDefeated : [...prevDefeated, miniBoss.id],
    };

    const dropText = dropRes.droppedItem
      ? dropRes.isNew
        ? ` ¡Botín: ${dropRes.droppedItem.name}!`
        : ` (${dropRes.droppedItem.name} repetido → +2 monedones)`
      : '';
    const ev: WorldEvent = {
      id: `ev_${nowMs.toString(36)}_mbw_${Math.floor(rng() * 99999)}`,
      type: dropRes.droppedItem && dropRes.isNew ? 'drop' : 'boss',
      sea: island.sea,
      islandId: island.id,
      pirateId: updated.id,
      pirateName: updated.name,
      isPlayerRelated: updated.isPlayerOwned,
      message: `¡Subjefe derrotado en ${island.name}! ${updated.name} vence a ${miniBoss.name} (${miniBoss.title}) y suma +${formatShortBounty(bountyGain)}.${dropText}`,
      bountyDelta: bountyGain,
      day: world.day,
      timeLabel,
      createdAtMs: nowMs,
    };

    return {
      event: ev,
      world: {
        ...world,
        pirates: world.pirates.map((p) => (p.id === updated.id ? updated : p)),
        events: [ev, ...world.events].slice(0, 80),
        lastCameraFocusEventId: ev.id,
      },
    };
  }

  const xpRes = awardXpToPirate(target, 6);
  const updated: Pirate = {
    ...xpRes.pirate,
    losses: xpRes.pirate.losses + 1,
    islandSpot: miniBoss.zone,
    islandActivity: `Repuesto tras desafiar a ${miniBoss.name}`,
    cooldownSec: 14,
  };
  const ev: WorldEvent = {
    id: `ev_${nowMs.toString(36)}_mbl_${Math.floor(rng() * 99999)}`,
    type: 'boss',
    sea: island.sea,
    islandId: island.id,
    pirateId: updated.id,
    pirateName: updated.name,
    isPlayerRelated: updated.isPlayerOwned,
    message: `${updated.name} enfrenta al subjefe ${miniBoss.name} en ${island.name} y cae en combate (+6 XP para seguir entrenando).`,
    bountyDelta: 0,
    day: world.day,
    timeLabel,
    createdAtMs: nowMs,
  };

  return {
    event: ev,
    world: {
      ...world,
      pirates: world.pirates.map((p) => (p.id === updated.id ? updated : p)),
      events: [ev, ...world.events].slice(0, 80),
      lastCameraFocusEventId: ev.id,
    },
  };
}

const WANDER_SPOTS: IslandZoneId[] = ['taberna', 'dojo', 'ruinas', 'puerto'];

export function stepSimulation(
  world: WorldState,
  dtSimSeconds: number,
  rng: () => number = Math.random,
  nowMs = Date.now()
): { world: WorldState; newEvents: WorldEvent[] } {
  const dt = Math.max(0, Math.min(dtSimSeconds, 10));
  if (dt === 0) return { world, newEvents: [] };

  // World clock calibrated to 12 real hours = 1 in-game week (7 days)
  let minuteOfDay = world.minuteOfDay + dt * GAME_MINUTES_PER_REAL_SECOND;
  let day = world.day;
  while (minuteOfDay >= 1440) {
    minuteOfDay -= 1440;
    day += 1;
  }

  const timeLabel = formatClock(minuteOfDay);
  const newEvents: WorldEvent[] = [];
  let workingWorld: WorldState = {
    ...world,
    day,
    minuteOfDay,
    pirates: world.pirates.map((p) => ({ ...p })),
  };

  for (let i = 0; i < workingWorld.pirates.length; i++) {
    const p = workingWorld.pirates[i];
    const mods = computeTraitModifiers(p);
    const effectiveSpeed = Math.max(0.01, BASE_SAIL_SPEED * mods.speedMult);
    p.sailSpeed = Number(effectiveSpeed.toFixed(4));

    // Active sea voyage (sailing slowly via world center route)
    if (p.sailingToIslandId) {
      p.sailProgress += effectiveSpeed * dt;
      if (p.sailProgress >= 1) {
        const arrivedIsland =
          workingWorld.islands.find((isl) => isl.id === p.sailingToIslandId) ??
          workingWorld.islands[0];
        p.islandId = arrivedIsland.id;
        p.sailingToIslandId = null;
        p.sailProgress = 0;
        p.arrivedDay = day;
        p.islandSpot = 'puerto';
        p.islandActivity = `Recién llegado al puerto de ${arrivedIsland.name}`;
        p.cooldownSec = 10 + rng() * 6;

        const ev: WorldEvent = {
          id: `ev_${nowMs.toString(36)}_dock_${i}_${Math.floor(rng() * 99999)}`,
          type: 'dock',
          sea: arrivedIsland.sea,
          islandId: arrivedIsland.id,
          pirateId: p.id,
          pirateName: p.name,
          isPlayerRelated: p.isPlayerOwned,
          message: `${p.name} atraca en ${arrivedIsland.name} (${arrivedIsland.sea}).`,
          bountyDelta: 0,
          day,
          timeLabel,
          createdAtMs: nowMs,
        };
        newEvents.push(ev);
      }
      continue;
    }

    // Manual Mode: stop completely inside the island so player controls movement & missions
    if (p.manualMode || (p.status === 'resting' && p.directive === 'descansar')) {
      continue;
    }

    p.cooldownSec -= dt;
    if (p.cooldownSec > 0) continue;

    // Multi-day autonomous cadence inside the current island (characters stay & explore NPCs, mini-bosses, zones)
    p.cooldownSec = 10 + rng() * 8;
    const currentIsland =
      workingWorld.islands.find((isl) => isl.id === p.islandId) ?? workingWorld.islands[0];

    const pendingQuests = getNpcsForIsland(currentIsland).filter(
      (q) => !(p.completedQuestIds ?? []).includes(q.id)
    );
    const pendingMiniBosses = getMiniBossesForIsland(currentIsland).filter(
      (mb) => !(p.defeatedMiniBossIds ?? []).includes(mb.id)
    );

    const otherDocked = workingWorld.pirates.filter(
      (other) => other.id !== p.id && !other.sailingToIslandId && other.islandId === currentIsland.id
    );

    const roll = rng();
    if (pendingQuests.length > 0 && roll < 0.28) {
      const quest = pendingQuests[Math.floor(rng() * pendingQuests.length)];
      const res = runNpcQuest(workingWorld, p.id, quest.id, rng, nowMs);
      workingWorld = res.world;
      if (res.event) newEvents.push(res.event);
      continue;
    }

    if (pendingMiniBosses.length > 0 && roll >= 0.28 && roll < 0.4) {
      const mb = pendingMiniBosses[Math.floor(rng() * pendingMiniBosses.length)];
      const res = challengeMiniBoss(workingWorld, p.id, mb.id, rng, nowMs);
      workingWorld = res.world;
      if (res.event) newEvents.push(res.event);
      continue;
    }

    let missionToRun: IslandMissionId;
    if (otherDocked.length > 0 && roll < (p.directive === 'duelos' ? 0.65 : 0.52)) {
      missionToRun = 'duelo';
    } else if (roll < 0.68) {
      missionToRun = 'entrenar';
    } else if (roll < 0.88) {
      missionToRun = 'explorar';
    } else {
      missionToRun = 'taberna';
    }

    // Move autonomously to an island spot & execute the local island action
    const res = runIslandMission(workingWorld, p.id, missionToRun, rng, nowMs);
    workingWorld = res.world;
    if (res.event) {
      newEvents.push(res.event);
    } else {
      const nextSpot = WANDER_SPOTS[Math.floor(rng() * WANDER_SPOTS.length)];
      workingWorld = movePirateInIsland(workingWorld, p.id, nextSpot);
    }
  }

  return {
    newEvents,
    world: {
      ...workingWorld,
      day,
      minuteOfDay,
      lastCameraFocusEventId:
        newEvents.length > 0 ? newEvents[0].id : workingWorld.lastCameraFocusEventId,
    },
  };
}

export function getSeaBadgeColor(sea: SeaName): string {
  switch (sea) {
    case 'Mar del Este':
      return '#38bdf8';
    case 'Mar del Norte':
      return '#a78bfa';
    case 'Mar del Sur':
      return '#34d399';
    case 'Mar del Oeste':
      return '#fb923c';
    case 'Paraíso':
      return '#facc15';
    case 'Nuevo Mundo':
      return '#f43f5e';
  }
}
