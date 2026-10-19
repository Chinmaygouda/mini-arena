import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = 'artifacts/warehouse-layout';
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1440 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/?map=warehouse&quality=low&time=overcast`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const app = window.__fpsApp;
    return app?.mapLoader?.currentMapId === 'warehouse' &&
      Array.isArray(app?.controls?.colliders) &&
      app.controls.colliders.length === 66;
  }, null, { timeout: 20000 });

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
  assert.equal(runtime.colliderCount, 66, 'the collision set should contain only the 66 wall segments');
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
      camera.position.set(0, 88, 0);
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
  await page.screenshot({ path: `${outputDir}/01-warehouse-layout-topdown.png`, fullPage: true });

  // Return to the real player camera for a first-person sanity screenshot.
  await page.evaluate(() => {
    const app = window.__fpsApp;
    const controls = app.controls;
    controls.update = controls.__warehouseOriginalUpdate;
    delete controls.__warehouseOriginalUpdate;
    controls.forceReleaseKeys();
    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = true;
    controls.pitch = 0;
    controls.setPosition(0, 1.7, -39.5, Math.PI);
    controls.update(1 / 60);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outputDir}/02-warehouse-team-b-spawn.png`, fullPage: true });

  assert.deepEqual(pageErrors, [], `Browser runtime errors: ${pageErrors.join('; ')}`);
  console.log(JSON.stringify({
    ok: true,
    map: runtime.mapId,
    runtime,
    browserErrors: pageErrors.length,
    screenshots: [
      `${outputDir}/01-warehouse-layout-topdown.png`,
      `${outputDir}/02-warehouse-team-b-spawn.png`,
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
