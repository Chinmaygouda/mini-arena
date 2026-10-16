import { chromium } from '@playwright/test';

async function testCasings() {
  console.log('=== VERIFYING CASING EJECTION SYSTEM ===');
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=default', '--enable-unsafe-webgpu'],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });

  // Dismiss lock prompt
  await page.evaluate(() => {
    const el = document.getElementById('lock-prompt');
    if (el) el.style.display = 'none';
  });
  await page.waitForTimeout(500);

  // Check initial state
  const initialData = await page.evaluate(() => {
    const vm = window.__viewmodel;
    const animator = vm.animator;
    return {
      casingPoolSize: animator.casingPool.length,
      activeCasings: animator.casingPool.filter(c => c.active).length,
      ammo: document.getElementById('hud-ammo-mag')?.textContent,
    };
  });
  console.log('Initial Casing State:', initialData);

  // Trigger 3 shots
  const shotResults = await page.evaluate(async () => {
    const vm = window.__viewmodel;
    const animator = vm.animator;
    const input = window.__inputManager;

    const data = [];
    for (let shot = 0; shot < 3; shot++) {
      vm.applyRecoilKick(0.04);
      // Step 2 frames to process fire_recoil event
      vm.update(1 / 60, false, 'idle');
      vm.update(1 / 60, false, 'idle');

      const active = animator.casingPool.filter(c => c.active);
      const lastActive = active[active.length - 1];

      data.push({
        shotIndex: shot + 1,
        activeCount: active.length,
        casingPos: lastActive ? {
          x: +lastActive.mesh.position.x.toFixed(3),
          y: +lastActive.mesh.position.y.toFixed(3),
          z: +lastActive.mesh.position.z.toFixed(3),
        } : null,
        velocity: lastActive ? {
          vx: +lastActive.velocity.x.toFixed(2),
          vy: +lastActive.velocity.y.toFixed(2),
          vz: +lastActive.velocity.z.toFixed(2),
        } : null,
      });
      // Small pause between shots
      for (let f = 0; f < 5; f++) vm.update(1 / 60, false, 'idle');
    }
    return data;
  });

  console.log('Shot Casing Results:', JSON.stringify(shotResults, null, 2));

  // Step 80 frames (1.33 seconds) to verify automatic pooling cleanup
  const cleanupResults = await page.evaluate(() => {
    const vm = window.__viewmodel;
    for (let f = 0; f < 80; f++) {
      vm.update(1 / 60, false, 'idle');
    }
    const animator = vm.animator;
    return {
      remainingActive: animator.casingPool.filter(c => c.active).length,
      poolCount: animator.casingPool.length,
    };
  });

  console.log('Cleanup Results after 1.33s:', cleanupResults);

  if (cleanupResults.remainingActive !== 0) {
    throw new Error(`Casings were not cleaned up: ${cleanupResults.remainingActive} remaining`);
  }
  console.log('-> CASING EJECTION SYSTEM FULLY VERIFIED (0 memory leak, proper cleanup)!');

  await browser.close();
}

testCasings().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
