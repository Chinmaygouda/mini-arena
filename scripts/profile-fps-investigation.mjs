import { chromium } from '@playwright/test';

async function profilePerformance() {
  console.log('--- 1. Testing Default Headless Chromium (as in previous capture) ---');
  const browser1 = await chromium.launch({ headless: true });
  const page1 = await browser1.newPage();

  const errors1 = [];
  page1.on('pageerror', (err) => errors1.push(err.message));
  page1.on('console', (msg) => {
    if (msg.type() === 'error') errors1.push(msg.text());
  });

  await page1.goto('http://localhost:5173/?debug=1');
  await page1.waitForFunction(() => window.__viewmodel && window.__viewmodel.modelsLoaded);
  await page1.keyboard.press('Digit2'); // Pistol
  await page1.waitForTimeout(1000);

  // Measure RAF rate over 5 seconds in default headless
  const statsDefault = await page1.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const deltas = [];
      let last = start;
      function loop(now) {
        frames++;
        deltas.push(now - last);
        last = now;
        if (now - start >= 5000) {
          const dur = now - start;
          const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
          const maxDelta = Math.max(...deltas);
          const minDelta = Math.min(...deltas);
          resolve({
            frames,
            durationMs: dur,
            avgFps: (frames / dur) * 1000,
            avgFrameTimeMs: avgDelta,
            minFrameTimeMs: minDelta,
            maxFrameTimeMs: maxDelta,
          });
        } else {
          requestAnimationFrame(loop);
        }
      }
      requestAnimationFrame(loop);
    });
  });

  console.log('Default Headless Result:');
  console.log(`  Frames: ${statsDefault.frames} over ${(statsDefault.durationMs / 1000).toFixed(2)}s`);
  console.log(`  Avg FPS: ${statsDefault.avgFps.toFixed(2)} FPS`);
  console.log(`  Avg Frame Time: ${statsDefault.avgFrameTimeMs.toFixed(2)} ms`);
  console.log(`  Errors: ${errors1.length}`);
  await browser1.close();

  console.log('\n--- 2. Testing GPU-Accelerated / Active Flags Headless Chromium ---');
  const browser2 = await chromium.launch({
    headless: true,
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
  const page2 = await browser2.newPage();

  const errors2 = [];
  page2.on('pageerror', (err) => errors2.push(err.message));
  page2.on('console', (msg) => {
    if (msg.type() === 'error') errors2.push(msg.text());
  });

  await page2.goto('http://localhost:5173/?debug=1');
  await page2.waitForFunction(() => window.__viewmodel && window.__viewmodel.modelsLoaded);
  await page2.keyboard.press('Digit2'); // Pistol
  await page2.waitForTimeout(1000);

  // Measure RAF rate over 10 seconds
  const statsGPU = await page2.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      const deltas = [];
      let last = start;
      function loop(now) {
        frames++;
        deltas.push(now - last);
        last = now;
        if (now - start >= 10000) {
          const dur = now - start;
          const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
          const maxDelta = Math.max(...deltas);
          const minDelta = Math.min(...deltas);
          resolve({
            frames,
            durationMs: dur,
            avgFps: (frames / dur) * 1000,
            avgFrameTimeMs: avgDelta,
            minFrameTimeMs: minDelta,
            maxFrameTimeMs: maxDelta,
          });
        } else {
          requestAnimationFrame(loop);
        }
      }
      requestAnimationFrame(loop);
    });
  });

  console.log('GPU/Unthrottled Headless 10-Second Result:');
  console.log(`  Frames: ${statsGPU.frames} over ${(statsGPU.durationMs / 1000).toFixed(2)}s`);
  console.log(`  Avg FPS: ${statsGPU.avgFps.toFixed(2)} FPS`);
  console.log(`  Avg Frame Time: ${statsGPU.avgFrameTimeMs.toFixed(2)} ms`);
  console.log(`  Min Frame Time: ${statsGPU.minFrameTimeMs.toFixed(2)} ms`);
  console.log(`  Max Frame Time: ${statsGPU.maxFrameTimeMs.toFixed(2)} ms`);
  console.log(`  Errors: ${errors2.length}`);
  await browser2.close();

  // Try real headed Google Chrome if available
  console.log('\n--- 3. Testing Real Headed Google Chrome (if installed) ---');
  try {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser3 = await chromium.launch({
      executablePath: chromePath,
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
    const page3 = await browser3.newPage();
    await page3.goto('http://localhost:5173/?debug=1');
    await page3.waitForFunction(() => window.__viewmodel && window.__viewmodel.modelsLoaded);
    await page3.keyboard.press('Digit2'); // Pistol
    await page3.waitForTimeout(1000);

    const statsChrome = await page3.evaluate(async () => {
      return new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        const deltas = [];
        let last = start;
        function loop(now) {
          frames++;
          deltas.push(now - last);
          last = now;
          if (now - start >= 10000) {
            const dur = now - start;
            const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
            resolve({
              frames,
              durationMs: dur,
              avgFps: (frames / dur) * 1000,
              avgFrameTimeMs: avgDelta,
            });
          } else {
            requestAnimationFrame(loop);
          }
        }
        requestAnimationFrame(loop);
      });
    });

    console.log('Real Headed Chrome 10-Second Result:');
    console.log(`  Frames: ${statsChrome.frames} over ${(statsChrome.durationMs / 1000).toFixed(2)}s`);
    console.log(`  Avg FPS: ${statsChrome.avgFps.toFixed(2)} FPS`);
    console.log(`  Avg Frame Time: ${statsChrome.avgFrameTimeMs.toFixed(2)} ms`);
    await browser3.close();
  } catch (err) {
    console.log('Real Chrome headed test skipped or failed:', err.message);
  }
}

profilePerformance().catch(console.error);
