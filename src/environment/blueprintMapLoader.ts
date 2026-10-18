// src/environment/blueprintMapLoader.ts
// Loads and instantiates blueprint maps (Foundry Yard, Cul-de-Sac, Dustline Village, Overpass)
// into Three.js geometry, PBR materials, tactical sun/sky/fog lighting, and collision bounds.

import * as THREE from 'three';
import { TargetManager } from './targets';
import type { BoxCollider, MapBounds } from '../player/firstPersonControls';

export type MapId = 'range' | 'foundry' | 'culdesac' | 'dustline' | 'overpass';

export interface BlueprintBox {
  id: string;
  zone?: string;
  kind?: string;
  center: [number, number, number];
  size: [number, number, number];
  color: string;
}

export interface BlueprintMapData {
  meta: {
    name: string;
    mode?: string;
    theme?: string;
    size?: [number, number];
  };
  boxes?: BlueprintBox[];
  lighting?: {
    sun?: {
      from?: string;
      color?: string;
      intensity?: number | string;
      elevation_deg?: number;
    };
    hemisphere?: { sky: string; ground: string; intensity: number };
    sky?: {
      hemisphere?: { sky: string; ground: string; intensity: number };
      fog?: { color: string; density: number };
    };
    fog?: {
      type?: string;
      color: string;
      density: number;
    };
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
}

export interface LoadedMapResult {
  name: string;
  theme?: string;
  spawn: { x: number; y: number; z: number; facingYaw: number };
  bounds: MapBounds;
  colliders: BoxCollider[];
}

export const MAP_INFO: Record<MapId, { name: string; file?: string }> = {
  range: { name: 'Tactical Shooting Range' },
  foundry: { name: 'Foundry Yard', file: '/maps/foundry_yard.json' },
  culdesac: { name: 'Cul-de-Sac', file: '/maps/Cul-de-Sac.json' },
  dustline: { name: 'Dustline Village', file: '/maps/Dustline Village.json' },
  overpass: { name: 'Overpass Arena', file: '/maps/Overpass.json' },
};

export class BlueprintMapLoader {
  private scene: THREE.Scene;
  private currentMapGroup: THREE.Group | null = null;
  private currentLightsGroup: THREE.Group | null = null;
  public currentMapId: MapId = 'range';
  public isLoading: boolean = false;

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

    // Default shooting range background and fog
    this.scene.fog = new THREE.FogExp2(0x07090e, 0.01);
    this.scene.background = new THREE.Color(0x07090e);
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
      };
    }

    const info = MAP_INFO[mapId];
    if (!info.file) {
      return {
        name: info.name,
        spawn: { x: 0, y: 1.7, z: 0, facingYaw: 0 },
        bounds: { minX: -25, maxX: 25, minZ: -25, maxZ: 25 },
        colliders: [],
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

    // 1. Atmosphere & Sun Lighting
    const hemiConf = data.lighting?.hemisphere || data.lighting?.sky?.hemisphere || {
      sky: '#90b4e2',
      ground: '#4a4238',
      intensity: 0.75,
    };

    const hemiLight = new THREE.HemisphereLight(
      hemiConf.sky,
      hemiConf.ground,
      hemiConf.intensity
    );
    lightsGroup.add(hemiLight);

    // Apply Fog and Sky Background to match map mood
    const fogConf = data.lighting?.fog || (data.lighting?.sky?.fog ? {
      color: data.lighting.sky.fog.color,
      density: data.lighting.sky.fog.density,
    } : null);

    if (fogConf) {
      this.scene.fog = new THREE.FogExp2(fogConf.color, fogConf.density);
      this.scene.background = new THREE.Color(fogConf.color);
    } else {
      this.scene.fog = new THREE.FogExp2(hemiConf.sky, 0.007);
      this.scene.background = new THREE.Color(hemiConf.sky);
    }

    // Directional Sun Light
    const sunColor = data.lighting?.sun?.color || '#fffaed';
    let sunIntensity = 1.2;
    if (typeof data.lighting?.sun?.intensity === 'number') {
      sunIntensity = data.lighting.sun.intensity;
    } else if (typeof data.lighting?.sun?.intensity === 'string') {
      sunIntensity = parseFloat(data.lighting.sun.intensity) || 1.2;
    }

    const elevDeg = data.lighting?.sun?.elevation_deg || 35;
    const elevRad = (elevDeg * Math.PI) / 180;
    const sunRadius = 85;

    const sunLight = new THREE.DirectionalLight(sunColor, sunIntensity);
    // Sun comes from west (-X)
    sunLight.position.set(-sunRadius * Math.cos(elevRad), sunRadius * Math.sin(elevRad), 0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1.0;
    sunLight.shadow.camera.far = 200;

    const halfMapSpan = data.meta.size ? Math.max(data.meta.size[0], data.meta.size[1]) * 0.75 : 45;
    sunLight.shadow.camera.left = -halfMapSpan;
    sunLight.shadow.camera.right = halfMapSpan;
    sunLight.shadow.camera.top = halfMapSpan;
    sunLight.shadow.camera.bottom = -halfMapSpan;
    sunLight.shadow.bias = -0.0003;
    lightsGroup.add(sunLight);

    // Tactical Point Lights (street lights, lanterns, sodium lamps)
    if (data.lighting?.points) {
      data.lighting.points.forEach((p) => {
        const pLight = new THREE.PointLight(
          p.color,
          p.intensity || 1.0,
          p.range || 16,
          1.6
        );
        pLight.position.set(p.x, p.y, p.z);
        lightsGroup.add(pLight);
      });
    }

    // 2. Map Ground Floor Plane
    const floorMat = new THREE.MeshStandardMaterial({
      color: hemiConf.ground || '#3a3f47',
      roughness: 0.9,
      metalness: 0.05,
    });
    const floorSpan = data.meta.size ? Math.max(...data.meta.size) * 2.2 : 140;
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(floorSpan, floorSpan),
      floorMat
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    mapGroup.add(floorMesh);

    // 3. Map Solid Boxes & Colliders
    const colliders: BoxCollider[] = [];
    const materialCache = new Map<string, THREE.MeshStandardMaterial>();

    if (data.boxes) {
      data.boxes.forEach((box) => {
        const hex = box.color || '#718096';
        let mat = materialCache.get(hex);
        if (!mat) {
          const isMetal = box.kind === 'container' || box.kind === 'metal' || box.kind === 'cont';
          mat = new THREE.MeshStandardMaterial({
            color: hex,
            roughness: isMetal ? 0.35 : 0.8,
            metalness: isMetal ? 0.85 : 0.15,
          });
          materialCache.set(hex, mat);
        }

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

        if (!isRoof) {
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

    this.scene.add(mapGroup);
    this.scene.add(lightsGroup);
    this.currentMapGroup = mapGroup;
    this.currentLightsGroup = lightsGroup;

    // ── Debug: Collider Wireframes (?debug=1&colliders=1) ─────────────────
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1' && params.get('colliders') === '1') {
      const solidMat  = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true, opacity: 0.6, transparent: true });
      const walkMat   = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, opacity: 0.6, transparent: true });
      colliders.forEach(c => {
        const w = c.maxX - c.minX;
        const h = c.maxY - c.minY;
        const d = c.maxZ - c.minZ;
        const geom = new THREE.BoxGeometry(w, h, d);
        const mat = c.isWalkable ? walkMat : solidMat;
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(c.minX + w / 2, c.minY + h / 2, c.minZ + d / 2);
        mapGroup.add(mesh);
      });
      // Floor reference plane (green)
      const floorRef = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshBasicMaterial({ color: 0x00ff44, wireframe: true, opacity: 0.15, transparent: true })
      );
      floorRef.rotation.x = -Math.PI / 2;
      mapGroup.add(floorRef);
    }

    // 4. Calculate Optimal Tactical Spawn Position & Map Bounds
    const halfW = data.meta.size ? data.meta.size[0] / 2 : 30;
    const halfD = data.meta.size ? data.meta.size[1] / 2 : 30;
    const bounds: MapBounds = {
      minX: -halfW,
      maxX: halfW,
      minZ: -halfD,
      maxZ: halfD,
    };

    let spawnX = 0;
    let spawnZ = -halfD * 0.55;
    const spawnYaw = Math.PI; // Face North (+Z) towards map center

    if (mapId === 'culdesac') {
      spawnX = -7.0; // West side of street lane with clear sightline past the bus
      spawnZ = -8.0;
    } else if (mapId === 'dustline') {
      spawnX = 0;
      spawnZ = -15.0; // South camp entrance looking towards bazaar & well square
    } else if (mapId === 'overpass') {
      spawnX = 0;
      spawnZ = -16.0; // South lot looking toward elevated overpass structure
    } else if (mapId === 'foundry') {
      spawnX = 0;
      spawnZ = -18.0; // South bay corridor looking into Crane Plaza
    } else if (data.spawns?.teamA?.points && data.spawns.teamA.points.length > 0) {
      const pt = data.spawns.teamA.points[Math.min(1, data.spawns.teamA.points.length - 1)];
      spawnX = pt[0];
      spawnZ = pt[1];
    }

    // 5. Populate Silhouette Targets in Strategic Skirmish Positions
    if (targetManager) {
      targetManager.setRangeTargetsVisible(false);
      targetManager.clearDynamicTargets();

      if (data.spawns?.teamB?.points) {
        data.spawns.teamB.points.forEach(([tx, tz]) => {
          targetManager.addDynamicTarget(tx, 0, tz, true);
        });
      }

      // Add central skirmish targets
      if (mapId === 'culdesac') {
        targetManager.addDynamicTarget(-6, 0, 5, true);
        targetManager.addDynamicTarget(6, 0, 6, true);
        targetManager.addDynamicTarget(0, 0, 11, true);
      } else if (mapId === 'dustline') {
        targetManager.addDynamicTarget(0, 0, 0, true);
        targetManager.addDynamicTarget(-12, 0, 8, true);
        targetManager.addDynamicTarget(12, 0, 8, true);
      } else if (mapId === 'overpass') {
        targetManager.addDynamicTarget(-8, 0, -2, true);
        targetManager.addDynamicTarget(8, 0, 2, true);
        targetManager.addDynamicTarget(0, 4.5, 0, true); // on the deck!
      } else if (mapId === 'foundry') {
        targetManager.addDynamicTarget(0, 0, 0, true);
        targetManager.addDynamicTarget(-14, 0, 5, true);
        targetManager.addDynamicTarget(14, 0, 5, true);
      }
    }

    this.isLoading = false;
    return {
      name: data.meta.name,
      theme: data.meta.theme,
      spawn: { x: spawnX, y: 1.7, z: spawnZ, facingYaw: spawnYaw },
      bounds,
      colliders,
    };
  }
}
