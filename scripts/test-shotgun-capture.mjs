import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('docs/screenshots/hands_verified');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function testShotgunGrip() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=default', '--enable-unsafe-webgpu'],
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
  await page.mouse.click(640, 360);
  await page.waitForTimeout(500);

  // Switch to shotgun
  await page.keyboard.press('Digit4');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(OUT_DIR, 'test_shotgun_hip_updated.png') });
  console.log('Saved test_shotgun_hip_updated.png');
  await browser.close();
}

testShotgunGrip().catch(console.error);
