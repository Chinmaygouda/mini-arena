import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = 'artifacts/warehouse-section-1-qa';
fs.mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('Connecting to running game on http://localhost:5173/?map=warehouse&quality=high&time=overcast ...');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('http://localhost:5173/?map=warehouse&quality=high&time=overcast', { waitUntil: 'domcontentloaded' });

  // Wait for map loading to complete
  await page.waitForFunction(() => {
    const app = window.__fpsApp || window.game || window.__game;
    return app?.mapLoader?.currentMapId === 'warehouse' &&
      Array.isArray(app?.controls?.colliders) &&
      app.controls.colliders.length >= 200;
  }, null, { timeout: 25000 });

  console.log('Warehouse map loaded in Three.js renderer.');

  // Dismiss intro overlay
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-engage');
    if (btn) btn.click();
    const intro = document.querySelector('#instructions-overlay');
    if (intro) intro.style.display = 'none';
  });
  await page.waitForTimeout(500);

  // 1. Detailed Telemetry and Audit
  const telemetry = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    const colliders = controls.colliders;

    // Count objects in map
    let wallCount = 0;
    let s1Props = 0;
    let s2Props = 0;
    let s3Props = 0;
    let s4Props = 0;
    let centralProps = 0;

    app.scene.traverse((obj) => {
      // Mesh checks
    });

    return {
      mapId: app.mapLoader.currentMapId,
      colliderCount: colliders.length,
      bounds: controls.bounds,
      activeWeapon: app.weaponManager?.activeWeaponKey,
    };
  });
  console.log('Initial Telemetry:', telemetry);

  // 2. Capture Screenshot 1: Whole Map Top-Down (01-whole-map.png)
  console.log('Capturing 01-whole-map.png...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    controls.forceReleaseKeys();
    controls.__qaOriginalUpdate = controls.update.bind(controls);

    controls.update = () => {
      camera.position.set(0, 115, 0);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);
      camera.fov = 48;
      camera.updateProjectionMatrix();
    };

    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = false;
    const hud = document.querySelector('#fps-hud');
    if (hud) hud.style.display = 'none';
    const intro = document.querySelector('#instructions-overlay');
    if (intro) intro.style.display = 'none';
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '01-whole-map.png') });

  // 3. Capture Screenshot 2: Rack Detail (02-rack-detail.png)
  // Overhead isometric / angled view of Section 1 racks showing uprights, beams, pallets, crates
  console.log('Capturing 02-rack-detail.png...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;

    controls.update = () => {
      // View looking from South-West of Section 1 towards North-East
      camera.position.set(10, 12, 10);
      camera.up.set(0, 1, 0);
      camera.lookAt(23, 2.5, 20);
      camera.fov = 55;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '02-rack-detail.png') });

  // 4. Capture Screenshot 3: First-Person Aisles View (03-first-person-aisles.png)
  console.log('Capturing 03-first-person-aisles.png...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.update = controls.__qaOriginalUpdate;
    delete controls.__qaOriginalUpdate;
    controls.forceReleaseKeys();

    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = true;
    const hud = document.querySelector('#fps-hud');
    if (hud) hud.style.display = '';

    // Station player at the entrance of Aisle 1 looking down the aisle between Rack 1 and Rack 2
    // Aisle 1 is at X = 16.8, looking North (yaw = PI in this engine faces North / +Z)
    controls.pitch = 0;
    controls.setPosition(16.8, 1.7, 12.0, Math.PI);
    controls.update(1 / 60);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '03-first-person-aisles.png') });

  // Additional Diagnostic Screenshots:
  // A. Standing between Rack 2 and Rack 3 looking at crates and pallet slats
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.pitch = -0.15;
    controls.setPosition(22.8, 1.7, 18.0, Math.PI * 0.75); // looking toward Rack 2
    controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'diag_rack_close_up.png') });

  // B. Section 1 Floor Badge visibility
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.pitch = -0.4;
    controls.setPosition(22.0, 1.7, 24.0, Math.PI); // looking at badge at Z=27.2
    controls.update(1 / 60);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'diag_badge_visibility.png') });

  // 5. In-Engine Traversal & Collision Validation
  console.log('Performing comprehensive traversal simulation through Section 1...');
  const traversalResults = await page.evaluate(async () => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    const dt = 1 / 60;

    // Helper: walk from current position towards target (tx, tz) using controls.update
    function walkTo(targetX, targetZ, maxSteps = 120) {
      let step = 0;
      let blockedCount = 0;
      while (step < maxSteps) {
        const dx = targetX - controls.position.x;
        const dz = targetZ - controls.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.25) {
          return { success: true, finalDist: dist, steps: step, blocked: false };
        }

        // Set facing yaw towards target
        controls.yaw = Math.atan2(-dx, -dz);
        controls.pitch = 0;
        controls.input.forward = true;
        controls.input.sprint = false;

        const prevX = controls.position.x;
        const prevZ = controls.position.z;

        controls.update(dt);
        step++;

        const moved = Math.hypot(controls.position.x - prevX, controls.position.z - prevZ);
        if (moved < 0.005) {
          blockedCount++;
          if (blockedCount > 15) {
            controls.input.forward = false;
            return {
              success: false,
              finalDist: dist,
              steps: step,
              blocked: true,
              stuckAt: { x: controls.position.x, y: controls.position.y, z: controls.position.z },
              colliders: controls.getCollidingHits().map(c => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, minY: c.minY, maxY: c.maxY }))
            };
          }
        } else {
          blockedCount = 0;
        }
      }
      controls.input.forward = false;
      return { success: false, finalDist: Math.hypot(targetX - controls.position.x, targetZ - controls.position.z), steps: maxSteps, blocked: false };
    }

    // Waypoints to test full traversal of Section 1
    const testRoutes = [
      {
        name: 'Route 1: Enter South Doorway into Aisle 1 (between Rack 1 and Rack 2)',
        start: { x: 15.0, y: 1.7, z: 6.0, yaw: Math.PI },
        waypoints: [
          { x: 15.0, z: 10.0 },
          { x: 16.8, z: 13.0 },
          { x: 16.8, z: 20.0 },
          { x: 16.8, z: 27.0 }
        ]
      },
      {
        name: 'Route 2: Navigate North End Aisle around Rack 2 into Aisle 2',
        start: { x: 16.8, y: 1.7, z: 27.0, yaw: 0 },
        waypoints: [
          { x: 22.0, z: 27.5 },
          { x: 22.8, z: 26.5 },
          { x: 22.8, z: 20.0 },
          { x: 22.8, z: 13.0 }
        ]
      },
      {
        name: 'Route 3: Navigate South End Aisle around Rack 3 into Aisle 3',
        start: { x: 22.8, y: 1.7, z: 13.0, yaw: Math.PI },
        waypoints: [
          { x: 25.8, z: 12.0 },
          { x: 28.8, z: 13.0 },
          { x: 28.8, z: 20.0 },
          { x: 28.8, z: 27.0 }
        ]
      },
      {
        name: 'Route 4: Navigate around Rack 4 into East Service Lane',
        start: { x: 28.8, y: 1.7, z: 27.0, yaw: 0 },
        waypoints: [
          { x: 33.4, z: 27.0 },
          { x: 33.4, z: 20.0 },
          { x: 33.4, z: 13.0 }
        ]
      },
      {
        name: 'Route 5: Traverse West Inner Aisle (between Rack 1 and West Chamber Wall)',
        start: { x: 11.8, y: 1.7, z: 12.0, yaw: Math.PI },
        waypoints: [
          { x: 11.8, z: 20.0 },
          { x: 11.8, z: 28.0 }
        ]
      },
      {
        name: 'Route 6: Exit Section 1 through West Doorway into Main Corridor',
        start: { x: 11.8, y: 1.7, z: 24.5, yaw: Math.PI / 2 },
        waypoints: [
          { x: 7.0, z: 24.5 },
          { x: 2.0, z: 24.5 }
        ]
      }
    ];

    const results = [];
    for (const route of testRoutes) {
      controls.setPosition(route.start.x, route.start.y, route.start.z, route.start.yaw);
      controls.velocity.set(0, 0, 0);
      controls.forceReleaseKeys();

      let routeSuccess = true;
      let failureInfo = null;

      for (let w = 0; w < route.waypoints.length; w++) {
        const wp = route.waypoints[w];
        const res = walkTo(wp.x, wp.z);
        if (!res.success) {
          routeSuccess = false;
          failureInfo = { waypointIndex: w, waypoint: wp, result: res };
          break;
        }
      }

      results.push({
        name: route.name,
        success: routeSuccess,
        failureInfo
      });
    }

    // Jump Clearance Test: Jump in the aisle beside rack upright and crate
    // Aisle 1 player standing at X = 14.9 (touching distance to Rack 1 upright at X = 14.48)
    controls.setPosition(14.88, 1.7, 15.0, 0);
    controls.input.jump = true;
    controls.update(dt);
    controls.input.jump = false;
    let jumpBesideUprightSnagged = false;
    for (let j = 0; j < 40; j++) {
      controls.update(dt);
      if (controls.getCollidingCount() > 0) {
        jumpBesideUprightSnagged = true;
      }
    }

    // Jump beside crate at X = 14.88, Z = 16.0
    controls.setPosition(14.88, 1.7, 16.0, 0);
    controls.input.jump = true;
    controls.update(dt);
    controls.input.jump = false;
    let jumpBesideCrateSnagged = false;
    for (let j = 0; j < 40; j++) {
      controls.update(dt);
      if (controls.getCollidingCount() > 0) {
        jumpBesideCrateSnagged = true;
      }
    }

    return {
      routes: results,
      jumpTest: {
        jumpBesideUprightSnagged,
        jumpBesideCrateSnagged
      }
    };
  });

  console.log('Traversal Results:');
  console.log(JSON.stringify(traversalResults, null, 2));
  fs.writeFileSync(path.join(outDir, 'traversal-results.json'), JSON.stringify(traversalResults, null, 2));

  await browser.close();
  console.log('Inspection complete. Screenshots saved.');
}

run().catch((err) => {
  console.error('Inspection error:', err);
  process.exit(1);
});
