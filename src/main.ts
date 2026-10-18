// src/main.ts
// Master First-Person Shooter Engine & Orchestrator
// Supports 5 Weapons (AK-47, M9 Pistol, Cyclone-9 SMG, SPAS-12 Shotgun, AW-50 Sniper)
// and 5 Map Arenas (Shooting Range, Foundry Yard, Cul-de-Sac, Dustline Village, Overpass)

import './style.css';
import * as THREE from 'three';
import { FirstPersonControls } from './player/firstPersonControls';
import { WeaponManager } from './weapons/weaponManager';
import { type WeaponId, type WeaponDef, calculateDamageFalloff } from './weapons/weaponTypes';
import { TargetManager, FX_NON_RAYCAST_LAYER, type HitResult } from './environment/targets';
import { createShootingRange } from './environment/shootingRange';
import { BlueprintMapLoader, type MapId } from './environment/blueprintMapLoader';
import { AtmosphereManager } from './environment/atmosphereManager';
import { FPSHUD } from './ui/fpsHUD';
import { BUILD_STAMP } from './buildStamp';
import { initSoundTestOverlay } from './ui/soundTestModal';

// ─── Diagnostic counters exposed for e2e testing ───────────────────────────
interface ListenerCounts { mousedown: number; mouseup: number; keydown: number; keyup: number; wheel: number; }
declare global { interface Window { __listenerCounts: ListenerCounts; __simTicksThisSecond: number; } }
window.__listenerCounts = { mousedown: 0, mouseup: 0, keydown: 0, keyup: 0, wheel: 0 };
window.__simTicksThisSecond = 0;
(window as any).THREE = THREE;

// Max delta-time after any pause/load spike (1/20 s)
const MAX_DT = 1 / 20;

interface ActiveTracer {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  end: THREE.Vector3;
  aimOrigin: THREE.Vector3;
  aimDirection: THREE.Vector3;
  totalDist: number;
  currentDist: number;
  speed: number;
  boltLength: number;
  life: number;
  maxLife: number;
  hitResult?: HitResult;
  impactTriggered: boolean;
}

class FPSApp {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;

  private controls: FirstPersonControls;
  private weaponManager: WeaponManager;
  private targetManager: TargetManager;
  private mapLoader: BlueprintMapLoader;
  private atmosphereManager: AtmosphereManager;
  private hud: FPSHUD;

  private rangeEnvironmentGroup: THREE.Group;
  private tracerMaterials: Map<number, THREE.MeshBasicMaterial> = new Map();
  public activeTracers: ActiveTracer[] = [];
  private isDebugMode: boolean = false;
  private debugRaycaster = new THREE.Raycaster();
  private scratchCameraDir = new THREE.Vector3();
  private scratchTracerHead = new THREE.Vector3();
  private scratchTracerTail = new THREE.Vector3();

  // ── Input-blocked flag: set whenever any UI element has focus/is open ────
  // When true, window-level mouse+key listeners do nothing (except mouseup
  // which always forces-releases so the trigger cannot get stuck).
  private inputBlocked: boolean = false;

  // Tick-rate diagnostic
  private diagTickCount = 0;
  private diagSecTimer = 0;

  constructor() {
    // Set page title with build stamp
    document.title = `RANGE [${BUILD_STAMP}]`;

    const appEl = document.querySelector<HTMLDivElement>('#app')!;
    appEl.innerHTML = '<canvas id="game-canvas"></canvas>';
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;

    // 1. Scene & Renderer Setup
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 450);
    this.camera.layers.enable(FX_NON_RAYCAST_LAYER);

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
    this.atmosphereManager = new AtmosphereManager(this.scene);

    // 3. Player & Weapons
    this.controls = new FirstPersonControls(this.camera, canvas);
    this.weaponManager = new WeaponManager(this.scene, this.camera);
    this.hud = new FPSHUD();
    if (typeof window !== 'undefined') {
      (window as any).__fpsApp = this;
    }

    this.setupInteractions();
    this.setupResize();

    const initialQuality = (new URLSearchParams(window.location.search).get('quality') as 'low' | 'medium' | 'high') || 'high';
    this.setQuality(initialQuality);

    // Check URL for initial map parameter (e.g., ?map=foundry or ?map=range)
    const initialMap = (new URLSearchParams(window.location.search).get('map') as MapId) || 'range';
    this.switchMap(initialMap);

    (window as any).__fpsApp = this;
    (window as any).app = this;
    (window as any).targetManager = this.targetManager;
    (window as any).weaponManager = this.weaponManager;
    (window as any).controls = this.controls;

    this.isDebugMode = new URLSearchParams(window.location.search).get('debug') === '1';

    // Check URL for sound test parameter (?soundtest=1)
    if (new URLSearchParams(window.location.search).get('soundtest') === '1') {
      initSoundTestOverlay(this.weaponManager);
    }

    this.animate();
  }

  public setQuality(quality: 'low' | 'medium' | 'high') {
    this.atmosphereManager.setQuality(quality);
    if (quality === 'low') {
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = false;
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
    }
  }

  // ── Force-release: call whenever focus leaves the game ───────────────────
  // Prevents "stuck trigger" when mousedown fires through UI but mouseup
  // is consumed by the modal/pointer-lock change.
  private forceReleaseInputs() {
    this.weaponManager.setTrigger(false);
    this.weaponManager.toggleADS(false);
    this.controls.forceReleaseKeys();
  }

  public async switchMap(mapId: MapId) {
    // Block game input while loading; force-release any held state first.
    this.inputBlocked = true;
    this.forceReleaseInputs();

    if (mapId === 'range') {
      this.mapLoader.clearCurrentMap();
      this.rangeEnvironmentGroup.visible = true;
      this.hud.setMapName('Tactical Shooting Range');
      this.targetManager.clearDynamicTargets();
      this.targetManager.setRangeTargetsVisible(true);
      this.controls.setBounds({ minX: -7.5, maxX: 7.5, minZ: -3.2, maxZ: 5.5 });
      this.controls.setColliders([
        // Three Tactical Shooting Benches within firing stalls
        { minX: -6.1, maxX: -3.9, minY: 0, maxY: 0.9, minZ: -2.9, maxZ: -2.1, isWalkable: true },
        { minX: -1.1, maxX: 1.1, minY: 0, maxY: 0.9, minZ: -2.9, maxZ: -2.1, isWalkable: true },
        { minX: 3.9, maxX: 6.1, minY: 0, maxY: 0.9, minZ: -2.9, maxZ: -2.1, isWalkable: true },
      ]);
      this.controls.setPosition(0, 1.7, 0, 0);
      this.controls.setSpawnPoint(0, 1.7, 0, 0);
    } else {
      this.rangeEnvironmentGroup.visible = false;
      const result = await this.mapLoader.loadMap(mapId, this.targetManager);
      this.hud.setMapName(result.name);
      this.controls.setBounds(result.bounds);
      this.controls.setColliders(result.colliders);
      this.controls.setPosition(result.spawn.x, result.spawn.y, result.spawn.z, result.spawn.facingYaw);
      this.controls.setSpawnPoint(result.spawn.x, result.spawn.y, result.spawn.z, result.spawn.facingYaw);
    }

    // Configure OOB callbacks
    this.controls.onOutOfBoundsWarning = (sec: number) => {
      this.hud.showOOBWarning(sec);
    };
    this.controls.onOutOfBoundsClear = () => {
      this.hud.clearOOBWarning();
    };

    // Quality preset from URL (?quality=low|medium|high)
    const qualityParam = (new URLSearchParams(window.location.search).get('quality') as 'low' | 'medium' | 'high') || 'medium';
    this.atmosphereManager.setQuality(qualityParam);
    if (qualityParam === 'low') {
      this.renderer.setPixelRatio(1.0);
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    // Configure open-world atmospheric sky dome, horizon ridgeline, framing foliage & bird flock
    this.atmosphereManager.setupAtmosphere(mapId);

    // Clear any active tracers on map load
    for (const tracer of this.activeTracers) {
      this.scene.remove(tracer.mesh);
      tracer.mesh.geometry.dispose();
    }
    this.activeTracers = [];

    // Reset weapon state AFTER the async load so no accumulated dt/state leaks.
    this.weaponManager.resetForMapLoad();

    // Drain the clock so the first post-load delta is ~0 (not the full load time).
    this.clock.getDelta();

    // Unblock input once load is complete.
    this.inputBlocked = false;
  }

  private setupInteractions() {
    // Map Selection Linkage — also blocks/unblocks input around modal open/close.
    this.hud.onMapSelect = (mapId: MapId) => {
      // The HUD will close the modal; the switchMap call below will force-release
      // and block input for the duration of the load.
      this.switchMap(mapId);
    };

    // Notify main when modal opens/closes so we can block input.
    this.hud.onModalOpen = () => {
      this.inputBlocked = true;
      this.forceReleaseInputs();
    };
    this.hud.onModalClose = () => {
      // Re-check: if we're in a map load the flag stays true until load ends.
      if (!this.mapLoader.isLoading) {
        this.inputBlocked = false;
      }
    };

    // Pointer-lock lost → always release; re-acquired → unblock (unless loading).
    document.addEventListener('pointerlockchange', () => {
      if (!this.controls.isLocked) {
        // Lost lock: force-release everything.
        this.forceReleaseInputs();
      } else {
        // Re-acquired lock: unblock if not mid-load.
        if (!this.mapLoader.isLoading) {
          this.inputBlocked = false;
        }
      }
    });

    // Camera Recoil Linkage
    this.weaponManager.onCameraRecoil = (pitch, yaw) => {
      this.controls.applyCameraRecoil(pitch, yaw);
    };

    // Firing & Ballistics Linkage
    this.weaponManager.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection, weaponDef) => {
      this.atmosphereManager.onGunshot(muzzleOrigin);
      const hitResult = this.targetManager.checkBallisticHit(
        muzzleOrigin,
        aimOrigin,
        aimDirection,
        weaponDef,
        undefined,
        true // Defer visual and sound impact until visible bullet/tracer arrives
      );
      this.spawnTracer(muzzleOrigin, hitResult.point, weaponDef, aimOrigin, aimDirection, hitResult);
    };

    // Target Hit Confirmation Linkage
    this.targetManager.onHitRegistered = (_dmg, isCrit) => {
      this.hud.triggerHitmarker(isCrit);
    };

    // HUD Synchronization
    this.weaponManager.onStateChange = (state) => {
      this.hud.update(state, this.weaponManager.currentDef);
    };

    // Diagnostic muzzle marker dev flag (?muzzledebug=1)
    const isMuzzleDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('muzzledebug') === '1';
    if (isMuzzleDebug) {
      this.weaponManager.setDebugMuzzleMarker(true);
    }

    // ── Mouse Controls ────────────────────────────────────────────────────
    // mousedown: only act when input is NOT blocked (modal open, loading, unlocked).
    const onMouseDown = (e: MouseEvent) => {
      window.__listenerCounts.mousedown++;
      if (this.inputBlocked) return;
      if (!this.controls.isLocked && !this.hud.isDismissed) return;
      if (e.button === 0) {
        this.weaponManager.setTrigger(true);
      } else if (e.button === 2) {
        this.weaponManager.toggleADS(true);
      }
    };

    // mouseup: ALWAYS force-release — this is the "unstuck" safety net.
    const onMouseUp = (e: MouseEvent) => {
      window.__listenerCounts.mouseup++;
      if (e.button === 0) {
        this.weaponManager.setTrigger(false);
      } else if (e.button === 2) {
        this.weaponManager.toggleADS(false);
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e: MouseEvent) => { e.preventDefault(); });

    // ── Keyboard Shortcuts ────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      window.__listenerCounts.keydown++;
      if (this.inputBlocked) return;
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
      } else if (e.code === 'KeyU') {
        const next = !this.weaponManager.isDebugMuzzleMarkerEnabled();
        this.weaponManager.setDebugMuzzleMarker(next);
      }
    };

    const onKeyUp = (_e: KeyboardEvent) => {
      window.__listenerCounts.keyup++;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Mouse wheel weapon switch ─────────────────────────────────────────
    const weapons: WeaponId[] = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];
    const onWheel = (e: WheelEvent) => {
      window.__listenerCounts.wheel++;
      if (this.inputBlocked) return;
      if (!this.controls.isLocked && !this.hud.isDismissed) return;
      const currentIndex = weapons.indexOf(this.weaponManager.state.currentWeaponId);
      if (e.deltaY > 0) {
        const nextIndex = (currentIndex + 1) % weapons.length;
        this.weaponManager.switchWeapon(weapons[nextIndex]);
      } else if (e.deltaY < 0) {
        const prevIndex = (currentIndex - 1 + weapons.length) % weapons.length;
        this.weaponManager.switchWeapon(weapons[prevIndex]);
      }
    };
    window.addEventListener('wheel', onWheel);
  }

  private getTracerMaterial(color: number): THREE.MeshBasicMaterial {
    let mat = this.tracerMaterials.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
      });
      this.tracerMaterials.set(color, mat);
    }
    return mat;
  }

  private sampleTrajectoryPoint(
    s: number,
    start: THREE.Vector3,
    end: THREE.Vector3,
    _aimOrigin: THREE.Vector3,
    _aimDirection: THREE.Vector3,
    totalDist: number,
    out: THREE.Vector3
  ): THREE.Vector3 {
    const t = totalDist > 0 ? Math.min(1, Math.max(0, s / totalDist)) : 0;
    return out.copy(start).lerp(end, t);
  }

  private spawnTracer(
    from: THREE.Vector3,
    to: THREE.Vector3,
    weaponDef?: WeaponDef,
    aimOrigin?: THREE.Vector3,
    aimDirection?: THREE.Vector3,
    hitResult?: HitResult
  ) {
    const thickness = weaponDef?.tracerThickness ?? 0.008;
    const color = weaponDef?.tracerColor ?? 0xffea88;

    const effectiveAimOrigin = aimOrigin ? aimOrigin.clone() : this.camera.position.clone();
    let effectiveAimDir: THREE.Vector3;
    if (aimDirection) {
      effectiveAimDir = aimDirection.clone();
    } else {
      this.camera.getWorldDirection(this.scratchCameraDir);
      effectiveAimDir = this.scratchCameraDir.clone();
    }

    // When in Sniper Telescopic Scope ADS (or high optical zoom where viewmodel is hidden):
    // The viewmodel is hidden and the player aims through a magnified 16-degree optic reticle.
    // The tracer must emerge along the camera's optical sightline so that the bullet streaks
    // straight forward through the reticle crosshair, eliminating any side-entry across the circular lens.
    const isSniperScoped = !!(
      (weaponDef?.isSniperScope && this.weaponManager.weaponState.isScoped) ||
      (weaponDef?.id === 'sniper' && this.camera.fov < 50)
    );

    const effectiveStart = isSniperScoped
      ? effectiveAimOrigin.clone().addScaledVector(effectiveAimDir, 0.45)
      : from.clone();

    const totalDist = effectiveStart.distanceTo(to);
    if (totalDist < 0.08) return;

    // Bullet tracer speed: calibrated per weapon (130 - 240 m/s) to produce a crisp, perceptible travel journey
    const speed = weaponDef?.tracerSpeed ?? 160;

    // Finite glowing projectile bolt length
    let boltLength = weaponDef?.tracerBoltLength ?? (weaponDef?.id === 'sniper' ? 1.8 : (weaponDef?.id === 'shotgun' ? 0.6 : 1.0));
    boltLength = Math.min(boltLength, Math.max(0.2, totalDist * 0.45));

    // Calculate maxLife to comfortably cover full flight duration + tail exit + buffer
    const travelDuration = (totalDist + boltLength) / speed;
    const maxLife = Math.max(weaponDef?.tracerLife ?? 1.2, travelDuration + 0.35);

    // Unit length cylinder (length = 1.0 along Z axis, rotated Math.PI / 2 on X)
    const geom = new THREE.CylinderGeometry(thickness, thickness, 1.0, 6);
    geom.rotateX(Math.PI / 2);
    const mat = this.getTracerMaterial(color);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = 'bullet-tracer';
    mesh.userData.ignoreRaycast = true;
    mesh.userData.isTracer = true;
    mesh.layers.set(FX_NON_RAYCAST_LAYER);

    // Initial frame positioning: emerging directly from the muzzle opening (or optical sightline in scope)
    const initialHead = Math.min(totalDist, boltLength);
    const pTail = effectiveStart.clone();
    const pHead = this.sampleTrajectoryPoint(
      initialHead,
      effectiveStart,
      to,
      effectiveAimOrigin,
      effectiveAimDir,
      totalDist,
      this.scratchTracerHead
    );
    const segDist = Math.max(0.01, pTail.distanceTo(pHead));

    mesh.scale.set(1, 1, segDist);
    mesh.position.copy(pTail).lerp(pHead, 0.5);
    mesh.lookAt(pHead);

    this.scene.add(mesh);
    this.activeTracers.push({
      mesh,
      start: effectiveStart.clone(),
      end: to.clone(),
      aimOrigin: effectiveAimOrigin,
      aimDirection: effectiveAimDir,
      totalDist,
      currentDist: initialHead,
      speed,
      boltLength,
      life: maxLife,
      maxLife,
      hitResult,
      impactTriggered: false,
    });
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

    // Clamp dt: caps any load-spike frame to MAX_DT.
    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, MAX_DT);

    // Sim-tick diagnostic counter (exposed for e2e)
    this.diagTickCount++;
    this.diagSecTimer += delta;
    if (this.diagSecTimer >= 1) {
      window.__simTicksThisSecond = this.diagTickCount;
      this.diagTickCount = 0;
      this.diagSecTimer -= 1;
    }

    // Controls & Locomotion Update
    this.controls.update(delta);

    // Bullet Tracers Advance & Decay (High-velocity dynamic projectile bolts)
    // Advance pre-existing active tracers BEFORE updating weapons so that newly created shots
    // render emerging from the actual muzzle point on their first rendered frame without a 1-frame advance offset.
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const tracer = this.activeTracers[i];
      tracer.currentDist += tracer.speed * delta;
      tracer.life -= delta;

      // Trigger impact when the bullet head reaches or passes the target point
      if (tracer.currentDist >= tracer.totalDist && !tracer.impactTriggered) {
        tracer.impactTriggered = true;
        if (tracer.hitResult) {
          this.targetManager.applyHitImpact(tracer.hitResult);
        }
      }

      const tailDist = Math.max(0, tracer.currentDist - tracer.boltLength);
      const headDist = Math.min(tracer.totalDist, tracer.currentDist);

      if (tailDist >= tracer.totalDist || tracer.life <= 0) {
        if (!tracer.impactTriggered && tracer.hitResult) {
          tracer.impactTriggered = true;
          this.targetManager.applyHitImpact(tracer.hitResult);
        }
        this.scene.remove(tracer.mesh);
        tracer.mesh.geometry.dispose();
        this.activeTracers.splice(i, 1);
        continue;
      }

      const pHead = this.sampleTrajectoryPoint(
        headDist,
        tracer.start,
        tracer.end,
        tracer.aimOrigin,
        tracer.aimDirection,
        tracer.totalDist,
        this.scratchTracerHead
      );
      const pTail = this.sampleTrajectoryPoint(
        tailDist,
        tracer.start,
        tracer.end,
        tracer.aimOrigin,
        tracer.aimDirection,
        tracer.totalDist,
        this.scratchTracerTail
      );
      const segDist = pTail.distanceTo(pHead);

      if (segDist > 0.01) {
        tracer.mesh.scale.set(1, 1, segDist);
        tracer.mesh.position.copy(pTail).lerp(pHead, 0.5);
        tracer.mesh.lookAt(pHead);
        tracer.mesh.visible = true;
      } else {
        tracer.mesh.visible = false;
      }
    }

    // Viewmodel Physics, Recoil, Sway, and Reload Update (may spawn new tracers emerging from muzzle)
    this.weaponManager.update(
      delta,
      this.controls.mouseDelta,
      this.controls.isMoving,
      this.controls.isSprinting,
      this.controls.getHorizontalSpeed()
    );

    // Target Physics & Wobble Update
    this.targetManager.update(delta);

    // Ambient Atmosphere & Bird Flock Animation Update
    const isIndoors = this.mapLoader.isPlayerIndoors(
      this.controls.position.x,
      this.controls.position.y,
      this.controls.position.z
    );
    this.atmosphereManager.update(delta, this.controls.position, isIndoors);

    // Optional debug rangefinder (?debug=1)
    if (this.isDebugMode) {
      this.camera.getWorldDirection(this.scratchCameraDir);
      this.debugRaycaster.set(this.camera.position, this.scratchCameraDir);
      this.debugRaycaster.far = 300;
      const intersects = this.debugRaycaster.intersectObjects(this.scene.children, true);
      let hitDist: number | null = null;
      for (const h of intersects) {
        if (this.targetManager.isValidHit(h)) {
          hitDist = h.distance;
          break;
        }
      }
      const curDef = this.weaponManager.currentDef;
      if (hitDist !== null) {
        const falloff = calculateDamageFalloff(hitDist, curDef.damage, curDef, false, 1.0);
        this.hud.updateDebugRangefinder(hitDist, falloff.multiplier, falloff.damage, falloff.inRange, curDef.name);
      } else {
        this.hud.updateDebugRangefinder(null, 0, 0, false, curDef.name);
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
