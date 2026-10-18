// scripts/analyze-maps-and-colliders.mjs
import fs from 'fs';
import path from 'path';

const mapFiles = {
  range: null,
  foundry: 'public/maps/foundry_yard.json',
  culdesac: 'public/maps/Cul-de-Sac.json',
  dustline: 'public/maps/Dustline Village.json',
  overpass: 'public/maps/Overpass.json',
};

const results = {};

for (const [mapId, filePath] of Object.entries(mapFiles)) {
  if (mapId === 'range') {
    // Range is programmatically created
    // Visual boxes: 1 concrete platform, 1 canopy roof, 3 shooting benches, 3 ammo boxes,
    // 3 sandbag walls (15 bags each = 45 bags), 1 container, 3 berms = 55 visual boxes
    // Colliders inside playable area (bounds minX:-7.5, maxX:7.5, minZ:-3.2, maxZ:5.5): 3 shooting benches
    results[mapId] = {
      name: 'Tactical Shooting Range',
      visualBoxCount: 55, // platform (1), canopy (1), benches (3), ammo boxes (3), container (1), berms (3), sandbags (45)
      colliderCount: 3,
      visualWithNoCollider: [
        'canopy roof (overhead y=4.0, non-colliding)',
        'ammo boxes (decorative small props on tables)',
        'platform (ground floor y=-0.2..0.0)',
        'downrange container (outside playable bounds z=-24)',
        'downrange sandbags (outside playable bounds z <= -12)',
        'perimeter berms (outside playable bounds)'
      ],
      collidersWithNoVisual: [],
      stairFlights: [],
      boxColliders: [
        { id: 'bench_left', center: [-5, 0.45, -2.5], size: [2.2, 0.9, 0.8] },
        { id: 'bench_mid', center: [0, 0.45, -2.5], size: [2.2, 0.9, 0.8] },
        { id: 'bench_right', center: [5, 0.45, -2.5], size: [2.2, 0.9, 0.8] },
      ]
    };
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const boxes = data.boxes || [];

  const visualBoxCount = boxes.length;
  const noColliderBoxes = [];
  const colliders = [];
  const stairBoxes = [];
  const standardBoxes = [];

  for (const box of boxes) {
    const isRoof = box.kind === 'roof';
    const isWalkable = box.kind === 'stairs' || box.kind === 'stair' || box.kind === 'platform';
    const [w, h, d] = box.size;
    const [cx, cy, cz] = box.center;
    const col = {
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

    if (isRoof) {
      noColliderBoxes.push({ id: box.id, kind: box.kind, reason: 'roof element (non-colliding ceiling/roof)' });
    } else {
      colliders.push(col);
      if (box.kind === 'stairs' || box.kind === 'stair') {
        stairBoxes.push(col);
      } else {
        standardBoxes.push(col);
      }
    }
  }

  // Group stair boxes into flights by proximity / ID prefix
  const flightGroups = {};
  for (const sb of stairBoxes) {
    // common prefixes: whSW_stair_0..11 -> whSW_stair, cySE_stair_0..9 -> cySE_stair, etc.
    const prefix = sb.id.replace(/_\d+$/, '').replace(/\d+$/, '');
    if (!flightGroups[prefix]) flightGroups[prefix] = [];
    flightGroups[prefix].push(sb);
  }

  // Sort each flight by elevation (minY ascending)
  const stairFlights = [];
  for (const [flightId, steps] of Object.entries(flightGroups)) {
    steps.sort((a, b) => a.minY - b.minY);
    stairFlights.push({
      flightId,
      stepCount: steps.length,
      bottomY: steps[0].minY,
      topY: steps[steps.length - 1].maxY,
      bottomPos: steps[0].center,
      topPos: steps[steps.length - 1].center,
      steps
    });
  }

  results[mapId] = {
    name: data.meta.name,
    visualBoxCount,
    colliderCount: colliders.length,
    visualWithNoCollider: noColliderBoxes,
    collidersWithNoVisual: [], // BlueprintMapLoader generates 1 mesh per box in data.boxes, so 0 colliders without visuals
    stairFlightCount: stairFlights.length,
    stairFlights,
    standardBoxCount: standardBoxes.length,
    standardBoxes
  };
}

console.log(JSON.stringify(results, null, 2));
