// scripts/diagnose-raycast.mjs
async function run() {
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const target = list.find(x => x.url.includes('localhost:5173'));
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

  const r = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const app = window.__fpsApp;
        await app.switchMap('dustline');
        await new Promise(r => setTimeout(r, 600));
        const scene = app.scene;
        const THREE = window.THREE;

        const raycaster = new THREE.Raycaster();
        raycaster.layers.set(0);

        // 1. Raycast towards Bazaar HQ solid exterior wall (at x=-13, z=-7)
        raycaster.set(new THREE.Vector3(-13, 1.5, 0), new THREE.Vector3(0, 0, -1));
        const wallHits = raycaster.intersectObjects(scene.children, true).map(h => ({
          name: h.object.name || h.object.geometry?.type,
          point: { x: +h.point.x.toFixed(2), y: +h.point.y.toFixed(2), z: +h.point.z.toFixed(2) },
          layer: h.object.layers.mask
        }));

        // 2. Raycast through window opening at x=-21, y=1.7 (window is at z=-7)
        raycaster.set(new THREE.Vector3(-21, 1.7, -4), new THREE.Vector3(0, 0, -1));
        const winHits = raycaster.intersectObjects(scene.children, true).map(h => ({
          name: h.object.name || h.object.geometry?.type,
          point: { x: +h.point.x.toFixed(2), y: +h.point.y.toFixed(2), z: +h.point.z.toFixed(2) },
          layer: h.object.layers.mask
        }));

        // 3. Foliage raycast towards palm canopy at [-24, 6, 8]
        raycaster.set(new THREE.Vector3(-24, 6, 0), new THREE.Vector3(0, 0, 1));
        const treeHits = raycaster.intersectObjects(scene.children, true).map(h => ({
          name: h.object.name || h.object.geometry?.type,
          point: { x: +h.point.x.toFixed(2), y: +h.point.y.toFixed(2), z: +h.point.z.toFixed(2) },
          layer: h.object.layers.mask
        }));

        return { wallHits, winHits, treeHits };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Full r:', JSON.stringify(r, null, 2));

  ws.close();
}

run().catch(console.error);
