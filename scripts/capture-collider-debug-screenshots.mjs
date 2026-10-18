// scripts/capture-collider-debug-screenshots.mjs
import fs from 'fs';
import path from 'path';

async function capture() {
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

  const artifactDir = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/5618d13b-17a0-4ad6-8787-4ecd7ffd8f73';

  // 1. Capture Foundry Yard with colliders wireframe
  console.log('Capturing Foundry Yard with colliders wireframe...');
  await send('Page.navigate', { url: 'http://localhost:5173/?map=foundry&debug=1&colliders=1' });
  await new Promise(r => setTimeout(r, 2500));
  // Dismiss instruction overlay
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
  await new Promise(r => setTimeout(r, 500));
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const path1 = path.join(artifactDir, 'foundry_debug_colliders.png');
  fs.writeFileSync(path1, Buffer.from(shot1.data, 'base64'));
  console.log('Saved Foundry debug screenshot to:', path1);

  // 2. Capture Cul-de-Sac with colliders wireframe
  console.log('Capturing Cul-de-Sac with colliders wireframe...');
  await send('Page.navigate', { url: 'http://localhost:5173/?map=culdesac&debug=1&colliders=1' });
  await new Promise(r => setTimeout(r, 2500));
  // Dismiss instruction overlay
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
  await new Promise(r => setTimeout(r, 500));
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const path2 = path.join(artifactDir, 'culdesac_debug_colliders.png');
  fs.writeFileSync(path2, Buffer.from(shot2.data, 'base64'));
  console.log('Saved Cul-de-Sac debug screenshot to:', path2);

  ws.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
