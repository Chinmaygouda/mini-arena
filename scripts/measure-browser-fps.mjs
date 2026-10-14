/* global window, performance, requestAnimationFrame */
import { chromium } from '@playwright/test';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';

async function measureInBrowserFPS() {
  const server = await createServer({
    root: 'packages/client',
    server: { port: 5197 },
  });
  await server.listen();

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5197/?debug=1');
  await page.waitForFunction(() => typeof window.__playerState !== 'undefined');

  // Measure frames directly inside browser requestAnimationFrame loop for 5000ms
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

        if (now - startTime >= 5000) {
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
  console.log(' IN-BROWSER ANIMATION LOOP PERFORMANCE (HEADLESS CHROMIUM)');
  console.log('================================================================');
  console.log(`Measured Duration  : ${(fpsStats.totalDuration / 1000).toFixed(2)} seconds`);
  console.log(`Rendered Frames    : ${fpsStats.frames} frames`);
  console.log(`Average Frame Rate : ${fpsStats.avgFps.toFixed(1)} FPS`);
  console.log(`Average Frame Time : ${fpsStats.avgFrameTimeMs.toFixed(2)} ms`);
  console.log('================================================================');

  await browser.close();
  await server.close();
}

measureInBrowserFPS().catch(console.error);
