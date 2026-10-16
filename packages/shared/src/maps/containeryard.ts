import { MapSpec } from './types';

export const CONTAINERYARD_MAP: MapSpec = {
  id: 'containeryard',
  name: 'Container Yard',
  description: 'Coastal cargo terminal with stacked shipping containers, narrow chokepoint alleys, and elevated crane sightlines.',
  dimensions: { width: 60, depth: 40, height: 10 },
  bounds: { minX: -30, maxX: 30, minZ: -20, maxZ: 20 },
  lighting: {
    ambientColor: 0x3b4252,
    ambientIntensity: 0.6,
    sunColor: 0xfb923c, // Sunset golden hour
    sunIntensity: 1.4,
    sunPosition: { x: -35, y: 14, z: 12 },
    skyColor: 0x6366f1,
    groundColor: 0x1f2937,
    fogColor: 0x4338ca,
    fogNear: 20,
    fogFar: 65,
  },
  spawns: [
    { id: 'alpha-1', team: 'alpha', pos: { x: -24, y: 0, z: -8 }, yaw: 90 },
    { id: 'alpha-2', team: 'alpha', pos: { x: -24, y: 0, z: 8 }, yaw: 90 },
    { id: 'bravo-1', team: 'bravo', pos: { x: 24, y: 0, z: -8 }, yaw: 270 },
    { id: 'bravo-2', team: 'bravo', pos: { x: 24, y: 0, z: 8 }, yaw: 270 },
  ],
  boxes: [
    // 1. Asphalt Ground (60m x 40m)
    {
      id: 'floor',
      pos: { x: 0, y: -0.5, z: 0 },
      size: { x: 60, y: 1.0, z: 40 },
      materialKey: 'floor_asphalt',
      surfaceType: 'concrete',
    },
    // 2. Perimeter Security Walls (4.0m high)
    {
      id: 'wall-north',
      pos: { x: 0, y: 2.0, z: 20.25 },
      size: { x: 61, y: 4.0, z: 0.5 },
      materialKey: 'wall_concrete_barrier',
      surfaceType: 'concrete',
    },
    {
      id: 'wall-south',
      pos: { x: 0, y: 2.0, z: -20.25 },
      size: { x: 61, y: 4.0, z: 0.5 },
      materialKey: 'wall_concrete_barrier',
      surfaceType: 'concrete',
    },
    {
      id: 'wall-east',
      pos: { x: 30.25, y: 2.0, z: 0 },
      size: { x: 0.5, y: 4.0, z: 40 },
      materialKey: 'wall_concrete_barrier',
      surfaceType: 'concrete',
    },
    {
      id: 'wall-west',
      pos: { x: -30.25, y: 2.0, z: 0 },
      size: { x: 0.5, y: 4.0, z: 40 },
      materialKey: 'wall_concrete_barrier',
      surfaceType: 'concrete',
    },

    // 3. Central Container Maze (6.0m length x 2.4m width x 2.6m height)
    // Red container block (Center North, double stacked)
    {
      id: 'c-red-1',
      pos: { x: -2, y: 1.3, z: 4 },
      size: { x: 6.0, y: 2.6, z: 2.4 },
      materialKey: 'container_red',
      surfaceType: 'metal',
    },
    {
      id: 'c-red-top',
      pos: { x: -2, y: 3.9, z: 4 },
      size: { x: 6.0, y: 2.6, z: 2.4 },
      materialKey: 'container_red',
      surfaceType: 'metal',
    },
    // Blue container block (Center South, double stacked)
    {
      id: 'c-blue-1',
      pos: { x: 4, y: 1.3, z: -4 },
      size: { x: 6.0, y: 2.6, z: 2.4 },
      materialKey: 'container_blue',
      surfaceType: 'metal',
    },
    {
      id: 'c-blue-top',
      pos: { x: 4, y: 3.9, z: -4 },
      size: { x: 6.0, y: 2.6, z: 2.4 },
      materialKey: 'container_blue',
      surfaceType: 'metal',
    },
    // Green container block (Angled chokepoint)
    {
      id: 'c-green-1',
      pos: { x: 0, y: 1.3, z: -12 },
      size: { x: 2.4, y: 2.6, z: 6.0 },
      materialKey: 'container_green',
      surfaceType: 'metal',
    },
    // Yellow container (West mid)
    {
      id: 'c-yellow-west',
      pos: { x: -14, y: 1.3, z: -6 },
      size: { x: 6.0, y: 2.6, z: 2.4 },
      materialKey: 'container_yellow',
      surfaceType: 'metal',
    },
    // Yellow container (East mid)
    {
      id: 'c-yellow-east',
      pos: { x: 14, y: 1.3, z: 6 },
      size: { x: 6.0, y: 2.6, z: 2.4 },
      materialKey: 'container_yellow',
      surfaceType: 'metal',
    },
    // Blue container (West alley)
    {
      id: 'c-blue-west',
      pos: { x: -12, y: 1.3, z: 8 },
      size: { x: 2.4, y: 2.6, z: 6.0 },
      materialKey: 'container_blue',
      surfaceType: 'metal',
    },
    // Green container (East alley)
    {
      id: 'c-green-east',
      pos: { x: 12, y: 1.3, z: -8 },
      size: { x: 2.4, y: 2.6, z: 6.0 },
      materialKey: 'container_green',
      surfaceType: 'metal',
    },

    // 4. Elevated Crane Catwalk / Sniper Vantage (North lane, y = 3.6m)
    {
      id: 'crane-catwalk',
      pos: { x: 0, y: 3.5, z: 14 },
      size: { x: 20, y: 0.2, z: 3.0 },
      materialKey: 'metal_grate',
      surfaceType: 'metal',
    },
    // Catwalk guardrails
    {
      id: 'crane-rail-s',
      pos: { x: 0, y: 4.15, z: 12.6 },
      size: { x: 20, y: 1.1, z: 0.2 },
      materialKey: 'metal_pipe',
      surfaceType: 'metal',
    },
    // Catwalk support legs
    {
      id: 'crane-leg-w',
      pos: { x: -9, y: 1.75, z: 14 },
      size: { x: 0.5, y: 3.5, z: 0.5 },
      materialKey: 'metal_beam',
      surfaceType: 'metal',
    },
    {
      id: 'crane-leg-e',
      pos: { x: 9, y: 1.75, z: 14 },
      size: { x: 0.5, y: 3.5, z: 0.5 },
      materialKey: 'metal_beam',
      surfaceType: 'metal',
    },

    // 5. Tactical Pallets & Concrete Barriers (Waist cover 1.1m)
    {
      id: 'barrier-alpha-1',
      pos: { x: -19, y: 0.55, z: -2 },
      size: { x: 3.5, y: 1.1, z: 0.6 },
      materialKey: 'concrete_barrier',
      surfaceType: 'concrete',
    },
    {
      id: 'barrier-bravo-1',
      pos: { x: 19, y: 0.55, z: 2 },
      size: { x: 3.5, y: 1.1, z: 0.6 },
      materialKey: 'concrete_barrier',
      surfaceType: 'concrete',
    },
    {
      id: 'pallets-mid-s',
      pos: { x: -6, y: 0.55, z: -4 },
      size: { x: 2.0, y: 1.1, z: 2.0 },
      materialKey: 'wood_crate',
      surfaceType: 'wood',
    },
    {
      id: 'pallets-mid-n',
      pos: { x: 6, y: 0.55, z: 4 },
      size: { x: 2.0, y: 1.1, z: 2.0 },
      materialKey: 'wood_crate',
      surfaceType: 'wood',
    },
  ],
  ramps: [
    // Ramp to West mid container (Rise = 1.3m, Run = 3.6m -> 20°)
    {
      id: 'ramp-west-container',
      pos: { x: -14, y: 0.65, z: -1.7 },
      width: 2.4,
      height: 1.3,
      length: 3.8,
      angleDeg: 20,
      rotY: Math.PI,
      materialKey: 'metal_grate',
      surfaceType: 'metal',
    },
  ],
  stairs: [
    // Stairs from ground to crane catwalk (at x = -10, rising up to y = 3.6m)
    {
      id: 'stairs-crane-west',
      startPos: { x: -12.0, y: 0, z: 14 },
      numSteps: 18,
      totalHeight: 3.5,
      stepDepth: 0.3,
      stepWidth: 1.8,
      direction: 'posX',
      materialKey: 'metal_grate',
      surfaceType: 'metal',
    },
  ],
  minimap: {
    viewSize: 66,
    center: { x: 0, z: 0 },
    bounds: { minX: -30, maxX: 30, minZ: -20, maxZ: 20 },
    walls2D: [
      [-30, -20, 30, -20],
      [30, -20, 30, 20],
      [30, 20, -30, 20],
      [-30, 20, -30, -20],
      [-5, 2.8, 1, 5.2],
      [1, -5.2, 7, -2.8],
      [-17, -7.2, -11, -4.8],
      [11, 4.8, 17, 7.2],
      [-10, 12.5, 10, 15.5],
    ],
    zones: [
      { name: 'Crane Catwalk', x: 0, z: 14 },
      { name: 'Container Maze', x: 0, z: 0 },
      { name: 'South Truck Lane', x: 0, z: -14 },
      { name: 'Alpha Yard', x: -24, z: 0 },
      { name: 'Bravo Yard', x: 24, z: 0 },
    ],
  },
};
