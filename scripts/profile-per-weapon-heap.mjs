import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';

async function main() {
  console.log('================================================================');
  console.log(' MINI ARENA — 60s PER-WEAPON HEAP PROFILING & ALLOCATION PROFILE');
  console.log('================================================================\n');

  const server = await createServer({
    root: 'packages/client',
    server: { port: 5193 },
  });
  await server.listen();
  console.log('Vite server running on port 5193');

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--no-sandbox', '--js-flags=--expose-gc'],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');

  await page.goto('http://localhost:5193/?debug=1');
  await page.waitForFunction(() => typeof window.__viewmodel !== 'undefined');
  await page.evaluate(() => window.__viewmodel.modelsLoaded);

  const prompt = page.locator('#lock-prompt');
  if (await prompt.isVisible()) await prompt.click();
  await page.waitForTimeout(1000);

  const getHeapUsed = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    return metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
  };

  const weapons = [
    { slot: 0, id: 'assault_rifle', name: 'Assault Rifle (AK-47)' },
    { slot: 1, id: 'pistol', name: 'Tactical Pistol' },
    { slot: 2, id: 'smg', name: 'Rapid SMG' },
    { slot: 3, id: 'shotgun', name: 'Combat Shotgun' },
    { slot: 4, id: 'sniper', name: 'Precision Sniper' },
  ];

  const results = [];
  let allocationProfileSummary = null;

  for (let idx = 0; idx < weapons.length; idx++) {
    const w = weapons[idx];
    console.log(`\n----------------------------------------------------------------`);
    console.log(` PROFILING WEAPON ${idx + 1}/5: ${w.name}`);
    console.log(`----------------------------------------------------------------`);

    // 1. Equip weapon
    await page.evaluate((slot) => {
      window.__inputManager.testHooks.setWeaponSlot(slot);
    }, w.slot);

    await page.waitForFunction((slot) => {
      const ws = window.__weaponState;
      return ws && ws.currentSlot === slot && ws.actionState === 'idle';
    }, w.slot);

    // 2. 10s Warmup (active gameplay: moving, firing, reloading)
    console.log(`Warming up JIT compiler & assets for 10s...`);
    const warmupStart = Date.now();
    let tick = 0;
    while (Date.now() - warmupStart < 10000) {
      tick++;
      await page.evaluate((t) => {
        // Continuous movement + periodic fire/reload
        window.__inputManager.testHooks.setKey('KeyW', true);
        if (t % 30 === 0) window.__inputManager.testHooks.setFire(true);
        if (t % 30 === 5) window.__inputManager.testHooks.setFire(false);
        if (t % 180 === 0) window.__inputManager.testHooks.setReload(true);
      }, tick);
      await page.waitForTimeout(16);
    }

    // 3. Forced GC before test
    console.log(`Triggering pre-test forced GC...`);
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(500);
    const preHeapBytes = await getHeapUsed();
    const preHeapMB = preHeapBytes / (1024 * 1024);
    console.log(`Pre-test Baseline Heap: ${preHeapMB.toFixed(3)} MB`);

    // If first weapon, start CDP Allocation Sampling Profile
    if (idx === 0) {
      console.log(`Starting CDP Heap Allocation Sampling (HeapProfiler.startSampling)...`);
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 32768 });
    }

    // 4. 60s Active Gameplay Run
    console.log(`Executing 60-second active gameplay run (3,600 frames)...`);
    const testStart = Date.now();
    let frame = 0;
    while (Date.now() - testStart < 60000) {
      frame++;
      await page.evaluate((f) => {
        // Strafe, fire, reload
        if (f % 60 < 30) {
          window.__inputManager.testHooks.setKey('KeyA', true);
          window.__inputManager.testHooks.setKey('KeyD', false);
        } else {
          window.__inputManager.testHooks.setKey('KeyA', false);
          window.__inputManager.testHooks.setKey('KeyD', true);
        }
        if (f % 20 === 0) window.__inputManager.testHooks.setFire(true);
        if (f % 20 === 4) window.__inputManager.testHooks.setFire(false);
        if (f % 240 === 0) window.__inputManager.testHooks.setReload(true);
      }, frame);
      await page.waitForTimeout(16);
    }

    // If first weapon, stop allocation sampling and extract profile
    if (idx === 0) {
      const { profile } = await cdp.send('HeapProfiler.stopSampling');
      console.log(`Allocation sampling complete. Extracting top allocating call frames...`);

      // Analyze allocation profile tree
      const allocMap = new Map();
      function traverse(node) {
        const name = `${node.callFrame.functionName || '(anonymous)'} (${path.basename(node.callFrame.url || 'native')}:${node.callFrame.lineNumber})`;
        const size = node.selfSize || 0;
        allocMap.set(name, (allocMap.get(name) || 0) + size);
        for (const child of node.children || []) {
          traverse(child);
        }
      }
      traverse(profile.head);

      const topAllocators = [...allocMap.entries()]
        .filter(([, size]) => size > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([fn, bytes]) => ({
          function: fn,
          bytes,
          kb: +(bytes / 1024).toFixed(1),
          mb: +(bytes / (1024 * 1024)).toFixed(3),
        }));

      allocationProfileSummary = topAllocators;
    }

    // 5. Forced GC after test
    console.log(`Triggering post-test forced GC...`);
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(500);
    const postHeapBytes = await getHeapUsed();
    const postHeapMB = postHeapBytes / (1024 * 1024);
    const deltaMB = postHeapMB - preHeapMB;
    const growthPerSecMB = deltaMB / 60;

    console.log(`Post-test Final Heap   : ${postHeapMB.toFixed(3)} MB`);
    console.log(`Net 60s Heap Delta     : ${deltaMB >= 0 ? '+' : ''}${deltaMB.toFixed(3)} MB`);
    console.log(`Average Growth Rate    : ${growthPerSecMB >= 0 ? '+' : ''}${growthPerSecMB.toFixed(4)} MB/s`);

    results.push({
      weapon: w.name,
      preHeapMB: +preHeapMB.toFixed(3),
      postHeapMB: +postHeapMB.toFixed(3),
      deltaMB: +deltaMB.toFixed(3),
      growthPerSecMB: +growthPerSecMB.toFixed(4),
      steadyState: Math.abs(deltaMB) < 1.0 ? 'PASS (Steady)' : 'FAIL (Leaking)',
    });
  }

  console.log('\n================================================================');
  console.log(' 60s PER-WEAPON HEAP GROWTH RESULTS (10s WARMUP + FORCED GC)');
  console.log('================================================================');
  console.table(results);

  if (allocationProfileSummary) {
    console.log('\n----------------------------------------------------------------');
    console.log(' TOP ALLOCATING FUNCTIONS DURING ACTIVE GAMEPLAY (CDP SAMPLING)');
    console.log('----------------------------------------------------------------');
    console.table(allocationProfileSummary);
  }

  // Save report
  const reportPath = 'docs/heap_profile_report.json';
  fs.writeFileSync(reportPath, JSON.stringify({ results, allocationProfileSummary }, null, 2));
  console.log(`\nReport written to ${reportPath}`);

  await browser.close();
  await server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
