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

  const data = await evalCode(`
    (() => {
      const wm = window.__weaponManager;
      wm.switchWeapon('ak47');
      for (let i = 0; i < 40; i++) wm.update(0.016, {x:0, y:0}, false, false, 0);

      const ak = wm.ak47;
      let barrelMesh = null;
      let brakeMesh = null;
      ak.gunMeshGroup.traverse(c => {
        if (c.geometry && c.geometry.type === 'CylinderGeometry') {
          if (c.geometry.parameters.height === 0.45) barrelMesh = c;
          if (c.geometry.parameters.height === 0.055) brakeMesh = c;
        }
      });

      const barrelWorld = new THREE.Vector3();
      const brakeWorld = new THREE.Vector3();
      const muzzleFlashWorld = new THREE.Vector3();
      const getActiveMuzzle = new THREE.Vector3();

      wm.rootGroup.updateMatrixWorld(true);
      if (barrelMesh) barrelMesh.getWorldPosition(barrelWorld);
      if (brakeMesh) brakeMesh.getWorldPosition(brakeWorld);
      ak.muzzleFlashGroup.getWorldPosition(muzzleFlashWorld);
      wm.getActiveMuzzleWorldPosition(getActiveMuzzle);

      const camera = wm.camera;
      const brakeScreen = brakeWorld.clone().project(camera);
      const muzzleScreen = getActiveMuzzle.clone().project(camera);

      return {
        barrelLocal: barrelMesh ? barrelMesh.position : null,
        barrelWorld,
        brakeLocal: brakeMesh ? brakeMesh.position : null,
        brakeWorld,
        brakeScreen: { x: brakeScreen.x.toFixed(3), y: brakeScreen.y.toFixed(3), z: brakeScreen.z.toFixed(3) },
        muzzleFlashLocal: ak.muzzleFlashGroup.position,
        muzzleFlashWorld,
        getActiveMuzzle,
        muzzleScreen: { x: muzzleScreen.x.toFixed(3), y: muzzleScreen.y.toFixed(3), z: muzzleScreen.z.toFixed(3) },
        rootGroupPos: wm.rootGroup.position,
        akRootPos: ak.root.position,
        gunMeshGroupPos: ak.gunMeshGroup.position
      };
    })()
  `);

  console.log(JSON.stringify(data, null, 2));
  ws.close();
}

main().catch(console.error);
