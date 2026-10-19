import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = 'artifacts/warehouse-section-1';
await mkdir(outputDir, { recursive: true });

let server;
let browser;
let serverOutput = '';

async function waitForServer(timeoutMs = 20000) {
  const started = Date.now();
  let lastError = 'no response';
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = String(error);
    }
    await delay(250);
  }
  throw new Error(`Vite did not start: ${lastError}`);
}

try {
  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
    detached: process.platform !== 'win32',
  });
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.on('error', (error) => { serverOutput += String(error); });
  await waitForServer();

  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/?map=warehouse&quality=low&time=overcast`, { waitUntil: 'domcontentloaded' });
  const layoutResponse = await page.request.get(`${baseUrl}/maps/warehouse_layout.json`);
  assert.ok(layoutResponse.ok(), 'warehouse layout JSON should be reachable');
  const expectedLayout = await layoutResponse.json();
  const expectedColliderCount = expectedLayout.boxes.filter((box) =>
    box.kind !== 'roof' && box.collision !== false
  ).length;
  await page.waitForFunction((expectedColliderCount) => {
    const app = window.__fpsApp;
    return app?.mapLoader?.currentMapId === 'warehouse' &&
      Array.isArray(app?.controls?.colliders) &&
      app.controls.colliders.length === expectedColliderCount;
  }, expectedColliderCount, { timeout: 20000 });

  // Engage the actual game before screenshots; otherwise the intro overlay masks the player view.
  await page.evaluate(() => {
    const engage = document.querySelector('#btn-engage');
    if (engage instanceof HTMLElement) engage.click();
  });
  await page.waitForTimeout(250);

  const runtime = await page.evaluate(() => {
    const app = window.__fpsApp;
    const fixtureNames = [];
    app.scene.traverse((object) => {
      if (object.name?.startsWith('warehouse-fixture-')) fixtureNames.push(object.name);
    });
    return {
      mapId: app.mapLoader.currentMapId,
      colliderCount: app.controls.colliders.length,
      loadedBuildingCount: app.mapLoader.loadedBuildings.length,
      fixtureCount: fixtureNames.length,
      bounds: app.controls.bounds,
    };
  });
  assert.equal(runtime.mapId, 'warehouse');
  assert.equal(runtime.colliderCount, expectedColliderCount, 'only collision-enabled map geometry should create colliders');
  assert.equal(runtime.loadedBuildingCount, 0, 'stage one should contain no building models');
  assert.equal(runtime.fixtureCount, 16, 'the 4x4 lighting grid should render 16 fixtures');
  assert.equal(runtime.bounds.minX, -46);
  assert.equal(runtime.bounds.maxX, 46);
  assert.equal(runtime.bounds.minZ, -46);
  assert.equal(runtime.bounds.maxZ, 46);

  await page.evaluate(() => {
    const app = window.__fpsApp;
    const camera = app.camera;
    const controls = app.controls;
    controls.forceReleaseKeys();
    controls.__warehouseOriginalUpdate = controls.update.bind(controls);
    controls.update = () => {
      camera.position.set(0, 130, 0);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);
      camera.fov = 45;
      camera.updateProjectionMatrix();
    };
    // Hide the first-person weapon model only during the overhead layout evidence capture.
    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = false;
    const hud = document.querySelector('#fps-hud');
    if (hud instanceof HTMLElement) hud.style.display = 'none';
    const intro = document.querySelector('#instructions-overlay');
    if (intro instanceof HTMLElement) intro.style.display = 'none';
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outputDir}/01-warehouse-layout-topdown.png`, fullPage: false, timeout: 60000, animations: 'disabled' });

  // Zoom into Section 1 so its four rack runs, pallet bases and crate loads can be inspected.
  await page.evaluate(() => {
    const app = window.__fpsApp;
    const camera = app.camera;
    const controls = app.controls;
    controls.__warehouseSectionUpdate = controls.update;
    controls.update = () => {
      camera.position.set(22, 48, 20);
      camera.up.set(0, 0, 1);
      camera.lookAt(22, 0, 20);
      camera.fov = 43;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${outputDir}/02-warehouse-section-1-racks.png`, fullPage: false, timeout: 60000, animations: 'disabled' });

  // Return to the real player camera and capture rack visibility from the spawn lane.
  await page.evaluate(() => {
    const app = window.__fpsApp;
    const controls = app.controls;
    controls.update = controls.__warehouseOriginalUpdate;
    delete controls.__warehouseOriginalUpdate;
    delete controls.__warehouseSectionUpdate;
    controls.forceReleaseKeys();
    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = true;
    controls.pitch = 0;
    controls.setPosition(22, 1.7, 11.5, Math.PI);
    controls.update(1 / 60);
    const hud = document.querySelector('#fps-hud');
    if (hud instanceof HTMLElement) hud.style.display = '';
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outputDir}/03-warehouse-section-1-first-person.png`, fullPage: false, timeout: 60000, animations: 'disabled' });

  assert.deepEqual(pageErrors, [], `Browser runtime errors: ${pageErrors.join('; ')}`);
  console.log(JSON.stringify({
    ok: true,
    map: runtime.mapId,
    runtime,
    browserErrors: pageErrors.length,
    screenshots: [
      `${outputDir}/01-warehouse-layout-topdown.png`,
      `${outputDir}/02-warehouse-section-1-racks.png`,
      `${outputDir}/03-warehouse-section-1-first-person.png`,
    ],
  }, null, 2));
} catch (error) {
  console.error('Warehouse layout browser verification failed.');
  console.error(error);
  console.error('Vite output:\\n' + serverOutput.slice(-4000));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server?.pid) {
    try {
      if (process.platform !== 'win32') process.kill(-server.pid, 'SIGTERM');
      else if (!server.killed) server.kill('SIGTERM');
    } catch {
      // Process group may already have exited.
    }
  }
}
