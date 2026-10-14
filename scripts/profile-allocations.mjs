/* global window */
import { chromium } from '@playwright/test';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';
import os from 'node:os';

async function runAllocationProfile() {
  console.log('================================================================');
  console.log(' MINI ARENA — PHASE 1 TICK LOOP ALLOCATION & HEAP PROFILER');
  console.log('================================================================');

  // Device & Environment Info
  const cpus = os.cpus();
  console.log(`Device CPU Model  : ${cpus[0]?.model || 'Unknown'} (${cpus.length} logical cores)`);
  console.log(`OS Platform       : ${os.platform()} ${os.release()} (${os.arch()})`);
  console.log(`System Free Memory: ${(os.freemem() / (1024 * 1024 * 1024)).toFixed(2)} GB / ${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)} GB`);
  console.log(`Node.js Version   : ${process.version}`);
  console.log('----------------------------------------------------------------');

  // Start Vite dev server for client
  const server = await createServer({
    root: 'packages/client',
    server: { port: 5199 },
  });
  await server.listen();
  const serverUrl = 'http://localhost:5199';
  console.log(`Vite Dev Server started at: ${serverUrl}`);

  // Launch Chromium
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  // Create Chrome DevTools Protocol (CDP) session
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('HeapProfiler.enable');

  await page.goto(serverUrl);
  await page.waitForFunction(() => typeof window.__playerState !== 'undefined');

  // Warm up simulation for 120 frames (2 seconds)
  await page.evaluate(() => {
    window.__inputManager?.setKey('KeyW', true);
  });
  await page.waitForTimeout(2000);

  // Force Garbage Collection to establish clean baseline
  await client.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(500);

  // Measure initial baseline metrics
  const baselineMetricsRaw = await client.send('Performance.getMetrics');
  const getMetric = (metrics, name) => metrics.find((m) => m.name === name)?.value ?? 0;

  const baselineHeapUsed = getMetric(baselineMetricsRaw.metrics, 'JSHeapUsedSize');
  const baselineHeapTotal = getMetric(baselineMetricsRaw.metrics, 'JSHeapTotalSize');

  // Start sampling heap allocations
  await client.send('HeapProfiler.startSampling', { samplingInterval: 16384 });

  console.log(`Baseline JSHeapUsedSize : ${(baselineHeapUsed / (1024 * 1024)).toFixed(3)} MB (${baselineHeapUsed} bytes)`);
  console.log(`Baseline JSHeapTotalSize: ${(baselineHeapTotal / (1024 * 1024)).toFixed(3)} MB (${baselineHeapTotal} bytes)`);
  console.log('Running 600 fixed-timestep simulation ticks (~10.0 seconds of gameplay)...');

  // Run active gameplay loop with movement, crouching, and looking
  const profileDurationMs = 10000;
  const startTime = Date.now();
  let frameCount = 0;

  while (Date.now() - startTime < profileDurationMs) {
    await page.evaluate((fc) => {
      // Toggle inputs to exercise all hot paths
      if (fc % 120 === 0) window.__inputManager?.setKey('KeyC', true);
      if (fc % 120 === 60) window.__inputManager?.setKey('KeyC', false);
      if (fc % 180 === 0) window.__inputManager?.setKey('Space', true);
      if (fc % 180 === 30) window.__inputManager?.setKey('Space', false);
      window.__inputManager?.setLook((fc * 0.01) % (Math.PI * 2), Math.sin(fc * 0.05) * 0.3);
    }, frameCount);
    frameCount++;
    await page.waitForTimeout(16);
  }

  // Sample heap profile
  const samplingProfile = await client.send('HeapProfiler.stopSampling');
  const postMetricsRaw = await client.send('Performance.getMetrics');

  const postHeapUsed = getMetric(postMetricsRaw.metrics, 'JSHeapUsedSize');
  const postHeapTotal = getMetric(postMetricsRaw.metrics, 'JSHeapTotalSize');

  const heapDeltaBytes = postHeapUsed - baselineHeapUsed;
  const heapDeltaMB = heapDeltaBytes / (1024 * 1024);

  // Extract allocation call tree nodes
  function countAllocations(node) {
    let bytes = node.selfSize || 0;
    if (node.children) {
      for (const child of node.children) {
        bytes += countAllocations(child);
      }
    }
    return bytes;
  }

  const totalSampledAllocations = countAllocations(samplingProfile.profile.head);

  console.log('----------------------------------------------------------------');
  console.log(' ALLOCATION PROFILE RESULTS');
  console.log('----------------------------------------------------------------');
  console.log(`Simulated Frames Sampled: ${frameCount} frames (~${(frameCount / 10).toFixed(1)} FPS average)`);
  console.log(`Post-run JSHeapUsedSize : ${(postHeapUsed / (1024 * 1024)).toFixed(3)} MB (${postHeapUsed} bytes)`);
  console.log(`Post-run JSHeapTotalSize: ${(postHeapTotal / (1024 * 1024)).toFixed(3)} MB (${postHeapTotal} bytes)`);
  console.log(`Heap Delta Over 10s     : ${heapDeltaMB >= 0 ? '+' : ''}${heapDeltaMB.toFixed(3)} MB (${heapDeltaBytes >= 0 ? '+' : ''}${heapDeltaBytes} bytes)`);
  console.log(`Per-Frame Net Allocation: ${(heapDeltaBytes / frameCount).toFixed(2)} bytes/frame`);
  console.log(`Per-Tick Net Allocation : ${(heapDeltaBytes / (frameCount * 1.0)).toFixed(2)} bytes/tick`);
  console.log(`Total Sampled Allocations: ${(totalSampledAllocations / 1024).toFixed(2)} KB`);
  console.log('================================================================');

  await browser.close();
  await server.close();
}

runAllocationProfile().catch((err) => {
  console.error('Profiling error:', err);
  process.exit(1);
});
