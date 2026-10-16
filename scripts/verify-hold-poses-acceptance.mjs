import { chromium } from '@playwright/test';

async function testAll() {
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

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  console.log('Navigating to http://localhost:5173/?debug=1 ...');
  await page.goto('http://localhost:5173/?debug=1');
  await page.waitForSelector('canvas');

  // Dismiss lock prompt
  await page.evaluate(() => {
    const el = document.getElementById('lock-prompt');
    if (el) el.style.display = 'none';
  });

  await page.waitForFunction(() => window.__viewmodel && window.__viewmodel.modelsLoaded);
  await page.evaluate(() => window.__viewmodel.modelsLoaded);
  await page.waitForFunction(() => window.__viewmodel.armsRig?.skinnedArms !== null);
  console.log('Engine and models loaded!');

  const report = await page.evaluate(async () => {
    const vm = window.__viewmodel;
    const rig = vm.armsRig;
    const s = rig.skinnedArms;
    const camera = window.__camera;

    const weapons = [
      { id: 'assault_rifle', key: '1', name: 'Assault Rifle' },
      { id: 'pistol', key: '2', name: 'Tactical Pistol' },
      { id: 'smg', key: '3', name: 'Rapid SMG' },
      { id: 'shotgun', key: '4', name: 'Combat Shotgun' },
      { id: 'sniper', key: '5', name: 'Precision Sniper' },
    ];

    const results = {};

    const posShoulderR = new window.THREE.Vector3();
    const posForearmR = new window.THREE.Vector3();
    const posHandR = new window.THREE.Vector3();

    const posShoulderL = new window.THREE.Vector3();
    const posForearmL = new window.THREE.Vector3();
    const posHandL = new window.THREE.Vector3();

    const invCam = new window.THREE.Matrix4();

    for (const w of weapons) {
      // Trigger weapon switch
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit' + w.key }));
      // Wait for swap & draw to complete fully into idle
      await new Promise(r => setTimeout(r, 800));

      camera.updateMatrixWorld(true);
      invCam.copy(camera.matrixWorld).invert();

      s.upperArmR.getWorldPosition(posShoulderR);
      s.forearmR.getWorldPosition(posForearmR);
      s.handR.getWorldPosition(posHandR);

      s.upperArmL.getWorldPosition(posShoulderL);
      s.forearmL.getWorldPosition(posForearmL);
      s.handL.getWorldPosition(posHandL);

      const l1_R = posShoulderR.distanceTo(posForearmR);
      const l2_R = posForearmR.distanceTo(posHandR);
      const maxReachR = l1_R + l2_R;

      const l1_L = posShoulderL.distanceTo(posForearmL);
      const l2_L = posForearmL.distanceTo(posHandL);
      const maxReachL = l1_L + l2_L;

      const dR = posHandR.distanceTo(posShoulderR);
      const dL = posHandL.distanceTo(posShoulderL);

      const reachR = (dR / maxReachR) * 100;
      const reachL = (dL / maxReachL) * 100;

      const cosR = (l1_R * l1_R + l2_R * l2_R - dR * dR) / (2 * l1_R * l2_R);
      const elbowDegR = (Math.acos(Math.max(-1, Math.min(1, cosR))) * 180) / Math.PI;

      const cosL = (l1_L * l1_L + l2_L * l2_L - dL * dL) / (2 * l1_L * l2_L);
      const elbowDegL = (Math.acos(Math.max(-1, Math.min(1, cosL))) * 180) / Math.PI;

      const camElbowR = posForearmR.clone().applyMatrix4(invCam);
      const camHandR = posHandR.clone().applyMatrix4(invCam);
      const camShoulderR = posShoulderR.clone().applyMatrix4(invCam);

      const camElbowL = posForearmL.clone().applyMatrix4(invCam);
      const camHandL = posHandL.clone().applyMatrix4(invCam);
      const camShoulderL = posShoulderL.clone().applyMatrix4(invCam);

      const elbowDownR = camElbowR.y < camHandR.y && camElbowR.y < camShoulderR.y;
      const elbowDownL = camElbowL.y < camHandL.y && camElbowL.y < camShoulderL.y;

      results[w.id] = {
        name: w.name,
        reachR,
        reachL,
        elbowDegR,
        elbowDegL,
        elbowDownR,
        elbowDownL,
        camHandR: camHandR.toArray(),
        camHandL: camHandL.toArray(),
        camElbowR: camElbowR.toArray(),
        camElbowL: camElbowL.toArray(),
      };
    }

    return results;
  });

  console.log('\n--- LIVE ENGINE MEASUREMENTS ---');
  for (const [id, r] of Object.entries(report)) {
    console.log(`\nWeapon: ${r.name} (${id})`);
    console.log(`  Right Hand: reach=${r.reachR.toFixed(1)}% (55-95%), elbow=${r.elbowDegR.toFixed(1)}° (60-150°), elbowDown=${r.elbowDownR}`);
    console.log(`    camHandR: [${r.camHandR.map(v => v.toFixed(4)).join(', ')}]`);
    console.log(`  Left Hand:  reach=${r.reachL.toFixed(1)}% (55-95%), elbow=${r.elbowDegL.toFixed(1)}° (60-150°), elbowDown=${r.elbowDownL}`);
    console.log(`    camHandL: [${r.camHandL.map(v => v.toFixed(4)).join(', ')}]`);
  }

  await browser.close();
}

testAll().catch(console.error);
