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
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result?.value;
  };

  const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];
  for (const weaponId of weapons) {
    console.log(`\n================ WEAPON: ${weaponId} ================`);
    const diag = await evalCode(`
      (() => {
        const wm = window.__weaponManager;
        wm.switchWeapon('${weaponId}');
        for (let i = 0; i < 40; i++) wm.update(0.016, {x:0, y:0}, false, false, 0);

        const camera = wm.camera;
        const target = new THREE.Vector3();
        const hipMuzzle = wm.getActiveMuzzleWorldPosition(new THREE.Vector3());
        
        // Project to screen [-1, 1]
        const hipScreen = hipMuzzle.clone().project(camera);

        // Now test in ADS (if supported)
        wm.toggleADS(true);
        for (let i = 0; i < 40; i++) wm.update(0.016, {x:0, y:0}, false, false, 0);
        const adsMuzzle = wm.getActiveMuzzleWorldPosition(new THREE.Vector3());
        const adsScreen = adsMuzzle.clone().project(camera);
        wm.toggleADS(false);
        for (let i = 0; i < 40; i++) wm.update(0.016, {x:0, y:0}, false, false, 0);

        return {
          weaponId: '${weaponId}',
          cameraPos: camera.position,
          cameraRot: { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
          rootGroupPos: wm.rootGroup.position,
          rootGroupRot: { x: wm.rootGroup.rotation.x, y: wm.rootGroup.rotation.y, z: wm.rootGroup.rotation.z },
          hipMuzzle,
          hipScreen: { x: hipScreen.x.toFixed(3), y: hipScreen.y.toFixed(3), z: hipScreen.z.toFixed(3) },
          adsMuzzle,
          adsScreen: { x: adsScreen.x.toFixed(3), y: adsScreen.y.toFixed(3), z: adsScreen.z.toFixed(3) },
        };
      })()
    `);
    console.log(JSON.stringify(diag, null, 2));
  }

  ws.close();
}

main().catch(console.error);
