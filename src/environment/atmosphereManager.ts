// src/environment/atmosphereManager.ts
// Open-World Atmospheric Immersion: Procedural Sky Dome, Time-of-Day Presets,
// Sun/Moon Discs, Drifting Instanced Clouds, Distant Mountain Ridgelines,
// Instanced Scared Bird Flocks with Gunshot Scattering, Wind Grass, and Ambient Birdsong.

import * as THREE from 'three';
import { FX_NON_RAYCAST_LAYER } from './targets';

export type TimeOfDayPreset = 'noon' | 'golden' | 'overcast' | 'dusk' | 'night';
export type AtmosphereTheme = 'desert' | 'industrial' | 'suburban' | 'arid' | 'urban';

interface BirdInstance {
  baseRadius: number;
  height: number;
  speed: number;
  angle: number;
  phase: number;
  flapFreq: number;
  isScattering: boolean;
  scatterTimer: number;
  scatterDir: THREE.Vector3;
  scatterSpeed: number;
}

interface CloudInstance {
  pos: THREE.Vector3;
  scale: THREE.Vector3;
  speed: number;
}

export interface TimePresetConfig {
  name: TimeOfDayPreset;
  sunElevation: number; // degrees
  sunAzimuth: number;   // degrees
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  zenithColor: string;
  horizonColor: string;
  groundColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientBirdVolume: number;
  isNight: boolean;
}

export const TIME_PRESETS: Record<TimeOfDayPreset, TimePresetConfig> = {
  noon: {
    name: 'noon',
    sunElevation: 68,
    sunAzimuth: 145,
    sunColor: '#fffef5',
    sunIntensity: 1.5,
    hemiSky: '#8fc3ff',
    hemiGround: '#544638',
    hemiIntensity: 0.8,
    zenithColor: '#2b72c4',
    horizonColor: '#bce0fd',
    groundColor: '#4a3f30',
    fogColor: '#bce0fd',
    fogNear: 70,
    fogFar: 340,
    ambientBirdVolume: 0.25,
    isNight: false,
  },
  golden: {
    name: 'golden',
    sunElevation: 22,
    sunAzimuth: 240,
    sunColor: '#ffad5c',
    sunIntensity: 1.8,
    hemiSky: '#ffbe8f',
    hemiGround: '#52341c',
    hemiIntensity: 0.75,
    zenithColor: '#3c6e9e',
    horizonColor: '#f7cea0',
    groundColor: '#483420',
    fogColor: '#f0c89a',
    fogNear: 55,
    fogFar: 300,
    ambientBirdVolume: 0.3,
    isNight: false,
  },
  overcast: {
    name: 'overcast',
    sunElevation: 48,
    sunAzimuth: 180,
    sunColor: '#d6e0ea',
    sunIntensity: 0.95,
    hemiSky: '#a8b8c8',
    hemiGround: '#383e46',
    hemiIntensity: 0.85,
    zenithColor: '#4c5a6c',
    horizonColor: '#94a4b4',
    groundColor: '#303840',
    fogColor: '#94a4b4',
    fogNear: 40,
    fogFar: 230,
    ambientBirdVolume: 0.2,
    isNight: false,
  },
  dusk: {
    name: 'dusk',
    sunElevation: 7,
    sunAzimuth: 265,
    sunColor: '#ff4d2e',
    sunIntensity: 1.35,
    hemiSky: '#6e4575',
    hemiGround: '#2a1a24',
    hemiIntensity: 0.6,
    zenithColor: '#222544',
    horizonColor: '#cf635c',
    groundColor: '#20161e',
    fogColor: '#bf605c',
    fogNear: 45,
    fogFar: 250,
    ambientBirdVolume: 0.22,
    isNight: false,
  },
  night: {
    name: 'night',
    sunElevation: 45,
    sunAzimuth: 65,
    sunColor: '#85a8ff',
    sunIntensity: 0.45,
    hemiSky: '#121a2c',
    hemiGround: '#080c14',
    hemiIntensity: 0.3,
    zenithColor: '#050a14',
    horizonColor: '#142034',
    groundColor: '#080c10',
    fogColor: '#101826',
    fogNear: 35,
    fogFar: 200,
    ambientBirdVolume: 0.1,
    isNight: true,
  },
};

export class AtmosphereManager {
  private scene: THREE.Scene;
  private currentGroup: THREE.Group | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;

  private birdMesh: THREE.InstancedMesh | null = null;
  private birdData: BirdInstance[] = [];
  private dummy = new THREE.Object3D();

  private cloudMesh: THREE.InstancedMesh | null = null;
  private cloudData: CloudInstance[] = [];

  private grassMesh: THREE.InstancedMesh | null = null;
  private grassCount = 1200;

  private time = 0;
  public currentPreset: TimeOfDayPreset = 'golden';
  private audioElement: HTMLAudioElement | null = null;
  public isMuted = false;
  private targetAudioVolume = 0.25;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupAudio();
  }

  private setupAudio() {
    try {
      this.audioElement = new Audio('/audio/birds/birdsong_ambient_01.ogg');
      this.audioElement.loop = true;
      this.audioElement.volume = 0.25;
      // Start audio playback on first user gesture
      const startAudio = () => {
        if (this.audioElement && !this.isMuted) {
          this.audioElement.play().catch(() => {});
        }
        window.removeEventListener('click', startAudio);
        window.removeEventListener('keydown', startAudio);
      };
      window.addEventListener('click', startAudio);
      window.addEventListener('keydown', startAudio);
    } catch {
      // Audio not supported in headless environments
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.audioElement) {
      if (this.isMuted) {
        this.audioElement.pause();
      } else {
        this.audioElement.play().catch(() => {});
      }
    }
    return this.isMuted;
  }

  public clear() {
    if (this.currentGroup) {
      this.scene.remove(this.currentGroup);
      this.currentGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.currentGroup = null;
    }
    if (this.sunLight) {
      this.scene.remove(this.sunLight);
      this.sunLight = null;
    }
    if (this.hemiLight) {
      this.scene.remove(this.hemiLight);
      this.hemiLight = null;
    }
    this.birdMesh = null;
    this.birdData = [];
    this.cloudMesh = null;
    this.cloudData = [];
    this.grassMesh = null;
  }

  public currentMapId: string = 'dustline';

  public setQuality(preset: 'low' | 'medium' | 'high') {
    if (preset === 'low') {
      this.grassCount = 350;
    } else if (preset === 'medium') {
      this.grassCount = 1000;
    } else {
      this.grassCount = 2000;
    }
    if (this.currentGroup) {
      this.setupAtmosphere(this.currentMapId, this.currentPreset);
    }
  }

  public setupAtmosphere(mapId: string, forcedPreset?: TimeOfDayPreset) {
    this.currentMapId = mapId;
    this.clear();

    const group = new THREE.Group();
    group.name = `atmosphere-${mapId}`;
    this.currentGroup = group;

    // Check URL param ?time=noon|golden|overcast|dusk|night
    const params = new URLSearchParams(window.location.search);
    const urlPreset = params.get('time') as TimeOfDayPreset | null;

    let presetKey: TimeOfDayPreset = 'golden';
    if (forcedPreset && TIME_PRESETS[forcedPreset]) {
      presetKey = forcedPreset;
    } else if (urlPreset && TIME_PRESETS[urlPreset]) {
      presetKey = urlPreset;
    } else if (mapId === 'dustline') {
      presetKey = 'golden';
    } else if (mapId === 'foundry') {
      presetKey = 'overcast';
    } else if (mapId === 'culdesac') {
      presetKey = 'dusk';
    } else if (mapId === 'overpass') {
      presetKey = 'noon';
    } else if (mapId === 'neighborhood') {
      presetKey = 'golden';
    } else if (mapId === 'warehouse') {
      presetKey = 'overcast';
    } else {
      presetKey = 'noon';
    }

    this.currentPreset = presetKey;
    const cfg = TIME_PRESETS[presetKey];

    const resolvedTheme: AtmosphereTheme =
      mapId === 'range' ? 'desert' :
      mapId === 'foundry' ? 'industrial' :
      mapId === 'culdesac' ? 'suburban' :
      mapId === 'dustline' ? 'arid' :
      mapId === 'overpass' ? 'urban' :
      mapId === 'neighborhood' ? 'suburban' :
      mapId === 'warehouse' ? 'industrial' : 'arid';

    // 1. Lighting Rig (Single shadow-casting directional light + ambient hemisphere)
    this.setupLighting(cfg);

    // 2. Panoramic Procedural Sky Dome
    this.createSkyDome(group, cfg);

    // 3. Sun/Moon Celestial Disc
    this.createCelestialDisc(group, cfg);

    // 4. Instanced Drifting Cumulus Clouds
    if (!cfg.isNight) {
      this.createDriftingClouds(group, cfg);
    } else {
      this.createStarField(group);
    }

    // 5. Outdoor scenery is omitted from the warehouse blockout. The roof is intentionally
    // not part of stage 1, and the view beyond the perimeter remains a neutral sky.
    if (mapId !== 'warehouse') {
      this.createDistantHorizon(group, resolvedTheme, cfg);
      this.createPerimeterFoliage(group, resolvedTheme);
      this.createBirdFlock(group, resolvedTheme, cfg);
    }

    // 6. Keep warehouse interiors free of environmental grass.
    if (mapId === 'neighborhood') this.createNeighborhoodParkGrass(group);
    else if (mapId !== 'warehouse') this.createWindGrass(group, resolvedTheme);

    // 9. Scene Fog
    this.scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);
    this.scene.background = new THREE.Color(cfg.fogColor);

    this.targetAudioVolume = mapId === 'warehouse' ? 0 : cfg.ambientBirdVolume;
    if (this.audioElement && !this.isMuted) {
      this.audioElement.volume = this.targetAudioVolume;
    }

    this.scene.add(group);
  }

  private setupLighting(cfg: TimePresetConfig) {
    this.hemiLight = new THREE.HemisphereLight(
      cfg.hemiSky,
      cfg.hemiGround,
      cfg.hemiIntensity
    );
    this.scene.add(this.hemiLight);

    const elevRad = (cfg.sunElevation * Math.PI) / 180;
    const azimRad = (cfg.sunAzimuth * Math.PI) / 180;
    const sunDist = 120;

    const sunX = Math.cos(elevRad) * Math.sin(azimRad) * sunDist;
    const sunY = Math.sin(elevRad) * sunDist;
    const sunZ = Math.cos(elevRad) * Math.cos(azimRad) * sunDist;

    this.sunLight = new THREE.DirectionalLight(cfg.sunColor, cfg.sunIntensity);
    this.sunLight.position.set(sunX, sunY, sunZ);
    this.sunLight.castShadow = true;

    // Quality-tuned shadow map
    const shadowRes = this.grassCount <= 400 ? 512 : (this.grassCount <= 1200 ? 1024 : 2048);
    this.sunLight.shadow.mapSize.width = shadowRes;
    this.sunLight.shadow.mapSize.height = shadowRes;
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 240;

    const halfSpan = 55;
    this.sunLight.shadow.camera.left = -halfSpan;
    this.sunLight.shadow.camera.right = halfSpan;
    this.sunLight.shadow.camera.top = halfSpan;
    this.sunLight.shadow.camera.bottom = -halfSpan;
    this.sunLight.shadow.bias = -0.0004;

    this.scene.add(this.sunLight);
  }

  private createSkyDome(parent: THREE.Group, cfg: TimePresetConfig) {
    const skyGeom = new THREE.SphereGeometry(320, 32, 16);
    skyGeom.scale(-1, 1, 1);

    const horizonColor = new THREE.Color(cfg.horizonColor);
    const zenithColor = new THREE.Color(cfg.zenithColor);
    const groundColor = new THREE.Color(cfg.groundColor);

    const pos = skyGeom.attributes.position;
    const colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 320;
      const c = new THREE.Color();
      if (y > 0) {
        c.lerpColors(horizonColor, zenithColor, Math.pow(Math.min(1, y * 1.6), 0.75));
      } else {
        c.lerpColors(horizonColor, groundColor, Math.min(1, -y * 2.2));
      }
      colors.push(c.r, c.g, c.b);
    }
    skyGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const skyMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      depthWrite: false,
      fog: false,
    });
    const skyMesh = new THREE.Mesh(skyGeom, skyMat);
    skyMesh.layers.set(FX_NON_RAYCAST_LAYER);
    skyMesh.userData.ignoreRaycast = true;
    parent.add(skyMesh);
  }

  private createCelestialDisc(parent: THREE.Group, cfg: TimePresetConfig) {
    const elevRad = (cfg.sunElevation * Math.PI) / 180;
    const azimRad = (cfg.sunAzimuth * Math.PI) / 180;
    const dist = 300;

    const discGeom = new THREE.CircleGeometry(cfg.isNight ? 9 : 14, 24);
    const discMat = new THREE.MeshBasicMaterial({
      color: cfg.isNight ? 0xe0eaff : (cfg.name === 'dusk' ? 0xff4422 : 0xfffae0),
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    const discMesh = new THREE.Mesh(discGeom, discMat);
    discMesh.position.set(
      Math.cos(elevRad) * Math.sin(azimRad) * dist,
      Math.sin(elevRad) * dist,
      Math.cos(elevRad) * Math.cos(azimRad) * dist
    );
    discMesh.lookAt(0, 0, 0);
    discMesh.layers.set(FX_NON_RAYCAST_LAYER);
    discMesh.userData.ignoreRaycast = true;
    parent.add(discMesh);
  }

  private createStarField(parent: THREE.Group) {
    const starCount = 350;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 290;
      const sinPhi = Math.sin(phi);
      // Upper hemisphere only
      positions[i * 3] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 15;
      positions[i * 3 + 2] = r * sinPhi * Math.sin(theta);
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, fog: false });
    const stars = new THREE.Points(geom, mat);
    stars.layers.set(FX_NON_RAYCAST_LAYER);
    stars.userData.ignoreRaycast = true;
    parent.add(stars);
  }

  private createDriftingClouds(parent: THREE.Group, cfg: TimePresetConfig) {
    const cloudCount = 18;
    // Low-poly merged puff geometry
    const cloudGeom = new THREE.DodecahedronGeometry(8, 1);
    const cloudColor = cfg.name === 'golden' ? 0xffdfc4 : (cfg.name === 'dusk' ? 0xd47568 : 0xffffff);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: cloudColor,
      transparent: true,
      opacity: cfg.name === 'overcast' ? 0.85 : 0.65,
      depthWrite: false,
      fog: false,
    });

    this.cloudMesh = new THREE.InstancedMesh(cloudGeom, cloudMat, cloudCount);
    this.cloudMesh.layers.set(FX_NON_RAYCAST_LAYER);
    this.cloudMesh.userData.ignoreRaycast = true;

    this.cloudData = [];
    for (let i = 0; i < cloudCount; i++) {
      const angle = (i / cloudCount) * Math.PI * 2;
      const dist = 80 + Math.random() * 120;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = 85 + Math.random() * 30;

      const scaleX = 2.5 + Math.random() * 2.5;
      const scaleY = 0.8 + Math.random() * 0.8;
      const scaleZ = 2.0 + Math.random() * 2.0;

      this.cloudData.push({
        pos: new THREE.Vector3(x, y, z),
        scale: new THREE.Vector3(scaleX, scaleY, scaleZ),
        speed: 1.5 + Math.random() * 1.5,
      });

      this.dummy.position.set(x, y, z);
      this.dummy.scale.set(scaleX, scaleY, scaleZ);
      this.dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.cloudMesh.instanceMatrix.needsUpdate = true;
    parent.add(this.cloudMesh);
  }

  private createDistantHorizon(parent: THREE.Group, _theme: AtmosphereTheme, cfg: TimePresetConfig) {
    const segments = 40;
    const radius = 245;
    const geom = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];

    const baseColor = new THREE.Color(cfg.groundColor);
    const peakColor = new THREE.Color(cfg.horizonColor).multiplyScalar(0.75);

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const heightNoise = Math.sin(angle * 4) * 18 + Math.cos(angle * 8) * 12 + Math.sin(angle * 14) * 6;
      const peakY = Math.max(15, 32 + heightNoise);

      // Bottom vertex
      vertices.push(x, -5, z);
      colors.push(baseColor.r, baseColor.g, baseColor.b);

      // Top vertex
      vertices.push(x * 0.96, peakY, z * 0.96);
      colors.push(peakColor.r, peakColor.g, peakColor.b);
    }

    const indices: number[] = [];
    for (let i = 0; i < segments; i++) {
      const bl = i * 2;
      const tl = i * 2 + 1;
      const br = (i + 1) * 2;
      const tr = (i + 1) * 2 + 1;
      indices.push(bl, tl, br);
      indices.push(br, tl, tr);
    }

    geom.setIndex(indices);
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });
    const ridgeMesh = new THREE.Mesh(geom, mat);
    ridgeMesh.layers.set(FX_NON_RAYCAST_LAYER);
    ridgeMesh.userData.ignoreRaycast = true;
    parent.add(ridgeMesh);
  }

  private createPerimeterFoliage(parent: THREE.Group, theme: AtmosphereTheme) {
    const foliageGroup = new THREE.Group();
    foliageGroup.name = 'perimeter-foliage';

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: theme === 'arid' || theme === 'desert' ? 0x7a8c4c : 0x2e5228,
      roughness: 0.85,
      flatShading: true,
    });

    const treePositions = [
      [-52, 0, -48], [52, 0, -48], [-48, 0, 48], [48, 0, 48],
      [-55, 0, 0], [55, 0, 0], [0, 0, -55], [0, 0, 55],
      [-38, 0, -52], [38, 0, -52], [-38, 0, 52], [38, 0, 52],
    ];

    treePositions.forEach(([tx, ty, tz]) => {
      const tree = new THREE.Group();
      tree.position.set(tx, ty, tz);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 5.0, 6), trunkMat);
      trunk.position.y = 2.5;
      trunk.castShadow = true;
      tree.add(trunk);

      // Multi-tier canopy
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 7), foliageMat);
      c1.position.y = 5.2;
      c1.castShadow = true;
      tree.add(c1);

      const c2 = new THREE.Mesh(new THREE.ConeGeometry(2.0, 2.8, 7), foliageMat);
      c2.position.y = 6.8;
      c2.castShadow = true;
      tree.add(c2);

      tree.scale.setScalar(0.9 + Math.random() * 0.35);
      foliageGroup.add(tree);
    });

    foliageGroup.traverse((child) => {
      child.layers.set(FX_NON_RAYCAST_LAYER);
      child.userData.ignoreRaycast = true;
    });

    parent.add(foliageGroup);
  }

  private createBirdFlock(parent: THREE.Group, _theme: AtmosphereTheme, cfg: TimePresetConfig) {
    const birdCount = cfg.isNight ? 18 : 36;
    const birdGeom = new THREE.BufferGeometry();
    const birdVertices = new Float32Array([
      // Left Wing
      0, 0, 0.28,
      -0.75, 0.14, -0.2,
      0, 0, -0.38,
      // Right Wing
      0, 0, 0.28,
      0, 0, -0.38,
      0.75, 0.14, -0.2
    ]);
    birdGeom.setAttribute('position', new THREE.BufferAttribute(birdVertices, 3));
    birdGeom.computeVertexNormals();

    const birdColor = cfg.isNight ? 0x222a36 : 0x1f242b;
    const birdMat = new THREE.MeshBasicMaterial({
      color: birdColor,
      side: THREE.DoubleSide,
      depthWrite: true,
      fog: false,
    });

    this.birdMesh = new THREE.InstancedMesh(birdGeom, birdMat, birdCount);
    this.birdMesh.layers.set(FX_NON_RAYCAST_LAYER);
    this.birdMesh.userData.ignoreRaycast = true;

    this.birdData = [];
    for (let i = 0; i < birdCount; i++) {
      this.birdData.push({
        baseRadius: 35 + (i % 6) * 7,
        height: 38 + (i % 5) * 4 + Math.random() * 4,
        speed: 0.38 + (i % 4) * 0.08,
        angle: (i / birdCount) * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
        flapFreq: 4.8 + Math.random() * 1.6,
        isScattering: false,
        scatterTimer: 0,
        scatterDir: new THREE.Vector3(),
        scatterSpeed: 0,
      });
    }

    parent.add(this.birdMesh);
  }

  private createWindGrass(parent: THREE.Group, theme: AtmosphereTheme) {
    const count = this.grassCount;
    // Cross-quad grass tuft
    const grassBladeGeom = new THREE.BufferGeometry();
    const verts = new Float32Array([
      // Quad 1
      -0.2, 0, 0,   0.2, 0, 0,   0.15, 0.65, 0,
      -0.2, 0, 0,   0.15, 0.65, 0,  -0.15, 0.65, 0,
      // Quad 2 (perpendicular)
      0, 0, -0.2,   0, 0, 0.2,   0, 0.65, 0.15,
      0, 0, -0.2,   0, 0.65, 0.15,  0, 0.65, -0.15,
    ]);
    grassBladeGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    grassBladeGeom.computeVertexNormals();

    const grassColor = theme === 'arid' || theme === 'desert' ? 0x9b9e66 : 0x486b36;
    const grassMat = new THREE.MeshLambertMaterial({
      color: grassColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });

    this.grassMesh = new THREE.InstancedMesh(grassBladeGeom, grassMat, count);
    this.grassMesh.layers.set(FX_NON_RAYCAST_LAYER);
    this.grassMesh.userData.ignoreRaycast = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      // Scatter in playable ground area outside dense building footprints
      const angle = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * 44;
      const gx = Math.cos(angle) * radius;
      const gz = Math.sin(angle) * radius;

      dummy.position.set(gx, 0, gz);
      dummy.scale.set(
        0.8 + Math.random() * 0.6,
        0.7 + Math.random() * 0.7,
        0.8 + Math.random() * 0.6
      );
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.updateMatrix();
      this.grassMesh.setMatrixAt(i, dummy.matrix);
    }
    this.grassMesh.instanceMatrix.needsUpdate = true;
    parent.add(this.grassMesh);
  }

  /**
   * Small, instanced grass clusters restricted to the central park lawn.
   * Unlike the generic arena scatter, this never populates building interiors or road lanes.
   */
  private createNeighborhoodParkGrass(parent: THREE.Group) {
    const count = Math.min(this.grassCount, 700);
    const grassGeom = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -0.16, 0, 0, 0.16, 0, 0, 0.12, 0.52, 0,
      -0.16, 0, 0, 0.12, 0.52, 0, -0.12, 0.52, 0,
      0, 0, -0.16, 0, 0, 0.16, 0, 0.52, 0.12,
      0, 0, -0.16, 0, 0.52, 0.12, 0, 0.52, -0.12,
    ]);
    grassGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    grassGeom.computeVertexNormals();
    const grassMat = new THREE.MeshLambertMaterial({
      color: 0x88a95b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    const mesh = new THREE.InstancedMesh(grassGeom, grassMat, count);
    mesh.name = 'neighborhood-park-grass';
    mesh.layers.set(FX_NON_RAYCAST_LAYER);
    mesh.userData.ignoreRaycast = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 8) {
      attempts++;
      const x = -10.1 + Math.random() * 20.2;
      const z = -10.1 + Math.random() * 20.2;
      // Leave the pale north/south and east/west park paths clear.
      if (Math.abs(x) < 0.85 || Math.abs(z) < 0.85) continue;
      dummy.position.set(x, 0.015, z);
      dummy.scale.set(0.55 + Math.random() * 0.5, 0.45 + Math.random() * 0.55, 0.55 + Math.random() * 0.5);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.updateMatrix();
      mesh.setMatrixAt(placed++, dummy.matrix);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
  }

  /**
   * Called when any gun fires or explosive detonates.
   * Causes bird flock to immediately scatter in panic!
   */
  public onGunshot(shotPos: THREE.Vector3) {
    if (this.birdData.length === 0) return;

    for (let i = 0; i < this.birdData.length; i++) {
      const b = this.birdData[i];
      b.isScattering = true;
      b.scatterTimer = 8.0 + Math.random() * 4.0; // 8-12 seconds of panic flight
      b.scatterSpeed = 2.4 + Math.random() * 0.8;  // Fast panic speed
      b.flapFreq = 9.5 + Math.random() * 2.0;       // Vigorous flapping

      // Calculate radial scatter vector away from gunshot
      const bx = Math.cos(b.angle) * b.baseRadius;
      const bz = Math.sin(b.angle) * b.baseRadius;
      const dir = new THREE.Vector3(bx - shotPos.x, 25, bz - shotPos.z).normalize();
      b.scatterDir.copy(dir);
    }
  }

  public update(delta: number, _playerPos?: THREE.Vector3, isPlayerIndoors?: boolean) {
    this.time += delta;

    // 1. Update Birds with Gunshot Scattering & Smooth Recovery
    if (this.birdMesh && this.birdData.length > 0) {
      for (let i = 0; i < this.birdData.length; i++) {
        const b = this.birdData[i];

        if (b.isScattering) {
          b.scatterTimer -= delta;
          b.angle += b.speed * b.scatterSpeed * delta;
          b.height += 4.0 * delta; // Climb higher in panic
          if (b.height > 65) b.height = 65;

          if (b.scatterTimer <= 0) {
            b.isScattering = false;
            b.flapFreq = 4.8 + Math.random() * 1.6;
          }
        } else {
          b.angle += b.speed * delta;
          // Smoothly descend to cruising height
          if (b.height > 42) {
            b.height -= 2.0 * delta;
          }
        }

        const x = Math.cos(b.angle) * b.baseRadius;
        const z = Math.sin(b.angle) * b.baseRadius;
        const y = b.height + Math.sin(this.time * 0.9 + b.phase) * (b.isScattering ? 2.8 : 1.6);

        const facingYaw = b.angle + Math.PI / 2;
        const roll = -0.24 + Math.sin(this.time * b.flapFreq + b.phase) * (b.isScattering ? 0.22 : 0.08);
        const pitch = Math.cos(this.time * 0.9 + b.phase) * 0.06;

        this.dummy.position.set(x, y, z);
        this.dummy.rotation.set(pitch, facingYaw, roll);
        this.dummy.scale.setScalar(b.isScattering ? 1.4 : 1.2);
        this.dummy.updateMatrix();

        this.birdMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.birdMesh.instanceMatrix.needsUpdate = true;
    }

    // 2. Drift Instanced Clouds
    if (this.cloudMesh && this.cloudData.length > 0) {
      for (let i = 0; i < this.cloudData.length; i++) {
        const c = this.cloudData[i];
        c.pos.x += c.speed * delta;
        // Wrap around at perimeter boundary
        if (c.pos.x > 220) c.pos.x = -220;

        this.dummy.position.copy(c.pos);
        this.dummy.scale.copy(c.scale);
        this.dummy.updateMatrix();
        this.cloudMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.cloudMesh.instanceMatrix.needsUpdate = true;
    }

    // 3. Acoustic Ambient Birdsong Indoor Attenuation
    if (this.audioElement && !this.isMuted) {
      const targetVol = isPlayerIndoors ? this.targetAudioVolume * 0.25 : this.targetAudioVolume;
      this.audioElement.volume = THREE.MathUtils.lerp(this.audioElement.volume, targetVol, delta * 3.0);
    }
  }
}
