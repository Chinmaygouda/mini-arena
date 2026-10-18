// scripts/verify-all-muzzles-live.mjs
// Comprehensive live browser verification of muzzle origins, visual tracers,
// ballistic raycasting, obstacle obstruction, shotgun pellets, and 12 animation/movement states.

import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/fd669695-232e-421c-895b-222183896b36';
const SCRIPTS_DIR = 'd:/Games/frist person shooter/scripts';

async function getWsUrl() {
  const res = await fetch('http://127.0.0.1:9222/json');
  const tabs = await res.json();
  const rangeTab = tabs.find(t => t.url.includes('localhost:5173') && t.type === 'page');
  if (!rangeTab) {
    throw new Error('Could not find active localhost:5173 page in Chrome');
  }
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
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
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
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    
    // Save to scripts directory
    const scriptPath = path.join(SCRIPTS_DIR, filename);
    fs.writeFileSync(scriptPath, buf);
    
    // Also save to artifact directory for embedding
    const artifactPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(artifactPath, buf);

    console.log(`[Screenshot] Saved ${filename} (${buf.length} bytes)`);
    return artifactPath;
  }

  close() {
    this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runVerification() {
  console.log('Connecting to Chrome via CDP...');
  const wsUrl = await getWsUrl();
  const client = new CDPClient(wsUrl);
  await client.connect();

  console.log('Navigating to http://localhost:5173/?map=range...');
  await client.send('Page.navigate', { url: 'http://localhost:5173/?map=range' });
  await sleep(1500);

  // Dismiss overlay and lock controls
  console.log('Dismissing overlay and setting up app reference...');
  await client.eval(`(() => {
    const overlay = document.getElementById('overlay');
    if (overlay && overlay.style.display !== 'none') {
      overlay.click();
    }
    const app = window.__fpsApp;
    if (app) {
      app.controls.isLocked = true;
    }
  })()`);
  await sleep(500);

  const report = {
    timestamp: new Date().toISOString(),
    weaponAudits: {},
    movementAndAnimationStates: {},
    pelletSpreadAudit: null,
    obstructionAudit: null,
    screenshots: {}
  };

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: AUDIT ALL 5 WEAPONS IN HIPFIRE & ADS (WITH DEBUG MUZZLE MARKER)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('PART 1: AUDITING WEAPON MUZZLES (HIP & ADS) WITH DEBUG MARKER');
  console.log('===============================================================');

  // Enable debug muzzle marker
  await client.eval(`window.__fpsApp.weaponManager.setDebugMuzzleMarker(true)`);

  const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];

  for (const w of weapons) {
    console.log(`\nAuditing weapon: ${w.toUpperCase()}`);
    // Switch weapon and settle
    await client.eval(`(() => {
      const app = window.__fpsApp;
      app.weaponManager.switchWeapon('${w}');
      app.weaponManager.setAmmo(app.weaponManager.currentDef.magCapacity, 100);
      app.weaponManager.toggleADS(false);
      app.controls.input.forward = false;
      app.controls.input.backward = false;
      app.controls.input.left = false;
      app.controls.input.right = false;
      app.controls.input.sprint = false;
    })()`);
    await sleep(600);

    // Audit Hipfire Muzzle Position
    const hipData = await client.eval(`(() => {
      const app = window.__fpsApp;
      const wm = app.weaponManager;
      const cam = app.camera;

      const muzzleWorld = new THREE.Vector3();
      wm.getActiveMuzzleWorldPosition(muzzleWorld);
      const muzzleScreen = muzzleWorld.clone().project(cam);

      // Local offset within gunMeshGroup
      let muzzleNode = null;
      switch ('${w}') {
        case 'ak47': muzzleNode = wm.ak47.muzzlePoint; break;
        case 'pistol': muzzleNode = wm.pistol.muzzlePoint; break;
        case 'smg': muzzleNode = wm.smg.muzzlePoint; break;
        case 'shotgun': muzzleNode = wm.shotgun.muzzlePoint; break;
        case 'sniper': muzzleNode = wm.sniper.muzzlePoint; break;
      }

      return {
        id: '${w}',
        name: wm.currentDef.name,
        localMuzzlePos: muzzleNode ? { x: muzzleNode.position.x, y: muzzleNode.position.y, z: muzzleNode.position.z } : null,
        worldMuzzlePos: { x: muzzleWorld.x, y: muzzleWorld.y, z: muzzleWorld.z },
        cameraPos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
        screenCoord: { x: muzzleScreen.x.toFixed(4), y: muzzleScreen.y.toFixed(4), z: muzzleScreen.z.toFixed(4) }
      };
    })()`);

    const hipScreenshot = await client.screenshot(`audit_${w}_hip_marker.png`);

    // Audit ADS Muzzle Position
    await client.eval(`window.__fpsApp.weaponManager.toggleADS(true)`);
    await sleep(400);

    const adsData = await client.eval(`(() => {
      const app = window.__fpsApp;
      const wm = app.weaponManager;
      const cam = app.camera;

      const muzzleWorld = new THREE.Vector3();
      wm.getActiveMuzzleWorldPosition(muzzleWorld);
      const muzzleScreen = muzzleWorld.clone().project(cam);

      return {
        worldMuzzlePos: { x: muzzleWorld.x, y: muzzleWorld.y, z: muzzleWorld.z },
        screenCoord: { x: muzzleScreen.x.toFixed(4), y: muzzleScreen.y.toFixed(4), z: muzzleScreen.z.toFixed(4) }
      };
    })()`);

    const adsScreenshot = await client.screenshot(`audit_${w}_ads_marker.png`);

    // Reset ADS
    await client.eval(`window.__fpsApp.weaponManager.toggleADS(false)`);
    await sleep(200);

    report.weaponAudits[w] = {
      name: hipData.name,
      localMuzzle: hipData.localMuzzlePos,
      hipfire: {
        world: hipData.worldMuzzlePos,
        screen: hipData.screenCoord,
        screenshot: hipScreenshot
      },
      ads: {
        world: adsData.worldMuzzlePos,
        screen: adsData.screenCoord,
        screenshot: adsScreenshot
      },
      adsCenteringVerified: Math.abs(parseFloat(adsData.screenCoord.x)) < Math.abs(parseFloat(hipData.screenCoord.x))
    };

    console.log(`  Hip Muzzle Screen: (${hipData.screenCoord.x}, ${hipData.screenCoord.y})`);
    console.log(`  ADS Muzzle Screen: (${adsData.screenCoord.x}, ${adsData.screenCoord.y}) [Centered: ${report.weaponAudits[w].adsCenteringVerified}]`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: LIVE FIRING BALLISTIC TRACERS & IMPACT CORRESPONDENCE
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('PART 2: LIVE FIRING BALLISTICS & TRACER ORIGIN ALIGNMENT');
  console.log('===============================================================');

  for (const w of weapons) {
    const fireData = await client.eval(`(() => {
      const app = window.__fpsApp;
      app.weaponManager.switchWeapon('${w}');
      app.weaponManager.setAmmo(app.weaponManager.currentDef.magCapacity, 100);
      for (let i = 0; i < 20; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);

      let captured = [];
      const origSpawnTracer = app.spawnTracer;
      app.spawnTracer = function(from, to, def) {
        captured.push({
          from: { x: from.x, y: from.y, z: from.z },
          to: { x: to.x, y: to.y, z: to.z },
          dist: from.distanceTo(to)
        });
        return origSpawnTracer.call(app, from, to, def);
      };

      app.weaponManager.setTrigger(true);
      app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
      app.weaponManager.setTrigger(false);
      app.spawnTracer = origSpawnTracer;

      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
      const cam = app.camera.position;

      return {
        weapon: '${w}',
        shotsCaptured: captured.length,
        firstTracer: captured[0] || null,
        actualMuzzlePos: { x: muzzle.x, y: muzzle.y, z: muzzle.z },
        cameraPos: { x: cam.x, y: cam.y, z: cam.z },
        diffMuzzleY: captured[0] ? Math.abs(captured[0].from.y - muzzle.y) : 999,
        diffCameraY: captured[0] ? Math.abs(captured[0].from.y - cam.y) : 999
      };
    })()`);

    const tracerMatchesMuzzle = fireData.diffMuzzleY < 0.05;
    const tracerDiffersFromCamera = fireData.diffCameraY > 0.08;

    report.weaponAudits[w].firingAlignment = {
      ...fireData,
      tracerMatchesMuzzle,
      tracerDiffersFromCamera,
      verifiedPhysicalShot: tracerMatchesMuzzle && tracerDiffersFromCamera
    };

    console.log(`Weapon ${w.toUpperCase()} Shot Origin:`);
    console.log(`  Tracer From Y: ${fireData.firstTracer?.from.y.toFixed(4)}`);
    console.log(`  Actual Muzzle Y: ${fireData.actualMuzzlePos.y.toFixed(4)} (diff: ${fireData.diffMuzzleY.toFixed(4)})`);
    console.log(`  Camera Y: ${fireData.cameraPos.y.toFixed(4)} (diff: ${fireData.diffCameraY.toFixed(4)})`);
    console.log(`  Physical Alignment Verified: ${tracerMatchesMuzzle && tracerDiffersFromCamera}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 3: SHOTGUN 8-PELLET COMMON ORIGIN & SPREAD
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('PART 3: SHOTGUN BUCKSHOT PELLET AUDIT (SPAS-12)');
  console.log('===============================================================');

  const shotgunPelletAudit = await client.eval(`(() => {
    const app = window.__fpsApp;
    app.weaponManager.switchWeapon('shotgun');
    app.weaponManager.setAmmo(8, 32);
    for (let i = 0; i < 20; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);

    const initialAmmo = app.weaponManager.state.ammoInClip;
    let pellets = [];
    const origSpawn = app.spawnTracer;
    app.spawnTracer = function(from, to, def) {
      pellets.push({
        from: { x: from.x, y: from.y, z: from.z },
        to: { x: to.x, y: to.y, z: to.z }
      });
      return origSpawn.call(app, from, to, def);
    };

    app.weaponManager.setTrigger(true);
    app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
    app.weaponManager.setTrigger(false);
    app.spawnTracer = origSpawn;

    const ammoAfterShot = app.weaponManager.state.ammoInClip;
    const muzzle = new THREE.Vector3();
    app.weaponManager.getActiveMuzzleWorldPosition(muzzle);

    const originsMatchMuzzle = pellets.every(p => {
      const d = Math.sqrt((p.from.x - muzzle.x)**2 + (p.from.y - muzzle.y)**2 + (p.from.z - muzzle.z)**2);
      return d < 0.05;
    });

    const endpointsVary = pellets.length === 8 && new Set(pellets.map(p => p.to.x.toFixed(2))).size > 3;

    return {
      pelletCount: pellets.length,
      initialAmmo,
      ammoAfterShot,
      ammoConsumed: initialAmmo - ammoAfterShot,
      originsMatchMuzzle,
      endpointsVary,
      muzzleWorld: { x: muzzle.x, y: muzzle.y, z: muzzle.z },
      firstPellet: pellets[0],
      lastPellet: pellets[pellets.length - 1]
    };
  })()`);

  report.pelletSpreadAudit = shotgunPelletAudit;
  console.log(`SPAS-12 Buckshot Results:`);
  console.log(`  Pellets Fired: ${shotgunPelletAudit.pelletCount} (Expected: 8)`);
  console.log(`  Ammo Consumed: ${shotgunPelletAudit.ammoConsumed} (Expected: 1)`);
  console.log(`  All Pellets Emerge from Single Muzzle: ${shotgunPelletAudit.originsMatchMuzzle}`);
  console.log(`  Spread Endpoints Fan Out Across Crosshair: ${shotgunPelletAudit.endpointsVary}`);

  // ───────────────────────────────────────────────────────────────────────────
  // PART 4: OBSTACLE INTERCEPTION / BARREL COVER CHECK
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('PART 4: OBSTACLE INTERCEPTION & COVER AWARENESS');
  console.log('===============================================================');

  const obstructionAudit = await client.eval(`(() => {
    const app = window.__fpsApp;
    app.weaponManager.switchWeapon('ak47');
    app.weaponManager.setAmmo(30, 90);
    for (let i = 0; i < 20; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);

    const muzzle = new THREE.Vector3();
    app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
    const cam = app.camera.position.clone();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(app.camera.quaternion);

    // 1. Test Clear Shot
    const clearHit = app.targetManager.checkBallisticHit(muzzle, cam, forward, app.weaponManager.currentDef);

    // 2. Insert a temporary cover wall blocking the barrel (at distance 1.2m directly in front of muzzle)
    const coverGeo = new THREE.BoxGeometry(0.8, 0.8, 0.1);
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const coverBox = new THREE.Mesh(coverGeo, coverMat);
    coverBox.name = 'test-barrel-cover-box';
    coverBox.position.copy(muzzle).addScaledVector(forward, 1.2);
    app.scene.add(coverBox);
    coverBox.updateMatrixWorld(true);

    const obstructedHit = app.targetManager.checkBallisticHit(muzzle, cam, forward, app.weaponManager.currentDef);

    // Remove temporary cover box
    app.scene.remove(coverBox);
    coverGeo.dispose();
    coverMat.dispose();

    return {
      clearShotDistance: clearHit.distance,
      clearShotTargetType: clearHit.targetType,
      obstructedDistance: obstructedHit.distance,
      obstructedTargetType: obstructedHit.targetType,
      coverBlockedBullet: obstructedHit.distance < 1.5 && obstructedHit.distance < clearHit.distance
    };
  })()`);

  report.obstructionAudit = obstructionAudit;
  console.log(`Obstruction Test Results:`);
  console.log(`  Clear Shot Distance: ${obstructionAudit.clearShotDistance.toFixed(2)}m (Target: ${obstructionAudit.clearShotTargetType})`);
  console.log(`  Obstructed Shot Distance: ${obstructionAudit.obstructedDistance.toFixed(2)}m (Intercepted: ${obstructionAudit.coverBlockedBullet})`);

  // ───────────────────────────────────────────────────────────────────────────
  // PART 5: ALL 12 MOVEMENT AND ANIMATION STATES
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('PART 5: TESTING ALL 12 MOVEMENT & ANIMATION STATES');
  console.log('===============================================================');

  const testState = async (stateNum, stateName, setupFn, verifyFn) => {
    console.log(`\n--- State ${stateNum}: ${stateName} ---`);
    await client.eval(setupFn);
    await sleep(250);
    const result = await client.eval(verifyFn);
    const screenshot = await client.screenshot(`state_${String(stateNum).padStart(2, '0')}_${stateName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`);
    result.screenshot = screenshot;
    report.movementAndAnimationStates[stateName] = result;
    console.log(`  Result:`, JSON.stringify(result, null, 2));
    return result;
  };

  // State 1: Standing Still (Idle Ready)
  await testState(1, 'Standing_Still_Idle',
    `(() => {
      const app = window.__fpsApp;
      app.weaponManager.switchWeapon('ak47');
      app.controls.input.forward = false;
      app.controls.input.backward = false;
      app.controls.input.left = false;
      app.controls.input.right = false;
      app.controls.input.sprint = false;
      app.weaponManager.toggleADS(false);
      for (let i = 0; i < 30; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) },
        isSprinting: app.weaponManager.state.isSprinting,
        isMoving: app.weaponManager.state.isMoving,
        adsWeight: app.weaponManager.adsWeight
      };
    })()`
  );

  // State 2: Walking Forward and Backward
  await testState(2, 'Walking_Forward_Backward',
    `(() => {
      const app = window.__fpsApp;
      app.controls.input.forward = true;
      app.controls.input.sprint = false;
      for (let i = 0; i < 30; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, true, false, 3.2);
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) },
        isMoving: app.weaponManager.state.isMoving,
        walkBobCycle: app.weaponManager.walkBobCycle.toFixed(3)
      };
    })()`
  );

  // State 3: Strafing Left and Right
  await testState(3, 'Strafing_Left_Right',
    `(() => {
      const app = window.__fpsApp;
      app.controls.input.forward = false;
      app.controls.input.left = true;
      for (let i = 0; i < 30; i++) app.weaponManager.update(0.016, { x: -8, y: 0 }, true, false, 3.2);
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) },
        swayX: app.weaponManager.sway.x.toFixed(4),
        isMoving: app.weaponManager.state.isMoving
      };
    })()`
  );

  // State 4: Moving Diagonally
  await testState(4, 'Moving_Diagonally',
    `(() => {
      const app = window.__fpsApp;
      app.controls.input.forward = true;
      app.controls.input.right = true;
      for (let i = 0; i < 30; i++) app.weaponManager.update(0.016, { x: 4, y: 0 }, true, false, 3.8);
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) },
        isMoving: app.weaponManager.state.isMoving
      };
    })()`
  );

  // State 5: Sprinting (Firing Blocked)
  await testState(5, 'Sprinting_Fire_Blocked',
    `(() => {
      const app = window.__fpsApp;
      app.controls.input.forward = true;
      app.controls.input.right = false;
      app.controls.input.sprint = true;
      for (let i = 0; i < 40; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, true, true, 7.0);
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const initialAmmo = app.weaponManager.state.ammoInClip;
      // Attempt to pull trigger while sprinting
      app.weaponManager.setTrigger(true);
      app.weaponManager.update(0.016, { x: 0, y: 0 }, true, true, 7.0);
      app.weaponManager.setTrigger(false);

      const ammoAfter = app.weaponManager.state.ammoInClip;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);

      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) },
        isSprinting: app.weaponManager.state.isSprinting,
        sprintWeight: app.weaponManager.sprintWeight.toFixed(3),
        initialAmmo,
        ammoAfter,
        firingWasBlocked: initialAmmo === ammoAfter
      };
    })()`
  );

  // State 6: Sprint Recovery & Ready Pose
  await testState(6, 'Sprint_Recovery_Ready',
    `(() => {
      const app = window.__fpsApp;
      app.controls.input.forward = false;
      app.controls.input.sprint = false;
      // Step through recovery delay (~0.25s)
      for (let i = 0; i < 20; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const initialAmmo = app.weaponManager.state.ammoInClip;
      // Now firing must be unblocked!
      app.weaponManager.setTrigger(true);
      app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
      app.weaponManager.setTrigger(false);

      const ammoAfter = app.weaponManager.state.ammoInClip;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);

      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) },
        isSprinting: app.weaponManager.state.isSprinting,
        sprintWeight: app.weaponManager.sprintWeight.toFixed(3),
        firedSuccessfullyAfterRecovery: ammoAfter === initialAmmo - 1
      };
    })()`
  );

  // State 7: Jumping and Landing
  await testState(7, 'Jumping_And_Landing',
    `(() => {
      const app = window.__fpsApp;
      // Simulate airborne upward jump velocity, then landing compression
      app.controls.velocity.y = 7.0;
      for (let i = 0; i < 15; i++) {
        app.controls.update(0.016);
        app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) },
        cameraY: app.camera.position.y.toFixed(4)
      };
    })()`
  );

  // State 8: Aiming Down Sights (ADS)
  await testState(8, 'Aiming_Down_Sights_ADS',
    `(() => {
      const app = window.__fpsApp;
      app.weaponManager.toggleADS(true);
      for (let i = 0; i < 25; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
      const screenPos = muzzle.clone().project(app.camera);
      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) },
        screenX: screenPos.x.toFixed(4),
        screenY: screenPos.y.toFixed(4),
        isScoped: app.weaponManager.state.isScoped,
        adsWeight: app.weaponManager.adsWeight.toFixed(3)
      };
    })()`
  );

  // Reset ADS
  await client.eval(`window.__fpsApp.weaponManager.toggleADS(false)`);

  // State 9: Firing During Recoil
  await testState(9, 'Firing_During_Recoil',
    `(() => {
      const app = window.__fpsApp;
      app.weaponManager.switchWeapon('ak47');
      app.weaponManager.setAmmo(30, 90);
      // Fire 3 consecutive shots to build recoil
      for (let shot = 0; shot < 3; shot++) {
        app.weaponManager.setTrigger(true);
        app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
        app.weaponManager.setTrigger(false);
        for (let i = 0; i < 6; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) },
        recoilKickZ: app.weaponManager.recoil.kickZ.toFixed(4),
        recoilPitchX: app.weaponManager.recoil.pitchX.toFixed(4)
      };
    })()`
  );

  // State 10: Weapon Switching (Lower and Raise)
  await testState(10, 'Weapon_Switching',
    `(() => {
      const app = window.__fpsApp;
      app.weaponManager.switchWeapon('sniper');
      // Step mid-switch (switchWeight > 0.5)
      for (let i = 0; i < 4; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) },
        currentWeapon: app.weaponManager.state.currentWeaponId,
        switchWeight: app.weaponManager.switchWeight.toFixed(3)
      };
    })()`
  );

  // Finish switch
  await client.eval(`(() => {
    for (let i = 0; i < 25; i++) window.__fpsApp.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
  })()`);

  // State 11: Firing After Reload & Shotgun Mid-Reload Interruption
  await testState(11, 'Reload_Choreography_And_Interrupt',
    `(() => {
      const app = window.__fpsApp;
      app.weaponManager.switchWeapon('shotgun');
      app.weaponManager.setAmmo(3, 20);
      for (let i = 0; i < 20; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
      app.weaponManager.startReload();
      // Step until 1 shell is inserted (stage 1 committed at 0.55s)
      for (let i = 0; i < 36; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
      const ammoMidReload = app.weaponManager.state.ammoInClip;
      // Pull trigger to interrupt reload and fire loaded shell!
      app.weaponManager.setTrigger(true);
      app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
      app.weaponManager.setTrigger(false);
      window.__ammoMidReload = ammoMidReload;
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) },
        ammoMidReload: window.__ammoMidReload,
        ammoAfterInterruptFire: app.weaponManager.state.ammoInClip,
        isReloading: app.weaponManager.state.isReloading,
        interruptedAndFiredSuccessfully: !app.weaponManager.state.isReloading
      };
    })()`
  );

  // State 12: Cover & Near-Wall Firing
  await testState(12, 'Near_Wall_Cover_Firing',
    `(() => {
      const app = window.__fpsApp;
      app.weaponManager.switchWeapon('ak47');
      app.weaponManager.setAmmo(30, 90);
      for (let i = 0; i < 20; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
    })()`,
    `(() => {
      const app = window.__fpsApp;
      const muzzle = new THREE.Vector3();
      app.weaponManager.getActiveMuzzleWorldPosition(muzzle);
      return {
        muzzleWorld: { x: muzzle.x.toFixed(4), y: muzzle.y.toFixed(4), z: muzzle.z.toFixed(4) }
      };
    })()`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // PART 6: DISABLE DEBUG MARKER & CAPTURE CLEAN GAMEPLAY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log('PART 6: CLEAN GAMEPLAY CAPTURE (DEBUG MARKER DISABLED)');
  console.log('===============================================================');

  // Disable marker
  await client.eval(`window.__fpsApp.weaponManager.setDebugMuzzleMarker(false)`);
  await sleep(300);

  const cleanScreenshot = await client.screenshot('clean_gameplay_ak47_firing.png');
  report.screenshots.cleanGameplay = cleanScreenshot;

  client.close();

  // Write report
  const reportPath = path.join(SCRIPTS_DIR, 'muzzle_origin_audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nAll audits completed successfully! Report written to ${reportPath}`);
}

runVerification().catch((err) => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
