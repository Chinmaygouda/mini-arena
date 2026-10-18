// scripts/capture-sniper-screenshot.mjs
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

  // Dismiss start overlay
  await send('Runtime.evaluate', {
    expression: 'document.getElementById("start-overlay")?.click();'
  });
  await new Promise(r => setTimeout(r, 400));

  // Switch to sniper
  await send('Runtime.evaluate', {
    expression: `
      window.__weaponManager.switchWeapon('sniper');
      window.__weaponManager.toggleADS(false);
    `
  });
  await new Promise(r => setTimeout(r, 600));

  const res = await send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(res.data, 'base64');
  const path = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/fd669695-232e-421c-895b-222183896b36/aw50_sniper_in_game_view.png';
  fs.writeFileSync(path, buf);
  console.log('Saved screenshot to:', path);

  ws.close();
}

main().catch(console.error);
