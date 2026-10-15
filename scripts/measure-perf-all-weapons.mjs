import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';

async function main() {
  console.log('================================================================================');
  console.log(' MINI ARENA — HARDWARE & VIEWMODEL PERF RE-MEASUREMENT PER WEAPON');
  console.log('================================================================================\n');

  // 1. Production Bundle Size Measurement
  console.log('--- 1. Production Bundle & Asset Transfer Analysis ---');
  const distDir = 'packages/client/dist';
  let totalDistBytes = 0;
  let jsGzipBytes = 0;
  let htmlBytes = 0;

  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir, { recursive: true });
    for (const f of files) {
      const fullPath = path.join(distDir, f.toString());
      if (fs.statSync(fullPath).isFile()) {
        const size = fs.statSync(fullPath).size;
        totalDistBytes += size;
        if (f.toString().endsWith('.js')) {
          const content = fs.readFileSync(fullPath);
          jsGzipBytes += zlib.gzipSync(content).length;
        } else if (f.toString().endsWith('.html')) {
          htmlBytes += size;
        }
      }
    }
  }

  // Model files in public/models
  const modelsDir = 'packages/client/public/models';
  const glbFiles = [
    { name: 'ak47.glb', size: fs.statSync(path.join(modelsDir, 'ak47.glb')).size },
    { name: 'pistol.glb', size: fs.statSync(path.join(modelsDir, 'pistol.glb')).size },
    { name: 'smg.glb', size: fs.statSync(path.join(modelsDir, 'smg.glb')).size },
    { name: 'shotgun.glb', size: fs.statSync(path.join(modelsDir, 'shotgun.glb')).size },
    { name: 'sniper.glb', size: fs.statSync(path.join(modelsDir, 'sniper.glb')).size },
    { name: 'arms_rig.glb', size: fs.statSync(path.join(modelsDir, 'arms_rig.glb')).size },
  ];
  const totalGlbBytes = glbFiles.reduce((acc, g) => acc + g.size, 0);

  console.log(`Production JS (raw)     : ${(totalDistBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Production JS (gzip)    : ${(jsGzipBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`HTML Entry              : ${(htmlBytes / 1024).toFixed(2)} KB`);
  console.log(`All 5 GLBs + Arms Rig   : ${(totalGlbBytes / (1024 * 1024)).toFixed(2)} MB uncompressed`);
  console.log(`Total Initial Wire Size : ${((jsGzipBytes + htmlBytes + totalGlbBytes) / (1024 * 1024)).toFixed(2)} MB (Budget: 25.00 MB)\n`);

  // 2. Start Vite server on port 5197
  const server = await createServer({
    root: 'packages/client',
    server: { port: 5197 },
  });
  await server.listen();

  // 3. Launch Chrome with hardware acceleration
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-gpu',
      '--use-gl=angle',
      '--use-angle=default',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5197/?debug=1', { waitUntil: 'networkidle' });

  // Dismiss lock prompt
  const enterBtn = page.locator('#enter-btn, button:has-text("ENTER ARENA")');
  if (await enterBtn.isVisible()) {
    await enterBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);

  const weapons = [
    { slot: 0, id: 'assault_rifle', name: 'Assault Rifle (AK-47)' },
    { slot: 1, id: 'pistol', name: 'Tactical Pistol' },
    { slot: 2, id: 'smg', name: 'Rapid SMG' },
    { slot: 3, id: 'shotgun', name: 'Combat Shotgun' },
    { slot: 4, id: 'sniper', name: 'Precision Sniper' },
  ];

  const perfResults = [];

  for (const w of weapons) {
    // Switch weapon
    await page.evaluate((slot) => {
      window.__inputManager.testHooks.setWeaponSlot(slot);
    }, w.slot);

    await page.waitForTimeout(800);

    // Measure 300 active frames
    const data = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const frameTimes = [];
        const simTimes = [];
        const renderTimes = [];
        let count = 0;

        const vm = window.__viewmodel;
        const renderer = window.__renderer;

        function step() {
          const fStart = performance.now();

          // Simulation step
          const sStart = performance.now();
          if (vm) vm.update(1 / 60, false);
          const sEnd = performance.now();
          simTimes.push(sEnd - sStart);

          // Render step
          const rStart = performance.now();
          if (renderer && window.__scene && window.__camera) {
            renderer.render(window.__scene, window.__camera);
          }
          const rEnd = performance.now();
          renderTimes.push(rEnd - rStart);

          const fEnd = performance.now();
          frameTimes.push(fEnd - fStart);

          count++;
          if (count < 300) {
            requestAnimationFrame(step);
          } else {
            const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
            const p99 = (arr) => {
              const s = [...arr].sort((a, b) => a - b);
              return s[Math.floor(s.length * 0.99)];
            };

            const sceneTris = renderer?.info?.render?.triangles ?? 0;
            const sceneCalls = renderer?.info?.render?.calls ?? 0;

            resolve({
              cpuAvgMs: avg(frameTimes),
              cpuP99Ms: p99(frameTimes),
              simAvgMs: avg(simTimes),
              renderAvgMs: avg(renderTimes),
              vmTriangles: vm ? vm.totalTriangles : 0,
              sceneTris,
              sceneCalls,
            });
          }
        }
        requestAnimationFrame(step);
      });
    });

    const fps = +(1000 / Math.max(16.666, data.cpuAvgMs)).toFixed(1);
    perfResults.push({
      weapon: w.name,
      triangles: data.vmTriangles,
      sceneTris: data.sceneTris,
      drawCalls: data.sceneCalls,
      cpuAvgMs: +data.cpuAvgMs.toFixed(3),
      cpuP99Ms: +data.cpuP99Ms.toFixed(3),
      simAvgMs: +data.simAvgMs.toFixed(3),
      renderAvgMs: +data.renderAvgMs.toFixed(3),
      headroomPct: +(((16.666 - data.cpuAvgMs) / 16.666) * 100).toFixed(1),
    });
  }

  console.log('--- 2. In-Engine Per-Weapon Performance Metrics (Hardware Composition) ---');
  console.table(perfResults);

  await browser.close();
  await server.close();
}

main().catch(console.error);
