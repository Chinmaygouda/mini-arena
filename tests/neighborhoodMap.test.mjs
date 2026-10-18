import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const map = JSON.parse(read('public/maps/neighborhood.json'));

test('Neighborhood map declares a playable 2v2 low-poly arena', () => {
  assert.equal(map.meta.name, 'Neighborhood District');
  assert.equal(map.meta.theme, 'neighborhood');
  assert.deepEqual(map.meta.size, [92, 92]);
  assert.match(map.meta.mode, /2v2/i);
});

test('Buildings are within map bounds and contain usable floors', () => {
  assert.ok(map.buildings.length >= 6, 'expected homes, apartments, and a market');
  for (const building of map.buildings) {
    assert.ok(building.id && building.name, 'every building has an id and name');
    assert.ok(building.floors.length >= 1, `${building.id} has at least one floor`);
    const [x, , z] = building.center;
    const [width, depth] = building.size;
    assert.ok(x - width / 2 >= -46 && x + width / 2 <= 46, `${building.id} fits X bounds`);
    assert.ok(z - depth / 2 >= -46 && z + depth / 2 <= 46, `${building.id} fits Z bounds`);
    for (const floor of building.floors) {
      assert.ok(floor.height >= 2.6, `${building.id} floor clear height`);
      for (const wall of floor.walls || []) {
        for (const door of wall.doors || []) {
          assert.ok(door.width >= 1.6 && door.height >= 2.2, `${building.id} exterior door dimensions`);
        }
      }
      for (const stair of floor.stairs || []) {
        assert.ok(stair.width >= 1.2, `${building.id}/${stair.id} stair width`);
        assert.ok(stair.stepRise <= 0.2, `${building.id}/${stair.id} step rise`);
        assert.ok(stair.stepCount > 0 && stair.targetFloorY !== undefined, `${building.id}/${stair.id} stair destination`);
      }
    }
  }
});

test('Maple House is the first detailed prototype; all other structures remain blockouts', () => {
  const maple = map.buildings.find((building) => building.id === 'home_south_west');
  assert.ok(maple, 'Maple House exists');
  assert.equal(maple.blockout, undefined, 'the first prototype is a real building');
  assert.equal(maple.roof.type, 'pitched', 'the first prototype uses a pitched roof');
  assert.equal(maple.floors.length, 2, 'the prototype has two floors');
  assert.deepEqual(maple.size, [12, 10], 'Maple House has a roomier 12m x 10m footprint');
  assert.equal(maple.floors[0].height, 3, 'ground floor has extra headroom');
  assert.equal(maple.floors[1].floorY, 3.2, 'upper floor aligns with the ground-floor slab');
  assert.ok(maple.floors.every((floor) => (floor.interiorWalls || []).length === 0),
    'both floors use open-plan circulation');
  const stair = maple.floors[0].stairs[0];
  assert.ok(stair.width >= 1.6 && stair.stepCount === 16 && stair.targetFloorY === 3.2,
    'stair run is wider and lands on the upper floor');
  assert.ok(maple.floors.every((floor) => floor.walls.flatMap((wall) => wall.windows)
    .every((window) => window.hasPlayerBlocker === false && window.sillHeight <= 0.6)),
    'house windows are configured for jump-through traversal');

  const unfinished = map.buildings.filter((building) => building.id !== 'home_south_west');
  assert.equal(unfinished.length, 6);
  assert.ok(unfinished.every((building) => building.blockout === true),
    'unfinished buildings must be visually represented as neutral blockouts');

  const detailIds = new Set(map.boxes.map((box) => box.id));
  for (const id of [
    'home_south_west_porch_canopy',
    'home_south_west_porch_column_l',
    'home_south_west_door_lintel',
    'home_south_west_belt_south',
  ]) assert.ok(detailIds.has(id), `Maple House detail exists: ${id}`);
  assert.ok(map.boxes.filter((box) => box.id.startsWith('home_south_west_') && box.kind === 'trim')
    .every((box) => box.collision === false), 'decorative trim must not add collision blockers');
});

test('Maple House balcony has a deliberate center opening for jumping off the terrace', () => {
  const boxes = new Map(map.boxes.map((box) => [box.id, box]));
  const deck = boxes.get('home_south_west_balcony_deck');
  const left = boxes.get('home_south_west_balcony_rail_outer_l');
  const right = boxes.get('home_south_west_balcony_rail_outer_r');
  assert.ok(deck && left && right, 'balcony deck and split outer rails exist');
  assert.ok(deck.size[0] >= 4.2 && deck.size[2] >= 2.2, 'terrace is spacious');
  const leftInner = left.center[0] + left.size[0] / 2;
  const rightInner = right.center[0] - right.size[0] / 2;
  assert.ok(rightInner - leftInner >= 1.8, 'the player can pass through the central jump-out gap');
  const porch = boxes.get('home_south_west_porch');
  const outerStep = boxes.get('home_south_west_porch_step_0');
  const middleStep = boxes.get('home_south_west_porch_step_1');
  const innerStep = boxes.get('home_south_west_porch_step_2');
  assert.ok(porch && outerStep && middleStep && innerStep, 'porch and three entrance steps exist');
  assert.ok(innerStep.center[2] < middleStep.center[2] && middleStep.center[2] < outerStep.center[2],
    'steps descend outward from the porch instead of rising away from the doorway');
  assert.ok(innerStep.center[1] + innerStep.size[1] / 2 >= middleStep.center[1] + middleStep.size[1] / 2 &&
    middleStep.center[1] + middleStep.size[1] / 2 >= outerStep.center[1] + outerStep.size[1] / 2,
    'the uppermost porch step is nearest the door');
});

test('2v2 bounds and perimeter blockers use the smaller playable footprint', () => {
  assert.deepEqual(map.meta.size, [92, 92]);
  assert.ok(map.invisiblePerimeters.every((p) =>
    p.minX >= -46 && p.maxX <= 46 && p.minZ >= -46 && p.maxZ <= 46));
  for (const box of map.boxes) {
    assert.ok(box.center[0] - box.size[0] / 2 >= -46 - 0.01, `${box.id} left bound`);
    assert.ok(box.center[0] + box.size[0] / 2 <= 46 + 0.01, `${box.id} right bound`);
    assert.ok(box.center[2] - box.size[2] / 2 >= -46 - 0.01, `${box.id} back bound`);
    assert.ok(box.center[2] + box.size[2] / 2 <= 46 + 0.01, `${box.id} front bound`);
  }
});

test('Maple House window jump lanes are clear of garden planters', () => {
  const house = map.buildings.find((building) => building.id === 'home_south_west');
  const south = house.floors[0].walls.find((wall) => wall.side === 'south');
  const leftWindowX = house.center[0] + south.windows.find((window) => window.offset < 0).offset;
  const rightWindowX = house.center[0] + south.windows.find((window) => window.offset > 0).offset;
  const boxes = new Map(map.boxes.map((box) => [box.id, box]));
  const westPlanter = boxes.get('home_south_west_planter_1');
  const eastPlanter = boxes.get('home_south_west_planter_2');
  assert.ok(westPlanter && eastPlanter, 'both front garden planters exist');
  assert.ok(westPlanter.center[0] + westPlanter.size[0] / 2 < leftWindowX - 0.35,
    'west planter clears the left window exit by at least one player radius');
  assert.ok(eastPlanter.center[0] - eastPlanter.size[0] / 2 > rightWindowX + 0.35,
    'east planter clears the right window exit by at least one player radius');
});

test('Map box identifiers are unique and team spawn markers exist at opposite ends', () => {
  const ids = map.boxes.map((box) => box.id);
  assert.equal(new Set(ids).size, ids.length, 'box ids must be unique');
  for (const id of ['spawn_A_flagpole_1', 'spawn_A_flag_1', 'spawn_B_flagpole_1', 'spawn_B_flag_1']) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
  const a = map.boxes.find((box) => box.id === 'spawn_A_flagpole_1');
  const b = map.boxes.find((box) => box.id === 'spawn_B_flagpole_1');
  assert.ok(a.center[2] < -35 && b.center[2] > 35, 'team markers must be at opposite ends');
  assert.equal(map.teamSpawns.teamA.length, 2, 'Team A has two reserved player slots for 2v2');
  assert.equal(map.teamSpawns.teamB.length, 2, 'Team B has two reserved player slots for 2v2');
});

test('Neighborhood has the core set dressing requested for the map', () => {
  const ids = new Set(map.boxes.map((box) => box.id));
  assert.ok([...ids].some((id) => id.includes('bus_body')), 'bus');
  assert.ok([...ids].some((id) => id.includes('bus_stop_roof')), 'bus shelter');
  assert.ok([...ids].some((id) => id.includes('parking_car_')), 'parking');
  assert.ok([...ids].some((id) => id.includes('playground') || id === 'play_platform'), 'playground');
  assert.ok(map.nature?.trees?.length >= 12, 'trees');
  assert.ok(map.nature.trees.every((tree) => tree.style === 'conifer'), 'neighborhood trees use the low-poly conifer style');
  assert.ok(map.perchedBirds?.length >= 6, 'ground/perched birds');
});

test('Neighborhood is registered in the loader, map selector, atmosphere, and bird hit handling', () => {
  const loader = read('src/environment/blueprintMapLoader.ts');
  const controls = read('src/player/firstPersonControls.ts');
  const hud = read('src/ui/fpsHUD.ts');
  const atmosphere = read('src/environment/atmosphereManager.ts');
  const targets = read('src/environment/targets.ts');

  assert.match(loader, /'neighborhood'\s*;/);
  assert.match(loader, /neighborhood:\s*\{\s*name:\s*'Neighborhood District',\s*file:\s*'\/maps\/neighborhood\.json'/);
  assert.match(loader, /private expandPerchedBird/);
  assert.match(loader, /private expandBlockoutBuilding/);
  assert.match(loader, /unfinishedStandaloneBoxIds/);
  assert.match(loader, /market_sign_panel/);
  assert.match(loader, /bldg\.roof\.type === 'pitched'/);
  assert.match(loader, /const outerRoadAxis = 33/);
  assert.match(loader, /const innerRoadAxis = 16/);
  assert.match(loader, /const isPitchedRoofCeiling/);
  assert.match(loader, /box\.collision !== false/);
  assert.match(loader, /op\.hasPlayerBlocker !== false/);
  assert.match(loader, /stepCount: count/);
  assert.match(loader, /sideClearance = 0\.35/);
  assert.match(controls, /stepRise\?: number/);
  assert.match(controls, /Math\.floor\(progress \+ 0\.5\)/);
  assert.match(controls, /if \(c\.ramp\) continue/);
  assert.match(hud, /'neighborhood'\]/);
  assert.match(atmosphere, /mapId === 'neighborhood'\s*\?\s*'suburban'/);
  assert.match(targets, /targetType: 'bird'/);
  assert.match(targets, /node\.visible = false/);
});
