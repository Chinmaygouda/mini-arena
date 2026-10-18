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

  const testResults = await send('Runtime.evaluate', {
    expression: `(() => {
      const wm = window.__weaponManager;
      const cam = wm.camera;

      // Define applyViewmodelTransform temporarily on wm if missing
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

      const auditWeapon = (id) => {
        wm.switchWeapon(id);
        wm.adsWeight = 0;
        wm.applyViewmodelTransform();

        const muzzleWorld = new THREE.Vector3();
        wm.getActiveMuzzleWorldPosition(muzzleWorld);
        const muzzleScreen = muzzleWorld.clone().project(cam);

        // Test in ADS
        wm.adsWeight = 1;
        wm.applyViewmodelTransform();
        const adsMuzzleWorld = new THREE.Vector3();
        wm.getActiveMuzzleWorldPosition(adsMuzzleWorld);
        const adsMuzzleScreen = adsMuzzleWorld.clone().project(cam);

        wm.adsWeight = 0;
        wm.applyViewmodelTransform();

        return {
          id,
          hipMuzzleWorld: muzzleWorld,
          hipMuzzleScreen: { x: muzzleScreen.x.toFixed(3), y: muzzleScreen.y.toFixed(3), z: muzzleScreen.z.toFixed(3) },
          adsMuzzleWorld: adsMuzzleWorld,
          adsMuzzleScreen: { x: adsMuzzleScreen.x.toFixed(3), y: adsMuzzleScreen.y.toFixed(3), z: adsMuzzleScreen.z.toFixed(3) }
        };
      };

      return ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'].map(auditWeapon);
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(testResults.result.value, null, 2));
  ws.close();
}

main().catch(console.error);
