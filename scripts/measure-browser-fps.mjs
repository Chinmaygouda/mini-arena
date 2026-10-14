/* global window, performance, requestAnimationFrame */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';

async function measureInBrowserFPS() {
  const server = await createServer({
    root: 'packages/client',
    server: { port: 5198 },
  });
  await server.listen();

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--no-sandbox'],
  });
  const page = await browser.newPage();

  let transferredBytes = 0;
  page.on('response', async (response) => {
    try {
      const buffer = await response.body();
      transferredBytes += buffer.length;
    } catch {
      // Ignore aborts
    }
  });

  await page.goto('http://localhost:5198/?debug=1');
  await page.waitForFunction(() => typeof window.__playerState !== 'undefined');

  // Dismiss lock prompt overlay
  const prompt = page.locator('#lock-prompt');
  if (await prompt.isVisible()) {
    await prompt.click();
  }
  await page.waitForTimeout(500);

  // Query Viewmodel & Triangle Stats
  const viewmodelInfo = await page.evaluate(() => {
    const vm = window.__viewmodel;
    const renderer = window.__renderer;
    return {
      rendererType: renderer ? (renderer.isWebGPURenderer ? 'WebGPU' : 'WebGL2 Fallback') : 'Unknown',
      totalTriangles: vm ? vm.totalTriangles : 0,
      activeClip: vm ? vm.animator.getCurrentClipName() : 'unknown',
    };
  });

  // Capture screenshot of Assault Rifle & Arms in hip rest pose
  const outDir = path.resolve('docs/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const hipScreenshot = path.join(outDir, 'phase3_ar_hip.png');
  await page.screenshot({ path: hipScreenshot });

  // Trigger Inspect clip (KeyF) and capture screenshot
  await page.evaluate(() => {
    window.__viewmodel.playClip('inspect', true);
  });
  await page.waitForTimeout(600);
  const inspectScreenshot = path.join(outDir, 'phase3_ar_inspect.png');
  await page.screenshot({ path: inspectScreenshot });

  // Trigger Reload clip and capture screenshot of detached magazine & arm IK
  await page.evaluate(() => {
    window.__viewmodel.playClip('reloadEmpty', true);
  });
  await page.waitForTimeout(900); // During mag drop / detach phase
  const reloadScreenshot = path.join(outDir, 'phase3_ar_reload_mag_drop.png');
  await page.screenshot({ path: reloadScreenshot });

  // Return to idle
  await page.evaluate(() => {
    window.__viewmodel.playClip('idle', true);
  });

  // Measure frames directly inside browser requestAnimationFrame loop for 3000ms
  const fpsStats = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      const startTime = performance.now();
      const frameTimes = [];
      let lastTime = startTime;

      function onFrame(now) {
        frames++;
        frameTimes.push(now - lastTime);
        lastTime = now;

        if (now - startTime >= 3000) {
          const totalDuration = now - startTime;
          const avgFps = (frames / totalDuration) * 1000;
          const avgFrameTimeMs = totalDuration / frames;
          resolve({ frames, totalDuration, avgFps, avgFrameTimeMs });
        } else {
          requestAnimationFrame(onFrame);
        }
      }

      requestAnimationFrame(onFrame);
    });
  });

  console.log('================================================================');
  console.log(' MINI ARENA — PHASE 3 ASSAULT RIFLE VERTICAL SLICE BENCHMARK');
  console.log('================================================================');
  console.log(`Renderer Backend        : ${viewmodelInfo.rendererType}`);
  console.log(`Viewmodel Triangles     : ${viewmodelInfo.totalTriangles.toLocaleString()} triangles (Assault Rifle + Arms Rig)`);
  console.log(`Budget Triangle Limit   : 300,000 visible triangles (AR uses ${(viewmodelInfo.totalTriangles / 3000).toFixed(2)}% of budget)`);
  console.log(`Initial Asset Transfer  : ${(transferredBytes / 1024).toFixed(1)} KB (Budget: ≤ 25,000 KB)`);
  console.log(`Measured Duration       : ${(fpsStats.totalDuration / 1000).toFixed(2)} seconds`);
  console.log(`Rendered Frames         : ${fpsStats.frames} frames`);
  console.log(`Average In-Browser FPS  : ${fpsStats.avgFps.toFixed(1)} FPS`);
  console.log(`Average Frame Time      : ${fpsStats.avgFrameTimeMs.toFixed(2)} ms`);
  console.log('Screenshots Saved:');
  console.log(`  - Hip Rest Pose       : ${hipScreenshot}`);
  console.log(`  - Inspect Chamber     : ${inspectScreenshot}`);
  console.log(`  - Mag Drop / Reload   : ${reloadScreenshot}`);
  console.log('================================================================');

  await browser.close();
  await server.close();
}

measureInBrowserFPS().catch(console.error);
