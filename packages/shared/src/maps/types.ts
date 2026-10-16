import { Vec3 } from '../types';

export type SurfaceType = 'concrete' | 'metal' | 'wood' | 'dirt' | 'stone';

export interface SpawnPoint {
  id: string;
  team: 'alpha' | 'bravo' | 'neutral';
  pos: Vec3;
  yaw: number; // heading in degrees (0 = facing -Z)
}

export interface MapBox {
  id: string;
  pos: Vec3; // center coordinates
  size: Vec3; // width (x), height (y), depth (z)
  rotX?: number; // radians
  rotY?: number; // radians
  rotZ?: number; // radians
  materialKey: string;
  surfaceType: SurfaceType;
  climbable?: boolean;
}

export interface MapRamp {
  id: string;
  pos: Vec3;
  width: number;
  height: number;
  length: number;
  angleDeg: number;
  rotY: number; // radians
  materialKey: string;
  surfaceType: SurfaceType;
}

export interface MapStairs {
  id: string;
  startPos: Vec3;
  numSteps: number;
  totalHeight: number;
  stepDepth: number;
  stepWidth: number;
  direction: 'posX' | 'negX' | 'posZ' | 'negZ';
  materialKey: string;
  surfaceType: SurfaceType;
}

export interface MapLightingSpec {
  ambientColor: number;
  ambientIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: Vec3;
  skyColor: number;
  groundColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
}

export interface MapMinimapSpec {
  viewSize: number;
  center: { x: number; z: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  walls2D: Array<[number, number, number, number]>; // [x1, z1, x2, z2] segments
  zones: Array<{ name: string; x: number; z: number }>;
}

export interface MapSpec {
  id: 'warehouse' | 'plaza' | 'containeryard';
  name: string;
  description: string;
  dimensions: { width: number; depth: number; height: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawns: SpawnPoint[];
  boxes: MapBox[];
  ramps: MapRamp[];
  stairs?: MapStairs[];
  lighting: MapLightingSpec;
  minimap: MapMinimapSpec;
}
