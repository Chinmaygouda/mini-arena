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

  const testResults = await evalCode(`
    (() => {
      const app = window.__fpsApp || window.app;
      const wm = window.__weaponManager || window.weaponManager;
      const controls = window.controls;
      wm.switchWeapon('ak47');

      // Add a muzzle point to ak47 if not present
      if (!wm.ak47.muzzlePoint) {
        const muzzlePoint = new THREE.Group();
        muzzlePoint.name = 'AK47_MuzzlePoint';
        muzzlePoint.position.set(0, 0.015, -0.738);
        wm.ak47.gunMeshGroup.add(muzzlePoint);
        wm.ak47.muzzlePoint = muzzlePoint;
      }

      // Add a visible bright red debug sphere at muzzlePoint
      let marker = wm.ak47.gunMeshGroup.getObjectByName('Muzzle_Debug_Marker');
      if (!marker) {
        marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.015, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false })
        );
        marker.name = 'Muzzle_Debug_Marker';
        marker.position.copy(wm.ak47.muzzlePoint.position);
        marker.renderOrder = 9999;
        marker.layers.set(2);
        wm.ak47.gunMeshGroup.add(marker);
      }

      // Settle
      for (let i = 0; i < 20; i++) {
        controls.update(0.016);
        wm.update(0.016, {x:0, y:0}, false, false, 0);
      }

      // Hook getActiveMuzzleWorldPosition to first update the viewmodel transform and matrix world, then read muzzlePoint
      const origGetMuzzle = wm.getActiveMuzzleWorldPosition;
      wm.getActiveMuzzleWorldPosition = (target) => {
        // Force full viewmodel transform calculation with current recoil/camera/ADS
        const cur = wm.currentDef;
        wm.scratchHipPos.set(cur.hipPosition[0], cur.hipPosition[1], cur.hipPosition[2]);
        wm.scratchAdsPos.set(cur.adsPosition[0], cur.adsPosition[1], cur.adsPosition[2]);
        wm.scratchLocalPos.copy(wm.scratchHipPos).lerp(wm.scratchAdsPos, wm.adsWeight);

        const restRotX = THREE.MathUtils.lerp(cur.hipRotation[0], cur.adsRotation[0], wm.adsWeight);
        const restRotY = THREE.MathUtils.lerp(cur.hipRotation[1], cur.adsRotation[1], wm.adsWeight);
        const restRotZ = THREE.MathUtils.lerp(cur.hipRotation[2], cur.adsRotation[2], wm.adsWeight);

        const sw = wm.sprintWeight;
        const sp = cur.sprintPose;

        wm.scratchLocalPos.x += wm.sway.x + sp.dx * sw;
        wm.scratchLocalPos.y += wm.sway.y + sp.dy * sw - wm.switchWeight * 0.22;
        wm.scratchLocalPos.z += wm.recoil.kickZ + sp.dz * sw;

        wm.rootGroup.position.copy(wm.camera.position);
        wm.rootGroup.quaternion.copy(wm.camera.quaternion);

        wm.scratchForward.set(0, 0, -1).applyQuaternion(wm.camera.quaternion);
        wm.scratchRight.set(1, 0, 0).applyQuaternion(wm.camera.quaternion);
        wm.scratchUp.set(0, 1, 0).applyQuaternion(wm.camera.quaternion);

        wm.rootGroup.position
          .addScaledVector(wm.scratchRight, wm.scratchLocalPos.x)
          .addScaledVector(wm.scratchUp, wm.scratchLocalPos.y)
          .addScaledVector(wm.scratchForward, -wm.scratchLocalPos.z);

        const totalPitch = wm.recoil.pitchX + restRotX + sp.dpitch * sw;
        const totalYaw   = wm.recoil.yawY + restRotY + wm.sway.x * 0.8 + sp.dyaw * sw;
        const totalRoll  = wm.recoil.rollZ + restRotZ + sp.droll * sw;

        wm.rootGroup.rotateX(totalPitch);
        wm.rootGroup.rotateY(totalYaw);
        wm.rootGroup.rotateZ(totalRoll);

        wm.rootGroup.updateMatrixWorld(true);
        return wm.ak47.muzzlePoint.getWorldPosition(target);
      };

      // Now fire with tracer
      const origRaycast = wm.onFireRaycast;
      let lastShot = null;
      wm.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection, weaponDef) => {
        lastShot = { muzzleOrigin: muzzleOrigin.clone(), aimOrigin: aimOrigin.clone() };
        if (origRaycast) origRaycast(muzzleOrigin, aimOrigin, aimDirection, weaponDef);
      };

      wm.currentDef.tracerLife = 3.0;
      wm.setTrigger(true);
      wm.update(0.016, {x:0, y:0}, false, false, 0);
      wm.setTrigger(false);
      wm.currentDef.tracerLife = 0.08;

      wm.onFireRaycast = origRaycast;
      wm.getActiveMuzzleWorldPosition = origGetMuzzle;

      wm.rootGroup.updateMatrixWorld(true);
      const muzzleWorld = new THREE.Vector3();
      wm.ak47.muzzlePoint.getWorldPosition(muzzleWorld);

      const markerWorld = new THREE.Vector3();
      marker.getWorldPosition(markerWorld);

      return {
        muzzleWorld,
        markerWorld,
        shotMuzzleOrigin: lastShot ? lastShot.muzzleOrigin : null,
        distShotToMuzzleWorld: lastShot ? lastShot.muzzleOrigin.distanceTo(muzzleWorld) : 0,
      };
    })()
  `);

  console.log('Results:', JSON.stringify(testResults, null, 2));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/ak47_with_marker.png', Buffer.from(screenshot.data, 'base64'));
  console.log('Saved scripts/ak47_with_marker.png');

  ws.close();
}

main().catch(console.error);
