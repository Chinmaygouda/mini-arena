import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('docs/screenshots/step0');
fs.mkdirSync(OUT_DIR, { recursive: true });

export async function assertWeapon(page, expectedWeaponId, expectedHudName) {
  const actual = await page.evaluate(() => {
    const ws = window.__weaponState;
    if (!ws) throw new Error('window.__weaponState is not defined');
    const slot = ws.slots[ws.currentSlot];
    const hudEl = document.getElementById('hud-weapon-name');
    const hudName = hudEl ? hudEl.textContent?.trim() : '';
    const badgeEl = document.getElementById('renderer-badge');
    const backend = badgeEl ? badgeEl.textContent?.trim() : '';
    return {
      weaponId: slot ? slot.weaponId : null,
      currentSlot: ws.currentSlot,
      actionState: ws.actionState,
      hudName,
      backend,
    };
  });

  if (actual.weaponId !== expectedWeaponId) {
    throw new Error(
      `[WEAPON MISMATCH ASSERTION FAILED] Expected weaponId="${expectedWeaponId}", got "${actual.weaponId}" (slot ${actual.currentSlot})`
    );
  }

  if (actual.hudName.toUpperCase() !== expectedHudName.toUpperCase()) {
    throw new Error(
      `[HUD NAME ASSERTION FAILED] Expected HUD name="${expectedHudName}", got "${actual.hudName}"`
    );
  }

  return actual;
}

export async function equipWeapon(page, targetWeaponId, expectedHudName) {
  await page.evaluate((targetId) => {
    const ws = window.__weaponState;
    const input = window.__inputManager;
    if (!ws || !input) throw new Error('Engine handles missing');
    const slotIdx = ws.slots.findIndex(s => s.weaponId === targetId);
    if (slotIdx === -1) throw new Error(`Weapon not found in inventory: ${targetId}`);
    input.testHooks.setWeaponSlot(slotIdx);
  }, targetWeaponId);

  // Wait for weapon swap state machine transition to finish (swapTicks = 18 ticks = 300ms)
  await page.waitForTimeout(500);

  // Assert weapon state and HUD
  return await assertWeapon(page, targetWeaponId, expectedHudName);
}

async function runStep0() {
  console.log('=== STEP 0: FIX CAPTURE HARNESS & RE-CAPTURE PISTOL (WEBGPU vs WEBGL2) ===');

  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
    headless: true,
    args: ['--enable-unsafe-webgpu', '--use-angle=d3d11'],
  });

  async function capturePistolOnBackend(url, backendLabel) {
    console.log(`\n-> Testing ${backendLabel} (${url})...`);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle' });

    // Dismiss overlay
    try {
      const btn = page.locator('#btn-enter-arena, #enter-btn');
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ force: true });
      }
    } catch {
      // Ignore
    }
    await page.evaluate(() => {
      const el = document.getElementById('lock-prompt');
      if (el) el.style.display = 'none';
    });
    await page.waitForTimeout(400);

    // Equip Tactical Pistol (slot 1)
    console.log(`   Equipping Tactical Pistol...`);
    const status = await equipWeapon(page, 'pistol', 'Tactical Pistol');
    console.log(`   ASSERTION PASSED: weaponId="${status.weaponId}", HUD="${status.hudName}", Backend="${status.backend}"`);

    // 1. Hip
    const hipFile = path.join(OUT_DIR, `pistol_${backendLabel}_hip.png`);
    await page.screenshot({ path: hipFile });
    console.log(`   Saved: ${hipFile}`);

    // 2. ADS
    await page.evaluate(() => { window.__inputManager.isAds = true; });
    await page.waitForTimeout(300);
    const adsFile = path.join(OUT_DIR, `pistol_${backendLabel}_ads.png`);
    await page.screenshot({ path: adsFile });
    console.log(`   Saved: ${adsFile}`);
    await page.evaluate(() => { window.__inputManager.isAds = false; });
    await page.waitForTimeout(200);

    // 3. 3/4 Front Right (Quarter view)
    await page.evaluate(() => {
      const THREE = window.THREE;
      const camera = window.__camera;
      if (!window.__debugCamera) {
        const dbgCam = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 100);
        camera.add(dbgCam);
        window.__debugCamera = dbgCam;
      }
      window.__debugCamera.position.set(0.40, 0.02, -0.65);
      window.__debugCamera.userData.target = new THREE.Vector3(0.08, -0.15, -0.28);
    });
    await page.waitForTimeout(300);
    const quarterFile = path.join(OUT_DIR, `pistol_${backendLabel}_quarter.png`);
    await page.screenshot({ path: quarterFile });
    console.log(`   Saved: ${quarterFile}`);

    await context.close();

    return { hipFile, adsFile, quarterFile, backendName: status.backend };
  }

  const webgpuResults = await capturePistolOnBackend('http://localhost:5173/?debug=1', 'webgpu');
  const webglResults = await capturePistolOnBackend('http://localhost:5173/?debug=1&forceWebGL=1', 'webgl2');

  // Build side-by-side HTML montage of WebGPU vs WebGL2
  console.log('\n-> Generating side-by-side comparison sheet...');
  const montageHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pistol Re-Capture: WebGPU vs WebGL2 Side-by-Side</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #090b10; color: #f8fafc; font-family: sans-serif; padding: 30px; }
    header { margin-bottom: 25px; border-bottom: 1px solid #1e293b; padding-bottom: 15px; }
    h1 { font-size: 24px; color: #38bdf8; }
    p { color: #94a3b8; font-size: 14px; margin-top: 6px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
    .col { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; overflow: hidden; }
    .col-header { padding: 10px 14px; background: #1e293b; font-weight: 600; font-size: 14px; display: flex; justify-content: space-between; }
    .badge-webgpu { color: #34d399; }
    .badge-webgl2 { color: #fbbf24; }
    img { width: 100%; display: block; border-bottom: 1px solid #1e293b; }
    .caption { padding: 10px 14px; font-size: 13px; color: #cbd5e1; }
  </style>
</head>
<body>
  <header>
    <h1>Tactical Pistol Re-Capture — WebGPU vs WebGL2 (Fallback)</h1>
    <p>Verified with assertWeapon(id="pistol", HUD="Tactical Pistol"). Eliminates previous incorrect weapon-tile capture.</p>
  </header>

  <!-- Hip Comparison -->
  <h2 style="font-size: 16px; margin-bottom: 12px; color: #94a3b8;">1. First-Person Hip Rest Hold</h2>
  <div class="row">
    <div class="col">
      <div class="col-header"><span>WebGPU Backend</span><span class="badge-webgpu">ACTIVE</span></div>
      <img src="pistol_webgpu_hip.png" />
      <div class="caption">Tactical Pistol Hip Hold rendered on WebGPU</div>
    </div>
    <div class="col">
      <div class="col-header"><span>WebGL2 Fallback</span><span class="badge-webgl2">?forceWebGL=1</span></div>
      <img src="pistol_webgl2_hip.png" />
      <div class="caption">Tactical Pistol Hip Hold rendered on WebGL2 fallback</div>
    </div>
  </div>

  <!-- ADS Comparison -->
  <h2 style="font-size: 16px; margin-bottom: 12px; color: #94a3b8;">2. First-Person ADS (Aim Down Sights)</h2>
  <div class="row">
    <div class="col">
      <div class="col-header"><span>WebGPU Backend</span><span class="badge-webgpu">ACTIVE</span></div>
      <img src="pistol_webgpu_ads.png" />
      <div class="caption">Tactical Pistol ADS centered on tritium front sight</div>
    </div>
    <div class="col">
      <div class="col-header"><span>WebGL2 Fallback</span><span class="badge-webgl2">?forceWebGL=1</span></div>
      <img src="pistol_webgl2_ads.png" />
      <div class="caption">Tactical Pistol ADS on WebGL2 fallback</div>
    </div>
  </div>

  <!-- Quarter Comparison -->
  <h2 style="font-size: 16px; margin-bottom: 12px; color: #94a3b8;">3. 3/4 Front-Right Angle (Grip Audit)</h2>
  <div class="row">
    <div class="col">
      <div class="col-header"><span>WebGPU Backend</span><span class="badge-webgpu">ACTIVE</span></div>
      <img src="pistol_webgpu_quarter.png" />
      <div class="caption">Quarter perspective showing compact two-handed hold on pistol frame</div>
    </div>
    <div class="col">
      <div class="col-header"><span>WebGL2 Fallback</span><span class="badge-webgl2">?forceWebGL=1</span></div>
      <img src="pistol_webgl2_quarter.png" />
      <div class="caption">Quarter perspective on WebGL2 fallback</div>
    </div>
  </div>
</body>
</html>
  `;

  const montageHtmlPath = path.join(OUT_DIR, 'pistol_comparison.html');
  fs.writeFileSync(montageHtmlPath, montageHtml, 'utf-8');

  const sheetContext = await browser.newContext({ viewport: { width: 1600, height: 2200 } });
  const sheetPage = await sheetContext.newPage();
  await sheetPage.goto(`file://${montageHtmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
  await sheetPage.waitForTimeout(500);

  const sideBySidePath = path.join(OUT_DIR, 'pistol_webgpu_vs_webgl_side_by_side.png');
  await sheetPage.screenshot({ path: sideBySidePath, fullPage: true });
  console.log(`\n=== STEP 0 COMPLETE: ${sideBySidePath} ===`);

  await browser.close();
}

runStep0().catch(err => {
  console.error('STEP 0 FAILED:', err);
  process.exit(1);
});
