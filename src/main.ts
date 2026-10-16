// src/main.ts
// Master First-Person Shooter Engine & Orchestrator

import './style.css';
import * as THREE from 'three';
import { FirstPersonControls } from './player/firstPersonControls';
import { WeaponManager } from './weapons/weaponManager';
import { TargetManager } from './environment/targets';
import { createShootingRange } from './environment/shootingRange';
import { FPSHUD } from './ui/fpsHUD';

class FPSApp {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;

  private controls: FirstPersonControls;
  private weaponManager: WeaponManager;
  private targetManager: TargetManager;
  private hud: FPSHUD;

  private tracerMaterial: THREE.MeshBasicMaterial;
  private activeTracers: { mesh: THREE.Mesh; life: number }[] = [];

  constructor() {
    const appEl = document.querySelector<HTMLDivElement>('#app')!;
    appEl.innerHTML = '<canvas id="game-canvas"></canvas>';
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;

    // 1. Scene & Renderer Setup
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);

    // Dedicated Viewmodel Lighting Rig (Ensures weapons, arms, and reflex sight are clearly illuminated)
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

    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // 2. Environment & Targets
    createShootingRange(this.scene);
    this.targetManager = new TargetManager(this.scene);

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
    this.animate();
  }

  private setupInteractions() {
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
      } else if (e.code === 'KeyQ') {
        this.weaponManager.toggleADS();
      } else if (e.code === 'KeyV') {
        this.weaponManager.triggerInspect();
      } else if (e.code === 'KeyT') {
        this.hud.toggleTuning(this.weaponManager.currentDef);
      }
    });

    // Mouse wheel weapon switch
    const weapons: Array<'ak47' | 'pistol' | 'smg'> = ['ak47', 'pistol', 'smg'];
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

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3) {
    const dir = end.clone().sub(start);
    const dist = dir.length();
    const tracerGeo = new THREE.CylinderGeometry(0.006, 0.006, Math.min(dist, 1.8), 6);
    const tracerMesh = new THREE.Mesh(tracerGeo, this.tracerMaterial);
    tracerMesh.userData.ignoreRaycast = true;

    tracerMesh.position.copy(start).add(dir.clone().multiplyScalar(0.2));
    tracerMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

    this.scene.add(tracerMesh);
    this.activeTracers.push({ mesh: tracerMesh, life: 0.08 });
  }

  private setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Update Player & Controls
    this.controls.update(delta);
    this.hud.setPointerLocked(this.controls.isLocked);

    // Update Weapons & Animations
    this.weaponManager.update(
      delta,
      this.controls.mouseDelta,
      this.controls.isMoving,
      this.controls.isSprinting
    );

    // Update Targets & Particles
    this.targetManager.update(delta);

    // Update Tracers
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const tracer = this.activeTracers[i];
      tracer.life -= delta;
      if (tracer.life <= 0) {
        this.scene.remove(tracer.mesh);
        this.activeTracers.splice(i, 1);
      }
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  };
}

// Start Game
new FPSApp();
