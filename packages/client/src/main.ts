import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import Stats from 'stats-gl';

declare global {
  interface Window {
    __renderer?: 'webgpu' | 'webgl2';
  }
}

async function initApp(): Promise<void> {
  const container = document.getElementById('canvas-container');
  if (!container) throw new Error('Canvas container not found');

  const badge = document.getElementById('renderer-badge');

  // Parse forceWebGL query parameter: accepts ?forceWebGL, ?forceWebGL=true, ?forceWebGL=1
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

  // Initialize renderer asynchronously (mandatory for WebGPU)
  await renderer.init();

  // Inspect actual active backend
  const isWebGPU =
    'isWebGPUBackend' in renderer.backend &&
    (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
  const backendName: 'webgpu' | 'webgl2' = isWebGPU ? 'webgpu' : 'webgl2';

  // Expose on window for Playwright E2E and automated testing
  window.__renderer = backendName;

  // Update HUD badge
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

  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f12);

  const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 3, 6);
  camera.lookAt(0, 1, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xf43f5e, 0.6);
  fillLight.position.set(-5, 6, -5);
  scene.add(fillLight);

  // Floor grid
  const gridHelper = new THREE.GridHelper(30, 30, 0x38bdf8, 0x1e293b);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Rotating central test cube
  const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const material = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.3,
    metalness: 0.8,
  });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(0, 1.2, 0);
  scene.add(cube);

  // Window resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Render loop
  let lastTime = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    cube.rotation.x += delta * 0.5;
    cube.rotation.y += delta * 0.8;

    stats.update();
    renderer.render(scene, camera);
  });
}

initApp().catch((err) => {
  console.error('Failed to initialize Mini Arena client:', err);
  const badge = document.getElementById('renderer-badge');
  if (badge) {
    badge.textContent = 'Error: ' + (err as Error).message;
    badge.className = 'badge';
    badge.style.background = 'rgba(239, 68, 68, 0.2)';
    badge.style.color = '#ef4444';
  }
});
