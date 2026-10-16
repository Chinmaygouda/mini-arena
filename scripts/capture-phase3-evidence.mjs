import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACT_DIR = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/76041f60-e72f-4e8d-a6ae-d518c8ee191a';
const OUT_DIR = path.resolve('docs/screenshots/phase3');

const WEAPONS = [
  { slot: 0, id: 'assault_rifle', hudName: 'Assault Rifle', title: 'AK-47 Assault Rifle' },
  { slot: 1, id: 'pistol', hudName: 'Tactical Pistol', title: 'Tactical Pistol' },
  { slot: 2, id: 'smg', hudName: 'Rapid SMG', title: 'Rapid SMG' },
  { slot: 3, id: 'shotgun', hudName: 'Combat Shotgun', title: 'Combat Shotgun' },
  { slot: 4, id: 'sniper', hudName: 'Precision Sniper', title: 'Precision Sniper' },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('Output directory:', OUT_DIR);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-angle=default',
      '--enable-dawn-features=allow_unsafe_apis',
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  console.log('Navigating to http://localhost:5173/?debug=1 ...');
  await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });

  // Wait until viewmodel and skinned arms rig are fully initialized
  await page.waitForFunction(() => {
    return window.__viewmodel && window.__viewmodel.armsRig && window.__viewmodel.armsRig.skinnedArms;
  }, { timeout: 15000 });

  // Completely remove lock screen prompt so canvas is 100% visible and unblurred
  await page.evaluate(() => {
    document.getElementById('lock-prompt')?.remove();
    window.__debugCamera = null;
  });

  await page.waitForTimeout(500);

  const capturedImages = [];

  for (const w of WEAPONS) {
    console.log(`\n========================================================`);
    console.log(`Processing Weapon: ${w.title} (Slot ${w.slot})`);
    console.log(`========================================================`);

    // Synchronize weapon slot, active visual def, and HUD
    await page.evaluate((target) => {
      const ws = window.__weaponState;
      const vm = window.__viewmodel;
      ws.currentSlot = target.slot;
      ws.actionState = 'idle';
      ws.stateTimer = 0;
      ws.stateTicksRemaining = 0;
      ws.isAiming = false;

      const def = vm.visualDefs[target.id];
      if (def) {
        vm.currentVisualDef = def;
        vm.animator.setVisualDef(def);
        const offsets = vm.weaponOffsets[target.id];
        if (offsets) {
          vm.hipPos.copy(offsets.hip);
          vm.adsPos.copy(offsets.ads);
        }
      }

      window.__debugCamera = null;

      const hudName = document.getElementById('hud-weapon-name');
      if (hudName) {
        hudName.textContent = target.hudName;
      }
    }, w);

    // Verify HUD name and visual definition match
    await page.waitForFunction((target) => {
      const vm = window.__viewmodel;
      const hud = document.getElementById('hud-weapon-name');
      return vm && vm.currentVisualDef && vm.currentVisualDef.weaponId === target.id &&
             hud && hud.textContent && hud.textContent.trim().toLowerCase() === target.hudName.toLowerCase();
    }, w, { timeout: 5000 });

    await page.waitForTimeout(300);

    // Helper to capture a first-person screenshot with verified HUD
    async function capturePose(poseName, setupFn) {
      await page.evaluate(setupFn, w);
      await page.waitForTimeout(300);

      const hudText = await page.evaluate(() => {
        const hName = document.getElementById('hud-weapon-name')?.textContent?.trim() || '';
        const hAction = document.getElementById('hud-weapon-action')?.textContent?.trim() || '';
        const vmId = window.__viewmodel?.currentVisualDef?.weaponId || '';
        const isDebugCam = Boolean(window.__debugCamera);
        return { hName, hAction, vmId, isDebugCam };
      });

      if (hudText.isDebugCam) {
        throw new Error(`CRITICAL: debugCamera was active during first-person capture of ${w.id} ${poseName}`);
      }

      console.log(`  -> [${w.id}] Pose '${poseName}' HUD: "${hudText.hName}" (action: ${hudText.hAction}, viewmodel: ${hudText.vmId})`);

      const filename = `${w.id}_${poseName}.png`;
      const localPath = path.join(OUT_DIR, filename);
      const artifactPath = path.join(ARTIFACT_DIR, filename);

      await page.screenshot({ path: localPath, fullPage: false });
      fs.copyFileSync(localPath, artifactPath);

      capturedImages.push({
        weapon: w.title,
        id: w.id,
        pose: poseName,
        localPath,
        artifactPath,
        hudName: hudText.hName,
        hudAction: hudText.hAction,
      });
    }

    // A. HIP (First-person idle hip view with hands visible on grip & handguard)
    await capturePose('hip', () => {
      window.__debugCamera = null;
      window.__inputManager.testHooks.setAds(false);
      window.__inputManager.testHooks.setKey('ShiftLeft', false);
      window.__inputManager.testHooks.setKey('KeyW', false);
      if (window.__playerState) {
        window.__playerState.isSprinting = false;
        window.__playerState.vx = 0;
        window.__playerState.vz = 0;
      }
      if (window.__weaponState) {
        window.__weaponState.actionState = 'idle';
        window.__weaponState.stateTimer = 0;
        window.__weaponState.stateTicksRemaining = 0;
        window.__weaponState.isAiming = false;
      }
      const vm = window.__viewmodel;
      vm.playClip('idle', true);
    });

    // B. ADS (Aiming Down Sights / Optic aligned to eye center)
    await capturePose('ads', () => {
      window.__debugCamera = null;
      window.__inputManager.testHooks.setAds(true);
      window.__inputManager.testHooks.setKey('ShiftLeft', false);
      window.__inputManager.testHooks.setKey('KeyW', false);
      if (window.__playerState) {
        window.__playerState.isSprinting = false;
        window.__playerState.vx = 0;
        window.__playerState.vz = 0;
      }
      if (window.__weaponState) {
        window.__weaponState.actionState = 'idle';
        window.__weaponState.isAiming = true;
      }
      const vm = window.__viewmodel;
      if (vm.currentVisualDef.clips.ads) {
        vm.playClip('ads');
      }
    });

    // C. MID-RELOAD (Magazine extracted / shell inserted into chamber)
    await capturePose('mid_reload', (target) => {
      window.__debugCamera = null;
      window.__inputManager.testHooks.setAds(false);
      window.__inputManager.testHooks.setKey('ShiftLeft', false);
      if (window.__playerState) window.__playerState.isSprinting = false;
      const reloadState = target.id === 'shotgun' ? 'reloading_shell_insert' : 'reloading_tactical';
      if (window.__weaponState) {
        window.__weaponState.actionState = reloadState;
        window.__weaponState.stateTimer = 5.0;
        window.__weaponState.stateTicksRemaining = 300;
        window.__weaponState.shellCommitDone = false;
        window.__weaponState.isAiming = false;
      }
      const vm = window.__viewmodel;
      const clipName = target.id === 'shotgun'
        ? 'reloadShellInsert'
        : 'reloadTactical';
      vm.playClip(clipName, true);
      vm.animator.clipTime = vm.animator.currentClip.duration * 0.52; // Mid-reload keyframe
    });

    // D. EQUIP (Weapon drawing up from ready holster)
    await capturePose('equip', () => {
      window.__debugCamera = null;
      window.__inputManager.testHooks.setAds(false);
      window.__inputManager.testHooks.setKey('ShiftLeft', false);
      if (window.__playerState) window.__playerState.isSprinting = false;
      if (window.__weaponState) {
        window.__weaponState.actionState = 'swapping_in';
        window.__weaponState.stateTimer = 5.0;
        window.__weaponState.stateTicksRemaining = 300;
        window.__weaponState.isAiming = false;
      }
      const vm = window.__viewmodel;
      vm.playClip('draw', true);
      vm.animator.clipTime = vm.animator.currentClip.duration * 0.35; // Draw in motion
    });

    // E. SPRINT (High-ready tactical carry across chest)
    await capturePose('sprint', () => {
      window.__debugCamera = null;
      window.__inputManager.testHooks.setAds(false);
      window.__inputManager.testHooks.setKey('ShiftLeft', true);
      window.__inputManager.testHooks.setKey('KeyW', true);
      if (window.__playerState) {
        window.__playerState.isSprinting = true;
        window.__playerState.vx = 4.0;
      }
      if (window.__weaponState) {
        window.__weaponState.actionState = 'idle';
        window.__weaponState.stateTimer = 0;
        window.__weaponState.stateTicksRemaining = 0;
        window.__weaponState.isAiming = false;
      }
      const vm = window.__viewmodel;
      vm.playClip('sprint', true);
      vm.animator.clipTime = vm.animator.currentClip.duration * 0.45;
    });
  }

  await browser.close();

  console.log(`\n========================================================`);
  console.log(`All 25 First-Person Evidence Screenshots Captured Successfully!`);
  console.log(`Total: ${capturedImages.length} images saved to ${OUT_DIR}`);
  console.log(`========================================================`);
}

main().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
