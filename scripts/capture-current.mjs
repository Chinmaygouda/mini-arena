import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('docs/screenshots/hands_verified');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-angle=default',
      '--enable-unsafe-webgpu',
    ],
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err));

  console.log('Navigating to http://localhost:5173/?debug=1...');
  await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle', timeout: 30000 });

  // Dismiss lock prompt if present
  try {
    const btn = page.locator('#enter-btn, #btn-enter-arena, button:has-text("ENTER")');
    if (await btn.isVisible({ timeout: 2000 })) {
      await btn.click({ force: true });
    } else {
      await page.mouse.click(640, 360);
    }
  } catch (e) {
    console.log('Click error:', e);
  }
  await page.waitForTimeout(1000);

  // Take screenshot of AK hip
  await page.screenshot({ path: path.join(OUT_DIR, 'test_ak_hip.png') });
  console.log('Saved test_ak_hip.png');

  // Switch to shotgun (Digit4)
  await page.keyboard.press('Digit4');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, 'test_shotgun_hip.png') });
  console.log('Saved test_shotgun_hip.png');

  await browser.close();
}

main().catch(console.error);
