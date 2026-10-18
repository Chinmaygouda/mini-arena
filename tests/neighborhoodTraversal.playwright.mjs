import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const outputDir = 'artifacts/neighborhood-preview';
await mkdir(outputDir, { recursive: true });

let server;
let browser;
let serverOutput = '';

async function waitForServer(timeoutMs = 20000) {
  const startedAt = Date.now();
  let lastError = 'No response received';
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = String(error);
    }
    await delay(250);
  }
  throw new Error(`Vite server did not become ready: ${lastError}`);
}

async function simulateMovement(page, { position, yaw = Math.PI, keys = ['KeyW'], frames }) {
  return page.evaluate(({ position, yaw, keys, frames }) => {
    const app = window.__fpsApp;
    if (!app?.controls) throw new Error('FPS controls are not exposed by the running app');
    const controls = app.controls;
    controls.forceReleaseKeys();
    controls.setPosition(position.x, position.y, position.z, yaw);
    for (const code of keys) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    }
    for (let frame = 0; frame < frames; frame++) {
      controls.update(1 / 60);
    }
    for (const code of keys) {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    }
    controls.forceReleaseKeys();
    return {
      x: controls.position.x,
      eyeY: controls.position.y,
      feetY: controls.position.y - 1.7,
      z: controls.position.z,
      grounded: controls.isGrounded,
      horizontalSpeed: controls.getHorizontalSpeed(),
      collidingCount: controls.getCollidingCount(),
    };
  }, { position, yaw, keys, frames });
}

try {
  // Launch in a separate process group so Vite's child process can be stopped
  // along with npm in finally; otherwise the child can keep the test runner alive.
  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
    detached: process.platform !== 'win32',
  });
    server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
  server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
  server.on('error', error => { serverOutput += String(error); });
  await waitForServer();

  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto(`${baseUrl}/?map=neighborhood&quality=low`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const app = window.__fpsApp;
    return app?.mapLoader?.currentMapId === 'neighborhood' &&
      Array.isArray(app?.controls?.colliders) &&
      app.controls.colliders.length > 100;
  }, null, { timeout: 20000 });
  await page.waitForTimeout(500);
  // Dismiss the game's intro overlay so the screenshots show the actual rendered scene.
  await page.evaluate(() => {
    const engage = document.querySelector('#btn-engage');
    if (engage instanceof HTMLElement) engage.click();
  });
  await page.waitForTimeout(250);
  console.log('Neighborhood map loaded in Chromium; intro dismissed; capturing spawn view.');
  await page.screenshot({ path: `${outputDir}/01-neighborhood-spawn.png`, fullPage: true });

  // Capture Maple House from its street frontage so the report includes the real building,
  // not only the long-range spawn view.
  await page.evaluate(() => {
    const controls = window.__fpsApp.controls;
    controls.forceReleaseKeys();
    controls.setPosition(-24, 3.5, -11.5, 0);
    controls.update(0);
  });
  await page.screenshot({ path: `${outputDir}/02-maple-front-exterior.png`, fullPage: true });

  // Enter Maple House from the street through the front gate, porch and main door.
  const doorEntry = await simulateMovement(page, {
    position: { x: -24.0, y: 1.7, z: -15.5 },
    yaw: 0,
    keys: ['KeyW'],
    frames: 90,
  });
  assert.ok(doorEntry.z < -21.2,
    `Player did not enter through the front doorway (z=${doorEntry.z.toFixed(2)})`);
  assert.equal(doorEntry.collidingCount, 0,
    'Front-door entry should end in clear interior space');
  await page.evaluate(({ doorEntry }) => {
    const controls = window.__fpsApp.controls;
    controls.forceReleaseKeys();
    controls.setPosition(doorEntry.x, doorEntry.eyeY, doorEntry.z, 0);
    controls.update(0);
  }, { doorEntry });
  await page.screenshot({ path: `${outputDir}/03-maple-door-entry.png`, fullPage: true });
  console.log('Door entry passed:', JSON.stringify(doorEntry));

  // Leave through the same door and step sequence; this verifies the route is bidirectional.
  const doorExit = await simulateMovement(page, {
    position: { x: -24.0, y: 1.7, z: doorEntry.z },
    yaw: Math.PI,
    keys: ['KeyW'],
    frames: 90,
  });
  assert.ok(doorExit.z > -19.0,
    `Player did not exit through the front doorway (z=${doorExit.z.toFixed(2)})`);
  assert.equal(doorExit.collidingCount, 0,
    'Front-door exit should finish in clear garden/street space');
  await page.evaluate(({ doorExit }) => {
    const controls = window.__fpsApp.controls;
    controls.forceReleaseKeys();
    controls.setPosition(doorExit.x, doorExit.eyeY, doorExit.z, 0);
    controls.update(0);
  }, { doorExit });
  await page.screenshot({ path: `${outputDir}/04-maple-door-exit.png`, fullPage: true });
  console.log('Door exit passed:', JSON.stringify(doorExit));

  // Stair origin: house center (-24, -25.5) + local stair start (-4.2, -3.8).
  // Walk forward toward +Z; a successful run should reach the upper floor and stay grounded.
  const stair = await simulateMovement(page, {
    position: { x: -28.2, y: 1.7, z: -29.3 },
    yaw: Math.PI,
    keys: ['KeyW'],
    frames: 85,
  });
  await page.waitForTimeout(100);
  // Face back into the house after reaching the upper floor, looking along the
  // staircase instead of straight out through the adjacent window.
  await page.evaluate(({ stair }) => {
    const controls = window.__fpsApp.controls;
    controls.forceReleaseKeys();
    controls.setPosition(stair.x, stair.eyeY, stair.z, 0);
    controls.update(0);
  }, { stair });
  await page.screenshot({ path: `${outputDir}/05-maple-stair-climb.png`, fullPage: true });
  assert.ok(stair.z > -25.5, `Player did not advance up the stair run (z=${stair.z.toFixed(2)})`);
  assert.ok(stair.feetY >= 3.0 && stair.feetY <= 3.45,
    `Player did not settle on the upper floor (feetY=${stair.feetY.toFixed(2)})`);
  assert.ok(stair.grounded, 'Player should be grounded after climbing onto the upper floor');
  console.log('Stair traversal passed:', JSON.stringify(stair));

  // Ground-floor south window at x=-28. Start just inside the facade and jump forward.
  const windowExit = await simulateMovement(page, {
    position: { x: -28.0, y: 1.7, z: -21.2 },
    yaw: Math.PI,
    keys: ['KeyW', 'Space'],
    frames: 30,
  });
  await page.waitForTimeout(100);
  // Face back toward the actual window opening from the outside garden.
  await page.evaluate(({ windowExit }) => {
    const controls = window.__fpsApp.controls;
    controls.forceReleaseKeys();
    controls.setPosition(windowExit.x, windowExit.eyeY, windowExit.z, 0);
    controls.update(0);
  }, { windowExit });
  await page.screenshot({ path: `${outputDir}/06-maple-window-jump.png`, fullPage: true });
  assert.ok(windowExit.z > -20.4,
    `Player did not pass through the south window opening (z=${windowExit.z.toFixed(2)})`);
  assert.equal(windowExit.collidingCount, 0,
    'Player should exit into clear garden space, not land against a planter or fence');
  console.log('Window jump passed:', JSON.stringify(windowExit));

  // Center of the balcony's 2.2m jump-out gap. A forward jump should clear the deck edge.
  const balconyJump = await simulateMovement(page, {
    position: { x: -24.0, y: 4.9, z: -19.7 },
    yaw: Math.PI,
    keys: ['KeyW', 'Space'],
    frames: 24,
  });
  await page.waitForTimeout(100);
  // Face the house while still just clear of the terrace's central exit gap.
  await page.evaluate(({ balconyJump }) => {
    const controls = window.__fpsApp.controls;
    controls.forceReleaseKeys();
    controls.setPosition(balconyJump.x, balconyJump.eyeY, balconyJump.z, 0);
    controls.update(0);
  }, { balconyJump });
  await page.screenshot({ path: `${outputDir}/07-maple-balcony-jump.png`, fullPage: true });
  assert.ok(balconyJump.z > -18.25,
    `Player did not clear the balcony deck edge (z=${balconyJump.z.toFixed(2)})`);
  assert.ok(balconyJump.feetY > 3.2,
    'Balcony jump should initially leave the terrace while airborne');

  assert.deepEqual(pageErrors, [], `Browser runtime errors: ${pageErrors.join('; ')}`);
  console.log(JSON.stringify({
    ok: true,
    map: 'neighborhood',
    stairClimb: stair,
    windowJump: windowExit,
    balconyJump,
    screenshots: [
      `${outputDir}/01-neighborhood-spawn.png`,
      `${outputDir}/02-maple-front-exterior.png`,
      `${outputDir}/03-maple-door-entry.png`,
      `${outputDir}/04-maple-door-exit.png`,
      `${outputDir}/05-maple-stair-climb.png`,
      `${outputDir}/06-maple-window-jump.png`,
      `${outputDir}/07-maple-balcony-jump.png`,
    ],
  }, null, 2));
} catch (error) {
  console.error('Neighborhood browser traversal test failed.');
  console.error(error);
  if (server) {
    console.error('Vite output:\n' + (serverOutputForDebug()));
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server?.pid) {
    try {
      if (process.platform !== 'win32') {
        // spawn({ detached: true }) makes the child's PID the process-group ID on POSIX.
        process.kill(-server.pid, 'SIGTERM');
      } else if (!server.killed) {
        server.kill('SIGTERM');
      }
    } catch {
      // The process group may already have exited after Vite shutdown.
    }
  }
}

function serverOutputForDebug() {
  // Vite output is intentionally only included in failure reports.
  return typeof serverOutput === 'string' ? serverOutput.slice(-4000) : 'No Vite output captured';
}
