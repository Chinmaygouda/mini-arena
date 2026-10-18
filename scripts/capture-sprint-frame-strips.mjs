// scripts/capture-sprint-frame-strips.mjs
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/5618d13b-17a0-4ad6-8787-4ecd7ffd8f73';
const WEAPONS = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];

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

  console.log('Navigating to http://localhost:5173/?map=range...');
  await send('Page.navigate', { url: 'http://localhost:5173/?map=range' });
  await new Promise(r => setTimeout(r, 2000));

  // Dismiss overlays & engage pointer lock
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        if (window.__fpsApp && window.__fpsApp.hud) {
          window.__fpsApp.hud.isDismissed = true;
          if (window.__fpsApp.hud.promptOverlay) {
            window.__fpsApp.hud.promptOverlay.style.display = 'none';
          }
        }
        const o = document.getElementById('instructions-overlay');
        if (o) o.style.display = 'none';
      })()
    `
  });
  await new Promise(r => setTimeout(r, 200));

  async function snap(name) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(ARTIFACT_DIR, name);
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${name}`);
    return outPath;
  }

  const capturedManifest = {};

  for (const w of WEAPONS) {
    console.log(`\n=== Capturing Sprint Frame Strip for ${w} ===`);
    capturedManifest[w] = {};

    // 1. Switch weapon and reset position
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const app = window.__fpsApp;
          app.weaponManager.switchWeapon('${w}');
          app.controls.setPosition(0, 1.7, 0, 0);
          app.controls.velocity.set(0, 0, 0);
          app.controls.input.forward = false;
          app.controls.input.sprint = false;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 400));

    // Capture 1: Idle
    capturedManifest[w].idle = await snap(`sprint_${w}_1_idle.png`);

    // 2. Sprint Start (~100ms in)
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const app = window.__fpsApp;
          app.controls.input.forward = true;
          app.controls.input.sprint = true;
        })()
      `
    });
    await new Promise(r => setTimeout(r, 120));
    capturedManifest[w].sprint_start = await snap(`sprint_${w}_2_start.png`);

    // 3. Steady Sprint (full speed running, bob in motion)
    await new Promise(r => setTimeout(r, 500));
    capturedManifest[w].steady_sprint = await snap(`sprint_${w}_3_steady.png`);

    // 4. Sprint Stop (inputs released, recovering)
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const app = window.__fpsApp;
          app.controls.input.forward = false;
          app.controls.input.sprint = false;
          app.controls.setPosition(0, 1.7, 0, 0);
          app.controls.velocity.set(0, 0, 0);
        })()
      `
    });
    await new Promise(r => setTimeout(r, 120));
    capturedManifest[w].sprint_stop = await snap(`sprint_${w}_4_stop.png`);
  }

  console.log('\nAll frame strips captured successfully!');
  console.log(JSON.stringify(capturedManifest, null, 2));

  ws.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
