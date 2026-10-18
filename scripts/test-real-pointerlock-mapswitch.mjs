// scripts/test-real-pointerlock-mapswitch.mjs
import http from 'http';

async function main() {
  const cdpRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await cdpRes.json();
  const pageTarget = targets.find(t => t.type === 'page' && !t.url.startsWith('chrome-error://'));
  if (!pageTarget) {
    console.error('No page target found');
    process.exit(1);
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  await new Promise(r => ws.addEventListener('open', r));

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.bringToFront');

  console.log('1. Navigating to http://localhost:5173/?map=range...');
  await send('Page.navigate', { url: 'http://localhost:5173/?map=range' });
  await new Promise(r => setTimeout(r, 2000));

  // Helper to click canvas with real user gesture via CDP to lock pointer
  async function ensurePointerLock() {
    await send('Page.bringToFront');
    // Dismiss overlay if present
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const overlay = document.getElementById('instructions-overlay');
          if (overlay) {
            overlay.click();
            overlay.style.display = 'none';
          }
          if (window.__fpsApp && window.__fpsApp.hud) {
            window.__fpsApp.hud.isDismissed = true;
          }
        })()
      `
    });
    await new Promise(r => setTimeout(r, 100));

    // Dispatch real mouse click on canvas
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: 500,
      y: 400,
      button: 'left',
      clickCount: 1
    });
    await new Promise(r => setTimeout(r, 50));
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 500,
      y: 400,
      button: 'left',
      clickCount: 1
    });
    await new Promise(r => setTimeout(r, 200));

    const lockStatus = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const app = window.__fpsApp;
          if (!app.controls.isLocked) {
            try { document.getElementById('game-canvas').requestPointerLock(); } catch(e){}
          }
          return {
            isLocked: app.controls.isLocked,
            pointerLockElement: !!document.pointerLockElement
          };
        })()
      `,
      returnByValue: true
    });
    return lockStatus.result.value;
  }

  console.log('Lock status in Map A (range):', await ensurePointerLock());

  // Map Switch Sequence: A (range) -> B (foundry) -> C (culdesac) -> A (range)
  console.log('\n2. Switching to Map B (foundry)...');
  await send('Runtime.evaluate', {
    expression: `window.__fpsApp.switchMap('foundry')`,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 1000));
  console.log('Lock status in Map B (foundry):', await ensurePointerLock());

  console.log('\n3. Switching to Map C (culdesac)...');
  await send('Runtime.evaluate', {
    expression: `window.__fpsApp.switchMap('culdesac')`,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 1000));
  console.log('Lock status in Map C (culdesac):', await ensurePointerLock());

  console.log('\n4. Switching back to Map A (range)...');
  await send('Runtime.evaluate', {
    expression: `window.__fpsApp.switchMap('range')`,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 1000));
  const finalLock = await ensurePointerLock();
  console.log('Lock status in Map A after switch sequence:', finalLock);

  // Equip AK-47, clear telemetry
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        window.__fpsApp.weaponManager.switchWeapon('ak47');
        window.__shotTelemetry = [];
      })()
    `
  });

  // ── BURST 1: Hold fire for 3.0 s ───────────────────────────────────────────
  console.log('\n5. HOLDING FIRE FOR 3.0 SECONDS (BURST 1)...');
  const domAmmoLog1 = [];

  // Poll DOM ammo at 30 Hz while holding fire
  const pollInterval = setInterval(async () => {
    try {
      const res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const el = document.getElementById('ammo-counter') || document.querySelector('.ammo-display');
            return {
              text: el ? el.innerText : '',
              weaponClip: window.__fpsApp.weaponManager.weaponState.ammoInClip,
              t: performance.now()
            };
          })()
        `,
        returnByValue: true
      });
      domAmmoLog1.push(res.result.value);
    } catch(e){}
  }, 33);

  const startT1 = performance.now();
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 400,
    y: 300,
    button: 'left',
    clickCount: 1
  });

  await new Promise(r => setTimeout(r, 3000));

  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 400,
    y: 300,
    button: 'left',
    clickCount: 1
  });
  clearInterval(pollInterval);
  const dur1 = ((performance.now() - startT1) / 1000).toFixed(2);

  const telemetry1 = await send('Runtime.evaluate', {
    expression: `JSON.stringify(window.__shotTelemetry)`,
    returnByValue: true
  });
  const shots1 = JSON.parse(telemetry1.result.value || '[]');
  console.log(`Burst 1 Complete: Duration=${dur1}s, Shots Fired=${shots1.length}`);
  console.log('First 5 Shot Timestamps (Burst 1):', shots1.slice(0, 5));
  console.log('Last 5 Shot Timestamps (Burst 1):', shots1.slice(-5));

  // Filter unique DOM ammo transitions
  const uniqueAmmoTransitions1 = [];
  let lastAmmo1 = null;
  for (const d of domAmmoLog1) {
    if (d && d.weaponClip !== lastAmmo1) {
      uniqueAmmoTransitions1.push({ t: +(d.t - startT1).toFixed(1), ammo: d.weaponClip, hudText: d.text.trim().replace(/\\s+/g, ' ') });
      lastAmmo1 = d.weaponClip;
    }
  }
  console.log('DOM Ammo Transitions (Burst 1):', uniqueAmmoTransitions1);

  // ── RELOAD ─────────────────────────────────────────────────────────────────
  console.log('\n6. TRIGGERING RELOAD (Press KeyR)...');
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'KeyR', key: 'r', windowsVirtualKeyCode: 82 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyR', key: 'r', windowsVirtualKeyCode: 82 });

  // Wait 2.5s for reload animation and ammo refill to complete
  await new Promise(r => setTimeout(r, 2500));

  const postReloadAmmo = await send('Runtime.evaluate', {
    expression: `window.__fpsApp.weaponManager.weaponState.ammoInClip`,
    returnByValue: true
  });
  console.log('Ammo after reload:', postReloadAmmo.result.value);

  // ── BURST 2: Hold fire for 3.0 s again ─────────────────────────────────────
  console.log('\n7. HOLDING FIRE FOR 3.0 SECONDS AGAIN (BURST 2)...');
  await send('Runtime.evaluate', { expression: `window.__shotTelemetry = [];` });
  const domAmmoLog2 = [];

  const pollInterval2 = setInterval(async () => {
    try {
      const res = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const el = document.getElementById('ammo-counter') || document.querySelector('.ammo-display');
            return {
              text: el ? el.innerText : '',
              weaponClip: window.__fpsApp.weaponManager.weaponState.ammoInClip,
              t: performance.now()
            };
          })()
        `,
        returnByValue: true
      });
      domAmmoLog2.push(res.result.value);
    } catch(e){}
  }, 33);

  const startT2 = performance.now();
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 400,
    y: 300,
    button: 'left',
    clickCount: 1
  });

  await new Promise(r => setTimeout(r, 3000));

  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 400,
    y: 300,
    button: 'left',
    clickCount: 1
  });
  clearInterval(pollInterval2);
  const dur2 = ((performance.now() - startT2) / 1000).toFixed(2);

  const telemetry2 = await send('Runtime.evaluate', {
    expression: `JSON.stringify(window.__shotTelemetry)`,
    returnByValue: true
  });
  const shots2 = JSON.parse(telemetry2.result.value || '[]');
  console.log(`Burst 2 Complete: Duration=${dur2}s, Shots Fired=${shots2.length}`);
  console.log('First 5 Shot Timestamps (Burst 2):', shots2.slice(0, 5));
  console.log('Last 5 Shot Timestamps (Burst 2):', shots2.slice(-5));

  const uniqueAmmoTransitions2 = [];
  let lastAmmo2 = null;
  for (const d of domAmmoLog2) {
    if (d && d.weaponClip !== lastAmmo2) {
      uniqueAmmoTransitions2.push({ t: +(d.t - startT2).toFixed(1), ammo: d.weaponClip, hudText: d.text.trim().replace(/\\s+/g, ' ') });
      lastAmmo2 = d.weaponClip;
    }
  }
  console.log('DOM Ammo Transitions (Burst 2):', uniqueAmmoTransitions2);

  ws.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
