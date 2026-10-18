// scripts/inspect-single-shot.mjs
import fs from 'fs';

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
  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filename, buf);
    console.log(`Saved screenshot ${filename}`);
  }
  close() { this.ws.close(); }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const wsUrl = await getWsUrl();
  const client = new CDPClient(wsUrl);
  await client.connect();

  console.log('Connecting to browser and firing single SMG shot...');

  // Setup: equip SMG, face shooting range targets
  await client.eval(`(() => {
    const app = window.__fpsApp;
    app.weaponManager.switchWeapon('smg');
    app.controls.position.set(0, 1.6, 12);
    app.controls.pitch = 0;
    app.controls.yaw = 0;
    app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
  })()`);
  await sleep(100);

  // Hook into onFireRaycast to capture exact parameters
  const shotDetails = await client.eval(`(() => {
    const app = window.__fpsApp;
    const wm = app.weaponManager;
    let captured = null;

    const oldOnFire = wm.onFireRaycast;
    wm.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection, weaponDef) => {
      oldOnFire(muzzleOrigin, aimOrigin, aimDirection, weaponDef);
      
      const cam = app.camera;
      const camPos = cam.position.clone();
      const muzzleInCam = muzzleOrigin.clone().applyMatrix4(cam.matrixWorldInverse);
      const muzzleNdc = muzzleOrigin.clone().project(cam);

      // Find the created tracer
      const tracer = app.activeTracers[app.activeTracers.length - 1];
      const tracerMesh = tracer ? tracer.mesh : null;
      
      let tracerStartNdc = null;
      let tracerEndNdc = null;
      if (tracerMesh) {
        tracerMesh.updateMatrixWorld(true);
        const geom = tracerMesh.geometry;
        const dist = muzzleOrigin.distanceTo(tracerMesh.position) * 2;
        // In local cylinder space: (0, 0, -dist/2) and (0, 0, dist/2)
        const ptA = new THREE.Vector3(0, 0, -dist/2).applyMatrix4(tracerMesh.matrixWorld);
        const ptB = new THREE.Vector3(0, 0, dist/2).applyMatrix4(tracerMesh.matrixWorld);
        tracerStartNdc = ptA.project(cam);
        tracerEndNdc = ptB.project(cam);
      }

      // Also get where the muzzlePoint object is RIGHT NOW on screen:
      const curMuzzleWorld = new THREE.Vector3();
      wm.smg.muzzlePoint.getWorldPosition(curMuzzleWorld);
      const curMuzzleNdc = curMuzzleWorld.project(cam);

      // Where is muzzleFlashGroup on screen:
      const curFlashWorld = new THREE.Vector3();
      wm.smg.muzzleFlashGroup.getWorldPosition(curFlashWorld);
      const curFlashNdc = curFlashWorld.project(cam);

      captured = {
        muzzleOrigin: { x: muzzleOrigin.x, y: muzzleOrigin.y, z: muzzleOrigin.z },
        muzzleInCam: { x: muzzleInCam.x, y: muzzleInCam.y, z: muzzleInCam.z },
        muzzleNdc: { x: muzzleNdc.x, y: muzzleNdc.y, z: muzzleNdc.z },
        curMuzzleNdc: { x: curMuzzleNdc.x, y: curMuzzleNdc.y, z: curMuzzleNdc.z },
        curFlashNdc: { x: curFlashNdc.x, y: curFlashNdc.y, z: curFlashNdc.z },
        tracerStartNdc: tracerStartNdc ? { x: tracerStartNdc.x, y: tracerStartNdc.y, z: tracerStartNdc.z } : null,
        tracerEndNdc: tracerEndNdc ? { x: tracerEndNdc.x, y: tracerEndNdc.y, z: tracerEndNdc.z } : null,
      };
    };

    // Pull trigger to fire 1 shot
    wm.setTrigger(true);
    wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
    wm.setTrigger(false);

    wm.onFireRaycast = oldOnFire;
    return captured;
  })()`);

  console.log('Shot Details:', JSON.stringify(shotDetails, null, 2));

  // Capture screenshot of this frame while tracer is visible
  await client.screenshot('d:/Games/frist person shooter/scripts/test_shot_capture.png');

  client.close();
}

main().catch(console.error);
