// scripts/verify-tracer-travel.mjs
// Comprehensive browser verification of visible bullet/tracer travel animation
import fs from 'node:fs';

async function main() {
  console.log('Connecting to Chrome at http://127.0.0.1:9222 ...');
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const target = list.find(x => x.url.includes('localhost:5173') && !x.url.includes('soundtest'));
  if (!target) {
    console.error('Target not found in running Chrome instances:', list);
    process.exit(1);
  }

  const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
  let msgId = 1;

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const curId = msgId++;
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
  console.log('Connected to Chrome DevTools Protocol.');

  // Dismiss start overlay if present
  await send('Runtime.evaluate', {
    expression: 'document.getElementById("start-overlay")?.click();'
  });
  await new Promise(r => setTimeout(r, 400));

  // Verify __fpsApp is available
  const appCheck = await send('Runtime.evaluate', {
    expression: '!!window.__fpsApp && !!window.__weaponManager'
  });
  console.log('Game orchestrators ready:', appCheck.result.value);

  // Take screenshot helper
  async function takeScreenshot(name) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    const path = `tests_artifacts_${name}.png`;
    fs.writeFileSync(path, buf);
    console.log(`Saved screenshot: ${path}`);
    return path;
  }

  // Evaluate weapon test in browser
  const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];
  const testResults = [];

  for (const weaponId of weapons) {
    console.log(`\n========================================`);
    console.log(`Testing weapon: ${weaponId.toUpperCase()}`);
    console.log(`========================================`);

    const evalRes = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `
        (async () => {
          const app = window.__fpsApp;
          const wm = window.__weaponManager;
          const ctrl = app.controls;

          wm.switchWeapon('${weaponId}');
          wm.setAmmo(30, 999);
          wm.toggleADS(false);

          // Center aim toward a target
          ctrl.position.set(0, 1.6, 0);
          app.camera.position.set(0, 1.6, 0);
          app.camera.rotation.set(0, 0, 0);

          await new Promise(r => setTimeout(r, 200));

          // Intercept onFireRaycast to capture exact muzzle at firing time
          const origRaycast = wm.onFireRaycast;
          let muzzleAtShot = null;
          wm.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection, weaponDef) => {
            muzzleAtShot = muzzleOrigin.clone();
            origRaycast(muzzleOrigin, aimOrigin, aimDirection, weaponDef);
          };

          const initialTracerCount = app.activeTracers.length;

          // Execute single shot
          wm.executeShot();
          wm.onFireRaycast = origRaycast;

          const newTracers = app.activeTracers.slice(initialTracerCount);
          const tracer0 = newTracers[0];
          const distToMuzzle = (tracer0 && muzzleAtShot) ? tracer0.start.distanceTo(muzzleAtShot) : -1;
          const speed = tracer0 ? tracer0.speed : 0;
          const totalDist = tracer0 ? tracer0.totalDist : 0;
          const expectedDuration = totalDist / (speed || 1);

          // Track over the next 40 animation frames
          const frames = [];
          let impactTriggeredFrame = -1;
          for (let f = 0; f < 40; f++) {
            await new Promise(r => requestAnimationFrame(r));
            if (!tracer0) break;
            const currentDist = tracer0.currentDist;
            const tailDist = Math.max(0, currentDist - tracer0.boltLength);
            const isMeshInScene = app.scene.children.includes(tracer0.mesh);
            const impactDone = tracer0.impactTriggered;

            if (impactDone && impactTriggeredFrame === -1) {
              impactTriggeredFrame = f;
            }

            frames.push({
              frame: f,
              currentDist: +currentDist.toFixed(2),
              tailDist: +tailDist.toFixed(2),
              totalDist: +totalDist.toFixed(2),
              impactDone,
              isMeshInScene,
              visible: tracer0.mesh.visible
            });

            if (!isMeshInScene && impactDone) {
              break;
            }
          }

          return {
            weaponId: '${weaponId}',
            pelletCount: newTracers.length,
            distToMuzzle: +distToMuzzle.toFixed(5),
            speed,
            totalDist: +totalDist.toFixed(2),
            expectedDurationSec: +expectedDuration.toFixed(3),
            frameCount: frames.length,
            impactTriggeredFrame,
            frames
          };
        })()
      `
    });

    const res = evalRes.result.value;
    console.log(`Weapon ${weaponId} Results:`, JSON.stringify({
      pelletCount: res.pelletCount,
      distToMuzzle: res.distToMuzzle,
      speed: res.speed,
      totalDist: res.totalDist,
      expectedDurationSec: res.expectedDurationSec,
      totalFramesTracked: res.frameCount,
      impactTriggeredFrame: res.impactTriggeredFrame
    }, null, 2));

    console.log(`Frame samples:`);
    for (const f of res.frames.slice(0, 10)) {
      console.log(`  Frame ${f.frame}: head=${f.currentDist}m / total=${f.totalDist}m, tail=${f.tailDist}m, impact=${f.impactDone}, inScene=${f.isMeshInScene}`);
    }
    const last = res.frames[res.frames.length - 1];
    if (last) {
      console.log(`  Final Frame ${last.frame}: head=${last.currentDist}m, tail=${last.tailDist}m, impact=${last.impactDone}, inScene=${last.isMeshInScene}`);
    }

    testResults.push(res);
  }

  // Now test strafe movement firing
  console.log(`\n========================================`);
  console.log(`Testing Strafe & Movement Firing`);
  console.log(`========================================`);

  const strafeRes = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `
      (async () => {
        const app = window.__fpsApp;
        const wm = window.__weaponManager;
        const ctrl = app.controls;

        wm.switchWeapon('ak47');
        ctrl.input.left = true;
        ctrl.input.right = false;

        // Allow strafe acceleration
        await new Promise(r => setTimeout(r, 200));

        let muzAtShot = null;
        const origRaycast = wm.onFireRaycast;
        wm.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection, weaponDef) => {
          muzAtShot = muzzleOrigin.clone();
          origRaycast(muzzleOrigin, aimOrigin, aimDirection, weaponDef);
        };

        wm.executeShot();
        wm.onFireRaycast = origRaycast;

        const tracer = app.activeTracers[app.activeTracers.length - 1];
        const dist = tracer.start.distanceTo(muzAtShot);

        ctrl.input.left = false;
        return {
          strafingLeftDist: +dist.toFixed(5),
          speed: tracer.speed,
          totalDist: +tracer.totalDist.toFixed(2)
        };
      })()
    `
  });
  console.log('Strafe test result:', strafeRes.result.value);

  // Take screenshot of live scene
  await takeScreenshot('final_gameplay_verification');

  // Verify assertions
  let allPassed = true;
  for (const r of testResults) {
    if (r.distToMuzzle > 0.001) {
      console.error(`FAILURE: ${r.weaponId} tracer start does not match muzzle position! (dist = ${r.distToMuzzle})`);
      allPassed = false;
    }
    if (r.frameCount < 4) {
      console.error(`FAILURE: ${r.weaponId} tracer died in fewer than 4 frames! Not visible travel!`);
      allPassed = false;
    }
    if (r.impactTriggeredFrame <= 0) {
      console.error(`FAILURE: ${r.weaponId} impact was instantaneous on frame 0 instead of when tracer arrived!`);
      allPassed = false;
    }
    if (r.weaponId === 'shotgun' && r.pelletCount !== 8) {
      console.error(`FAILURE: Shotgun did not spawn 8 pellets! Got ${r.pelletCount}`);
      allPassed = false;
    }
  }

  if (strafeRes.result.value.strafingLeftDist > 0.001) {
    console.error(`FAILURE: Strafe firing offset muzzle! dist = ${strafeRes.result.value.strafingLeftDist}`);
    allPassed = false;
  }

  if (allPassed) {
    console.log('\n>>> ALL BROWSER TRACER TRAVEL VERIFICATIONS PASSED SUCCESSFULLY! <<<');
  } else {
    console.error('\n>>> SOME VERIFICATIONS FAILED! <<<');
    process.exit(1);
  }

  ws.close();
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
