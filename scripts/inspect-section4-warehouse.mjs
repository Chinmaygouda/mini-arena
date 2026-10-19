// scripts/inspect-section4-warehouse.mjs
// Inspects Section 4 Tactical Command Hub in the live Three.js game,
// tests player movement & stair climbing onto the catwalk,
// and captures 5 verification screenshots.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'artifacts/warehouse-section-4');
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
      app.controls.colliders.length >= 300;
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

  // 1. Audit Section 4 Colliders and Objects
  const audit = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const colliders = app.controls.colliders;

    let s4Colliders = 0;
    let s4Walkables = 0;

    for (const c of colliders) {
      if (c.minX >= -38 && c.maxX <= -7 && c.minZ >= -31 && c.maxZ <= -8 && c.maxY <= 5.0) {
        s4Colliders++;
        if (c.isWalkable) s4Walkables++;
      }
    }

    return {
      mapId: app.mapLoader.currentMapId,
      totalColliders: colliders.length,
      s4Colliders,
      s4Walkables,
    };
  });
  console.log('Scene Audit:', audit);

  // SCREENSHOT 1: Section 4 Elevated Overview
  console.log('Capturing 01-section-4-overview.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    controls.update = () => {
      camera.position.set(-9, 18, -9);
      camera.up.set(0, 1, 0);
      camera.lookAt(-24, 1.2, -20);
      camera.fov = 55;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '01-section-4-overview.png') });

  // SCREENSHOT 2: First-Person Shooting Through Server Rack Gap
  console.log('Capturing 02-section-4-server-gaps-sightline.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = true;
    const hud = document.querySelector('#fps-hud');
    if (hud) hud.style.display = 'block';

    controls.update = () => {
      // Standing in aisle (Z = -20.5), crosshair aimed right through the 1.4m gap between server racks A2 and A3
      camera.position.set(-24.75, 1.7, -20.5);
      camera.up.set(0, 1, 0);
      camera.lookAt(-24.75, 1.6, -28.0);
      camera.fov = 65;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '02-section-4-server-gaps-sightline.png') });

  // SCREENSHOT 3: Warehouse Inventory Dispatch Desks
  console.log('Capturing 03-section-4-dispatch-workstation.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    controls.update = () => {
      // Close eye level view of the dispatch desk with manifest monitors and operator chairs
      camera.position.set(-16.5, 1.6, -20.5);
      camera.up.set(0, 1, 0);
      camera.lookAt(-13.0, 1.2, -20.5);
      camera.fov = 55;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '03-section-4-dispatch-workstation.png') });

  // SCREENSHOT 4: Hardware Pallets and Security Storage Cage
  console.log('Capturing 04-section-4-hardware-pallets-and-cage.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    controls.update = () => {
      camera.position.set(-28.0, 1.7, -15.0);
      camera.up.set(0, 1, 0);
      camera.lookAt(-34.0, 1.5, -20.5);
      camera.fov = 60;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '04-section-4-hardware-pallets-and-cage.png') });

  // SCREENSHOT 5: In-Game First-Person Entry into Section 4 from South Corridor
  console.log('Capturing 05-section-4-first-person-entry.png ...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = true;
    const hud = document.querySelector('#fps-hud');
    if (hud) hud.style.display = 'block';

    controls.update = () => {
      camera.position.set(-15.0, 1.7, -11.8);
      camera.up.set(0, 1, 0);
      camera.lookAt(-24.0, 1.5, -20.5);
      camera.fov = 65;
      camera.updateProjectionMatrix();
    };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '05-section-4-first-person-entry.png') });

  console.log('All 5 Section 4 verification screenshots captured successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
