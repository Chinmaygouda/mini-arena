// scripts/inventory-range-audit.mjs
// Step 1: Inventory (read-only) Audit of current shot casting, raycast length, far value, damage calculation, and tracer behavior.

async function runInventoryAudit() {
  console.log('========================================================================');
  console.log(' STEP 1: INVENTORY (READ-ONLY) — RANGE & BALLISTICS AUDIT');
  console.log('========================================================================\n');

  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const target = list.find(x => x.url.includes('localhost:5173'));
  if (!target) throw new Error('Vite dev tab not found on port 9222');

  const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
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
  await new Promise(r => { ws.onopen = r; });

  const auditResult = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const app = window.__fpsApp;
        await app.switchMap('range');
        await new Promise(r => setTimeout(r, 400));
        const tm = app.targetManager;
        const wm = app.weaponManager;
        const THREE = window.THREE;

        // Current weapons in registry
        const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];
        const weaponDefs = weapons.map(id => {
          const def = wm.getWeaponDef ? wm.getWeaponDef(id) : window.THREE; // check def
          return {
            id,
            damage: def?.damage,
            critMultiplier: def?.critMultiplier,
            pellets: def?.pellets || 1,
            spreadBase: def?.spreadBase
          };
        });

        // Test distances to measure maximum hit distance
        const testDistances = [5, 25, 50, 100, 149, 151, 200];
        const results = [];

        // Temporary target for testing
        const tempGroup = new THREE.Group();
        const targetGeom = new THREE.CylinderGeometry(0.3, 0.3, 1.6, 8);
        const targetMat = new THREE.MeshBasicMaterial();
        const targetMesh = new THREE.Mesh(targetGeom, targetMat);
        targetMesh.position.y = 0.8;
        targetMesh.userData = { isTarget: true, isHead: false };
        tempGroup.add(targetMesh);
        app.scene.add(tempGroup);

        for (const wId of weapons) {
          const wDef = weaponDefs.find(w => w.id === wId);
          for (const d of testDistances) {
            tempGroup.position.set(0, 0, -d);
            tempGroup.updateMatrixWorld(true);

            const hitResult = tm.checkBallisticHit(
              new THREE.Vector3(0, 1.5, 0),
              new THREE.Vector3(0, 1.5, 0),
              new THREE.Vector3(0, 0, -1),
              wDef.damage || 30,
              wDef.critMultiplier || 2.0
            );

            results.push({
              weapon: wId,
              distance: d,
              hit: hitResult.hit,
              damage: hitResult.damage,
              targetType: hitResult.targetType,
              hitPointZ: +hitResult.point.z.toFixed(2)
            });
          }
        }

        app.scene.remove(tempGroup);
        targetGeom.dispose();
        targetMat.dispose();

        return {
          raycasterFar: tm.raycaster ? tm.raycaster.far : 150,
          results
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  const data = auditResult.result.value;
  console.log(`Hardcoded Raycaster Far Value in TargetManager: ${data.raycasterFar} m\n`);
  console.log('Measured Hit Results Across Test Distances Today:');
  console.table(data.results);

  ws.close();
}

runInventoryAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
