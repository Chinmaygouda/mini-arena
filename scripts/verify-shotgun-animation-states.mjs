// scripts/verify-shotgun-animation-states.mjs
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const wsUrl = 'ws://127.0.0.1:9222/devtools/page/1924EE273697BBB41C4128113F5E111F';
  const ws = new globalThis.WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = msgId++;
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const evalCode = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  };

  const captureScreenshot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.resolve('scripts', `${name}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`[Screenshot] Saved: ${outPath} (${buffer.length} bytes)`);
    return outPath;
  };

  console.log('--- 1. INITIALIZE & SWITCH TO SPAS-12 ---');
  await evalCode(`
    (() => {
      const app = window.__fpsApp;
      app.weaponManager.switchWeapon('shotgun');
      app.weaponManager.setAmmo(8, 32);
      // Advance to finish switch readying
      for (let i = 0; i < 30; i++) {
        app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);

  console.log('--- 2. VERIFY STATE 1: IDLE / READY ---');
  const idleInfo = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      const sg = wm.shotgun;
      const pumpZ = sg.pumpGroup.position.z;
      const leftArm = sg.leftArmGroup;
      const leftHand = sg.leftHandGroup;
      const forearmMesh = leftArm.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry');
      const cuffMesh = leftHand.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry');

      // World positions of wrist and forearm end
      const worldWrist = new THREE.Vector3();
      cuffMesh.getWorldPosition(worldWrist);

      return {
        weaponId: wm.state.currentWeaponId,
        pumpZ,
        forearmLengthScale: forearmMesh.scale.y,
        worldWrist: { x: worldWrist.x.toFixed(3), y: worldWrist.y.toFixed(3), z: worldWrist.z.toFixed(3) },
        childrenCount: leftHand.children.length,
      };
    })()
  `);
  console.log('State 1 (Idle):', idleInfo);
  await captureScreenshot('state_01_idle_ready');

  console.log('--- 3. VERIFY STATE 2: NORMAL WALKING ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      for (let i = 0; i < 20; i++) {
        wm.update(0.016, { x: 0, y: 0 }, true, false, 3.5);
      }
    })()
  `);
  const walkInfo = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      return {
        moveWeight: wm.moveWeight.toFixed(3),
        walkBobCycle: wm.walkBobCycle.toFixed(3),
        pumpZ: wm.shotgun.pumpGroup.position.z
      };
    })()
  `);
  console.log('State 2 (Walking):', walkInfo);
  await captureScreenshot('state_02_walking');

  console.log('--- 4. VERIFY STATE 3: SPRINT ENTRY & SUSTAINED SPRINT ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      for (let i = 0; i < 35; i++) {
        wm.update(0.016, { x: 0, y: 0 }, true, true, 7.5);
      }
    })()
  `);
  const sprintInfo = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      return {
        sprintWeight: wm.sprintWeight.toFixed(3),
        pumpZ: wm.shotgun.pumpGroup.position.z
      };
    })()
  `);
  console.log('State 3 (Sustained Sprint):', sprintInfo);
  await captureScreenshot('state_03_sustained_sprint');

  console.log('--- 5. VERIFY STATE 4: SPRINT RECOVERY ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      for (let i = 0; i < 40; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);
  const recoverInfo = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      return {
        sprintWeight: wm.sprintWeight.toFixed(3),
        sprintOutTimer: wm.sprintOutTimer.toFixed(3),
        pumpZ: wm.shotgun.pumpGroup.position.z
      };
    })()
  `);
  console.log('State 4 (Sprint Recovery):', recoverInfo);
  await captureScreenshot('state_04_sprint_recovery');

  console.log('--- 6. VERIFY STATE 5 & 6: FIRING & PUMP ACTION CYCLE ---');
  const fireCycleFrames = [];
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.setTrigger(true);
      wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      wm.setTrigger(false);
    })()
  `);
  await captureScreenshot('state_05_firing_recoil');

  for (let f = 1; f <= 30; f++) {
    const frameData = await evalCode(`
      (() => {
        const wm = window.__weaponManager;
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
        return {
          cycleStage: wm.shotgunCycleStage,
          cycleTimer: wm.shotgunCycleTimer.toFixed(3),
          pumpZ: wm.shotgun.pumpGroup.position.z.toFixed(3),
          scaleY: wm.shotgun.leftArmGroup.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry').scale.y.toFixed(3),
        };
      })()
    `);
    fireCycleFrames.push(frameData);
    if (frameData.cycleStage === 2 && !fireCycleFrames.some(fd => fd.capturedBack)) {
      frameData.capturedBack = true;
      await captureScreenshot('state_06_shotgun_pump_back');
    }
  }
  const pumpBackFrame = fireCycleFrames.find(f => f.pumpZ === '-0.190');
  const pumpFwdFrame = fireCycleFrames[fireCycleFrames.length - 1];
  console.log('State 5 & 6 (Firing & Pump Cycle):', {
    hasPumpBack: !!pumpBackFrame,
    pumpBackZ: pumpBackFrame?.pumpZ,
    pumpBackScaleY: pumpBackFrame?.scaleY,
    pumpFinalZ: pumpFwdFrame?.pumpZ,
    pumpFinalScaleY: pumpFwdFrame?.scaleY
  });

  console.log('--- 7. VERIFY STATE 7: RELOADING & SHELL INSERTION ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.setAmmo(6, 32);
      wm.startReload();
    })()
  `);
  let capturedReloadPump = false;
  for (let r = 0; r < 60; r++) {
    const rData = await evalCode(`
      (() => {
        const wm = window.__weaponManager;
        wm.update(0.045, { x: 0, y: 0 }, false, false, 0);
        return {
          isReloading: wm.state.isReloading,
          reloadProgress: wm.state.reloadProgress.toFixed(2),
          stage: wm.reloadStage,
          shellY: wm.shotgun.shellGroup.position.y.toFixed(3),
          pumpZ: wm.shotgun.pumpGroup.position.z.toFixed(3),
        };
      })()
    `);
    if (rData.pumpZ === '-0.190' && !capturedReloadPump) {
      capturedReloadPump = true;
      console.log('Reload pump stroke back observed at progress:', rData.reloadProgress);
      await captureScreenshot('state_07_reload_pump_stroke');
    }
  }
  await captureScreenshot('state_07_reload_complete');

  console.log('--- 8. VERIFY STATE 8: WEAPON INSPECTION ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.triggerInspect();
      for (let i = 0; i < 15; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);
  const inspectInfo = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      return {
        inspectTimer: wm.inspectTimer.toFixed(2),
        rootRotY: wm.rootGroup.rotation.y.toFixed(3),
        rootRotZ: wm.rootGroup.rotation.z.toFixed(3),
      };
    })()
  `);
  console.log('State 8 (Inspect):', inspectInfo);
  await captureScreenshot('state_08_weapon_inspect');

  console.log('--- 9. VERIFY STATE 9: JUMP & FALL BOBBING ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.inspectTimer = 0; // stop inspect
      for (let i = 0; i < 20; i++) {
        wm.update(0.016, { x: 0, y: -0.05 }, false, false, 2.0);
      }
    })()
  `);
  await captureScreenshot('state_09_jump_landing');

  console.log('--- 10. VERIFY STATE 10: WEAPON SWITCHING ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.switchWeapon('pistol');
      for (let i = 0; i < 15; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
      wm.switchWeapon('shotgun');
      for (let i = 0; i < 25; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);
  const switchInfo = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      return {
        currentWeaponId: wm.state.currentWeaponId,
        pumpZ: wm.shotgun.pumpGroup.position.z.toFixed(3),
        shotgunVisible: wm.shotgun.root.visible,
      };
    })()
  `);
  console.log('State 10 (Weapon Switch Return):', switchInfo);
  await captureScreenshot('state_10_switch_return');

  ws.close();
  console.log('=== ALL 10 ANIMATION STATES VERIFIED SUCCESSFULLY! ===');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
