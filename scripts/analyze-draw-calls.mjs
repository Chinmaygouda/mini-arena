// scripts/analyze-draw-calls.mjs
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
      (() => {
        const app = window.__fpsApp;
        const scene = app.scene;
        const groups = {};

        scene.traverse(obj => {
          if (obj.isMesh) {
            let p = obj.parent;
            let groupName = 'root';
            while (p && p !== scene) {
              if (p.name) { groupName = p.name; break; }
              p = p.parent;
            }
            groups[groupName] = (groups[groupName] || 0) + 1;
          }
        });

        return groups;
      })()
    `,
    returnByValue: true
  });

  console.log('Mesh Counts by Group:', JSON.stringify(r.result.value, null, 2));
  ws.close();
}

run().catch(console.error);
