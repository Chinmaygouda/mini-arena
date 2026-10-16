import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('docs/screenshots/hands_verified');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function runSuite() {
  console.log('=== STARTING RIGID HAND-TO-GUN IK VERIFICATION SUITE ===');

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=default', '--enable-unsafe-webgpu'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('BROWSER ERROR:', msg.text());
    }
  });

  async function dismissOverlay() {
    try {
      const btn = page.locator('#btn-enter-arena, #enter-btn');
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ force: true });
      } else {
        await page.mouse.click(640, 360);
      }
    } catch {
      // Ignore click error if prompt already dismissed
    }
    await page.evaluate(() => {
      const el = document.getElementById('lock-prompt');
      if (el) el.style.display = 'none';
    });
    await page.waitForTimeout(500);
  }

  console.log('-> Navigating to http://localhost:5173/?debug=1...');
  await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
  await dismissOverlay();

  // 1. FAST MOUSE SWEEP & HISTORY INDEPENDENCE TEST IN BROWSER
  console.log('-> Running 5s extreme mouse sweep & history independence test in engine...');
  const testResults = await page.evaluate(async () => {
    const vm = window.__viewmodel;
    const input = window.__inputManager;
    const arms = vm.armsRig.skinnedArms;
    if (!arms) throw new Error('Skinned arms not initialized');

    const results = {
      sweepSamples: 0,
      maxWristSocketDistR: 0,
      maxWristSocketDistL: 0,
      elbowAboveWristViolations: 0,
      hasNaN: false,
      historyMaxDiff: 0,
    };

    // Baseline start transforms at clipTime 0
    vm.animator.clipTime = 0;
    vm.update(1 / 60, false, 'idle');

    const initialBones = {
      upperR: arms.upperArmR.quaternion.clone(),
      foreR: arms.forearmR.quaternion.clone(),
      handR: arms.handR.quaternion.clone(),
      upperL: arms.upperArmL.quaternion.clone(),
      foreL: arms.forearmL.quaternion.clone(),
      handL: arms.handL.quaternion.clone(),
    };

    const socketWorldR = new window.THREE.Vector3();
    const socketWorldL = new window.THREE.Vector3();
    const wristWorldR = new window.THREE.Vector3();
    const wristWorldL = new window.THREE.Vector3();
    const elbowWorldR = new window.THREE.Vector3();
    const elbowWorldL = new window.THREE.Vector3();

    // 5-second simulated sweep across yaw/pitch extremes
    const totalFrames = 300; // 5s @ 60 Hz
    for (let f = 0; f < totalFrames; f++) {
      const t = f / 60;
      // Oscillate yaw between -75 deg and +75 deg, pitch between -60 deg and +60 deg
      input.yaw = Math.sin(t * 8.0) * (75 * Math.PI / 180);
      input.pitch = Math.cos(t * 6.0) * (60 * Math.PI / 180);

      // Randomly toggle ADS, fire, or reload
      if (f % 90 === 30) input.isAds = true;
      if (f % 90 === 60) input.isAds = false;
      if (f % 60 === 0) input.isFiring = true;
      if (f % 60 === 5) input.isFiring = false;

      // Force step viewmodel
      vm.update(1 / 60, input.isAds, 'idle');

      // Check socket distances
      vm.animator.socketR.getWorldPosition(socketWorldR);
      vm.animator.socketL.getWorldPosition(socketWorldL);
      arms.handR.getWorldPosition(wristWorldR);
      arms.handL.getWorldPosition(wristWorldL);
      arms.forearmR.getWorldPosition(elbowWorldR);
      arms.forearmL.getWorldPosition(elbowWorldL);

      const palmWorldR = arms.handR.localToWorld(vm.armsRig.palmOffsetLocalR.clone());
      const palmWorldL = arms.handL.localToWorld(vm.armsRig.palmOffsetLocalL.clone());

      const distR = palmWorldR.distanceTo(socketWorldR);
      const distL = palmWorldL.distanceTo(socketWorldL);

      results.maxPalmSocketDistR = Math.max(results.maxPalmSocketDistR || 0, distR);
      results.maxPalmSocketDistL = Math.max(results.maxPalmSocketDistL || 0, distL);

      // Check NaN
      if (isNaN(distR) || isNaN(distL) || isNaN(arms.handR.quaternion.x)) {
        results.hasNaN = true;
      }

      // Check elbow height relative to wrist (elbow must not flip into sky above wrist in camera space)
      const camera = window.__camera;
      const camSpaceElbowR = elbowWorldR.clone().applyMatrix4(camera.matrixWorldInverse);
      const camSpaceWristR = wristWorldR.clone().applyMatrix4(camera.matrixWorldInverse);
      if (camSpaceElbowR.y > camSpaceWristR.y + 0.15) {
        results.elbowAboveWristViolations++;
      }

      results.sweepSamples++;
    }

    // Reset look to zero and let viewmodel recoil spring settle back to rest
    input.yaw = 0;
    input.pitch = 0;
    input.isAds = false;
    input.isFiring = false;
    for (let s = 0; s < 60; s++) {
      vm.update(1 / 60, false, 'idle');
    }
    // Set exact same clipTime as baseline
    vm.animator.clipTime = 0;
    vm.update(1 / 60, false, 'idle');

    // Compare with initial transforms
    const diffUpperR = arms.upperArmR.quaternion.clone().normalize().angleTo(initialBones.upperR.clone().normalize());
    const diffForeR = arms.forearmR.quaternion.clone().normalize().angleTo(initialBones.foreR.clone().normalize());
    const diffHandR = arms.handR.quaternion.clone().normalize().angleTo(initialBones.handR.clone().normalize());
    const diffUpperL = arms.upperArmL.quaternion.clone().normalize().angleTo(initialBones.upperL.clone().normalize());
    const diffForeL = arms.forearmL.quaternion.clone().normalize().angleTo(initialBones.foreL.clone().normalize());
    const diffHandL = arms.handL.quaternion.clone().normalize().angleTo(initialBones.handL.clone().normalize());

    results.diffDetails = { diffUpperR, diffForeR, diffHandR, diffUpperL, diffForeL, diffHandL };
    results.historyMaxDiff = Math.max(diffUpperR, diffForeR, diffHandR, diffUpperL, diffForeL, diffHandL);

    return results;
  });

  console.log('-> Fast mouse sweep test results:');
  console.log(`   Samples tested: ${testResults.sweepSamples}`);
  console.log(`   Max Right Palm-to-Socket Distance: ${(testResults.maxPalmSocketDistR * 100).toFixed(4)} cm (budget <= 1.2 cm)`);
  console.log(`   Max Left Palm-to-Socket Distance: ${(testResults.maxPalmSocketDistL * 100).toFixed(4)} cm (budget <= 1.2 cm)`);
  console.log(`   Elbow sky-flip violations: ${testResults.elbowAboveWristViolations} (must be 0)`);
  console.log(`   Has NaN/Inf: ${testResults.hasNaN} (must be false)`);
  console.log(`   History Independence max bone angle diff: ${testResults.historyMaxDiff.toExponential(4)} rad (must be < 1e-4)`);
  console.log('   Details:', testResults.diffDetails);

  // Assertions
  if (testResults.maxPalmSocketDistR > 0.012) {
    throw new Error(`Right palm-to-socket distance exceeded 1.2 cm: ${(testResults.maxPalmSocketDistR * 100).toFixed(3)} cm`);
  }
  if (testResults.maxPalmSocketDistL > 0.012) {
    throw new Error(`Left palm-to-socket distance exceeded 1.2 cm: ${(testResults.maxPalmSocketDistL * 100).toFixed(3)} cm`);
  }
  if (testResults.elbowAboveWristViolations > 0) {
    throw new Error(`Elbow flipped above wrist ${testResults.elbowAboveWristViolations} times`);
  }
  if (testResults.historyMaxDiff > 1e-4) {
    throw new Error(`History independence violated: bone angle diff ${testResults.historyMaxDiff} > 1e-4`);
  }
  if (testResults.hasNaN) {
    throw new Error('NaN detected during mouse sweep simulation');
  }

  // 2. CAPTURE 8 REQUIRED REAL-CHROME SCREENSHOTS FOR AK-47
  console.log('\n-> Capturing 8 Real-Chrome Screenshots for AK-47...');

  // Reset to neutral
  await page.evaluate(() => {
    const input = window.__inputManager;
    input.yaw = 0;
    input.pitch = 0;
    input.isAds = false;
  });
  await page.keyboard.press('Digit1'); // AK-47
  await page.waitForTimeout(600);

  // 1. Hip neutral
  await page.screenshot({ path: path.join(OUT_DIR, 'ak_01_hip.png') });
  console.log('   Saved ak_01_hip.png');

  // 2. ADS
  await page.evaluate(() => { window.__inputManager.isAds = true; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, 'ak_02_ads.png') });
  console.log('   Saved ak_02_ads.png');
  await page.evaluate(() => { window.__inputManager.isAds = false; });
  await page.waitForTimeout(300);

  // 3. Look up (+60 deg = -1.047 rad pitch)
  await page.evaluate(() => { window.__inputManager.pitch = -1.047; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, 'ak_03_look_up.png') });
  console.log('   Saved ak_03_look_up.png');

  // 4. Look down (-60 deg = +1.047 rad pitch)
  await page.evaluate(() => { window.__inputManager.pitch = 1.047; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, 'ak_04_look_down.png') });
  console.log('   Saved ak_04_look_down.png');

  // 5. Look hard left/right (yaw = 75 deg = 1.309 rad)
  await page.evaluate(() => {
    window.__inputManager.pitch = 0;
    window.__inputManager.yaw = 1.309;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, 'ak_05_look_hard.png') });
  console.log('   Saved ak_05_look_hard.png');

  // Reset look
  await page.evaluate(() => { window.__inputManager.yaw = 0; });
  await page.waitForTimeout(200);

  // 6. Mid-reload (Empty reload - mag out)
  await page.evaluate(() => {
    window.__viewmodel.playClip('reloadEmpty');
  });
  // Advance to mid-reload (~1.2s into 2.5s clip)
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT_DIR, 'ak_06_mid_reload.png') });
  console.log('   Saved ak_06_mid_reload.png');

  // 7. End of reload (~2.3s into clip, racking charging handle)
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(OUT_DIR, 'ak_07_end_reload.png') });
  console.log('   Saved ak_07_end_reload.png');

  // 8. Outside Side View of Viewmodel (Verifies elbow pole & arm connection)
  await page.goto('http://localhost:5173/?debug=1&vmCam=side', { waitUntil: 'networkidle' });
  await dismissOverlay();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, 'ak_08_side_vmCam.png') });
  console.log('   Saved ak_08_side_vmCam.png');

  // 3. CAPTURE 8 REQUIRED REAL-CHROME SCREENSHOTS FOR COMBAT SHOTGUN
  console.log('\n-> Capturing 8 Real-Chrome Screenshots for Combat Shotgun...');

  await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
  await dismissOverlay();
  await page.keyboard.press('Digit4'); // Shotgun
  await page.waitForTimeout(800);

  // 1. Hip neutral
  await page.screenshot({ path: path.join(OUT_DIR, 'shotgun_01_hip.png') });
  console.log('   Saved shotgun_01_hip.png');

  // 2. ADS
  await page.evaluate(() => { window.__inputManager.isAds = true; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, 'shotgun_02_ads.png') });
  console.log('   Saved shotgun_02_ads.png');
  await page.evaluate(() => { window.__inputManager.isAds = false; });
  await page.waitForTimeout(300);

  // 3. Look up
  await page.evaluate(() => { window.__inputManager.pitch = -1.047; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, 'shotgun_03_look_up.png') });
  console.log('   Saved shotgun_03_look_up.png');

  // 4. Look down
  await page.evaluate(() => { window.__inputManager.pitch = 1.047; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, 'shotgun_04_look_down.png') });
  console.log('   Saved shotgun_04_look_down.png');

  // 5. Look hard left/right
  await page.evaluate(() => {
    window.__inputManager.pitch = 0;
    window.__inputManager.yaw = 1.309;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, 'shotgun_05_look_hard.png') });
  console.log('   Saved shotgun_05_look_hard.png');

  // Reset look
  await page.evaluate(() => { window.__inputManager.yaw = 0; });
  await page.waitForTimeout(200);

  // 6. Mid-reload (Shell insert into tube port)
  await page.evaluate(() => {
    window.__viewmodel.playClip('reloadShellInsert');
  });
  await page.waitForTimeout(320); // 32/60s clip, commit at 20 ticks (~330ms)
  await page.screenshot({ path: path.join(OUT_DIR, 'shotgun_06_mid_reload.png') });
  console.log('   Saved shotgun_06_mid_reload.png');

  // 7. End of reload (Pump slide racked forward)
  await page.evaluate(() => {
    window.__viewmodel.playClip('reloadShellEnd');
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT_DIR, 'shotgun_07_end_reload.png') });
  console.log('   Saved shotgun_07_end_reload.png');

  // 8. Outside Side View of Shotgun Viewmodel
  await page.goto('http://localhost:5173/?debug=1&vmCam=side', { waitUntil: 'networkidle' });
  await dismissOverlay();
  await page.keyboard.press('Digit4');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, 'shotgun_08_side_vmCam.png') });
  console.log('   Saved shotgun_08_side_vmCam.png');

  await browser.close();
  console.log('\n=== VERIFICATION SUITE COMPLETE: ALL TESTS PASSED & SCREENSHOTS SAVED ===');
}

runSuite().catch(err => {
  console.error('VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
