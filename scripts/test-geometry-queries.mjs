import { chromium } from '@playwright/test';
import fs from 'node:fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testQueries() {
  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
    headless: true,
    args: ['--enable-unsafe-webgpu', '--use-angle=d3d11'],
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/?debug=1');
  await page.waitForTimeout(1000);

  const testResult = await page.evaluate(() => {
    const vm = window.__viewmodel;
    const skinned = vm.armsRig.skinnedArms;
    if (!skinned) return { error: 'No skinned arms' };

    // Check weapon meshes
    const weaponGroup = vm.animator.weaponGroup;
    const gunMeshes = [];
    weaponGroup.traverse((obj) => {
      if (obj.isMesh && obj.visible && obj.geometry) {
        gunMeshes.push({ name: obj.name, tris: obj.geometry.index ? obj.geometry.index.count / 3 : obj.geometry.attributes.position.count / 3 });
      }
    });

    // Check arm vertices
    const armsGeom = skinned.skinnedMesh.geometry;
    const vertCount = armsGeom.attributes.position.count;

    return {
      gunMeshes,
      armsVertCount: vertCount,
      hasBones: Boolean(skinned.handR && skinned.handL),
    };
  });

  console.log('Engine geometry test result:', testResult);
  await browser.close();
}

testQueries().catch(console.error);
