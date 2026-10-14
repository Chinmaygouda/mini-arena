import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import Stats from 'stats-gl';
import {
  createDefaultPlayerState,
  PLAYER_EYE_HEIGHT_CROUCH,
  PLAYER_EYE_HEIGHT_STAND,
  PlayerSimState,
  SIM_TICK_DELTA,
  stepPlayer,
} from '@mini-arena/shared';
import { initPhysics, PhysicsEngine } from './physics';
import { InputManager } from './input';
import { buildGreyboxArena } from './arena';

declare global {
  interface Window {
    __renderer?: 'webgpu' | 'webgl2';
    __playerState?: PlayerSimState;
    __inputManager?: InputManager;
    __physics?: PhysicsEngine;
    __fps?: number;
  }
}

async function initApp(): Promise<void> {
  const container = document.getElementById('canvas-container');
  if (!container) throw new Error('Canvas container not found');

  const badge = document.getElementById('renderer-badge');
  const hudPos = document.getElementById('hud-pos');
  const hudSpeed = document.getElementById('hud-speed');
  const hudState = document.getElementById('hud-state');

  // Parse forceWebGL query parameter
  const url = new URL(window.location.href);
  const forceWebGL =
    url.searchParams.has('forceWebGL') &&
    url.searchParams.get('forceWebGL') !== 'false' &&
    url.searchParams.get('forceWebGL') !== '0';

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
  window.__renderer = backendName;

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
  window.__physics = physics;

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

  // Input manager
  const inputManager = new InputManager(container);
  window.__inputManager = inputManager;

  // Start player facing arena
  let currentState: PlayerSimState = createDefaultPlayerState(0, 0, 12);
  let previousState: PlayerSimState = { ...currentState };
  window.__playerState = currentState;

  let currentEyeHeight = PLAYER_EYE_HEIGHT_STAND;
  let tickCount = 0;
  let accumulator = 0;
  let lastTime = performance.now();

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Fixed-timestep simulation loop with render interpolation
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const frameDelta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    accumulator += frameDelta;

    // Fixed 60 Hz physics ticks
    while (accumulator >= SIM_TICK_DELTA) {
      previousState = { ...currentState };
      tickCount++;
      const input = inputManager.sampleInput(tickCount);

      currentState = stepPlayer(currentState, input, SIM_TICK_DELTA, physics.collisionWorld);
      accumulator -= SIM_TICK_DELTA;
    }

    window.__playerState = currentState;

    // Interpolation factor between previous state and current state [0, 1]
    const alpha = accumulator / SIM_TICK_DELTA;

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

    // Update HUD overlay
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
