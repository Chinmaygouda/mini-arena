// scripts/capture-strafe-frames.mjs
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
  console.log('Connected to CDP');

  // Dismiss start overlay
  await send('Runtime.evaluate', {
    expression: 'document.getElementById("start-overlay")?.click();'
  });
  await new Promise(r => setTimeout(r, 200));

  // Enable debug muzzle marker so we can see the exact muzzle position
  await send('Runtime.evaluate', {
    expression: 'window.__weaponManager?.setDebugMuzzleMarker(true);'
  });

  // Switch to ak47, set ammo
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const wm = window.__weaponManager;
        const ctrl = window.__fpsApp.controls;
        wm.switchWeapon('ak47');
        wm.setAmmo(30, 999);
        wm.toggleADS(false);
        ctrl.input.forward = false;
        ctrl.input.backward = false;
        ctrl.input.left = true; // Strafe left
        ctrl.input.right = false;
      })()
    `
  });

  // Wait 400ms for strafe velocity to build up
  await new Promise(r => setTimeout(r, 400));

  // Trigger fire and capture 6 consecutive frames
  await send('Runtime.evaluate', {
    expression: 'window.__weaponManager.setTrigger(true);'
  });

  for (let f = 0; f < 8; f++) {
    // Wait for animation frame
    await send('Runtime.evaluate', {
      expression: 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))',
      awaitPromise: true,
    });

    const shotScreenshot = await send('Page.captureScreenshot', { format: 'png' });
    const screenPath = `C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/fd669695-232e-421c-895b-222183896b36/strafe_frame_${f}.png`;
    fs.writeFileSync(screenPath, Buffer.from(shotScreenshot.data, 'base64'));
    console.log(`Saved frame ${f}`);
  }

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const wm = window.__weaponManager;
        const ctrl = window.__fpsApp.controls;
        wm.setTrigger(false);
        ctrl.input.left = false;
        ctrl.velocity.set(0, 0, 0);
      })()
    `
  });

  ws.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
