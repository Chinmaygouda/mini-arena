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

  const r = await send('Runtime.evaluate', {
    expression: `(() => {
      const wm = window.__weaponManager;
      const cam = wm.camera;
      
      const checkWeapon = (id) => {
        wm.switchWeapon(id);
        const cur = wm.currentDef;
        const comp = wm[id];
        
        const muzzleWorld = new THREE.Vector3();
        wm.getActiveMuzzleWorldPosition(muzzleWorld);
        
        const muzzleScreen = muzzleWorld.clone().project(cam);
        
        return {
          id,
          hasMuzzlePoint: Boolean(comp.muzzlePoint),
          muzzleLocalPos: comp.muzzlePoint ? comp.muzzlePoint.position : null,
          muzzleWorldPos: muzzleWorld,
          muzzleScreenPos: { x: muzzleScreen.x.toFixed(3), y: muzzleScreen.y.toFixed(3), z: muzzleScreen.z.toFixed(3) },
          gunMeshGroupPos: comp.gunMeshGroup.position,
          gunMeshGroupRot: { x: comp.gunMeshGroup.rotation.x.toFixed(3), y: comp.gunMeshGroup.rotation.y.toFixed(3), z: comp.gunMeshGroup.rotation.z.toFixed(3) },
          rootGroupPos: { x: wm.rootGroup.position.x.toFixed(3), y: wm.rootGroup.position.y.toFixed(3), z: wm.rootGroup.position.z.toFixed(3) },
          cameraPos: { x: cam.position.x.toFixed(3), y: cam.position.y.toFixed(3), z: cam.position.z.toFixed(3) }
        };
      };

      return ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'].map(checkWeapon);
    })()`,
    returnByValue: true
  });
  console.log(JSON.stringify(r.result.value, null, 2));
  ws.close();
}

main().catch(console.error);
