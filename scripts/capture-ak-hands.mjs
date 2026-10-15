import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

async function capture() {
  console.log('Launching Chromium to verify AK-47 hand grip...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-angle=default',
      '--enable-dawn-features=allow_unsafe_apis',
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173/?debug', { waitUntil: 'networkidle' });

  // Dismiss modal
  const enterBtn = page.locator('#enter-btn, button:has-text("ENTER ARENA")');
  if (await enterBtn.isVisible()) {
    await enterBtn.click({ force: true });
    await page.waitForTimeout(500);
  }

  // Wait 1.0 second for model and arms to settle into idle
  await page.waitForTimeout(1000);

  // Measure hand socket distances in the browser
  const metrics = await page.evaluate(() => {
    const viewmodel = window.__viewmodel;
    if (!viewmodel) return { error: 'No viewmodel found on window' };

    const def = viewmodel.currentVisualDef;
    const gripRSocket = def.sockets.gripR;
    const gripLSocket = def.sockets.gripL;

    // Get world positions of sockets
    const gripRWorld = gripRSocket.clone().applyMatrix4(viewmodel.animator.weaponGroup.matrixWorld);
    const gripLWorld = gripLSocket.clone().applyMatrix4(viewmodel.animator.weaponGroup.matrixWorld);

    // Get skinned arms hand positions if available
    // @ts-ignore
    const skinnedData = viewmodel.armsRig.skinnedArms;
    let distR = -1;
    let distL = -1;
    if (skinnedData) {
      const handRWorld = gripRWorld.clone();
      skinnedData.handR.getWorldPosition(handRWorld);
      distR = handRWorld.distanceTo(gripRWorld);

      const handLWorld = gripLWorld.clone();
      skinnedData.handL.getWorldPosition(handLWorld);
      distL = handLWorld.distanceTo(gripLWorld);
    }

    return {
      weaponId: def.weaponId,
      weaponName: def.name,
      totalTriangles: viewmodel.totalTriangles,
      gripR: gripRSocket,
      gripL: gripLSocket,
      distR,
      distL,
      hasSkinnedArms: !!skinnedData,
    };
  });

  console.log('AK-47 Viewmodel Metrics:', JSON.stringify(metrics, null, 2));

  const screenshotPath = path.resolve('docs/screenshots/phase3_ak47_hands_attached.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);

  // Also copy to artifacts directory for markdown display
  const artifactPath = path.resolve('C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/76041f60-e72f-4e8d-a6ae-d518c8ee191a/phase3_ak47_hands_attached.png');
  fs.copyFileSync(screenshotPath, artifactPath);
  console.log('Screenshot copied to artifacts:', artifactPath);

  await browser.close();
}

capture().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
