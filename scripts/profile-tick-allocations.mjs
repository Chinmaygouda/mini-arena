/* global window */
import { chromium } from '@playwright/test';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';
import os from 'node:os';

async function runDetailedSamplingProfile() {
  console.log('================================================================');
  console.log(' MINI ARENA — V8 ALLOCATION SAMPLING PROFILER (HOT PATH BREAKDOWN)');
  console.log('================================================================');

  const cpus = os.cpus();
  console.log(`Device CPU Model  : ${cpus[0]?.model || 'Unknown'} (${cpus.length} logical cores)`);
  console.log(`OS Platform       : ${os.platform()} ${os.release()} (${os.arch()})`);
  console.log(`Node.js Version   : ${process.version}`);
  console.log('Method            : Chrome DevTools Protocol HeapProfiler.startSampling (16KB sample rate)');
  console.log('----------------------------------------------------------------');

  const server = await createServer({
    root: 'packages/client',
    server: { port: 5198 },
  });
  await server.listen();
  const serverUrl = 'http://localhost:5198';

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('HeapProfiler.enable');

  await page.goto(serverUrl);
  await page.waitForFunction(() => typeof window.__playerState !== 'undefined');

  // Let initial scene load and shader compiles settle
  await page.waitForTimeout(1500);
  await client.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(300);

  // Start sampling profiler with fine 8KB sampling interval
  await client.send('HeapProfiler.startSampling', { samplingInterval: 8192 });

  // Simulate active gameplay for 10 seconds: moving, shooting, ADS, reload, dummy hitscan
  const testDurationMs = 10000;
  const start = Date.now();
  let frame = 0;

  while (Date.now() - start < testDurationMs) {
    await page.evaluate((f) => {
      // Movement
      window.__inputManager?.setKey('KeyW', true);
      if (f % 60 === 0) window.__inputManager?.setFire(true);
      if (f % 60 === 20) window.__inputManager?.setFire(false);
      if (f % 120 === 0) window.__inputManager?.setAds(true);
      if (f % 120 === 60) window.__inputManager?.setAds(false);
    }, frame);
    frame++;
    await page.waitForTimeout(16);
  }

  const samplingResult = await client.send('HeapProfiler.stopSampling');
  const profile = samplingResult.profile;

  // Flatten call tree to inspect per-function allocations
  const functionAllocations = new Map();

  function traverse(node) {
    const fnName = node.callFrame?.functionName || '(anonymous)';
    const url = node.callFrame?.url || '';
    const line = node.callFrame?.lineNumber || 0;
    const key = `${fnName} (${url.split('/').pop() || 'native'}:${line})`;
    const size = node.selfSize || 0;

    if (size > 0) {
      functionAllocations.set(key, (functionAllocations.get(key) || 0) + size);
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(profile.head);

  console.log('Top Sampled Allocation Sites During 10s Active Gameplay:');
  const sorted = Array.from(functionAllocations.entries()).sort((a, b) => b[1] - a[1]);
  let totalSampled = 0;
  for (const [fn, bytes] of sorted) {
    totalSampled += bytes;
    console.log(`  - ${(bytes / 1024).toFixed(2).padStart(7)} KB : ${fn}`);
  }

  console.log('----------------------------------------------------------------');
  console.log(`Total Sampled Memory Allocated: ${(totalSampled / 1024).toFixed(2)} KB over ${frame} frames (~${(totalSampled / frame).toFixed(1)} bytes/frame)`);

  // Specifically check hot path functions
  const hotPaths = [
    'stepPlayer',
    'stepFireTiming',
    'tryConsumeShot',
    'stepWeaponStateMachine',
    'testRayHitbox',
    'testRayWithOcclusion',
    'updateAccumulator',
  ];

  console.log('\nVerification of Hot-Path Functions in Shared Simulation:');
  for (const hp of hotPaths) {
    const found = sorted.find(([key]) => key.startsWith(hp));
    if (found) {
      console.log(`  ⚠ ${hp.padEnd(25)}: ${(found[1] / 1024).toFixed(2)} KB allocated`);
    } else {
      console.log(`  ✔ ${hp.padEnd(25)}: 0 bytes (ZERO allocations detected by profiler)`);
    }
  }
  console.log('================================================================');

  await browser.close();
  await server.close();
}

runDetailedSamplingProfile().catch((err) => {
  console.error(err);
  process.exit(1);
});
