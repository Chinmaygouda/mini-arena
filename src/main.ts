// src/main.ts
// Master First-Person Shooter Engine & Orchestrator
// Supports 5 Weapons (AK-47, M9 Pistol, Cyclone-9 SMG, SPAS-12 Shotgun, AW-50 Sniper)
// and 5 Map Arenas (Shooting Range, Foundry Yard, Cul-de-Sac, Dustline Village, Overpass)

import './style.css';
import * as THREE from 'three';
import { FirstPersonControls } from './player/firstPersonControls';
import { WeaponManager } from './weapons/weaponManager';
import type { WeaponId } from './weapons/weaponTypes';
import { TargetManager } from './environment/targets';
import { createShootingRange } from './environment/shootingRange';
import { BlueprintMapLoader, type MapId } from './environment/blueprintMapLoader';
import { FPSHUD } from './ui/fpsHUD';
import { BUILD_STAMP } from './buildStamp';

class FPSApp {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;

  private controls: FirstPersonControls;
  private weaponManager: WeaponManager;
  private targetManager: TargetManager;
  private mapLoader: BlueprintMapLoader;
  private hud: FPSHUD;

  private rangeEnvironmentGroup: THREE.Group;
  private tracerMaterial: THREE.MeshBasicMaterial;
  private activeTracers: { mesh: THREE.Mesh; life: number }[] = [];

  constructor() {
    // Set page title with build stamp
    document.title = `RANGE [${BUILD_STAMP}]`;

    const appEl = document.querySelector<HTMLDivElement>('#app')!;
    appEl.innerHTML = '<canvas id="game-canvas"></canvas>';
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;

    // 1. Scene & Renderer Setup
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);

    // Dedicated Viewmodel Lighting Rig
    const vmKeyLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    vmKeyLight.position.set(0.6, 1.0, 0.8);
    this.camera.add(vmKeyLight);

    const vmRimLight = new THREE.DirectionalLight(0x88ccff, 0.7);
    vmRimLight.position.set(-0.8, -0.3, 0.4);
    this.camera.add(vmRimLight);

    const vmHemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444d56, 0.95);
    this.camera.add(vmHemisphereLight);

    const vmFrontFill = new THREE.DirectionalLight(0xffffff, 0.6);
    vmFrontFill.position.set(-0.5, 0.5, -0.6);
    this.camera.add(vmFrontFill);

    const vmEyeLight = new THREE.PointLight(0xfffaed, 0.9, 1.8, 1.2);
    vmEyeLight.position.set(0, 0.08, -0.12);
    this.camera.add(vmEyeLight);

    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // 2. Environment & Maps
    this.rangeEnvironmentGroup = new THREE.Group();
    this.scene.add(this.rangeEnvironmentGroup);
    createShootingRange(this.rangeEnvironmentGroup);

    this.targetManager = new TargetManager(this.scene);
    this.mapLoader = new BlueprintMapLoader(this.scene);

    // 3. Player & Weapons
    this.controls = new FirstPersonControls(this.camera, canvas);
    this.weaponManager = new WeaponManager(this.scene, this.camera);
    this.hud = new FPSHUD();

    this.tracerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0.9,
    });

    this.setupInteractions();
    this.setupResize();

    // Check URL for initial map parameter (e.g., ?map=foundry or ?map=range)
    const initialMap = (new URLSearchParams(window.location.search).get('map') as MapId) || 'range';
    this.switchMap(initialMap);

    this.animate();
  }

  public async switchMap(mapId: MapId) {
    if (mapId === 'range') {
      this.mapLoader.clearCurrentMap();
      this.rangeEnvironmentGroup.visible = true;
      this.hud.setMapName('Tactical Shooting Range');
    } else {
      this.rangeEnvironmentGroup.visible = false;
      const mapName = await this.mapLoader.loadMap(mapId, this.targetManager);
      this.hud.setMapName(mapName);
    }

    // Reset player position safely
    this.camera.position.set(0, 1.8, 6);
  }

  private setupInteractions() {
    // Map Selection Linkage
    this.hud.onMapSelect = (mapId: MapId) => {
      this.switchMap(mapId);
    };

    // Camera Recoil Linkage
    this.weaponManager.onCameraRecoil = (pitch, yaw) => {
      this.controls.applyCameraRecoil(pitch, yaw);
    };

    // Firing & Ballistics Linkage
    this.weaponManager.onFireRaycast = (origin, direction, weaponDef) => {
      const hitResult = this.targetManager.checkBulletHit(
        origin,
        direction,
        weaponDef.damage,
        weaponDef.critMultiplier
      );

      // Bullet Tracer Visual Effect
      this.spawnTracer(origin, hitResult.point);
    };

    // Target Hit Confirmation Linkage
    this.targetManager.onHitRegistered = (_dmg, isCrit) => {
      this.hud.triggerHitmarker(isCrit);
    };

    // HUD Synchronization
    this.weaponManager.onStateChange = (state) => {
      this.hud.update(state, this.weaponManager.currentDef);
    };

    // Mouse Controls
    window.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.controls.isLocked && !this.hud.isDismissed) return;
      if (e.button === 0) {
        this.weaponManager.setTrigger(true);
      } else if (e.button === 2) {
        this.weaponManager.toggleADS(true);
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) {
        this.weaponManager.setTrigger(false);
      } else if (e.button === 2) {
        this.weaponManager.toggleADS(false);
      }
    });

    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        this.weaponManager.startReload();
      } else if (e.code === 'Digit1') {
        this.weaponManager.switchWeapon('ak47');
      } else if (e.code === 'Digit2') {
        this.weaponManager.switchWeapon('pistol');
      } else if (e.code === 'Digit3') {
        this.weaponManager.switchWeapon('smg');
      } else if (e.code === 'Digit4') {
        this.weaponManager.switchWeapon('shotgun');
      } else if (e.code === 'Digit5') {
        this.weaponManager.switchWeapon('sniper');
      } else if (e.code === 'KeyM') {
        this.hud.toggleMapModal();
      } else if (e.code === 'KeyQ') {
        this.weaponManager.toggleADS();
      } else if (e.code === 'KeyV') {
        this.weaponManager.triggerInspect();
      } else if (e.code === 'KeyT') {
        this.hud.toggleTuning(this.weaponManager.currentDef);
      }
    });

    // Mouse wheel weapon switch across all 5 firearms
    const weapons: WeaponId[] = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];
    window.addEventListener('wheel', (e: WheelEvent) => {
      if (!this.controls.isLocked && !this.hud.isDismissed) return;
      const currentIndex = weapons.indexOf(this.weaponManager.state.currentWeaponId);
      if (e.deltaY > 0) {
        const nextIndex = (currentIndex + 1) % weapons.length;
        this.weaponManager.switchWeapon(weapons[nextIndex]);
      } else if (e.deltaY < 0) {
        const prevIndex = (currentIndex - 1 + weapons.length) % weapons.length;
        this.weaponManager.switchWeapon(weapons[prevIndex]);
      }
    });
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const dist = from.distanceTo(to);
    const geom = new THREE.CylinderGeometry(0.008, 0.008, dist, 6);
    geom.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geom, this.tracerMaterial);

    mesh.position.copy(from).lerp(to, 0.5);
    mesh.lookAt(to);
    this.scene.add(mesh);

    this.activeTracers.push({ mesh, life: 0.08 });
  }

  private setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private animate = () => {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Controls & Locomotion Update
    this.controls.update(delta);

    // Viewmodel Physics, Recoil, Sway, and Reload Update
    this.weaponManager.update(
      delta,
      this.controls.mouseDelta,
      this.controls.isMoving,
      this.controls.isSprinting
    );

    // Target Physics & Wobble Update
    this.targetManager.update(delta);

    // Bullet Tracers Decay
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const tracer = this.activeTracers[i];
      tracer.life -= delta;
      if (tracer.life <= 0) {
        this.scene.remove(tracer.mesh);
        tracer.mesh.geometry.dispose();
        this.activeTracers.splice(i, 1);
      }
    }

    // Pointer-Lock Sync with HUD
    this.hud.setPointerLocked(this.controls.isLocked);

    // Primary Scene Rendering
    this.renderer.render(this.scene, this.camera);
  };
}

// Instantiate FPS Engine
window.addEventListener('DOMContentLoaded', () => {
  new FPSApp();
});
