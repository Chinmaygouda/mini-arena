import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const mainTab = tabs.find(t => t.url === 'http://localhost:5173/');
  if (!mainTab) {
    console.error('Main game tab not found');
    process.exit(1);
  }

  const ws = new WebSocket(mainTab.webSocketDebuggerUrl);
  await new Promise(res => ws.addEventListener('open', res));

  let reqId = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = reqId++;
    function handler(e) {
      const d = JSON.parse(e.data);
      if (d.id === id) {
        ws.removeEventListener('message', handler);
        if (d.error) reject(d.error);
        else resolve(d.result);
      }
    }
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const evalJs = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw res.exceptionDetails;
    return res.result?.value;
  };

  const takeScreenshot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.resolve('scripts', `${name}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);
    return outPath;
  };

  // Bring to front
  await send('Page.bringToFront');

  // Dismiss start overlay if present
  await evalJs(`
    (() => {
      const overlay = document.getElementById('instructions-overlay');
      if (overlay) overlay.style.display = 'none';
      if (window.__weaponManager) {
        window.__weaponManager.switchWeapon('sniper');
      }
    })()
  `);

  console.log('\n--- 1. Testing HUD Reload Button Click on Sniper ---');
  const btnTest = await evalJs(`
    (() => {
      const wm = window.__weaponManager;
      wm.switchWeapon('sniper');
      wm.setAmmo(3); // 3 of 5
      
      const reloadBtn = document.getElementById('hud-reload-btn');
      if (!reloadBtn) return { error: 'No #hud-reload-btn found in DOM' };
      
      const textBefore = reloadBtn.textContent.trim();
      reloadBtn.click(); // Click the actual HTML button!
      
      return {
        clicked: true,
        textBefore,
        isReloading: wm.state.isReloading,
        ammoInClip: wm.state.ammoInClip,
        weaponId: wm.state.currentWeaponId
      };
    })()
  `);
  console.log('Button Click Test Result:', btnTest);

  // Capture screenshot of tactical reload in progress
  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('sniper_reload_button_active');

  // Wait for tactical reload to finish
  console.log('\nWaiting for tactical reload to finish...');
  await new Promise(r => setTimeout(r, 2800));

  const afterTactical = await evalJs(`
    (() => {
      const wm = window.__weaponManager;
      return {
        ammo: wm.state.ammoInClip,
        reserve: wm.state.reserveAmmo,
        isReloading: wm.state.isReloading
      };
    })()
  `);
  console.log('After Tactical Reload:', afterTactical);

  console.log('\n--- 2. Testing Fire then Empty Reload with Keyboard [R] ---');
  // Fire down to 0
  await evalJs(`
    (() => {
      const wm = window.__weaponManager;
      wm.setAmmo(0); // empty
    })()
  `);

  // Dispatch KeyDown for KeyR
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    code: 'KeyR',
    key: 'r',
    windowsVirtualKeyCode: 82
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    code: 'KeyR',
    key: 'r',
    windowsVirtualKeyCode: 82
  });

  const emptyReloadStatus = await evalJs(`
    (() => {
      const wm = window.__weaponManager;
      const btn = document.getElementById('hud-reload-btn');
      return {
        isReloading: wm.state.isReloading,
        reloadWasEmpty: wm['reloadWasEmpty'],
        btnText: btn ? btn.textContent.trim() : null
      };
    })()
  `);
  console.log('Empty Reload Triggered via KeyR:', emptyReloadStatus);

  // Capture frames during Empty Reload:
  // 1. Bolt unlock/pull (around 0.4s)
  await new Promise(r => setTimeout(r, 450));
  await takeScreenshot('sniper_empty_reload_bolt_open');

  // 2. Magazine extracted downward (around 1.1s)
  await new Promise(r => setTimeout(r, 700));
  await takeScreenshot('sniper_empty_reload_mag_swap');

  // 3. Bolt push and locked (around 2.6s)
  await new Promise(r => setTimeout(r, 1400));
  await takeScreenshot('sniper_empty_reload_bolt_locked');

  // Wait for complete finish
  await new Promise(r => setTimeout(r, 1000));
  const finalState = await evalJs(`
    (() => {
      const wm = window.__weaponManager;
      const btn = document.getElementById('hud-reload-btn');
      return {
        ammo: wm.state.ammoInClip,
        reserve: wm.state.reserveAmmo,
        isReloading: wm.state.isReloading,
        btnText: btn ? btn.textContent.trim() : null,
        boltZ: wm.sniper.boltCarrierGroup.position.z,
        boltRotZ: wm.sniper.boltCarrierGroup.rotation.z
      };
    })()
  `);
  console.log('Final State after full reload cycle:', finalState);

  ws.close();
  console.log('\nAll sniper reload tests completed successfully!');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
