// scripts/build-section2-layout.mjs
// Generates the comprehensive Section 2 Loading Bay layout for the Warehouse map.
// Distinct 3 East-West rack rows, open cross-aisle loading bay, detailed forklift assembly,
// and realistic industrial loading bay props.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const mapPath = path.join(root, 'public/maps/warehouse_layout.json');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

// Filter out any previous section 2 props, keeping all original 202 walls and section 1 props intact
const existingBoxes = map.boxes.filter((b) => b.zone !== 'section2');
const originalWalls = existingBoxes.filter((b) => b.kind === 'wall');
const section1Props = existingBoxes.filter((b) => b.zone === 'section1');

console.log(`Preserving ${originalWalls.length} original wall segments and ${section1Props.length} Section 1 props.`);

const section2Props = [];

/**
 * Helper to build an East-West rack run.
 * In Section 2, racks run parallel to the X axis (East-West).
 * zCenter: Z coordinate of the rack center line
 * xStart: West X coordinate (more negative)
 * xEnd: East X coordinate (less negative)
 * bayWidth: Distance between uprights along X (e.g. 2.5m or 3.0m)
 * config: per-bay cargo configuration
 */
function buildEastWestRack(rackId, zCenter, xStart, xEnd, bayWidth, bayConfigs) {
  const rackDepth = 1.16; // Rack depth along Z
  const zFront = zCenter + rackDepth / 2;
  const zBack = zCenter - rackDepth / 2;
  const uprightHeight = 3.4;
  const uprightSize = 0.12;

  const numBays = Math.round((xEnd - xStart) / bayWidth);
  const uprightColor = '#2b3542'; // Dark slate/charcoal steel uprights
  const beamColor = '#ca8a04';    // Industrial traffic gold/amber crossbeams
  const deckColor = '#1a202c';    // Dark matte industrial shelf deck

  // 1. Uprights along X
  for (let i = 0; i <= numBays; i++) {
    const x = xStart + i * bayWidth;
    const idx = String(i + 1).padStart(2, '0');

    // Front upright (+Z)
    section2Props.push({
      id: `${rackId}-upright-F-${idx}`,
      zone: 'section2',
      kind: 'metal',
      center: [Number(x.toFixed(2)), uprightHeight / 2, Number(zFront.toFixed(2))],
      size: [uprightSize, uprightHeight, uprightSize],
      color: uprightColor,
      roughness: 0.55,
      metalness: 0.45,
    });

    // Back upright (-Z)
    section2Props.push({
      id: `${rackId}-upright-B-${idx}`,
      zone: 'section2',
      kind: 'metal',
      center: [Number(x.toFixed(2)), uprightHeight / 2, Number(zBack.toFixed(2))],
      size: [uprightSize, uprightHeight, uprightSize],
      color: uprightColor,
      roughness: 0.55,
      metalness: 0.45,
    });

    // Cross-ties between front and back uprights
    const tieLevels = [0.62, 1.94, 3.32];
    tieLevels.forEach((y, tIdx) => {
      section2Props.push({
        id: `${rackId}-tie-${tIdx + 1}-${idx}`,
        zone: 'section2',
        kind: 'metal',
        center: [Number(x.toFixed(2)), y, Number(zCenter.toFixed(2))],
        size: [uprightSize, 0.08, Number((rackDepth - uprightSize).toFixed(2))],
        color: uprightColor,
        collision: false,
        roughness: 0.6,
        metalness: 0.4,
      });
    });
  }

  // 2. Longitudinal crossbeams along X for each bay
  for (let b = 0; b < numBays; b++) {
    const xMid = xStart + (b + 0.5) * bayWidth;
    const bayId = String(b + 1).padStart(2, '0');
    const spanX = Number((bayWidth - 0.04).toFixed(2));

    // Level 1 beams (lower shelf: Y = 0.62)
    section2Props.push({
      id: `${rackId}-beam-1F-${bayId}`,
      zone: 'section2',
      kind: 'metal',
      center: [Number(xMid.toFixed(2)), 0.62, Number(zFront.toFixed(2))],
      size: [spanX, 0.12, 0.10],
      color: beamColor,
      roughness: 0.45,
      metalness: 0.35,
    });
    section2Props.push({
      id: `${rackId}-beam-1B-${bayId}`,
      zone: 'section2',
      kind: 'metal',
      center: [Number(xMid.toFixed(2)), 0.62, Number(zBack.toFixed(2))],
      size: [spanX, 0.12, 0.10],
      color: beamColor,
      roughness: 0.45,
      metalness: 0.35,
    });

    // Level 2 beams (upper shelf: Y = 1.94)
    section2Props.push({
      id: `${rackId}-beam-2F-${bayId}`,
      zone: 'section2',
      kind: 'metal',
      center: [Number(xMid.toFixed(2)), 1.94, Number(zFront.toFixed(2))],
      size: [spanX, 0.12, 0.10],
      color: beamColor,
      roughness: 0.45,
      metalness: 0.35,
    });
    section2Props.push({
      id: `${rackId}-beam-2B-${bayId}`,
      zone: 'section2',
      kind: 'metal',
      center: [Number(xMid.toFixed(2)), 1.94, Number(zBack.toFixed(2))],
      size: [spanX, 0.12, 0.10],
      color: beamColor,
      roughness: 0.45,
      metalness: 0.35,
    });

    // Upper shelf deck plate
    section2Props.push({
      id: `${rackId}-deck-upper-${bayId}`,
      zone: 'section2',
      kind: 'metal',
      center: [Number(xMid.toFixed(2)), 1.98, Number(zCenter.toFixed(2))],
      size: [spanX, 0.06, Number((rackDepth - 0.08).toFixed(2))],
      color: deckColor,
      collision: false,
      roughness: 0.85,
      metalness: 0.15,
    });

    // 3. Bay Cargo Configuration
    const cfg = bayConfigs[b] || { lower: 'pallet-crate', upper: 'empty' };

    // Lower Cargo / Pallet
    if (cfg.lower) {
      const palletH = 0.12;
      const palletW = Number((bayWidth * 0.72).toFixed(2));
      const palletD = 0.95;

      section2Props.push({
        id: `${rackId}-pallet-lower-${bayId}`,
        zone: 'section2',
        kind: 'pallet',
        center: [Number(xMid.toFixed(2)), palletH / 2, Number(zCenter.toFixed(2))],
        size: [palletW, palletH, palletD],
        color: '#854d0e',
        collision: false,
        roughness: 0.9,
        metalness: 0.05,
      });

      if (cfg.lowerCrate) {
        const c = cfg.lowerCrate;
        section2Props.push({
          id: `${rackId}-crate-lower-${bayId}`,
          zone: 'section2',
          kind: 'crate',
          center: [Number(xMid.toFixed(2)) + (c.dx || 0), palletH + c.h / 2, Number(zCenter.toFixed(2)) + (c.dz || 0)],
          size: [c.w, c.h, c.d],
          color: c.color,
          roughness: c.roughness || 0.75,
          metalness: c.metalness || 0.15,
        });

        if (c.secondCrate) {
          const c2 = c.secondCrate;
          section2Props.push({
            id: `${rackId}-crate-lower-stack2-${bayId}`,
            zone: 'section2',
            kind: 'crate',
            center: [Number(xMid.toFixed(2)) + (c2.dx || 0), palletH + c.h + c2.h / 2, Number(zCenter.toFixed(2)) + (c2.dz || 0)],
            size: [c2.w, c2.h, c2.d],
            color: c2.color,
            roughness: c2.roughness || 0.75,
            metalness: c2.metalness || 0.15,
          });
        }
      }
    }

    // Upper Cargo
    if (cfg.upperCrate) {
      const uc = cfg.upperCrate;
      const baseDeckY = 2.01;
      section2Props.push({
        id: `${rackId}-crate-upper-${bayId}`,
        zone: 'section2',
        kind: 'crate',
        center: [Number(xMid.toFixed(2)) + (uc.dx || 0), baseDeckY + uc.h / 2, Number(zCenter.toFixed(2)) + (uc.dz || 0)],
        size: [uc.w, uc.h, uc.d],
        color: uc.color,
        roughness: uc.roughness || 0.75,
        metalness: uc.metalness || 0.15,
      });
    }
  }
}

// =========================================================================
// 1. BUILD THREE DISTINCT EAST-WEST RACK ROWS
// =========================================================================

// Row 1: South Rack Row (Z = 14.6, X from -24.5 to -13.0, 5 bays of 2.3m)
// Leaves a generous 2.52m South corridor (Z from 11.5 to 14.02) and 2.5m East corridor
buildEastWestRack('s2-rack-01', 14.6, -24.5, -13.0, 2.3, [
  {
    // Bay 1: Olive drab military supply containers
    lower: true,
    lowerCrate: { w: 1.5, h: 0.65, d: 0.9, color: '#3f4f34', roughness: 0.6, metalness: 0.25 },
    upperCrate: { w: 1.4, h: 0.75, d: 0.85, color: '#4d5d42', roughness: 0.65, metalness: 0.2 },
  },
  {
    // Bay 2: Dark spruce export crate with upper stack
    lower: true,
    lowerCrate: {
      w: 1.4, h: 0.55, d: 0.9, color: '#92400e',
      secondCrate: { w: 1.2, h: 0.50, d: 0.85, color: '#78350f' }
    },
    upperCrate: { w: 1.2, h: 0.60, d: 0.85, color: '#a16207' },
  },
  {
    // Bay 3: Heavy machinery shipping box, upper shelf open/empty
    lower: true,
    lowerCrate: { w: 1.6, h: 0.95, d: 0.92, color: '#57534e', roughness: 0.7, metalness: 0.2 },
    upperCrate: null, // open top shelf
  },
  {
    // Bay 4: Cardboard freight boxes on lower and upper
    lower: true,
    lowerCrate: { w: 1.3, h: 0.65, d: 0.88, color: '#d97706', roughness: 0.85, metalness: 0.05 },
    upperCrate: { w: 1.5, h: 0.55, d: 0.85, color: '#b45309', roughness: 0.85, metalness: 0.05 },
  },
  {
    // Bay 5: Stamped container crate on upper, empty lower shelf
    lower: false,
    upperCrate: { w: 1.6, h: 0.70, d: 0.90, color: '#334155', roughness: 0.55, metalness: 0.4 },
  },
]);

// Row 2: Middle Rack Row (Z = 19.5, X from -21.8 to -13.4, 3 bays of 2.8m)
// Ends early at X = -21.8 creating a 4.7m open cross-aisle into the loading bay,
// and ends at X = -13.4 creating a wide 2.9m continuous East passage
buildEastWestRack('s2-rack-02', 19.5, -21.8, -13.4, 2.8, [
  {
    // Bay 1: Dual steel shipping drums / containers
    lower: true,
    lowerCrate: { w: 1.8, h: 0.80, d: 0.95, color: '#1e3a8a', roughness: 0.5, metalness: 0.4 },
    upperCrate: { w: 1.6, h: 0.65, d: 0.90, color: '#1f2937', roughness: 0.55, metalness: 0.35 },
  },
  {
    // Bay 2: High-stacked cedar crates
    lower: true,
    lowerCrate: {
      w: 1.6, h: 0.58, d: 0.92, color: '#854d0e',
      secondCrate: { w: 1.4, h: 0.52, d: 0.88, color: '#a16207' }
    },
    upperCrate: { w: 1.7, h: 0.60, d: 0.88, color: '#78350f' },
  },
  {
    // Bay 3: Heavy duty equipment crate, open upper
    lower: true,
    lowerCrate: { w: 1.9, h: 0.90, d: 0.95, color: '#44403c', roughness: 0.65, metalness: 0.25 },
    upperCrate: null,
  },
]);

// Row 3: North Rack Row (Z = 24.4, X from -24.5 to -13.0, 5 bays of 2.3m)
// Leaves a generous 2.52m North corridor (Z from 24.98 to 27.5) and 2.5m East corridor
buildEastWestRack('s2-rack-03', 24.4, -24.5, -13.0, 2.3, [
  {
    // Bay 1: Stamped parts containers
    lower: true,
    lowerCrate: { w: 1.4, h: 0.70, d: 0.90, color: '#475569', roughness: 0.5, metalness: 0.4 },
    upperCrate: { w: 1.3, h: 0.65, d: 0.85, color: '#334155', roughness: 0.5, metalness: 0.4 },
  },
  {
    // Bay 2: Light shipping boxes, double stack lower
    lower: true,
    lowerCrate: {
      w: 1.3, h: 0.52, d: 0.85, color: '#b45309',
      secondCrate: { w: 1.1, h: 0.48, d: 0.80, color: '#d97706' }
    },
    upperCrate: { w: 1.4, h: 0.55, d: 0.85, color: '#a16207' },
  },
  {
    // Bay 3: Lower open, upper cargo
    lower: false,
    upperCrate: { w: 1.5, h: 0.75, d: 0.88, color: '#3f4f34', roughness: 0.65, metalness: 0.2 },
  },
  {
    // Bay 4: Heavy timber transport crate
    lower: true,
    lowerCrate: { w: 1.6, h: 0.85, d: 0.92, color: '#78350f' },
    upperCrate: null,
  },
  {
    // Bay 5: Sturdy industrial supply box
    lower: true,
    lowerCrate: { w: 1.4, h: 0.68, d: 0.88, color: '#92400e' },
    upperCrate: { w: 1.3, h: 0.58, d: 0.82, color: '#854d0e' },
  },
]);

console.log(`Generated ${section2Props.length} rack elements across 3 East-West rows.`);

// =========================================================================
// 2. DETAILED FORKLIFT MODEL ASSEMBLY (Center: X = -28.5, Z = 18.0)
// =========================================================================
// Oriented facing +X (East, toward the open middle aisle and racks)
// Sensible low-poly industrial proportions:
// Chassis length 1.5m, width 1.1m, height 0.65m.
// Ground contact Y = 0 (wheel bottom at Y = 0).

const fx = -28.5;
const fz = 18.0;

// A. Chassis & Body
section2Props.push(
  {
    id: 's2-forklift-chassis-main',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx, 0.44, fz],
    size: [1.38, 0.56, 1.04],
    color: '#d97706', // Safety yellow/orange
    roughness: 0.45,
    metalness: 0.35,
  },
  {
    id: 's2-forklift-counterweight',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx - 0.78, 0.48, fz],
    size: [0.46, 0.64, 1.02],
    color: '#1f2937', // Heavy cast iron charcoal counterweight
    roughness: 0.75,
    metalness: 0.5,
  },
  {
    id: 's2-forklift-front-cowl',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx + 0.62, 0.56, fz],
    size: [0.32, 0.42, 0.96],
    color: '#d97706',
    roughness: 0.45,
    metalness: 0.35,
  },
  {
    id: 's2-forklift-side-step-L',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx, 0.18, fz + 0.56],
    size: [0.85, 0.06, 0.16],
    color: '#111827',
    collision: false,
  },
  {
    id: 's2-forklift-side-step-R',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx, 0.18, fz - 0.56],
    size: [0.85, 0.06, 0.16],
    color: '#111827',
    collision: false,
  }
);

// B. Four Wheels (Resting exactly on ground Y = 0)
// Front drive wheels: radius 0.28m (diameter 0.56m, center Y = 0.28)
// Rear steer wheels: radius 0.24m (diameter 0.48m, center Y = 0.24)
section2Props.push(
  {
    id: 's2-forklift-wheel-FL',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx + 0.48, 0.28, fz + 0.55],
    size: [0.56, 0.56, 0.22],
    color: '#111827',
    roughness: 0.9,
    metalness: 0.1,
  },
  {
    id: 's2-forklift-wheel-FR',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx + 0.48, 0.28, fz - 0.55],
    size: [0.56, 0.56, 0.22],
    color: '#111827',
    roughness: 0.9,
    metalness: 0.1,
  },
  {
    id: 's2-forklift-wheel-RL',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx - 0.62, 0.24, fz + 0.53],
    size: [0.48, 0.48, 0.20],
    color: '#111827',
    roughness: 0.9,
    metalness: 0.1,
  },
  {
    id: 's2-forklift-wheel-RR',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx - 0.62, 0.24, fz - 0.53],
    size: [0.48, 0.48, 0.20],
    color: '#111827',
    roughness: 0.9,
    metalness: 0.1,
  },
  // Steel rim centers
  {
    id: 's2-forklift-hub-FL',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.48, 0.28, fz + 0.64],
    size: [0.26, 0.26, 0.05],
    color: '#64748b',
    collision: false,
  },
  {
    id: 's2-forklift-hub-FR',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.48, 0.28, fz - 0.64],
    size: [0.26, 0.26, 0.05],
    color: '#64748b',
    collision: false,
  }
);

// C. Operator Cockpit (Seat, Steering Column, Wheel, Levers)
section2Props.push(
  {
    id: 's2-forklift-seat-cushion',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx - 0.12, 0.78, fz],
    size: [0.42, 0.12, 0.44],
    color: '#111827',
    roughness: 0.85,
    metalness: 0.1,
  },
  {
    id: 's2-forklift-seat-back',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx - 0.31, 1.02, fz],
    size: [0.10, 0.42, 0.42],
    color: '#111827',
    roughness: 0.85,
    metalness: 0.1,
  },
  {
    id: 's2-forklift-steering-column',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx + 0.32, 0.88, fz],
    size: [0.08, 0.36, 0.08],
    color: '#334155',
    collision: false,
  },
  {
    id: 's2-forklift-steering-wheel',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx + 0.28, 1.08, fz],
    size: [0.28, 0.05, 0.28],
    color: '#1e293b',
    collision: false,
  },
  {
    id: 's2-forklift-control-levers',
    zone: 'section2',
    kind: 'vehicle',
    center: [fx + 0.22, 0.94, fz + 0.28],
    size: [0.06, 0.18, 0.12],
    color: '#94a3b8',
    collision: false,
  }
);

// D. Overhead Protective Roll Cage (FOPS / ROPS)
section2Props.push(
  // 4 Corner Pillars
  {
    id: 's2-forklift-pillar-FL',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.45, 1.42, fz + 0.42],
    size: [0.07, 1.34, 0.07],
    color: '#1f2937',
  },
  {
    id: 's2-forklift-pillar-FR',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.45, 1.42, fz - 0.42],
    size: [0.07, 1.34, 0.07],
    color: '#1f2937',
  },
  {
    id: 's2-forklift-pillar-RL',
    zone: 'section2',
    kind: 'metal',
    center: [fx - 0.55, 1.42, fz + 0.42],
    size: [0.07, 1.34, 0.07],
    color: '#1f2937',
  },
  {
    id: 's2-forklift-pillar-RR',
    zone: 'section2',
    kind: 'metal',
    center: [fx - 0.55, 1.42, fz - 0.42],
    size: [0.07, 1.34, 0.07],
    color: '#1f2937',
  },
  // Roof Frame
  {
    id: 's2-forklift-roof-frame',
    zone: 'section2',
    kind: 'metal',
    center: [fx - 0.05, 2.08, fz],
    size: [1.14, 0.06, 0.92],
    color: '#111827',
  },
  // Roof Slats (safety grid)
  {
    id: 's2-forklift-roof-slat-1',
    zone: 'section2',
    kind: 'metal',
    center: [fx - 0.32, 2.09, fz],
    size: [0.04, 0.04, 0.86],
    color: '#1f2937',
    collision: false,
  },
  {
    id: 's2-forklift-roof-slat-2',
    zone: 'section2',
    kind: 'metal',
    center: [fx - 0.05, 2.09, fz],
    size: [0.04, 0.04, 0.86],
    color: '#1f2937',
    collision: false,
  },
  {
    id: 's2-forklift-roof-slat-3',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.22, 2.09, fz],
    size: [0.04, 0.04, 0.86],
    color: '#1f2937',
    collision: false,
  },
  // Warning Beacon
  {
    id: 's2-forklift-beacon',
    zone: 'section2',
    kind: 'metal',
    center: [fx - 0.50, 2.18, fz],
    size: [0.12, 0.14, 0.12],
    color: '#f59e0b',
    collision: false,
  }
);

// E. Front Mast, Hydraulic Ram & Carriage
section2Props.push(
  // Dual Channel Mast (Left & Right)
  {
    id: 's2-forklift-mast-L',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.88, 1.25, fz + 0.34],
    size: [0.10, 2.30, 0.08],
    color: '#1e293b',
    roughness: 0.5,
    metalness: 0.5,
  },
  {
    id: 's2-forklift-mast-R',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.88, 1.25, fz - 0.34],
    size: [0.10, 2.30, 0.08],
    color: '#1e293b',
    roughness: 0.5,
    metalness: 0.5,
  },
  // Mast Top & Mid Braces
  {
    id: 's2-forklift-mast-brace-top',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.88, 2.34, fz],
    size: [0.10, 0.08, 0.72],
    color: '#1e293b',
    collision: false,
  },
  {
    id: 's2-forklift-mast-brace-mid',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.88, 1.35, fz],
    size: [0.10, 0.08, 0.72],
    color: '#1e293b',
    collision: false,
  },
  // Central Hydraulic Lift Cylinder
  {
    id: 's2-forklift-hydraulic-ram',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.86, 1.05, fz],
    size: [0.08, 1.70, 0.08],
    color: '#475569',
    collision: false,
  },
  // Carriage Backplate
  {
    id: 's2-forklift-carriage-plate',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.96, 0.42, fz],
    size: [0.06, 0.55, 0.88],
    color: '#334155',
  },
  // Twin Work Headlights on Mast
  {
    id: 's2-forklift-headlight-L',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.90, 1.75, fz + 0.34],
    size: [0.08, 0.10, 0.10],
    color: '#fef08a',
    collision: false,
  },
  {
    id: 's2-forklift-headlight-R',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 0.90, 1.75, fz - 0.34],
    size: [0.08, 0.10, 0.10],
    color: '#fef08a',
    collision: false,
  }
);

// F. Two Steel Forged Forks (Ground Contact: Y = 0.035, Tine length 1.25m reaching forward)
section2Props.push(
  // Left Fork: Shank & Horizontal Tine
  {
    id: 's2-forklift-fork-shank-L',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 1.01, 0.32, fz + 0.25],
    size: [0.05, 0.52, 0.09],
    color: '#475569',
    roughness: 0.5,
    metalness: 0.6,
  },
  {
    id: 's2-forklift-fork-tine-L',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 1.62, 0.035, fz + 0.25],
    size: [1.22, 0.045, 0.09],
    color: '#475569',
    roughness: 0.5,
    metalness: 0.6,
  },
  // Right Fork: Shank & Horizontal Tine
  {
    id: 's2-forklift-fork-shank-R',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 1.01, 0.32, fz - 0.25],
    size: [0.05, 0.52, 0.09],
    color: '#475569',
    roughness: 0.5,
    metalness: 0.6,
  },
  {
    id: 's2-forklift-fork-tine-R',
    zone: 'section2',
    kind: 'metal',
    center: [fx + 1.62, 0.035, fz - 0.25],
    size: [1.22, 0.045, 0.09],
    color: '#475569',
    roughness: 0.5,
    metalness: 0.6,
  }
);

// G. Carried Cargo on Forks (Pallet & Banded Military Supply Crate)
section2Props.push(
  {
    id: 's2-forklift-carried-pallet',
    zone: 'section2',
    kind: 'pallet',
    center: [fx + 1.55, 0.11, fz],
    size: [1.10, 0.11, 0.92],
    color: '#92400e',
    collision: true,
  },
  {
    id: 's2-forklift-carried-crate',
    zone: 'section2',
    kind: 'crate',
    center: [fx + 1.55, 0.56, fz],
    size: [0.95, 0.78, 0.85],
    color: '#3f4f34', // Olive drab military crate
    roughness: 0.65,
    metalness: 0.2,
  }
);

// =========================================================================
// 3. LOADING-BAY ENVIRONMENTAL DETAILS & PROPS
// =========================================================================

// A. Industrial Chemical & Oil Drums on Spill Pallet (West wall staging: X = -34.5, Z = 12.8)
section2Props.push(
  {
    id: 's2-spill-containment-pallet',
    zone: 'section2',
    kind: 'pallet',
    center: [-34.5, 0.08, 12.8],
    size: [1.35, 0.16, 1.35],
    color: '#374151',
    collision: true,
  },
  {
    id: 's2-drum-blue-01',
    zone: 'section2',
    kind: 'metal',
    center: [-34.2, 0.56, 12.5],
    size: [0.58, 0.88, 0.58],
    color: '#1d4ed8', // Industrial cobalt blue
    roughness: 0.45,
    metalness: 0.45,
  },
  {
    id: 's2-drum-blue-02',
    zone: 'section2',
    kind: 'metal',
    center: [-34.8, 0.56, 12.5],
    size: [0.58, 0.88, 0.58],
    color: '#1e40af',
    roughness: 0.45,
    metalness: 0.45,
  },
  {
    id: 's2-drum-red-01',
    zone: 'section2',
    kind: 'metal',
    center: [-34.2, 0.56, 13.1],
    size: [0.58, 0.88, 0.58],
    color: '#dc2626', // Flammable red drum
    roughness: 0.45,
    metalness: 0.45,
  },
  {
    id: 's2-drum-yellow-01',
    zone: 'section2',
    kind: 'metal',
    center: [-34.8, 0.56, 13.1],
    size: [0.58, 0.88, 0.58],
    color: '#ca8a04', // Hazard yellow drum
    roughness: 0.45,
    metalness: 0.45,
  },
  // Two standalone drums near loading dock return
  {
    id: 's2-drum-dock-01',
    zone: 'section2',
    kind: 'metal',
    center: [-35.0, 0.48, 22.0],
    size: [0.58, 0.88, 0.58],
    color: '#1d4ed8',
    roughness: 0.45,
    metalness: 0.45,
  },
  {
    id: 's2-drum-dock-02',
    zone: 'section2',
    kind: 'metal',
    center: [-35.0, 0.48, 22.7],
    size: [0.58, 0.88, 0.58],
    color: '#334155',
    roughness: 0.55,
    metalness: 0.45,
  }
);

// B. High-Visibility Safety Cones
// Defining perimeter of loading bay
const conePositions = [
  { id: '01', x: -26.0, z: 15.5 },
  { id: '02', x: -26.0, z: 21.0 },
  { id: '03', x: -32.2, z: 24.5 },
  { id: '04', x: -32.2, z: 11.2 },
];
conePositions.forEach((cp) => {
  section2Props.push(
    {
      id: `s2-cone-${cp.id}-base`,
      zone: 'section2',
      kind: 'metal',
      center: [cp.x, 0.025, cp.z],
      size: [0.42, 0.05, 0.42],
      color: '#ea580c',
      collision: false,
    },
    {
      id: `s2-cone-${cp.id}-body`,
      zone: 'section2',
      kind: 'metal',
      center: [cp.x, 0.35, cp.z],
      size: [0.32, 0.65, 0.32],
      color: '#ea580c',
      collision: false,
    },
    {
      id: `s2-cone-${cp.id}-stripe`,
      zone: 'section2',
      kind: 'metal',
      center: [cp.x, 0.38, cp.z],
      size: [0.34, 0.16, 0.34],
      color: '#f8fafc', // Reflective white collar
      collision: false,
    }
  );
});

// C. Spare Wooden Pallets Stack (West wall: X = -34.8, Z = 24.5)
const stackY = [0.06, 0.18, 0.30, 0.42];
stackY.forEach((y, sIdx) => {
  section2Props.push({
    id: `s2-pallet-stack-${sIdx + 1}`,
    zone: 'section2',
    kind: 'pallet',
    center: [-34.8, y, 24.5],
    size: [1.15, 0.11, 0.95],
    color: sIdx % 2 === 0 ? '#92400e' : '#a16207',
    collision: true,
  });
});

// D. Industrial Staging Workbench / Manifest Desk (X = -34.6, Z = 15.8)
section2Props.push(
  // Steel table frame
  {
    id: 's2-workbench-frame',
    zone: 'section2',
    kind: 'metal',
    center: [-34.6, 0.44, 15.8],
    size: [0.85, 0.84, 1.55],
    color: '#334155',
    collision: true,
    roughness: 0.6,
    metalness: 0.4,
  },
  // Thick hardwood top
  {
    id: 's2-workbench-top',
    zone: 'section2',
    kind: 'pallet',
    center: [-34.6, 0.89, 15.8],
    size: [0.92, 0.07, 1.62],
    color: '#78350f',
    collision: true,
    roughness: 0.8,
    metalness: 0.1,
  },
  // Metal tool box on workbench
  {
    id: 's2-workbench-toolbox',
    zone: 'section2',
    kind: 'metal',
    center: [-34.7, 1.05, 15.4],
    size: [0.35, 0.24, 0.48],
    color: '#1e3a8a',
    collision: false,
  },
  // Clipboard manifest on workbench
  {
    id: 's2-workbench-manifest',
    zone: 'section2',
    kind: 'pallet',
    center: [-34.4, 0.94, 16.2],
    size: [0.28, 0.02, 0.38],
    color: '#fef3c7',
    collision: false,
  }
);

// E. Staged Heavy Machinery Crates near Dock Entrance (X = -33.8, Z = 18.0)
section2Props.push(
  {
    id: 's2-staged-crate-01',
    zone: 'section2',
    kind: 'crate',
    center: [-33.8, 0.60, 18.0],
    size: [1.10, 1.15, 1.10],
    color: '#44403c',
    roughness: 0.7,
    metalness: 0.2,
  },
  {
    id: 's2-staged-crate-02',
    zone: 'section2',
    kind: 'crate',
    center: [-33.8, 0.40, 19.4],
    size: [0.95, 0.75, 0.90],
    color: '#854d0e',
    roughness: 0.8,
    metalness: 0.1,
  }
);

console.log(`Generated ${section2Props.length} total props for Section 2.`);

// =========================================================================
// 4. METRIC AND ENVELOPE VALIDATION
// =========================================================================
const s2Zone = map.zones.find((z) => z.id === 'section2');
assert(s2Zone, 'Section 2 zone must exist');

for (const p of section2Props) {
  const minX = p.center[0] - p.size[0] / 2;
  const maxX = p.center[0] + p.size[0] / 2;
  const minZ = p.center[2] - p.size[2] / 2;
  const maxZ = p.center[2] + p.size[2] / 2;

  if (minX < s2Zone.min[0] - 0.05 || maxX > s2Zone.max[0] + 0.05 ||
      minZ < s2Zone.min[1] - 0.05 || maxZ > s2Zone.max[1] + 0.05) {
    console.error(`Boundary violation on ${p.id}: X[${minX.toFixed(2)}, ${maxX.toFixed(2)}] Z[${minZ.toFixed(2)}, ${maxZ.toFixed(2)}] outside zone [${s2Zone.min}, ${s2Zone.max}]`);
    process.exit(1);
  }
}

// Check ID uniqueness
const allNewBoxes = [...existingBoxes, ...section2Props];
const idSet = new Set();
for (const b of allNewBoxes) {
  if (idSet.has(b.id)) {
    console.error(`Duplicate box ID detected: ${b.id}`);
    process.exit(1);
  }
  idSet.add(b.id);
}

// Update map metadata
map.meta.name = 'Warehouse — Section 1 & 2';
map.meta.mode = 'Symmetrical 2v2 warehouse layout — Section 1 Storage & Section 2 Loading Bay';
map.meta.layoutStage = 'section-2-detail';
map.meta.propCount = section1Props.length + section2Props.length;
map.meta.physicalBoxCount = allNewBoxes.length;
map.meta.sectionProgress.section2 = 'stage-2 cross-rack rows, loading bay, forklift and industrial props implemented';

s2Zone.contentStage = 'cross-racks-loading-bay-forklift';
s2Zone.propsSummary = {
  rackRows: 3,
  pallets: section2Props.filter((p) => p.kind === 'pallet').length,
  crates: section2Props.filter((p) => p.kind === 'crate').length,
  vehicleParts: section2Props.filter((p) => p.kind === 'vehicle').length,
  totalProps: section2Props.length,
};

map.boxes = allNewBoxes;

fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf8');
console.log(`Successfully updated ${mapPath}! Total boxes: ${allNewBoxes.length} (202 walls, ${section1Props.length} S1 props, ${section2Props.length} S2 props).`);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
