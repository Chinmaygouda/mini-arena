// scripts/reproduce-issue2-suite.mjs
import fs from 'fs';
import * as THREE from 'three';
import { FirstPersonControls } from '../src/player/firstPersonControls.ts';

function createControls() {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
  const domEl = { addEventListener: () => {} };
  return new FirstPersonControls(camera, domEl);
}

const mapFiles = {
  range: null,
  foundry: 'public/maps/foundry_yard.json',
  culdesac: 'public/maps/Cul-de-Sac.json',
  dustline: 'public/maps/Dustline Village.json',
  overpass: 'public/maps/Overpass.json',
};

// ─── 3a. Validate Walker with Deliberately Broken Collider ──────────────────
export function testWalkerValidation() {
  const controls = createControls();
  controls.setBounds({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
  const visualBox = { minX: -1, maxX: 1, minY: 0, maxY: 2, minZ: -1, maxZ: 1 };
  // Broken collider: shifted by 1.5m to the right, leaving the actual visual box uncollided
  const brokenCollider = { minX: 0.5, maxX: 2.5, minY: 0, maxY: 2, minZ: -1, maxZ: 1 };
  controls.setColliders([brokenCollider]);
  controls.setPosition(-3, 1.7, 0, -Math.PI / 2); // Facing +X towards visual box
  controls.input.forward = true;

  let detected = false;
  let penetrationFrame = -1;
  let penetratedPos = null;

  for (let f = 0; f < 60; f++) {
    controls.update(1 / 60);
    const feetY = controls.position.y - 1.7;
    const inVisualX = controls.position.x > visualBox.minX && controls.position.x < visualBox.maxX;
    const inVisualZ = controls.position.z > visualBox.minZ && controls.position.z < visualBox.maxZ;
    const inVisualY = feetY < visualBox.maxY && (feetY + 1.7) > visualBox.minY;
    if (inVisualX && inVisualZ && inVisualY) {
      detected = true;
      penetrationFrame = f;
      penetratedPos = { x: +controls.position.x.toFixed(4), y: +controls.position.y.toFixed(4), z: +controls.position.z.toFixed(4), feetY: +feetY.toFixed(4) };
      break;
    }
  }

  return {
    validationPassed: detected,
    penetrationFrame,
    penetratedPos,
    visualBox,
    brokenCollider
  };
}

// ─── Load Map Helper ────────────────────────────────────────────────────────
function loadMap(mapId) {
  if (mapId === 'range') {
    return {
      mapId,
      name: 'Tactical Shooting Range',
      bounds: { minX: -7.5, maxX: 7.5, minZ: -3.2, maxZ: 5.5 },
      colliders: [
        { minX: -6.1, maxX: -3.9, minY: 0, maxY: 0.9, minZ: -2.9, maxZ: -2.1, isWalkable: true, id: 'bench_left' },
        { minX: -1.1, maxX: 1.1, minY: 0, maxY: 0.9, minZ: -2.9, maxZ: -2.1, isWalkable: true, id: 'bench_mid' },
        { minX: 3.9, maxX: 6.1, minY: 0, maxY: 0.9, minZ: -2.9, maxZ: -2.1, isWalkable: true, id: 'bench_right' },
      ],
      stairFlights: [],
      boxes: [
        { id: 'bench_left', center: [-5, 0.45, -2.5], size: [2.2, 0.9, 0.8], kind: 'cover' },
        { id: 'bench_mid', center: [0, 0.45, -2.5], size: [2.2, 0.9, 0.8], kind: 'cover' },
        { id: 'bench_right', center: [5, 0.45, -2.5], size: [2.2, 0.9, 0.8], kind: 'cover' },
      ]
    };
  }

  const raw = fs.readFileSync(mapFiles[mapId], 'utf-8');
  const data = JSON.parse(raw);
  const rawBoxes = data.boxes || [];
  const colliders = [];
  const stairBoxes = [];
  const standardBoxes = [];

  for (const box of rawBoxes) {
    if (box.kind === 'roof') continue;
    const [w, h, d] = box.size;
    const [cx, cy, cz] = box.center;
    const isWalkable = box.kind === 'stairs' || box.kind === 'stair' || box.kind === 'platform';
    const c = {
      id: box.id,
      kind: box.kind,
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minY: cy - h / 2,
      maxY: cy + h / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      isWalkable,
      size: box.size,
      center: box.center
    };
    colliders.push(c);
    if (box.kind === 'stairs' || box.kind === 'stair') {
      stairBoxes.push(c);
    } else {
      standardBoxes.push(c);
    }
  }

  // Group stair flights
  const flightGroups = {};
  for (const sb of stairBoxes) {
    const isTeamB = sb.id.endsWith('_B');
    const base = sb.id.replace(/_B$/, '');
    const prefix = base.replace(/_\d+$/, '').replace(/\d+$/, '') + (isTeamB ? '_B' : '_A');
    if (!flightGroups[prefix]) flightGroups[prefix] = [];
    flightGroups[prefix].push(sb);
  }

  const stairFlights = [];
  for (const [flightId, steps] of Object.entries(flightGroups)) {
    steps.sort((a, b) => a.minY - b.minY);
    stairFlights.push({
      flightId,
      stepCount: steps.length,
      bottomY: steps[0].minY,
      topY: steps[steps.length - 1].maxY,
      steps
    });
  }

  const halfW = data.meta.size ? data.meta.size[0] / 2 : 30;
  const halfD = data.meta.size ? data.meta.size[1] / 2 : 30;

  return {
    mapId,
    name: data.meta.name,
    bounds: { minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD },
    colliders,
    stairFlights,
    boxes: standardBoxes
  };
}

// ─── 3b (i): Stair Flight Climb & Descend Test ──────────────────────────────
function testStairFlight(map, flight) {
  const controls = createControls();
  controls.setBounds(map.bounds);
  controls.setColliders(map.colliders);

  const steps = flight.steps;
  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];

  // Vector from bottom to top
  const dx = lastStep.center[0] - firstStep.center[0];
  const dz = lastStep.center[2] - firstStep.center[2];
  const climbAngle = Math.atan2(dx, dz); // Forward in Three.js camera is -Z in local coords

  // Place player slightly before the bottom step on ground
  const dist = Math.hypot(dx, dz) || 1;
  const normX = dx / dist;
  const normZ = dz / dist;

  // Start directly on first step
  const startX = firstStep.center[0];
  const startZ = firstStep.center[2];
  const startFeetY = firstStep.maxY;

  // Yaw: camera forward is (-sin(yaw), 0, -cos(yaw)).
  // We want forward direction to be (normX, 0, normZ).
  // So -sin(yaw) = normX, -cos(yaw) = normZ  =>  yaw = Math.atan2(-normX, -normZ).
  const ascendYaw = Math.atan2(-normX, -normZ);
  const descendYaw = Math.atan2(normX, normZ); // Turn around 180 deg

  controls.setPosition(startX, startFeetY + 1.7, startZ, ascendYaw);
  controls.input.forward = true;

  const climbLog = [];
  const descendLog = [];
  let reachedTop = false;
  const dt = 1 / 60;

  // 1. Climb phase (up to 180 frames = 3s)
  for (let f = 0; f < 180; f++) {
    controls.update(dt);
    const feetY = controls.position.y - 1.7;
    const hits = controls.getCollidingCount();
    climbLog.push({
      frame: f,
      pos: [+controls.position.x.toFixed(2), +controls.position.y.toFixed(2), +controls.position.z.toFixed(2)],
      feetY: +feetY.toFixed(2),
      grounded: controls.isGrounded,
      velY: +controls.velocity.y.toFixed(2),
      hits
    });

    if (feetY >= flight.topY - 0.1) {
      reachedTop = true;
      break;
    }
  }

  if (!reachedTop) {
    return {
      flightId: flight.flightId,
      pass: false,
      reason: 'Failed to climb to top',
      climbLog: climbLog.slice(-5)
    };
  }

  // 2. Turn around and walk back down
  controls.yaw = descendYaw;
  controls.pitch = 0;
  controls.input.forward = true;

  let reachedBottom = false;
  let blockedFrames = 0;
  let lastPos = { ...controls.position };

  for (let f = 0; f < 180; f++) {
    controls.update(dt);
    const feetY = controls.position.y - 1.7;
    const hits = controls.getCollidingCount();

    const moved = Math.hypot(controls.position.x - lastPos.x, controls.position.z - lastPos.z);
    if (moved < 0.001) blockedFrames++;
    else blockedFrames = 0;
    lastPos = { ...controls.position };

    descendLog.push({
      frame: f,
      pos: [+controls.position.x.toFixed(2), +controls.position.y.toFixed(2), +controls.position.z.toFixed(2)],
      feetY: +feetY.toFixed(2),
      grounded: controls.isGrounded,
      velY: +controls.velocity.y.toFixed(2),
      hits
    });

    if (feetY <= 0.05) {
      reachedBottom = true;
      break;
    }
  }

  const pass = reachedTop && reachedBottom && blockedFrames < 10;
  return {
    flightId: flight.flightId,
    stepCount: flight.stepCount,
    topY: flight.topY,
    reachedTop,
    reachedBottom,
    pass,
    sampleClimbFrames: [climbLog[0], climbLog[Math.floor(climbLog.length / 2)], climbLog[climbLog.length - 1]],
    sampleDescendFrames: [descendLog[0], descendLog[Math.floor(descendLog.length / 2)], descendLog[descendLog.length - 1]],
    first5Descend: descendLog.slice(0, 5),
    last5Descend: descendLog.slice(-5)
  };
}

// ─── 3b (ii): Jump Toward Box Test ──────────────────────────────────────────
function testJumpTowardBox(map, box) {
  const controls = createControls();
  controls.setBounds(map.bounds);
  controls.setColliders(map.colliders);

  const [w, h, d] = box.size;
  const [cx, cy, cz] = box.center;
  const boxMinY = cy - h / 2;
  const boxMaxY = cy + h / 2;
  const boxMinX = cx - w / 2;
  const boxMaxX = cx + w / 2;
  const boxMinZ = cz - d / 2;
  const boxMaxZ = cz + d / 2;

  // Approach box from outside: start 1.5m away from minX face
  const startX = boxMinX - 1.5;
  const startZ = cz;
  // If box is higher than ground, test jumping from the platform/surface at the base of the box
  const startFeetY = boxMinY;
  // Face toward box (+X)
  const yaw = -Math.PI / 2; // Forward is +X

  controls.setPosition(startX, startFeetY + 1.7, startZ, yaw);
  controls.input.forward = true;

  // Jump after 5 frames of run-up
  const dt = 1 / 60;
  let penetrated = false;
  let penetrationDetails = null;

  for (let f = 0; f < 60; f++) {
    if (f === 5) {
      controls.input.jump = true;
    } else {
      controls.input.jump = false;
    }
    controls.update(dt);
    const feetY = controls.position.y - 1.7;

    // Check penetration inside solid volume:
    // Player is inside if their bounding cylinder/box overlaps the interior
    // (i.e. x is strictly between minX+0.05 and maxX-0.05, z is between minZ+0.05 and maxZ-0.05,
    // and feetY is below maxY-0.05 and head is above minY+0.05)
    const insideX = controls.position.x > boxMinX + 0.05 && controls.position.x < boxMaxX - 0.05;
    const insideZ = controls.position.z > boxMinZ + 0.05 && controls.position.z < boxMaxZ - 0.05;
    const insideY = feetY < boxMaxY - 0.05 && (feetY + 1.7) > boxMinY + 0.05;

    if (insideX && insideZ && insideY) {
      penetrated = true;
      penetrationDetails = {
        frame: f,
        pos: [+controls.position.x.toFixed(2), +controls.position.y.toFixed(2), +controls.position.z.toFixed(2)],
        feetY: +feetY.toFixed(2),
        boxBounds: { minX: boxMinX, maxX: boxMaxX, minY: boxMinY, maxY: boxMaxY, minZ: boxMinZ, maxZ: boxMaxZ }
      };
      break;
    }
  }

  return {
    boxId: box.id,
    kind: box.kind,
    pass: !penetrated,
    penetrated,
    penetrationDetails
  };
}

// ─── 3d: Perimeter Escape Test ──────────────────────────────────────────────
function testPerimeterEscapes(map) {
  const controls = createControls();
  controls.setBounds(map.bounds);
  controls.setColliders(map.colliders);

  const b = map.bounds;
  const tests = [
    { dir: '+X (East)', pos: [b.maxX - 1.5, 4.5 + 1.7, 0], yaw: -Math.PI / 2 },
    { dir: '-X (West)', pos: [b.minX + 1.5, 4.5 + 1.7, 0], yaw: Math.PI / 2 },
    { dir: '+Z (South)', pos: [0, 4.5 + 1.7, b.maxZ - 1.5], yaw: 0 },
    { dir: '-Z (North)', pos: [0, 4.5 + 1.7, b.minZ + 1.5], yaw: Math.PI },
  ];

  const results = [];
  const dt = 1 / 60;

  for (const t of tests) {
    controls.setPosition(t.pos[0], t.pos[1], t.pos[2], t.yaw);
    controls.input.forward = true;
    controls.input.sprint = true;
    let escaped = false;
    let maxEscapeDist = 0;

    for (let f = 0; f < 60; f++) {
      if (f === 5) {
        controls.input.jump = true;
      } else {
        controls.input.jump = false;
      }
      controls.update(dt);

      if (
        controls.position.x < b.minX - 0.01 ||
        controls.position.x > b.maxX + 0.01 ||
        controls.position.z < b.minZ - 0.01 ||
        controls.position.z > b.maxZ + 0.01
      ) {
        escaped = true;
        const dx = Math.max(0, b.minX - controls.position.x, controls.position.x - b.maxX);
        const dz = Math.max(0, b.minZ - controls.position.z, controls.position.z - b.maxZ);
        maxEscapeDist = Math.max(maxEscapeDist, Math.hypot(dx, dz));
      }
    }

    results.push({
      direction: t.dir,
      escaped,
      maxEscapeDist: +maxEscapeDist.toFixed(3),
      pass: !escaped
    });
  }

  return results;
}

// ─── EXECUTE FULL TEST SUITE ────────────────────────────────────────────────
console.log('================================================================');
console.log('3a. VALIDATING WALKER WITH DELIBERATELY BROKEN COLLIDER');
console.log('================================================================');
const walkerValidation = testWalkerValidation();
console.log(JSON.stringify(walkerValidation, null, 2));

console.log('\n================================================================');
console.log('3b & 3d. STAIR FLIGHTS, BOX JUMPS, AND PERIMETER TESTS ACROSS ALL MAPS');
console.log('================================================================\n');

const suiteReport = {};

for (const mapId of Object.keys(mapFiles)) {
  const map = loadMap(mapId);
  console.log(`\n>>> Testing Map: ${map.name} (${mapId}) <<<`);

  // 1. Stair flight climb & descend tests
  const flightResults = [];
  for (const flight of map.stairFlights) {
    const res = testStairFlight(map, flight);
    flightResults.push(res);
  }

  // 2. Jump toward box tests (all solid boxes)
  const boxResults = [];
  for (const box of map.boxes) {
    const res = testJumpTowardBox(map, box);
    boxResults.push(res);
  }

  // 3. Perimeter escape tests
  const perimeterResults = testPerimeterEscapes(map);

  suiteReport[mapId] = {
    name: map.name,
    stairFlights: flightResults,
    boxes: boxResults,
    perimeter: perimeterResults
  };
}

fs.writeFileSync('scripts/issue2-report.json', JSON.stringify(suiteReport, null, 2));
console.log('\nResults saved to scripts/issue2-report.json');
