import fs from 'node:fs';
import { chromium } from '@playwright/test';

if (!fs.existsSync('artifacts')) {
  fs.mkdirSync('artifacts', { recursive: true });
}

async function capture() {
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/?debug=1 ...');
  await page.goto('http://localhost:5173/?debug=1');
  await page.waitForSelector('canvas');

  // Dismiss lock overlay
  await page.evaluate(() => {
    const el = document.getElementById('lock-prompt');
    if (el) el.style.display = 'none';
  });

  // Await 3D weapon models to finish loading
  console.log('Awaiting 3D models and skinned arms initialization...');
  await page.waitForFunction(() => window.__viewmodel && window.__viewmodel.modelsLoaded);
  await page.evaluate(() => window.__viewmodel.modelsLoaded);
  await page.waitForFunction(() => window.__viewmodel.armsRig?.skinnedArms !== null);
  console.log('Skinned arms & models ready!');

  // Switch to Tactical Pistol (Key 2)
  console.log('Switching to Tactical Pistol (Digit2)...');
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(1000);

  // Warm-up frames to stabilize stats-gl counter at true 60 FPS
  console.log('Warming up rendering frames for stats-gl stabilization...');
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let frames = 0;
      function loop() {
        frames++;
        if (frames > 150) {
          resolve();
        } else {
          requestAnimationFrame(loop);
        }
      }
      requestAnimationFrame(loop);
    });
  });
  await page.waitForTimeout(500);

  // 1. Capture Hip View
  console.log('Capturing Tactical Pistol Hip View...');
  await page.screenshot({ path: 'artifacts/tactical_pistol_hip.png' });

  // 2. Capture ADS View
  console.log('Capturing Tactical Pistol ADS View...');
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(600); // allow FOV zoom & lerp to settle
  await page.screenshot({ path: 'artifacts/tactical_pistol_ads.png' });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(600);

  // 3. Close-up: Right-Hand Finger Contact (Beavertail, wrap, index finger)
  console.log('Capturing Close-up: Right-Hand Grip Contact...');
  await page.evaluate(() => {
    if (!window.__rightCam) {
      window.__rightCam = new window.THREE.PerspectiveCamera(40, 1280 / 720, 0.01, 100);
      window.__camera.add(window.__rightCam);
    }
    window.__rightCam.position.set(0.38, -0.10, -0.15);
    window.__rightCam.userData = { target: new window.THREE.Vector3(0.13, -0.18, -0.24) };
    window.__debugCamera = window.__rightCam;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/tactical_pistol_right_contact.png' });

  // 4. Close-up: Left-Hand Support Contact (Left palm, support wrap, thumb along frame)
  console.log('Capturing Close-up: Left-Hand Support Contact...');
  await page.evaluate(() => {
    if (!window.__leftCam) {
      window.__leftCam = new window.THREE.PerspectiveCamera(40, 1280 / 720, 0.01, 100);
      window.__camera.add(window.__leftCam);
    }
    window.__leftCam.position.set(-0.10, -0.08, -0.15);
    window.__leftCam.userData = { target: new window.THREE.Vector3(0.13, -0.18, -0.24) };
    window.__debugCamera = window.__leftCam;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/tactical_pistol_left_contact.png' });

  // Reset viewmodel positioning and camera back to first-person
  await page.evaluate(() => {
    window.__debugCamera = null;
  });
  await page.waitForTimeout(300);

  // 5. Capture Tactical Reload mid-stroke (magazine extracted, left hand handling mag)
  console.log('Setting ammo to 8/36 and capturing Tactical Pistol Reload...');
  await page.evaluate(() => {
    window.__weaponState.slots[1].ammoInMag = 8;
  });
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => window.__weaponState.actionState === 'reloading_tactical');
  await page.waitForTimeout(600); // 0.6s into 1.6s reload: magazine extracted
  await page.screenshot({ path: 'artifacts/tactical_pistol_reload.png' });
  await page.waitForFunction(() => window.__weaponState.actionState === 'idle');
  console.log('Tactical reload complete, returning to idle.');
  await page.waitForTimeout(200);

  // 6. Capture Final Post-Reload Grip
  console.log('Capturing Tactical Pistol Post-Reload Grip...');
  await page.screenshot({ path: 'artifacts/tactical_pistol_post_reload.png' });

  // 7. Empty reload: slide locked back, new mag inserted, thumb at slide release
  console.log('Setting ammo to 0/36 and capturing Empty Reload Slide Release...');
  await page.evaluate(() => {
    window.__weaponState.slots[1].ammoInMag = 0;
  });
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => window.__weaponState.actionState === 'reloading_empty');
  await page.waitForTimeout(1450); // ~1.45s into 2.1s reload: slide locked back & thumb at release
  await page.screenshot({ path: 'artifacts/tactical_pistol_empty_reload_slide.png' });
  await page.waitForFunction(() => window.__weaponState.actionState === 'idle');
  console.log('Empty reload complete!');

  await browser.close();
  console.log('All screenshots captured successfully in artifacts/ directory!');
}

capture().catch(console.error);

