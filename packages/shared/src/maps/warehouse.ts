import { MapSpec } from './types';

export const WAREHOUSE_MAP: MapSpec = {
  id: 'warehouse',
  name: 'Warehouse',
  description: 'Tight CQB industrial warehouse with a central elevated catwalk and machinery lanes.',
  dimensions: { width: 40, depth: 40, height: 6 },
  bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
  lighting: {
    ambientColor: 0x222a38,
    ambientIntensity: 0.65,
    sunColor: 0xffedd5,
    sunIntensity: 1.2,
    sunPosition: { x: 10, y: 18, z: 8 },
    skyColor: 0x334155,
    groundColor: 0x0f172a,
    fogColor: 0x1e2430,
    fogNear: 15,
    fogFar: 45,
  },
  spawns: [
    { id: 'alpha-1', team: 'alpha', pos: { x: -8, y: 0, z: -15 }, yaw: 0 },
    { id: 'alpha-2', team: 'alpha', pos: { x: 8, y: 0, z: -15 }, yaw: 0 },
    { id: 'bravo-1', team: 'bravo', pos: { x: -8, y: 0, z: 15 }, yaw: 180 },
    { id: 'bravo-2', team: 'bravo', pos: { x: 8, y: 0, z: 15 }, yaw: 180 },
  ],
  boxes: [
    // 1. Concrete Floor
    {
      id: 'floor',
      pos: { x: 0, y: -0.5, z: 0 },
      size: { x: 40, y: 1.0, z: 40 },
      materialKey: 'floor_concrete',
      surfaceType: 'concrete',
    },
    // 2. Perimeter Walls (4.5m high)
    // North (+Z)
    {
      id: 'wall-north',
      pos: { x: 0, y: 2.25, z: 20.25 },
      size: { x: 41, y: 4.5, z: 0.5 },
      materialKey: 'wall_brick',
      surfaceType: 'concrete',
    },
    // South (-Z)
    {
      id: 'wall-south',
      pos: { x: 0, y: 2.25, z: -20.25 },
      size: { x: 41, y: 4.5, z: 0.5 },
      materialKey: 'wall_brick',
      surfaceType: 'concrete',
    },
    // East (+X)
    {
      id: 'wall-east',
      pos: { x: 20.25, y: 2.25, z: 0 },
      size: { x: 0.5, y: 4.5, z: 40 },
      materialKey: 'wall_brick',
      surfaceType: 'concrete',
    },
    // West (-X)
    {
      id: 'wall-west',
      pos: { x: -20.25, y: 2.25, z: 0 },
      size: { x: 0.5, y: 4.5, z: 40 },
      materialKey: 'wall_brick',
      surfaceType: 'concrete',
    },

    // 3. Central Catwalk Platform (y = 2.0m, platform top = 2.0m, center = 1.9m)
    {
      id: 'catwalk-center',
      pos: { x: 0, y: 1.9, z: 0 },
      size: { x: 8, y: 0.2, z: 10 },
      materialKey: 'metal_grate',
      surfaceType: 'metal',
    },
    // Catwalk guardrails (1.1m high)
    {
      id: 'catwalk-rail-e',
      pos: { x: 3.9, y: 2.55, z: 0 },
      size: { x: 0.2, y: 1.1, z: 10 },
      materialKey: 'metal_pipe',
      surfaceType: 'metal',
    },
    {
      id: 'catwalk-rail-w',
      pos: { x: -3.9, y: 2.55, z: 0 },
      size: { x: 0.2, y: 1.1, z: 10 },
      materialKey: 'metal_pipe',
      surfaceType: 'metal',
    },

    // 4. Catwalk Support Pillars
    {
      id: 'pillar-nw',
      pos: { x: -3.8, y: 0.9, z: 4.8 },
      size: { x: 0.4, y: 1.8, z: 0.4 },
      materialKey: 'metal_beam',
      surfaceType: 'metal',
    },
    {
      id: 'pillar-ne',
      pos: { x: 3.8, y: 0.9, z: 4.8 },
      size: { x: 0.4, y: 1.8, z: 0.4 },
      materialKey: 'metal_beam',
      surfaceType: 'metal',
    },
    {
      id: 'pillar-sw',
      pos: { x: -3.8, y: 0.9, z: -4.8 },
      size: { x: 0.4, y: 1.8, z: 0.4 },
      materialKey: 'metal_beam',
      surfaceType: 'metal',
    },
    {
      id: 'pillar-se',
      pos: { x: 3.8, y: 0.9, z: -4.8 },
      size: { x: 0.4, y: 1.8, z: 0.4 },
      materialKey: 'metal_beam',
      surfaceType: 'metal',
    },

    // 5. Tactical Crates & Cover in West Storage Lane
    // Stacked large wooden crate (2.2m high)
    {
      id: 'crate-w-tall',
      pos: { x: -11, y: 1.1, z: 2 },
      size: { x: 2.2, y: 2.2, z: 2.2 },
      materialKey: 'wood_crate',
      surfaceType: 'wood',
    },
    // Waist-high wooden crates (1.1m high)
    {
      id: 'crate-w-waist-1',
      pos: { x: -11, y: 0.55, z: -1 },
      size: { x: 1.8, y: 1.1, z: 1.4 },
      materialKey: 'wood_crate',
      surfaceType: 'wood',
    },
    {
      id: 'crate-w-waist-2',
      pos: { x: -14, y: 0.55, z: -6 },
      size: { x: 1.4, y: 1.1, z: 2.4 },
      materialKey: 'wood_crate',
      surfaceType: 'wood',
    },
    {
      id: 'crate-w-waist-3',
      pos: { x: -13, y: 0.55, z: 8 },
      size: { x: 2.0, y: 1.1, z: 1.6 },
      materialKey: 'wood_crate',
      surfaceType: 'wood',
    },

    // 6. Machinery & Metal Enclosures in East Lane
    // Heavy industrial transformer box (waist + head cover)
    {
      id: 'machinery-e-1',
      pos: { x: 12, y: 1.25, z: -3 },
      size: { x: 2.8, y: 2.5, z: 2.0 },
      materialKey: 'machinery_blue',
      surfaceType: 'metal',
    },
    {
      id: 'machinery-e-waist',
      pos: { x: 11.5, y: 0.55, z: 3 },
      size: { x: 2.0, y: 1.1, z: 3.2 },
      materialKey: 'metal_panel',
      surfaceType: 'metal',
    },
    {
      id: 'pallet-e-north',
      pos: { x: 13, y: 0.55, z: 9 },
      size: { x: 1.6, y: 1.1, z: 1.6 },
      materialKey: 'wood_crate',
      surfaceType: 'wood',
    },

    // 7. Spawn Area Cover Barriers
    {
      id: 'cover-alpha-s',
      pos: { x: 0, y: 0.55, z: -12 },
      size: { x: 4.0, y: 1.1, z: 0.6 },
      materialKey: 'concrete_barrier',
      surfaceType: 'concrete',
    },
    {
      id: 'cover-bravo-n',
      pos: { x: 0, y: 0.55, z: 12 },
      size: { x: 4.0, y: 1.1, z: 0.6 },
      materialKey: 'concrete_barrier',
      surfaceType: 'concrete',
    },
  ],
  ramps: [
    // North Walkway Ramp: 18° incline from ground to catwalk (rise = 1.9m, run = 5.85m)
    {
      id: 'catwalk-ramp-n',
      pos: { x: 0, y: 0.95, z: 7.925 },
      width: 2.4,
      height: 1.9,
      length: 6.15,
      angleDeg: 18,
      rotY: Math.PI,
      materialKey: 'metal_grate',
      surfaceType: 'metal',
    },
    // South Walkway Ramp: 18° incline from ground to catwalk
    {
      id: 'catwalk-ramp-s',
      pos: { x: 0, y: 0.95, z: -7.925 },
      width: 2.4,
      height: 1.9,
      length: 6.15,
      angleDeg: 18,
      rotY: 0,
      materialKey: 'metal_grate',
      surfaceType: 'metal',
    },
  ],
  stairs: [
    // East side stairs to catwalk
    {
      id: 'catwalk-stairs-e',
      startPos: { x: 4.0, y: 0, z: 0 },
      numSteps: 10,
      totalHeight: 1.9,
      stepDepth: 0.35,
      stepWidth: 2.0,
      direction: 'posX',
      materialKey: 'metal_grate',
      surfaceType: 'metal',
    },
  ],
  minimap: {
    viewSize: 44,
    center: { x: 0, z: 0 },
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
    walls2D: [
      [-20, -20, 20, -20],
      [20, -20, 20, 20],
      [20, 20, -20, 20],
      [-20, 20, -20, -20],
      [-4, -5, 4, -5],
      [4, -5, 4, 5],
      [4, 5, -4, 5],
      [-4, 5, -4, -5],
      [-12, 1, -10, 3],
      [10.5, -4, 13.5, -2],
      [-2, -12, 2, -12],
      [-2, 12, 2, 12],
    ],
    zones: [
      { name: 'Catwalk', x: 0, z: 0 },
      { name: 'Storage West', x: -12, z: 0 },
      { name: 'Machinery East', x: 12, z: 0 },
      { name: 'Alpha Spawn', x: 0, z: -15 },
      { name: 'Bravo Spawn', x: 0, z: 15 },
    ],
  },
};
