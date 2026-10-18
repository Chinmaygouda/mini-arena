// src/environment/blueprintMapLoader.ts
// Loads and instantiates blueprint maps (Foundry Yard, Cul-de-Sac, Dustline Village, Overpass)
// into Three.js geometry, PBR materials, and tactical lighting.

import * as THREE from 'three';
import { TargetManager } from './targets';

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
      color?: string;
      intensity?: number | string;
      elevation_deg?: number;
    };
    sky?: {
      hemisphere?: { sky: string; ground: string; intensity: number };
      fog?: { color: string; density: number };
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
  spawns?: Array<{ id: string; team: string; pos: [number, number, number] }>;
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
  }

  public async loadMap(
    mapId: MapId,
    targetManager?: TargetManager
  ): Promise<string> {
    this.clearCurrentMap();
    this.currentMapId = mapId;

    if (mapId === 'range') {
      return 'Tactical Shooting Range';
    }

    const info = MAP_INFO[mapId];
    if (!info.file) {
      return info.name;
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
    const skyConf = data.lighting?.sky?.hemisphere || {
      sky: '#90b4e2',
      ground: '#4a4238',
      intensity: 0.75,
    };
    const hemiLight = new THREE.HemisphereLight(
      skyConf.sky,
      skyConf.ground,
      skyConf.intensity
    );
    lightsGroup.add(hemiLight);

    const sunColor = data.lighting?.sun?.color || '#fffaed';
    const sunLight = new THREE.DirectionalLight(sunColor, 1.4);
    sunLight.position.set(25, 45, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 160;
    sunLight.shadow.camera.left = -40;
    sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 40;
    sunLight.shadow.camera.bottom = -40;
    sunLight.shadow.bias = -0.0004;
    lightsGroup.add(sunLight);

    // Point lights from blueprint
    if (data.lighting?.points) {
      data.lighting.points.slice(0, 10).forEach((p) => {
        const pLight = new THREE.PointLight(
          p.color,
          p.intensity || 1.0,
          p.range || 16
        );
        pLight.position.set(p.x, p.y, p.z);
        lightsGroup.add(pLight);
      });
    }

    // 2. Map Ground Floor Plane
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x3a3f47,
      roughness: 0.85,
      metalness: 0.1,
    });
    const floorSize = data.meta.size ? Math.max(...data.meta.size) * 2 : 120;
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(floorSize, floorSize),
      floorMat
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    mapGroup.add(floorMesh);

    // 3. Map Solid Boxes (Walls, cover, stairs, corridors)
    const materialCache = new Map<string, THREE.MeshStandardMaterial>();

    if (data.boxes) {
      data.boxes.forEach((box) => {
        const hex = box.color || '#718096';
        let mat = materialCache.get(hex);
        if (!mat) {
          const isMetal = box.kind === 'container' || box.kind === 'metal';
          mat = new THREE.MeshStandardMaterial({
            color: hex,
            roughness: isMetal ? 0.35 : 0.8,
            metalness: isMetal ? 0.85 : 0.15,
          });
          materialCache.set(hex, mat);
        }

        const [w, h, d] = box.size;
        const geom = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(box.center[0], box.center[1], box.center[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mapGroup.add(mesh);
      });
    }

    this.scene.add(mapGroup);
    this.scene.add(lightsGroup);
    this.currentMapGroup = mapGroup;
    this.currentLightsGroup = lightsGroup;

    // 4. Tactical Targets in map arena if targetManager supplied
    if (targetManager && data.spawns && data.spawns.length > 0) {
      // Reposition targets or add tactical poppers in map bays
      data.spawns.forEach((sp) => {
        targetManager.addDynamicTarget(
          sp.pos[0],
          sp.pos[1],
          sp.pos[2],
          sp.team === 'B'
        );
      });
    }

    return data.meta.name;
  }
}
