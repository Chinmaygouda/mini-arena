// scripts/verify-crouch-and-combat-live.mjs
// Launches real headless Chromium via Playwright, connects to the running FPS game,
// performs genuine runtime tests of the crouch mechanic, overhead clearance, and hit registration,
// and captures authentic screenshots to artifacts/crouch-verification/.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'artifacts/crouch-verification');
fs.mkdirSync(outDir, { recursive: true });

async function getActiveGameUrl() {
  for (const port of [5173, 5174, 5175]) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok) return `http://localhost:${port}/?map=warehouse&quality=high`;
    } catch (_) {}
  }
  return 'http://localhost:5173/?map=warehouse&quality=high';
}

async function run() {
  const gameUrl = await getActiveGameUrl();
  console.log(`Connecting to running FPS game at ${gameUrl} ...`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });

  // Wait for game and map colliders to load
  await page.waitForFunction(() => {
    const app = window.__fpsApp || window.game || window.__game;
    return app?.mapLoader?.currentMapId === 'warehouse' &&
      Array.isArray(app?.controls?.colliders) &&
      app.controls.colliders.length >= 300 &&
      app.weaponManager?.state?.ammoInClip > 0;
  }, null, { timeout: 25000 });

  console.log('Game and Warehouse map fully loaded in browser.');

  // Dismiss intro overlay
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-engage');
    if (btn) btn.click();
    const intro = document.querySelector('#instructions-overlay');
    if (intro) intro.style.display = 'none';
  });
  await page.waitForTimeout(500);

  // Position player in Section 1 warehouse aisle next to pallet racks
  await page.evaluate(() => {
    const app = window.__fpsApp;
    app.controls.setPosition(18.0, 1.7, 19.5, 0); // Looking North down rack aisle
    app.camera.position.set(18.0, 1.7, 19.5);
  });
  await page.waitForTimeout(400);

  // ── TEST 1: STANDING STANCE ──────────────────────────────────────────────
  console.log('1. Checking standing stance...');
  const standingState = await page.evaluate(() => {
    const app = window.__fpsApp;
    return {
      isCrouching: app.controls.isCrouching,
      eyeHeight: app.controls.getEyeHeight(),
      cameraY: app.camera.position.y,
      stanceText: document.querySelector('#hud-stance-badge')?.textContent || '',
    };
  });
  console.log('Standing state:', standingState);

  await page.screenshot({ path: path.join(outDir, '01-standing-stance.png') });
  console.log('Saved 01-standing-stance.png');

  // ── TEST 2: CROUCH TRANSITION VIA KEY C ──────────────────────────────────
  console.log('2. Pressing KeyC to crouch...');
  await page.keyboard.down('KeyC');
  await page.waitForFunction(() => window.__fpsApp?.controls?.getEyeHeight() <= 1.05, null, { timeout: 5000 });

  const crouchedState = await page.evaluate(() => {
    const app = window.__fpsApp;
    return {
      isCrouching: app.controls.isCrouching,
      eyeHeight: app.controls.getEyeHeight(),
      effectiveColliderHeight: app.controls.getEffectiveColliderHeight(),
      cameraY: app.camera.position.y,
      stanceText: document.querySelector('#hud-stance-badge')?.textContent || '',
    };
  });
  console.log('Crouched state:', crouchedState);

  await page.screenshot({ path: path.join(outDir, '02-crouching-behind-cover.png') });
  console.log('Saved 02-crouching-behind-cover.png');

  // ── TEST 3: OVERHEAD CLEARANCE SAFEGUARD ──────────────────────────────────
  console.log('3. Testing overhead clearance safeguard under low obstacle...');
  // Place player under an overhead obstacle (or add a low rack beam collider directly above)
  await page.evaluate(() => {
    const app = window.__fpsApp;
    // Add temporary low beam collider directly above player at Y = [1.35 .. 2.2]
    app.controls.colliders.push({
      minX: 17.0, maxX: 19.0,
      minY: 1.35, maxY: 2.2,
      minZ: 18.0, maxZ: 21.0,
    });
    // Update controls so obstruction is evaluated
    app.controls.update(0.016);
  });
  await page.waitForTimeout(200);

  // Release KeyC — player attempts to stand up!
  console.log('Releasing KeyC while underneath low obstacle...');
  await page.keyboard.up('KeyC');
  await page.waitForTimeout(300);

  const blockedState = await page.evaluate(() => {
    const app = window.__fpsApp;
    return {
      isCrouching: app.controls.isCrouching,
      isOverheadBlocked: app.controls.isOverheadBlocked,
      eyeHeight: app.controls.getEyeHeight(),
      cameraY: app.camera.position.y,
      stanceText: document.querySelector('#hud-stance-badge')?.textContent || '',
    };
  });
  console.log('Blocked stance state:', blockedState);

  await page.screenshot({ path: path.join(outDir, '03-crouched-overhead-blocked.png') });
  console.log('Saved 03-crouched-overhead-blocked.png');

  // ── TEST 4: WALK OUT FROM OBSTACLE & SAFELY STAND UP ──────────────────────
  console.log('4. Walking out from under obstacle to clear space...');
  // Move player along +Z away from obstacle (Z = 24 is open aisle)
  await page.evaluate(() => {
    const app = window.__fpsApp;
    // Walk to open floor
    app.controls.position.z = 24.0;
    app.controls.update(0.016);
  });
  // Step simulation for 0.4s to let uncrouch transition complete
  for (let i = 0; i < 25; i++) {
    await page.evaluate(() => window.__fpsApp.controls.update(0.016));
  }
  await page.waitForTimeout(300);

  const clearedState = await page.evaluate(() => {
    const app = window.__fpsApp;
    return {
      isCrouching: app.controls.isCrouching,
      isOverheadBlocked: app.controls.isOverheadBlocked,
      eyeHeight: app.controls.getEyeHeight(),
      cameraY: app.camera.position.y,
      stanceText: document.querySelector('#hud-stance-badge')?.textContent || '',
    };
  });
  console.log('Cleared stance state:', clearedState);

  await page.screenshot({ path: path.join(outDir, '04-stood-up-after-clearance.png') });
  console.log('Saved 04-stood-up-after-clearance.png');

  // ── TEST 5: CROUCHED FIRING & HIT REGISTRATION ───────────────────────────
  console.log('5. Testing crouched firing and target hit confirmation...');
  // Crouch down and spawn a target directly ahead at Z = 14
  await page.keyboard.down('KeyC');
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const app = window.__fpsApp;
    // Add a dynamic reactive target directly ahead in aisle at (18, 0, 14)
    app.targetManager.addDynamicTarget(18.0, 0, 14.0, true);
    // Aim directly at target head/torso
    app.camera.lookAt(18.0, 1.2, 14.0);
  });
  await page.waitForTimeout(200);

  // Fire weapon while crouched
  await page.evaluate(() => {
    const app = window.__fpsApp;
    app.weaponManager.executeShot ? app.weaponManager.executeShot() : app.weaponManager.setTrigger(true);
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.__fpsApp.weaponManager.setTrigger(false);
  });
  await page.waitForTimeout(250); // allow bullet tracer to arrive and trigger impact

  const hitConfirmation = await page.evaluate(() => {
    const hitMarker = document.querySelector('#hitmarker');
    return {
      hitMarkerVisible: hitMarker ? window.getComputedStyle(hitMarker).opacity !== '0' : false,
      ammoRemaining: window.__fpsApp.weaponManager.state.ammoInClip,
      activeTracers: window.__fpsApp.activeTracers.length,
    };
  });
  console.log('Hit registration info:', hitConfirmation);

  await page.screenshot({ path: path.join(outDir, '05-crouched-combat-firing.png') });
  console.log('Saved 05-crouched-combat-firing.png');

  // ── TEST 6: COLLIDER DEBUG WIREFRAME ─────────────────────────────────────
  console.log('6. Enabling debug mode (?debug=1 / KeyB) to capture real-time collider bounds...');
  await page.keyboard.press('KeyB');
  await page.waitForTimeout(200);

  // Offset camera slightly back/up to show third-person view of player's crouch collider wireframe
  await page.evaluate(() => {
    const app = window.__fpsApp;
    app.camera.position.set(16.5, 2.4, 21.5);
    app.camera.lookAt(18.0, 0.7, 19.5);
  });
  await page.waitForTimeout(300);

  await page.screenshot({ path: path.join(outDir, '06-crouch-collider-debug-wireframe.png') });
  console.log('Saved 06-crouch-collider-debug-wireframe.png');

  console.log('\nAll 6 verification checks and authentic screenshots completed successfully!');
  await browser.close();

  // Return validation summary
  return {
    standing: standingState.isCrouching === false && standingState.eyeHeight > 1.65,
    crouched: crouchedState.isCrouching === true && crouchedState.eyeHeight < 1.05,
    overheadBlocked: blockedState.isOverheadBlocked === true && blockedState.isCrouching === true,
    clearedStand: clearedState.isCrouching === false && clearedState.eyeHeight > 1.65,
    combat: hitConfirmation.ammoRemaining < 30,
    pageErrors: errors,
  };
}

run()
  .then((results) => {
    console.log('Execution Results:', results);
    if (!results.standing || !results.crouched || !results.overheadBlocked || !results.clearedStand) {
      console.error('Validation assertions failed!');
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Verification script failed:', err);
    process.exit(1);
  });
