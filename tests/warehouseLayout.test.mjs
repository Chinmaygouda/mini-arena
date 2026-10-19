import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const map = JSON.parse(read('public/maps/warehouse_layout.json'));

test('Warehouse base layout has exact outer and playable dimensions', () => {
  assert.equal(map.meta.theme, 'warehouse');
  assert.deepEqual(map.meta.size, [96, 96], 'outer dimensions are 96m x 96m');
  assert.deepEqual(map.meta.playableSize, [92, 92], 'player bounds are 92m x 92m');
  assert.equal(map.meta.wallHeight, 6);
  assert.equal(map.meta.outerWallThickness, 1.5);
  assert.equal(map.meta.interiorWallThickness, 1.5);
  assert.equal(map.meta.mainCorridorClearWidth, 4);
  assert.equal(map.meta.serviceCorridorClearWidth, 3);
  assert.deepEqual(map.meta.centralHallClearSize, [13.5, 13.5]);
});

test('Stage one contains wall geometry and no warehouses props or buildings', () => {
  assert.equal(map.meta.layoutStage, 'walls-only');
  assert.ok(map.boxes.length >= 60, 'perimeter and partition walls should be segmented around openings');
  assert.equal(new Set(map.boxes.map((box) => box.id)).size, map.boxes.length, 'wall IDs are unique');
  assert.ok(map.boxes.every((box) => box.kind === 'wall'), 'every physical box is a wall');
  assert.equal(map.buildings, undefined, 'no building models yet');
  assert.equal(map.nature, undefined, 'no nature props yet');
  assert.equal(map.perchedBirds, undefined, 'no bird props yet');
  for (const wall of map.boxes) {
    assert.equal(wall.size[1], 6, `${wall.id} height`);
    assert.equal(wall.center[1], 3, `${wall.id} vertical centering`);
    assert.equal(Math.min(wall.size[0], wall.size[2]), 1.5, `${wall.id} thickness`);
    assert.ok(wall.center[0] - wall.size[0] / 2 >= -48 - 0.01, `${wall.id} west bound`);
    assert.ok(wall.center[0] + wall.size[0] / 2 <= 48 + 0.01, `${wall.id} east bound`);
    assert.ok(wall.center[2] - wall.size[2] / 2 >= -48 - 0.01, `${wall.id} south bound`);
    assert.ok(wall.center[2] + wall.size[2] / 2 <= 48 + 0.01, `${wall.id} north bound`);
  }
  const minX = Math.min(...map.boxes.map((wall) => wall.center[0] - wall.size[0] / 2));
  const maxX = Math.max(...map.boxes.map((wall) => wall.center[0] + wall.size[0] / 2));
  const minZ = Math.min(...map.boxes.map((wall) => wall.center[2] - wall.size[2] / 2));
  const maxZ = Math.max(...map.boxes.map((wall) => wall.center[2] + wall.size[2] / 2));
  assert.deepEqual([minX, maxX, minZ, maxZ], [-48, 48, -48, 48], 'outer wall meshes exactly fill a 96m shell');
});

test('Four numbered sections, central hall and side dock openings are defined', () => {
  const sections = map.zones.filter((zone) => Number.isInteger(zone.number));
  assert.deepEqual(sections.map((zone) => zone.number).sort(), [1, 2, 3, 4]);
  const byId = new Map(map.zones.map((zone) => [zone.id, zone]));
  assert.ok(byId.has('centralHall'));
  assert.ok(byId.has('teamA'));
  assert.ok(byId.has('teamB'));
  assert.ok(byId.has('loadingWest'));
  assert.ok(byId.has('loadingEast'));

  const sideOuterWalls = map.boxes.filter((wall) => wall.id.startsWith('outer-west-') || wall.id.startsWith('outer-east-'));
  assert.ok(sideOuterWalls.length >= 4);
  for (const wall of sideOuterWalls) {
    const minZ = wall.center[2] - wall.size[2] / 2;
    const maxZ = wall.center[2] + wall.size[2] / 2;
    assert.ok(maxZ <= -8.75 + 0.01 || minZ >= 8.75 - 0.01,
      `${wall.id} must leave the central side loading opening clear`);
  }
});

test('Four-quadrant walls are symmetric around both map axes', () => {
  const round = (n) => Math.round(n * 100) / 100;
  const geometryKey = (wall, flipX, flipZ) => [
    round(flipX ? -wall.center[0] : wall.center[0]),
    round(wall.center[1]),
    round(flipZ ? -wall.center[2] : wall.center[2]),
    round(wall.size[0]), round(wall.size[1]), round(wall.size[2]),
  ].join('|');
  const physicalKeys = new Set(map.boxes.map((wall) => geometryKey(wall, false, false)));
  for (const wall of map.boxes) {
    for (const [flipX, flipZ] of [[true, false], [false, true], [true, true]]) {
      assert.ok(physicalKeys.has(geometryKey(wall, flipX, flipZ)),
        `${wall.id} must have a mirrored wall segment (x=${flipX}, z=${flipZ})`);
    }
  }
});

test('Team spawns are opposite, balanced 2v2 positions inside the playable boundary', () => {
  assert.equal(map.teamSpawns.teamA.length, 2);
  assert.equal(map.teamSpawns.teamB.length, 2);
  assert.ok(map.teamSpawns.teamA.every((slot) =>
    Math.abs(slot.position[0]) < 8 && slot.position[1] > 34 && slot.position[1] < 46));
  assert.ok(map.teamSpawns.teamB.every((slot) =>
    Math.abs(slot.position[0]) < 8 && slot.position[1] < -34 && slot.position[1] > -46));
  assert.ok(map.teamSpawns.teamA.every((slot) => slot.facingYaw === 0));
  assert.ok(map.teamSpawns.teamB.every((slot) => Math.abs(slot.facingYaw - Math.PI) < 0.001));
});

test('Warehouse lighting is a symmetric 4-by-4 grid of 16 point lights', () => {
  const lights = map.lighting.points;
  assert.equal(lights.length, 16);
  assert.deepEqual([...new Set(lights.map((light) => light.x))].sort((a, b) => a - b), [-30, -10, 10, 30]);
  assert.deepEqual([...new Set(lights.map((light) => light.z))].sort((a, b) => a - b), [-30, -10, 10, 30]);
  assert.ok(lights.every((light) => light.y === 5.35 && light.intensity > 0 && light.range >= 20));
});

test('Warehouse is registered in the loader, map selector and industrial atmosphere', () => {
  const loader = read('src/environment/blueprintMapLoader.ts');
  const hud = read('src/ui/fpsHUD.ts');
  const atmosphere = read('src/environment/atmosphereManager.ts');
  assert.match(loader, /'warehouse';/);
  assert.match(loader, /warehouse:\s*\{\s*name:\s*'Warehouse — Walls Only',\s*file:\s*'\/maps\/warehouse_layout\.json'/);
  assert.match(loader, /data\.meta\.playableSize \|\| data\.meta\.size/);
  assert.match(loader, /warehouse-fixture-/);
  assert.match(hud, /'warehouse'\]/);
  assert.match(atmosphere, /mapId === 'warehouse'\s*\?\s*'industrial'/);
  assert.match(atmosphere, /if \(mapId !== 'warehouse'\)/, 'warehouse suppresses outdoor sky and clouds');
  assert.match(atmosphere, /this.scene.background = new THREE.Color\('#1a222a'\)/, 'warehouse uses a neutral indoor backdrop');
  assert.match(loader, /label: '1', x: 22, z: 22/, 'zone 1 marker is positioned north-west in the rendered top-down view');
  assert.match(loader, /label: '2', x: -22, z: 22/, 'zone 2 marker is positioned north-east in the rendered top-down view');
  assert.match(loader, /ctx\.arc\(px, pz, 50, 0, Math\.PI \* 2\)/, 'each section marker has a visible circular badge');
  assert.match(loader, /ctx\.rotate\(Math\.PI\)/, 'quadrant numerals are oriented upright in the top-down render');
});

