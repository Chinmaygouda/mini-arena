import { chromium } from '@playwright/test';

async function runCpuProfile() {
  console.log('================================================================');
  console.log(' MEASURING IN-ENGINE CPU FRAME TIME & HEADROOM (1,000 FRAMES)');
  console.log('================================================================');

  // Test with and without allow_unsafe_apis for WebGPU timestamp query
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--enable-dawn-features=allow_unsafe_apis',
      '--use-angle=default',
    ],
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/?debug', { waitUntil: 'networkidle' });

  // Measure 1,000 frames of active CPU loop
  const perfData = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const frameTimes = [];
      const simTimes = [];
      const renderTimes = [];
      let frameCount = 0;

      const renderer = window.__renderer;
      const viewmodel = window.__viewmodel;
      const player = window.__playerState;

      // Sample 1,000 frames
      function sampleFrame() {
        const frameStart = performance.now();

        // 1. Measure simulation & viewmodel animation step
        const simStart = performance.now();
        if (viewmodel) {
          viewmodel.update(1 / 60, false);
        }
        const simEnd = performance.now();
        simTimes.push(simEnd - simStart);

        // 2. Measure GPU render call submission
        const renderStart = performance.now();
        if (renderer && window.__scene && window.__camera) {
          renderer.render(window.__scene, window.__camera);
        }
        const renderEnd = performance.now();
        renderTimes.push(renderEnd - renderStart);

        const frameEnd = performance.now();
        frameTimes.push(frameEnd - frameStart);

        frameCount++;
        if (frameCount < 1000) {
          requestAnimationFrame(sampleFrame);
        } else {
          // Calculate stats
          const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
          const p99 = (arr) => {
            const sorted = [...arr].sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length * 0.99)];
          };
          const max = (arr) => Math.max(...arr);

          resolve({
            frameCount,
            cpuFrameAvgMs: avg(frameTimes),
            cpuFrameP99Ms: p99(frameTimes),
            cpuFrameMaxMs: max(frameTimes),
            simAvgMs: avg(simTimes),
            simP99Ms: p99(simTimes),
            renderAvgMs: avg(renderTimes),
            renderP99Ms: p99(renderTimes),
            webgpuTimestampSupported: !!(navigator.gpu && window.__renderer?.backend?.device?.features?.has?.('timestamp-query')),
          });
        }
      }

      requestAnimationFrame(sampleFrame);
    });
  });

  console.log('Total Sampled Frames :', perfData.frameCount);
  console.log('Total CPU Frame Time  : avg ' + perfData.cpuFrameAvgMs.toFixed(3) + ' ms | p99 ' + perfData.cpuFrameP99Ms.toFixed(3) + ' ms | max ' + perfData.cpuFrameMaxMs.toFixed(3) + ' ms');
  console.log('Simulation / IK Time  : avg ' + perfData.simAvgMs.toFixed(3) + ' ms | p99 ' + perfData.simP99Ms.toFixed(3) + ' ms');
  console.log('Render Submission     : avg ' + perfData.renderAvgMs.toFixed(3) + ' ms | p99 ' + perfData.renderP99Ms.toFixed(3) + ' ms');
  console.log('Frame Budget Headroom : ' + ((16.666 - perfData.cpuFrameAvgMs) / 16.666 * 100).toFixed(1) + '% (at 60 Hz 16.67ms)');
  console.log('WebGPU timestamp-query: ' + (perfData.webgpuTimestampSupported ? 'Supported' : 'Disabled by browser security defaults'));
  console.log('================================================================');

  await browser.close();
}

runCpuProfile().catch(console.error);
