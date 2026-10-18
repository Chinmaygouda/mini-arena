// scripts/audit-all-staircases.mjs
import fs from 'fs';
import * as THREE from 'three';
import { FirstPersonControls } from '../src/player/firstPersonControls.ts';

const maps = [
  { id: 'foundry', file: 'public/maps/foundry_yard.json' },
  { id: 'dustline', file: 'public/maps/Dustline Village.json' },
  { id: 'overpass', file: 'public/maps/Overpass.json' },
];

function buildColliders(boxes) {
  return boxes.filter(b => b.kind !== 'roof').map(b => {
    const [w, h, d] = b.size;
    const [cx, cy, cz] = b.center;
    return {
      id: b.id,
      zone: b.zone,
      kind: b.kind,
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minY: cy - h / 2,
      maxY: cy + h / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      isWalkable: b.kind === 'stair' || b.kind === 'stairs' || b.kind === 'platform'
    };
  });
}

function getFlightId(box) {
  if (box.zone) return box.zone;
  const isB = box.id.includes('_B');
  const base = box.id.replace(/_B$/, '').replace(/\d+$/, '');
  return `${base}_${isB ? 'B' : 'A'}`;
}

function findStairFlights(colliders) {
  const stairBoxes = colliders.filter(c => c.kind === 'stair' || c.kind === 'stairs');
  const flightMap = new Map();

  for (const sb of stairBoxes) {
    const flightId = getFlightId(sb);
    if (!flightMap.has(flightId)) flightMap.set(flightId, []);
    flightMap.get(flightId).push(sb);
  }

  const flights = [];
  for (const [id, steps] of flightMap.entries()) {
    steps.sort((a, b) => a.maxY - b.maxY);
    const bottom = steps[0];
    const top = steps[steps.length - 1];

    // Determine primary orientation
    const dx = ((top.minX + top.maxX)/2) - ((bottom.minX + bottom.maxX)/2);
    const dz = ((top.minZ + top.maxZ)/2) - ((bottom.minZ + bottom.maxZ)/2);
    let yawAscend = 0;
    if (Math.abs(dz) >= Math.abs(dx)) {
      yawAscend = dz < 0 ? 0 : Math.PI; // 0 faces -Z, Math.PI faces +Z
    } else {
      yawAscend = dx > 0 ? -Math.PI / 2 : Math.PI / 2; // -PI/2 faces +X, PI/2 faces -X
    }

    flights.push({
      id,
      stepCount: steps.length,
      bottomY: bottom.minY,
      topY: top.maxY,
      bottomPos: { x: (bottom.minX + bottom.maxX)/2, z: (bottom.minZ + bottom.maxZ)/2 },
      topPos: { x: (top.minX + top.maxX)/2, z: (top.minZ + top.maxZ)/2 },
      yawAscend,
      steps
    });
  }
  return flights;
}

console.log('========================================================================');
console.log(' INDEPENDENT STAIRCASE TRAVERSAL AUDIT — ALL 8 FLIGHTS ACROSS ALL MAPS');
console.log('========================================================================\n');

const dt = 1 / 60;
const results = [];

for (const map of maps) {
  const raw = JSON.parse(fs.readFileSync(map.file, 'utf8'));
  const colliders = buildColliders(raw.boxes);
  const flights = findStairFlights(colliders);

  for (const flight of flights) {
    const camera = new THREE.PerspectiveCamera(75, 16/9, 0.1, 1000);
    const domEl = { addEventListener: () => {} };
    const controls = new FirstPersonControls(camera, domEl);
    controls.setBounds({ minX: -60, maxX: 60, minZ: -60, maxZ: 60 });
    controls.setColliders(colliders);

    // 1. ASCENT TEST
    // Start slightly before first step along direction of ascent
    const fwdX = -Math.sin(flight.yawAscend);
    const fwdZ = -Math.cos(flight.yawAscend);
    const startX = flight.bottomPos.x - fwdX * 0.45;
    const startZ = flight.bottomPos.z - fwdZ * 0.45;

    controls.setPosition(startX, 1.7, startZ, flight.yawAscend);
    controls.input.forward = true;

    let ascentAirborneFrames = 0;
    let maxCamDeltaYAscent = 0;
    let prevCamY = camera.position.y;

    for (let f = 0; f < 120; f++) {
      controls.update(dt);
      if (!controls.isGrounded) ascentAirborneFrames++;
      const dCam = Math.abs(camera.position.y - prevCamY);
      if (f > 1 && dCam > maxCamDeltaYAscent) maxCamDeltaYAscent = dCam;
      prevCamY = camera.position.y;

      const distToTop = Math.hypot(controls.position.x - flight.topPos.x, controls.position.z - flight.topPos.z);
      if (distToTop < 0.6 && controls.position.y >= flight.topY + 1.5) break;
    }

    const ascentReachedTop = controls.position.y >= flight.topY + 1.5;

    // 2. DESCENT TEST
    // Turn 180 degrees and descend
    controls.yaw = (flight.yawAscend + Math.PI) % (2 * Math.PI);
    controls.input.forward = true;

    let descentAirborneFrames = 0;
    let maxCamDeltaYDescent = 0;
    prevCamY = camera.position.y;

    for (let f = 0; f < 120; f++) {
      controls.update(dt);
      if (!controls.isGrounded) descentAirborneFrames++;
      const dCam = Math.abs(camera.position.y - prevCamY);
      if (f > 1 && dCam > maxCamDeltaYDescent) maxCamDeltaYDescent = dCam;
      prevCamY = camera.position.y;

      const distToBottom = Math.hypot(controls.position.x - flight.bottomPos.x, controls.position.z - flight.bottomPos.z);
      if (distToBottom < 0.8 && controls.position.y <= flight.bottomY + 1.8) break;
    }

    const descentReachedBottom = controls.position.y <= flight.bottomY + 1.8;

    results.push({
      map: map.id,
      flight: flight.id,
      steps: flight.stepCount,
      ascentTop: ascentReachedTop,
      ascentAirborne: ascentAirborneFrames,
      maxCamAscentCm: +(maxCamDeltaYAscent * 100).toFixed(2),
      descentBottom: descentReachedBottom,
      descentAirborne: descentAirborneFrames,
      maxCamDescentCm: +(maxCamDeltaYDescent * 100).toFixed(2),
      verdict: (ascentReachedTop && descentReachedBottom && ascentAirborneFrames === 0 && descentAirborneFrames === 0) ? 'PASS' : 'FAIL'
    });
  }
}

console.table(results);
