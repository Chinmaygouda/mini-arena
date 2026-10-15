/* global window, performance, requestAnimationFrame, document */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';

async function runBenchmark(urlPath, modeLabel) {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: false, // Real headed mode ensures full GPU hardware composition
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

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  await page.goto(`http://localhost:5199/${urlPath}`);
  await page.waitForFunction(() => typeof window.__playerState !== 'undefined' && typeof window.__threeRenderer !== 'undefined');

  // Dismiss lock prompt overlay
  const prompt = page.locator('#lock-prompt');
  if (await prompt.isVisible()) {
    await prompt.click();
  }
  await page.waitForTimeout(1000); // Allow shaders and textures to settle

  // Probe Context
  const diag = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas ? (canvas.getContext('webgl2') || canvas.getContext('webgl')) : null;
    let unmaskedVendor = 'Unknown';
    let unmaskedRenderer = 'Unknown';
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        unmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
    }
    const r = window.__threeRenderer;
    return {
      backend: window.__renderer,
      calls: r ? r.info.render.calls : 0,
      triangles: r ? r.info.render.triangles : 0,
      unmaskedVendor,
      unmaskedRenderer,
    };
  });

  // Capture Screenshots if WebGPU mode
  const outDir = path.resolve('docs/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  if (modeLabel === 'WebGPU Native') {
    // 1. Hip screenshot
    const hipPath = path.join(outDir, 'phase3_real_chrome_ak_hip.png');
    await page.screenshot({ path: hipPath });

    // 2. Trigger reload and wait for magazine detachment
    await page.evaluate(() => {
      window.__viewmodel.playClip('reloadEmpty', true);
    });
    await page.waitForTimeout(800); // 800ms into reload
    const reloadPath = path.join(outDir, 'phase3_real_chrome_ak_reload.png');
    await page.screenshot({ path: reloadPath });

    // Return to idle
    await page.evaluate(() => {
      window.__viewmodel.playClip('idle', true);
    });
    await page.waitForTimeout(200);
  }

  // Benchmark FPS over 3500ms
  const bench = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      const startTime = performance.now();
      const frameTimes = [];
      let lastTime = startTime;

      function onFrame(now) {
        frames++;
        const delta = now - lastTime;
        frameTimes.push(delta);
        lastTime = now;

        if (now - startTime >= 3500) {
          const totalDuration = now - startTime;
          const avgFps = (frames / totalDuration) * 1000;
          const avgFrameTimeMs = totalDuration / frames;

          frameTimes.sort((a, b) => b - a); // slowest first
          const low1PctIdx = Math.max(1, Math.floor(frameTimes.length * 0.01));
          const low1PctTimes = frameTimes.slice(0, low1PctIdx);
          const low1PercentAvg = low1PctTimes.reduce((a, b) => a + b, 0) / low1PctTimes.length;

          resolve({
            frames,
            totalDuration,
            avgFps,
            avgFrameTimeMs,
            minFps: 1000 / frameTimes[0],
            maxFps: 1000 / frameTimes[frameTimes.length - 1],
            low1PercentFps: 1000 / low1PercentAvg,
          });
        } else {
          requestAnimationFrame(onFrame);
        }
      }

      requestAnimationFrame(onFrame);
    });
  });

  await browser.close();

  return {
    mode: modeLabel,
    diag,
    bench,
  };
}

async function main() {
  const server = await createServer({
    root: 'packages/client',
    server: { port: 5199 },
  });
  await server.listen();

  console.log('Running hardware benchmark on user Intel Graphics GPU in real Chrome...\n');

  const webgpuRes = await runBenchmark('?debug=1', 'WebGPU Native');
  const webgl2Res = await runBenchmark('?forceWebGL=1&debug=1', 'WebGL2 Fallback');

  await server.close();

  console.log('================================================================================');
  console.log(' MINI ARENA — PHASE 3 HARDWARE BENCHMARK (REAL CHROME ON INTEL GRAPHICS)');
  console.log('================================================================================');
  console.log('| Mode | Backend | Draw Calls | Triangles | Avg FPS | Avg Frame Time | 1% Low FPS | Min/Max FPS |');
  console.log('|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|');
  console.log(`| ${webgpuRes.mode.padEnd(15)} | ${webgpuRes.diag.backend.padEnd(8)} | ${String(webgpuRes.diag.calls).padEnd(10)} | ${String(webgpuRes.diag.triangles).padEnd(9)} | ${webgpuRes.bench.avgFps.toFixed(1).padEnd(7)} | ${(webgpuRes.bench.avgFrameTimeMs.toFixed(2) + ' ms').padEnd(14)} | ${webgpuRes.bench.low1PercentFps.toFixed(1).padEnd(10)} | ${webgpuRes.bench.minFps.toFixed(0)} / ${webgpuRes.bench.maxFps.toFixed(0)} FPS |`);
  console.log(`| ${webgl2Res.mode.padEnd(15)} | ${webgl2Res.diag.backend.padEnd(8)} | ${String(webgl2Res.diag.calls).padEnd(10)} | ${String(webgl2Res.diag.triangles).padEnd(9)} | ${webgl2Res.bench.avgFps.toFixed(1).padEnd(7)} | ${(webgl2Res.bench.avgFrameTimeMs.toFixed(2) + ' ms').padEnd(14)} | ${webgl2Res.bench.low1PercentFps.toFixed(1).padEnd(10)} | ${webgl2Res.bench.minFps.toFixed(0)} / ${webgl2Res.bench.maxFps.toFixed(0)} FPS |`);
  console.log('================================================================================\n');
}

main().catch(console.error);
