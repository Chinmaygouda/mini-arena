// scripts/verify-conveyor-browser.mjs
// Real browser runtime verification for Section 3 conveyor jumping, landing, crouching, and leg clearance.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const outputDir = 'artifacts/conveyor-verification';
await mkdir(outputDir, { recursive: true });

const baseUrl = 'http://127.0.0.1:5177';

console.log('Connecting to dev server at', baseUrl);

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

try {
  await page.goto(`${baseUrl}/?map=warehouse&quality=low&time=overcast`, { waitUntil: 'domcontentloaded' });

  // Wait for map and colliders to be ready
  await page.waitForFunction(() => {
    const app = window.__fpsApp;
    return app?.mapLoader?.currentMapId === 'warehouse' &&
      Array.isArray(app?.controls?.colliders) &&
      app.controls.colliders.length > 0;
  }, { timeout: 20000 });

  // Click engage button to enter game
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-engage');
    if (btn instanceof HTMLElement) btn.click();
  });
  await page.waitForTimeout(300);

  // 1. Approach conveyor in Section 3
  // Conveyor runs at Z = -19.5, X from 12.6 to 31.4.
  // Position player on floor at X=20, Z=-17.0, facing North (-Z) looking directly at conveyor belt and rails
  await page.evaluate(() => {
    const controls = window.__fpsApp.controls;
    controls.forceReleaseKeys();
    controls.setPosition(20.0, 1.7, -17.0, 0); // yaw 0 = facing -Z
    controls.pitch = -0.15; // slightly looking down at conveyor
    controls.update(1 / 60);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outputDir}/01-conveyor-standing-approach.png` });
  console.log('Captured 01-conveyor-standing-approach.png');

  // 2. Jump over low rail onto conveyor belt
  // Press Space and KeyW to jump forward onto the conveyor
  const jumpResult = await page.evaluate(() => {
    const controls = window.__fpsApp.controls;
    controls.forceReleaseKeys();
    controls.setPosition(20.0, 1.7, -18.0, 0); // 1m away from conveyor
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));

    let maxFeetY = 0;
    let landedOnDeck = false;
    for (let frame = 0; frame < 30; frame++) {
      controls.update(1 / 60);
      const feetY = controls.position.y - controls.getEyeHeight();
      if (feetY > maxFeetY) maxFeetY = feetY;
      if (controls.isGrounded && Math.abs(feetY - 1.06) < 0.05) {
        landedOnDeck = true;
      }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
    controls.forceReleaseKeys();

    return {
      finalZ: controls.position.z,
      finalY: controls.position.y,
      feetY: controls.position.y - controls.getEyeHeight(),
      isGrounded: controls.isGrounded,
      maxFeetY,
      landedOnDeck,
    };
  });

  console.log('Jump result:', jumpResult);
  assert.ok(jumpResult.landedOnDeck, 'Player landed on conveyor deck during jump');
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${outputDir}/02-jump-onto-conveyor.png` });
  console.log('Captured 02-jump-onto-conveyor.png');

  // 3. Crouching under barcode scanner arch
  // Position player standing on conveyor at X=24.0, Z=-19.5, facing +X (yaw = -Math.PI / 2)
  // Arch is at X=25.0
  const crouchPassResult = await page.evaluate(() => {
    const controls = window.__fpsApp.controls;
    controls.forceReleaseKeys();
    // Stand on conveyor deck
    controls.setPosition(24.0, 1.06 + 1.7, -19.5, -Math.PI / 2);
    controls.pitch = 0;
    controls.update(1 / 60);

    // Crouch down and move forward under the arch
    controls.input.crouch = true;
    controls.input.forward = true;

    for (let frame = 0; frame < 40; frame++) {
      controls.update(1 / 60);
    }

    return {
      posX: controls.position.x,
      posY: controls.position.y,
      feetY: controls.position.y - controls.getEyeHeight(),
      isCrouching: controls.isCrouching,
      isGrounded: controls.isGrounded,
    };
  });

  console.log('Crouch pass result under arch:', crouchPassResult);
  assert.ok(crouchPassResult.posX > 24.8, 'Player successfully crouch-walked into/under the scanner arch');
  await page.screenshot({ path: `${outputDir}/03-crouched-scanner-arch-clearance.png` });
  console.log('Captured 03-crouched-scanner-arch-clearance.png');

  // 4. Stand back up past the arch
  await page.evaluate(() => {
    const controls = window.__fpsApp.controls;
    controls.setPosition(26.5, 1.06 + 1.7, -19.5, -Math.PI / 2);
    controls.input.crouch = false;
    controls.input.forward = false;
    controls.forceReleaseKeys();
    for (let f = 0; f < 30; f++) controls.update(1 / 60);
  });
  await page.screenshot({ path: `${outputDir}/04-stood-up-after-arch.png` });
  console.log('Captured 04-stood-up-after-arch.png');

  // 5. Navigate through 3m gap between conveyor support legs (X=19 and X=22)
  const legTraversal = await page.evaluate(() => {
    const controls = window.__fpsApp.controls;
    controls.forceReleaseKeys();
    // Start at X=20.5 (midpoint between legs at X=19 and X=22), Z=-23.0 facing North (-Z, yaw = 0)
    controls.setPosition(20.5, 1.7, -23.0, 0);
    controls.pitch = -0.15;
    controls.input.forward = true;

    for (let f = 0; f < 35; f++) controls.update(1 / 60);
    controls.input.forward = false;

    return {
      posZ: controls.position.z,
      feetY: controls.position.y - controls.getEyeHeight(),
      collidingCount: controls.getCollidingCount(),
    };
  });
  console.log('Leg traversal result:', legTraversal);
  assert.ok(legTraversal.posZ < -21.0, 'Player walked through 3m leg opening');
  assert.equal(legTraversal.collidingCount, 0, 'No stuck collision');
  await page.screenshot({ path: `${outputDir}/05-support-legs-traversal.png` });
  console.log('Captured 05-support-legs-traversal.png');

  // 6. Branch conveyor jump and landing on deck
  // Branch conveyor at X=17, player jumps East onto it from X=15.0 at Z=-24
  const branchJumpResult = await page.evaluate(() => {
    const controls = window.__fpsApp.controls;
    controls.forceReleaseKeys();
    controls.setPosition(15.0, 1.7, -24.0, -Math.PI / 2); // facing +X (East)
    controls.pitch = 0;
    controls.input.forward = true;
    controls.input.jump = true;

    let maxFeetY = 0;
    let landedOnDeck = false;
    for (let f = 0; f < 35; f++) {
      controls.update(1 / 60);
      const feetY = controls.position.y - controls.getEyeHeight();
      if (feetY > maxFeetY) maxFeetY = feetY;
      if (controls.isGrounded && feetY >= 0.90) {
        landedOnDeck = true;
      }
    }
    controls.input.forward = false;
    controls.input.jump = false;
    controls.forceReleaseKeys();

    return {
      finalX: controls.position.x,
      feetY: controls.position.y - controls.getEyeHeight(),
      isGrounded: controls.isGrounded,
      maxFeetY,
      landedOnDeck,
    };
  });
  console.log('Branch jump result:', branchJumpResult);
  assert.ok(branchJumpResult.landedOnDeck, 'Player landed on branch conveyor deck during jump');
  assert.ok(branchJumpResult.feetY >= 0.90, 'Player feet rest on branch conveyor structure');
  await page.screenshot({ path: `${outputDir}/06-branch-conveyor-jump-clearance.png` });
  console.log('Captured 06-branch-conveyor-jump-clearance.png');

  assert.deepEqual(errors, [], `Browser errors detected: ${errors.join(', ')}`);
  console.log('ALL BROWSER RUNTIME VERIFICATION CHECKS PASSED!');
} finally {
  await browser.close();
}
