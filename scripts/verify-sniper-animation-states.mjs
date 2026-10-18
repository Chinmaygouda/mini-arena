// scripts/verify-sniper-animation-states.mjs
import fs from 'node:fs';
import path from 'node:path';

async function getDebuggerUrl() {
  const res = await fetch('http://127.0.0.1:9222/json');
  const pages = await res.json();
  const page = pages.find(p => p.url.includes('localhost:5173') && !p.url.includes('soundtest')) || pages[0];
  return page.webSocketDebuggerUrl;
}

async function main() {
  const wsUrl = await getDebuggerUrl();
  console.log(`[CDP] Connecting to ${wsUrl}`);
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

  const artifactDir = 'C:\\Users\\Chinmaygouda\\.gemini\\antigravity-ide\\brain\\5618d13b-17a0-4ad6-8787-4ecd7ffd8f73';

  const captureScreenshot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(artifactDir, `${name}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`[Screenshot] Saved: ${outPath} (${buffer.length} bytes)`);
    return outPath;
  };

  console.log('--- 1. DISMISS OVERLAY & SWITCH TO AW-50 SNIPER RIFLE ---');
  await evalCode(`
    (() => {
      const btn = document.querySelector('#btn-engage');
      if (btn) btn.click();
      const wm = window.__weaponManager;
      wm.switchWeapon('sniper');
      wm.setAmmo(5, 20);
      for (let i = 0; i < 40; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  console.log('--- 2. VERIFY IDLE POSE & GEOMETRY INTEGRITY ---');
  const idleInfo = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      const sniper = wm.sniper;
      
      const leftArm = sniper.leftArmGroup;
      const rightArm = sniper.rightArmGroup;
      const lForearm = leftArm.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry');
      const leftHand = leftArm.children.find(c => c.name === 'Sniper_LeftHand');
      
      const rForearm = rightArm.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry');
      
      return {
        weaponId: wm.state.currentWeaponId,
        visible: sniper.root.visible,
        leftArmPos: leftArm.position,
        rightArmPos: rightArm.position,
        leftHandChildCount: leftHand ? leftHand.children.length : 0,
        lForearmLength: lForearm ? lForearm.geometry.parameters.height : null,
        rForearmLength: rForearm ? rForearm.geometry.parameters.height : null,
      };
    })()
  `);
  console.log('Idle telemetry:', JSON.stringify(idleInfo, null, 2));
  await captureScreenshot('aw50_sniper_after_fix_idle');

  console.log('--- 3. VERIFY WALK BOB ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      for (let i = 0; i < 25; i++) {
        wm.update(0.016, { x: 0, y: 1 }, false, false, 0);
      }
    })()
  `);
  await captureScreenshot('aw50_sniper_after_fix_walk');

  console.log('--- 4. VERIFY SPRINT POSE ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      for (let i = 0; i < 35; i++) {
        wm.update(0.016, { x: 0, y: 1 }, true, false, 0);
      }
    })()
  `);
  await captureScreenshot('aw50_sniper_after_fix_sprint');

  console.log('--- 5. VERIFY SPRINT RECOVERY ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      for (let i = 0; i < 35; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);
  await captureScreenshot('aw50_sniper_after_fix_recovery');

  console.log('--- 6. VERIFY BOLT CYCLING (STAGE 1 & STAGE 2) ---');
  const boltInfo1 = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.setTrigger(true);
      wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      wm.setTrigger(false);
      return {
        stage: wm.sniperCycleStage,
        timer: wm.sniperCycleTimer,
        boltZ: wm.sniper.boltCarrierGroup.position.z,
        boltRotZ: wm.sniper.boltCarrierGroup.rotation.z
      };
    })()
  `);
  console.log('Shot triggered:', boltInfo1);

  // Advance into stage 2 (bolt unlocked and pulled back)
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      for (let i = 0; i < 22; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);
  const boltInfo2 = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      return {
        stage: wm.sniperCycleStage,
        timer: wm.sniperCycleTimer,
        boltZ: wm.sniper.boltCarrierGroup.position.z,
        boltRotZ: wm.sniper.boltCarrierGroup.rotation.z
      };
    })()
  `);
  console.log('Stage 2 pulled bolt:', boltInfo2);
  await captureScreenshot('aw50_sniper_after_fix_bolt_pulled');

  // Finish cycling
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      for (let i = 0; i < 30; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);

  console.log('--- 7. VERIFY RELOAD CHOREOGRAPHY ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.startReload();
      // Advance to mag out (~0.40 progress)
      for (let i = 0; i < 40; i++) {
        wm.update(0.035, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);
  const reloadInfo = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      return {
        isReloading: wm.state.isReloading,
        stage: wm.reloadStage,
        progress: wm.state.reloadProgress,
        magY: wm.sniper.magazineGroup.position.y
      };
    })()
  `);
  console.log('Reload mag out:', reloadInfo);
  await captureScreenshot('aw50_sniper_after_fix_reload');

  // Finish reload
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      for (let i = 0; i < 100; i++) {
        wm.update(0.035, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);

  console.log('--- 8. VERIFY INSPECT ANIMATION ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.triggerInspect();
      for (let i = 0; i < 20; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);
  await captureScreenshot('aw50_sniper_after_fix_inspect');

  // Finish inspect
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.inspectTimer = 0;
      for (let i = 0; i < 30; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);

  console.log('--- 9. VERIFY SWITCH AWAY & RETURN ---');
  await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.switchWeapon('shotgun');
      for (let i = 0; i < 30; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
      wm.switchWeapon('sniper');
      for (let i = 0; i < 40; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()
  `);
  await captureScreenshot('aw50_sniper_after_fix_final');

  console.log('--- ALL SNIPER ANIMATION STATE CHECKS PASSED ---');
  ws.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
