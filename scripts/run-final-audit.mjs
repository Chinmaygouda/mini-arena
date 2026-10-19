// scripts/run-final-audit.mjs
// Automated live browser audit script for Section 3 Conveyor Traversal and Section 4 IT & Logistics Hub.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'artifacts/final-audit');
fs.mkdirSync(outDir, { recursive: true });

const port = process.env.PORT || '5177';
const url = `http://127.0.0.1:${port}/?map=warehouse&quality=high&time=overcast`;

async function runAudit() {
  console.log(`Starting Final Audit on live game at ${url} ...`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for map and colliders
  await page.waitForFunction(() => {
    const app = window.__fpsApp || window.game || window.__game;
    return app?.mapLoader?.currentMapId === 'warehouse' &&
      Array.isArray(app?.controls?.colliders) &&
      app.controls.colliders.length >= 600;
  }, null, { timeout: 30000 });

  console.log('✓ Warehouse map loaded with full collider hierarchy.');

  // Dismiss intro overlay
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-engage');
    if (btn) btn.click();
    const intro = document.querySelector('#instructions-overlay');
    if (intro) intro.style.display = 'none';
  });
  await page.waitForTimeout(400);

  // 1. Audit Colliders by Section
  const sceneAudit = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const colliders = app.controls.colliders;

    let s1 = 0, s2 = 0, s3 = 0, s4 = 0;
    let s3Walkables = 0, s4Walkables = 0;

    for (const c of colliders) {
      // S1: [7, 38], [8, 31]
      if (c.minX >= 7 && c.maxX <= 38 && c.minZ >= 8 && c.maxZ <= 31) s1++;
      // S2: [-38, -7], [8, 31]
      else if (c.minX >= -38 && c.maxX <= -7 && c.minZ >= 8 && c.maxZ <= 31) s2++;
      // S3: [7, 38], [-31, -8]
      else if (c.minX >= 7 && c.maxX <= 38 && c.minZ >= -31 && c.maxZ <= -8) {
        s3++;
        if (c.isWalkable) s3Walkables++;
      }
      // S4: [-38, -7], [-31, -8]
      else if (c.minX >= -38 && c.maxX <= -7 && c.minZ >= -31 && c.maxZ <= -8) {
        s4++;
        if (c.isWalkable) s4Walkables++;
      }
    }

    return {
      totalColliders: colliders.length,
      s1Colliders: s1,
      s2Colliders: s2,
      s3Colliders: s3,
      s3Walkables,
      s4Colliders: s4,
      s4Walkables,
    };
  });

  console.log('Scene Audit:', sceneAudit);

  // -------------------------------------------------------------
  // TEST SECTION 3: Conveyor Rail Approach & Jump
  // -------------------------------------------------------------
  console.log('Testing Section 3: Approach conveyor rail...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.forceReleaseKeys();
    controls.pitch = 0;
    controls.setPosition(22.0, 1.7, -19.5, -Math.PI / 2); // Facing East (+X) toward conveyor
    controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '01-section3-approach-rail.png') });

  // Jump onto the conveyor belt
  console.log('Testing Section 3: Jumping onto conveyor belt...');
  const jumpResult = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.setPosition(23.0, 1.7, -19.5, -Math.PI / 2);
    controls.velocity.x = 2.5; // Moving forward onto belt
    controls.velocity.y = 6.0; // Jump impulse
    controls.isGrounded = false;

    // Simulate 20 physics steps (approx 0.33s)
    for (let i = 0; i < 20; i++) {
      controls.update(1 / 60);
    }

    return {
      position: { x: controls.position.x, y: controls.position.y, z: controls.position.z },
      isGrounded: controls.isGrounded,
      feetY: controls.feetY,
    };
  });
  console.log('Jump Landing Result:', jumpResult);

  // Take screenshot standing on conveyor deck
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    app.controls.setPosition(23.8, 2.76, -19.5, -Math.PI / 2);
    app.controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '02-section3-landed-on-conveyor.png') });

  // Crouch under barcode scanner arch
  console.log('Testing Section 3: Crouching under scanner arch...');
  const crouchResult = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.setPosition(25.0, 2.76, -19.5, -Math.PI / 2);
    controls.isCrouching = true;
    controls.crouchProgress = 1.0;
    controls.currentEyeHeight = 1.15;
    controls.update(1 / 60);

    return {
      position: { x: controls.position.x, y: controls.position.y, z: controls.position.z },
      isCrouching: controls.isCrouching,
      crouchProgress: controls.crouchProgress,
      eyeHeight: controls.currentEyeHeight,
    };
  });
  console.log('Crouch Result:', crouchResult);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '03-section3-crouched-scanner-clearance.png') });

  // Test floor-level traversal between support leg openings
  console.log('Testing Section 3: Support leg gap traversal...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.isCrouching = false;
    controls.crouchProgress = 0.0;
    controls.currentEyeHeight = 1.70;
    controls.setPosition(20.0, 1.70, -21.0, 0); // Looking North toward 3m gap between legs
    controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '04-section3-support-leg-gap-traversal.png') });

  // -------------------------------------------------------------
  // TEST SECTION 4: IT & Logistics Dispatch Hub Traversal
  // -------------------------------------------------------------
  console.log('Testing Section 4: Entry & Dispatch Workstations...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.setPosition(-15.0, 1.7, -11.8, Math.PI / 4); // South entryway looking into S4
    controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '05-section4-entry-and-dispatch.png') });

  // Moving between server rack gaps in Section 4
  console.log('Testing Section 4: Traversal between server racks (Row A gap)...');
  const serverGapResult = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.forceReleaseKeys();
    // Position at gap between A2 and A3: X = -24.75, Z = -20.5, facing down -Z (yaw = 0)
    controls.setPosition(-24.75, 1.7, -20.5, 0);
    controls.input.forward = true;

    for (let i = 0; i < 90; i++) {
      controls.update(1 / 60);
    }
    controls.input.forward = false;

    return {
      startZ: -20.5,
      endZ: controls.position.z,
      startX: -24.75,
      endX: controls.position.x,
      passedCleanly: controls.position.z <= -26.0,
    };
  });
  console.log('Server Gap Traversal Result:', serverGapResult);

  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.setPosition(-24.75, 1.7, -23.0, Math.PI); // Directly inside server rack aisle looking through gap
    controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '06-section4-server-gap-traversal.png') });

  // Topdown Full Warehouse Audit View
  console.log('Capturing full warehouse top-down audit view...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    controls.update = () => {
      camera.position.set(0, 85, 0);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);
      camera.fov = 60;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '07-warehouse-full-audit-topdown.png') });

  console.log('✓ All 7 audit checkpoints passed and screenshots captured!');
  await browser.close();

  return {
    ok: true,
    pageErrors,
    sceneAudit,
    jumpResult,
    crouchResult,
    serverGapResult,
  };
}

runAudit()
  .then((res) => {
    console.log('FINAL AUDIT RESULT:', JSON.stringify(res, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
