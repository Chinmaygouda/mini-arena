import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('docs/screenshots/maps');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runPhase5Audit() {
  console.log('=== MINI ARENA PHASE 5 MAPS & ART VERIFICATION SUITE ===');
  const browser = await chromium.launch({
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

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[Browser Error] ${msg.text()}`);
    }
  });
  const auditResults = {
    date: new Date().toISOString(),
    phase: 5,
    maps: {},
    leakTest: {},
  };

  const mapIds = ['warehouse', 'plaza', 'containeryard'];

  for (const mapId of mapIds) {
    console.log(`\n--- Testing Map: ${mapId} ---`);
    const startLoad = performance.now();
    await page.goto(`http://localhost:5173/?map=${mapId}&debug=1`);

    // Dismiss enter arena overlay if present
    const enterBtn = page.locator('#btn-enter-arena');
    if (await enterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await enterBtn.click();
    }

    await page.waitForFunction(() => typeof window.__mapSession !== 'undefined');
    const loadTimeMs = performance.now() - startLoad;

    // Wait 500ms for stable render loop
    await page.waitForTimeout(500);

    // Measure scene metrics
    const metrics = await page.evaluate(async () => {
      const renderer = window.__threeRenderer;
      const session = window.__mapSession;
      const physics = window.__physics;

      // Sample 60 frames for FPS
      const frameTimes = [];
      let lastTime = performance.now();

      for (let i = 0; i < 60; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = performance.now();
        frameTimes.push(now - lastTime);
        lastTime = now;
      }

      frameTimes.sort((a, b) => a - b);
      const medianMs = frameTimes[Math.floor(frameTimes.length / 2)] || 16.6;
      const avgFps = 1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length);
      const lowIndex = Math.min(frameTimes.length - 1, Math.floor(frameTimes.length * 0.99));
      const onePercentLowFps = 1000 / frameTimes[lowIndex];

      // Measure single-frame draw calls and triangles accurately
      const beforeCalls = renderer.info.render.calls;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const singleFrameCalls = renderer.info.render.calls - beforeCalls;
      const singleFrameTriangles = renderer.info.render.triangles;

      return {
        mapId: session.spec.id,
        mapName: session.spec.name,
        boxCount: session.spec.boxes.length,
        rampCount: session.spec.ramps.length,
        colliderCount: session.colliders.length,
        rigidBodyCount: session.rigidBodies.length,
        rapierTotalBodies: physics.world.bodies.len(),
        rapierTotalColliders: physics.world.colliders.len(),
        triangles: singleFrameTriangles,
        drawCalls: singleFrameCalls,
        avgFps,
        onePercentLowFps,
        medianMs,
      };
    });

    console.log(`Map: ${metrics.mapName}`);
    console.log(`  Load Time: ${loadTimeMs.toFixed(1)}ms`);
    console.log(`  Draw Calls: ${metrics.drawCalls} (Budget <= 250)`);
    console.log(`  Triangles: ${metrics.triangles} (Budget <= 120k Low / 300k High)`);
    console.log(`  Rapier Colliders: ${metrics.colliderCount}`);
    console.log(`  Avg FPS: ${metrics.avgFps.toFixed(1)} | 1% Low: ${metrics.onePercentLowFps.toFixed(1)} FPS`);

    // Capture first-person screenshot
    const fpScreenshot = path.join(SCREENSHOT_DIR, `${mapId}_firstperson.png`);
    await page.screenshot({ path: fpScreenshot });
    console.log(`  Saved FP screenshot: ${fpScreenshot}`);

    // Elevate camera for top-down tactical overview screenshot
    await page.evaluate(() => {
      const camera = window.__camera;
      if (camera) {
        camera.position.set(0, 32, 0);
        camera.rotation.set(-Math.PI / 2, 0, 0);
      }
    });
    await page.waitForTimeout(100);

    const tdScreenshot = path.join(SCREENSHOT_DIR, `${mapId}_topdown.png`);
    await page.screenshot({ path: tdScreenshot });
    console.log(`  Saved Top-Down screenshot: ${tdScreenshot}`);

    auditResults.maps[mapId] = {
      ...metrics,
      loadTimeMs,
      screenshots: [`${mapId}_firstperson.png`, `${mapId}_topdown.png`],
    };
  }

  // 10x Consecutive Load/Unload Leak Test
  console.log('\n--- Running 10x Consecutive Map Transition Leak Test ---');
  const leakTestResult = await page.evaluate(async () => {
    const loader = window.__mapLoader;
    const physics = window.__physics;
    const initialBodies = physics.world.bodies.len();
    const initialColliders = physics.world.colliders.len();

    const sequence = ['warehouse', 'plaza', 'containeryard'];

    for (let cycle = 0; cycle < 10; cycle++) {
      for (const mId of sequence) {
        window.__switchMap(mId);
      }
    }

    // Return to warehouse and check final counts
    window.__switchMap('warehouse');
    const finalBodies = physics.world.bodies.len();
    const finalColliders = physics.world.colliders.len();

    return {
      cycles: 10,
      totalTransitions: 31,
      initialBodies,
      initialColliders,
      finalBodies,
      finalColliders,
      bodiesMatch: initialBodies === finalBodies,
      collidersMatch: initialColliders === finalColliders,
    };
  });

  console.log('Leak Test Results:');
  console.log(`  Total Transitions: ${leakTestResult.totalTransitions}`);
  console.log(`  Initial Bodies: ${leakTestResult.initialBodies} | Final Bodies: ${leakTestResult.finalBodies}`);
  console.log(`  Initial Colliders: ${leakTestResult.initialColliders} | Final Colliders: ${leakTestResult.finalColliders}`);
  console.log(`  Zero Physics Body Leaks: ${leakTestResult.bodiesMatch}`);
  console.log(`  Zero Physics Collider Leaks: ${leakTestResult.collidersMatch}`);

  auditResults.leakTest = leakTestResult;

  // Save audit JSON
  const auditPath = path.resolve('docs/gates/phase5_audit.json');
  fs.writeFileSync(auditPath, JSON.stringify(auditResults, null, 2));
  console.log(`\nAudit saved to: ${auditPath}`);

  await browser.close();
}

runPhase5Audit().catch((err) => {
  console.error('Phase 5 Audit failed:', err);
  process.exit(1);
});
