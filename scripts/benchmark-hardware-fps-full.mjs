import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { preview } from '../packages/client/node_modules/vite/dist/node/index.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function measureRaf30s(page, durationSec = 30) {
  return await page.evaluate(async (targetDuration) => {
    return new Promise((resolve) => {
      const intervals = [];
      let lastTime = performance.now();
      const startTime = lastTime;
      let framesOver20ms = 0;

      function onFrame(now) {
        const delta = now - lastTime;
        intervals.push(delta);
        if (delta > 20.0) framesOver20ms++;
        lastTime = now;

        if (now - startTime >= targetDuration * 1000) {
          intervals.sort((a, b) => a - b);
          const sum = intervals.reduce((acc, v) => acc + v, 0);
          const mean = sum / intervals.length;
          const p95 = intervals[Math.floor(intervals.length * 0.95)];
          const p99 = intervals[Math.floor(intervals.length * 0.99)];
          const fps = 1000 / mean;

          const r = window.__threeRenderer;
          const vm = window.__viewmodel;
          const ws = window.__weaponState;

          resolve({
            totalFrames: intervals.length,
            durationMs: now - startTime,
            meanIntervalMs: +mean.toFixed(2),
            p95IntervalMs: +p95.toFixed(2),
            p99IntervalMs: +p99.toFixed(2),
            effectiveFps: +fps.toFixed(1),
            framesOver20ms,
            framesOver20msPct: +((framesOver20ms / intervals.length) * 100).toFixed(2),
            equippedSlot: ws ? ws.currentSlot : -1,
            gunTriangles: vm ? vm.gunTriangles : 0,
            armsTriangles: vm ? vm.armsTriangles : 0,
            totalTriangles: vm ? vm.totalTriangles : 0,
            drawCalls: r ? r.info.render.calls : 0,
          });
        } else {
          requestAnimationFrame(onFrame);
        }
      }
      requestAnimationFrame(onFrame);
    });
  }, durationSec);
}

async function equipWeapon(page, slot) {
  await page.evaluate((targetSlot) => {
    window.__inputManager.testHooks.setWeaponSlot(targetSlot);
  }, slot);

  // Wait for weapon swap state machine to complete and viewmodel to update
  await page.waitForFunction((s) => {
    const ws = window.__weaponState;
    return ws && ws.currentSlot === s && ws.actionState === 'idle';
  }, slot, { timeout: 5000 });

  // Settle frame
  await page.waitForTimeout(300);
}

async function runSession() {
  console.log('================================================================');
  console.log(' MINI ARENA — PHASE 3 HARDWARE FPS & GPU HYPOTHESIS BENCHMARK');
  console.log('================================================================\n');

  // 1. Launch Vite Preview Server
  const previewServer = await preview({
    root: 'packages/client',
    preview: { port: 5198 },
  });
  console.log('Vite preview server running on http://localhost:5198\n');

  const weapons = [
    { slot: 0, id: 'assault_rifle', name: 'Assault Rifle (AK-47)' },
    { slot: 1, id: 'pistol', name: 'Tactical Pistol' },
    { slot: 2, id: 'smg', name: 'Rapid SMG' },
    { slot: 3, id: 'shotgun', name: 'Combat Shotgun' },
    { slot: 4, id: 'sniper', name: 'Precision Sniper' },
  ];

  // Benchmark A: Vsync-locked (Default Chrome flags, real Chrome, DevTools closed)
  console.log('----------------------------------------------------------------');
  console.log(' BENCHMARK 1: Vsync-Locked (Real Chrome, DevTools Closed, 30s per weapon)');
  console.log('----------------------------------------------------------------');

  const browserVsync = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: [
      '--enable-gpu',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--no-sandbox',
    ],
  });

  const pageVsync = await browserVsync.newPage({ viewport: { width: 1280, height: 720 } });
  await pageVsync.goto('http://localhost:5198/?debug=1');
  await pageVsync.waitForFunction(() => typeof window.__viewmodel !== 'undefined');
  await pageVsync.evaluate(() => window.__viewmodel.modelsLoaded);

  // Dismiss overlay prompt
  const prompt = pageVsync.locator('#lock-prompt');
  if (await prompt.isVisible()) await prompt.click();
  await pageVsync.waitForTimeout(1000);

  const vsyncResults = [];
  for (const w of weapons) {
    console.log(`Testing ${w.name} (slot ${w.slot}) for 30s vsync-locked...`);
    await equipWeapon(pageVsync, w.slot);
    const data = await measureRaf30s(pageVsync, 30);
    vsyncResults.push({
      weapon: w.name,
      ...data,
    });
  }
  console.table(vsyncResults);
  await browserVsync.close();

  // Benchmark B: Uncapped FPS (--disable-gpu-vsync --disable-frame-rate-limit)
  console.log('\n----------------------------------------------------------------');
  console.log(' BENCHMARK 2: Uncapped FPS (--disable-gpu-vsync --disable-frame-rate-limit)');
  console.log('----------------------------------------------------------------');

  const browserUncapped = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: [
      '--enable-gpu',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--ignore-gpu-blocklist',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--no-sandbox',
    ],
  });

  const pageUncapped = await browserUncapped.newPage({ viewport: { width: 1280, height: 720 } });
  await pageUncapped.goto('http://localhost:5198/?debug=1');
  await pageUncapped.waitForFunction(() => typeof window.__viewmodel !== 'undefined');
  await pageUncapped.evaluate(() => window.__viewmodel.modelsLoaded);

  const promptUncapped = pageUncapped.locator('#lock-prompt');
  if (await promptUncapped.isVisible()) await promptUncapped.click();
  await pageUncapped.waitForTimeout(1000);

  const uncappedResults = [];
  for (const w of weapons) {
    console.log(`Testing ${w.name} uncapped for 10s...`);
    await equipWeapon(pageUncapped, w.slot);
    const data = await measureRaf30s(pageUncapped, 10);
    uncappedResults.push({
      weapon: w.name,
      ...data,
    });
  }
  console.table(uncappedResults);
  await browserUncapped.close();

  // Benchmark C: GPU Hypotheses at renderScale = 0.5, dpr = 1.0 vs 2.0, MSAA on/off
  console.log('\n----------------------------------------------------------------');
  console.log(' BENCHMARK 3: GPU Hypotheses (renderScale 0.5, DPR 1.0/2.0, Antialias)');
  console.log('----------------------------------------------------------------');

  const configs = [
    { label: 'renderScale=0.5 (Uncapped)', url: 'http://localhost:5198/?debug=1&renderScale=0.5' },
    { label: 'renderScale=1.0, DPR=1.0 (Uncapped)', url: 'http://localhost:5198/?debug=1&dpr=1' },
    { label: 'renderScale=1.0, DPR=2.0 (Uncapped)', url: 'http://localhost:5198/?debug=1&dpr=2' },
    { label: 'Antialias OFF (MSAA 0) (Uncapped)', url: 'http://localhost:5198/?debug=1&antialias=0' },
  ];

  const hypothesisBrowser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: [
      '--enable-gpu',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--ignore-gpu-blocklist',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--no-sandbox',
    ],
  });

  const hypothesisResults = [];
  for (const c of configs) {
    console.log(`Testing hypothesis: ${c.label}...`);
    const page = await hypothesisBrowser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(c.url);
    await page.waitForFunction(() => typeof window.__viewmodel !== 'undefined');
    await page.evaluate(() => window.__viewmodel.modelsLoaded);

    const p = page.locator('#lock-prompt');
    if (await p.isVisible()) await p.click();
    await page.waitForTimeout(1000);

    // Test with Assault Rifle
    const data = await measureRaf30s(page, 10);
    hypothesisResults.push({
      config: c.label,
      effectiveFps: data.effectiveFps,
      meanIntervalMs: data.meanIntervalMs,
      p95IntervalMs: data.p95IntervalMs,
      p99IntervalMs: data.p99IntervalMs,
      framesOver20ms: data.framesOver20ms,
    });
    await page.close();
  }
  console.table(hypothesisResults);
  await hypothesisBrowser.close();

  await previewServer.close();
  console.log('\nAll benchmarks complete!');
}

runSession().catch((err) => {
  console.error(err);
  process.exit(1);
});
