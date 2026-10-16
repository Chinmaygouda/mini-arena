import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import Stats from 'stats-gl';
import {
  calculateDamage,
  computeEffectiveSpread,
  createDefaultPlayerState,
  createDefaultWeaponState,
  createFireTimingState,
  createSeededRng,
  createTimestepState,
  FireTimingState,
  getCurrentSlot,
  getCurrentWeaponDef,
  PLAYER_EYE_HEIGHT_CROUCH,
  PLAYER_EYE_HEIGHT_STAND,
  PlayerSimState,
  recordShotFired,
  sampleSpreadOffsets,
  setSprinting,
  SIM_TICK_DELTA,
  stepFireTiming,
  stepPlayer,
  stepWeaponStateMachine,
  triggerReload,
  cancelReloadOnFire,
  triggerSwapBySlot,
  tryConsumeShot,
  updateAccumulator,
  Vec3,
  WeaponState,
  isWeaponReadyToFire,
  bufferFireInput,
  generateSeededPelletOffsets,
  hashPlayerShot,
  PelletOffset,
  canTriggerFire,
  updateTriggerState,
  createInitialPlayerVitals,
  stepPlayerVitals,
  PlayerVitalsState,
  GRENADE_DEFS,
  getMapSpec,
  MapSpec,
} from '@mini-arena/shared';
import { initPhysics, PhysicsEngine } from './physics';
import { InputManager } from './input';
import { buildGreyboxArena } from './arena';
import { TargetDummyManager } from './dummies';
import { triggerHitMarker, WeaponViewmodel } from './viewmodel';
import { weaponAudio } from './audio';
import { DecalManager } from './vfx/decalManager';
import { CombatVfxManager } from './vfx/combatVfxManager';
import { RapierGrenadeWorldAdapter } from './vfx/grenadeWorldAdapter';
import { GrenadeClientManager } from './vfx/grenadeClientManager';
import { MapLoader, LoadedMapSession } from './maps/mapLoader';

declare global {
  interface Window {
    __renderer?: 'webgpu' | 'webgl2';
    __playerState?: PlayerSimState;
    __inputManager?: InputManager;
    __physics?: PhysicsEngine;
    __weaponState?: WeaponState;
    __fireTiming?: FireTimingState;
    __dummies?: TargetDummyManager;
    __viewmodel?: WeaponViewmodel;
    __fps?: number;
    __threeRenderer?: WebGPURenderer;
    __camera?: THREE.PerspectiveCamera;
    __debugCamera?: THREE.PerspectiveCamera | null;
    __scene?: THREE.Scene;
    __decalManager?: DecalManager;
    __combatVfx?: CombatVfxManager;
    __grenadeManager?: GrenadeClientManager;
    __playerVitals?: PlayerVitalsState;
    __mapLoader?: MapLoader;
    __mapSession?: LoadedMapSession;
    __mapSpec?: MapSpec;
    __switchMap?: (id: string) => void;
    THREE?: typeof THREE;
  }
}

async function initApp(): Promise<void> {
  const container = document.getElementById('canvas-container');
  if (!container) throw new Error('Canvas container not found');

  const badge = document.getElementById('renderer-badge');
  const hudPos = document.getElementById('hud-pos');
  const hudSpeed = document.getElementById('hud-speed');
  const hudState = document.getElementById('hud-state');

  // Parse forceWebGL and debug query parameters
  const url = new URL(window.location.href);
  const forceWebGL =
    url.searchParams.has('forceWebGL') &&
    url.searchParams.get('forceWebGL') !== 'false' &&
    url.searchParams.get('forceWebGL') !== '0';
  const isDebug =
    import.meta.env.DEV ||
    url.searchParams.has('debug') ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  const renderScale = url.searchParams.has('renderScale')
    ? Math.max(0.1, Math.min(2.0, parseFloat(url.searchParams.get('renderScale')!)))
    : 1.0;
  const dpr = url.searchParams.has('dpr')
    ? parseFloat(url.searchParams.get('dpr')!)
    : window.devicePixelRatio;
  const antialias =
    url.searchParams.get('antialias') !== '0' &&
    url.searchParams.get('antialias') !== 'false';

  // Three.js WebGPURenderer with automatic WebGL2 fallback
  const renderer = new WebGPURenderer({
    antialias,
    forceWebGL,
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(dpr * renderScale, 2));
  container.appendChild(renderer.domElement);

  // Mandatory asynchronous initialization for WebGPU
  await renderer.init();

  // Inspect actual active backend
  const isWebGPU =
    'isWebGPUBackend' in renderer.backend &&
    (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
  const backendName: 'webgpu' | 'webgl2' = isWebGPU ? 'webgpu' : 'webgl2';
  if (isDebug) {
    window.__renderer = backendName;
    window.__threeRenderer = renderer;
  }

  if (badge) {
    badge.textContent = isWebGPU ? 'WebGPU' : 'WebGL2 (Fallback)';
    badge.className = `badge ${isWebGPU ? 'badge-webgpu' : 'badge-webgl2'}`;
  }

  // Diagnostics HUD
  const stats = new Stats({
    horizontal: false,
    trackGPU: true,
  });
  await stats.init(renderer);
  document.body.appendChild(stats.dom);

  // Initialize Rapier 3D physics
  const physics = await initPhysics();
  if (isDebug) {
    window.__physics = physics;
  }

  // Scene & Camera setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f12);
  scene.fog = new THREE.FogExp2(0x0d0f12, 0.015);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.01,
    500,
  );
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // Debug outside viewmodel inspection camera (?debug=1&vmCam=side|top|front|sideLeft|quarterFront|quarterRear)
  const vmCam = url.searchParams.get('vmCam');
  let debugCamera: THREE.PerspectiveCamera | null = null;
  if (vmCam) {
    debugCamera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 100);
    camera.add(debugCamera);
    if (vmCam === 'side' || vmCam === 'sideRight') {
      debugCamera.position.set(0.65, -0.05, -0.2);
    } else if (vmCam === 'sideLeft') {
      debugCamera.position.set(-0.65, -0.05, -0.2);
    } else if (vmCam === 'top') {
      debugCamera.position.set(0.05, 0.65, -0.32);
    } else if (vmCam === 'front') {
      debugCamera.position.set(0.05, -0.15, -0.9);
    } else if (vmCam === 'quarterFront' || vmCam === 'frontRight') {
      debugCamera.position.set(0.45, 0.05, -0.65);
    } else if (vmCam === 'quarterRear' || vmCam === 'rearRight') {
      debugCamera.position.set(0.4, 0.15, 0.15);
    }
  }

  if (isDebug) {
    window.__camera = camera;
    window.__debugCamera = debugCamera;
    window.__scene = scene;
    (window as unknown as { THREE: unknown }).THREE = THREE;
  }

  // Modular Map Loading (Phase 5)
  const mapParam = url.searchParams.get('map') || 'warehouse';
  let currentMapSpec = getMapSpec(mapParam);
  const mapLoader = new MapLoader(scene, physics.world);
  let mapSession = mapLoader.loadMap(currentMapSpec);

  // Target dummies in the arena
  const dummies = new TargetDummyManager(scene);
  dummies.repositionForMap(currentMapSpec.id);
  if (isDebug) {
    window.__dummies = dummies;
    window.__mapLoader = mapLoader;
    window.__mapSession = mapSession;
    window.__mapSpec = currentMapSpec;
  }

  // Viewmodel (box placeholder with muzzle/tracers)
  const viewmodel = new WeaponViewmodel(camera, scene);
  if (isDebug) {
    window.__viewmodel = viewmodel;
  }

  // Weapon state & fire timing
  const weaponState = createDefaultWeaponState();
  const fireTiming = createFireTimingState();
  const rng = createSeededRng(1337);
  if (isDebug) {
    window.__weaponState = weaponState;
    window.__fireTiming = fireTiming;
  }
  viewmodel.updateWeaponVisual(getCurrentWeaponDef(weaponState));

  // Input manager
  const inputManager = new InputManager(container);
  if (isDebug) {
    window.__inputManager = inputManager;
  }

  // Decal Manager (instanced bullet holes & blast scorches)
  const decalManager = new DecalManager(scene);

  // Combat VFX Manager (shell ejection, surface impacts, camera trauma shake)
  const combatVfx = new CombatVfxManager(scene);

  // Grenade System with Rapier collision world adapter
  const grenadeWorld = new RapierGrenadeWorldAdapter(physics.world, physics.raw, physics.playerBody);
  const grenadeManager = new GrenadeClientManager(scene, camera, grenadeWorld, decalManager, combatVfx);

  // Player Vitals System
  const playerVitals = createInitialPlayerVitals('local_player');

  if (isDebug) {
    window.__decalManager = decalManager;
    window.__combatVfx = combatVfx;
    window.__grenadeManager = grenadeManager;
    window.__playerVitals = playerVitals;
  }

  // HUD elements for weapons, grenades, and health
  const hudWeaponName = document.getElementById('hud-weapon-name');
  const hudAmmoMag = document.getElementById('hud-ammo-mag');
  const hudAmmoReserve = document.getElementById('hud-ammo-reserve');
  const hudWeaponAction = document.getElementById('hud-weapon-action');
  const hudHealthNum = document.getElementById('hud-health-num');
  const hudHealthBar = document.getElementById('hud-health-bar');
  const hudSpawnProtection = document.getElementById('hud-spawn-protection');
  const hudGrenadeType = document.getElementById('hud-grenade-type');
  const hudGrenadeCount = document.getElementById('hud-grenade-count');
  const damageVignette = document.getElementById('damage-vignette');

  // Start player facing arena at map spawn
  const initialSpawn = currentMapSpec.spawns[0] ?? { pos: { x: 0, y: 0, z: 12 }, yaw: 0 };
  let currentState: PlayerSimState = createDefaultPlayerState(
    initialSpawn.pos.x,
    initialSpawn.pos.y,
    initialSpawn.pos.z,
  );
  currentState.yaw = (initialSpawn.yaw * Math.PI) / 180;
  let previousState: PlayerSimState = { ...currentState };
  camera.rotation.y = currentState.yaw;
  if (isDebug) {
    window.__playerState = currentState;
  }

  // Live map switcher
  const switchMap = (id: string) => {
    currentMapSpec = getMapSpec(id);
    mapSession = mapLoader.loadMap(currentMapSpec);
    dummies.repositionForMap(currentMapSpec.id);
    const sp = currentMapSpec.spawns[0] ?? { pos: { x: 0, y: 0, z: 12 }, yaw: 0 };
    currentState.x = sp.pos.x;
    currentState.y = sp.pos.y;
    currentState.z = sp.pos.z;
    currentState.vx = 0;
    currentState.vy = 0;
    currentState.vz = 0;
    currentState.yaw = (sp.yaw * Math.PI) / 180;
    previousState = { ...currentState };
    camera.rotation.y = currentState.yaw;
    if (isDebug) {
      window.__mapSession = mapSession;
      window.__mapSpec = currentMapSpec;
    }
  };
  if (isDebug) {
    window.__switchMap = switchMap;
  }

  let currentEyeHeight = PLAYER_EYE_HEIGHT_STAND;
  let tickCount = 0;
  const timestep = createTimestepState(performance.now());
  const pelletBuffer: PelletOffset[] = Array.from({ length: 8 }, () => ({ pitch: 0, yaw: 0 }));

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Fixed-timestep simulation loop with render interpolation
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const { frameDelta, ticksToRun, alpha } = updateAccumulator(timestep, now);

    // Run capped fixed-timestep ticks (guarantees no spiral of death)
    for (let t = 0; t < ticksToRun; t++) {
      previousState = { ...currentState };
      tickCount++;
      const input = inputManager.sampleInput(tickCount);

      currentState = stepPlayer(currentState, input, SIM_TICK_DELTA, physics.collisionWorld);

      // --- Weapon State Machine & Actions ---
      const previousSlotIndex = weaponState.currentSlot;

      // 1. Weapon swap request
      if (input.weaponSlot !== undefined) {
        triggerSwapBySlot(weaponState, input.weaponSlot);
      }

      // 2. Sprint state & reload cancel
      setSprinting(weaponState, currentState.isSprinting);

      // 3. Inspect or Reload request
      if (input.inspect && weaponState.actionState === 'idle') {
        viewmodel.playClip('inspect');
      }
      if (input.reload) {
        triggerReload(weaponState);
      }

      // 4. Advance weapon timers (handles auto-reload, auto-switch, commit ticks, bolt cycles)
      stepWeaponStateMachine(weaponState, SIM_TICK_DELTA, tickCount);

      // If slot changed from manual swap or auto-switch, update viewmodel visual
      if (weaponState.currentSlot !== previousSlotIndex) {
        viewmodel.updateWeaponVisual(getCurrentWeaponDef(weaponState));
      }

      // 5. Fire timing, input buffering & shooting
      const currentDef = getCurrentWeaponDef(weaponState);
      const activeSlot = getCurrentSlot(weaponState);
      const canShoot = isWeaponReadyToFire(weaponState);

      // Buffer fire input if clicked while weapon is busy (e.g. bolt cycling or finishing swap)
      const isFirePressed = Boolean(input.fire);
      updateTriggerState(weaponState, isFirePressed);

      if (isFirePressed && !canShoot) {
        cancelReloadOnFire(weaponState);
        bufferFireInput(weaponState, 6);
      }

      const effectiveCanShoot = isWeaponReadyToFire(weaponState);
      const wantsToFire = canTriggerFire(weaponState, isFirePressed);

      // Step fractional fire accumulator
      stepFireTiming(fireTiming, SIM_TICK_DELTA, currentDef);

      if (wantsToFire && effectiveCanShoot) {
        if (tryConsumeShot(fireTiming, currentDef)) {
          activeSlot.ammoInMag--;
          weaponState.bufferedFireTicks = 0; // Consume buffered fire request
          recordShotFired(weaponState);

          // Audio feedback (procedural Web Audio API)
          weaponAudio.playShot(currentDef.id);

          // Visual muzzle flash billboard at weapon muzzle
          viewmodel.triggerMuzzleFlash(currentDef.id);

          // Recoil kick on viewmodel
          const kickPitch = currentDef.recoil.pattern[0]?.pitch ?? 0.035;
          viewmodel.applyRecoilKick(kickPitch);

          // Shell casing ejection & camera trauma shake
          const ejectionPos = viewmodel.getEjectionWorldPosition();
          combatVfx.spawnShell(ejectionPos, currentDef.id, input.yaw, input.pitch);
          combatVfx.addTrauma(currentDef.id === 'sniper' ? 0.35 : currentDef.id === 'shotgun' ? 0.22 : 0.08);

          // Stance-based spread cone (computeEffectiveSpread returns cone half-angle in radians)
          const hSpeed = Math.hypot(currentState.vx, currentState.vz);
          const spreadRad = computeEffectiveSpread(currentDef, {
            isMoving: hSpeed > 0.5,
            isCrouching: currentState.isCrouching,
            isADS: Boolean(input.ads),
            isSprinting: currentState.isSprinting,
          });

          const muzzlePos = viewmodel.getMuzzleWorldPosition();

          // Shotgun: deterministic seeded pellet dispersion
          if (currentDef.pellets > 1) {
            const seed = hashPlayerShot('local_player', tickCount);
            generateSeededPelletOffsets(spreadRad, seed, pelletBuffer);

            for (let p = 0; p < currentDef.pellets; p++) {
              const pelletOffset = pelletBuffer[p]!;
              const netYaw = input.yaw + pelletOffset.yaw;
              const netPitch = input.pitch + pelletOffset.pitch;

              const cp = Math.cos(netPitch);
              const sp = Math.sin(netPitch);
              const cy = Math.cos(netYaw);
              const sy = Math.sin(netYaw);

              const rayDir: Vec3 = {
                x: -sy * cp,
                y: sp,
                z: -cy * cp,
              };

              const rayOrigin: Vec3 = {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
              };

              const hit = dummies.testRay(rayOrigin, rayDir, currentDef.range);
              const rapierRay = new physics.raw.Ray(
                { x: rayOrigin.x, y: rayOrigin.y, z: rayOrigin.z },
                { x: rayDir.x, y: rayDir.y, z: rayDir.z },
              );
              const worldHit = physics.world.castRayAndGetNormal(rapierRay, currentDef.range, true);

              let hitPoint: Vec3;
              if (hit.hit && hit.hitPoint && (!worldHit || hit.distance <= worldHit.timeOfImpact)) {
                hitPoint = hit.hitPoint;
                const dmg = calculateDamage(currentDef, hit.distance, hit.part === 'head');
                triggerHitMarker(hit.part, dmg);
                dummies.applyHitFeedback(hit.dummyId!, hit.part);
                combatVfx.spawnImpactParticles(hitPoint, { x: -rayDir.x, y: -rayDir.y, z: -rayDir.z }, 'flesh');
                viewmodel.triggerImpact(hitPoint);
              } else if (worldHit && worldHit.timeOfImpact <= currentDef.range) {
                hitPoint = rapierRay.pointAt(worldHit.timeOfImpact);
                decalManager.addBulletHole(hitPoint, worldHit.normal, 'concrete');
                combatVfx.spawnImpactParticles(hitPoint, worldHit.normal, 'concrete');
                viewmodel.triggerImpact(hitPoint);
              } else {
                hitPoint = {
                  x: rayOrigin.x + rayDir.x * 50,
                  y: rayOrigin.y + rayDir.y * 50,
                  z: rayOrigin.z + rayDir.z * 50,
                };
              }
              viewmodel.spawnTracer(muzzlePos, hitPoint, currentDef.id);
            }
          } else {
            // Single bullet weapons (pistol, rifles, sniper)
            const spreadOffset = sampleSpreadOffsets(spreadRad, rng);
            const netYaw = input.yaw + spreadOffset.yawOffset;
            const netPitch = input.pitch + spreadOffset.pitchOffset;

            const cp = Math.cos(netPitch);
            const sp = Math.sin(netPitch);
            const cy = Math.cos(netYaw);
            const sy = Math.sin(netYaw);

            const rayDir: Vec3 = {
              x: -sy * cp,
              y: sp,
              z: -cy * cp,
            };

            const rayOrigin: Vec3 = {
              x: camera.position.x,
              y: camera.position.y,
              z: camera.position.z,
            };

            const hit = dummies.testRay(rayOrigin, rayDir, currentDef.range);
            const rapierRay = new physics.raw.Ray(
              { x: rayOrigin.x, y: rayOrigin.y, z: rayOrigin.z },
              { x: rayDir.x, y: rayDir.y, z: rayDir.z },
            );
            const worldHit = physics.world.castRayAndGetNormal(rapierRay, currentDef.range, true);

            let hitPoint: Vec3;
            if (hit.hit && hit.hitPoint && (!worldHit || hit.distance <= worldHit.timeOfImpact)) {
              hitPoint = hit.hitPoint;
              const dmg = calculateDamage(currentDef, hit.distance, hit.part === 'head');
              triggerHitMarker(hit.part, dmg);
              dummies.applyHitFeedback(hit.dummyId!, hit.part);
              combatVfx.spawnImpactParticles(hitPoint, { x: -rayDir.x, y: -rayDir.y, z: -rayDir.z }, 'flesh');
              viewmodel.triggerImpact(hitPoint);
            } else if (worldHit && worldHit.timeOfImpact <= currentDef.range) {
              hitPoint = rapierRay.pointAt(worldHit.timeOfImpact);
              decalManager.addBulletHole(hitPoint, worldHit.normal, 'concrete');
              combatVfx.spawnImpactParticles(hitPoint, worldHit.normal, 'concrete');
              viewmodel.triggerImpact(hitPoint);
            } else {
              hitPoint = {
                x: rayOrigin.x + rayDir.x * 50,
                y: rayOrigin.y + rayDir.y * 50,
                z: rayOrigin.z + rayDir.z * 50,
              };
            }
            viewmodel.spawnTracer(muzzlePos, hitPoint, currentDef.id);
          }
        }
      }

      // --- Grenade Actions & Vitals Step ---
      if (input.throwGrenade) {
        grenadeManager.requestThrow();
      }
      if (input.cycleGrenade) {
        grenadeManager.cycleType();
      }

      const eyePos: Vec3 = {
        x: currentState.x,
        y: currentState.y + currentEyeHeight,
        z: currentState.z,
      };
      const isSwapping = weaponState.actionState === 'swapping_out' || weaponState.actionState === 'swapping_in';
      grenadeManager.stepTick(
        eyePos,
        input.yaw,
        input.pitch,
        currentState.isSprinting,
        isSwapping,
        dummies.getHitTargets(),
      );

      stepPlayerVitals(playerVitals);
    }

    if (isDebug) {
      window.__playerState = currentState;
    }

    const renderX = previousState.x + (currentState.x - previousState.x) * alpha;
    const renderY = previousState.y + (currentState.y - previousState.y) * alpha;
    const renderZ = previousState.z + (currentState.z - previousState.z) * alpha;

    // Smooth eye height transition for crouching
    const targetEyeHeight = currentState.isCrouching
      ? PLAYER_EYE_HEIGHT_CROUCH
      : PLAYER_EYE_HEIGHT_STAND;
    currentEyeHeight += (targetEyeHeight - currentEyeHeight) * Math.min(1.0, frameDelta * 14);

    // Update cosmetic combat VFX and grenade visuals
    combatVfx.update(frameDelta);
    grenadeManager.update(frameDelta);

    // Apply position & orientation to camera (including trauma screenshake)
    camera.position.set(renderX, renderY + currentEyeHeight, renderZ);
    camera.rotation.set(
      inputManager.pitch + combatVfx.shakePitch,
      inputManager.yaw + combatVfx.shakeYaw,
      combatVfx.shakeRoll,
      'YXZ',
    );

    // Smooth ADS camera FOV zoom
    const activeDef = getCurrentWeaponDef(weaponState);
    const targetFov = inputManager.isAds ? 75 * activeDef.adsFovMultiplier : 75;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov += (targetFov - camera.fov) * Math.min(1.0, frameDelta * 16);
      camera.updateProjectionMatrix();
    }

    // Update viewmodel animations, recoil spring & tracers
    viewmodel.update(frameDelta, inputManager.isAds, weaponState.actionState, currentState.isSprinting);

    // Update target dummies (locomotion, upper/lower layering, aim tracking, hit feedback, death collapse)
    dummies.update(frameDelta);
    dummies.updateAimTracking(camera.position);

    // Update Health & Spawn Protection HUD overlay
    if (hudHealthNum) {
      hudHealthNum.textContent = `${playerVitals.health}`;
    }
    if (hudHealthBar) {
      hudHealthBar.style.width = `${playerVitals.health}%`;
    }
    if (hudSpawnProtection) {
      hudSpawnProtection.style.display = playerVitals.spawnProtectionTicksRemaining > 0 ? 'inline-block' : 'none';
    }
    if (damageVignette) {
      const vignetteIntensity = (1.0 - playerVitals.health / 100) * 0.7;
      damageVignette.style.boxShadow = `inset 0 0 100px rgba(239, 68, 68, ${vignetteIntensity.toFixed(2)})`;
    }

    // Update Grenade HUD overlay
    if (hudGrenadeType) {
      const def = GRENADE_DEFS[grenadeManager.inventory.selectedType];
      hudGrenadeType.textContent = def ? def.name : 'FRAG';
    }
    if (hudGrenadeCount) {
      hudGrenadeCount.textContent = `${grenadeManager.inventory.counts[grenadeManager.inventory.selectedType]}`;
    }

    // Update Player Movement HUD overlay
    if (hudPos) {
      hudPos.textContent = `${currentState.x.toFixed(1)}, ${currentState.y.toFixed(1)}, ${currentState.z.toFixed(1)}`;
    }
    if (hudSpeed) {
      const hSpeed = Math.hypot(currentState.vx, currentState.vz);
      hudSpeed.textContent = `${hSpeed.toFixed(1)} m/s`;
    }
    if (hudState) {
      const parts: string[] = [];
      if (currentState.isGrounded) parts.push('Grounded');
      else parts.push('Air');
      if (currentState.isCrouching) parts.push('Crouch');
      if (currentState.isSprinting) parts.push('Sprint');
      hudState.textContent = parts.join(' | ');
    }

    // Update Weapon HUD overlay
    const activeSlot = getCurrentSlot(weaponState);
    if (hudWeaponName) {
      hudWeaponName.textContent = activeDef.name;
    }
    if (hudAmmoMag) {
      hudAmmoMag.textContent = `${activeSlot.ammoInMag}`;
    }
    if (hudAmmoReserve) {
      hudAmmoReserve.textContent = `${activeSlot.ammoReserve}`;
    }
    if (hudWeaponAction) {
      const isReloading =
        weaponState.actionState === 'reloading_tactical' ||
        weaponState.actionState === 'reloading_empty' ||
        weaponState.actionState === 'reloading_shell' ||
        weaponState.actionState === 'reloading_shell_start' ||
        weaponState.actionState === 'reloading_shell_insert' ||
        weaponState.actionState === 'reloading_shell_end';
      const isCycling = weaponState.actionState === 'cycling_bolt';
      const isSwapping =
        weaponState.actionState === 'swapping_out' ||
        weaponState.actionState === 'swapping_in';

      if (isReloading) {
        hudWeaponAction.textContent = 'RELOADING...';
        hudWeaponAction.style.color = '#f59e0b';
      } else if (isCycling) {
        hudWeaponAction.textContent = 'CYCLING BOLT...';
        hudWeaponAction.style.color = '#c084fc';
      } else if (isSwapping) {
        hudWeaponAction.textContent = 'EQUIPPING...';
        hudWeaponAction.style.color = '#38bdf8';
      } else if (inputManager.isAds) {
        hudWeaponAction.textContent = 'AIMING (ADS)';
        hudWeaponAction.style.color = '#38bdf8';
      } else if (currentState.isSprinting) {
        hudWeaponAction.textContent = 'SPRINTING';
        hudWeaponAction.style.color = '#94a3b8';
      } else if (weaponState.isOutOfAmmo) {
        hudWeaponAction.textContent = 'OUT OF AMMO';
        hudWeaponAction.style.color = '#ef4444';
      } else if (activeSlot.ammoInMag === 0) {
        hudWeaponAction.textContent = 'EMPTY (PRESS R)';
        hudWeaponAction.style.color = '#ef4444';
      } else {
        hudWeaponAction.textContent = 'READY';
        hudWeaponAction.style.color = '#22c55e';
      }
    }

    stats.update();
    const activeCam = (isDebug && (window as unknown as { __debugCamera?: THREE.PerspectiveCamera }).__debugCamera) || debugCamera || camera;
    if (activeCam !== camera) {
      camera.updateMatrixWorld(true);
      const lookTarget = (activeCam.userData && activeCam.userData.target)
        ? (activeCam.userData.target as THREE.Vector3).clone()
        : new THREE.Vector3(0.05, -0.15, -0.32);
      camera.localToWorld(lookTarget);
      activeCam.lookAt(lookTarget);
      renderer.render(scene, activeCam);
    } else {
      // Dual-pass depth-cleared viewmodel rendering (Rule E: avoids wall clipping)
      const vmVisible = viewmodel.group.visible;
      const armsVisible = viewmodel.armsRig.group.visible;

      renderer.autoClear = false;
      renderer.clear();

      // Pass 1: World scene
      viewmodel.group.visible = false;
      viewmodel.armsRig.group.visible = false;
      renderer.render(scene, camera);

      // Pass 2: Viewmodel & Arms rendered on top
      if (vmVisible || armsVisible) {
        renderer.clearDepth();
        viewmodel.group.visible = vmVisible;
        viewmodel.armsRig.group.visible = armsVisible;
        renderer.render(scene, camera);
      }

      renderer.autoClear = true;
    }
  });
}

initApp().catch((err) => {
  console.error('Failed to initialize Mini Arena controller:', err);
  const badge = document.getElementById('renderer-badge');
  if (badge) {
    badge.textContent = 'Error: ' + (err as Error).message;
    badge.className = 'badge';
    badge.style.background = 'rgba(239, 68, 68, 0.2)';
    badge.style.color = '#ef4444';
  }
});
