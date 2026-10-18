import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const map = JSON.parse(read('public/maps/neighborhood.json'));

test('Neighborhood map declares a playable 4v4 low-poly arena', () => {
  assert.equal(map.meta.name, 'Neighborhood District');
  assert.equal(map.meta.theme, 'neighborhood');
  assert.deepEqual(map.meta.size, [96, 96]);
  assert.match(map.meta.mode, /4v4/i);
});

test('Buildings are within map bounds and contain usable floors', () => {
  assert.ok(map.buildings.length >= 6, 'expected homes, apartments, and a market');
  for (const building of map.buildings) {
    assert.ok(building.id && building.name, 'every building has an id and name');
    assert.ok(building.floors.length >= 1, `${building.id} has at least one floor`);
    const [x, , z] = building.center;
    const [width, depth] = building.size;
    assert.ok(x - width / 2 >= -48 && x + width / 2 <= 48, `${building.id} fits X bounds`);
    assert.ok(z - depth / 2 >= -48 && z + depth / 2 <= 48, `${building.id} fits Z bounds`);
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

test('Maple House is the first approved detailed prototype; all other structures remain blockouts', () => {
  const maple = map.buildings.find((building) => building.id === 'home_south_west');
  assert.ok(maple, 'Maple House exists');
  assert.equal(maple.blockout, undefined, 'the first prototype is a real building');
  assert.equal(maple.roof.type, 'pitched', 'the first prototype uses a pitched roof');
  assert.equal(maple.floors.length, 2, 'the prototype has two floors');

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

test('Map box identifiers are unique and team spawn markers exist at opposite ends', () => {
  const ids = map.boxes.map((box) => box.id);
  assert.equal(new Set(ids).size, ids.length, 'box ids must be unique');
  for (const id of ['spawn_A_flagpole_1', 'spawn_A_flag_1', 'spawn_B_flagpole_1', 'spawn_B_flag_1']) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
  const a = map.boxes.find((box) => box.id === 'spawn_A_flagpole_1');
  const b = map.boxes.find((box) => box.id === 'spawn_B_flagpole_1');
  assert.ok(a.center[2] < -35 && b.center[2] > 35, 'team markers must be at opposite ends');
  assert.equal(map.teamSpawns.teamA.length, 4, 'Team A has four reserved player slots');
  assert.equal(map.teamSpawns.teamB.length, 4, 'Team B has four reserved player slots');
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
  const hud = read('src/ui/fpsHUD.ts');
  const atmosphere = read('src/environment/atmosphereManager.ts');
  const targets = read('src/environment/targets.ts');

  assert.match(loader, /'neighborhood'\s*;/);
  assert.match(loader, /neighborhood:\s*\{\s*name:\s*'Neighborhood District',\s*file:\s*'\/maps\/neighborhood\.json'/);
  assert.match(loader, /private expandPerchedBird/);
  assert.match(loader, /private expandBlockoutBuilding/);
  assert.match(loader, /bldg\.roof\.type === 'pitched'/);
  assert.match(loader, /const outerRoadAxis = mapWorldSpan \* 0\.34375/);
  assert.match(loader, /const innerRoadAxis = mapWorldSpan \/ 6/);
  assert.match(loader, /const isPitchedRoofCeiling/);
  assert.match(loader, /box\.collision !== false/);
  assert.match(hud, /'neighborhood'\]/);
  assert.match(atmosphere, /mapId === 'neighborhood'\s*\?\s*'suburban'/);
  assert.match(targets, /targetType: 'bird'/);
  assert.match(targets, /node\.visible = false/);
});
