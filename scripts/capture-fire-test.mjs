import fs from 'node:fs';

async function main() {
  const res = await fetch('http://127.0.0.1:9222/json');
  const pages = await res.json();
  const page = pages.find(p => p.url.includes('localhost:5173') && !p.url.includes('soundtest'));
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (m, p={}) => new Promise(r => {
    const cur = id++;
    const h = (e) => { const d = JSON.parse(e.data); if (d.id === cur) { ws.removeEventListener('message', h); r(d.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: cur, method: m, params: p }));
  });

  const evalCode = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  };

  // Switch to AK-47, dismiss overlay if any, and fire
  const fireInfo = await evalCode(`
    (() => {
      const app = window.__fpsApp || window.app;
      const wm = window.__weaponManager || window.weaponManager;
      wm.switchWeapon('ak47');
      
      // Let it settle for 30 frames
      for (let i = 0; i < 30; i++) wm.update(0.016, {x:0, y:0}, false, false, 0);

      // Record tracer positions
      let lastShot = null;
      const origRaycast = wm.onFireRaycast;
      wm.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection, weaponDef) => {
        lastShot = {
          muzzleOrigin: muzzleOrigin.clone(),
          aimOrigin: aimOrigin.clone(),
          aimDirection: aimDirection.clone()
        };
        if (origRaycast) origRaycast(muzzleOrigin, aimOrigin, aimDirection, weaponDef);
      };

      // Fire 1 shot
      wm.setTrigger(true);
      wm.update(0.016, {x:0, y:0}, false, false, 0);
      wm.setTrigger(false);

      wm.onFireRaycast = origRaycast;

      // Find the muzzle brake tip in world space
      let brakeMesh = null;
      wm.ak47.gunMeshGroup.traverse(c => {
        if (c.geometry && c.geometry.type === 'CylinderGeometry' && c.geometry.parameters.height === 0.055) {
          brakeMesh = c;
        }
      });
      const brakeWorld = new THREE.Vector3();
      brakeMesh.getWorldPosition(brakeWorld);

      // Slant brake is at local z = -0.71, length = 0.055, so front tip is local z = -0.71 - 0.055/2 = -0.7375
      const brakeTipLocal = new THREE.Vector3(0, 0.015, -0.7375);
      const brakeTipWorld = brakeTipLocal.clone().applyMatrix4(wm.ak47.gunMeshGroup.matrixWorld);

      const camera = wm.camera;
      const muzzleScreen = lastShot.muzzleOrigin.clone().project(camera);
      const tipScreen = brakeTipWorld.clone().project(camera);

      // Also get the active tracers
      const tracers = app.activeTracers.map(t => ({
        pos: t.mesh.position.clone(),
        rot: t.mesh.rotation.clone(),
      }));

      return {
        muzzleOrigin: lastShot.muzzleOrigin,
        muzzleScreen,
        brakeTipWorld,
        tipScreen,
        tracersCount: app.activeTracers.length,
        distMuzzleToTip: lastShot.muzzleOrigin.distanceTo(brakeTipWorld),
      };
    })()
  `);

  console.log('Fire info:', JSON.stringify(fireInfo, null, 2));

  // Capture screenshot with tracer visible!
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/ak47_firing_shot.png', Buffer.from(screenshot.data, 'base64'));
  console.log('Saved scripts/ak47_firing_shot.png');

  ws.close();
}

main().catch(console.error);
