import { MapSpec } from './types';

export const PLAZA_MAP: MapSpec = {
  id: 'plaza',
  name: 'Plaza',
  description: 'Sunlit outdoor courtyard with classical colonnades, a central fountain, and raised terrace sightlines.',
  dimensions: { width: 50, depth: 50, height: 8 },
  bounds: { minX: -25, maxX: 25, minZ: -25, maxZ: 25 },
  lighting: {
    ambientColor: 0x94a3b8,
    ambientIntensity: 0.8,
    sunColor: 0xfffbeb,
    sunIntensity: 1.5,
    sunPosition: { x: 20, y: 35, z: 15 },
    skyColor: 0x60a5fa,
    groundColor: 0xd6d3d1,
    fogColor: 0xbfdbfe,
    fogNear: 25,
    fogFar: 75,
  },
  spawns: [
    { id: 'alpha-1', team: 'alpha', pos: { x: -12, y: 0, z: -20 }, yaw: 0 },
    { id: 'alpha-2', team: 'alpha', pos: { x: 14, y: 0, z: -20 }, yaw: 0 },
    { id: 'bravo-1', team: 'bravo', pos: { x: -14, y: 0, z: 20 }, yaw: 180 },
    { id: 'bravo-2', team: 'bravo', pos: { x: 12, y: 0, z: 20 }, yaw: 180 },
  ],
  boxes: [
    // 1. Cobblestone / Paver Ground Floor (50m x 50m)
    {
      id: 'floor',
      pos: { x: 0, y: -0.5, z: 0 },
      size: { x: 50, y: 1.0, z: 50 },
      materialKey: 'floor_stone',
      surfaceType: 'stone',
    },
    // 2. Perimeter Walls (3.8m high)
    {
      id: 'wall-north',
      pos: { x: 0, y: 1.9, z: 25.25 },
      size: { x: 51, y: 3.8, z: 0.5 },
      materialKey: 'wall_stucco',
      surfaceType: 'concrete',
    },
    {
      id: 'wall-south',
      pos: { x: 0, y: 1.9, z: -25.25 },
      size: { x: 51, y: 3.8, z: 0.5 },
      materialKey: 'wall_stucco',
      surfaceType: 'concrete',
    },
    {
      id: 'wall-east',
      pos: { x: 25.25, y: 1.9, z: 0 },
      size: { x: 0.5, y: 3.8, z: 50 },
      materialKey: 'wall_stucco',
      surfaceType: 'concrete',
    },
    {
      id: 'wall-west',
      pos: { x: -25.25, y: 1.9, z: 0 },
      size: { x: 0.5, y: 3.8, z: 50 },
      materialKey: 'wall_stucco',
      surfaceType: 'concrete',
    },

    // 3. Central Fountain Base & Monument (Cover at center)
    // Fountain outer rim (radius ~3m box approximation, waist cover 1.1m)
    {
      id: 'fountain-base',
      pos: { x: 0, y: 0.55, z: 0 },
      size: { x: 5.6, y: 1.1, z: 5.6 },
      materialKey: 'stone_carved',
      surfaceType: 'stone',
    },
    // Fountain center obelisk/statue base (tall center cover)
    {
      id: 'fountain-pillar',
      pos: { x: 0, y: 2.1, z: 0 },
      size: { x: 1.8, y: 2.0, z: 1.8 },
      materialKey: 'stone_monument',
      surfaceType: 'stone',
    },

    // 4. West Raised Terrace (y = 1.4m, 7m wide x 30m long)
    {
      id: 'terrace-platform',
      pos: { x: -19, y: 0.7, z: 0 },
      size: { x: 8, y: 1.4, z: 32 },
      materialKey: 'stone_tiles',
      surfaceType: 'stone',
    },
    // Terrace Balustrade / Half-Wall (1.0m high along edge x = -15)
    {
      id: 'terrace-balustrade-s',
      pos: { x: -15.1, y: 1.9, z: -10 },
      size: { x: 0.4, y: 1.0, z: 12 },
      materialKey: 'stone_carved',
      surfaceType: 'stone',
    },
    {
      id: 'terrace-balustrade-n',
      pos: { x: -15.1, y: 1.9, z: 10 },
      size: { x: 0.4, y: 1.0, z: 12 },
      materialKey: 'stone_carved',
      surfaceType: 'stone',
    },

    // 5. East Colonnade Arcade (Covered walkway with pillars)
    // Roof canopy overhead (y = 3.6m)
    {
      id: 'colonnade-roof',
      pos: { x: 19, y: 3.8, z: 0 },
      size: { x: 8, y: 0.4, z: 36 },
      materialKey: 'tile_terracotta',
      surfaceType: 'stone',
    },
    // Colonnade Pillars (along x = 15.5)
    {
      id: 'pillar-e-1',
      pos: { x: 15.5, y: 1.8, z: -14 },
      size: { x: 0.8, y: 3.6, z: 0.8 },
      materialKey: 'stone_carved',
      surfaceType: 'stone',
    },
    {
      id: 'pillar-e-2',
      pos: { x: 15.5, y: 1.8, z: -7 },
      size: { x: 0.8, y: 3.6, z: 0.8 },
      materialKey: 'stone_carved',
      surfaceType: 'stone',
    },
    {
      id: 'pillar-e-3',
      pos: { x: 15.5, y: 1.8, z: 0 },
      size: { x: 0.8, y: 3.6, z: 0.8 },
      materialKey: 'stone_carved',
      surfaceType: 'stone',
    },
    {
      id: 'pillar-e-4',
      pos: { x: 15.5, y: 1.8, z: 7 },
      size: { x: 0.8, y: 3.6, z: 0.8 },
      materialKey: 'stone_carved',
      surfaceType: 'stone',
    },
    {
      id: 'pillar-e-5',
      pos: { x: 15.5, y: 1.8, z: 14 },
      size: { x: 0.8, y: 3.6, z: 0.8 },
      materialKey: 'stone_carved',
      surfaceType: 'stone',
    },

    // 6. Courtyard Stone Planters & Benches (Waist cover 1.1m)
    {
      id: 'planter-nw',
      pos: { x: -8, y: 0.55, z: 10 },
      size: { x: 2.4, y: 1.1, z: 4.0 },
      materialKey: 'stone_planter',
      surfaceType: 'stone',
    },
    {
      id: 'planter-ne',
      pos: { x: 8, y: 0.55, z: 10 },
      size: { x: 2.4, y: 1.1, z: 4.0 },
      materialKey: 'stone_planter',
      surfaceType: 'stone',
    },
    {
      id: 'planter-sw',
      pos: { x: -8, y: 0.55, z: -10 },
      size: { x: 2.4, y: 1.1, z: 4.0 },
      materialKey: 'stone_planter',
      surfaceType: 'stone',
    },
    {
      id: 'planter-se',
      pos: { x: 8, y: 0.55, z: -10 },
      size: { x: 2.4, y: 1.1, z: 4.0 },
      materialKey: 'stone_planter',
      surfaceType: 'stone',
    },
  ],
  ramps: [
    // Ramps to West Terrace from North and South (rise = 1.4m, angle = 20°)
    // Base run = 1.4 / tan(20°) = 3.846m, length = 4.093m
    {
      id: 'terrace-ramp-s',
      pos: { x: -19, y: 0.7, z: -18 },
      width: 4.0,
      height: 1.4,
      length: 4.1,
      angleDeg: 20,
      rotY: 0,
      materialKey: 'stone_tiles',
      surfaceType: 'stone',
    },
    {
      id: 'terrace-ramp-n',
      pos: { x: -19, y: 0.7, z: 18 },
      width: 4.0,
      height: 1.4,
      length: 4.1,
      angleDeg: 20,
      rotY: Math.PI,
      materialKey: 'stone_tiles',
      surfaceType: 'stone',
    },
  ],
  stairs: [
    // Central steps up to West Terrace at z = 0
    {
      id: 'terrace-steps-center',
      startPos: { x: -15.0, y: 0, z: 0 },
      numSteps: 8,
      totalHeight: 1.4,
      stepDepth: 0.45,
      stepWidth: 4.0,
      direction: 'negX',
      materialKey: 'stone_carved',
      surfaceType: 'stone',
    },
  ],
  minimap: {
    viewSize: 56,
    center: { x: 0, z: 0 },
    bounds: { minX: -25, maxX: 25, minZ: -25, maxZ: 25 },
    walls2D: [
      [-25, -25, 25, -25],
      [25, -25, 25, 25],
      [25, 25, -25, 25],
      [-25, 25, -25, -25],
      [-2.8, -2.8, 2.8, -2.8],
      [2.8, -2.8, 2.8, 2.8],
      [2.8, 2.8, -2.8, 2.8],
      [-2.8, 2.8, -2.8, -2.8],
      [-15, -16, -15, 16],
      [15, -18, 15, 18],
    ],
    zones: [
      { name: 'Fountain', x: 0, z: 0 },
      { name: 'West Terrace', x: -19, z: 0 },
      { name: 'East Colonnade', x: 19, z: 0 },
      { name: 'Alpha Courtyard', x: 0, z: -18 },
      { name: 'Bravo Courtyard', x: 0, z: 18 },
    ],
  },
};
