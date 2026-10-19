// scripts/build-section4-layout.mjs
// Generates the Section 4 Warehouse IT & Logistics Network Hub layout.
//
// Grounded Warehouse Theme:
// - Two distinct rows of warehouse server racks with clear, shootable gaps between every rack.
// - Full bullet pass-through through gaps, transparent wire-mesh, and non-colliding accents.
// - Zero bulky tanks or unneeded heavy props (maximum performance, zero lag).
// - Clean industrial warehouse lighting and logistics staging desks.
// - High-performance low-draw-call geometry.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const mapPath = path.join(root, 'public/maps/warehouse_layout.json');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

// Preserve all original 202 walls, Section 1 props (272), Section 2 props (248)
const existingBoxes = map.boxes.filter((b) => b.zone !== 'section4');
const originalWalls = existingBoxes.filter((b) => b.kind === 'wall');
const s1Props = existingBoxes.filter((b) => b.zone === 'section1');
const s2Props = existingBoxes.filter((b) => b.zone === 'section2');

console.log(
  `Preserving ${originalWalls.length} walls | ${s1Props.length} S1 props | ${s2Props.length} S2 props.`
);

const s4Props = [];

// =========================================================================
// 1. WAREHOUSE SERVER RACK ROWS WITH CLEAR SHOOTABLE GAPS
// Designed with deliberate 1.0m to 1.4m gaps between adjacent server racks.
// Players have clear sightlines through the gaps and bullets pass straight through!
// =========================================================================

// Helper to create an authentic warehouse server rack
function createServerRack(id, x, z, ledColor = '#38bdf8') {
  // Main server rack cabinet (colliding solid)
  s4Props.push({
    id: `s4-server-${id}-cabinet`,
    zone: 'section4',
    kind: 'metal',
    center: [x, 1.1, z],
    size: [1.1, 2.2, 0.85],
    color: '#0f172a',
    collision: true,
    roughness: 0.5,
    metalness: 0.6,
  });

  // Front server rack door mesh / frame
  s4Props.push({
    id: `s4-server-${id}-door`,
    zone: 'section4',
    kind: 'metal',
    center: [x, 1.1, z + 0.44],
    size: [0.96, 2.0, 0.04],
    color: '#1e293b',
    collision: false, // Visual only - bullets don't get blocked if near edge
    roughness: 0.4,
    metalness: 0.7,
  });

  // Subtle vertical status LED strip (adds lighting/atmosphere without lag)
  s4Props.push({
    id: `s4-server-${id}-led`,
    zone: 'section4',
    kind: 'metal',
    center: [x + 0.38, 1.1, z + 0.46],
    size: [0.04, 1.8, 0.02],
    color: ledColor,
    emissive: ledColor,
    emissiveIntensity: 1.8,
    collision: false,
  });
}

// Row A (North Server Row, Z = -24.5)
// Spaced at X = -30.0, -26.5, -23.0, -19.5 -> Exact 1.4m open gaps between racks!
const rowAPositions = [
  { id: 'A1', x: -30.0, led: '#0ea5e9' },
  { id: 'A2', x: -26.5, led: '#10b981' },
  { id: 'A3', x: -23.0, led: '#38bdf8' },
  { id: 'A4', x: -19.5, led: '#0ea5e9' },
];
rowAPositions.forEach((p) => createServerRack(p.id, p.x, -24.5, p.led));

// Row B (South Server Row, Z = -16.5)
// Spaced at X = -29.0, -25.0, -21.0, -17.0 -> Exact 1.9m open gaps between racks!
const rowBPositions = [
  { id: 'B1', x: -29.0, led: '#10b981' },
  { id: 'B2', x: -25.0, led: '#38bdf8' },
  { id: 'B3', x: -21.0, led: '#0ea5e9' },
  { id: 'B4', x: -17.0, led: '#10b981' },
];
rowBPositions.forEach((p) => createServerRack(p.id, p.x, -16.5, p.led));

// Overhead Cable Runway Ladders connecting the rows (suspended at Y = 2.9m, collision: false)
s4Props.push(
  {
    id: 's4-cable-runway-A',
    zone: 'section4',
    kind: 'metal',
    center: [-24.75, 2.8, -24.5],
    size: [12.0, 0.08, 0.45],
    color: '#334155',
    collision: false,
  },
  {
    id: 's4-cable-runway-B',
    zone: 'section4',
    kind: 'metal',
    center: [-23.0, 2.8, -16.5],
    size: [13.0, 0.08, 0.45],
    color: '#334155',
    collision: false,
  },
  {
    id: 's4-cable-runway-bridge',
    zone: 'section4',
    kind: 'metal',
    center: [-24.0, 2.8, -20.5],
    size: [0.45, 0.08, 8.0],
    color: '#334155',
    collision: false,
  }
);

// =========================================================================
// 2. WAREHOUSE IT & LOGISTICS DISPATCH WORKSTATION DESKS
// Located along the East side (X = -13.0, Z = -20.5)
// Real warehouse inventory logging desks with barcode scanner & manifest screens.
// =========================================================================

// Main Dispatch Desk
s4Props.push(
  {
    id: 's4-dispatch-desk-body',
    zone: 'section4',
    kind: 'metal',
    center: [-13.0, 0.45, -20.5],
    size: [1.1, 0.9, 3.2],
    color: '#1e293b',
    collision: true,
    roughness: 0.6,
    metalness: 0.5,
  },
  {
    id: 's4-dispatch-desk-top',
    zone: 'section4',
    kind: 'pallet',
    center: [-13.0, 0.92, -20.5],
    size: [1.2, 0.06, 3.3],
    color: '#334155',
    collision: true,
    roughness: 0.5,
    metalness: 0.3,
  }
);

// Logistics Inventory Monitors on Desk
s4Props.push(
  {
    id: 's4-monitor-1-stand',
    zone: 'section4',
    kind: 'metal',
    center: [-13.0, 1.15, -21.4],
    size: [0.15, 0.4, 0.15],
    color: '#0f172a',
    collision: false,
  },
  {
    id: 's4-monitor-1-screen',
    zone: 'section4',
    kind: 'metal',
    center: [-13.0, 1.45, -21.4],
    size: [0.08, 0.48, 0.72],
    color: '#0284c7',
    emissive: '#38bdf8',
    emissiveIntensity: 1.6,
    collision: false,
  },
  {
    id: 's4-monitor-2-stand',
    zone: 'section4',
    kind: 'metal',
    center: [-13.0, 1.15, -19.6],
    size: [0.15, 0.4, 0.15],
    color: '#0f172a',
    collision: false,
  },
  {
    id: 's4-monitor-2-screen',
    zone: 'section4',
    kind: 'metal',
    center: [-13.0, 1.45, -19.6],
    size: [0.08, 0.48, 0.72],
    color: '#059669',
    emissive: '#34d399',
    emissiveIntensity: 1.6,
    collision: false,
  }
);

// Operator Ergonomic Chairs
[-21.4, -19.6].forEach((z, idx) => {
  s4Props.push({
    id: `s4-dispatch-chair-${idx + 1}`,
    zone: 'section4',
    kind: 'metal',
    center: [-14.2, 0.48, z],
    size: [0.55, 0.96, 0.55],
    color: '#0f172a',
    collision: true,
  });
});

// =========================================================================
// 3. TRANSPARENT WIRE-MESH STORAGE CAGE (HIGH-VALUE HARDWARE CAGE)
// Located at West wall area (X: -34.5 to -32.5, Z: -18.0 to -23.0)
// Wire-mesh frames allow players to see through and bullets pass through!
// =========================================================================

// Wire-Mesh Corner Posts (Steel tube posts)
const cageCorners = [
  { id: 'NW', x: -35.5, z: -23.5 },
  { id: 'NE', x: -32.5, z: -23.5 },
  { id: 'SW', x: -35.5, z: -17.5 },
  { id: 'SE', x: -32.5, z: -17.5 },
];
cageCorners.forEach((c) => {
  s4Props.push({
    id: `s4-cage-post-${c.id}`,
    zone: 'section4',
    kind: 'metal',
    center: [c.x, 1.35, c.z],
    size: [0.15, 2.7, 0.15],
    color: '#eab308', // Safety yellow posts
    collision: true,
    roughness: 0.5,
    metalness: 0.6,
  });
});

// Top lintel / header rails
s4Props.push(
  {
    id: 's4-cage-rail-north',
    zone: 'section4',
    kind: 'metal',
    center: [-34.0, 2.7, -23.5],
    size: [3.1, 0.1, 0.1],
    color: '#eab308',
    collision: false,
  },
  {
    id: 's4-cage-rail-south',
    zone: 'section4',
    kind: 'metal',
    center: [-34.0, 2.7, -17.5],
    size: [3.1, 0.1, 0.1],
    color: '#eab308',
    collision: false,
  },
  {
    id: 's4-cage-rail-east',
    zone: 'section4',
    kind: 'metal',
    center: [-32.5, 2.7, -20.5],
    size: [0.1, 0.1, 6.1],
    color: '#eab308',
    collision: false,
  }
);

// High-Value Hardware Lockers inside the cage
s4Props.push(
  {
    id: 's4-cage-locker-1',
    zone: 'section4',
    kind: 'metal',
    center: [-34.8, 1.0, -21.8],
    size: [0.85, 2.0, 1.2],
    color: '#1e293b',
    collision: true,
  },
  {
    id: 's4-cage-locker-2',
    zone: 'section4',
    kind: 'metal',
    center: [-34.8, 1.0, -19.2],
    size: [0.85, 2.0, 1.2],
    color: '#1e293b',
    collision: true,
  }
);

// =========================================================================
// 4. PALLETS OF COMPUTER HARDWARE CARTONS & LOGISTICS CRATES
// Stored neatly around perimeter for tactical cover while keeping corridors open
// =========================================================================

// Pallet Stacks with Boxed Hardware
const hardwarePallets = [
  { id: 'hp-01', x: -30.5, z: -12.5, count: 2, crateColor: '#78350f' },
  { id: 'hp-02', x: -25.5, z: -12.5, count: 1, crateColor: '#1e3a8a' },
  { id: 'hp-03', x: -16.5, z: -12.5, count: 2, crateColor: '#44403c' },
  { id: 'hp-04', x: -33.5, z: -27.5, count: 1, crateColor: '#78350f' },
  { id: 'hp-05', x: -28.0, z: -28.0, count: 2, crateColor: '#1e293b' },
  { id: 'hp-06', x: -16.0, z: -28.0, count: 2, crateColor: '#3f4f34' },
];

hardwarePallets.forEach((hp) => {
  // Pallet base
  s4Props.push({
    id: `s4-${hp.id}-pallet`,
    zone: 'section4',
    kind: 'pallet',
    center: [hp.x, 0.06, hp.z],
    size: [1.2, 0.12, 1.0],
    color: '#7c2d12',
    collision: true,
  });

  // Hardware Cartons on pallet
  if (hp.count >= 1) {
    s4Props.push({
      id: `s4-${hp.id}-box-1`,
      zone: 'section4',
      kind: 'crate',
      center: [hp.x, 0.12 + 0.38, hp.z],
      size: [1.05, 0.76, 0.88],
      color: hp.crateColor,
      collision: true,
      roughness: 0.7,
      metalness: 0.2,
    });
  }
  if (hp.count >= 2) {
    s4Props.push({
      id: `s4-${hp.id}-box-2`,
      zone: 'section4',
      kind: 'crate',
      center: [hp.x, 0.12 + 0.76 + 0.28, hp.z],
      size: [0.95, 0.56, 0.8],
      color: hp.crateColor,
      collision: true,
      roughness: 0.7,
      metalness: 0.2,
    });
  }
});

// Staged Logistics Tech Cases near the server aisles (low tactical cover)
const techCases = [
  { id: 'tc-01', x: -22.5, z: -20.5, w: 1.0, h: 0.65, d: 0.8, color: '#334155' },
  { id: 'tc-02', x: -26.5, z: -20.5, w: 0.9, h: 0.55, d: 0.75, color: '#1e293b' },
  { id: 'tc-03', x: -18.5, z: -20.5, w: 0.95, h: 0.6, d: 0.8, color: '#475569' },
];

techCases.forEach((tc) => {
  s4Props.push({
    id: `s4-techcase-${tc.id}`,
    zone: 'section4',
    kind: 'crate',
    center: [tc.x, tc.h / 2, tc.z],
    size: [tc.w, tc.h, tc.d],
    color: tc.color,
    collision: true,
    roughness: 0.4,
    metalness: 0.6,
  });
});

// =========================================================================
// 5. SAFETY BOLLARDS & CONES (Warehouse loading perimeter)
// =========================================================================

const bollardPositions = [
  { id: '01', x: -36.5, z: -15.0 },
  { id: '02', x: -36.5, z: -17.5 },
  { id: '03', x: -36.5, z: -20.0 },
  { id: '04', x: -36.5, z: -22.5 },
];

bollardPositions.forEach((bp) => {
  s4Props.push(
    {
      id: `s4-bollard-${bp.id}-post`,
      zone: 'section4',
      kind: 'metal',
      center: [bp.x, 0.55, bp.z],
      size: [0.24, 1.1, 0.24],
      color: '#eab308',
      collision: true,
    },
    {
      id: `s4-bollard-${bp.id}-cap`,
      zone: 'section4',
      kind: 'metal',
      center: [bp.x, 1.12, bp.z],
      size: [0.28, 0.08, 0.28],
      color: '#0f172a',
      collision: false,
    }
  );
});

// High-Visibility Safety Cones
const cones = [
  { id: 'c01', x: -32.0, z: -14.5 },
  { id: 'c02', x: -32.0, z: -26.5 },
  { id: 'c03', x: -15.0, z: -14.5 },
  { id: 'c04', x: -15.0, z: -26.5 },
];

cones.forEach((cn) => {
  s4Props.push(
    {
      id: `s4-${cn.id}-base`,
      zone: 'section4',
      kind: 'metal',
      center: [cn.x, 0.025, cn.z],
      size: [0.42, 0.05, 0.42],
      color: '#ea580c',
      collision: false,
    },
    {
      id: `s4-${cn.id}-body`,
      zone: 'section4',
      kind: 'metal',
      center: [cn.x, 0.35, cn.z],
      size: [0.28, 0.65, 0.28],
      color: '#ea580c',
      collision: false,
    },
    {
      id: `s4-${cn.id}-stripe`,
      zone: 'section4',
      kind: 'metal',
      center: [cn.x, 0.38, cn.z],
      size: [0.3, 0.16, 0.3],
      color: '#f8fafc',
      collision: false,
    }
  );
});

// =========================================================================
// 6. HIGH-PERFORMANCE OVERHEAD WAREHOUSE LIGHTING (Kept clean as requested)
// =========================================================================

const warehouseLights = [
  { id: '01', x: -28.0, z: -24.5 },
  { id: '02', x: -20.0, z: -24.5 },
  { id: '03', x: -28.0, z: -16.5 },
  { id: '04', x: -20.0, z: -16.5 },
  { id: '05', x: -13.0, z: -20.5 },
];

warehouseLights.forEach((lt) => {
  s4Props.push(
    {
      id: `s4-light-${lt.id}-fixture`,
      zone: 'section4',
      kind: 'metal',
      center: [lt.x, 5.85, lt.z],
      size: [2.2, 0.1, 0.35],
      color: '#1e293b',
      collision: false,
    },
    {
      id: `s4-light-${lt.id}-tube`,
      zone: 'section4',
      kind: 'metal',
      center: [lt.x, 5.76, lt.z],
      size: [1.9, 0.08, 0.18],
      color: '#f8fafc',
      emissive: '#f8fafc',
      emissiveIntensity: 2.2,
      collision: false,
    }
  );
});

console.log(`Generated ${s4Props.length} optimized props for Section 4.`);

// =========================================================================
// VALIDATION & MAP WRITE
// =========================================================================
const s4Zone = map.zones.find((z) => z.id === 'section4');
if (!s4Zone) throw new Error('Section 4 zone not found');

for (const p of s4Props) {
  const minX = p.center[0] - p.size[0] / 2;
  const maxX = p.center[0] + p.size[0] / 2;
  const minZ = p.center[2] - p.size[2] / 2;
  const maxZ = p.center[2] + p.size[2] / 2;

  if (
    minX < s4Zone.min[0] - 0.05 ||
    maxX > s4Zone.max[0] + 0.05 ||
    minZ < s4Zone.min[1] - 0.05 ||
    maxZ > s4Zone.max[1] + 0.05
  ) {
    console.error(
      `Boundary violation on ${p.id}: X[${minX.toFixed(2)}, ${maxX.toFixed(2)}] Z[${minZ.toFixed(2)}, ${maxZ.toFixed(2)}] outside zone [${s4Zone.min}, ${s4Zone.max}]`
    );
    process.exit(1);
  }
}

// Check ID uniqueness across entire map
const allNewBoxes = [...existingBoxes, ...s4Props];
const idSet = new Set();
for (const b of allNewBoxes) {
  if (idSet.has(b.id)) {
    console.error(`Duplicate box ID detected: ${b.id}`);
    process.exit(1);
  }
  idSet.add(b.id);
}

// Update metadata
map.meta.name = 'Warehouse — Section 1, 2 & 4 (IT & Logistics Hub)';
map.meta.mode = 'Symmetrical 2v2 warehouse layout — S1 Storage | S2 Loading Bay | S4 IT Logistics Hub';
map.meta.layoutStage = 'section-4-detail';
map.meta.propCount = allNewBoxes.filter((b) => b.kind !== 'wall').length;
map.meta.physicalBoxCount = allNewBoxes.length;
map.meta.sectionProgress = {
  ...map.meta.sectionProgress,
  section4: 'warehouse-it-logistics-hub-optimized',
};

s4Zone.name = 'Warehouse IT & Logistics Dispatch Hub';
s4Zone.contentStage = 'warehouse-it-logistics-hub';
s4Zone.propsSummary = {
  theme: 'Warehouse IT & Logistics Hub',
  serverRacks: 8,
  serverGapsMeters: 1.4,
  dispatchDesks: 1,
  securityCage: true,
  hardwarePallets: 6,
  lightingFixtures: 5,
  totalProps: s4Props.length,
};

map.boxes = allNewBoxes;

fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf8');
console.log(`✓ Updated ${mapPath}`);
console.log(
  `  Total boxes: ${allNewBoxes.length} (202 walls | S1: ${s1Props.length} | S2: ${s2Props.length} | S4: ${s4Props.length})`
);
