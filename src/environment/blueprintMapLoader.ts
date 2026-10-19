// src/environment/blueprintMapLoader.ts
// Loads and expands blueprint maps:
// - Data-driven enterable buildings with multiple floors, doors, windows, stairs, and flat roofs with parapets.
// - Open-world ground with procedural terrain texturing, dirt paths, and tactical earthen mounds.
// - Natural features: trees with trunk colliders & cosmetic canopies, sandstone boulders, and invisible perimeter blockers.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TargetManager, FX_NON_RAYCAST_LAYER } from './targets';
import type { BoxCollider, MapBounds } from '../player/firstPersonControls';

export type MapId = 'range' | 'foundry' | 'culdesac' | 'dustline' | 'overpass' | 'neighborhood' | 'warehouse';

export interface BlueprintBox {
  id: string;
  zone?: string;
  kind?: string;
  center: [number, number, number];
  size: [number, number, number];
  color: string;
  /** Render-only parts such as pallet slats and shelf decks can opt out of collision. */
  collision?: boolean;
}

export interface BuildingDoorway {
  offset: number; // offset along wall from -length/2 to +length/2
  width: number;  // >= 1.6m exterior, >= 1.2m interior
  height: number; // >= 2.2m
}

export interface BuildingWindow {
  offset: number;
  width: number;
  sillHeight: number; // >= 1.0m
  height: number;     // >= 1.0m
  hasPlayerBlocker?: boolean;
}

export interface BuildingWallSide {
  side: 'north' | 'south' | 'east' | 'west';
  doors?: BuildingDoorway[];
  windows?: BuildingWindow[];
}

export interface BuildingStairFlight {
  id: string;
  start: [number, number]; // [x, z] relative to building center
  direction: '+X' | '-X' | '+Z' | '-Z';
  width: number; // >= 1.2m
  stepRise: number; // <= 0.2m
  treadDepth: number; // >= 0.28m
  stepCount: number;
  leadsToRoof?: boolean;
  targetFloorY?: number;
}

export interface BuildingInteriorWall {
  start: [number, number]; // [x, z] relative to building center
  end: [number, number];
  doorways?: Array<{ offset: number; width: number; height: number }>;
}

export interface BuildingProp {
  id: string;
  kind: 'crate' | 'table' | 'counter' | 'shelf' | 'bench';
  pos: [number, number, number]; // [x, y, z] relative to building center
  size: [number, number, number];
  color?: string;
}

export interface BuildingLight {
  id: string;
  pos: [number, number, number]; // [x, y, z] relative to building center
  color: string;
  intensity: number;
  range: number;
}

export interface BuildingFloor {
  floorIndex: number;
  floorY: number; // base feet level (e.g. 0.0, 3.2)
  height: number; // floor-to-ceiling clearance >= 2.6m
  slabThickness?: number; // >= 0.15m
  wallThickness?: number; // e.g. 0.25m
  exteriorDoors?: BuildingDoorway[];
  interiorDoors?: BuildingDoorway[];
  windows?: BuildingWindow[];
  walls?: BuildingWallSide[];
  interiorWalls?: BuildingInteriorWall[];
  stairs?: BuildingStairFlight[];
  props?: BuildingProp[];
  lights?: BuildingLight[];
}

export interface BuildingRoof {
  type: 'flat_parapet' | 'pitched';
  parapetHeight?: number; // e.g. 0.9m
  parapetThickness?: number;
  accessFromStairs?: boolean;
  stairExitHole?: { x: number; z: number; width: number; length: number };
}

export interface BuildingDef {
  id: string;
  name: string;
  center: [number, number, number]; // [cx, cy, cz]
  size: [number, number]; // [width, depth]
  wallColor?: string;
  floorColor?: string;
  trimColor?: string;
  floors: BuildingFloor[];
  roof?: BuildingRoof;
}

export interface BlueprintMapData {
  meta: {
    name: string;
    mode?: string;
    theme?: string;
    /** Outer world span; warehouse uses 96m while its playableSize is 92m. */
    size?: [number, number];
    playableSize?: [number, number];
    wallHeight?: number;
    outerWallThickness?: number;
    interiorWallThickness?: number;
    mainCorridorClearWidth?: number;
    serviceCorridorClearWidth?: number;
    centralHallClearSize?: [number, number];
    version?: number;
    layoutStage?: string;
    note?: string;
  };
  zones?: Array<{
    id: string;
    name: string;
    number?: number;
    min: [number, number];
    max: [number, number];
  }>;
  buildings?: BuildingDef[];
  boxes?: BlueprintBox[];
  nature?: {
    trees?: Array<{ pos: [number, number, number]; scale?: number; style?: 'palm' | 'conifer' }>;
    rocks?: Array<{ pos: [number, number, number]; size: [number, number, number]; color?: string }>;
    mounds?: Array<{ pos: [number, number, number]; size: [number, number, number]; rotation?: number }>;
  };
  /** Static low-poly ground birds; shot hits hide the bird group. */
  perchedBirds?: Array<{ id: string; pos: [number, number, number]; scale?: number; color?: string }>;
  invisiblePerimeters?: Array<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  }>;
  lighting?: {
    sun?: {
      from?: string;
      color?: string;
      intensity?: number | string;
      elevation_deg?: number;
    };
    hemisphere?: { sky: string; ground: string; intensity: number };
    fog?: { color: string; density?: number };
    points?: Array<{
      id: string;
      x: number;
      y: number;
      z: number;
      color: string;
      intensity: number;
      range: number;
    }>;
  };
  spawns?: {
    teamA?: { facing: string; points: [number, number][] };
    teamB?: { facing: string; points: [number, number][] };
  };
  /** Reserved player-slot positions for a future 4v4 runtime; not target dummies. */
  teamSpawns?: {
    teamA?: Array<{ position: [number, number]; facingYaw: number }>;
    teamB?: Array<{ position: [number, number]; facingYaw: number }>;
  };
}

export interface LoadedMapResult {
  name: string;
  theme?: string;
  spawn: { x: number; y: number; z: number; facingYaw: number };
  bounds: MapBounds;
  colliders: BoxCollider[];
  buildings: BuildingDef[];
  zones?: BlueprintMapData['zones'];
  teamSpawns?: BlueprintMapData['teamSpawns'];
}

export const MAP_INFO: Record<MapId, { name: string; file?: string }> = {
  range: { name: 'Tactical Shooting Range' },
  foundry: { name: 'Foundry Yard', file: '/maps/foundry_yard.json' },
  culdesac: { name: 'Cul-de-Sac', file: '/maps/Cul-de-Sac.json' },
  dustline: { name: 'Dustline Village', file: '/maps/Dustline Village.json' },
  overpass: { name: 'Overpass Arena', file: '/maps/Overpass.json' },
  neighborhood: { name: 'Neighborhood District', file: '/maps/neighborhood.json' },
  warehouse: { name: 'Warehouse — Section 1', file: '/maps/warehouse_layout.json' },
};

export class BlueprintMapLoader {
  private scene: THREE.Scene;
  private currentMapGroup: THREE.Group | null = null;
  private currentLightsGroup: THREE.Group | null = null;
  public currentMapId: MapId = 'range';
  public isLoading: boolean = false;
  private loadedBuildings: BuildingDef[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public clearCurrentMap() {
    if (this.currentMapGroup) {
      this.scene.remove(this.currentMapGroup);
      this.currentMapGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.currentMapGroup = null;
    }

    if (this.currentLightsGroup) {
      this.scene.remove(this.currentLightsGroup);
      this.currentLightsGroup = null;
    }

    this.loadedBuildings = [];
    this.scene.fog = new THREE.FogExp2(0x07090e, 0.01);
    this.scene.background = new THREE.Color(0x07090e);
  }

  public isPlayerIndoors(px: number, py: number, pz: number): boolean {
    const feetY = py - 1.7;
    for (const bldg of this.loadedBuildings) {
      const [cx, cy, cz] = bldg.center;
      const [bw, bd] = bldg.size;
      const minX = cx - bw / 2;
      const maxX = cx + bw / 2;
      const minZ = cz - bd / 2;
      const maxZ = cz + bd / 2;

      if (px >= minX && px <= maxX && pz >= minZ && pz <= maxZ) {
        const topFloor = bldg.floors[bldg.floors.length - 1];
        const roofY = cy + topFloor.floorY + topFloor.height;
        if (feetY >= cy - 0.2 && feetY < roofY) {
          return true;
        }
      }
    }
    return false;
  }

  public async loadMap(
    mapId: MapId,
    targetManager?: TargetManager
  ): Promise<LoadedMapResult> {
    this.isLoading = true;
    this.clearCurrentMap();
    this.currentMapId = mapId;

    if (mapId === 'range') {
      if (targetManager) {
        targetManager.clearDynamicTargets();
        targetManager.setRangeTargetsVisible(true);
      }
      return {
        name: 'Tactical Shooting Range',
        spawn: { x: 0, y: 1.7, z: 0, facingYaw: 0 },
        bounds: { minX: -7.5, maxX: 7.5, minZ: -3.2, maxZ: 5.5 },
        colliders: [],
        buildings: [],
      };
    }

    const info = MAP_INFO[mapId];
    if (!info.file) {
      return {
        name: info.name,
        spawn: { x: 0, y: 1.7, z: 0, facingYaw: 0 },
        bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 },
        colliders: [],
        buildings: [],
      };
    }

    const response = await fetch(info.file);
    if (!response.ok) {
      throw new Error(`Failed to load blueprint map: ${info.file}`);
    }
    const data: BlueprintMapData = await response.json();

    const mapGroup = new THREE.Group();
    mapGroup.name = `map-${mapId}-geometry`;

    const lightsGroup = new THREE.Group();
    lightsGroup.name = `map-${mapId}-lights`;

    const colliders: BoxCollider[] = [];
    const materialCache = new Map<string, THREE.MeshStandardMaterial>();

    const getMaterial = (hex: string, roughness = 0.85, metalness = 0.1) => {
      let m = materialCache.get(hex);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color: hex, roughness, metalness });
        materialCache.set(hex, m);
      }
      return m;
    };

    // 1. Procedural ground plane. Warehouse is an indoor 96m shell, so do not
    // extend its concrete floor into a large outdoor apron as the legacy arenas do.
    const groundSpan = data.meta.size
      ? Math.max(data.meta.size[0], data.meta.size[1]) * (mapId === 'warehouse' ? 1 : 1.5)
      : 120;
    const groundTexture = this.generateProceduralGroundTexture(data.meta.theme || 'arid', groundSpan);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.92,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSpan, groundSpan, 1, 1),
      groundMat
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    mapGroup.add(groundMesh);

    // 2. Expand Buildings into Full Visuals & Colliders
    this.loadedBuildings = data.buildings || [];
    if (data.buildings) {
      data.buildings.forEach((bldg) => {
        this.expandBuilding(bldg, colliders, mapGroup, lightsGroup, getMaterial);
      });
    }

    // 3. Expand Simple Boxes & Cover Props (if defined in JSON)
    if (data.boxes) {
      data.boxes.forEach((box) => {
        const hex = box.color || '#718096';
        const isMetal = box.kind === 'container' || box.kind === 'metal' || box.kind === 'cont';
        const mat = getMaterial(hex, isMetal ? 0.35 : 0.8, isMetal ? 0.85 : 0.15);

        const [w, h, d] = box.size;
        const [cx, cy, cz] = box.center;

        const geom = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(cx, cy, cz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mapGroup.add(mesh);

        const isRoof = box.kind === 'roof';
        const isWalkable = box.kind === 'stairs' || box.kind === 'stair' || box.kind === 'platform';

        if (!isRoof && box.collision !== false) {
          colliders.push({
            minX: cx - w / 2,
            maxX: cx + w / 2,
            minY: cy - h / 2,
            maxY: cy + h / 2,
            minZ: cz - d / 2,
            maxZ: cz + d / 2,
            isWalkable,
          });
        }
      });
    }

    // 3.5. Warehouse base-stage industrial point lights. Fixture meshes are
    // emissive and non-colliding; actual point lights are grouped so map changes cleanly remove them.
    if (mapId === 'warehouse' && data.lighting?.points) {
      const fixtureGeometry = new THREE.BoxGeometry(1.35, 0.08, 0.32);
      const fixtureMaterial = new THREE.MeshStandardMaterial({
        color: '#f2e7d2',
        emissive: '#ffe3b0',
        emissiveIntensity: 1.45,
        roughness: 0.42,
        metalness: 0.08,
      });
      data.lighting.points.forEach((lightData) => {
        const light = new THREE.PointLight(
          lightData.color,
          lightData.intensity,
          lightData.range,
          2
        );
        light.name = `warehouse-light-${lightData.id}`;
        light.position.set(lightData.x, lightData.y, lightData.z);
        light.castShadow = false;
        lightsGroup.add(light);

        const fixture = new THREE.Mesh(fixtureGeometry, fixtureMaterial);
        fixture.name = `warehouse-fixture-${lightData.id}`;
        fixture.position.set(lightData.x, lightData.y + 0.35, lightData.z);
        fixture.userData.ignoreRaycast = true;
        fixture.castShadow = false;
        fixture.receiveShadow = false;
        mapGroup.add(fixture);
      });
    }

    // 4. Expand Nature: Trees, Rocks, Earthen Mounds
    if (data.nature) {
      this.expandNature(data.nature, colliders, mapGroup, getMaterial);
    }

    // 4.5. Static low-poly birds that can be hit and disappear on impact.
    if (data.perchedBirds) {
      data.perchedBirds.forEach((bird) => this.expandPerchedBird(bird, mapGroup, getMaterial));
    }

    // 5. Invisible Perimeter Player Blockers
    if (data.invisiblePerimeters) {
      data.invisiblePerimeters.forEach((p) => {
        colliders.push({
          minX: p.minX,
          maxX: p.maxX,
          minY: p.minY,
          maxY: p.maxY,
          minZ: p.minZ,
          maxZ: p.maxZ,
          isWalkable: false,
        });
      });
    }

    this.scene.add(mapGroup);
    this.scene.add(lightsGroup);
    this.currentMapGroup = mapGroup;
    this.currentLightsGroup = lightsGroup;

    // 6. Playable bounds can be smaller than the outer architecture (warehouse
    // has 96m external dimensions but a 92m player-playable interior).
    const boundSize = data.meta.playableSize || data.meta.size;
    const halfW = boundSize ? boundSize[0] / 2 : 45;
    const halfD = boundSize ? boundSize[1] / 2 : 45;
    const bounds: MapBounds = {
      minX: -halfW,
      maxX: halfW,
      minZ: -halfD,
      maxZ: halfD,
    };

    let spawnX = 0;
    let spawnZ = -halfD * 0.55;
    let spawnYaw = Math.PI; // Face North (+Z) towards center

    if (mapId === 'dustline') {
      spawnX = 0;
      spawnZ = -28.0;
      spawnYaw = Math.PI;
    } else if (mapId === 'culdesac') {
      spawnX = -7.0;
      spawnZ = -12.0;
      spawnYaw = Math.PI;
    } else if (mapId === 'foundry') {
      spawnX = 0;
      spawnZ = -22.0;
      spawnYaw = Math.PI;
    } else if (mapId === 'overpass') {
      spawnX = 0;
      spawnZ = -22.0;
      spawnYaw = Math.PI;
    } else if (mapId === 'neighborhood') {
      spawnX = 0;
      spawnZ = -42.0;
      spawnYaw = Math.PI;
    } else if (mapId === 'warehouse') {
      spawnX = 0;
      spawnZ = -39.5;
      spawnYaw = Math.PI;
    }

    // 7. Tactical Reactive Targets
    if (targetManager) {
      targetManager.setRangeTargetsVisible(false);
      targetManager.clearDynamicTargets();

      if (data.spawns?.teamB?.points) {
        data.spawns.teamB.points.forEach(([tx, tz]) => {
          targetManager.addDynamicTarget(tx, 0, tz, true);
        });
      }

      if (mapId === 'dustline') {
        targetManager.addDynamicTarget(0, 0, 0, true);
        targetManager.addDynamicTarget(-16, 0, -2, true);
        targetManager.addDynamicTarget(16, 0, 2, true);
        targetManager.addDynamicTarget(0, 0, 18, true);
      }
    }

    this.isLoading = false;
    return {
      name: data.meta.name,
      theme: data.meta.theme,
      spawn: { x: spawnX, y: 1.7, z: spawnZ, facingYaw: spawnYaw },
      bounds,
      colliders,
      buildings: this.loadedBuildings,
      zones: data.zones,
      teamSpawns: data.teamSpawns,
    };
  }

  /**
   * Generates a 1024x1024 high-detail procedural terrain canvas texture.
   */
  private generateProceduralGroundTexture(theme: string, groundSpan: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Base ground color. Neighborhood uses a single, map-aligned texture so roads
    // align with actual blocks instead of repeating a generic cross-road tile.
    const isArid = theme === 'arid' || theme === 'desert';
    const isNeighborhood = theme === 'neighborhood';
    const isWarehouse = theme === 'warehouse';
    ctx.fillStyle = isWarehouse ? '#5e656b' : (isNeighborhood ? '#78935a' : (isArid ? '#cbb58c' : '#3e4836'));
    ctx.fillRect(0, 0, 1024, 1024);

    // Low-poly ground variation; texture is generated once per map load.
    for (let i = 0; i < (isNeighborhood ? 6500 : (isWarehouse ? 4200 : 8000)); i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const size = 1 + Math.random() * (isNeighborhood ? 5 : (isWarehouse ? 3 : 4));
      const bright = Math.random() > 0.5;
      ctx.fillStyle = isNeighborhood
        ? (bright ? 'rgba(192, 202, 129, 0.18)' : 'rgba(56, 94, 47, 0.16)')
        : isWarehouse
          ? (bright ? 'rgba(230, 235, 239, 0.055)' : 'rgba(20, 26, 31, 0.075)')
          : (bright
            ? (isArid ? 'rgba(235, 220, 190, 0.25)' : 'rgba(90, 110, 80, 0.25)')
            : (isArid ? 'rgba(150, 125, 90, 0.25)' : 'rgba(40, 50, 35, 0.25)'));
      ctx.fillRect(x, y, size, size);
    }

    if (isNeighborhood) {
      const toPx = (world: number) => ((world + groundSpan / 2) / groundSpan) * 1024;
      const roadHalf = (4.2 / 2 / groundSpan) * 1024;
      const walkHalf = (0.8 / 2 / groundSpan) * 1024;
      const roadAxes = [-33, -16, 16, 33];
      // Sidewalk strips first, then asphalt, so the road edges remain readable.
      ctx.fillStyle = '#c4c4b8';
      for (const axis of roadAxes) {
        const p = toPx(axis);
        const outerHalf = roadHalf + walkHalf;
        ctx.fillRect(p - outerHalf, 0, outerHalf * 2, 1024);
        ctx.fillRect(0, p - outerHalf, 1024, outerHalf * 2);
      }
      ctx.fillStyle = '#505963';
      for (const axis of roadAxes) {
        const p = toPx(axis);
        ctx.fillRect(p - roadHalf, 0, roadHalf * 2, 1024);
        ctx.fillRect(0, p - roadHalf, 1024, roadHalf * 2);
      }
      // Broken center markings on streets; keep them subtle in the stylized art direction.
      ctx.strokeStyle = '#e7cf79';
      ctx.lineWidth = Math.max(1.5, 0.07 / groundSpan * 1024);
      ctx.setLineDash([toPx(2.2) - toPx(0), toPx(1.5) - toPx(0)]);
      for (const axis of [-33, 33]) {
        const p = toPx(axis);
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 1024); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(1024, p); ctx.stroke();
      }
      ctx.setLineDash([]);
      // A central green park pocket with pale cross paths and a paved gathering node.
      const parkMin = toPx(-11.5), parkMax = toPx(11.5);
      ctx.fillStyle = '#6f9450';
      ctx.fillRect(parkMin, parkMin, parkMax - parkMin, parkMax - parkMin);
      ctx.fillStyle = '#c4bda0';
      const pathWidth = (1.15 / groundSpan) * 1024;
      const parkMid = toPx(0);
      ctx.fillRect(parkMid - pathWidth / 2, parkMin, pathWidth, parkMax - parkMin);
      ctx.fillRect(parkMin, parkMid - pathWidth / 2, parkMax - parkMin, pathWidth);
      ctx.fillStyle = '#b8b4a2';
      const plazaHalf = (2.3 / groundSpan) * 1024;
      ctx.fillRect(parkMid - plazaHalf, parkMid - plazaHalf, plazaHalf * 2, plazaHalf * 2);
      // Small garden beds on the four park corners.
      ctx.fillStyle = '#496f40';
      const bed = (1.4 / groundSpan) * 1024;
      for (const [gx, gz] of [[-8.5, -8.5], [8.5, -8.5], [-8.5, 8.5], [8.5, 8.5]]) {
        const px = toPx(gx), pz = toPx(gz);
        ctx.fillRect(px - bed, pz - bed, bed * 2, bed * 2);
      }
      // Crosswalk bars at non-central intersections.
      ctx.fillStyle = '#e7e4d8';
      for (const axis of [-33, 33]) {
        const p = toPx(axis);
        const stripe = (0.18 / groundSpan) * 1024;
        const gap = (0.24 / groundSpan) * 1024;
        for (let k = -5; k <= 5; k++) {
          const offset = k * (stripe + gap);
          ctx.fillRect(p - roadHalf + offset, toPx(-16) - roadHalf, stripe, roadHalf * 2);
          ctx.fillRect(p - roadHalf + offset, toPx(16) - roadHalf, stripe, roadHalf * 2);
          ctx.fillRect(toPx(-16) - roadHalf, p - roadHalf + offset, roadHalf * 2, stripe);
          ctx.fillRect(toPx(16) - roadHalf, p - roadHalf + offset, roadHalf * 2, stripe);
        }
      }
    } else if (isWarehouse) {
      const toPx = (world: number) => ((world + groundSpan / 2) / groundSpan) * 1024;

      // Concrete expansion joints on a 6m grid; these are painted floor details,
      // not extra physical objects, so the stage remains a walls-only blockout.
      ctx.strokeStyle = 'rgba(224, 231, 236, 0.14)';
      ctx.lineWidth = 1.25;
      for (let axis = -45; axis <= 45; axis += 6) {
        const px = toPx(axis);
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, 1024); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, px); ctx.lineTo(1024, px); ctx.stroke();
      }

      // A subtle painted guide line marks the centre of the 4m cross-corridor.
      ctx.strokeStyle = 'rgba(232, 193, 96, 0.52)';
      ctx.lineWidth = Math.max(1.5, 0.06 / groundSpan * 1024);
      ctx.setLineDash([toPx(1.5) - toPx(0), toPx(2.5) - toPx(0)]);
      const mid = toPx(0);
      ctx.beginPath(); ctx.moveTo(mid, 0); ctx.lineTo(mid, 1024); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(1024, mid); ctx.stroke();
      ctx.setLineDash([]);

      // Spawn pads and side loading-bay safety zones are painted onto the concrete.
      ctx.fillStyle = 'rgba(50, 145, 220, 0.16)';
      ctx.fillRect(toPx(-7.5), Math.min(toPx(34.5), toPx(46.5)), toPx(7.5) - toPx(-7.5), Math.abs(toPx(34.5) - toPx(46.5)));
      ctx.fillStyle = 'rgba(220, 65, 76, 0.14)';
      ctx.fillRect(toPx(-7.5), Math.min(toPx(-34.5), toPx(-46.5)), toPx(7.5) - toPx(-7.5), Math.abs(toPx(-34.5) - toPx(-46.5)));

      ctx.fillStyle = 'rgba(230, 186, 71, 0.24)';
      const dockStart = toPx(-46.5), dockEnd = toPx(-39.5);
      const dockMinZ = toPx(-8), dockMaxZ = toPx(8);
      ctx.fillRect(dockStart, dockMinZ, dockEnd - dockStart, dockMaxZ - dockMinZ);
      ctx.fillRect(toPx(39.5), dockMinZ, toPx(46.5) - toPx(39.5), dockMaxZ - dockMinZ);

      // Numbered section markers make the planned four-part build sequence visible.
      // CanvasTexture appears X-mirrored after the ground plane is rotated into XZ,
      // so label positions are assigned on the opposite world-X side.
      const sectionMarks = [
        { label: '1', x: 22, z: 22 },
        { label: '2', x: -22, z: 22 },
        { label: '3', x: 22, z: -22 },
        { label: '4', x: -22, z: -22 },
      ];
      for (const mark of sectionMarks) {
        const px = toPx(mark.x);
        const pz = toPx(mark.z);
        ctx.beginPath();
        ctx.arc(px, pz, 50, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(26, 71, 94, 0.38)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(64, 188, 239, 0.78)';
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(226, 245, 255, 0.78)';
        ctx.font = '800 58px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // The floor UVs invert the glyph vertically in the top-down view; rotate
        // each glyph in texture space so the visible in-game number reads upright.
        ctx.save();
        ctx.translate(px, pz);
        ctx.rotate(Math.PI);
        ctx.fillText(mark.label, 0, 0);
        ctx.restore();
      }
    } else {
      // Legacy tiled terrain used by the existing arenas.
      ctx.fillStyle = isArid ? 'rgba(168, 142, 105, 0.45)' : 'rgba(55, 48, 38, 0.45)';
      ctx.fillRect(440, 0, 144, 1024);
      ctx.fillRect(0, 440, 1024, 144);
      ctx.fillStyle = isArid ? 'rgba(195, 175, 140, 0.35)' : 'rgba(75, 75, 75, 0.35)';
      ctx.fillRect(360, 360, 304, 304);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(isNeighborhood || isWarehouse ? 1 : 8, isNeighborhood || isWarehouse ? 1 : 8);
    return texture;
  }

  /**
   * Expands a BuildingDef into floors, slabs, doors, windows with thin player blockers,
   * staircases with landings, rooftops with parapets, interior props, and lights.
   */
  private expandBuilding(
    bldg: BuildingDef,
    colliders: BoxCollider[],
    mapGroup: THREE.Group,
    lightsGroup: THREE.Group,
    getMat: (hex: string, r?: number, m?: number) => THREE.MeshStandardMaterial
  ) {
    const [bx, by, bz] = bldg.center;
    const [bw, bd] = bldg.size;

    const wallColor = bldg.wallColor || '#d2b48c';
    const floorColor = bldg.floorColor || '#b89e78';
    const trimColor = bldg.trimColor || '#a0522d';

    const wallMat = getMat(wallColor, 0.88, 0.05);
    const floorMat = getMat(floorColor, 0.85, 0.08);
    const trimMat = getMat(trimColor, 0.75, 0.12);

    const buildingGroup = new THREE.Group();
    buildingGroup.name = `building-${bldg.id}`;
    buildingGroup.position.set(bx, by, bz);

    const slabThickness = 0.2;
    const wallThickness = 0.25;

    const slabGeoms: THREE.BufferGeometry[] = [];
    const wallGeoms: THREE.BufferGeometry[] = [];
    const trimGeoms: THREE.BufferGeometry[] = [];
    const glassGeoms: THREE.BufferGeometry[] = [];

    bldg.floors.forEach((fl) => {
      const flY = fl.floorY;
      const flH = fl.height;
      const ceilY = flY + flH;

      // ── A. Slab above this floor (Ceiling for this floor, Floor/Roof for above) ──
      // Find any stair on this floor that ascends through this slab (to next floor or roof)
      const ascendingStair = fl.stairs?.find((st) => (st.targetFloorY ?? 0) >= ceilY - 0.2);

      let hole: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;
      if (ascendingStair) {
        const [sx, sz] = ascendingStair.start;
        const count = ascendingStair.stepCount;
        const tread = Math.max(0.28, ascendingStair.treadDepth);
        const width = Math.max(1.2, ascendingStair.width);
        const margin = 0.3; // side clearance

        if (ascendingStair.direction === '+Z') {
          hole = {
            minX: sx - width / 2 - margin,
            maxX: sx + width / 2 + margin,
            minZ: sz + 4 * tread,
            maxZ: sz + count * tread + 0.1,
          };
        } else if (ascendingStair.direction === '-Z') {
          hole = {
            minX: sx - width / 2 - margin,
            maxX: sx + width / 2 + margin,
            minZ: sz - count * tread - 0.1,
            maxZ: sz - 4 * tread,
          };
        } else if (ascendingStair.direction === '+X') {
          hole = {
            minX: sx + 4 * tread,
            maxX: sx + count * tread + 0.1,
            minZ: sz - width / 2 - margin,
            maxZ: sz + width / 2 + margin,
          };
        } else { // -X
          hole = {
            minX: sx - count * tread - 0.1,
            maxX: sx - 4 * tread,
            minZ: sz - width / 2 - margin,
            maxZ: sz + width / 2 + margin,
          };
        }
      }

      const subSlabs: Array<{ xMin: number; xMax: number; zMin: number; zMax: number }> = [];
      if (!hole) {
        subSlabs.push({ xMin: -bw / 2, xMax: bw / 2, zMin: -bd / 2, zMax: bd / 2 });
      } else {
        const hMinX = Math.max(-bw / 2 + wallThickness, Math.min(bw / 2 - wallThickness, hole.minX));
        const hMaxX = Math.max(-bw / 2 + wallThickness, Math.min(bw / 2 - wallThickness, hole.maxX));
        const hMinZ = Math.max(-bd / 2 + wallThickness, Math.min(bd / 2 - wallThickness, hole.minZ));
        const hMaxZ = Math.max(-bd / 2 + wallThickness, Math.min(bd / 2 - wallThickness, hole.maxZ));

        // North sub-slab: [-bw/2, bw/2] x [-bd/2, hMinZ]
        if (hMinZ - (-bd / 2) > 0.1) {
          subSlabs.push({ xMin: -bw / 2, xMax: bw / 2, zMin: -bd / 2, zMax: hMinZ });
        }
        // South sub-slab: [-bw/2, bw/2] x [hMaxZ, bd/2]
        if (bd / 2 - hMaxZ > 0.1) {
          subSlabs.push({ xMin: -bw / 2, xMax: bw / 2, zMin: hMaxZ, zMax: bd / 2 });
        }
        // West sub-slab: [-bw/2, hMinX] x [hMinZ, hMaxZ]
        if (hMinX - (-bw / 2) > 0.1) {
          subSlabs.push({ xMin: -bw / 2, xMax: hMinX, zMin: hMinZ, zMax: hMaxZ });
        }
        // East sub-slab: [hMaxX, bw/2] x [hMinZ, hMaxZ]
        if (bw / 2 - hMaxX > 0.1) {
          subSlabs.push({ xMin: hMaxX, xMax: bw / 2, zMin: hMinZ, zMax: hMaxZ });
        }
      }

      // Add visual meshes and colliders for each sub-slab
      const slabCenterY = ceilY + slabThickness / 2;
      subSlabs.forEach((s) => {
        const sw = s.xMax - s.xMin;
        const sd = s.zMax - s.zMin;
        const cx = (s.xMin + s.xMax) / 2;
        const cz = (s.zMin + s.zMax) / 2;

        const geom = new THREE.BoxGeometry(sw, slabThickness, sd);
        geom.translate(cx, slabCenterY, cz);
        slabGeoms.push(geom);

        colliders.push({
          minX: bx + s.xMin,
          maxX: bx + s.xMax,
          minY: by + ceilY,
          maxY: by + ceilY + slabThickness,
          minZ: bz + s.zMin,
          maxZ: bz + s.zMax,
          isWalkable: true, // Walkable from above (floor or roof) and ceiling from below
        });
      });

      // ── C. Exterior Walls with Doorways & Windows ──────────────────────
      const wallSides: BuildingWallSide[] = fl.walls || [
        { side: 'north', doors: fl.exteriorDoors?.filter((d) => (d as any).wallSide === 'north'), windows: fl.windows?.filter((w) => (w as any).wallSide === 'north') },
        { side: 'south', doors: fl.exteriorDoors?.filter((d) => (d as any).wallSide === 'south'), windows: fl.windows?.filter((w) => (w as any).wallSide === 'south') },
        { side: 'west',  doors: fl.exteriorDoors?.filter((d) => (d as any).wallSide === 'west'),  windows: fl.windows?.filter((w) => (w as any).wallSide === 'west') },
        { side: 'east',  doors: fl.exteriorDoors?.filter((d) => (d as any).wallSide === 'east'),  windows: fl.windows?.filter((w) => (w as any).wallSide === 'east') },
      ];

      wallSides.forEach((ws) => {
        const isNorthSouth = ws.side === 'north' || ws.side === 'south';
        const wallLength = isNorthSouth ? bw : bd;
        const wallZ = ws.side === 'north' ? -bd / 2 + wallThickness / 2 : (ws.side === 'south' ? bd / 2 - wallThickness / 2 : 0);
        const wallX = ws.side === 'west'  ? -bw / 2 + wallThickness / 2 : (ws.side === 'east'  ? bw / 2 - wallThickness / 2 : 0);

        // Gather all openings (doors & windows)
        const openings: Array<{
          offset: number;
          width: number;
          type: 'door' | 'window';
          sill: number;
          height: number;
        }> = [];

        if (ws.doors) {
          ws.doors.forEach((d) => {
            openings.push({
              offset: d.offset,
              width: Math.max(1.6, d.width),
              type: 'door',
              sill: 0,
              height: Math.max(2.2, d.height),
            });
          });
        }

        if (ws.windows) {
          ws.windows.forEach((w) => {
            openings.push({
              offset: w.offset,
              width: Math.max(1.0, w.width),
              type: 'window',
              sill: Math.max(1.0, w.sillHeight),
              height: Math.max(1.0, w.height),
            });
          });
        }

        // Sort openings along wall axis
        openings.sort((a, b) => a.offset - b.offset);

        // Helper to add solid wall block
        const addWallBlock = (start: number, end: number, yBottom: number, yTop: number) => {
          const segLen = end - start;
          if (segLen <= 0.05) return;
          const segH = yTop - yBottom;
          if (segH <= 0.05) return;

          const centerAlong = (start + end) / 2;
          const centerY = yBottom + segH / 2;

          let segW = isNorthSouth ? segLen : wallThickness;
          let segD = isNorthSouth ? wallThickness : segLen;
          let segX = isNorthSouth ? centerAlong : wallX;
          let segZ = isNorthSouth ? wallZ : centerAlong;

          const geom = new THREE.BoxGeometry(segW, segH, segD);
          geom.translate(segX, flY + centerY, segZ);
          wallGeoms.push(geom);

          colliders.push({
            minX: bx + segX - segW / 2,
            maxX: bx + segX + segW / 2,
            minY: by + flY + yBottom,
            maxY: by + flY + yTop,
            minZ: bz + segZ - segD / 2,
            maxZ: bz + segZ + segD / 2,
            isWalkable: false,
          });
        };

        let currentPos = -wallLength / 2;

        openings.forEach((op) => {
          const opStart = op.offset - op.width / 2;
          const opEnd = op.offset + op.width / 2;

          // 1. Solid full-height wall before opening
          if (opStart > currentPos) {
            addWallBlock(currentPos, opStart, 0, flH);
          }

          // 2. Lintel above opening
          const lintelBottom = op.type === 'door' ? op.height : op.sill + op.height;
          if (flH > lintelBottom) {
            addWallBlock(opStart, opEnd, lintelBottom, flH);
          }

          // 3. Under-window sill wall
          if (op.type === 'window' && op.sill > 0) {
            addWallBlock(opStart, opEnd, 0, op.sill);
          }

          // 4. Window Opening: Thin player-only blocker (bullets pass through via Layer 2 exemption!)
          if (op.type === 'window') {
            const winW = isNorthSouth ? op.width : 0.05;
            const winD = isNorthSouth ? 0.05 : op.width;
            const winCenterAlong = op.offset;
            const winX = isNorthSouth ? winCenterAlong : wallX;
            const winZ = isNorthSouth ? wallZ : winCenterAlong;
            const winBottom = flY + op.sill;
            const winTop = flY + op.sill + op.height;

            // Thin player-only blocker collider
            colliders.push({
              minX: bx + winX - winW / 2,
              maxX: bx + winX + winW / 2,
              minY: by + winBottom,
              maxY: by + winTop,
              minZ: bz + winZ - winD / 2,
              maxZ: bz + winZ + winD / 2,
              isWalkable: false,
            });

            // Window glass geometry
            const glassGeom = new THREE.BoxGeometry(winW, op.height, winD);
            glassGeom.translate(winX, (winBottom + winTop) / 2, winZ);
            glassGeoms.push(glassGeom);
          }

          currentPos = Math.max(currentPos, opEnd);
        });

        // Solid full-height wall after last opening
        if (currentPos < wallLength / 2) {
          addWallBlock(currentPos, wallLength / 2, 0, flH);
        }
      });

      // ── D. Interior Partition Walls & Doorways ────────────────────────
      if (fl.interiorWalls) {
        fl.interiorWalls.forEach((iw) => {
          const [x1, z1] = iw.start;
          const [x2, z2] = iw.end;
          const dx = x2 - x1;
          const dz = z2 - z1;
          const len = Math.hypot(dx, dz);
          const angle = Math.atan2(dx, dz);
          const iThick = 0.2;

          const doors = iw.doorways || [];
          if (doors.length === 0) {
            // Solid interior wall
            const geom = new THREE.BoxGeometry(iThick, flH, len);
            geom.rotateY(angle);
            geom.translate((x1 + x2) / 2, flY + flH / 2, (z1 + z2) / 2);
            wallGeoms.push(geom);

            const minX = Math.min(x1, x2) - iThick / 2;
            const maxX = Math.max(x1, x2) + iThick / 2;
            const minZ = Math.min(z1, z2) - iThick / 2;
            const maxZ = Math.max(z1, z2) + iThick / 2;

            colliders.push({
              minX: bx + minX,
              maxX: bx + maxX,
              minY: by + flY,
              maxY: by + ceilY,
              minZ: bz + minZ,
              maxZ: bz + maxZ,
              isWalkable: false,
            });
          } else {
            // Interior wall with doorway (width >= 1.2m)
            const d = doors[0];
            const dWidth = Math.max(1.2, d.width);
            const dHeight = Math.max(2.2, d.height);

            const seg1Len = (len - dWidth) / 2;
            const m1x = x1 + (dx / len) * (seg1Len / 2);
            const m1z = z1 + (dz / len) * (seg1Len / 2);

            // First segment
            const g1 = new THREE.BoxGeometry(iThick, flH, seg1Len);
            g1.rotateY(angle);
            g1.translate(m1x, flY + flH / 2, m1z);
            wallGeoms.push(g1);

            colliders.push({
              minX: bx + m1x - iThick,
              maxX: bx + m1x + iThick,
              minY: by + flY,
              maxY: by + ceilY,
              minZ: bz + m1z - seg1Len / 2,
              maxZ: bz + m1z + seg1Len / 2,
              isWalkable: false,
            });

            // Second segment
            const m2x = x2 - (dx / len) * (seg1Len / 2);
            const m2z = z2 - (dz / len) * (seg1Len / 2);
            const g2 = new THREE.BoxGeometry(iThick, flH, seg1Len);
            g2.rotateY(angle);
            g2.translate(m2x, flY + flH / 2, m2z);
            wallGeoms.push(g2);

            colliders.push({
              minX: bx + m2x - iThick,
              maxX: bx + m2x + iThick,
              minY: by + flY,
              maxY: by + ceilY,
              minZ: bz + m2z - seg1Len / 2,
              maxZ: bz + m2z + seg1Len / 2,
              isWalkable: false,
            });

            // Lintel above doorway
            const lintelH = flH - dHeight;
            if (lintelH > 0.05) {
              const mlx = (x1 + x2) / 2;
              const mlz = (z1 + z2) / 2;
              const gLintel = new THREE.BoxGeometry(iThick, lintelH, dWidth);
              gLintel.rotateY(angle);
              gLintel.translate(mlx, flY + dHeight + lintelH / 2, mlz);
              wallGeoms.push(gLintel);

              colliders.push({
                minX: bx + mlx - iThick,
                maxX: bx + mlx + iThick,
                minY: by + flY + dHeight,
                maxY: by + ceilY,
                minZ: bz + mlz - dWidth / 2,
                maxZ: bz + mlz + dWidth / 2,
                isWalkable: false,
              });
            }
          }
        });
      }

      // ── E. Interior Staircase Flights ─────────────────────────────────
      if (fl.stairs) {
        fl.stairs.forEach((st) => {
          const [sx, sz] = st.start;
          const count = st.stepCount;
          const rise = Math.min(0.2, st.stepRise);
          const tread = Math.max(0.28, st.treadDepth);
          const width = Math.max(1.2, st.width);

          let curX = sx;
          let curZ = sz;
          let curY = flY;

          for (let step = 0; step < count; step++) {
            curY += rise;
            if (st.direction === '+Z') curZ += tread;
            else if (st.direction === '-Z') curZ -= tread;
            else if (st.direction === '+X') curX += tread;
            else if (st.direction === '-X') curX -= tread;

            const isZAxis = st.direction === '+Z' || st.direction === '-Z';
            const stepW = isZAxis ? width : tread;
            const stepD = isZAxis ? tread : width;

            const stepGeom = new THREE.BoxGeometry(stepW, rise, stepD);
            stepGeom.translate(curX, curY - rise / 2, curZ);
            trimGeoms.push(stepGeom);

            colliders.push({
              minX: bx + curX - stepW / 2,
              maxX: bx + curX + stepW / 2,
              minY: by + curY - rise,
              maxY: by + curY,
              minZ: bz + curZ - stepD / 2,
              maxZ: bz + curZ + stepD / 2,
              isWalkable: true,
            });
          }
        });
      }

      // ── F. Interior Cover Props ───────────────────────────────────────
      if (fl.props) {
        fl.props.forEach((prop) => {
          const [px, py, pz] = prop.pos;
          const [pw, ph, pd] = prop.size;
          const propMat = getMat(prop.color || '#8c6b45', 0.8, 0.1);

          const propGeom = new THREE.BoxGeometry(pw, ph, pd);
          const propMesh = new THREE.Mesh(propGeom, propMat);
          propMesh.position.set(px, flY + py + ph / 2, pz);
          propMesh.castShadow = true;
          propMesh.receiveShadow = true;
          buildingGroup.add(propMesh);

          colliders.push({
            minX: bx + px - pw / 2,
            maxX: bx + px + pw / 2,
            minY: by + flY + py,
            maxY: by + flY + py + ph,
            minZ: bz + pz - pd / 2,
            maxZ: bz + pz + pd / 2,
            isWalkable: ph <= 0.9, // Can step or jump onto low crates/tables
          });
        });
      }

      // ── G. Interior Lights ────────────────────────────────────────────
      if (fl.lights) {
        fl.lights.forEach((l) => {
          const [lx, ly, lz] = l.pos;
          const pLight = new THREE.PointLight(l.color, l.intensity || 1.2, l.range || 14, 1.8);
          pLight.position.set(bx + lx, by + flY + ly, bz + lz);
          lightsGroup.add(pLight);

          // Small ceiling lamp fixture mesh
          const fixture = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.2, 0.1, 8),
            new THREE.MeshBasicMaterial({ color: 0xfff0cc })
          );
          fixture.position.set(lx, flY + ly + 0.05, lz);
          buildingGroup.add(fixture);
        });
      }
    });

    // ── H. Flat Rooftop & Parapets ─────────────────────────────────────────
    if (bldg.roof && bldg.roof.type === 'flat_parapet') {
      const topFloor = bldg.floors[bldg.floors.length - 1];
      const roofY = topFloor.floorY + topFloor.height + slabThickness;
      const parapetH = bldg.roof.parapetHeight ?? 0.9;
      const parapetThick = bldg.roof.parapetThickness ?? 0.25;

      // 4 perimeter parapet walls
      const parapets = [
        { x: 0, z: -bd / 2 + parapetThick / 2, w: bw, d: parapetThick },
        { x: 0, z:  bd / 2 - parapetThick / 2, w: bw, d: parapetThick },
        { x: -bw / 2 + parapetThick / 2, z: 0, w: parapetThick, d: bd },
        { x:  bw / 2 - parapetThick / 2, z: 0, w: parapetThick, d: bd },
      ];

      parapets.forEach((p) => {
        const pGeom = new THREE.BoxGeometry(p.w, parapetH, p.d);
        pGeom.translate(p.x, roofY + parapetH / 2, p.z);
        trimGeoms.push(pGeom);

        colliders.push({
          minX: bx + p.x - p.w / 2,
          maxX: bx + p.x + p.w / 2,
          minY: by + roofY,
          maxY: by + roofY + parapetH,
          minZ: bz + p.z - p.d / 2,
          maxZ: bz + p.z + p.d / 2,
          isWalkable: false,
        });
      });
    }

    // Merge accumulated geometries into single draw call meshes
    if (slabGeoms.length > 0) {
      const mergedSlabs = mergeGeometries(slabGeoms);
      const mesh = new THREE.Mesh(mergedSlabs, floorMat);
      mesh.receiveShadow = true;
      buildingGroup.add(mesh);
    }

    if (wallGeoms.length > 0) {
      const mergedWalls = mergeGeometries(wallGeoms);
      const mesh = new THREE.Mesh(mergedWalls, wallMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      buildingGroup.add(mesh);
    }

    if (trimGeoms.length > 0) {
      const mergedTrim = mergeGeometries(trimGeoms);
      const mesh = new THREE.Mesh(mergedTrim, trimMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      buildingGroup.add(mesh);
    }

    if (glassGeoms.length > 0) {
      const mergedGlass = mergeGeometries(glassGeoms);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x88bbdd,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.35,
      });
      const glassMesh = new THREE.Mesh(mergedGlass, glassMat);
      glassMesh.layers.set(FX_NON_RAYCAST_LAYER);
      glassMesh.userData.ignoreRaycast = true;
      buildingGroup.add(glassMesh);
    }

    mapGroup.add(buildingGroup);
  }

  /**
   * Expands natural features: trees, rocks, mounds.
   */
  private expandPerchedBird(
    bird: NonNullable<BlueprintMapData['perchedBirds']>[number],
    mapGroup: THREE.Group,
    getMat: (hex: string, r?: number, m?: number) => THREE.MeshStandardMaterial
  ) {
    const [x, y, z] = bird.pos;
    const scale = Math.max(0.55, Math.min(1.25, bird.scale ?? 1));
    const group = new THREE.Group();
    group.name = `perched-bird-${bird.id}`;
    group.position.set(x, y, z);
    group.rotation.y = ((bird.id.split('').reduce((n, ch) => n + ch.charCodeAt(0), 0) % 360) * Math.PI) / 180;
    group.userData.isPerchedBird = true;

    const bodyMat = getMat(bird.color || '#5d6d72', 0.9, 0.02);
    const wingMat = getMat('#39474b', 0.9, 0.02);
    const beakMat = getMat('#d9a34e', 0.8, 0.0);
    const footMat = getMat('#b97b45', 0.9, 0.0);

    const addBirdPart = (geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], partName: string, partScale?: [number, number, number]) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `bird-${bird.id}-${partName}`;
      mesh.position.set(position[0] * scale, position[1] * scale, position[2] * scale);
      if (partScale) mesh.scale.set(partScale[0] * scale, partScale[1] * scale, partScale[2] * scale);
      mesh.castShadow = true;
      mesh.userData.isBird = true;
      // Leave on the normal raycast layer so shots can hit the perched bird.
      group.add(mesh);
    };

    addBirdPart(new THREE.SphereGeometry(0.19, 6, 4), bodyMat, [0, 0.22, 0], 'body', [1.0, 0.78, 1.35]);
    addBirdPart(new THREE.SphereGeometry(0.105, 6, 4), bodyMat, [0, 0.31, 0.20], 'head');
    addBirdPart(new THREE.ConeGeometry(0.055, 0.16, 4), beakMat, [0, 0.29, 0.32], 'beak', [1, 0.85, 1]);
    addBirdPart(new THREE.DodecahedronGeometry(0.15, 0), wingMat, [-0.15, 0.25, -0.01], 'left-wing', [0.55, 0.28, 1.1]);
    addBirdPart(new THREE.DodecahedronGeometry(0.15, 0), wingMat, [0.15, 0.25, -0.01], 'right-wing', [0.55, 0.28, 1.1]);
    addBirdPart(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 4), footMat, [-0.06, 0.06, 0.04], 'left-foot');
    addBirdPart(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 4), footMat, [0.06, 0.06, 0.04], 'right-foot');
    mapGroup.add(group);
  }

  private expandNature(
    nature: NonNullable<BlueprintMapData['nature']>,
    colliders: BoxCollider[],
    mapGroup: THREE.Group,
    getMat: (hex: string, r?: number, m?: number) => THREE.MeshStandardMaterial
  ) {
    const trunkMat = getMat('#3e2e20', 0.9, 0.05);
    const palmFoliageMat = getMat('#657a3e', 0.85, 0.05);
    const rockMat = getMat('#a89578', 0.95, 0.05);
    const moundMat = getMat('#c4ab82', 0.9, 0.05);

    const trunkGeoms: THREE.BufferGeometry[] = [];
    const canopyGeoms: THREE.BufferGeometry[] = [];
    const rockGeoms: THREE.BufferGeometry[] = [];
    const moundGeoms: THREE.BufferGeometry[] = [];

    // 1. Trees (Trunk collider only, canopy on Layer 2)
    if (nature.trees) {
      nature.trees.forEach((t) => {
        const [tx, ty, tz] = t.pos;
        const scale = t.scale || 1.0;
        const trunkH = 5.5 * scale;
        const trunkR = 0.35 * scale;

        // Trunk geometry (Layer 0, bullets hit trunk)
        const trunkGeom = new THREE.CylinderGeometry(trunkR * 0.85, trunkR, trunkH, 8);
        trunkGeom.translate(tx, ty + trunkH / 2, tz);
        trunkGeoms.push(trunkGeom);

        // Trunk collider
        colliders.push({
          minX: tx - trunkR,
          maxX: tx + trunkR,
          minY: ty,
          maxY: ty + trunkH,
          minZ: tz - trunkR,
          maxZ: tz + trunkR,
          isWalkable: false,
        });

        // Canopy on FX layer: neighborhood trees use simple faceted conifer tiers;
        // legacy arenas keep their original low-poly palm fronds.
        if (t.style === 'conifer') {
          const tiers = [
            { radius: 1.85, height: 3.0, y: 3.5 },
            { radius: 1.45, height: 2.6, y: 4.45 },
            { radius: 1.05, height: 2.0, y: 5.25 },
          ];
          for (const tier of tiers) {
            const crownGeom = new THREE.ConeGeometry(tier.radius * scale, tier.height * scale, 6);
            crownGeom.translate(tx, ty + tier.y * scale, tz);
            canopyGeoms.push(crownGeom);
          }
        } else {
          for (let f = 0; f < 8; f++) {
            const frondAngle = (f / 8) * Math.PI * 2;
            const frondGeom = new THREE.ConeGeometry(1.2 * scale, 3.8 * scale, 4);
            frondGeom.rotateZ(Math.PI * 0.38);
            frondGeom.rotateY(frondAngle);
            frondGeom.translate(
              tx + Math.cos(frondAngle) * 1.5 * scale,
              ty + trunkH - 0.4 * scale,
              tz + Math.sin(frondAngle) * 1.5 * scale
            );
            canopyGeoms.push(frondGeom);
          }
        }
      });
    }

    // 2. Sandstone Boulders
    if (nature.rocks) {
      nature.rocks.forEach((rk) => {
        const [rx, ry, rz] = rk.pos;
        const [rw, rh, rd] = rk.size;

        const rockGeom = new THREE.DodecahedronGeometry(rw / 2, 1);
        rockGeom.scale(1.0, rh / rw, rd / rw);
        rockGeom.translate(rx, ry + rh / 2, rz);
        rockGeoms.push(rockGeom);

        colliders.push({
          minX: rx - rw / 2,
          maxX: rx + rw / 2,
          minY: ry,
          maxY: ry + rh,
          minZ: rz - rd / 2,
          maxZ: rz + rd / 2,
          isWalkable: rh <= 0.85,
        });
      });
    }

    // 3. Tactical Earthen Mounds (Ramped hull-down cover)
    if (nature.mounds) {
      nature.mounds.forEach((m) => {
        const [mx, my, mz] = m.pos;
        const [mw, mh, md] = m.size;

        const moundGeom = new THREE.CylinderGeometry(mw * 0.4, mw * 0.5, mh, 12);
        moundGeom.scale(1.0, 1.0, md / mw);
        moundGeom.translate(mx, my + mh / 2, mz);
        moundGeoms.push(moundGeom);

        colliders.push({
          minX: mx - mw / 2,
          maxX: mx + mw / 2,
          minY: my,
          maxY: my + mh,
          minZ: mz - md / 2,
          maxZ: mz + md / 2,
          isWalkable: true, // Walkable inclined mound
        });
      });
    }

    // Merge nature meshes
    if (trunkGeoms.length > 0) {
      const mergedTrunks = mergeGeometries(trunkGeoms);
      const mesh = new THREE.Mesh(mergedTrunks, trunkMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mapGroup.add(mesh);
    }

    if (canopyGeoms.length > 0) {
      const mergedCanopies = mergeGeometries(canopyGeoms);
      const mesh = new THREE.Mesh(mergedCanopies, palmFoliageMat);
      mesh.castShadow = true;
      mesh.layers.set(FX_NON_RAYCAST_LAYER);
      mesh.userData.ignoreRaycast = true;
      mapGroup.add(mesh);
    }

    if (rockGeoms.length > 0) {
      const mergedRocks = mergeGeometries(rockGeoms);
      const mesh = new THREE.Mesh(mergedRocks, rockMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mapGroup.add(mesh);
    }

    if (moundGeoms.length > 0) {
      const mergedMounds = mergeGeometries(moundGeoms);
      const mesh = new THREE.Mesh(mergedMounds, moundMat);
      mesh.receiveShadow = true;
      mapGroup.add(mesh);
    }
  }
}
