// scripts/diagnose-stairs.mjs
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
        await new Promise(r => setTimeout(r, 400));
        const controls = app.controls;
        controls.setPosition(-11.2, 8.1, -18.5, Math.PI); // facing +Z to descend from roof
        controls.velocity.set(0, 0, 0);
        const traj = [];
        let blockingCollider = null;

        for (let i = 0; i < 90; i++) {
          controls.input.forward = true;
          const prevZ = controls.position.z;
          controls.update(1/60);
          
          if (Math.abs(controls.position.z - prevZ) < 0.001 && !blockingCollider) {
            // Find what blocked Z
            const feetY = controls.position.y - 1.7;
            const headY = controls.position.y + 0.15;
            const nextZ = controls.position.z + 0.1;
            const curX = controls.position.x;
            const r = 0.35;
            blockingCollider = controls.colliders.filter(c => {
              if (c.minY > headY) return false;
              if (c.maxY <= feetY + 0.05) return false;
              if (controls.isGrounded && c.maxY <= feetY + 0.35) return false;
              return (
                curX + r > c.minX && curX - r < c.maxX &&
                nextZ + r > c.minZ && nextZ - r < c.maxZ
              );
            });
          }

          if (i % 5 === 0) {
            traj.push({
              step: i,
              pos: { x: +controls.position.x.toFixed(2), y: +controls.position.y.toFixed(2), z: +controls.position.z.toFixed(2) },
              isGrounded: controls.isGrounded,
              vel: { x: +controls.velocity.x.toFixed(2), y: +controls.velocity.y.toFixed(2), z: +controls.velocity.z.toFixed(2) }
            });
          }
        }
        controls.input.forward = false;
        return { traj, blockingCollider };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Final pos:', r.result.value.traj[r.result.value.traj.length - 1]);
  console.log('Blocking Colliders:');
  console.log(JSON.stringify(r.result.value.blockingCollider, null, 2));

  ws.close();
}

run().catch(console.error);
