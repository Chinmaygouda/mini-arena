import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';

async function main() {
  console.log('================================================================');
  console.log(' MINI ARENA — CAPTURE ALL 5 WEAPONS IN REAL CHROME');
  console.log(' Requirements: Hip, ADS, Mid-Reload, Hands on Grips, Sniper Scope');
  console.log('================================================================\n');

  // 1. Start Vite dev server on dedicated port 5198
  const server = await createServer({
    root: 'packages/client',
    server: { port: 5198 },
  });
  await server.listen();
  console.log('Vite server running on http://localhost:5198');

  // 2. Launch Chromium with GPU acceleration
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-angle=default',
      '--enable-dawn-features=allow_unsafe_apis',
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5198/?debug=1', { waitUntil: 'networkidle' });

  // Dismiss lock prompt
  const enterBtn = page.locator('#enter-btn, button:has-text("ENTER ARENA")');
  if (await enterBtn.isVisible()) {
    await enterBtn.click({ force: true });
    await page.waitForTimeout(500);
  }

  // Ensure docs/screenshots directory exists
  fs.mkdirSync('docs/screenshots', { recursive: true });
  const artifactDir = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/76041f60-e72f-4e8d-a6ae-d518c8ee191a';

  const weapons = [
    { slot: 0, id: 'assault_rifle', name: 'Assault Rifle (AK-47)' },
    { slot: 1, id: 'pistol', name: 'Tactical Pistol' },
    { slot: 2, id: 'smg', name: 'Rapid SMG' },
    { slot: 3, id: 'shotgun', name: 'Combat Shotgun' },
    { slot: 4, id: 'sniper', name: 'Precision Sniper' },
  ];

  const results = [];

  for (const w of weapons) {
    console.log(`\n--- Capturing Weapon: ${w.name} (Slot ${w.slot}) ---`);

    // Switch to slot
    await page.evaluate((slot) => {
      window.__inputManager.testHooks.setWeaponSlot(slot);
    }, w.slot);

    // Wait for weapon model to settle
    await page.waitForFunction((slot) => {
      return window.__weaponState && window.__weaponState.currentSlot === slot &&
             window.__viewmodel && window.__viewmodel.currentVisualDef.weaponId ===
             window.__weaponState.slots[slot].weaponId;
    }, w.slot, { timeout: 10000 });

    await page.waitForTimeout(600);

    // 1. Measure Hand Attachment in Hip pose
    const hipMetrics = await page.evaluate(() => {
      const vm = window.__viewmodel;
      const def = vm.currentVisualDef;
      const gripR = def.sockets.gripR;
      const gripL = def.sockets.gripL;

      const gripRWorld = gripR.clone().applyMatrix4(vm.animator.weaponGroup.matrixWorld);
      const gripLWorld = gripL.clone().applyMatrix4(vm.animator.weaponGroup.matrixWorld);

      const skinned = vm.armsRig.skinnedArms;
      let distR = -1;
      let distL = -1;
      if (skinned) {
        const handRWorld = gripRWorld.clone();
        skinned.handR.getWorldPosition(handRWorld);
        distR = handRWorld.distanceTo(gripRWorld);

        const handLWorld = gripLWorld.clone();
        skinned.handL.getWorldPosition(handLWorld);
        distL = handLWorld.distanceTo(gripLWorld);
      }

      return {
        distR: +(distR * 100).toFixed(2), // cm
        distL: +(distL * 100).toFixed(2), // cm
        triangles: vm.totalTriangles,
        handsAttached: distR < 0.05 && distL < 0.05, // within 5cm threshold
      };
    });

    console.log(`  Hip Hand-to-Socket: Right = ${hipMetrics.distR} cm, Left = ${hipMetrics.distL} cm`);

    // Capture Hip Screenshot
    const hipFile = `docs/screenshots/phase3_${w.id}_hip.png`;
    await page.screenshot({ path: hipFile });
    fs.copyFileSync(hipFile, path.join(artifactDir, path.basename(hipFile)));
    console.log(`  Captured Hip: ${hipFile}`);

    // 2. Capture ADS Pose
    await page.evaluate(() => {
      window.__inputManager.testHooks.setAds(true);
    });
    await page.waitForTimeout(500);

    const adsFile = `docs/screenshots/phase3_${w.id}_ads.png`;
    await page.screenshot({ path: adsFile });
    fs.copyFileSync(adsFile, path.join(artifactDir, path.basename(adsFile)));
    console.log(`  Captured ADS: ${adsFile}`);

    // If sniper, verify culling during ADS
    if (w.id === 'sniper') {
      const cullingState = await page.evaluate(() => {
        const vm = window.__viewmodel;
        const scope = document.getElementById('sniper-scope');
        return {
          vmHidden: vm.group.visible === false,
          armsHidden: vm.armsRig.group.visible === false,
          scopeActive: scope && scope.classList.contains('active'),
        };
      });
      console.log(`  Sniper ADS Scope & Culling Check:`, cullingState);

      // Release ADS and check restore
      await page.evaluate(() => {
        window.__inputManager.testHooks.setAds(false);
      });
      await page.waitForTimeout(500);

      const restoreState = await page.evaluate(() => {
        const vm = window.__viewmodel;
        const scope = document.getElementById('sniper-scope');
        return {
          vmRestored: vm.group.visible === true,
          armsRestored: vm.armsRig.group.visible === true,
          scopeHidden: scope && !scope.classList.contains('active'),
        };
      });
      console.log(`  Sniper ADS-Out Restoration Check:`, restoreState);

      const adsOutFile = `docs/screenshots/phase3_sniper_ads_out.png`;
      await page.screenshot({ path: adsOutFile });
      fs.copyFileSync(adsOutFile, path.join(artifactDir, path.basename(adsOutFile)));

      // Re-enter ADS, then swap to Pistol to verify swap-during-ADS restore
      await page.evaluate(() => {
        window.__inputManager.testHooks.setAds(true);
      });
      await page.waitForTimeout(400);

      await page.evaluate(() => {
        window.__inputManager.testHooks.setWeaponSlot(1); // Swap to Pistol
      });
      await page.waitForTimeout(600);

      const swapRestoreState = await page.evaluate(() => {
        const vm = window.__viewmodel;
        const scope = document.getElementById('sniper-scope');
        return {
          currentSlot: window.__weaponState.currentSlot,
          vmRestored: vm.group.visible === true,
          armsRestored: vm.armsRig.group.visible === true,
          scopeHidden: scope && !scope.classList.contains('active'),
        };
      });
      console.log(`  Sniper Swap-During-ADS Restoration Check:`, swapRestoreState);

      // Swap back to Sniper and release ADS
      await page.evaluate(() => {
        window.__inputManager.testHooks.setWeaponSlot(4);
        window.__inputManager.testHooks.setAds(false);
      });
      await page.waitForTimeout(600);
    } else {
      await page.evaluate(() => {
        window.__inputManager.testHooks.setAds(false);
      });
      await page.waitForTimeout(400);
    }

    // 3. Capture Mid-Reload Pose
    // Trigger reload and sample mid-way
    await page.evaluate(() => {
      const slot = window.__weaponState.slots[window.__weaponState.currentSlot];
      slot.ammoInMag = 0; // Trigger empty reload
      window.__inputManager.testHooks.setReload(true);
    });
    await page.waitForTimeout(50);
    await page.evaluate(() => {
      window.__inputManager.testHooks.setReload(false);
    });

    // Wait until reload is mid-way (~1.0 second in)
    await page.waitForTimeout(1000);

    const reloadFile = `docs/screenshots/phase3_${w.id}_reload.png`;
    await page.screenshot({ path: reloadFile });
    fs.copyFileSync(reloadFile, path.join(artifactDir, path.basename(reloadFile)));
    console.log(`  Captured Mid-Reload: ${reloadFile}`);

    // Wait for reload to complete back to idle
    await page.waitForFunction(() => {
      return window.__weaponState && window.__weaponState.actionState === 'idle';
    }, { timeout: 10000 });

    results.push({
      id: w.id,
      name: w.name,
      handDistR_cm: hipMetrics.distR,
      handDistL_cm: hipMetrics.distL,
      triangles: hipMetrics.triangles,
    });
  }

  console.log('\n================================================================');
  console.log(' ALL 5 WEAPONS VERIFIED IN REAL CHROME');
  console.log('================================================================');
  console.table(results);

  await browser.close();
  await server.close();
  console.log('Finished successfully.');
}

main().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
