import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_SAIL_SPEED,
  GAME_MINUTES_PER_REAL_SECOND,
  IN_GAME_DAYS_PER_12_REAL_HOURS,
  challengeMiniBoss,
  computePirateStats,
  computeTraitModifiers,
  computeWeatherDebuff,
  createInitialWorld,
  createSeededRng,
  equipPirateItem,
  formatBounty,
  formatClock,
  getCharacterSpriteScale,
  getEquippedItems,
  getIslandWeather,
  getNavigationPathCoords,
  getPiratePositionXYZ,
  getWeekAndDay,
  latLonToXYZ,
  removePirateFromWorld,
  runIslandMission,
  runNpcQuest,
  setPirateManualMode,
  slerpUnitVec,
  spawnPlayerPirate,
  startPirateVoyage,
  stepSimulation,
  unequipPirateSlot,
  updatePirateBuild,
  updatePirateCrew,
  updatePirateProfile,
  validateCreatePirateInput,
} from './sim';
import {
  ACCESSORY_OPTIONS,
  CAPE_OPTIONS,
  GRAND_LINE_ISLANDS,
  HAIR_STYLES,
  HAT_OPTIONS,
  ITEM_COLOR_CYCLE,
  MENTAL_TRAITS,
  NAMED_ISLAND_BOSSES,
  OUTFIT_STYLES,
  PHYSICAL_TRAITS,
  RACE_OPTIONS,
  WEATHER_METADATA,
  getBossForIsland,
  getEquipmentItem,
  getIslandRecommendedDays,
  getMiniBossesForIsland,
  getNextCycleColor,
  getNpcsForIsland,
} from './worldData';
import {
  PIXEL_SPRITE_H,
  PIXEL_SPRITE_W,
  buildPirateSpriteRuns,
} from './pixelSprite';

test('latLonToXYZ places coordinates accurately on the unit sphere', () => {
  const [x, y, z] = latLonToXYZ(0, 0, 1);
  assert.ok(Math.abs(x - 0) < 1e-6);
  assert.ok(Math.abs(y - 0) < 1e-6);
  assert.ok(Math.abs(z - 1) < 1e-6);

  const [nx, ny, nz] = latLonToXYZ(34, 55, 10);
  const len = Math.hypot(nx, ny, nz);
  assert.ok(Math.abs(len - 10) < 1e-5);
});

test('slerpUnitVec interpolates smoothly on sphere surface', () => {
  const a = latLonToXYZ(0, 0, 1);
  const b = latLonToXYZ(0, 90, 1);
  const mid = slerpUnitVec(a, b, 0.5);
  const len = Math.hypot(mid[0], mid[1], mid[2]);
  assert.ok(Math.abs(len - 1) < 1e-6);
  assert.ok(Math.abs(mid[0] - mid[2]) < 1e-5);
});

test('getNavigationPathCoords routes cross-world voyages through the center (0, 0)', () => {
  const dawn = GRAND_LINE_ISLANDS.find((i) => i.id === 'isla-dawn')!;
  const germa = GRAND_LINE_ISLANDS.find((i) => i.id === 'reino-germa')!;
  const torino = GRAND_LINE_ISLANDS.find((i) => i.id === 'reino-torino')!;
  const wano = GRAND_LINE_ISLANDS.find((i) => i.id === 'pais-de-wano')!;

  const eastToNorth = getNavigationPathCoords(dawn, germa);
  assert.ok(
    eastToNorth.some(([lat, lon]) => lat === 0 && lon === 0),
    'Mar del Este -> Mar del Norte must pass through world center (0, 0)'
  );

  const eastToSouth = getNavigationPathCoords(dawn, torino);
  assert.ok(
    eastToSouth.some(([lat, lon]) => lat === 0 && lon === 0),
    'Mar del Este -> Mar del Sur must pass through world center (0, 0)'
  );

  const eastToWano = getNavigationPathCoords(dawn, wano);
  assert.ok(
    eastToWano.some(([lat, lon]) => lat === 0 && lon === 0),
    'Mar del Este -> Nuevo Mundo must route through world center (0, 0)'
  );

  const goat = GRAND_LINE_ISLANDS.find((i) => i.id === 'isla-goat')!;
  const sameSea = getNavigationPathCoords(dawn, goat);
  assert.equal(sameSea.length, 2);
});

test('formatBounty and formatClock format numbers consistently', () => {
  assert.equal(formatBounty(500000), '฿ 500,000');
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(1155), '19:15');
});

test('createInitialWorld starts with zero bot pirates and excludes Laugh Tale', () => {
  const world = createInitialWorld();
  assert.equal(world.pirates.length, 0);
  assert.equal(world.totalPiratesCount, 0);
  assert.equal(world.events.length, 0);
  assert.equal(
    world.islands.some((isl) => isl.id === 'laugh-tale' || isl.name.toLowerCase().includes('laugh tale')),
    false
  );
});

test('physical and mental traits have 9 options each (3 rows) with explicit advantages and disadvantages', () => {
  assert.equal(PHYSICAL_TRAITS.length, 9);
  assert.equal(MENTAL_TRAITS.length, 9);
  for (const trait of [...PHYSICAL_TRAITS, ...MENTAL_TRAITS]) {
    assert.ok(trait.advantage.length > 5);
    assert.ok(trait.disadvantage.length > 5);
  }
});

test('computeTraitModifiers and computePirateStats derive 4 balanced RPG stats', () => {
  const initial = createInitialWorld();
  const res = spawnPlayerPirate(initial, {
    name: 'Gonsa',
    epithet: 'El Bravo',
    faction: 'piratas',
    originSea: 'Mar del Norte',
    dream: 'Navegar por todo el Grand Line',
    physicalTraits: ['fuerte', 'rapido'],
    mentalTraits: ['astuto'],
    bodyBuild: 'normal',
  });
  const stats = computePirateStats(res.pirate);
  assert.ok(stats.fuerza > 5);
  assert.ok(stats.agilidad > 5);
  assert.ok(stats.aguante >= 5);
  assert.ok(stats.ingenio > 5);

  const swift = computeTraitModifiers({
    physicalTraits: ['zancada_gigante'],
    mentalTraits: ['navegante_nato'],
  });
  assert.ok(swift.speedMult > 1.4);
});

test('validateCreatePirateInput requires valid name and 1-2 physical and mental traits', () => {
  const badName = validateCreatePirateInput({
    name: 'A',
    epithet: 'El Rápido',
    faction: 'piratas',
    originSea: 'Mar del Este',
    dream: 'Ser libre',
    physicalTraits: ['fuerte', 'rapido'],
    mentalTraits: ['astuto'],
  });
  assert.ok(badName !== null);

  const missingTraits = validateCreatePirateInput({
    name: 'Monkey D. Mateo',
    epithet: 'El Corsario',
    faction: 'revolucionarios',
    originSea: 'Mar del Este',
    dream: 'Ser libre',
    physicalTraits: [],
    mentalTraits: ['astuto'],
  });
  assert.ok(missingTraits !== null);
});

test('spawnPlayerPirate starts inside island with slow sail speed, manualMode false, and removePirateFromWorld deletes it', () => {
  const initial = createInitialWorld();
  const res = spawnPlayerPirate(initial, {
    name: 'Sabo Llama',
    epithet: 'Jefe de Estado Mayor',
    faction: 'revolucionarios',
    originSea: 'Mar del Norte',
    dream: 'Cambiar el mundo entero.',
    physicalTraits: ['cuerpo_ferreo', 'pulmones_profundos'],
    mentalTraits: ['temerario', 'sangre_fria'],
  });

  assert.equal(res.world.totalPiratesCount, 1);
  assert.equal(res.pirate.faction, 'revolucionarios');
  assert.equal(res.pirate.crewName, 'Sin tripulación');
  assert.equal(res.pirate.level, 1);
  assert.equal(res.pirate.manualMode, false);
  assert.ok(res.pirate.sailSpeed <= BASE_SAIL_SPEED * 1.65);

  const crewRes = updatePirateCrew(res.world, res.pirate.id, {
    crewName: 'Ejército del Alba',
    role: 'Espadachín',
    flagColor: '#0d9488',
  });
  assert.equal(crewRes.pirate?.crewName, 'Ejército del Alba');

  const afterDelete = removePirateFromWorld(crewRes.world, res.pirate.id);
  assert.equal(afterDelete.pirates.length, 0);
});

test('characters stay inside their island, manualMode stops autonomous actions, and bounty grows via Bosses/PvP', () => {
  const initial = createInitialWorld();
  const { world: withPlayer, pirate } = spawnPlayerPirate(initial, {
    name: 'Ace Fuego',
    epithet: 'Puño de Fuego',
    faction: 'piratas',
    originSea: 'Mar del Este',
    dream: 'Ser el rey',
    physicalTraits: ['fuerte', 'golpe_demoledor'],
    mentalTraits: ['instinto_haki', 'estratega'],
  });

  const startIslandId = pirate.islandId;
  let world = withPlayer;
  const rng = createSeededRng(12345);

  // Autonomous ticks stay inside the same island (no auto departure)
  for (let tick = 0; tick < 25; tick++) {
    world = stepSimulation(world, 1.0, rng, 1700000000000 + tick * 1000).world;
  }
  const pAfterAuto = world.pirates[0];
  assert.equal(pAfterAuto.islandId, startIslandId);
  assert.equal(pAfterAuto.sailingToIslandId, null);

  // Manual mode prevents autonomous events and movement inside the island
  world = setPirateManualMode(world, pirate.id, true);
  const manualCountBefore = world.events.length;
  const spotBefore = world.pirates[0].islandSpot;
  for (let tick = 0; tick < 30; tick++) {
    const out = stepSimulation(world, 1.0, rng, 1700000100000 + tick * 1000);
    world = out.world;
    assert.equal(out.newEvents.length, 0);
  }
  assert.equal(world.events.length, manualCountBefore);
  assert.equal(world.pirates[0].islandSpot, spotBefore);

  // Exploration mission grants XP + berries but zero bounty
  const bountyBeforeExplore = world.pirates[0].bounty;
  const exploreRes = runIslandMission(world, pirate.id, 'explorar', createSeededRng(7));
  assert.equal(exploreRes.world.pirates[0].bounty, bountyBeforeExplore);
  assert.ok(exploreRes.world.pirates[0].berries > world.pirates[0].berries);

  // Boss mission is the primary bounty source
  const bossRes = runIslandMission(exploreRes.world, pirate.id, 'jefe', createSeededRng(99));
  assert.ok(bossRes.world.pirates[0].bounty > bountyBeforeExplore);
  assert.ok(bossRes.world.pirates[0].bossesDefeated >= 1);

  // Explicit center-routed voyage moves slowly and routes across center
  const voy = startPirateVoyage(bossRes.world, pirate.id, 'reino-germa');
  assert.equal(voy.started, true);
  assert.equal(voy.world.pirates[0].sailingToIslandId, 'reino-germa');
  const midPos = getPiratePositionXYZ(
    { ...voy.world.pirates[0], sailProgress: 0.5 },
    voy.world.islands,
    5
  );
  assert.ok(Math.abs(Math.hypot(midPos[0], midPos[1], midPos[2]) - 5) < 1e-4);

  const beforeBody = bossRes.world.pirates[0].bodyBuild;
  const beforeSkin = bossRes.world.pirates[0].skinTone;
  const beforeHairStyle = bossRes.world.pirates[0].hairStyle;
  const beforeHairColor = bossRes.world.pirates[0].hairColor;
  const beforeRace = bossRes.world.pirates[0].race;

  const editRes = updatePirateProfile(bossRes.world, pirate.id, {
    name: 'Ace Editado',
    epithet: 'Espadachín Carmesí',
    faction: 'aventureros',
    role: 'Espadachín',
    originSea: 'Mar del Sur',
    dream: 'Dominar los Siete Mares',
    physicalTraits: ['zancada_gigante'],
    mentalTraits: ['navegante_nato'],
    race: 'lunaria',
    hatStyle: 'tricorn',
    skinTone: '#daa16a',
    hairStyle: 'long',
    hairColor: '#15803d',
    bodyBuild: 'robust',
    outfitStyle: 'kimono',
    outfitColor: '#15803d',
    accessory: 'scar',
  });
  assert.equal(editRes.pirate?.name, 'Ace Editado');
  assert.equal(editRes.pirate?.role, 'Espadachín');
  assert.equal(editRes.pirate?.race, beforeRace);
  assert.equal(editRes.pirate?.hairStyle, beforeHairStyle);
  assert.equal(editRes.pirate?.hairColor, beforeHairColor);
  assert.equal(editRes.pirate?.skinTone, beforeSkin);
  assert.equal(editRes.pirate?.bodyBuild, beforeBody);
  assert.equal(editRes.pirate?.hatStyle, 'tricorn');
  assert.equal(editRes.pirate?.outfitStyle, 'kimono');
  assert.equal(editRes.pirate?.outfitColor, '#15803d');
  assert.equal(editRes.pirate?.accessory, 'scar');
  assert.equal(editRes.pirate?.bounty, bossRes.world.pirates[0].bounty);
  assert.ok((editRes.pirate?.sailSpeed ?? 0) > BASE_SAIL_SPEED * 1.4);
});

test('12 real hours equal exactly 1 in-game week (7 days)', () => {
  assert.equal(IN_GAME_DAYS_PER_12_REAL_HOURS, 7);
  assert.ok(Math.abs(GAME_MINUTES_PER_REAL_SECOND - 7 / 30) < 1e-9);

  let world = createInitialWorld();
  const startDay = world.day;
  const startMinute = world.minuteOfDay;
  const rng = createSeededRng(42);

  // Simulate 12 real hours = 43,200 seconds using 4,320 steps of 10s
  for (let i = 0; i < 4320; i++) {
    world = stepSimulation(world, 10, rng, 1700000000000 + i * 10000).world;
  }

  assert.equal(world.day - startDay, 7);
  assert.ok(Math.abs(world.minuteOfDay - startMinute) < 1e-4);
  assert.deepEqual(getWeekAndDay(1), { week: 1, dayOfWeek: 1 });
  assert.deepEqual(getWeekAndDay(7), { week: 1, dayOfWeek: 7 });
  assert.deepEqual(getWeekAndDay(8), { week: 2, dayOfWeek: 1 });
});

test('islands follow canon progression order, canon relative sizes, and scale NPC/mini-boss life', () => {
  for (let i = 1; i < GRAND_LINE_ISLANDS.length; i++) {
    const prev = GRAND_LINE_ISLANDS[i - 1];
    const curr = GRAND_LINE_ISLANDS[i];
    assert.ok(
      (curr.canonOrder ?? 0) > (prev.canonOrder ?? 0),
      `${curr.id} must follow ${prev.id} in canon order`
    );
  }

  const goat = GRAND_LINE_ISLANDS.find((i) => i.id === 'isla-goat')!;
  const dawn = GRAND_LINE_ISLANDS.find((i) => i.id === 'isla-dawn')!;
  const arabasta = GRAND_LINE_ISLANDS.find((i) => i.id === 'reino-arabasta')!;
  const wano = GRAND_LINE_ISLANDS.find((i) => i.id === 'pais-de-wano')!;
  const elbaph = GRAND_LINE_ISLANDS.find((i) => i.id === 'elbaph')!;

  assert.ok((elbaph.scale ?? 1) > (wano.scale ?? 1));
  assert.ok((wano.scale ?? 1) > (dawn.scale ?? 1));
  assert.ok((dawn.scale ?? 1) > (goat.scale ?? 1));
  assert.ok((arabasta.scale ?? 1) >= 2.2);

  const elbaphNpcs = getNpcsForIsland(elbaph);
  const elbaphMiniBosses = getMiniBossesForIsland(elbaph);
  const goatNpcs = getNpcsForIsland(goat);
  const goatMiniBosses = getMiniBossesForIsland(goat);

  assert.equal(elbaphNpcs.length, 6);
  assert.equal(elbaphMiniBosses.length, 3);
  assert.ok(goatNpcs.length < elbaphNpcs.length);
  assert.ok(goatMiniBosses.length < elbaphMiniBosses.length);
  assert.ok(getIslandRecommendedDays(elbaph) >= 10);
  assert.ok(getIslandRecommendedDays(goat) <= 3);
});

test('NPC quests and Mini-Boss challenges grant rewards, track completion, and update arrivedDay on arrival', () => {
  const initial = createInitialWorld();
  const { world: withPlayer, pirate } = spawnPlayerPirate(initial, {
    name: 'Hajime',
    epithet: 'El Explorador',
    faction: 'piratas',
    originSea: 'Mar del Este',
    dream: 'Desafiar a Elbaph',
    physicalTraits: ['fuerte', 'cuerpo_ferreo'],
    mentalTraits: ['instinto_haki', 'estratega'],
  });

  const dawn = withPlayer.islands.find((i) => i.id === pirate.islandId)!;
  const dawnNpcs = getNpcsForIsland(dawn);
  const dawnMiniBosses = getMiniBossesForIsland(dawn);
  assert.ok(dawnNpcs.length > 0);
  assert.ok(dawnMiniBosses.length > 0);

  const qRes = runNpcQuest(withPlayer, pirate.id, dawnNpcs[0].id, createSeededRng(10));
  assert.ok(qRes.event !== null);
  assert.ok((qRes.world.pirates[0].completedQuestIds ?? []).includes(dawnNpcs[0].id));
  assert.ok(qRes.world.pirates[0].xp > 0 || qRes.world.pirates[0].level > 1);

  const mbRes = challengeMiniBoss(qRes.world, pirate.id, dawnMiniBosses[0].id, createSeededRng(12));
  assert.ok(mbRes.event !== null);
  assert.ok(mbRes.world.pirates[0].bounty > qRes.world.pirates[0].bounty);
  assert.ok((mbRes.world.pirates[0].defeatedMiniBossIds ?? []).includes(dawnMiniBosses[0].id));

  // Advance day before arriving on Elbaph and check arrivedDay tracks new arrival day
  let world = { ...mbRes.world, day: 5, minuteOfDay: 600 };
  world = startPirateVoyage(world, pirate.id, 'elbaph').world;
  const rng = createSeededRng(55);
  for (let t = 0; t < 20; t++) {
    world = stepSimulation(world, 6, rng, 1700000500000 + t * 6000).world;
    if (!world.pirates[0].sailingToIslandId) break;
  }
  assert.equal(world.pirates[0].islandId, 'elbaph');
  assert.equal(world.pirates[0].arrivedDay, world.day);
});

test('buildPirateSpriteRuns generates crisp bounded 22x24 chibi pixel runs', () => {
  const runs = buildPirateSpriteRuns({
    name: 'Enriquillo',
    flagColor: '#dc2626',
    hatStyle: 'straw',
    skinTone: '#ffd6b0',
    hairStyle: 'spiky',
    hairColor: '#1e1b18',
    bodyBuild: 'normal',
    outfitStyle: 'coat',
    outfitColor: '#dc2626',
    accessory: 'scar',
  });
  assert.ok(runs.length > 35);
  for (const r of runs) {
    assert.ok(r.x >= 0 && r.x + r.w <= PIXEL_SPRITE_W);
    assert.ok(r.y >= 0 && r.y < PIXEL_SPRITE_H);
    assert.ok(r.fill.startsWith('#'));
  }
});

test('regional weather applies debuffs to Devil Fruit users and rain boost to fruit-free Gyojin', () => {
  const initial = createInitialWorld();
  const { pirate } = spawnPlayerPirate(initial, {
    name: 'Luffy Test',
    epithet: 'Goma',
    faction: 'piratas',
    originSea: 'Mar del Este',
    dream: 'Ser Rey Pirata',
    race: 'humano',
    physicalTraits: ['fuerte', 'rapido'],
    mentalTraits: ['astuto'],
  });

  const fruitPirate = { ...pirate, devilFruit: 'Gomu Gomu no Mi' };
  const clearStats = computePirateStats(fruitPirate, WEATHER_METADATA.despejado);
  const rainDebuff = computeWeatherDebuff(WEATHER_METADATA.lluvia, fruitPirate);
  const rainStats = computePirateStats(fruitPirate, WEATHER_METADATA.lluvia);
  const stormStats = computePirateStats(fruitPirate, WEATHER_METADATA.tormenta);

  assert.equal(rainDebuff.active, true);
  assert.equal(rainDebuff.fuerzaDelta, -3);
  assert.equal(rainDebuff.agilidadDelta, -2);
  assert.equal(rainStats.fuerza, clearStats.fuerza - 3);
  assert.equal(rainStats.agilidad, clearStats.agilidad - 2);
  assert.ok(stormStats.fuerza < rainStats.fuerza);

  const gyojinPirate = { ...pirate, race: 'gyojin' as const, devilFruit: '' };
  const gyojinClear = computePirateStats(gyojinPirate, WEATHER_METADATA.despejado);
  const gyojinRain = computePirateStats(gyojinPirate, WEATHER_METADATA.lluvia);
  assert.equal(gyojinRain.fuerza, gyojinClear.fuerza + 1);
  assert.equal(gyojinRain.agilidad, gyojinClear.agilidad + 1);

  const dawn = GRAND_LINE_ISLANDS.find((i) => i.id === 'isla-dawn')!;
  const weather = getIslandWeather(dawn, 1, 720);
  assert.ok(weather.type in WEATHER_METADATA);
});

test('defeating bosses/mini-bosses drops equipment that can be equipped and unequipped', () => {
  let world = createInitialWorld();
  const spawn = spawnPlayerPirate(world, {
    name: 'Zoro Drops',
    epithet: 'Cazador',
    faction: 'piratas',
    originSea: 'Mar del Este',
    dream: 'Espadachín supremo',
    race: 'oni',
    physicalTraits: ['golpe_demoledor', 'cuerpo_ferreo'],
    mentalTraits: ['instinto_haki', 'estratega'],
  });
  world = spawn.world;
  const pid = spawn.pirate.id;

  // Boost level to ensure boss victory and roll drops
  world = {
    ...world,
    pirates: world.pirates.map((p) => (p.id === pid ? { ...p, level: 25 } : p)),
  };

  for (let i = 0; i < 8; i++) {
    world = runIslandMission(world, pid, 'jefe', createSeededRng(100 + i)).world;
    if ((world.pirates[0].inventory ?? []).length > 0) break;
  }

  const looted = world.pirates[0];
  assert.ok((looted.inventory ?? []).length >= 1, 'Boss victories must award at least 1 drop');
  const itemId = (looted.inventory ?? [])[0];
  const item = getEquipmentItem(itemId)!;
  assert.ok(item);

  const statsBefore = computePirateStats(looted);
  const eqRes = equipPirateItem(world, pid, itemId);
  assert.equal(eqRes.pirate?.equipped?.[item.slot], itemId);
  assert.equal(getEquippedItems(eqRes.pirate?.equipped).length, 1);

  const statsAfter = computePirateStats(eqRes.pirate!);
  const totalBefore = statsBefore.fuerza + statsBefore.agilidad + statsBefore.aguante + statsBefore.ingenio;
  const totalAfter = statsAfter.fuerza + statsAfter.agilidad + statsAfter.aguante + statsAfter.ingenio;
  assert.ok(totalAfter > totalBefore, 'Equipping loot must increase RPG stats');

  const unEqRes = unequipPirateSlot(eqRes.world, pid, item.slot);
  assert.equal(unEqRes.pirate?.equipped?.[item.slot], null);
  assert.equal(getEquippedItems(unEqRes.pirate?.equipped).length, 0);
});

test('updatePirateBuild edits clothes/scars only, RACE_OPTIONS has 7 races (oni & gigante separate), and getCharacterSpriteScale scales giants and Elbaph visitors', () => {
  const initial = createInitialWorld();
  const { world, pirate } = spawnPlayerPirate(initial, {
    name: 'Nami Build',
    epithet: 'Tormenta',
    faction: 'aventureros',
    originSea: 'Mar del Este',
    dream: 'Cartografiar el mundo',
    race: 'skypiea',
    hairStyle: 'ponytail',
    physicalTraits: ['rapido'],
    mentalTraits: ['navegante_nato'],
  });

  const buildRes = updatePirateBuild(world, pirate.id, {
    hatStyle: 'tricorn',
    accessory: 'scar',
    outfitStyle: 'kimono',
    outfitColor: '#15803d',
  });
  assert.equal(buildRes.pirate?.race, 'skypiea');
  assert.equal(buildRes.pirate?.hairStyle, 'ponytail');
  assert.equal(buildRes.pirate?.hatStyle, 'tricorn');
  assert.equal(buildRes.pirate?.accessory, 'scar');
  assert.equal(buildRes.pirate?.outfitStyle, 'kimono');
  assert.equal(buildRes.pirate?.outfitColor, '#15803d');

  assert.equal(HAIR_STYLES.length, 11);
  assert.equal(RACE_OPTIONS.length, 7);
  assert.ok(RACE_OPTIONS.some((r) => r.id === 'oni'));
  assert.ok(RACE_OPTIONS.some((r) => r.id === 'gigante'));

  assert.ok(
    getCharacterSpriteScale('gigante', 'isla-dawn') >
      getCharacterSpriteScale('humano', 'isla-dawn') * 1.5
  );
  assert.ok(getCharacterSpriteScale('humano', 'elbaph') < 1.0);
  assert.ok(
    getCharacterSpriteScale('gigante', 'elbaph') >
      getCharacterSpriteScale('humano', 'elbaph') * 2.0
  );

  for (const race of RACE_OPTIONS) {
    for (const hair of HAIR_STYLES) {
      const runs = buildPirateSpriteRuns({
        name: `${race.id}-${hair.id}`,
        flagColor: '#dc2626',
        race: race.id,
        hatStyle: 'none',
        skinTone: '#ffd6b0',
        hairStyle: hair.id,
        hairColor: '#1e1b18',
        bodyBuild: 'normal',
        outfitStyle: 'coat',
        outfitColor: '#2563eb',
        accessory: 'scar',
        hasEquippedWeapon: true,
      });
      assert.ok(runs.length > 35, `Expected runs for ${race.id} + ${hair.id}`);
      for (const r of runs) {
        assert.ok(r.x >= 0 && r.x + r.w <= PIXEL_SPRITE_W);
        assert.ok(r.y >= 0 && r.y < PIXEL_SPRITE_H);
      }
    }
  }
});

test('canon One Piece bosses, mini-bosses, and equipment drops cover all 55 islands', () => {
  assert.equal(GRAND_LINE_ISLANDS.length, 55);
  for (const isl of GRAND_LINE_ISLANDS) {
    assert.ok(
      NAMED_ISLAND_BOSSES[isl.id],
      `Island ${isl.id} must have a canon entry in NAMED_ISLAND_BOSSES`
    );
    const boss = getBossForIsland(isl);
    assert.ok(boss.name.length > 2);
    for (const dropId of boss.dropPool ?? []) {
      assert.ok(
        getEquipmentItem(dropId),
        `Boss drop "${dropId}" on ${isl.id} must exist in EQUIPMENT_CATALOG`
      );
    }

    const mbs = getMiniBossesForIsland(isl);
    for (const mb of mbs) {
      for (const dropId of mb.dropPool ?? []) {
        assert.ok(
          getEquipmentItem(dropId),
          `Mini-boss drop "${dropId}" on ${isl.id} must exist in EQUIPMENT_CATALOG`
        );
      }
    }
  }

  // Spot-check key canon One Piece arc bosses & mini-bosses
  const arabasta = GRAND_LINE_ISLANDS.find((i) => i.id === 'reino-arabasta')!;
  const croc = getBossForIsland(arabasta);
  assert.ok(croc.name.includes('Crocodile'));
  assert.equal(croc.hairStyle, 'slick');
  assert.equal(croc.outfitStyle, 'striped');
  assert.equal(croc.outfitColor, '#f97316');
  assert.equal(croc.capeStyle, 'coat_cape');
  assert.equal(croc.capeColor, '#15803d');
  assert.equal(croc.weaponStyle, 'hook');
  const arabastaMbs = getMiniBossesForIsland(arabasta);
  assert.ok(arabastaMbs.some((m) => m.name.includes('Daz Bones') || m.name.includes('Mr. 1')));
  assert.ok(arabastaMbs.some((m) => m.name.includes('Bon Clay') || m.name.includes('Mr. 2')));

  const totto = GRAND_LINE_ISLANDS.find((i) => i.id === 'totto-land')!;
  const bigMom = getBossForIsland(totto);
  assert.ok(bigMom.name.includes('Big Mom') || bigMom.name.includes('Linlin'));
  const tottoMbs = getMiniBossesForIsland(totto);
  assert.ok(tottoMbs.some((m) => m.name.includes('Katakuri')));

  const wano = GRAND_LINE_ISLANDS.find((i) => i.id === 'pais-de-wano')!;
  assert.ok(getBossForIsland(wano).name.includes('Orochi'));
  const onigashima = GRAND_LINE_ISLANDS.find((i) => i.id === 'onigashima')!;
  assert.ok(getBossForIsland(onigashima).name.includes('Kaido'));
});

test('expanded outfits, capes, hats, accessories, weapons, and re-click color cycling produce valid bounded sprites and persist', () => {
  for (const hat of HAT_OPTIONS) {
    for (const outfit of OUTFIT_STYLES) {
      const runs = buildPirateSpriteRuns({
        name: `Test-${hat.id}-${outfit.id}`,
        flagColor: '#dc2626',
        hatStyle: hat.id,
        hatColor: ITEM_COLOR_CYCLE[2].hex,
        outfitStyle: outfit.id,
        outfitColor: '#f97316',
        capeStyle: 'coat_cape',
        capeColor: '#15803d',
        accessory: 'cigar',
        accessoryColor: '#facc15',
        weaponStyle: 'hook',
        hasEquippedWeapon: true,
      });
      assert.ok(runs.length > 30);
      for (const r of runs) {
        assert.ok(r.x >= 0 && r.x + r.w <= PIXEL_SPRITE_W);
        assert.ok(r.y >= 0 && r.y < PIXEL_SPRITE_H);
      }
    }
  }

  for (const cape of CAPE_OPTIONS) {
    for (const acc of ACCESSORY_OPTIONS) {
      const runs = buildPirateSpriteRuns({
        name: `Test-${cape.id}-${acc.id}`,
        flagColor: '#1d4ed8',
        hatStyle: 'bicorn',
        hatColor: '#be123c',
        capeStyle: cape.id,
        capeColor: '#7e22ce',
        accessory: acc.id,
        accessoryColor: '#06b6d4',
        weaponStyle: 'kanabo',
      });
      assert.ok(runs.length > 30);
      for (const r of runs) {
        assert.ok(r.x >= 0 && r.x + r.w <= PIXEL_SPRITE_W);
        assert.ok(r.y >= 0 && r.y < PIXEL_SPRITE_H);
      }
    }
  }

  // Re-click color cycling changes color deterministically and shifts sprite output
  const firstColor = ITEM_COLOR_CYCLE[0].hex;
  const nextColor = getNextCycleColor(firstColor, firstColor);
  assert.notEqual(nextColor, firstColor);
  const runsA = buildPirateSpriteRuns({
    name: 'ColorCycle',
    flagColor: '#dc2626',
    hatStyle: 'tophat',
    hatColor: firstColor,
    capeStyle: 'cape',
    capeColor: firstColor,
    accessory: 'glasses',
    accessoryColor: firstColor,
  });
  const runsB = buildPirateSpriteRuns({
    name: 'ColorCycle',
    flagColor: '#dc2626',
    hatStyle: 'tophat',
    hatColor: nextColor,
    capeStyle: 'cape',
    capeColor: nextColor,
    accessory: 'glasses',
    accessoryColor: nextColor,
  });
  assert.notDeepEqual(runsA, runsB);

  // updatePirateBuild persists capes & item colors and clears them when toggled back to none
  const initial = createInitialWorld();
  const { world, pirate } = spawnPlayerPirate(initial, {
    name: 'Croc Custom',
    epithet: 'Sir',
    faction: 'piratas',
    originSea: 'Mar del Este',
    dream: 'Reinar el desierto',
    race: 'humano',
    hairStyle: 'slick',
    physicalTraits: ['fuerte'],
    mentalTraits: ['estratega'],
    hatStyle: 'tophat',
    hatColor: '#1e293b',
    capeStyle: 'coat_cape',
    capeColor: '#15803d',
    accessory: 'scar',
    accessoryColor: '#b91c1c',
  });
  assert.equal(pirate.capeStyle, 'coat_cape');
  assert.equal(pirate.capeColor, '#15803d');
  assert.equal(pirate.hatColor, '#1e293b');
  assert.equal(pirate.accessoryColor, '#b91c1c');

  const cycled = updatePirateBuild(world, pirate.id, {
    capeColor: '#facc15',
    hatColor: '#dc2626',
    accessoryColor: '#06b6d4',
  });
  assert.equal(cycled.pirate?.capeColor, '#facc15');
  assert.equal(cycled.pirate?.hatColor, '#dc2626');
  assert.equal(cycled.pirate?.accessoryColor, '#06b6d4');
  assert.equal(cycled.pirate?.race, 'humano');
  assert.equal(cycled.pirate?.hairStyle, 'slick');

  const cleared = updatePirateBuild(cycled.world, pirate.id, {
    capeStyle: 'none',
    capeColor: undefined,
    hatStyle: 'none',
    hatColor: undefined,
    accessory: 'none',
    accessoryColor: undefined,
  });
  assert.equal(cleared.pirate?.capeStyle, 'none');
  assert.equal(cleared.pirate?.capeColor, undefined);
  assert.equal(cleared.pirate?.hatStyle, 'none');
  assert.equal(cleared.pirate?.hatColor, undefined);
  assert.equal(cleared.pirate?.accessory, 'none');
  assert.equal(cleared.pirate?.accessoryColor, undefined);
});

