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

  await send('Page.bringToFront');

  // Dismiss modal
  await evalCode(`
    (() => {
      const btn = document.querySelector('#btn-engage');
      if (btn) btn.click();
      const modal = document.querySelector('#play-modal');
      if (modal) modal.style.display = 'none';
      if (window.__fpsApp?.hud) {
        window.__fpsApp.hud.isDismissed = true;
      }
    })()
  `);

  await new Promise(r => setTimeout(r, 400));

  // Define applyViewmodelTransform and enable debug marker
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.applyViewmodelTransform = function() {
        const cur = this.currentDef;
        const hipPos = new THREE.Vector3(...cur.hipPosition);
        const adsPos = new THREE.Vector3(...cur.adsPosition);
        const currentRestPos = hipPos.clone().lerp(adsPos, this.adsWeight);

        const hipRot = new THREE.Euler(...cur.hipRotation);
        const adsRot = new THREE.Euler(...cur.adsRotation);
        const restRotX = THREE.MathUtils.lerp(hipRot.x, adsRot.x, this.adsWeight);
        const restRotY = THREE.MathUtils.lerp(hipRot.y, adsRot.y, this.adsWeight);
        const restRotZ = THREE.MathUtils.lerp(hipRot.z, adsRot.z, this.adsWeight);

        const sp = cur.sprintPose;
        const sw = this.sprintWeight;

        const localPos = currentRestPos.clone();
        localPos.x += this.sway.x + this.currentBobX + sp.dx * sw;
        localPos.y += this.sway.y + this.currentBobY + this.currentReloadPosY + sp.dy * sw - this.switchWeight * 0.22;
        localPos.z += this.recoil.kickZ + sp.dz * sw;

        this.rootGroup.position.copy(this.camera.position);
        this.rootGroup.quaternion.copy(this.camera.quaternion);

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

        this.rootGroup.position
          .addScaledVector(right, localPos.x)
          .addScaledVector(up, localPos.y)
          .addScaledVector(forward, -localPos.z);

        const totalPitch = this.recoil.pitchX + restRotX + sp.dpitch * sw + this.currentReloadRotX;
        const totalYaw   = this.recoil.yawY + restRotY + this.sway.x * 0.8 + sp.dyaw * sw + this.currentInspectRotY;
        const totalRoll  = this.recoil.rollZ + restRotZ + this.currentBobX * 1.8 + sp.droll * sw + this.currentReloadRotZ + this.currentInspectRotZ;

        this.rootGroup.rotateX(totalPitch);
        this.rootGroup.rotateY(totalYaw);
        this.rootGroup.rotateZ(totalRoll);

        this.rootGroup.updateMatrixWorld(true);
      };
      
      wm.setDebugMuzzleMarker(true);
    })()
  `);

  const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];

  for (const wid of weapons) {
    // 1. Hipfire test
    await evalCode(`
      (() => {
        const wm = window.__weaponManager;
        wm.switchWeapon('${wid}');
        wm.toggleADS(false);
        wm.adsWeight = 0;
        wm.update(0.016, {x:0, y:0}, false, false, 0);
      })()
    `);
    await new Promise(r => setTimeout(r, 100));

    let snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`scripts/marker_${wid}_hip.png`, Buffer.from(snap.data, 'base64'));

    // 2. ADS test
    await evalCode(`
      (() => {
        const wm = window.__weaponManager;
        wm.toggleADS(true);
        wm.adsWeight = 1;
        wm.update(0.016, {x:0, y:0}, false, false, 0);
      })()
    `);
    await new Promise(r => setTimeout(r, 100));

    snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`scripts/marker_${wid}_ads.png`, Buffer.from(snap.data, 'base64'));
    console.log(`Captured hip & ads for ${wid}`);
  }

  ws.close();
}

main().catch(console.error);
