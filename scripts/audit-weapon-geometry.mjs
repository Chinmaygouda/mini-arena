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
      cam.updateMatrixWorld(true);

      const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];
      const results = {};

      for (const wid of weapons) {
        wm.switchWeapon(wid);
        const comp = wm[wid];
        
        // Find all cylinders and boxes in gunMeshGroup to identify barrel and tip
        const meshes = [];
        comp.gunMeshGroup.traverse(c => {
          if (c.isMesh && c.geometry) {
            c.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(c);
            meshes.push({
              name: c.name || c.geometry.type,
              type: c.geometry.type,
              pos: c.position.clone(),
              rot: { x: c.rotation.x, y: c.rotation.y, z: c.rotation.z },
              minZ: box.min.z,
              maxZ: box.max.z,
              minY: box.min.y,
              maxY: box.max.y,
              center: box.getCenter(new THREE.Vector3()),
              size: box.getSize(new THREE.Vector3())
            });
          }
        });

        // Find the mesh with the minimum local Z (furthest forward down the barrel)
        // Since guns point in -Z, the furthest forward part has the lowest Z in gunMeshGroup local space
        let minLocalZ = 999;
        let furthestMesh = null;
        let furthestTip = new THREE.Vector3();

        comp.gunMeshGroup.traverse(c => {
          if (c.isMesh && c.geometry && !c.name?.includes('flash') && !c.name?.includes('marker') && !c.userData?.isTracer) {
            // Find vertex with lowest Z in gunMeshGroup space
            const posAttr = c.geometry.attributes.position;
            if (posAttr) {
              const v = new THREE.Vector3();
              for (let i = 0; i < posAttr.count; i++) {
                v.fromBufferAttribute(posAttr, i);
                v.applyMatrix4(c.matrix); // to gunMeshGroup local space
                if (v.z < minLocalZ) {
                  minLocalZ = v.z;
                  furthestTip.copy(v);
                  furthestMesh = c;
                }
              }
            }
          }
        });

        results[wid] = {
          muzzlePointLocal: comp.muzzlePoint ? comp.muzzlePoint.position : null,
          furthestGeometryTip: furthestTip,
          diffZ: comp.muzzlePoint ? (comp.muzzlePoint.position.z - furthestTip.z) : null,
          diffY: comp.muzzlePoint ? (comp.muzzlePoint.position.y - furthestTip.y) : null,
          diffX: comp.muzzlePoint ? (comp.muzzlePoint.position.x - furthestTip.x) : null,
          distance: comp.muzzlePoint ? comp.muzzlePoint.position.distanceTo(furthestTip) : null
        };
      }

      return results;
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(r.result.value, null, 2));
  ws.close();
}

main().catch(console.error);
