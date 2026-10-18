// scripts/test-shotgun.mjs
async function main() {
  const ws = new globalThis.WebSocket('ws://127.0.0.1:9222/devtools/page/1924EE273697BBB41C4128113F5E111F');
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = msgId++;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.send(JSON.stringify({ id, method, params }));
  });

  const code = `
  (() => {
    const app = window.__fpsApp;
    app.weaponManager.switchWeapon('shotgun');
    app.weaponManager.setAmmo(8, 32);

    // Advance 0.4s to complete equip/ready animation
    for (let i = 0; i < 25; i++) {
      app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
    }

    const capturedPellets = [];
    const origSpawn = app.spawnTracer;
    app.spawnTracer = function(from, to) {
      capturedPellets.push({
        from: { x: from.x, y: from.y, z: from.z },
        to: { x: to.x, y: to.y, z: to.z }
      });
      return origSpawn.call(app, from, to);
    };

    app.weaponManager.setTrigger(true);
    app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
    app.weaponManager.setTrigger(false);

    app.spawnTracer = origSpawn;

    const muzzle = app.camera.position.clone();
    app.weaponManager.getActiveMuzzleWorldPosition(muzzle);

    return {
      pelletCount: capturedPellets.length,
      muzzleY: muzzle.y,
      pellets: capturedPellets.map(p => ({
        fromY: p.from.y,
        toX: p.to.x,
        toY: p.to.y,
        toZ: p.to.z
      }))
    };
  })()
  `;

  const res = await send('Runtime.evaluate', { expression: code, returnByValue: true });
  console.log('Result:', JSON.stringify(res, null, 2));
  ws.close();
}

main().catch(console.error);
