/* global window, performance, requestAnimationFrame, document */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';

const ARTIFACT_DIR = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/76041f60-e72f-4e8d-a6ae-d518c8ee191a';
const DOCS_DIR = path.resolve('docs/screenshots');

const WEAPONS = [
  { slot: 1, id: 'assault_rifle', name: 'Assault Rifle' },
  { slot: 2, id: 'pistol', name: 'Tactical Pistol' },
  { slot: 3, id: 'smg', name: 'Rapid SMG' },
  { slot: 4, id: 'shotgun', name: 'Combat Shotgun' },
  { slot: 5, id: 'sniper', name: 'Precision Sniper' },
];

async function run() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  const server = await createServer({
    root: 'packages/client',
    server: { port: 5199 },
  });
  await server.listen();
  console.log('Vite server listening on port 5199');

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto('http://localhost:5199/?debug=1');
  await page.waitForFunction(() => typeof window.__playerState !== 'undefined');

  // Dismiss lock prompt
  const prompt = page.locator('#lock-prompt');
  if (await prompt.isVisible()) {
    await prompt.click();
  }
  await page.waitForTimeout(500);

  console.log('================================================================');
  console.log(' MINI ARENA — PHASE 3 ALL-WEAPONS VISUAL & PROFILING AUDIT');
  console.log('================================================================');

  const results = [];

  for (const w of WEAPONS) {
    console.log(`\nTesting Weapon [Slot ${w.slot}]: ${w.name} (${w.id})...`);
    // Press slot key
    await page.keyboard.press(`Digit${w.slot}`);
    await page.waitForTimeout(650); // wait for swap animation

    // Read viewmodel stats
    const stats = await page.evaluate(() => {
      const vm = window.__viewmodel;
      const renderer = window.__renderer;
      const ws = window.__weaponState;
      const activeSlot = ws.slots[ws.currentSlot];
      const wName = document.querySelector('#hud-weapon-name')?.textContent ?? '';
      const wMag = document.querySelector('#hud-ammo-mag')?.textContent ?? '';
      const wRes = document.querySelector('#hud-ammo-reserve')?.textContent ?? '';
      const wAct = document.querySelector('#hud-weapon-action')?.textContent ?? '';
      return {
        activeWeaponId: activeSlot.weaponId,
        currentClip: vm ? vm.animator.getCurrentClipName() : 'unknown',
        totalTriangles: vm ? vm.totalTriangles : 0,
        rendererType: renderer ? (renderer.isWebGPURenderer ? 'WebGPU' : 'WebGL2 Fallback') : 'Unknown',
        hudText: `${wName} ${wMag} ${wRes} [${wAct}]`,
      };
    });

    console.log(`- Mesh active: ${stats.activeWeaponId}`);
    console.log(`- Viewmodel Triangles: ${stats.totalTriangles}`);
    console.log(`- Initial HUD: ${stats.hudText}`);

    // 1. Hip Screenshot
    const hipName = `phase3_${w.id}_hip.png`;
    const hipDoc = path.join(DOCS_DIR, hipName);
    const hipArt = path.join(ARTIFACT_DIR, hipName);
    await page.screenshot({ path: hipDoc });
    fs.copyFileSync(hipDoc, hipArt);
    console.log(`  ✓ Saved hip pose: ${hipName}`);

    // 2. ADS Screenshot
    await page.evaluate(() => {
      window.__inputManager.testHooks.setAds(true);
    });
    await page.waitForTimeout(300);

    const adsCheck = await page.evaluate(() => {
      const scopeEl = document.querySelector('#sniper-scope');
      return {
        scopeVisible: scopeEl ? scopeEl.classList.contains('active') : false,
      };
    });

    const adsName = `phase3_${w.id}_ads.png`;
    const adsDoc = path.join(DOCS_DIR, adsName);
    const adsArt = path.join(ARTIFACT_DIR, adsName);
    await page.screenshot({ path: adsDoc });
    fs.copyFileSync(adsDoc, adsArt);
    console.log(`  ✓ Saved ADS pose: ${adsName} (Scope overlay active: ${adsCheck.scopeVisible})`);

    // Release ADS
    await page.evaluate(() => {
      window.__inputManager.testHooks.setAds(false);
    });
    await page.waitForTimeout(250);

    // 3. Reload Screenshot
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(600); // mid-reload pose

    const reloadName = `phase3_${w.id}_reload.png`;
    const reloadDoc = path.join(DOCS_DIR, reloadName);
    const reloadArt = path.join(ARTIFACT_DIR, reloadName);
    await page.screenshot({ path: reloadDoc });
    fs.copyFileSync(reloadDoc, reloadArt);
    console.log(`  ✓ Saved Reload pose: ${reloadName}`);

    // Wait for reload to complete
    await page.waitForTimeout(2200);

    results.push({
      ...w,
      triangles: stats.totalTriangles,
      scopeActive: adsCheck.scopeVisible,
    });
  }

  // Measure browser FPS & Renderer draw calls over 3.0s
  console.log('\nMeasuring in-browser render performance over 3.0s...');
  const perf = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      const startTime = performance.now();
      let lastTime = startTime;
      const frameTimes = [];

      function onFrame(now) {
        frames++;
        frameTimes.push(now - lastTime);
        lastTime = now;
        if (now - startTime >= 3000) {
          const totalDuration = now - startTime;
          const avgFps = (frames / totalDuration) * 1000;
          const avgFrameTimeMs = totalDuration / frames;
          resolve({
            frames,
            totalDurationMs: totalDuration,
            avgFps,
            avgFrameTimeMs,
          });
        } else {
          requestAnimationFrame(onFrame);
        }
      }
      requestAnimationFrame(onFrame);
    });
  });

  console.log('----------------------------------------------------------------');
  console.log(`In-Browser Average FPS  : ${perf.avgFps.toFixed(1)} FPS`);
  console.log(`Average Frame Delta Time: ${perf.avgFrameTimeMs.toFixed(2)} ms`);
  console.log(`Measured Frames         : ${perf.frames} frames in ${(perf.totalDurationMs / 1000).toFixed(2)}s`);
  console.log('================================================================');
  console.table(results);

  await browser.close();
  await server.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
