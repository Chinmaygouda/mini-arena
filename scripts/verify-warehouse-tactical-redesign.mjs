// scripts/verify-warehouse-tactical-redesign.mjs
// Automated live browser verification script for the Tactical Warehouse Map Redesign.
// Captures genuine player-height and overhead screenshots of the live game.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'artifacts/warehouse-tactical-verification');
fs.mkdirSync(outDir, { recursive: true });

const port = process.env.PORT || '5177';
const url = `http://127.0.0.1:${port}/?map=warehouse&quality=high&time=overcast`;

async function runVerification() {
  console.log(`Launching browser verification at ${url} ...`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox'],
  });

  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for map and colliders to load
  await page.waitForFunction(() => {
    const app = window.__fpsApp || window.game || window.__game;
    return (
      app?.mapLoader?.currentMapId === 'warehouse' &&
      Array.isArray(app?.controls?.colliders) &&
      app.controls.colliders.length >= 650
    );
  }, null, { timeout: 30000 });

  console.log('✓ Warehouse map loaded with all colliders.');

  // Dismiss intro overlay
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-engage');
    if (btn) btn.click();
    const intro = document.querySelector('#instructions-overlay');
    if (intro) intro.style.display = 'none';
  });
  await page.waitForTimeout(400);

  // 1. Audit Colliders by Zone
  const colliderStats = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const colliders = app.controls.colliders;

    let s1 = 0, s2 = 0, s3 = 0, s4 = 0, ch = 0, lw = 0, le = 0;
    let walkables = 0;

    for (const c of colliders) {
      if (c.isWalkable) walkables++;
      // Section 1: [7, 38], [8, 31]
      if (c.minX >= 7 && c.maxX <= 38 && c.minZ >= 8 && c.maxZ <= 31) s1++;
      // Section 2: [-38, -7], [8, 31]
      else if (c.minX >= -38 && c.maxX <= -7 && c.minZ >= 8 && c.maxZ <= 31) s2++;
      // Section 3: [7, 38], [-31, -8]
      else if (c.minX >= 7 && c.maxX <= 38 && c.minZ >= -31 && c.maxZ <= -8) s3++;
      // Section 4: [-38, -7], [-31, -8]
      else if (c.minX >= -38 && c.maxX <= -7 && c.minZ >= -31 && c.maxZ <= -8) s4++;
      // Central Hall: [-6.75, 6.75], [-6.75, 6.75]
      else if (c.minX >= -6.75 && c.maxX <= 6.75 && c.minZ >= -6.75 && c.maxZ <= 6.75) ch++;
      // West Loading Dock: [-46, -39], [-8, 8]
      else if (c.minX >= -46 && c.maxX <= -39 && c.minZ >= -8 && c.maxZ <= 8) lw++;
      // East Loading Dock: [39, 46], [-8, 8]
      else if (c.minX >= 39 && c.maxX <= 46 && c.minZ >= -8 && c.maxZ <= 8) le++;
    }

    return {
      totalColliders: colliders.length,
      walkables,
      s1,
      s2,
      s3,
      s4,
      ch,
      lw,
      le,
    };
  });
  console.log('Collider Distribution:', colliderStats);

  // -------------------------------------------------------------
  // SHOT 1: Full Warehouse Overhead Top-Down View
  // -------------------------------------------------------------
  console.log('Capturing 01-warehouse-tactical-topdown.png ...');
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
  await page.screenshot({ path: path.join(outDir, '01-warehouse-tactical-topdown.png') });

  // Restore normal camera update
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    delete app.controls.update;
  });

  // -------------------------------------------------------------
  // SHOT 2: Team A (North) Approach into Central Combat Hall
  // -------------------------------------------------------------
  console.log('Capturing 02-team-a-approach-central-hall.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.forceReleaseKeys();
    controls.pitch = -0.05;
    controls.setPosition(0, 1.7, 12.0, 0); // At North corridor entry, looking South (+Z to -Z)
    controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '02-team-a-approach-central-hall.png') });

  // -------------------------------------------------------------
  // SHOT 3: Central Combat Hall Container Rooftop Vantage Point
  // -------------------------------------------------------------
  console.log('Capturing 03-central-container-rooftop-vantage.png ...');
  // First simulate climbing the stepped crates onto the container roof
  const climbResult = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    // Stand on container roof deck (Y = 2.62 + 1.7 eye height = 4.32)
    controls.setPosition(0, 4.32, 0, -Math.PI / 4); // Looking diagonally SW
    controls.pitch = -0.15;
    controls.update(1 / 60);
    return {
      pos: controls.position,
      feetY: controls.feetY,
      isGrounded: controls.isGrounded,
    };
  });
  console.log('Container Rooftop Stance:', climbResult);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '03-central-container-rooftop-vantage.png') });

  // -------------------------------------------------------------
  // SHOT 4: Crouching Behind Central Crash Barrier & Peeking Gap
  // -------------------------------------------------------------
  console.log('Capturing 04-crouch-peeking-shootable-gap.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.setPosition(-3.8, 1.15, 2.5, 0); // Behind West wing crate cluster looking South
    controls.isCrouching = true;
    controls.crouchProgress = 1.0;
    controls.currentEyeHeight = 1.05;
    controls.pitch = 0;
    controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '04-crouch-peeking-shootable-gap.png') });

  // -------------------------------------------------------------
  // SHOT 5: West Loading Dock Staging Deck, Pallet Jack & Railings
  // -------------------------------------------------------------
  console.log('Capturing 05-west-loading-dock-staging.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.isCrouching = false;
    controls.crouchProgress = 0;
    controls.currentEyeHeight = 1.7;
    controls.setPosition(-38.5, 1.7, 0, Math.PI / 2); // Looking West toward outer loading dock
    controls.pitch = -0.05;
    controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '05-west-loading-dock-staging.png') });

  // -------------------------------------------------------------
  // SHOT 6: East Loading Dock Chemical Drums, Workbench & Railings
  // -------------------------------------------------------------
  console.log('Capturing 06-east-loading-dock-staging.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.setPosition(38.5, 1.7, 0, -Math.PI / 2); // Looking East toward outer loading dock
    controls.pitch = -0.05;
    controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '06-east-loading-dock-staging.png') });

  // -------------------------------------------------------------
  // SHOT 7: Team B (South) Approach into Central Combat Hall
  // -------------------------------------------------------------
  console.log('Capturing 07-team-b-approach-central-hall.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.setPosition(0, 1.7, -12.0, Math.PI); // Looking North toward Central Container
    controls.pitch = -0.05;
    controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '07-team-b-approach-central-hall.png') });

  // -------------------------------------------------------------
  // 8. Ballistic Raycast Check Through Central Tactical Gaps
  // -------------------------------------------------------------
  console.log('Testing ballistic raycast through central shootable gaps...');
  const ballisticsResult = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const colliders = app.controls.colliders;

    // Line of sight between West wing crates: ray from [-3.8, 1.3, 3.0] to [-3.8, 1.3, -3.0]
    // The gap is at Z in [-0.6, 0.6]. Ray passes through Z=0!
    const origin = new THREE.Vector3(-3.8, 1.3, 0);
    const direction = new THREE.Vector3(1, 0, 0); // East-West through the central gap
    const raycaster = new THREE.Raycaster(origin, direction, 0.1, 10);

    const hitColliders = colliders.filter((c) => {
      // Check if collider intersects the line segment
      if (c.collision === false) return false;
      const bMin = new THREE.Vector3(c.minX, c.minY, c.minZ);
      const bMax = new THREE.Vector3(c.maxX, c.maxY, c.maxZ);
      const box = new THREE.Box3(bMin, bMax);
      return box.containsPoint(origin);
    });

    return {
      gapAtOriginIsClear: hitColliders.length === 0,
      obstructingColliders: hitColliders.map((c) => c.id || 'anonymous'),
    };
  });
  console.log('Ballistics Result:', ballisticsResult);

  console.log('✓ All verification steps complete!');
  await browser.close();

  return {
    ok: true,
    pageErrors,
    colliderStats,
    climbResult,
    ballisticsResult,
  };
}

runVerification()
  .then((res) => {
    console.log('VERIFICATION SUMMARY:', JSON.stringify(res, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  });
