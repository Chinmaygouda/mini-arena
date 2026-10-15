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
} from '@mini-arena/shared';
import { initPhysics, PhysicsEngine } from './physics';
import { InputManager } from './input';
import { buildGreyboxArena } from './arena';
import { TargetDummyManager } from './dummies';
import { triggerHitMarker, WeaponViewmodel } from './viewmodel';

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
  const isDebug = import.meta.env.DEV || url.searchParams.has('debug');

  // Three.js WebGPURenderer with automatic WebGL2 fallback
  const renderer = new WebGPURenderer({
    antialias: true,
    forceWebGL,
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    0.05,
    500,
  );
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  if (isDebug) {
    window.__camera = camera;
  }

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
  sunLight.position.set(15, 25, 10);
  scene.add(sunLight);

  const bounceLight = new THREE.DirectionalLight(0xf43f5e, 0.4);
  bounceLight.position.set(-15, 10, -10);
  scene.add(bounceLight);

  // Build the greybox arena with geometry + Rapier colliders
  buildGreyboxArena(scene, physics.world);

  // Target dummies in the arena
  const dummies = new TargetDummyManager(scene);
  if (isDebug) {
    window.__dummies = dummies;
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

  // HUD elements for weapons
  const hudWeaponName = document.getElementById('hud-weapon-name');
  const hudAmmoMag = document.getElementById('hud-ammo-mag');
  const hudAmmoReserve = document.getElementById('hud-ammo-reserve');
  const hudWeaponAction = document.getElementById('hud-weapon-action');

  // Start player facing arena
  let currentState: PlayerSimState = createDefaultPlayerState(0, 0, 12);
  let previousState: PlayerSimState = { ...currentState };
  if (isDebug) {
    window.__playerState = currentState;
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
      if (input.fire && !canShoot) {
        cancelReloadOnFire(weaponState);
        bufferFireInput(weaponState, 6);
      }

      const effectiveCanShoot = isWeaponReadyToFire(weaponState);
      const wantsToFire = Boolean(input.fire || weaponState.bufferedFireTicks > 0);

      // Step fractional fire accumulator
      stepFireTiming(fireTiming, SIM_TICK_DELTA, currentDef);

      if (wantsToFire && effectiveCanShoot) {
        if (tryConsumeShot(fireTiming, currentDef)) {
          activeSlot.ammoInMag--;
          weaponState.bufferedFireTicks = 0; // Consume buffered fire request
          recordShotFired(weaponState);

          // Recoil kick on viewmodel
          const kickPitch = currentDef.recoil.pattern[0]?.pitch ?? 0.035;
          viewmodel.applyRecoilKick(kickPitch);

          // Stance-based spread cone
          const hSpeed = Math.hypot(currentState.vx, currentState.vz);
          const spreadDeg = computeEffectiveSpread(currentDef, {
            isMoving: hSpeed > 0.5,
            isCrouching: currentState.isCrouching,
            isADS: Boolean(input.ads),
            isSprinting: currentState.isSprinting,
          });
          const spreadRad = (spreadDeg * Math.PI) / 180;

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
              let hitPoint: Vec3;
              if (hit.hit && hit.hitPoint) {
                hitPoint = hit.hitPoint;
                const dmg = calculateDamage(currentDef, hit.distance, hit.part === 'head');
                triggerHitMarker(hit.part, dmg);
              } else {
                hitPoint = {
                  x: rayOrigin.x + rayDir.x * 50,
                  y: rayOrigin.y + rayDir.y * 50,
                  z: rayOrigin.z + rayDir.z * 50,
                };
              }
              viewmodel.spawnTracer(muzzlePos, hitPoint);
            }
          } else {
            // Single bullet weapons (pistol, rifles, sniper)
            const spreadOffset = sampleSpreadOffsets(spreadDeg, rng);
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
            let hitPoint: Vec3;
            if (hit.hit && hit.hitPoint) {
              hitPoint = hit.hitPoint;
              const dmg = calculateDamage(currentDef, hit.distance, hit.part === 'head');
              triggerHitMarker(hit.part, dmg);
            } else {
              hitPoint = {
                x: rayOrigin.x + rayDir.x * 50,
                y: rayOrigin.y + rayDir.y * 50,
                z: rayOrigin.z + rayDir.z * 50,
              };
            }
            viewmodel.spawnTracer(muzzlePos, hitPoint);
          }
        }
      }
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

    // Apply position & orientation to camera
    camera.position.set(renderX, renderY + currentEyeHeight, renderZ);
    camera.rotation.set(inputManager.pitch, inputManager.yaw, 0, 'YXZ');

    // Smooth ADS camera FOV zoom
    const activeDef = getCurrentWeaponDef(weaponState);
    const targetFov = inputManager.isAds ? 75 * activeDef.adsFovMultiplier : 75;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov += (targetFov - camera.fov) * Math.min(1.0, frameDelta * 16);
      camera.updateProjectionMatrix();
    }

    // Update viewmodel animations, recoil spring & tracers
    viewmodel.update(frameDelta, inputManager.isAds, weaponState.actionState);

    // Update target dummies (locomotion, upper/lower layering, aim tracking, hit feedback, death collapse)
    dummies.update(frameDelta);
    dummies.updateAimTracking(camera.position);

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
      hudAmmoReserve.textContent = `/ ${activeSlot.ammoReserve}`;
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
        hudWeaponAction.textContent = 'SWAPPING...';
        hudWeaponAction.style.color = '#38bdf8';
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
    renderer.render(scene, camera);
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
