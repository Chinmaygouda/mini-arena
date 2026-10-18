// scripts/reproduce-strafe-drift.mjs
import fs from 'node:fs';

async function main() {
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const target = list.find(x => x.url.includes('localhost:5173') && !x.url.includes('soundtest'));
  if (!target) {
    console.error('Target not found');
    process.exit(1);
  }

  const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
  let id = 1;

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const curId = id++;
      const handler = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id === curId) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  await new Promise(r => { ws.onopen = r; });
  console.log('Connected to Chrome DevTools Protocol');

  // Dismiss start overlay if present
  await send('Runtime.evaluate', {
    expression: 'document.getElementById("start-overlay")?.click();'
  });
  await new Promise(r => setTimeout(r, 200));

  // Hook telemetry on window to capture exact transforms at shot creation and render
  await send('Runtime.evaluate', {
    expression: `
      window.__strafeAudit = [];
      const origOnFireRaycast = window.__fpsApp?.weaponManager?.onFireRaycast;
      // We will install our telemetry listener
      window.__installStrafeHook = () => {
        window.__strafeAudit = [];
      };
    `
  });

  const weapons = ['ak47', 'smg', 'pistol', 'shotgun', 'sniper'];

  // Test script for a scenario
  async function runScenario(weaponId, scenarioName, setupInputFn) {
    console.log(`\n--- Testing ${weaponId} - ${scenarioName} ---`);
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const wm = window.__weaponManager;
          const ctrl = window.__fpsApp.controls;
          wm.switchWeapon('${weaponId}');
          wm.setAmmo(30, 999);
          wm.toggleADS(false);
          ctrl.input.forward = false;
          ctrl.input.backward = false;
          ctrl.input.left = false;
          ctrl.input.right = false;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    // Start movement
    await send('Runtime.evaluate', {
      expression: `(${setupInputFn.toString()})(window.__fpsApp.controls.input)`
    });

    // Let movement accelerate for 300ms
    await new Promise(r => setTimeout(r, 300));

    // Instrument next shot and frame
    const auditResult = await send('Runtime.evaluate', {
      expression: `
        new Promise((resolve) => {
          const wm = window.__weaponManager;
          const ctrl = window.__fpsApp.controls;
          const cam = window.__fpsApp.camera;
          const app = window.__fpsApp;

          // Record before shot
          const muzBefore = new THREE.Vector3();
          wm.getActiveMuzzleWorldPosition(muzBefore);

          // Hook onFireRaycast to capture exact shot parameters
          const origHook = wm.onFireRaycast;
          let shotData = null;
          wm.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection, weaponDef) => {
            origHook(muzzleOrigin, aimOrigin, aimDirection, weaponDef);
            const activeTracer = app.activeTracers[app.activeTracers.length - 1];
            shotData = {
              camPos: cam.position.clone(),
              camRot: { x: cam.rotation.x, y: cam.rotation.y, z: cam.rotation.z },
              playerPos: ctrl.position.clone(),
              playerVel: ctrl.velocity.clone(),
              muzzleAtFire: muzzleOrigin.clone(),
              tracerStartAtFire: activeTracer ? activeTracer.start.clone() : null,
              tracerMeshPosAtFire: activeTracer ? activeTracer.mesh.position.clone() : null,
              ndcMuzzleAtFire: muzzleOrigin.clone().project(cam),
              ndcTracerStartAtFire: activeTracer ? activeTracer.start.clone().project(cam) : null,
            };
          };

          wm.executeShot();

          // Wait 1 frame (next animation frame after render)
          requestAnimationFrame(() => {
            const muzNextFrame = new THREE.Vector3();
            wm.getActiveMuzzleWorldPosition(muzNextFrame);
            const activeTracer = app.activeTracers[app.activeTracers.length - 1];

            const frameData = {
              shot: shotData,
              nextFrame: {
                camPos: cam.position.clone(),
                playerPos: ctrl.position.clone(),
                playerVel: ctrl.velocity.clone(),
                muzzleNextFrame: muzNextFrame,
                tracerCurrentDist: activeTracer ? activeTracer.currentDist : null,
                tracerMeshPos: activeTracer ? activeTracer.mesh.position.clone() : null,
                ndcMuzzleNextFrame: muzNextFrame.clone().project(cam),
                ndcTracerMeshNextFrame: activeTracer ? activeTracer.mesh.position.clone().project(cam) : null,
              }
            };
            wm.onFireRaycast = origHook;
            resolve(frameData);
          });
        })
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    // Capture screenshot during this movement
    const shotScreenshot = await send('Page.captureScreenshot', { format: 'png' });
    const screenPath = `C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/fd669695-232e-421c-895b-222183896b36/strafe_${weaponId}_${scenarioName}.png`;
    fs.writeFileSync(screenPath, Buffer.from(shotScreenshot.data, 'base64'));

    // Stop movement
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const ctrl = window.__fpsApp.controls;
          ctrl.input.forward = false;
          ctrl.input.backward = false;
          ctrl.input.left = false;
          ctrl.input.right = false;
          ctrl.velocity.set(0, 0, 0);
        })()
      `
    });

    console.log('Result for', weaponId, scenarioName, ':');
    console.log(JSON.stringify(auditResult.result?.value, null, 2));
    return auditResult.result?.value;
  }

  // Scenarios to test:
  // 1. Standing still
  await runScenario('ak47', 'still', (input) => {});
  // 2. Moving forward (W)
  await runScenario('ak47', 'forward', (input) => { input.forward = true; });
  // 3. Strafing left (A)
  await runScenario('ak47', 'strafe_left', (input) => { input.left = true; });
  // 4. Strafing right (D)
  await runScenario('ak47', 'strafe_right', (input) => { input.right = true; });

  ws.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
