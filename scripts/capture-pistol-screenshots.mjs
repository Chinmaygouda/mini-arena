import fs from 'node:fs';
import { chromium } from '@playwright/test';

if (!fs.existsSync('artifacts')) {
  fs.mkdirSync('artifacts', { recursive: true });
}

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/?debug=1 ...');
  await page.goto('http://localhost:5173/?debug=1');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(2000);

  // Switch to Tactical Pistol (Key 2)
  console.log('Switching to Tactical Pistol (Digit2)...');
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(1000);

  // 1. Capture Hip
  console.log('Capturing Tactical Pistol Hip View...');
  await page.screenshot({ path: 'artifacts/tactical_pistol_hip.png' });

  // 2. Capture ADS
  console.log('Capturing Tactical Pistol ADS View...');
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'artifacts/tactical_pistol_ads.png' });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(500);

  // 3. Capture Tactical Reload mid-stroke
  console.log('Capturing Tactical Pistol Reload...');
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(600); // 0.6s into 1.6s reload
  await page.screenshot({ path: 'artifacts/tactical_pistol_reload.png' });
  await page.waitForTimeout(1200);

  // 4. Fire until empty to trigger empty reload
  console.log('Emptying magazine to capture Empty Reload Slide Release...');
  for (let i = 0; i < 15; i++) {
    await page.mouse.click(640, 360);
    await page.waitForTimeout(160);
  }
  await page.waitForTimeout(500);

  // Start empty reload
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(1650); // ~78% slide release point (1.638s into 2.1s)
  await page.screenshot({ path: 'artifacts/tactical_pistol_empty_reload_slide.png' });

  await browser.close();
  console.log('All screenshots captured successfully in artifacts/ directory!');
}

capture().catch(console.error);
