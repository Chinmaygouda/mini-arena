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

test('Stage 2 details only Section 1 while preserving all original walls', () => {
  assert.equal(map.meta.layoutStage, 'section-1-detail');
  assert.ok(map.boxes.length > 202, 'rack assemblies add physical parts to the original shell');
  assert.equal(new Set(map.boxes.map((box) => box.id)).size, map.boxes.length, 'all object IDs are unique');
  const walls = map.boxes.filter((box) => box.kind === 'wall');
  const props = map.boxes.filter((box) => box.kind !== 'wall');
  assert.equal(walls.length, 202, 'all original wall segments are preserved');
  assert.equal(map.meta.wallSegmentCount, walls.length);
  assert.equal(map.meta.propCount, props.length);
  assert.equal(map.meta.physicalBoxCount, map.boxes.length);
  assert.ok(props.every((box) => ['metal', 'crate', 'pallet'].includes(box.kind)),
    'only rack metal, crates and pallets are introduced');
  assert.equal(map.buildings, undefined, 'no building models yet');
  assert.equal(map.nature, undefined, 'no nature props yet');
  assert.equal(map.perchedBirds, undefined, 'no bird props yet');
  for (const wall of walls) {
    assert.equal(wall.size[1], 6, `${wall.id} height`);
    assert.equal(wall.center[1], 3, `${wall.id} vertical centering`);
    assert.equal(Math.min(wall.size[0], wall.size[2]), 1.5, `${wall.id} thickness`);
    assert.ok(wall.center[0] - wall.size[0] / 2 >= -48 - 0.01, `${wall.id} west bound`);
    assert.ok(wall.center[0] + wall.size[0] / 2 <= 48 + 0.01, `${wall.id} east bound`);
    assert.ok(wall.center[2] - wall.size[2] / 2 >= -48 - 0.01, `${wall.id} south bound`);
    assert.ok(wall.center[2] + wall.size[2] / 2 <= 48 + 0.01, `${wall.id} north bound`);
  }
  const minX = Math.min(...walls.map((wall) => wall.center[0] - wall.size[0] / 2));
  const maxX = Math.max(...walls.map((wall) => wall.center[0] + wall.size[0] / 2));
  const minZ = Math.min(...walls.map((wall) => wall.center[2] - wall.size[2] / 2));
  const maxZ = Math.max(...walls.map((wall) => wall.center[2] + wall.size[2] / 2));
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
  const walls = map.boxes.filter((box) => box.kind === 'wall');
  const physicalKeys = new Set(walls.map((wall) => geometryKey(wall, false, false)));
  for (const wall of walls) {
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

test('Each quadrant has a real enclosing chamber, stepped entrances and auxiliary service bays', () => {
  const sections = [1, 2, 3, 4];
  for (const section of sections) {
    const walls = map.boxes.filter((wall) => wall.id.startsWith(`section-${section}-`));
    assert.ok(walls.length >= 30, `Section ${section} should contain an enclosing chamber and service-bay wall network`);
    for (const expected of [
      'inner-chamber-edge',
      'outer-chamber-edge',
      'chamber-south-edge',
      'chamber-north-edge',
      'service-bay-divider',
      'service-bay-partition-west',
      'service-bay-partition-east',
    ]) {
      assert.ok(walls.some((wall) => wall.id.includes(expected)),
        `Section ${section} includes ${expected}`);
    }
  }
  assert.equal(map.meta.wallSegmentCount, map.boxes.length);
  assert.ok(map.boxes.length >= 190, 'revised blueprint contains the detailed Stage 1 walls');
});

test('Quadrant doorways and returns connect rooms to the corridor network', () => {
  for (const section of [1, 2, 3, 4]) {
    const walls = map.boxes.filter((wall) => wall.id.startsWith(`section-${section}-`));
    assert.ok(walls.some((wall) => wall.id.includes('inner-entry-return')),
      `Section ${section} has recessed inner doorway returns`);
    assert.ok(walls.some((wall) => wall.id.includes('south-entry-return')),
      `Section ${section} opens toward the lower cross-corridor`);
    assert.ok(walls.some((wall) => wall.id.includes('north-entry-return')),
      `Section ${section} opens toward the outer cross-corridor`);
    assert.ok(walls.some((wall) => wall.id.includes('outer-entry-return')),
      `Section ${section} has access to its side service aisle`);
  }
});

test('Section 1 contains four storage rack runs, pallet loads and crates', () => {
  const section1 = map.boxes.filter((box) => box.zone === 'section1' && box.kind !== 'wall');
  const counts = (prefix) => section1.filter((box) => box.id.startsWith(prefix)).length;
  assert.equal(counts('s1-rack-'), 272, 'all rack structures, pallets and crate loads are present');
  assert.equal(section1.filter((box) => box.kind === 'crate').length, 32);
  assert.equal(section1.filter((box) => box.kind === 'pallet').length, 100, '20 pallets each have five visible timber pieces');
  assert.equal(section1.filter((box) => box.kind === 'metal' && box.id.includes('upright')).length, 48);
  assert.equal(section1.filter((box) => box.kind === 'metal' && box.id.includes('beam')).length, 72);
  assert.equal(section1.filter((box) => box.id.includes('upper-deck')).length, 20);
  assert.equal(map.zones.find((zone) => zone.id === 'section1').propsSummary.rackRuns, 4);
});

test('Only Section 1 has props; Sections 2, 3, 4 and central hall remain empty', () => {
  const props = map.boxes.filter((box) => box.kind !== 'wall');
  assert.ok(props.length > 0);
  assert.ok(props.every((box) => box.zone === 'section1'), 'all new props are assigned to Section 1');
  const zone = map.zones.find((item) => item.id === 'section1');
  for (const prop of props) {
    assert.ok(prop.center[0] - prop.size[0] / 2 >= zone.min[0], `${prop.id} is inside the west side of Section 1`);
    assert.ok(prop.center[0] + prop.size[0] / 2 <= zone.max[0], `${prop.id} is inside the east side of Section 1`);
    assert.ok(prop.center[2] - prop.size[2] / 2 >= zone.min[1], `${prop.id} is inside the south side of Section 1`);
    assert.ok(prop.center[2] + prop.size[2] / 2 <= zone.max[1], `${prop.id} is inside the north side of Section 1`);
  }
  assert.ok(props.every((box) => box.collision === false || ['metal', 'crate'].includes(box.kind)),
    'only steel uprights/beams and crates block player movement; shelf decks and pallet planks are visual');
  assert.ok(props.some((box) => box.kind === 'crate'));
  assert.equal(map.boxes.filter((box) => box.kind === 'wall').length, 202);
});

test('Warehouse is registered in the loader, map selector and industrial atmosphere', () => {
  const loader = read('src/environment/blueprintMapLoader.ts');
  const hud = read('src/ui/fpsHUD.ts');
  const atmosphere = read('src/environment/atmosphereManager.ts');
  assert.match(loader, /'warehouse';/);
  assert.match(loader, /warehouse:\s*\{\s*name:\s*'Warehouse — Section 1',\s*file:\s*'\/maps\/warehouse_layout\.json'/);
  assert.match(loader, /data\.meta\.playableSize \|\| data\.meta\.size/);
  assert.match(loader, /warehouse-fixture-/);
  assert.match(loader, /box\.collision !== false/);
  assert.match(hud, /'warehouse'\]/);
  assert.match(atmosphere, /mapId === 'warehouse'\s*\?\s*'industrial'/);
  assert.match(atmosphere, /if \(mapId !== 'warehouse'\)/, 'warehouse suppresses outdoor sky and clouds');
  assert.match(atmosphere, /this.scene.background = new THREE.Color\('#1a222a'\)/, 'warehouse uses a neutral indoor backdrop');
  assert.match(loader, /label: '1', x: 22, z: 22/, 'zone 1 marker is positioned north-west in the rendered top-down view');
  assert.match(loader, /label: '2', x: -22, z: 22/, 'zone 2 marker is positioned north-east in the rendered top-down view');
  assert.match(loader, /ctx\.arc\(px, pz, 50, 0, Math\.PI \* 2\)/, 'each section marker has a visible circular badge');
  assert.match(loader, /ctx\.rotate\(Math\.PI\)/, 'quadrant numerals are oriented upright in the top-down render');
});

