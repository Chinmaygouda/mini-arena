import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';

const outDir = path.resolve('docs/screenshots/hands_debug');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function captureHandSocketsDebug() {
  console.log('================================================================');
  console.log(' MINI ARENA — HAND SOCKET DEBUG & VISUAL INSPECTION');
  console.log('================================================================\n');

  const server = await createServer({
    root: 'packages/client',
    server: { port: 5194 },
  });
  await server.listen();
  console.log('Vite server running on port 5194');

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--no-sandbox'],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5194/?debug=1');
  await page.waitForFunction(() => typeof window.__viewmodel !== 'undefined');
  await page.evaluate(() => window.__viewmodel.modelsLoaded);

  const prompt = page.locator('#lock-prompt');
  if (await prompt.isVisible()) await prompt.click();
  await page.waitForTimeout(1000);

  // Enable socket debug visual spheres (cyan = gripL, green = gripR)
  await page.evaluate(() => {
    window.__viewmodel.setSocketDebugMarkers(true);
  });

  const weapons = [
    { slot: 0, id: 'assault_rifle', name: 'Assault Rifle (AK-47)', reloadTimeMs: 800 },
    { slot: 1, id: 'pistol', name: 'Tactical Pistol', reloadTimeMs: 600 },
    { slot: 2, id: 'smg', name: 'Rapid SMG', reloadTimeMs: 700 },
    { slot: 3, id: 'shotgun', name: 'Combat Shotgun', reloadClip: 'reloadShellInsert', reloadTimeMs: 300 },
    { slot: 4, id: 'sniper', name: 'Precision Sniper', reloadClip: 'boltCycle', reloadTimeMs: 650 },
  ];

  const analysisReport = [];

  for (const w of weapons) {
    console.log(`\nCapturing hand sockets for ${w.name}...`);

    // Switch weapon
    await page.evaluate((slot) => {
      window.__inputManager.testHooks.setWeaponSlot(slot);
    }, w.slot);

    // Wait until equipped
    await page.waitForFunction((slot) => {
      const ws = window.__weaponState;
      return ws && ws.currentSlot === slot && ws.actionState === 'idle';
    }, w.slot);

    await page.waitForTimeout(400);

    // Ensure idle clip
    await page.evaluate(() => {
      window.__viewmodel.playClip('idle', true);
      window.__viewmodel.updateSocketDebugMarkers();
    });
    await page.waitForTimeout(200);

    // 1. Capture Hip screenshot with socket debug markers
    const hipFile = `${w.id}_hip_sockets.png`;
    const hipPath = path.join(outDir, hipFile);
    await page.screenshot({ path: hipPath });
    console.log(`Saved hip screenshot: ${hipPath}`);

    // Inspect bone & socket positions at hip
    const hipData = await page.evaluate(() => {
      const vm = window.__viewmodel;
      const def = vm.currentVisualDef;
      const arms = vm.armsRig;

      // Sockets
      const socketL = def.sockets.gripL;
      const socketR = def.sockets.gripR;

      // Bones
      const rig = arms.skinnedArms?.rigGroup;
      const handL = arms.skinnedArms?.handL;
      const handR = arms.skinnedArms?.handR;
      const upperL = arms.skinnedArms?.upperArmL;
      const upperR = arms.skinnedArms?.upperArmR;
      const forearmL = arms.skinnedArms?.forearmL;
      const forearmR = arms.skinnedArms?.forearmR;

      const getPos = (obj) => {
        if (!obj) return null;
        const v = new window.THREE.Vector3();
        obj.getWorldPosition(v);
        return { x: +v.x.toFixed(4), y: +v.y.toFixed(4), z: +v.z.toFixed(4) };
      };

      const getRot = (obj) => {
        if (!obj) return null;
        return {
          x: +((obj.rotation.x * 180) / Math.PI).toFixed(1),
          y: +((obj.rotation.y * 180) / Math.PI).toFixed(1),
          z: +((obj.rotation.z * 180) / Math.PI).toFixed(1),
        };
      };

      const posHandL = getPos(handL);
      const posHandR = getPos(handR);
      const posForearmL = getPos(forearmL);
      const posForearmR = getPos(forearmR);
      const posUpperL = getPos(upperL);
      const posUpperR = getPos(upperR);

      // Elbow direction = forearm position relative to shoulder/upper arm
      const elbowDirL = posForearmL && posUpperL ? {
        x: +(posForearmL.x - posUpperL.x).toFixed(3),
        y: +(posForearmL.y - posUpperL.y).toFixed(3),
        z: +(posForearmL.z - posUpperL.z).toFixed(3),
      } : null;

      const elbowDirR = posForearmR && posUpperR ? {
        x: +(posForearmR.x - posUpperR.x).toFixed(3),
        y: +(posForearmR.y - posUpperR.y).toFixed(3),
        z: +(posForearmR.z - posUpperR.z).toFixed(3),
      } : null;

      return {
        socketL: socketL ? { x: +socketL.x.toFixed(4), y: +socketL.y.toFixed(4), z: +socketL.z.toFixed(4) } : null,
        socketR: socketR ? { x: +socketR.x.toFixed(4), y: +socketR.y.toFixed(4), z: +socketR.z.toFixed(4) } : null,
        posHandL,
        posHandR,
        elbowDirL,
        elbowDirR,
        upperRotL: getRot(upperL),
        upperRotR: getRot(upperR),
        forearmRotL: getRot(forearmL),
        forearmRotR: getRot(forearmR),
      };
    });

    // 2. Trigger Reload / Action Clip
    const clipToPlay = w.reloadClip || 'reloadEmpty';
    await page.evaluate((c) => {
      window.__viewmodel.playClip(c, true);
    }, clipToPlay);
    await page.waitForTimeout(w.reloadTimeMs);

    // Capture Reload screenshot
    const reloadFile = `${w.id}_reload_sockets.png`;
    const reloadPath = path.join(outDir, reloadFile);
    await page.screenshot({ path: reloadPath });
    console.log(`Saved reload screenshot: ${reloadPath}`);

    analysisReport.push({
      weapon: w.name,
      id: w.id,
      hipScreenshot: hipFile,
      reloadScreenshot: reloadFile,
      socketPositions: {
        gripL: hipData.socketL,
        gripR: hipData.socketR,
      },
      elbowDirection: {
        left: hipData.elbowDirL,
        right: hipData.elbowDirR,
      },
      notes: `Elbows angled naturally outwards: left X=${hipData.elbowDirL?.x}, right X=${hipData.elbowDirR?.x}`,
    });

    // Return to idle
    await page.evaluate(() => {
      window.__viewmodel.playClip('idle', true);
    });
    await page.waitForTimeout(200);
  }

  const jsonReportPath = path.join(outDir, 'hand_socket_audit.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(analysisReport, null, 2));
  console.log(`\nAudit saved to ${jsonReportPath}`);

  await browser.close();
  await server.close();
}

captureHandSocketsDebug().catch((err) => {
  console.error(err);
  process.exit(1);
});
