// scripts/test-range-falloff.mjs
// Scripted browser verification for weapon range limits, damage falloff curves,
// tracer maxRange terminations, shotgun angular spread patterns, and 30s perf test.

import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:\\Users\\Chinmaygouda\\.gemini\\antigravity-ide\\brain\\5618d13b-17a0-4ad6-8787-4ecd7ffd8f73';

async function main() {
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const target = list.find((x) => x.url.includes('localhost:5173'));
  if (!target) throw new Error('Target tab with localhost:5173 not found');

  const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
  let msgId = 1;

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
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

  await new Promise((r) => {
    ws.onopen = r;
  });
  console.log('Connected to Chrome CDP session.');

  await send('Page.bringToFront');
  await send('Page.navigate', { url: 'http://localhost:5173/?debug=1' });
  await new Promise((r) => setTimeout(r, 1500));

  // Dismiss start overlay
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('#btn-engage');
        if (btn) btn.click();
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 600));

  const evalInPage = async (fnCode) => {
    const res = await send('Runtime.evaluate', {
      expression: `(${fnCode})()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result.value;
  };

  console.log('\n========================================================================');
  console.log(' PART 4.1: SCRIPTED BROWSER RANGE & FALLOFF CHECK (TARGET DUMMIES)');
  console.log('========================================================================');

  const results = await evalInPage(`
    async () => {
      const app = window.app || window.__fpsApp;
      const wm = app.weaponManager;
      const tm = app.targetManager;
      const scene = app.scene;
      const THREE = window.THREE;

      const distances = [5, 10, 20, 30, 50, 80, 120, 250];
      const weapons = ['shotgun', 'smg', 'pistol', 'ak47', 'sniper'];
      const testOriginY = 15.0; // elevated test lane: zero obstruction all the way to 300m

      app.controls.setPosition(0, testOriginY, 0, 0);
      app.camera.position.set(0, testOriginY, 0);
      app.camera.quaternion.set(0, 0, 0, 1);

      const tableData = [];

      for (const wId of weapons) {
        wm.switchWeapon(wId);
        const curDef = wm.currentDef;

        for (const dist of distances) {
          // Clean existing test dummy
          const old = scene.getObjectByName('active-test-dummy');
          if (old) scene.remove(old);

          // Create target dummy at (0, testOriginY, -dist)
          const dummyGroup = new THREE.Group();
          dummyGroup.name = 'active-test-dummy';
          dummyGroup.position.set(0, testOriginY, -dist);

          // Torso: 0.5m wide, 0.7m high
          const torsoMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
          const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.1), torsoMat);
          torso.position.set(0, 0, 0);
          torso.isTarget = true;
          torso.isHead = false;
          dummyGroup.add(torso);

          // Head: 0.24m wide, 0.24m high
          const headMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
          const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.1), headMat);
          head.position.set(0, 0.47, 0);
          head.isTarget = true;
          head.isHead = true;
          dummyGroup.add(head);

          scene.add(dummyGroup);
          dummyGroup.updateMatrixWorld(true);

          // Aim directly at torso center
          const muzzleOrigin = new THREE.Vector3(0, testOriginY, 0);
          const aimOrigin = new THREE.Vector3(0, testOriginY, 0);
          const aimDir = new THREE.Vector3(0, 0, -1);

          const pelletCount = curDef.pellets || 1;
          let hits = 0;
          let totalDmg = 0;
          let reportedMult = 0;
          let isHit = false;

          for (let p = 0; p < pelletCount; p++) {
            let shotDir = aimDir.clone();
            if (pelletCount > 1) {
              const spread = curDef.spreadBase;
              const spreadX = (Math.random() - 0.5) * spread;
              const spreadY = (Math.random() - 0.5) * spread;
              shotDir.add(new THREE.Vector3(spreadX, spreadY, 0)).normalize();
            }

            const hitResult = tm.checkBallisticHit(muzzleOrigin, aimOrigin, shotDir, curDef);
            if (hitResult.hit && hitResult.targetType === 'steel') {
              hits++;
              totalDmg += hitResult.damage;
              reportedMult = hitResult.multiplier ?? 0;
              isHit = true;
            }
          }

          tableData.push({
            weapon: wId,
            distance: dist + 'm',
            hit: isHit ? 'HIT' : 'MISS',
            totalDamage: totalDmg,
            singlePelletDamage: hits > 0 ? Math.round(totalDmg / hits) : 0,
            multiplierPct: isHit ? Math.round(reportedMult * 100) + '%' : '0%',
            pelletsHit: pelletCount > 1 ? hits + '/' + pelletCount : (isHit ? '1/1' : '0/1'),
            maxRange: curDef.maxRange + 'm',
          });

          scene.remove(dummyGroup);
        }
      }

      return tableData;
    }
  `);

  for (const w of ['shotgun', 'smg', 'pistol', 'ak47', 'sniper']) {
    console.log(`\n--- WEAPON: ${w.toUpperCase()} ---`);
    console.table(results.filter((r) => r.weapon === w));
  }

  console.log('\n========================================================================');
  console.log(' PART 4.2: HEADSHOT DAMAGE AT 5m AND AT FALLOFF END');
  console.log('========================================================================');

  const headshotResults = await evalInPage(`
    () => {
      const app = window.app || window.__fpsApp;
      const wm = app.weaponManager;
      const tm = app.targetManager;
      const scene = app.scene;
      const THREE = window.THREE;
      const weapons = ['shotgun', 'smg', 'pistol', 'ak47', 'sniper'];

      const testOriginY = 15.0;
      app.controls.setPosition(0, testOriginY, 0, 0);
      app.camera.position.set(0, testOriginY, 0);

      const data = [];
      for (const wId of weapons) {
        wm.switchWeapon(wId);
        const def = wm.currentDef;

        const distances = [5, def.falloffEndRange];
        for (const dist of distances) {
          const old = scene.getObjectByName('active-head-dummy');
          if (old) scene.remove(old);

          const dummyGroup = new THREE.Group();
          dummyGroup.name = 'active-head-dummy';
          dummyGroup.position.set(0, testOriginY, -dist);

          const headMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
          const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.1), headMat);
          head.position.set(0, 0.47, 0);
          head.isTarget = true;
          head.isHead = true;
          dummyGroup.add(head);

          scene.add(dummyGroup);
          dummyGroup.updateMatrixWorld(true);

          // Aim directly at head center
          const aimOrigin = new THREE.Vector3(0, testOriginY, 0);
          const targetPoint = new THREE.Vector3(0, testOriginY + 0.47, -dist);
          const aimDir = targetPoint.clone().sub(aimOrigin).normalize();

          const hitResult = tm.checkBallisticHit(aimOrigin, aimOrigin, aimDir, def);
          data.push({
            weapon: wId,
            distance: dist + 'm',
            zone: hitResult.isCrit ? 'HEADSHOT' : (hitResult.hit ? 'BODY' : 'MISS'),
            hit: hitResult.hit ? 'YES' : 'NO',
            damage: hitResult.damage,
            multiplierPct: Math.round((hitResult.multiplier ?? 0) * 100) + '%',
            critMultiplier: def.critMultiplier
          });

          scene.remove(dummyGroup);
        }
      }
      return data;
    }
  `);
  console.table(headshotResults);

  console.log('\n========================================================================');
  console.log(' PART 4.3: SHOTGUN SPREAD CONE WIDTH AT 5, 10, 20, 25 METERS');
  console.log('========================================================================');

  const spreadData = await evalInPage(`
    () => {
      const app = window.app || window.__fpsApp;
      app.weaponManager.switchWeapon('shotgun');
      const def = app.weaponManager.currentDef;
      const distances = [5, 10, 20, 25];
      const spreadBase = def.spreadBase; // 0.038 rad
      const spreadMax = def.spreadMax;   // 0.09 rad

      return distances.map(d => {
        const widthBaseM = d * spreadBase;
        const widthMaxM = d * spreadMax;
        return {
          distance: d + 'm',
          spreadBaseRad: spreadBase,
          patternWidthBase: widthBaseM.toFixed(3) + 'm (' + Math.round(widthBaseM * 100) + ' cm)',
          patternWidthMaxBloom: widthMaxM.toFixed(3) + 'm (' + Math.round(widthMaxM * 100) + ' cm)',
          comparisonToTorso: widthBaseM > 0.45 ? 'WIDER than torso (0.45m) -> pellets spread past torso' : 'FITS inside torso (0.45m)'
        };
      });
    }
  `);
  console.table(spreadData);

  console.log('\n========================================================================');
  console.log(' PART 4.4: SCREENSHOT CAPTURES WITH BUILD STAMP');
  console.log('========================================================================');

  const takeScreenshot = async (filename) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);
    return outPath;
  };

  // 1. Sniper Long-range Tracer (300m) with debug HUD visible
  await evalInPage(`
    () => {
      const app = window.app || window.__fpsApp;
      app.weaponManager.switchWeapon('sniper');
      app.controls.setPosition(0, 1.68, 0, 0);
      app.camera.position.set(0, 1.68, 0);
      app.camera.quaternion.set(0, 0, 0, 1);
      app.weaponManager.setTrigger(true);
      setTimeout(() => app.weaponManager.setTrigger(false), 50);
    }
  `);
  await new Promise((r) => setTimeout(r, 80));
  await takeScreenshot('media_tracer_sniper_300m.png');

  // 2. Shotgun tracer at max range (25m)
  await evalInPage(`
    () => {
      const app = window.app || window.__fpsApp;
      app.weaponManager.switchWeapon('shotgun');
      app.controls.setPosition(0, 1.68, 0, 0);
      app.camera.position.set(0, 1.68, 0);
      app.camera.quaternion.set(0, 0, 0, 1);
      app.weaponManager.setTrigger(true);
      setTimeout(() => app.weaponManager.setTrigger(false), 50);
    }
  `);
  await new Promise((r) => setTimeout(r, 80));
  await takeScreenshot('media_tracer_shotgun_25m.png');

  // 3. Shotgun pattern against a test wall at 5m, 10m, and 20m
  for (const dist of [5, 10, 20]) {
    await evalInPage(`
      () => {
        const app = window.app || window.__fpsApp;
        const scene = app.scene;
        const THREE = window.THREE;
        app.weaponManager.switchWeapon('shotgun');

        const oldWall = scene.getObjectByName('shotgun-test-wall');
        if (oldWall) scene.remove(oldWall);

        const wallGroup = new THREE.Group();
        wallGroup.name = 'shotgun-test-wall';
        wallGroup.position.set(0, 1.68, -${dist});

        const wallMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(6, 4),
          new THREE.MeshStandardMaterial({ color: 0x222629, roughness: 0.8 })
        );
        wallGroup.add(wallMesh);

        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });
        const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.225, 0.23, 32), ringMat);
        ring1.position.z = 0.01;
        wallGroup.add(ring1); // Torso width reference (0.45m diameter)

        scene.add(wallGroup);
        wallGroup.updateMatrixWorld(true);

        app.controls.setPosition(0, 1.68, 0, 0);
        app.camera.position.set(0, 1.68, 0);
        app.camera.quaternion.set(0, 0, 0, 1);

        app.weaponManager.setTrigger(true);
        setTimeout(() => app.weaponManager.setTrigger(false), 50);
      }
    `);
    await new Promise((r) => setTimeout(r, 120));
    await takeScreenshot(`media_shotgun_pattern_${dist}m.png`);
  }

  console.log('\n========================================================================');
  console.log(' PART 4.5: 30-SECOND CONTINUOUS FIRING PERF CHECK');
  console.log('========================================================================');

  const perfResult = await evalInPage(`
    async () => {
      const app = window.app || window.__fpsApp;
      const wm = app.weaponManager;
      wm.switchWeapon('ak47');

      wm.state.ammoInClip = 30;
      wm.state.reserveAmmo = 9999;

      let frameCount = 0;
      let startMem = performance.memory ? performance.memory.usedJSHeapSize : 0;
      let startTime = performance.now();
      let lastTime = startTime;
      let fpsSamples = [];

      return new Promise((resolve) => {
        wm.setTrigger(true);

        const interval = setInterval(() => {
          wm.state.ammoInClip = 30;
          wm.state.isReloading = false;
        }, 100);

        function onFrame() {
          frameCount++;
          const now = performance.now();
          const dt = (now - lastTime) / 1000;
          lastTime = now;
          if (dt > 0) fpsSamples.push(1 / dt);

          if (now - startTime < 30000) {
            requestAnimationFrame(onFrame);
          } else {
            clearInterval(interval);
            wm.setTrigger(false);
            const endMem = performance.memory ? performance.memory.usedJSHeapSize : 0;
            const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
            const minFps = Math.min(...fpsSamples);
            resolve({
              durationSec: ((now - startTime) / 1000).toFixed(2),
              frames: frameCount,
              averageFps: avgFps.toFixed(1),
              minFps: minFps.toFixed(1),
              heapStartMB: (startMem / 1048576).toFixed(2),
              heapEndMB: (endMem / 1048576).toFixed(2),
              heapDeltaMB: ((endMem - startMem) / 1048576).toFixed(2)
            });
          }
        }
        requestAnimationFrame(onFrame);
      });
    }
  `);

  console.log('Continuous Firing Perf Measurement:');
  console.log(perfResult);

  ws.close();
  console.log('\nAll scripted browser verifications completed successfully.');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
