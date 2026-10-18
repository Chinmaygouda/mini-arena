import fs from 'node:fs';

async function main() {
  const res = await fetch('http://127.0.0.1:9222/json');
  const pages = await res.json();
  const page = pages.find(p => p.url.includes('localhost:5173') && !p.url.includes('soundtest'));
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (m, p={}) => new Promise(r => {
    const cur = id++;
    const h = (e) => { const d = JSON.parse(e.data); if (d.id === cur) { ws.removeEventListener('message', h); r(d.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: cur, method: m, params: p }));
  });
  await send('Runtime.evaluate', { expression: `
    window.__weaponManager.switchWeapon('ak47');
    for(let i=0; i<30; i++) window.__weaponManager.update(0.016, {x:0, y:0}, false, false, 0);
  ` });
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/5618d13b-17a0-4ad6-8787-4ecd7ffd8f73/ak47_reference_view.png', Buffer.from(shot.data, 'base64'));
  await send('Runtime.evaluate', { expression: `
    window.__weaponManager.switchWeapon('sniper');
    for(let i=0; i<30; i++) window.__weaponManager.update(0.016, {x:0, y:0}, false, false, 0);
  ` });
  ws.close();
  console.log('AK-47 reference captured!');
}

main().catch(console.error);
