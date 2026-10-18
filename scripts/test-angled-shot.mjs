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

  const shotData = await evalCode(`
    (() => {
      const app = window.__fpsApp || window.app;
      const wm = window.__weaponManager || window.weaponManager;
      const controls = window.controls;
      wm.switchWeapon('ak47');

      // Rotate camera down and left, similar to screenshot
      // Screenshot pitch is slightly down (~ -0.15 rad), yaw is slightly left (~ +0.2 rad)
      controls.pitch = -0.18;
      controls.yaw = 0.22;
      controls.update(0.016);
      wm.update(0.016, {x:0, y:0}, false, false, 0);

      let shot = null;
      const origRaycast = wm.onFireRaycast;
      wm.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection, weaponDef) => {
        shot = {
          muzzleOrigin: muzzleOrigin.clone(),
          aimOrigin: aimOrigin.clone(),
          aimDirection: aimDirection.clone()
        };
        if (origRaycast) origRaycast(muzzleOrigin, aimOrigin, aimDirection, weaponDef);
      };

      // Fire with longer tracer life for visual inspection
      const origLife = weaponDef => weaponDef.tracerLife;
      wm.currentDef.tracerLife = 3.0;
      wm.setTrigger(true);
      wm.update(0.016, {x:0, y:0}, false, false, 0);
      wm.setTrigger(false);
      wm.currentDef.tracerLife = 0.08;

      wm.onFireRaycast = origRaycast;

      const camera = wm.camera;
      const muzzleScreen = shot.muzzleOrigin.clone().project(camera);

      // Slant brake mesh
      let brakeMesh = null;
      wm.ak47.gunMeshGroup.traverse(c => {
        if (c.geometry && c.geometry.type === 'CylinderGeometry' && c.geometry.parameters.height === 0.055) {
          brakeMesh = c;
        }
      });
      const brakeWorld = new THREE.Vector3();
      brakeMesh.getWorldPosition(brakeWorld);
      const brakeScreen = brakeWorld.clone().project(camera);

      const tracer = app.activeTracers[app.activeTracers.length - 1];

      return {
        cameraPos: camera.position,
        cameraRot: { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
        muzzleOrigin: shot.muzzleOrigin,
        muzzleScreen,
        brakeWorld,
        brakeScreen,
        distToBrake: shot.muzzleOrigin.distanceTo(brakeWorld),
        tracerMeshPos: tracer ? tracer.mesh.position : null,
      };
    })()
  `);

  console.log('Shot data:', JSON.stringify(shotData, null, 2));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/ak47_shot_rotated.png', Buffer.from(screenshot.data, 'base64'));
  console.log('Saved scripts/ak47_shot_rotated.png');

  ws.close();
}

main().catch(console.error);
