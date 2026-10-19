// scripts/capture-all-top-views.mjs
// Captures top-down views of all implemented sections in the warehouse map:
// 1. Full Warehouse Map Top View (whole 96m x 96m facility)
// 2. Section 1 Top View (North-West: 4 storage rack runs, pallets, crates)
// 3. Section 2 Top View (North-East: Loading Bay, 3 East-West rack rows, forklift, staging)
// 4. Section 3 Top View (South-West: Architectural shell, service bays, corridor network)
// 5. Section 4 Top View (South-East: Warehouse IT Hub, server rows with shootable gaps, dispatch workstation, cage)
// 6. Central Combat Hall & Cross Corridors Top View

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'artifacts/warehouse-top-views');
fs.mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('Connecting to running FPS game at http://localhost:5173/?map=warehouse&quality=high&time=overcast ...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  await page.goto('http://localhost:5173/?map=warehouse&quality=high&time=overcast', { waitUntil: 'domcontentloaded' });

  // Wait for map and colliders
  await page.waitForFunction(() => {
    const app = window.__fpsApp || window.game || window.__game;
    return app?.mapLoader?.currentMapId === 'warehouse' &&
      Array.isArray(app?.controls?.colliders) &&
      app.controls.colliders.length >= 300;
  }, null, { timeout: 25000 });

  console.log('Warehouse map fully loaded.');

  // Dismiss intro overlay and hide weapon model / crosshair for clean architectural photography
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-engage');
    if (btn) btn.click();
    const intro = document.querySelector('#instructions-overlay');
    if (intro) intro.style.display = 'none';
    const hud = document.querySelector('#fps-hud');
    if (hud) hud.style.display = 'none';

    const app = window.__fpsApp || window.game || window.__game;
    if (app?.weaponManager?.rootGroup) {
      app.weaponManager.rootGroup.visible = false;
    }
  });
  await page.waitForTimeout(500);

  const setCameraTopDown = async (posX, posY, posZ, lookX, lookY, lookZ, fov = 45) => {
    await page.evaluate(({ posX, posY, posZ, lookX, lookY, lookZ, fov }) => {
      const app = window.__fpsApp || window.game || window.__game;
      const camera = app.camera;
      const controls = app.controls;

      controls.update = () => {
        camera.position.set(posX, posY, posZ);
        // up vector (0, 0, 1) aligns +Z to top of screen and +X to left of screen
        camera.up.set(0, 0, 1);
        camera.lookAt(lookX, lookY, lookZ);
        camera.fov = fov;
        camera.updateProjectionMatrix();
      };
    }, { posX, posY, posZ, lookX, lookY, lookZ, fov });
    await page.waitForTimeout(600);
  };

  // 1. FULL WAREHOUSE MAP OVERVIEW
  console.log('Capturing 01-full-warehouse-map-top-view.png ...');
  await setCameraTopDown(0, 95, 0, 0, 0, 0, 60);
  await page.screenshot({ path: path.join(outDir, '01-full-warehouse-map-top-view.png') });

  // 2. SECTION 1 TOP VIEW (North-West: Storage Racks, Pallets & Crates)
  console.log('Capturing 02-section-1-top-view.png ...');
  // Section 1 bounds: X: [7, 38], Z: [8, 31], Center: (22.5, 19.5)
  await setCameraTopDown(22.5, 34, 19.5, 22.5, 0, 19.5, 52);
  await page.screenshot({ path: path.join(outDir, '02-section-1-top-view.png') });

  // 3. SECTION 2 TOP VIEW (North-East: Loading Bay, East-West Racks & Forklift)
  console.log('Capturing 03-section-2-top-view.png ...');
  // Section 2 bounds: X: [-38, -7], Z: [8, 31], Center: (-22.5, 19.5)
  await setCameraTopDown(-22.5, 34, 19.5, -22.5, 0, 19.5, 52);
  await page.screenshot({ path: path.join(outDir, '03-section-2-top-view.png') });

  // 4. SECTION 3 TOP VIEW (South-West: Chamber & Service Bays Shell)
  console.log('Capturing 04-section-3-top-view.png ...');
  // Section 3 bounds: X: [7, 38], Z: [-31, -8], Center: (22.5, -19.5)
  await setCameraTopDown(22.5, 34, -19.5, 22.5, 0, -19.5, 52);
  await page.screenshot({ path: path.join(outDir, '04-section-3-top-view.png') });

  // 5. SECTION 4 TOP VIEW (South-East: Warehouse IT Hub, Server Rows with Gaps & Workstation)
  console.log('Capturing 05-section-4-top-view.png ...');
  // Section 4 bounds: X: [-38, -7], Z: [-31, -8], Center: (-22.5, -19.5)
  await setCameraTopDown(-22.5, 34, -19.5, -22.5, 0, -19.5, 52);
  await page.screenshot({ path: path.join(outDir, '05-section-4-top-view.png') });

  // 6. CENTRAL COMBAT HALL & CROSS CORRIDORS TOP VIEW
  console.log('Capturing 06-central-hall-corridors-top-view.png ...');
  await setCameraTopDown(0, 36, 0, 0, 0, 0, 52);
  await page.screenshot({ path: path.join(outDir, '06-central-hall-corridors-top-view.png') });

  console.log('All top view screenshots captured successfully in artifacts/warehouse-top-views/');
  await browser.close();
}

run().catch((err) => {
  console.error('Error capturing top views:', err);
  process.exit(1);
});
