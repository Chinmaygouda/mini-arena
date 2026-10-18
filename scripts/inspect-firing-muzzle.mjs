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

  const evalCode = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  };

  const results = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.switchWeapon('ak47');
      for (let i = 0; i < 30; i++) wm.update(0.016, {x:0, y:0}, false, false, 0);

      // Record what onFireRaycast receives
      let firedShot = null;
      const originalOnFire = wm.onFireRaycast;
      wm.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection, weaponDef) => {
        firedShot = {
          muzzleOrigin: muzzleOrigin.clone(),
          aimOrigin: aimOrigin.clone(),
          aimDirection: aimDirection.clone()
        };
        if (originalOnFire) originalOnFire(muzzleOrigin, aimOrigin, aimDirection, weaponDef);
      };

      // 1. Fire in HIP
      wm.setTrigger(true);
      wm.update(0.016, {x:0, y:0}, false, false, 0);
      wm.setTrigger(false);
      const hipFired = firedShot;
      firedShot = null;

      // 2. Fire in ADS
      wm.toggleADS(true);
      for (let i = 0; i < 40; i++) wm.update(0.016, {x:0, y:0}, false, false, 0);
      wm.setTrigger(true);
      wm.update(0.016, {x:0, y:0}, false, false, 0);
      wm.setTrigger(false);
      const adsFired = firedShot;
      wm.toggleADS(false);
      for (let i = 0; i < 30; i++) wm.update(0.016, {x:0, y:0}, false, false, 0);

      wm.onFireRaycast = originalOnFire;

      return {
        hipFired,
        adsFired,
        cameraPos: wm.camera.position,
        cameraQuat: wm.camera.quaternion,
      };
    })()
  `);

  console.log('Fired shot telemetry:');
  console.log(JSON.stringify(results, null, 2));

  ws.close();
}

main().catch(console.error);
