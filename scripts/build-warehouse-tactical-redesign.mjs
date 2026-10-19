// scripts/build-warehouse-tactical-redesign.mjs
// Generates the reference-accurate Tactical Warehouse redesign:
// - Preserves all 202 original walls and Sections 1, 2, 3, 4 genuine geometry
// - Fills excessive empty floor space in Central Combat Hall (13.5m x 13.5m)
// - Adds tactical 20ft shipping container centerpiece breaking long sniper sightlines
// - Adds stepped crate climb on both sides for balanced elevated container rooftop access
// - Adds low cover crate clusters with 1.0m shootable tactical gaps and corner crash barriers
// - Adds West and East Loading Dock staging platforms, pallet stacks, chemical drums, and safety railings
// - Preserves smooth traversal with explicit SOLID, SUPPORT, WALKABLE, and DECORATIVE classifications

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const mapPath = path.join(root, 'public/maps/warehouse_layout.json');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

// Filter and preserve genuine existing boxes
const originalWalls = map.boxes.filter((b) => b.kind === 'wall');
const s1Props = map.boxes.filter((b) => b.zone === 'section1');
const s2Props = map.boxes.filter((b) => b.zone === 'section2');
const s3Props = map.boxes.filter((b) => b.zone === 'section3');
const s4Props = map.boxes.filter((b) => b.zone === 'section4');

console.log(`Preserving:
- ${originalWalls.length} original wall segments (exact requirement: 202)
- ${s1Props.length} Section 1 props (storage racks, pallets, crates)
- ${s2Props.length} Section 2 props (cross-racks, forklift, barrels, cones)
- ${s3Props.length} Section 3 props (conveyors, scanner arch, sort lanes, cages)
- ${s4Props.length} Section 4 props (server racks, dispatch desk, tech cage)`);

// =========================================================================
// 1. CENTRAL COMBAT HALL (Bounds: X in [-6.75, 6.75], Z in [-6.75, 6.75])
// =========================================================================
const centralHallProps = [];

// A. Central 20ft Intermodal Shipping Container (Centerpiece)
// Sits at [0, 1.3, 0] breaking the long North-South sniper sightline between spawns
centralHallProps.push({
  id: 'ch-container-main',
  zone: 'centralHall',
  kind: 'metal',
  category: 'SOLID',
  center: [0, 1.3, 0],
  size: [2.44, 2.6, 5.6],
  color: '#9a3412', // Industrial rust orange
  roughness: 0.65,
  metalness: 0.35,
  isWalkable: true,
});

// Container Walkable Roof Deck (smooth elevated walkway)
centralHallProps.push({
  id: 'ch-container-roof',
  zone: 'centralHall',
  kind: 'metal',
  category: 'WALKABLE',
  center: [0, 2.62, 0],
  size: [2.44, 0.04, 5.6],
  color: '#7c2d12',
  roughness: 0.7,
  metalness: 0.3,
  isWalkable: true,
  walkable: true,
});

// Container Corner Structural Posts (4 heavy vertical steel columns)
const cornerOffsets = [
  [-1.22, 2.8],
  [1.22, 2.8],
  [-1.22, -2.8],
  [1.22, -2.8],
];
cornerOffsets.forEach(([cx, cz], i) => {
  centralHallProps.push({
    id: `ch-container-post-${i + 1}`,
    zone: 'centralHall',
    kind: 'metal',
    category: 'SUPPORT',
    center: [cx, 1.3, cz],
    size: [0.14, 2.6, 0.14],
    color: '#431407',
    roughness: 0.5,
    metalness: 0.6,
  });
});

// Container End Door Frames (Decorative trim)
centralHallProps.push({
  id: 'ch-container-door-north',
  zone: 'centralHall',
  kind: 'metal',
  category: 'DECORATIVE',
  collision: false,
  center: [0, 1.3, 2.82],
  size: [2.2, 2.4, 0.06],
  color: '#7c2d12',
});

centralHallProps.push({
  id: 'ch-container-door-south',
  zone: 'centralHall',
  kind: 'metal',
  category: 'DECORATIVE',
  collision: false,
  center: [0, 1.3, -2.82],
  size: [2.2, 2.4, 0.06],
  color: '#7c2d12',
});

// B. Symmetrical Stepped Crate Access to Container Roof
// North Approach (Team A approach):
centralHallProps.push({
  id: 'ch-step-n-pallet',
  zone: 'centralHall',
  kind: 'pallet',
  category: 'SUPPORT',
  center: [0, 0.08, 3.65],
  size: [1.2, 0.15, 1.0],
  color: '#78350f',
});
centralHallProps.push({
  id: 'ch-step-n-low',
  zone: 'centralHall',
  kind: 'crate',
  category: 'SOLID',
  isWalkable: true,
  walkable: true,
  center: [0, 0.55, 3.65],
  size: [1.1, 0.8, 0.9],
  color: '#b45309',
});
centralHallProps.push({
  id: 'ch-step-n-mid',
  zone: 'centralHall',
  kind: 'crate',
  category: 'SOLID',
  isWalkable: true,
  walkable: true,
  center: [0, 1.35, 3.0],
  size: [1.1, 0.8, 0.5],
  color: '#92400e',
});

// South Approach (Team B approach, perfectly balanced):
centralHallProps.push({
  id: 'ch-step-s-pallet',
  zone: 'centralHall',
  kind: 'pallet',
  category: 'SUPPORT',
  center: [0, 0.08, -3.65],
  size: [1.2, 0.15, 1.0],
  color: '#78350f',
});
centralHallProps.push({
  id: 'ch-step-s-low',
  zone: 'centralHall',
  kind: 'crate',
  category: 'SOLID',
  isWalkable: true,
  walkable: true,
  center: [0, 0.55, -3.65],
  size: [1.1, 0.8, 0.9],
  color: '#b45309',
});
centralHallProps.push({
  id: 'ch-step-s-mid',
  zone: 'centralHall',
  kind: 'crate',
  category: 'SOLID',
  isWalkable: true,
  walkable: true,
  center: [0, 1.35, -3.0],
  size: [1.1, 0.8, 0.5],
  color: '#92400e',
});

// C. West and East Flanking Crate Clusters with 1.0m Shootable Gaps
// West Wing (X = -3.8)
centralHallProps.push({
  id: 'ch-crate-w-north',
  zone: 'centralHall',
  kind: 'crate',
  category: 'SOLID',
  isWalkable: true,
  center: [-3.8, 0.55, 1.25],
  size: [1.2, 0.95, 1.3],
  color: '#a16207',
});
centralHallProps.push({
  id: 'ch-pallet-w-north',
  zone: 'centralHall',
  kind: 'pallet',
  category: 'SUPPORT',
  center: [-3.8, 0.07, 1.25],
  size: [1.3, 0.14, 1.4],
  color: '#78350f',
});
centralHallProps.push({
  id: 'ch-crate-w-south',
  zone: 'centralHall',
  kind: 'crate',
  category: 'SOLID',
  isWalkable: true,
  center: [-3.8, 0.55, -1.25],
  size: [1.2, 0.95, 1.3],
  color: '#a16207',
});
centralHallProps.push({
  id: 'ch-pallet-w-south',
  zone: 'centralHall',
  kind: 'pallet',
  category: 'SUPPORT',
  center: [-3.8, 0.07, -1.25],
  size: [1.3, 0.14, 1.4],
  color: '#78350f',
});

// East Wing (X = +3.8, perfectly mirrored)
centralHallProps.push({
  id: 'ch-crate-e-north',
  zone: 'centralHall',
  kind: 'crate',
  category: 'SOLID',
  isWalkable: true,
  center: [3.8, 0.55, 1.25],
  size: [1.2, 0.95, 1.3],
  color: '#a16207',
});
centralHallProps.push({
  id: 'ch-pallet-e-north',
  zone: 'centralHall',
  kind: 'pallet',
  category: 'SUPPORT',
  center: [3.8, 0.07, 1.25],
  size: [1.3, 0.14, 1.4],
  color: '#78350f',
});
centralHallProps.push({
  id: 'ch-crate-e-south',
  zone: 'centralHall',
  kind: 'crate',
  category: 'SOLID',
  isWalkable: true,
  center: [3.8, 0.55, -1.25],
  size: [1.2, 0.95, 1.3],
  color: '#a16207',
});
centralHallProps.push({
  id: 'ch-pallet-e-south',
  zone: 'centralHall',
  kind: 'pallet',
  category: 'SUPPORT',
  center: [3.8, 0.07, -1.25],
  size: [1.3, 0.14, 1.4],
  color: '#78350f',
});

// D. 4 Waist-High Concrete/Metal Crash Barriers at the Quadrant Gateway Corners
const gatewayCorners = [
  { id: 'nw', pos: [-4.6, 4.6] },
  { id: 'ne', pos: [4.6, 4.6] },
  { id: 'sw', pos: [-4.6, -4.6] },
  { id: 'se', pos: [4.6, -4.6] },
];
gatewayCorners.forEach(({ id, pos }) => {
  centralHallProps.push({
    id: `ch-barrier-${id}`,
    zone: 'centralHall',
    kind: 'metal',
    category: 'SOLID',
    center: [pos[0], 0.48, pos[1]],
    size: [1.5, 0.95, 0.45],
    color: '#475569',
    roughness: 0.7,
    metalness: 0.3,
  });
});

// E. 4 High-Visibility Industrial Safety Bollards
const bollardLocations = [
  [-2.0, 4.5],
  [2.0, 4.5],
  [-2.0, -4.5],
  [2.0, -4.5],
];
bollardLocations.forEach(([bx, bz], i) => {
  centralHallProps.push({
    id: `ch-bollard-${i + 1}`,
    zone: 'centralHall',
    kind: 'safety',
    shape: 'cylinder',
    category: 'SOLID',
    center: [bx, 0.48, bz],
    size: [0.22, 0.95, 0.22],
    color: '#eab308',
  });
});

// =========================================================================
// 2. WEST LOADING DOCK (Bounds: X in [-46, -39], Z in [-8, 8])
// =========================================================================
const loadingWestProps = [];

// A. Raised Staging Deck Platform
loadingWestProps.push({
  id: 'lw-staging-deck',
  zone: 'loadingWest',
  kind: 'metal',
  category: 'WALKABLE',
  center: [-43.2, 0.22, 0],
  size: [3.6, 0.44, 13.0],
  color: '#334155',
  roughness: 0.65,
  metalness: 0.4,
  isWalkable: true,
  walkable: true,
});

// B. Staged Tall Palletized Cargo Stack (North side)
loadingWestProps.push({
  id: 'lw-pallet-stack-base-n',
  zone: 'loadingWest',
  kind: 'pallet',
  category: 'SUPPORT',
  center: [-42.5, 0.3, 3.8],
  size: [1.6, 0.15, 1.6],
  color: '#78350f',
});
loadingWestProps.push({
  id: 'lw-cargo-crate-tall-n',
  zone: 'loadingWest',
  kind: 'crate',
  category: 'SOLID',
  center: [-42.5, 1.15, 3.8],
  size: [1.5, 1.55, 1.5],
  color: '#854d0e',
});

// C. Low Staged Crate Stack (South side, crouch cover)
loadingWestProps.push({
  id: 'lw-pallet-stack-base-s',
  zone: 'loadingWest',
  kind: 'pallet',
  category: 'SUPPORT',
  center: [-42.5, 0.3, -3.8],
  size: [1.5, 0.15, 1.5],
  color: '#78350f',
});
loadingWestProps.push({
  id: 'lw-cargo-crate-low-s',
  zone: 'loadingWest',
  kind: 'crate',
  category: 'SOLID',
  isWalkable: true,
  center: [-42.5, 0.8, -3.8],
  size: [1.4, 0.85, 1.4],
  color: '#a16207',
});

// D. Stationary Warehouse Pallet Jack
loadingWestProps.push({
  id: 'lw-pallet-jack-forks',
  zone: 'loadingWest',
  kind: 'metal',
  category: 'SUPPORT',
  center: [-40.8, 0.28, 1.2],
  size: [1.3, 0.12, 0.55],
  color: '#eab308',
});
loadingWestProps.push({
  id: 'lw-pallet-jack-body',
  zone: 'loadingWest',
  kind: 'metal',
  category: 'SOLID',
  center: [-41.6, 0.55, 1.2],
  size: [0.4, 0.65, 0.5],
  color: '#ca8a04',
});
loadingWestProps.push({
  id: 'lw-pallet-jack-handle',
  zone: 'loadingWest',
  kind: 'metal',
  category: 'SUPPORT',
  center: [-41.9, 0.95, 1.2],
  size: [0.08, 0.75, 0.08],
  color: '#1e293b',
});

// E. Dock Safety Railings with central opening
// North rail run:
loadingWestProps.push({
  id: 'lw-safety-rail-top-n',
  zone: 'loadingWest',
  kind: 'metal',
  category: 'SOLID',
  center: [-45.5, 1.0, 4.5],
  size: [0.08, 0.08, 4.0],
  color: '#eab308',
});
loadingWestProps.push({
  id: 'lw-safety-rail-mid-n',
  zone: 'loadingWest',
  kind: 'metal',
  category: 'DECORATIVE',
  collision: false,
  center: [-45.5, 0.5, 4.5],
  size: [0.06, 0.06, 4.0],
  color: '#eab308',
});
[2.5, 4.5, 6.5].forEach((pz, i) => {
  loadingWestProps.push({
    id: `lw-safety-rail-post-n-${i + 1}`,
    zone: 'loadingWest',
    kind: 'metal',
    category: 'SUPPORT',
    center: [-45.5, 0.5, pz],
    size: [0.08, 1.0, 0.08],
    color: '#eab308',
  });
});

// South rail run:
loadingWestProps.push({
  id: 'lw-safety-rail-top-s',
  zone: 'loadingWest',
  kind: 'metal',
  category: 'SOLID',
  center: [-45.5, 1.0, -4.5],
  size: [0.08, 0.08, 4.0],
  color: '#eab308',
});
loadingWestProps.push({
  id: 'lw-safety-rail-mid-s',
  zone: 'loadingWest',
  kind: 'metal',
  category: 'DECORATIVE',
  collision: false,
  center: [-45.5, 0.5, -4.5],
  size: [0.06, 0.06, 4.0],
  color: '#eab308',
});
[-2.5, -4.5, -6.5].forEach((pz, i) => {
  loadingWestProps.push({
    id: `lw-safety-rail-post-s-${i + 1}`,
    zone: 'loadingWest',
    kind: 'metal',
    category: 'SUPPORT',
    center: [-45.5, 0.5, pz],
    size: [0.08, 1.0, 0.08],
    color: '#eab308',
  });
});

// F. Gate Bollards
loadingWestProps.push({
  id: 'lw-gate-bollard-1',
  zone: 'loadingWest',
  kind: 'safety',
  shape: 'cylinder',
  category: 'SOLID',
  center: [-44.8, 0.5, 2.4],
  size: [0.25, 1.0, 0.25],
  color: '#eab308',
});
loadingWestProps.push({
  id: 'lw-gate-bollard-2',
  zone: 'loadingWest',
  kind: 'safety',
  shape: 'cylinder',
  category: 'SOLID',
  center: [-44.8, 0.5, -2.4],
  size: [0.25, 1.0, 0.25],
  color: '#eab308',
});

// =========================================================================
// 3. EAST LOADING DOCK (Bounds: X in [39, 46], Z in [-8, 8])
// =========================================================================
const loadingEastProps = [];

// A. Raised Staging Deck Platform
loadingEastProps.push({
  id: 'le-staging-deck',
  zone: 'loadingEast',
  kind: 'metal',
  category: 'WALKABLE',
  center: [43.2, 0.22, 0],
  size: [3.6, 0.44, 13.0],
  color: '#334155',
  roughness: 0.65,
  metalness: 0.4,
  isWalkable: true,
  walkable: true,
});

// B. Hazardous Material / Spill Pallet with 3 Industrial Steel Drums
loadingEastProps.push({
  id: 'le-spill-pallet',
  zone: 'loadingEast',
  kind: 'pallet',
  category: 'SUPPORT',
  center: [42.5, 0.28, -3.8],
  size: [1.6, 0.12, 1.6],
  color: '#eab308',
});
loadingEastProps.push({
  id: 'le-drum-blue',
  zone: 'loadingEast',
  kind: 'barrel',
  shape: 'cylinder',
  category: 'SOLID',
  center: [42.1, 0.8, -3.5],
  size: [0.55, 0.92, 0.55],
  color: '#1e3a8a',
});
loadingEastProps.push({
  id: 'le-drum-red',
  zone: 'loadingEast',
  kind: 'barrel',
  shape: 'cylinder',
  category: 'SOLID',
  center: [42.8, 0.8, -3.5],
  size: [0.55, 0.92, 0.55],
  color: '#b91c1c',
});
loadingEastProps.push({
  id: 'le-drum-green',
  zone: 'loadingEast',
  kind: 'barrel',
  shape: 'cylinder',
  category: 'SOLID',
  center: [42.45, 0.8, -4.2],
  size: [0.55, 0.92, 0.55],
  color: '#047857',
});

// C. Heavy Shipping Crates (Tall & Low Cover)
loadingEastProps.push({
  id: 'le-pallet-crate-tall',
  zone: 'loadingEast',
  kind: 'pallet',
  category: 'SUPPORT',
  center: [42.5, 0.3, 3.8],
  size: [1.6, 0.15, 1.6],
  color: '#78350f',
});
loadingEastProps.push({
  id: 'le-cargo-crate-tall',
  zone: 'loadingEast',
  kind: 'crate',
  category: 'SOLID',
  center: [42.5, 1.15, 3.8],
  size: [1.5, 1.55, 1.5],
  color: '#854d0e',
});
loadingEastProps.push({
  id: 'le-cargo-crate-low',
  zone: 'loadingEast',
  kind: 'crate',
  category: 'SOLID',
  isWalkable: true,
  center: [40.6, 0.55, 3.8],
  size: [1.2, 0.85, 1.2],
  color: '#a16207',
});

// D. Dock Workbench & Shipping Scale
loadingEastProps.push({
  id: 'le-workbench-top',
  zone: 'loadingEast',
  kind: 'metal',
  category: 'SOLID',
  center: [40.8, 0.85, -1.2],
  size: [1.4, 0.08, 0.8],
  color: '#475569',
});
[
  [40.2, -0.9],
  [41.4, -0.9],
  [40.2, -1.5],
  [41.4, -1.5],
].forEach(([lx, lz], i) => {
  loadingEastProps.push({
    id: `le-workbench-leg-${i + 1}`,
    zone: 'loadingEast',
    kind: 'metal',
    category: 'SUPPORT',
    center: [lx, 0.42, lz],
    size: [0.08, 0.84, 0.08],
    color: '#1e293b',
  });
});
loadingEastProps.push({
  id: 'le-scale-display',
  zone: 'loadingEast',
  kind: 'metal',
  category: 'DECORATIVE',
  collision: false,
  center: [40.8, 0.95, -1.2],
  size: [0.4, 0.12, 0.35],
  color: '#0284c7',
});

// E. Dock Safety Railings with central opening
loadingEastProps.push({
  id: 'le-safety-rail-top-n',
  zone: 'loadingEast',
  kind: 'metal',
  category: 'SOLID',
  center: [45.5, 1.0, 4.5],
  size: [0.08, 0.08, 4.0],
  color: '#eab308',
});
loadingEastProps.push({
  id: 'le-safety-rail-mid-n',
  zone: 'loadingEast',
  kind: 'metal',
  category: 'DECORATIVE',
  collision: false,
  center: [45.5, 0.5, 4.5],
  size: [0.06, 0.06, 4.0],
  color: '#eab308',
});
[2.5, 4.5, 6.5].forEach((pz, i) => {
  loadingEastProps.push({
    id: `le-safety-rail-post-n-${i + 1}`,
    zone: 'loadingEast',
    kind: 'metal',
    category: 'SUPPORT',
    center: [45.5, 0.5, pz],
    size: [0.08, 1.0, 0.08],
    color: '#eab308',
  });
});

loadingEastProps.push({
  id: 'le-safety-rail-top-s',
  zone: 'loadingEast',
  kind: 'metal',
  category: 'SOLID',
  center: [45.5, 1.0, -4.5],
  size: [0.08, 0.08, 4.0],
  color: '#eab308',
});
loadingEastProps.push({
  id: 'le-safety-rail-mid-s',
  zone: 'loadingEast',
  kind: 'metal',
  category: 'DECORATIVE',
  collision: false,
  center: [45.5, 0.5, -4.5],
  size: [0.06, 0.06, 4.0],
  color: '#eab308',
});
[-2.5, -4.5, -6.5].forEach((pz, i) => {
  loadingEastProps.push({
    id: `le-safety-rail-post-s-${i + 1}`,
    zone: 'loadingEast',
    kind: 'metal',
    category: 'SUPPORT',
    center: [45.5, 0.5, pz],
    size: [0.08, 1.0, 0.08],
    color: '#eab308',
  });
});

// F. Gate Bollards
loadingEastProps.push({
  id: 'le-gate-bollard-1',
  zone: 'loadingEast',
  kind: 'safety',
  shape: 'cylinder',
  category: 'SOLID',
  center: [44.8, 0.5, 2.4],
  size: [0.25, 1.0, 0.25],
  color: '#eab308',
});
loadingEastProps.push({
  id: 'le-gate-bollard-2',
  zone: 'loadingEast',
  kind: 'safety',
  shape: 'cylinder',
  category: 'SOLID',
  center: [44.8, 0.5, -2.4],
  size: [0.25, 1.0, 0.25],
  color: '#eab308',
});

// Assemble the complete layout
const newProps = [
  ...s1Props,
  ...s2Props,
  ...s3Props,
  ...s4Props,
  ...centralHallProps,
  ...loadingWestProps,
  ...loadingEastProps,
];

console.log(`\nNew Props Breakdown:
- Section 1: ${s1Props.length} props
- Section 2: ${s2Props.length} props
- Section 3: ${s3Props.length} props
- Section 4: ${s4Props.length} props
- Central Combat Hall: ${centralHallProps.length} props
- West Loading Dock: ${loadingWestProps.length} props
- East Loading Dock: ${loadingEastProps.length} props
Total Props: ${newProps.length}
Total Walls: ${originalWalls.length}
Total All Boxes: ${originalWalls.length + newProps.length}`);

// Combine walls and props
const allBoxes = [...originalWalls, ...newProps];

// Update meta
map.boxes = allBoxes;
map.meta.name = 'Warehouse — Tactical Arena & Logistics Facility';
map.meta.mode =
  'Distinct warehouse functions — Section 1 pallet storage, Section 2 loading bay, Section 3 conveyor parcel sortation and dispatch, Section 4 IT & logistics hub, central combat container arena, and loading docks';
map.meta.wallSegmentCount = originalWalls.length;
map.meta.propCount = newProps.length;
map.meta.physicalBoxCount = allBoxes.length;
map.meta.visiblePropCount = newProps.filter((b) => b.visible !== false).length;
map.meta.sectionProgress = {
  ...map.meta.sectionProgress,
  centralHall:
    'tactical central staging island with shipping container, stepped rooftop access, crouch peeking crates, and concrete crash barriers',
  loadingWest:
    'west loading dock staging deck with pallet stacks, pallet jack, and dock safety railing',
  loadingEast:
    'east loading dock staging deck with chemical spill drums, crate stacks, packing station, and safety railing',
};

// Update zone propsSummary
const centralZone = map.zones.find((z) => z.id === 'centralHall');
if (centralZone) {
  centralZone.propsSummary = {
    propParts: centralHallProps.length,
    containerCenterpiece: true,
    steppedRooftopRoute: true,
    cornerCrashBarriers: 4,
    safetyBollards: 4,
  };
}

const westZone = map.zones.find((z) => z.id === 'loadingWest');
if (westZone) {
  westZone.propsSummary = {
    propParts: loadingWestProps.length,
    stagingDeck: true,
    palletStack: true,
    palletJack: true,
    safetyRailing: true,
  };
}

const eastZone = map.zones.find((z) => z.id === 'loadingEast');
if (eastZone) {
  eastZone.propsSummary = {
    propParts: loadingEastProps.length,
    stagingDeck: true,
    spillPalletDrums: 3,
    packingStation: true,
    safetyRailing: true,
  };
}

// Write the updated warehouse layout JSON
fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf8');
console.log(`\n✓ Successfully wrote ${allBoxes.length} boxes to ${mapPath}`);
