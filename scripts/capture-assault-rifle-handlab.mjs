import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('docs/hand_system/captures/assault_rifle');
await mkdir(out, { recursive: true });

const url = process.env.HANDLAB_URL ?? 'http://127.0.0.1:5173/?handlab=1&forceWebGL=1';
console.log(`Launching Chromium to capture Assault Rifle Hand Lab states from: ${url}`);

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== '0',
  args: ['--use-angle=default', '--enable-unsafe-webgpu'],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: out, size: { width: 1440, height: 900 } },
});

const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for viewmodel and skinned arms rig to be initialized
  await page.waitForFunction(
    () => Boolean(
      window.__viewmodel?.currentVisualDef?.weaponId === 'assault_rifle' &&
      window.__viewmodel?.armsRig?.skinnedArms
    ),
    { timeout: 60000 }
  );

  // Remove pointer lock prompt modal completely
  await page.evaluate(() => {
    document.getElementById('lock-prompt')?.remove();
  });

  // Let diagnostics and models stabilize
  await page.waitForTimeout(600);

  // 1. Hip / Idle
  console.log('Capturing 01_hip.png...');
  await page.screenshot({ path: path.join(out, '01_hip.png') });

  // 2. ADS (Aim Down Sights)
  console.log('Capturing 02_ads.png...');
  await page.locator('[data-clip="ads"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, '02_ads.png') });

  // 3. Side Inspection Camera
  console.log('Capturing 03_side.png...');
  await page.locator('[data-preset="side"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, '03_side.png') });

  // 4. Top Inspection Camera
  console.log('Capturing 04_top.png...');
  await page.locator('[data-preset="top"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, '04_top.png') });

  // 5. Front Inspection Camera
  console.log('Capturing 05_front.png...');
  await page.locator('[data-preset="front"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, '05_front.png') });

  // Switch back to FPS camera for reload and dynamic states
  await page.locator('[data-preset="fps"]').click();
  await page.waitForTimeout(200);

  // 6. Tactical Reload
  console.log('Capturing 06_tactical_reload_mid.png...');
  await page.locator('[data-action="tactical"]').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, '06_tactical_reload_mid.png') });
  await page.waitForTimeout(1600); // Allow tactical reload to finish

  // 7. Empty Reload & Bolt Operation
  console.log('Capturing 07_empty_reload_bolt.png...');
  await page.locator('[data-action="empty"]').click();
  await page.waitForTimeout(1200); // Bolt pulling phase
  await page.screenshot({ path: path.join(out, '07_empty_reload_bolt.png') });
  await page.waitForTimeout(1600); // Allow empty reload to finish

  // 8. Fire / Recoil Impulse
  console.log('Capturing 08_recoil_impulse.png...');
  await page.locator('[data-clip="fire"]').click();
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(out, '08_recoil_impulse.png') });
  await page.waitForTimeout(300);

  // 9. Grip Socket & Elbow Markers Overlay
  console.log('Capturing 09_markers_overlay.png...');
  await page.locator('[data-control="sockets"]').check();
  await page.locator('[data-control="elbows"]').check();
  await page.locator('[data-clip="idle"]').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, '09_markers_overlay.png') });

  // Turn off markers
  await page.locator('[data-control="sockets"]').uncheck();
  await page.locator('[data-control="elbows"]').uncheck();

  // 10. Sprint Lowering
  console.log('Capturing 10_sprint_lower.png...');
  await page.locator('[data-clip="sprint"]').click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(out, '10_sprint_lower.png') });

  // 11. Mouse Sweep Test
  console.log('Running 5-second mouse sweep...');
  await page.locator('[data-action="sweep"]').click();
  await page.waitForTimeout(5200);

  if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
  console.log('All 10 production screenshots captured successfully in ' + out);
} finally {
  const video = page.video();
  await context.close();
  if (video) {
    const dest = path.join(out, 'assault_rifle_handlab.webm');
    await video.saveAs(dest);
    console.log('Browser session video saved as: ' + dest);
  }
  await browser.close();
}
