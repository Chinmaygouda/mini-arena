// scripts/inspect-section2-warehouse.mjs
// Inspects Section 2 in the live Three.js game, tests player movement traversal,
// and captures the 5 required verification screenshots.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'artifacts/warehouse-section-2');
fs.mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('Connecting to running FPS game at http://localhost:5173/?map=warehouse&quality=high&time=overcast ...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('http://localhost:5173/?map=warehouse&quality=high&time=overcast', { waitUntil: 'domcontentloaded' });

  // Wait for map and colliders
  await page.waitForFunction(() => {
    const app = window.__fpsApp || window.game || window.__game;
    return app?.mapLoader?.currentMapId === 'warehouse' &&
      Array.isArray(app?.controls?.colliders) &&
      app.controls.colliders.length >= 350;
  }, null, { timeout: 25000 });

  console.log('Warehouse map fully loaded in Three.js renderer.');

  // Dismiss intro overlay
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-engage');
    if (btn) btn.click();
    const intro = document.querySelector('#instructions-overlay');
    if (intro) intro.style.display = 'none';
  });
  await page.waitForTimeout(500);

  // 1. Audit Scene and Colliders
  const audit = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const colliders = app.controls.colliders;

    let s1Colliders = 0;
    let s2Colliders = 0;
    let wallColliders = 0;

    for (const c of colliders) {
      if (c.minX >= 7 && c.maxX <= 38 && c.minZ >= 8 && c.maxZ <= 31 && c.maxY <= 4.0) {
        s1Colliders++;
      } else if (c.minX >= -38 && c.maxX <= -7 && c.minZ >= 8 && c.maxZ <= 31 && c.maxY <= 4.0) {
        s2Colliders++;
      } else if (c.maxY >= 5.5) {
        wallColliders++;
      }
    }

    return {
      mapId: app.mapLoader.currentMapId,
      totalColliders: colliders.length,
      s1Colliders,
      s2Colliders,
      wallColliders,
    };
  });
  console.log('Scene Audit:', audit);

  // 2. Player Traversal Simulation through Section 2
  console.log('Testing player navigation and route traversal through Section 2...');
  const traversalResult = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    const camera = app.camera;

    // Waypoints through Section 2 demonstrating complete collision-free traversal:
    // 1. South door entry (-15, 7.5 -> -15, 12.8 inside South aisle)
    // 2. Walk West along South aisle (-24.0, 12.8)
    // 3. Approach Forklift Bay from South (-28.5, 12.8)
    // 4. Move through open cross-aisle past forklift (-24.5, 17.0)
    // 5. Walk East into Middle aisle between Row 1 and Row 2 (-16.0, 17.0)
    // 6. Reach East cross-aisle (-12.0, 17.0)
    // 7. Walk North along East cross-aisle (-12.0, 22.0)
    // 8. Walk West along Middle aisle between Row 2 and Row 3 (-20.0, 22.0)
    // 9. Enter West open cross-aisle (-24.5, 22.0)
    // 10. Turn into North aisle (-24.5, 26.0)
    // 11. Walk to North door approach (-15.0, 26.0)
    // 12. Exit through North door into corridor (-15.0, 32.5)
    const waypoints = [
      { x: -15.0, z: 7.5 },
      { x: -15.0, z: 12.8 },
      { x: -24.0, z: 12.8 },
      { x: -28.5, z: 12.8 },
      { x: -25.5, z: 17.0 },
      { x: -16.0, z: 17.0 },
      { x: -11.95, z: 17.0 },
      { x: -11.95, z: 22.0 },
      { x: -18.0, z: 22.0 },
      { x: -25.5, z: 22.0 },
      { x: -25.5, z: 26.0 },
      { x: -15.0, z: 26.0 },
      { x: -15.0, z: 32.5 },
    ];

    let currentWaypoint = 0;
    camera.position.set(waypoints[0].x, 1.7, waypoints[0].z);

    const log = [];
    const playerRadius = 0.35; // typical player collision cylinder radius

    for (let step = 0; step < 800 && currentWaypoint < waypoints.length; step++) {
      const target = waypoints[currentWaypoint];
      const dx = target.x - camera.position.x;
      const dz = target.z - camera.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.25) {
        log.push({ waypoint: currentWaypoint, reached: true, pos: [camera.position.x, camera.position.z] });
        currentWaypoint++;
        continue;
      }

      // Step toward target
      const stepDist = 0.12;
      const nx = camera.position.x + (dx / dist) * stepDist;
      const nz = camera.position.z + (dz / dist) * stepDist;

      // Check collision with solid colliders
      let collided = false;
      for (const c of controls.colliders) {
        if (c.isWalkable) continue;
        if (nx + playerRadius > c.minX && nx - playerRadius < c.maxX &&
            nz + playerRadius > c.minZ && nz - playerRadius < c.maxZ &&
            1.7 > c.minY && 0.2 < c.maxY) {
          collided = true;
          break;
        }
      }

      if (collided) {
        log.push({ error: 'Collision obstruction', at: [nx, nz], target });
        return { success: false, log, stuckAt: [camera.position.x, camera.position.z], target };
      }

      camera.position.x = nx;
      camera.position.z = nz;
    }

    return {
      success: currentWaypoint >= waypoints.length,
      waypointsReached: currentWaypoint,
      totalWaypoints: waypoints.length,
      finalPos: [camera.position.x, camera.position.z],
      log,
    };
  });
  console.log('Traversal Result:', traversalResult);
  fs.writeFileSync(path.join(outDir, 'traversal-results.json'), JSON.stringify(traversalResult, null, 2));

  // =========================================================================
  // CAPTURE 5 VERIFICATION SCREENSHOTS
  // =========================================================================

  // SCREENSHOT 1: Full Warehouse Overview (Sections 1 & 2 side by side)
  console.log('Capturing 01-warehouse-overview-s1-s2.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    controls.forceReleaseKeys();
    controls.update = () => {
      camera.position.set(0, 95, 20);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 20);
      camera.fov = 52;
      camera.updateProjectionMatrix();
    };
    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = false;
    const hud = document.querySelector('#fps-hud');
    if (hud) hud.style.display = 'none';
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '01-warehouse-overview-s1-s2.png') });

  // SCREENSHOT 2: View of Section 1 for layout comparison (North-South 4 racks)
  console.log('Capturing 02-section-1-comparison.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    controls.update = () => {
      // Angled elevated view looking down into Section 1 from South-East
      camera.position.set(8, 22, 5);
      camera.up.set(0, 1, 0);
      camera.lookAt(22, 2, 20);
      camera.fov = 55;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '02-section-1-comparison.png') });

  // SCREENSHOT 3: Clear overhead or elevated view of Section 2 (East-West 3 racks & loading bay)
  console.log('Capturing 03-section-2-overhead.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    controls.update = () => {
      // Angled elevated view looking into Section 2 from South-East
      camera.position.set(-8, 22, 5);
      camera.up.set(0, 1, 0);
      camera.lookAt(-24, 2, 20);
      camera.fov = 55;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '03-section-2-overhead.png') });

  // SCREENSHOT 4: Close-up of Forklift and Loading Bay
  console.log('Capturing 04-section-2-forklift-closeup.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    controls.update = () => {
      // Cinematic low-angle inspection of the forklift, carried pallet, drums, workbench, and cones
      camera.position.set(-22.0, 2.2, 16.5);
      camera.up.set(0, 1, 0);
      camera.lookAt(-28.5, 1.2, 18.0);
      camera.fov = 55;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '04-section-2-forklift-closeup.png') });

  // SCREENSHOT 5: First-Person Gameplay View demonstrating Playable Routes
  console.log('Capturing 05-section-2-first-person-routes.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    // Restore weapon model and HUD for authentic FPS gameplay view
    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = true;
    const hud = document.querySelector('#fps-hud');
    if (hud) hud.style.display = 'block';

    controls.update = () => {
      // First-person operative eye level in South aisle looking toward loading bay & middle aisle
      camera.position.set(-18.0, 1.7, 12.8);
      camera.up.set(0, 1, 0);
      camera.lookAt(-27.0, 1.7, 17.5);
      camera.fov = 75;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '05-section-2-first-person-routes.png') });

  console.log('All 5 screenshots successfully saved to artifacts/warehouse-section-2/!');
  await browser.close();
}

run().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
