import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = 'artifacts/warehouse-section-2-redesign';
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

async function moveSegment(page, from, to, routeName) {
  const result = await page.evaluate(({ from, to }) => {
    const app = window.__fpsApp;
    const controls = app?.controls;
    if (!controls) throw new Error('FPS controls are unavailable');
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (Math.abs(dx) > 0.001 && Math.abs(dz) > 0.001) {
      throw new Error('Movement helper requires axis-aligned waypoints');
    }
    const yaw = Math.abs(dx) > 0.001
      ? (dx > 0 ? -Math.PI / 2 : Math.PI / 2)
      : (dz > 0 ? Math.PI : 0);
    controls.forceReleaseKeys();
    controls.setPosition(from.x, 1.7, from.z, yaw);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    const axis = Math.abs(dx) > 0.001 ? 'x' : 'z';
    const target = axis === 'x' ? to.x : to.z;
    const start = axis === 'x' ? from.x : from.z;
    const direction = Math.sign(target - start);
    const maxFrames = Math.ceil(Math.abs(target - start) * 60 / 4.8) + 150;
    let reached = false;
    for (let frame = 0; frame < maxFrames; frame++) {
      controls.update(1 / 60);
      const value = axis === 'x' ? controls.position.x : controls.position.z;
      if (direction > 0 ? value >= target - 0.03 : value <= target + 0.03) {
        reached = true;
        break;
      }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
    controls.forceReleaseKeys();
    return {
      reached,
      from,
      to,
      final: {
        x: controls.position.x,
        z: controls.position.z,
        eyeY: controls.position.y,
      },
      requiredDistance: Math.abs(target - start),
      actualDistance: Math.abs((axis === 'x' ? controls.position.x : controls.position.z) - start),
      grounded: controls.isGrounded,
      collidingCount: controls.getCollidingCount(),
    };
  }, { from, to });
  assert.ok(
    result.reached,
    `${routeName}: player stalled before waypoint ${JSON.stringify(to)}; final=${JSON.stringify(result.final)}`
  );
  assert.ok(
    result.actualDistance >= result.requiredDistance - 0.15,
    `${routeName}: actual travel ${result.actualDistance.toFixed(2)}m is shorter than expected ${result.requiredDistance.toFixed(2)}m`
  );
  return { route: routeName, ...result };
}

async function runRoute(page, name, points) {
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    segments.push(await moveSegment(page, points[i - 1], points[i], `${name} segment ${i}`));
  }
  return { name, segments };
}

async function runJumpCheck(page, name, start) {
  const result = await page.evaluate(({ start }) => {
    const controls = window.__fpsApp?.controls;
    if (!controls) throw new Error('FPS controls are unavailable');
    controls.forceReleaseKeys();
    controls.setPosition(start.x, 1.7, start.z, Math.PI);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    for (let frame = 0; frame < 72; frame++) controls.update(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
    controls.forceReleaseKeys();
    return {
      start,
      final: { x: controls.position.x, z: controls.position.z, eyeY: controls.position.y },
      forwardTravel: controls.position.z - start.z,
      grounded: controls.isGrounded,
      collidingCount: controls.getCollidingCount(),
    };
  }, { start });
  assert.ok(result.forwardTravel > 1.5, `${name}: jump/movement stalled; result=${JSON.stringify(result)}`);
  assert.ok(result.grounded, `${name}: player did not land back on the floor`);
  assert.ok(Math.abs(result.final.eyeY - 1.7) < 0.2, `${name}: unexpected landing eye height ${result.final.eyeY}`);
  return { name, ...result };
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

  // Exercise six real controller paths through Section 1. Each leg stops at its
  // waypoint or fails if collision geometry prevents reaching it.
  const routeResults = [];
  routeResults.push(await runRoute(page, 'Route 1 — enter south doorway and traverse Aisle 1', [
    { x: 15.0, z: 6.0 },
    { x: 15.0, z: 12.0 },
    { x: 16.8, z: 12.0 },
    { x: 16.8, z: 27.0 },
  ]));
  routeResults.push(await runRoute(page, 'Route 2 — north rack-end connector into Aisle 2', [
    { x: 16.8, z: 27.0 },
    { x: 22.8, z: 27.0 },
  ]));
  routeResults.push(await runRoute(page, 'Route 3 — traverse Aisle 2 and round Rack 3 south end', [
    { x: 22.8, z: 27.0 },
    { x: 22.8, z: 12.0 },
    { x: 28.8, z: 12.0 },
  ]));
  routeResults.push(await runRoute(page, 'Route 4 — traverse Aisle 3 and reach east service lane', [
    { x: 28.8, z: 12.0 },
    { x: 28.8, z: 27.0 },
    { x: 33.4, z: 27.0 },
  ]));
  routeResults.push(await runRoute(page, 'Route 5 — walk full length of west inner aisle', [
    { x: 15.0, z: 13.5 },
    { x: 11.8, z: 13.5 },
    { x: 11.8, z: 28.0 },
  ]));
  routeResults.push(await runRoute(page, 'Route 6 — exit through west doorway into central corridor', [
    { x: 11.8, z: 24.5 },
    { x: 0.0, z: 24.5 },
  ]));

  const jumpResults = [];
  jumpResults.push(await runJumpCheck(page, 'Section 1 jump beside rack upright', { x: 14.88, z: 15.0 }));
  jumpResults.push(await runJumpCheck(page, 'Section 1 jump beside crate load', { x: 14.88, z: 16.0 }));

  const section2RouteResults = [];
  section2RouteResults.push(await runRoute(page, 'Section 2 Route 1 — enter cross-rack loading bay', [
    { x: -8.8, z: 14.0 }, { x: -30.0, z: 14.0 },
  ]));
  section2RouteResults.push(await runRoute(page, 'Section 2 Route 2 — lower cross-rack aisle', [
    { x: -30.0, z: 14.0 }, { x: -30.0, z: 17.4 },
  ]));
  section2RouteResults.push(await runRoute(page, 'Section 2 Route 3 — west cross-aisle around rack ends', [
    { x: -30.0, z: 17.4 }, { x: -14.0, z: 17.4 },
  ]));
  section2RouteResults.push(await runRoute(page, 'Section 2 Route 4 — move into upper aisle', [
    { x: -14.0, z: 17.4 }, { x: -13.6, z: 17.4 }, { x: -13.6, z: 20.6 },
  ]));
  section2RouteResults.push(await runRoute(page, 'Section 2 Route 5 — upper aisle to the inner doorway approach', [
    { x: -13.6, z: 20.6 }, { x: -8.8, z: 20.6 }, { x: -11.8, z: 20.6 }, { x: -11.8, z: 24.5 },
  ]));
  section2RouteResults.push(await runRoute(page, 'Section 2 Route 6 — pass through the intended inner doorway to central corridor', [
    { x: -11.8, z: 24.5 }, { x: 0.0, z: 24.5 },
  ]));
  const section2JumpResults = [];
  section2JumpResults.push(await runJumpCheck(page, 'Section 2 jump beside cross-rack upright', { x: -29.3, z: 12.8 }));
  section2JumpResults.push(await runJumpCheck(page, 'Section 2 jump beside cross-rack crate', { x: -31.15, z: 12.7 }));

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

  // Capture Section 2 at the same scale for a direct mirrored-layout comparison.
  await page.evaluate(() => {
    const app = window.__fpsApp;
    const camera = app.camera;
    const controls = app.controls;
    controls.update = () => {
      camera.position.set(-22, 48, 20);
      camera.up.set(0, 0, 1);
      camera.lookAt(-22, 0, 20);
      camera.fov = 43;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${outputDir}/03-warehouse-section-2-racks.png`, fullPage: false, timeout: 60000, animations: 'disabled' });

  // Angled view of the forklift, marked parking bay and loading-bay props.
  await page.evaluate(() => {
    const app = window.__fpsApp;
    const camera = app.camera;
    const controls = app.controls;
    controls.update = () => {
      camera.position.set(-39.0, 6.2, 22.3);
      camera.up.set(0, 1, 0);
      camera.lookAt(-40.0, 0.95, 17.5);
      camera.fov = 48;
      camera.updateProjectionMatrix();
    };
    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = false;
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${outputDir}/04-warehouse-section-2-forklift-detail.png`, fullPage: false, timeout: 60000, animations: 'disabled' });

  // Return to player controls and capture the redesigned Section 2 at eye level.
  await page.evaluate(() => {
    const app = window.__fpsApp;
    const controls = app.controls;
    controls.update = controls.__warehouseOriginalUpdate;
    delete controls.__warehouseOriginalUpdate;
    delete controls.__warehouseSectionUpdate;
    controls.forceReleaseKeys();
    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = true;
    controls.pitch = 0;
    controls.setPosition(-34.0, 1.7, 17.5, Math.PI / 2);
    controls.update(1 / 60);
    const hud = document.querySelector('#fps-hud');
    if (hud instanceof HTMLElement) hud.style.display = '';
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outputDir}/05-warehouse-section-2-first-person.png`, fullPage: false, timeout: 60000, animations: 'disabled' });

  assert.deepEqual(pageErrors, [], `Browser runtime errors: ${pageErrors.join('; ')}`);
  console.log(JSON.stringify({
    ok: true,
    map: runtime.mapId,
    runtime,
    routeCount: routeResults.length,
    routeResults,
    jumpResults,
    section2RouteCount: section2RouteResults.length,
    section2RouteResults,
    section2JumpResults,
    browserErrors: pageErrors.length,
    screenshots: [
      `${outputDir}/01-warehouse-layout-topdown.png`,
      `${outputDir}/02-warehouse-section-1-racks.png`,
      `${outputDir}/03-warehouse-section-2-racks.png`,
      `${outputDir}/04-warehouse-section-2-forklift-detail.png`,
      `${outputDir}/05-warehouse-section-2-first-person.png`,
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
