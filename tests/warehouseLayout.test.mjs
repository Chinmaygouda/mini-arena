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
  assert.equal(map.meta.name, 'Warehouse — Section 3 Parcel Sortation & Dispatch Cell');
  assert.match(map.meta.mode, /Section 1 pallet storage, Section 2 loading bay, Section 3 conveyor parcel sortation and dispatch/);
  assert.deepEqual(map.meta.size, [96, 96], 'outer dimensions are 96m x 96m');
  assert.deepEqual(map.meta.playableSize, [92, 92], 'player bounds are 92m x 92m');
  assert.equal(map.meta.wallHeight, 6);
  assert.equal(map.meta.outerWallThickness, 1.5);
  assert.equal(map.meta.interiorWallThickness, 1.5);
  assert.equal(map.meta.mainCorridorClearWidth, 4);
  assert.equal(map.meta.serviceCorridorClearWidth, 3);
  assert.deepEqual(map.meta.centralHallClearSize, [13.5, 13.5]);
});

test('Sections 1 and 2 are detailed while preserving all original walls', () => {
  assert.equal(map.meta.layoutStage, 'section-1-pallet-storage-section-2-loading-bay-section-3-parcel-sortation-dispatch');
  assert.ok(map.boxes.length > 202, 'rack assemblies add physical parts to the original shell');
  assert.equal(new Set(map.boxes.map((box) => box.id)).size, map.boxes.length, 'all object IDs are unique');
  const walls = map.boxes.filter((box) => box.kind === 'wall');
  const props = map.boxes.filter((box) => box.kind !== 'wall');
  assert.equal(walls.length, 202, 'all original wall segments are preserved');
  assert.equal(map.meta.wallSegmentCount, walls.length);
  assert.equal(map.meta.propCount, props.length);
  assert.equal(map.meta.physicalBoxCount, map.boxes.length);
  assert.equal(props.length, map.meta.propCount);
  assert.equal(props.filter((box) => box.zone === 'section1').length, 272);
  assert.equal(props.filter((box) => box.zone === 'section2').length,
    map.zones.find((zone) => zone.id === 'section2').propsSummary.propParts);
  assert.ok(props.every((box) => typeof box.kind === 'string' && box.kind.length > 0), 'all props declare a renderable kind');
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
  const wallCount = map.boxes.filter((box) => box.kind === 'wall').length;
  assert.equal(map.meta.wallSegmentCount, wallCount, 'wall count excludes Section 1 props');
  assert.ok(wallCount >= 190, 'revised blueprint preserves the detailed Stage 1 wall shell');
  assert.ok(map.boxes.length > wallCount, 'Section 1 props are additional to the preserved wall shell');
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

  const expectedUpperBays = {
    '01': [1, 3, 5],
    '02': [2, 4, 5],
    '03': [1, 2, 4],
    '04': [1, 3, 4],
  };
  for (const [rack, expectedBays] of Object.entries(expectedUpperBays)) {
    const actualBays = section1
      .filter((box) => box.id.startsWith(`s1-rack-${rack}-crate-upper-`))
      .map((box) => Number(box.id.match(/crate-upper-(\d+)/)?.[1]))
      .sort((a, b) => a - b);
    assert.deepEqual(actualBays, expectedBays, `Rack ${rack} uses its staggered upper crate pattern`);
  }
});

test('Warehouse shelf decks have dark matte coated-steel material values', () => {
  const decks = map.boxes.filter((box) => box.id.includes('-upper-deck-'));
  assert.equal(decks.length, 35);
  assert.ok(decks.every((deck) => deck.color.toLowerCase() === '#47535b'));
  assert.ok(decks.every((deck) => deck.roughness === 0.65));
  assert.ok(decks.every((deck) => deck.metalness === 0.25));
  const loader = read('src/environment/blueprintMapLoader.ts');
  assert.ok(loader.includes('roughness?: number'));
  assert.ok(loader.includes('metalness?: number'));
  assert.ok(loader.includes('box.roughness ?? defaultRoughness'));
  assert.ok(loader.includes('box.metalness ?? defaultMetalness'));
  assert.ok(loader.includes('const cacheKey = `${hex.toLowerCase()}|${roughness.toFixed(3)}|${metalness.toFixed(3)}`'));
  assert.ok(loader.includes("mapId === 'warehouse' ? 0.58 : 0.35"));
  assert.ok(loader.includes("mapId === 'warehouse' ? 0.38 : 0.85"));
});
test('Props remain inside their declared warehouse zones', () => {
  const props = map.boxes.filter((box) => box.kind !== 'wall');
  assert.equal(props.length, map.meta.propCount);
  assert.ok(props.every((box) => ['section1', 'section2', 'section3', 'section4', 'centralHall'].includes(box.zone)));
  for (const prop of props) {
    const zone = map.zones.find((item) => item.id === prop.zone);
    assert.ok(zone, `${prop.id} resolves to its zone`);
    assert.ok(prop.center[0] - prop.size[0] / 2 >= zone.min[0] - 0.001, `${prop.id} west bound`);
    assert.ok(prop.center[0] + prop.size[0] / 2 <= zone.max[0] + 0.001, `${prop.id} east bound`);
    assert.ok(prop.center[2] - prop.size[2] / 2 >= zone.min[1] - 0.001, `${prop.id} south bound`);
    assert.ok(prop.center[2] + prop.size[2] / 2 <= zone.max[1] + 0.001, `${prop.id} north bound`);
  }
  assert.ok(props.every((box) => box.collision === false || typeof box.kind === 'string'));
  assert.equal(props.filter((box) => box.zone === 'section1').length, 272);
  assert.equal(props.filter((box) => box.zone === 'section2').length, map.zones.find((zone) => zone.id === 'section2').propsSummary.propParts);
  const section3 = props.filter((box) => box.zone === 'section3');
  assert.equal(section3.length, 203, 'Section 3 has the parcel sortation and dispatch prop set');
  const section3Kinds = new Set(section3.map((box) => box.kind));
  for (const kind of ['conveyor-frame', 'conveyor-belt', 'sorter-branch-frame', 'barcode-scanner-arch', 'induction-table', 'exception-sort-table', 'sort-destination-bin', 'roll-cage-base', 'packing-bench', 'parcel-scale', 'safety-bollard', 'floor-lane-marking']) {
    assert.ok(section3Kinds.has(kind), `Section 3 includes ${kind}`);
  }
  const section4 = props.filter((box) => box.zone === 'section4');
  assert.equal(section4.length, 93, 'Section 4 contains the IT & Logistics Hub prop set');
  assert.equal(map.boxes.filter((box) => box.kind === 'wall').length, 202);
});

test('Section 2 is a unique cross-rack loading bay with a static forklift', () => {
  const section2 = map.boxes.filter((box) => box.zone === 'section2' && box.kind !== 'wall');
  const rows = [...new Set(section2.map((box) => box.id.match(/^s2-crossrack-([ABC])-/)?.[1]).filter(Boolean))].sort();
  assert.deepEqual(rows, ['A', 'B', 'C']);
  assert.equal(section2.filter((box) => /^s2-crossrack-[ABC]-upright-/.test(box.id)).length, 36);
  assert.equal(section2.filter((box) => /^s2-crossrack-[ABC]-beam-/.test(box.id)).length, 90);
  assert.equal(section2.filter((box) => /^s2-crossrack-[ABC]-upper-deck-/.test(box.id)).length, 15);
  assert.equal(section2.filter((box) => /^s2-crossrack-[ABC]-lower-crate-/.test(box.id)).length, 15);
  assert.equal(section2.filter((box) => /^s2-crossrack-[ABC]-upper-crate-/.test(box.id)).length, 7);
  assert.equal(section2.filter((box) => box.id.startsWith('s2-forklift-') && box.kind === 'vehicle-part').length, 37);
  assert.equal(section2.filter((box) => box.id === 's2-forklift-collider' && box.visible === false && box.collision === true).length, 1);
  assert.equal(section2.filter((box) => box.kind === 'barrel' && box.shape === 'cylinder' && box.collision !== false && !box.id.endsWith('-top-rim')).length, 3);
  assert.equal(section2.filter((box) => box.id.includes('safety-cone-') && box.shape === 'cone').length, 3);
  assert.equal(section2.filter((box) => box.id.startsWith('s2-forklift-bay-') && box.kind === 'marking').length, 4);
  assert.equal(map.zones.find((zone) => zone.id === 'section2').propsSummary.rackRuns, 3);
  assert.equal(map.meta.section2Vehicle.driveable, false);
  assert.ok(!section2.some((box) => box.id.startsWith('s2-rack-')));
  assert.ok(section2.some((box) => box.id === 's2-workbench-top'));
});

test('Forklift and parking bay sit clear of wall returns and rack geometry', () => {
  const forklift = map.boxes.find((box) => box.id === 's2-forklift-collider');
  assert.ok(forklift);
  assert.deepEqual(map.meta.section2Vehicle.bodyCenter, [-22, 0.7, 14.5]);
  const overlapsXZ = (a, b) =>
    Math.abs(a.center[0] - b.center[0]) < (a.size[0] + b.size[0]) / 2 &&
    Math.abs(a.center[2] - b.center[2]) < (a.size[2] + b.size[2]) / 2;
  const obstructions = map.boxes.filter((box) =>
    box.id !== forklift.id &&
    !box.id.startsWith('s2-forklift-') &&
    (box.kind === 'wall' || (box.zone === 'section2' && !['vehicle-part', 'marking', 'pallet'].includes(box.kind))) &&
    overlapsXZ(forklift, box)
  );
  assert.deepEqual(obstructions.map((box) => box.id), [],
    'the forklift footprint must not overlap wall returns, rack structures, barrels or crates');
  assert.ok(forklift.center[0] - forklift.size[0] / 2 >= -38);
  assert.ok(forklift.center[0] + forklift.size[0] / 2 <= -7);
  assert.ok(forklift.center[2] - forklift.size[2] / 2 > 12.12,
    'forklift stays north of the Section 2 row A rack footprint');
  assert.ok(forklift.center[2] + forklift.size[2] / 2 < 18.38,
    'forklift stays south of the Section 2 row B rack footprint');
});

test('Renderer supports cylinders, cones, rotations and hidden collider volumes', () => {
  const loader = read('src/environment/blueprintMapLoader.ts');
  assert.ok(loader.includes("box.shape === 'cylinder'"));
  assert.ok(loader.includes('THREE.CylinderGeometry(radius, radius, h, 12)'));
  assert.ok(loader.includes("box.shape === 'cone'"));
  assert.ok(loader.includes('THREE.ConeGeometry(radius, h, 9)'));
  assert.ok(loader.includes('mesh.rotation.set(box.rotation[0], box.rotation[1], box.rotation[2])'));
  assert.ok(loader.includes('if (box.visible !== false)'));
  assert.equal(map.boxes.find((box) => box.id === 's2-forklift-collider').visible, false);
});

test('Warehouse is registered in the loader, map selector and industrial atmosphere', () => {
  const loader = read('src/environment/blueprintMapLoader.ts');
  const hud = read('src/ui/fpsHUD.ts');
  const atmosphere = read('src/environment/atmosphereManager.ts');
  assert.match(loader, /'warehouse';/);
  assert.match(loader, /warehouse:\s*\{\s*name:\s*'Warehouse — Parcel Sortation & Dispatch',\s*file:\s*'\/maps\/warehouse_layout\.json'/);
  assert.match(loader, /data\.meta\.playableSize \|\| data\.meta\.size/);
  assert.match(loader, /warehouse-fixture-/);
  assert.match(loader, /box\.collision !== false/);
  assert.match(hud, /'warehouse'\]/);
  assert.match(atmosphere, /mapId === 'warehouse'\s*\?\s*'industrial'/);
  assert.match(atmosphere, /if \(mapId !== 'warehouse'\)/, 'warehouse suppresses outdoor sky and clouds');
  assert.match(atmosphere, /this.scene.background = new THREE.Color\('#1a222a'\)/, 'warehouse uses a neutral indoor backdrop');
  assert.match(loader, /label: '1', x: 22, z: 27.2/, 'zone 1 marker is positioned north-west in the rendered top-down view');
  assert.match(loader, /label: '2', x: -22, z: 27.2/, 'zone 2 marker is positioned north-east in the rendered top-down view');
  assert.match(loader, /ctx\.arc\(px, pz, 22, 0, Math\.PI \* 2\)/, 'each section marker has a visible circular badge');
  assert.match(loader, /ctx\.rotate\(Math\.PI\)/, 'quadrant numerals are oriented upright in the top-down render');
});


test('Section 3 is a distinct parcel sortation cell with valid geometry and no out-of-zone props', () => {
  const section3 = map.boxes.filter((box) => box.zone === 'section3');
  const zone = map.zones.find((item) => item.id === 'section3');
  assert.ok(zone, 'Section 3 zone exists');
  assert.equal(zone.number, 3);
  assert.deepEqual(zone.min, [7, -31]);
  assert.deepEqual(zone.max, [38, -8]);
  assert.equal(section3.length, 203, 'Section 3 contains the parcel sortation and dispatch prop set');
  for (const box of section3) {
    assert.ok(box.size.every((n) => Number.isFinite(n) && n > 0), `${box.id} has positive finite dimensions`);
    assert.ok(box.center.every(Number.isFinite), `${box.id} has a finite center`);
    assert.ok(box.center[0] - box.size[0] / 2 >= zone.min[0] - 0.001, `${box.id} west bound`);
    assert.ok(box.center[0] + box.size[0] / 2 <= zone.max[0] + 0.001, `${box.id} east bound`);
    assert.ok(box.center[2] - box.size[2] / 2 >= zone.min[1] - 0.001, `${box.id} south bound`);
    assert.ok(box.center[2] + box.size[2] / 2 <= zone.max[1] + 0.001, `${box.id} north bound`);
  }
  assert.equal(map.meta.physicalBoxCount, map.boxes.length);
  assert.equal(map.meta.propCount, map.boxes.filter((box) => box.kind !== 'wall').length);
  assert.equal(map.meta.visiblePropCount, map.boxes.filter((box) => box.kind !== 'wall' && box.visible !== false).length);
});

test('Section 4 is a distinct IT & logistics network hub with valid geometry and shootable server gaps', () => {
  const section4 = map.boxes.filter((box) => box.zone === 'section4');
  const zone = map.zones.find((item) => item.id === 'section4');
  assert.ok(zone, 'Section 4 zone exists');
  assert.equal(zone.number, 4);
  assert.deepEqual(zone.min, [-38, -31]);
  assert.deepEqual(zone.max, [-7, -8]);
  assert.equal(section4.length, 93, 'Section 4 contains 93 IT & Logistics Hub props');

  for (const box of section4) {
    assert.ok(box.size.every((n) => Number.isFinite(n) && n > 0), `${box.id} has positive finite dimensions`);
    assert.ok(box.center.every(Number.isFinite), `${box.id} has a finite center`);
    assert.ok(box.center[0] - box.size[0] / 2 >= zone.min[0] - 0.05, `${box.id} west bound`);
    assert.ok(box.center[0] + box.size[0] / 2 <= zone.max[0] + 0.05, `${box.id} east bound`);
    assert.ok(box.center[2] - box.size[2] / 2 >= zone.min[1] - 0.05, `${box.id} south bound`);
    assert.ok(box.center[2] + box.size[2] / 2 <= zone.max[1] + 0.05, `${box.id} north bound`);
  }

  // 8 Server racks with clear shootable gaps
  const servers = section4.filter((b) => b.id.includes('server-') && b.id.includes('cabinet'));
  assert.equal(servers.length, 8, '8 server rack cabinets');
  assert.ok(section4.filter((b) => b.id.includes('cable-runway')).length >= 2, 'overhead cable runways');

  // Dispatch workstations & monitors
  assert.ok(section4.some((b) => b.id.includes('dispatch-desk')), 'dispatch desk present');
  assert.ok(section4.filter((b) => b.id.includes('monitor-')).length >= 4, 'screens and stands');

  // Storage cage
  assert.ok(section4.filter((b) => b.id.includes('cage-post')).length >= 4, 'cage posts');
  assert.ok(section4.filter((b) => b.id.includes('cage-locker')).length >= 2, 'cage lockers');

  // Pallets & crates
  assert.ok(section4.filter((b) => b.kind === 'pallet').length >= 6, 'hardware pallets');
  assert.ok(section4.filter((b) => b.kind === 'crate').length >= 8, 'hardware shipping cartons');

  // Overhead warehouse lighting
  assert.ok(section4.filter((b) => b.id.includes('light-') && b.id.includes('tube')).length >= 5, 'overhead lights');
});



test('Central hall includes four solid tactical cover props while preserving a clear center lane', () => {
  const cover = map.boxes.filter((box) => box.id.startsWith('central-cover-'));
  assert.equal(cover.length, 4, 'four tactical cover positions are present');
  assert.ok(cover.every((box) => box.zone === 'centralHall' && box.kind === 'crate'));
  assert.ok(cover.every((box) => box.collision === true && box.category === 'SOLID'));
  assert.ok(cover.every((box) => box.size[1] <= 1.3), 'cover remains low enough to crouch behind');
  assert.ok(cover.every((box) =>
    Math.abs(box.center[0]) < 4.2 && Math.abs(box.center[2]) < 4.2),
  'cover remains within the central hall');
  const centerOpen = !cover.some((box) =>
    Math.abs(box.center[0]) - box.size[0] / 2 < 1.0 &&
    Math.abs(box.center[2]) - box.size[2] / 2 < 1.0);
  assert.ok(centerOpen, 'central crossing remains open');
  assert.equal(map.meta.propCount, map.boxes.filter((box) => box.kind !== 'wall').length);
  assert.equal(map.meta.physicalBoxCount, map.boxes.length);
});
