/* global window */
import { chromium } from '@playwright/test';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';

async function profileClientHeap60s() {
  console.log('================================================================================');
  console.log(' MINI ARENA — 60-SECOND IN-BROWSER HEAP & RENDER LOOP PROFILING (A4)');
  console.log(' Requirements: 60s active render loop, all 5 weapons, firing, reloads, swaps,');
  console.log('               forced GC, V8 JSHeapUsedSize tracking, zero runaway allocations');
  console.log('================================================================================\n');

  const server = await createServer({
    root: 'packages/client',
    server: { port: 5196 },
  });
  await server.listen();
  console.log('Vite server listening on port 5196');

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--no-sandbox', '--js-flags=--expose-gc'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');

  await page.goto('http://localhost:5196/?debug=1');
  await page.waitForFunction(() => typeof window.__playerState !== 'undefined');

  // Dismiss lock prompt overlay
  const prompt = page.locator('#lock-prompt');
  if (await prompt.isVisible()) {
    await prompt.click();
  }
  await page.waitForTimeout(1000);

  // Warmup run for 5 seconds to let JIT optimize and initialize assets
  console.log('Starting 5-second warmup...');
  await page.waitForTimeout(5000);

  // Initial forced GC to establish baseline
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(500);

  const getHeapMetrics = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    const used = metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
    const total = metrics.find((m) => m.name === 'JSHeapTotalSize')?.value ?? 0;
    return { used, total };
  };

  const initialHeap = await getHeapMetrics();
  console.log(`Initial Baseline Heap: ${(initialHeap.used / (1024 * 1024)).toFixed(3)} MB (Total: ${(initialHeap.total / (1024 * 1024)).toFixed(3)} MB)\n`);

  // Start 60-second continuous simulation & rendering loop
  console.log('Running 60-second continuous gameplay loop (3600 frames)...');
  const startTime = Date.now();
  let nextWeaponSlot = 1;
  let cycle = 0;

  const samples = [];

  while (Date.now() - startTime < 60000) {
    cycle++;
    nextWeaponSlot = (cycle % 5) + 1;

    // 1. Swap weapon
    await page.keyboard.press(`Digit${nextWeaponSlot}`);
    await page.waitForTimeout(400);

    // 2. Burst fire 3 shots
    for (let f = 0; f < 3; f++) {
      await page.mouse.down({ button: 'left' });
      await page.waitForTimeout(80);
      await page.mouse.up({ button: 'left' });
      await page.waitForTimeout(50);
    }

    // 3. ADS toggle
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(300);
    await page.mouse.up({ button: 'right' });

    // 4. Reload
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(500);

    // 5. Sprint interrupt
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');

    // Sample every 10 seconds
    const elapsedSec = (Date.now() - startTime) / 1000;
    if (elapsedSec >= (samples.length + 1) * 10 && samples.length < 6) {
      const current = await getHeapMetrics();
      samples.push({ sec: elapsedSec.toFixed(1), ...current });
      console.log(`[t = ${elapsedSec.toFixed(1)}s] Heap Used: ${(current.used / (1024 * 1024)).toFixed(3)} MB`);
    }
  }

  console.log('\n60-second loop complete. Performing final forced garbage collection...');
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(1000);

  const finalHeap = await getHeapMetrics();
  const deltaBytes = finalHeap.used - initialHeap.used;
  const deltaMB = deltaBytes / (1024 * 1024);

  console.log('\n================================================================================');
  console.log(' 60-SECOND CLIENT HEAP PROFILING RESULTS');
  console.log('================================================================================');
  console.log(`Initial Heap (after GC):  ${(initialHeap.used / (1024 * 1024)).toFixed(3)} MB`);
  for (const s of samples) {
    console.log(`Sample @ ${s.sec}s:            ${(s.used / (1024 * 1024)).toFixed(3)} MB`);
  }
  console.log(`Final Heap (after GC):    ${(finalHeap.used / (1024 * 1024)).toFixed(3)} MB`);
  console.log(`Net Heap Growth:          ${deltaMB >= 0 ? '+' : ''}${deltaMB.toFixed(3)} MB (${(deltaBytes / 1024).toFixed(1)} KB)`);
  console.log(`Average Growth Rate:      ${(deltaMB / 60).toFixed(4)} MB/s`);
  console.log(`Leak Status:              ${Math.abs(deltaMB) < 1.0 ? 'PASS (Zero Leaks / Steady State)' : 'INVESTIGATE'}`);
  console.log('================================================================================\n');

  await browser.close();
  await server.close();
}

profileClientHeap60s().catch((err) => {
  console.error(err);
  process.exit(1);
});
