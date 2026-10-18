// scripts/diagnose-user-issue.mjs
// Inspects the exact 3D world position of:
// 1. muzzlePoint
// 2. muzzleFlashGroup
// 3. The tracer mesh start point (endA)
// 4. The camera position and viewmodel transform during fire

async function getWsUrl() {
  const res = await fetch('http://127.0.0.1:9222/json');
  const tabs = await res.json();
  const rangeTab = tabs.find(t => t.url.includes('localhost:5173') && t.type === 'page');
  return rangeTab.webSocketDebuggerUrl;
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new globalThis.WebSocket(wsUrl);
    this.msgId = 1;
    this.callbacks = new Map();
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = event => {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
    });
  }
  async send(method, params = {}) {
    const id = this.msgId++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
    return res.result ? res.result.value : undefined;
  }
  close() { this.ws.close(); }
}

async function main() {
  const wsUrl = await getWsUrl();
  const client = new CDPClient(wsUrl);
  await client.connect();

  const data = await client.eval(`(() => {
    const app = window.__fpsApp;
    const wm = app.weaponManager;
    wm.switchWeapon('smg');
    
    // Ensure matrices are up to date
    wm.update(0.016, { x: 0, y: 0 }, false, false, 0);

    const muzzleWorld = new THREE.Vector3();
    wm.smg.muzzlePoint.getWorldPosition(muzzleWorld);

    const flashWorld = new THREE.Vector3();
    wm.smg.muzzleFlashGroup.getWorldPosition(flashWorld);

    const camPos = app.camera.position.clone();
    const camQuat = app.camera.quaternion.clone();

    // Now execute a shot like wm does:
    const activeMuzzle = new THREE.Vector3();
    wm.getActiveMuzzleWorldPosition(activeMuzzle);

    // Let's also check screen projections (NDC):
    const muzzleNdc = muzzleWorld.clone().project(app.camera);
    const flashNdc = flashWorld.clone().project(app.camera);
    const activeNdc = activeMuzzle.clone().project(app.camera);

    return {
      muzzleWorld: { x: muzzleWorld.x, y: muzzleWorld.y, z: muzzleWorld.z },
      flashWorld: { x: flashWorld.x, y: flashWorld.y, z: flashWorld.z },
      activeMuzzle: { x: activeMuzzle.x, y: activeMuzzle.y, z: activeMuzzle.z },
      muzzleNdc: { x: muzzleNdc.x, y: muzzleNdc.y, z: muzzleNdc.z },
      flashNdc: { x: flashNdc.x, y: flashNdc.y, z: flashNdc.z },
      activeNdc: { x: activeNdc.x, y: activeNdc.y, z: activeNdc.z },
      recoilPitchX: wm.recoil.pitchX,
      recoilKickZ: wm.recoil.kickZ,
    };
  })()`);

  console.log('Diagnostic result:', data);

  // Now let's simulate a shot and check the spawned tracer mesh!
  const tracerData = await client.eval(`(() => {
    const app = window.__fpsApp;
    const wm = app.weaponManager;
    
    // Fire a shot
    wm.setTrigger(true);
    wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
    wm.setTrigger(false);

    // Find active tracer
    const tracers = app.activeTracers;
    if (tracers.length === 0) return { error: 'No active tracers found' };

    const tracer = tracers[tracers.length - 1].mesh;
    tracer.updateMatrixWorld(true);

    const geom = tracer.geometry;
    geom.computeBoundingBox();

    // The cylinder has endpoints at local (0, 0, -dist/2) and (0, 0, +dist/2)
    // Wait, let's find the vertices or endpoints:
    const posAttr = geom.getAttribute('position');
    let minZ = Infinity, maxZ = -Infinity;
    let ptNear = new THREE.Vector3();
    let ptFar = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      const v = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      v.applyMatrix4(tracer.matrixWorld);
      if (v.z > maxZ) { maxZ = v.z; }
      if (v.z < minZ) { minZ = v.z; }
    }

    const tracerPos = tracer.position.clone();
    const tracerNdc = tracerPos.clone().project(app.camera);

    const smgMuzzleWorld = new THREE.Vector3();
    wm.smg.muzzlePoint.getWorldPosition(smgMuzzleWorld);
    const smgMuzzleNdc = smgMuzzleWorld.clone().project(app.camera);

    const flashWorld = new THREE.Vector3();
    wm.smg.muzzleFlashGroup.getWorldPosition(flashWorld);
    const flashNdc = flashWorld.clone().project(app.camera);

    return {
      tracerPos,
      tracerNdc,
      smgMuzzleWorld,
      smgMuzzleNdc,
      flashWorld,
      flashNdc,
      distanceFromMuzzleToTracerCenter: tracerPos.distanceTo(smgMuzzleWorld),
    };
  })()`);

  console.log('Tracer diagnostic result:', tracerData);
  client.close();
}

main().catch(console.error);
