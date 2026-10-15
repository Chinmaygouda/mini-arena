/* global window */
import { chromium } from '@playwright/test';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';

const WEAPONS = [
  { slot: 1, id: 'assault_rifle', name: 'Assault Rifle' },
  { slot: 2, id: 'pistol', name: 'Tactical Pistol' },
  { slot: 3, id: 'smg', name: 'Rapid SMG' },
  { slot: 4, id: 'shotgun', name: 'Combat Shotgun' },
  { slot: 5, id: 'sniper', name: 'Precision Sniper' },
];

async function measureDrawCalls() {
  const server = await createServer({
    root: 'packages/client',
    server: { port: 5197 },
  });
  await server.listen();
  console.log('Vite server listening on port 5197');

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto('http://localhost:5197/?debug=1');
  await page.waitForFunction(() => typeof window.__playerState !== 'undefined' && typeof window.__threeRenderer !== 'undefined');

  // Dismiss lock prompt overlay
  const prompt = page.locator('#lock-prompt');
  if (await prompt.isVisible()) {
    await prompt.click();
  }
  await page.waitForTimeout(500);

  console.log('\n================================================================================');
  console.log(' MINI ARENA — PHASE 3 DRAW CALL & GEOMETRY PROFILE (A6 AUDIT)');
  console.log(' Budget Gate: PLAN.md §4 specifies Draw Calls <= 250, Visible Tris <= 120k (Low)');
  console.log('================================================================================\n');

  const results = [];

  for (const w of WEAPONS) {
    // 1. Equip weapon
    await page.keyboard.press(`Digit${w.slot}`);
    await page.waitForTimeout(600); // wait for swap-in to finish

    // Measure Hip State (per single rendered frame)
    const hip = await page.evaluate(async () => {
      const r = window.__threeRenderer;
      return new Promise((resolve) => {
        window.requestAnimationFrame(() => {
          const before = r ? r.info.render.calls : 0;
          window.requestAnimationFrame(() => {
            const after = r ? r.info.render.calls : 0;
            const singleFrameCalls = after - before;
            resolve({
              calls: singleFrameCalls > 0 ? singleFrameCalls : (r ? r.info.render.calls : 0),
              rawTotal: after,
              triangles: r ? r.info.render.triangles : 0,
              geometries: r ? r.info.memory.geometries : 0,
              textures: r ? r.info.memory.textures : 0,
              autoReset: r ? r.info.autoReset : undefined,
            });
          });
        });
      });
    });

    // Measure ADS State
    await page.evaluate(() => {
      window.__inputManager.testHooks.setAds(true);
    });
    await page.waitForTimeout(350);

    const ads = await page.evaluate(async () => {
      const r = window.__threeRenderer;
      return new Promise((resolve) => {
        window.requestAnimationFrame(() => {
          const before = r ? r.info.render.calls : 0;
          window.requestAnimationFrame(() => {
            const after = r ? r.info.render.calls : 0;
            const singleFrameCalls = after - before;
            resolve({
              calls: singleFrameCalls > 0 ? singleFrameCalls : (r ? r.info.render.calls : 0),
              triangles: r ? r.info.render.triangles : 0,
            });
          });
        });
      });
    });

    // Reset ADS
    await page.evaluate(() => {
      window.__inputManager.testHooks.setAds(false);
    });
    await page.waitForTimeout(200);

    // Measure Reload / Active State (dropped mag or shell in hand)
    await page.evaluate(() => {
      const vm = window.__viewmodel;
      if (vm) {
        if (vm.currentVisualDef.weaponId === 'shotgun') {
          vm.playClip('reloadInsert', true);
        } else {
          vm.playClip('reloadEmpty', true);
        }
      }
    });
    await page.waitForTimeout(700); // Halfway into reload where mag is detached/dropped

    const reload = await page.evaluate(async () => {
      const r = window.__threeRenderer;
      return new Promise((resolve) => {
        window.requestAnimationFrame(() => {
          const before = r ? r.info.render.calls : 0;
          window.requestAnimationFrame(() => {
            const after = r ? r.info.render.calls : 0;
            const singleFrameCalls = after - before;
            resolve({
              calls: singleFrameCalls > 0 ? singleFrameCalls : (r ? r.info.render.calls : 0),
              triangles: r ? r.info.render.triangles : 0,
            });
          });
        });
      });
    });

    // Reset back to idle
    await page.evaluate(() => {
      const vm = window.__viewmodel;
      if (vm) vm.playClip('idle', true);
    });
    await page.waitForTimeout(200);

    results.push({
      weapon: w.name,
      id: w.id,
      hipCalls: hip.calls,
      hipTris: hip.triangles,
      adsCalls: ads.calls,
      adsTris: ads.triangles,
      reloadCalls: reload.calls,
      reloadTris: reload.triangles,
      geometries: hip.geometries,
      textures: hip.textures,
    });
  }

  await browser.close();
  await server.close();

  // Print results table
  console.log('| Weapon | Hip Calls | ADS Calls | Reload Calls (Max) | Worst-Case Calls | Tris (Worst) | Budget Gate (<= 250) | Status |');
  console.log('|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|');
  let worstOverallCalls = 0;
  for (const r of results) {
    const worstCalls = Math.max(r.hipCalls, r.adsCalls, r.reloadCalls);
    const worstTris = Math.max(r.hipTris, r.adsTris, r.reloadTris);
    worstOverallCalls = Math.max(worstOverallCalls, worstCalls);
    const pass = worstCalls <= 250 ? 'PASS' : 'FAIL';
    console.log(`| ${r.weapon.padEnd(16)} | ${String(r.hipCalls).padEnd(9)} | ${String(r.adsCalls).padEnd(9)} | ${String(r.reloadCalls).padEnd(18)} | ${String(worstCalls).padEnd(16)} | ${String(worstTris).padEnd(12)} | <= 250               | ${pass}   |`);
  }
  console.log(`\nWorst-case draw calls across all weapons & states: ${worstOverallCalls} (Budget: <= 250 calls, headroom: ${250 - worstOverallCalls} calls)`);
}

measureDrawCalls().catch((err) => {
  console.error(err);
  process.exit(1);
});
