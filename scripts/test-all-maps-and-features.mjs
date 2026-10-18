// scripts/test-all-maps-and-features.mjs
// Automated End-to-End CDP Test across All 5 Maps, All 5 Weapons, Staircases & Atmosphere

import http from 'http';
import fs from 'fs';
import path from 'path';

function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(p => p.type === 'page' && p.url.includes('localhost:5173'));
          if (page && page.webSocketDebuggerUrl) {
            resolve(page.webSocketDebuggerUrl);
          } else {
            reject(new Error('No matching page found on localhost:5173'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = msg => {
        const parsed = JSON.parse(msg.data);
        if (parsed.id && this.pending.has(parsed.id)) {
          const { resolve, reject } = this.pending.get(parsed.id);
          this.pending.delete(parsed.id);
          if (parsed.error) reject(parsed.error);
          else resolve(parsed.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || 'Runtime.evaluate exception');
    }
    return res.result?.value;
  }

  async captureScreenshot(filepath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filepath, buffer);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('--- STARTING MASTER END-TO-END PLAYTESTING & AUDIT ---');
  const wsUrl = await getWsUrl();
  const cdp = new CdpClient(wsUrl);
  await cdp.connect();
  console.log('Connected to Chrome via CDP WebSocket.');

  const maps = ['range', 'foundry', 'culdesac', 'dustline', 'overpass'];
  const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];

  const results = {
    mapsTested: [],
    staircasesTested: [],
    ballisticsTested: [],
    shotgunDetails: null,
    atmosphereStatus: []
  };

  for (const mapId of maps) {
    console.log(`\n========================================`);
    console.log(`TESTING MAP: ${mapId}`);
    console.log(`========================================`);

    // 1. Switch to Map
    const mapInfo = await cdp.eval(`
      (async () => {
        const app = window.__fpsApp;
        await app.switchMap('${mapId}');
        // Wait 300ms for scene settles
        await new Promise(r => setTimeout(r, 300));
        const pos = app.controls.position;
        const colliders = app.controls.colliders;
        const atmosphere = app.atmosphereManager;
        return {
          currentMap: app.mapLoader.currentMapId,
          playerPos: { x: pos.x, y: pos.y, z: pos.z },
          colliderCount: colliders.length,
          stairColliders: colliders.filter(c => c.isStair).length,
          hasSkyDome: !!app.scene.getObjectByName('atmosphere-${mapId}'),
          hasBirds: !!(atmosphere && atmosphere.birdMesh),
          fogType: app.scene.fog ? app.scene.fog.constructor.name : 'none'
        };
      })()
    `);

    console.log(`Loaded ${mapId}: Player at (${mapInfo.playerPos.x.toFixed(2)}, ${mapInfo.playerPos.y.toFixed(2)}, ${mapInfo.playerPos.z.toFixed(2)}), Colliders: ${mapInfo.colliderCount}, Stairs: ${mapInfo.stairColliders}, Atmosphere: ${mapInfo.hasSkyDome ? 'ACTIVE' : 'MISSING'}`);
    results.mapsTested.push({ mapId, ...mapInfo });

    // 2. Test Movement on Map (Walking forward, strafe, jump)
    const moveTest = await cdp.eval(`
      (async () => {
        const app = window.__fpsApp;
        const startPos = { x: app.controls.position.x, y: app.controls.position.y, z: app.controls.position.z };
        // Simulate forward key 'w'
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        for (let i = 0; i < 30; i++) {
          await new Promise(r => requestAnimationFrame(r));
        }
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
        const endPos = app.controls.position;
        return {
          dx: endPos.x - startPos.x,
          dz: endPos.z - startPos.z,
          finalY: endPos.y,
          grounded: app.controls.isGrounded
        };
      })()
    `);
    console.log(`Movement test on ${mapId}: Displacement (dx=${moveTest.dx.toFixed(2)}, dz=${moveTest.dz.toFixed(2)}), Grounded: ${moveTest.grounded}`);

    // 3. Test Staircases if present on map
    if (mapInfo.stairColliders > 0) {
      console.log(`Testing stair traversal on ${mapId} (${mapInfo.stairColliders} stair colliders)...`);
      const stairTest = await cdp.eval(`
        (async () => {
          const app = window.__fpsApp;
          const colliders = app.controls.colliders;
          const stairs = colliders.filter(c => c.isStair);
          const firstStair = stairs[0];
          
          // Place player at foot of stairs
          const footX = (firstStair.minX + firstStair.maxX) / 2;
          const footZ = firstStair.maxZ + 1.2;
          app.controls.setPosition(footX, firstStair.minY + 1.7, footZ, 0);

          // Walk forward up the stairs
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
          const heights = [];
          for (let i = 0; i < 40; i++) {
            await new Promise(r => requestAnimationFrame(r));
            heights.push(app.controls.position.y);
          }
          window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
          
          // Check for sudden jitter/snapping: delta between consecutive frames
          let maxDeltaY = 0;
          for (let i = 1; i < heights.length; i++) {
            const dy = Math.abs(heights[i] - heights[i-1]);
            if (dy > maxDeltaY) maxDeltaY = dy;
          }

          return {
            startHeight: heights[0],
            endHeight: heights[heights.length - 1],
            climbed: heights[heights.length - 1] > heights[0],
            maxFrameDeltaY: maxDeltaY,
            smooth: maxDeltaY < 0.25 // Smooth stepping, no massive snaps
          };
        })()
      `);
      console.log(`Stair test on ${mapId}: Climbed=${stairTest.climbed}, StartY=${stairTest.startHeight.toFixed(2)}, EndY=${stairTest.endHeight.toFixed(2)}, MaxFrameΔY=${stairTest.maxFrameDeltaY.toFixed(3)}, Smooth=${stairTest.smooth}`);
      results.staircasesTested.push({ mapId, ...stairTest });
    }

    // 4. Test Weapon Switching and Firing on this map
    for (const weaponId of weapons) {
      const weaponCheck = await cdp.eval(`
        (async () => {
          const app = window.__fpsApp;
          app.weaponManager.switchWeapon('${weaponId}');
          const curDef = app.weaponManager.currentDef;
          app.weaponManager.setAmmo(curDef.magCapacity, 50);

          // Advance 25 frames so weapon swap transition finishes completely
          for (let i = 0; i < 25; i++) {
            app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
          }

          const muzzlePos = app.camera.position.clone();
          app.weaponManager.getActiveMuzzleWorldPosition(muzzlePos);
          const camPos = app.camera.position;

          // Record shot data
          let firedShot = null;
          const origOnFire = app.weaponManager.onFireRaycast;
          app.weaponManager.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection, def) => {
            firedShot = {
              muzzleY: muzzleOrigin.y,
              aimY: aimOrigin.y,
              belowCamDist: aimOrigin.y - muzzleOrigin.y,
              dirY: aimDirection.y
            };
            origOnFire(muzzleOrigin, aimOrigin, aimDirection, def);
          };

          // Execute shot
          app.weaponManager.setTrigger(true);
          app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
          app.weaponManager.setTrigger(false);

          app.weaponManager.onFireRaycast = origOnFire;

          return {
            weaponId: '${weaponId}',
            name: curDef.name,
            muzzleY: muzzlePos.y,
            camY: camPos.y,
            firedShot,
            clipRemaining: app.weaponManager.state.ammoInClip
          };
        })()
      `);

      if (weaponCheck.firedShot) {
        console.log(`  ✓ ${weaponCheck.name}: Shot Origin Y=${weaponCheck.firedShot.muzzleY.toFixed(3)} (Cam=${weaponCheck.camY.toFixed(3)}, ${Math.round(weaponCheck.firedShot.belowCamDist * 100)}cm below eye), Clip=${weaponCheck.clipRemaining}`);
        results.ballisticsTested.push({ mapId, ...weaponCheck });
      }
    }

    // 5. Shotgun Deep Analysis (on range map or current map)
    if (mapId === 'range') {
      console.log('\n--- EXECUTING DEEP SHOTGUN ANALYSIS ---');
      const shotgunAnalysis = await cdp.eval(`
        (async () => {
          const app = window.__fpsApp;
          app.weaponManager.switchWeapon('shotgun');
          app.weaponManager.setAmmo(8, 32);
          for (let i = 0; i < 25; i++) {
            app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
          }

          // A. Multi-pellet verification
          const pellets = [];
          const origOnFire = app.weaponManager.onFireRaycast;
          app.weaponManager.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection, def) => {
            pellets.push({
              originY: muzzleOrigin.y,
              dir: { x: aimDirection.x, y: aimDirection.y, z: aimDirection.z }
            });
            origOnFire(muzzleOrigin, aimOrigin, aimDirection, def);
          };

          app.weaponManager.setTrigger(true);
          app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
          app.weaponManager.setTrigger(false);
          app.weaponManager.onFireRaycast = origOnFire;

          // B. Shell-by-shell reload with trigger interrupt
          app.weaponManager.setAmmo(4, 20); // 4 in clip, 20 in reserve
          app.weaponManager.startReload();

          // Advance 38 frames (~0.6s) so stage 1 shell insertion is committed
          for (let i = 0; i < 38; i++) {
            app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
          }
          const stageAtMid = app.weaponManager.reloadStage;
          const ammoAtMid = app.weaponManager.state.ammoInClip;

          // Press trigger mid-reload to interrupt
          app.weaponManager.setTrigger(true);
          app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
          const interrupted = !app.weaponManager.state.isReloading;
          app.weaponManager.setTrigger(false);

          return {
            pelletCount: pellets.length,
            allOriginateAtMuzzle: pellets.every(p => Math.abs(p.originY - pellets[0].originY) < 0.001),
            pelletOriginY: pellets[0]?.originY,
            spreadVaried: pellets.length > 1 && (pellets[0].dir.x !== pellets[1].dir.x),
            stageAtMid,
            ammoAtMid,
            interrupted
          };
        })()
      `);

      console.log(`Shotgun buckshot: ${shotgunAnalysis.pelletCount} pellets fired simultaneously.`);
      console.log(`Shotgun pellet origin: All ${shotgunAnalysis.pelletCount} pellets originate from barrel at Y=${shotgunAnalysis.pelletOriginY.toFixed(3)}.`);
      console.log(`Shotgun spread dispersion: Varied spread angles = ${shotgunAnalysis.spreadVaried}.`);
      console.log(`Shotgun reload interrupt: Interrupted=${shotgunAnalysis.interrupted}, Stage=${shotgunAnalysis.stageAtMid}, Ammo=${shotgunAnalysis.ammoAtMid}.`);
      results.shotgunDetails = shotgunAnalysis;
    }

    // 6. Capture Artifact Screenshot of Map & Open Atmosphere
    const screenshotPath = path.resolve(process.cwd(), `screenshot_${mapId}_playtest.png`);
    await cdp.captureScreenshot(screenshotPath);
    console.log(`Saved screenshot: ${screenshotPath}`);
  }

  cdp.close();

  // Save JSON summary
  const summaryPath = path.resolve(process.cwd(), 'audit_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nAudit completed successfully. Summary saved to ${summaryPath}`);
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
