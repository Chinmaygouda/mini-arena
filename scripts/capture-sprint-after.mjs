// scripts/capture-sprint-after.mjs
// Captures after-implementation sprint frame strips for all 5 weapons.
// Saves to artifacts directory as sprint_{weapon}_after_{phase}.png
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/5618d13b-17a0-4ad6-8787-4ecd7ffd8f73';
const BASE_URL = 'http://localhost:5174/?map=range';

const WEAPONS = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];
const WEAPON_KEYS = { ak47: '1', pistol: '2', smg: '3', shotgun: '4', sniper: '5' };

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function capture(page, name) {
  const p = path.join(ARTIFACTS, name);
  await page.screenshot({ path: p });
  console.log(`Saved: ${name}`);
  return p;
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);

  // Override pointer lock so we can control without real user gesture
  await page.evaluate(() => {
    HTMLElement.prototype.requestPointerLock = function() {};
    document.exitPointerLock = () => {};
    Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true });
    // Trigger the lock event so the game thinks we have pointer lock
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await sleep(500);

  const results = {};

  for (const weapon of WEAPONS) {
    console.log(`\n=== Capturing: ${weapon} ===`);
    const key = WEAPON_KEYS[weapon];

    // Select weapon
    await page.keyboard.press(key);
    await sleep(600);

    // 1. IDLE
    await capture(page, `sprint_${weapon}_after_1_idle.png`);

    // 2. Sprint START — press Shift, capture ~80ms in
    await page.keyboard.down('KeyW');
    await page.keyboard.down('ShiftLeft');
    await sleep(80);
    await capture(page, `sprint_${weapon}_after_2_start.png`);

    // 3. STEADY sprint — 600ms in
    await sleep(600);
    await capture(page, `sprint_${weapon}_after_3_steady.png`);

    // 4. Sprint STOP — release Shift, capture ~100ms after
    await page.keyboard.up('ShiftLeft');
    await sleep(100);
    await capture(page, `sprint_${weapon}_after_4_stop.png`);

    await page.keyboard.up('KeyW');
    await sleep(500);

    results[weapon] = {
      idle: path.join(ARTIFACTS, `sprint_${weapon}_after_1_idle.png`),
      sprint_start: path.join(ARTIFACTS, `sprint_${weapon}_after_2_start.png`),
      steady_sprint: path.join(ARTIFACTS, `sprint_${weapon}_after_3_steady.png`),
      sprint_stop: path.join(ARTIFACTS, `sprint_${weapon}_after_4_stop.png`),
    };
  }

  await browser.close();
  console.log('\nAll after-implementation frame strips captured.');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
