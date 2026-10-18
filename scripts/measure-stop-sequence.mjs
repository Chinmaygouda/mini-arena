// scripts/measure-stop-sequence.mjs
// Native WebSocket

async function getWsUrl() {
  const res = await fetch('http://127.0.0.1:9222/json');
  const tabs = await res.json();
  const rangeTab = tabs.find(t => t.title.includes('RANGE') && t.type === 'page');
  return rangeTab.webSocketDebuggerUrl;
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new globalThis.WebSocket(wsUrl);
    this.msgId = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.msgId++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  const wsUrl = await getWsUrl();
  const client = new CDPClient(wsUrl);
  await client.connect();

  console.log('Resetting player to (X=0, Y=1.7, Z=3) facing -Z...');
  await client.eval(`(() => {
    const app = window.__fpsApp;
    app.controls.setPosition(0, 1.7, 3, 0);
  })()`);

  console.log('Recording transition: 40 frames walk -> release key -> 40 frames stop...');
  const records = await client.eval(`(async () => {
    const app = window.__fpsApp;
    const data = [];
    let frame = 0;

    return new Promise((resolve) => {
      function tick() {
        frame++;
        
        // Walk for 40 frames, then release
        const isWalk = frame <= 40;
        app.controls.input.forward = isWalk;

        const p = app.controls.position;
        const v = app.controls.velocity;
        const c = app.camera.position;
        const w = app.weaponManager;

        data.push({
          frame,
          isWalk,
          z: p.z,
          speed: Math.hypot(v.x, v.z),
          isMoving: app.controls.isMoving,
          camY: c.y,
          headBob: c.y - p.y,
          rootY: w.rootGroup.position.y,
          rootRotZ: w.rootGroup.rotation.z,
          sprintWeight: w.sprintWeight
        });

        if (frame < 80) {
          requestAnimationFrame(tick);
        } else {
          app.controls.input.forward = false;
          resolve(data);
        }
      }
      requestAnimationFrame(tick);
    });
  })()`);

  console.log('\n--- TRANSITION ANALYSIS (Frames 35..55: key released at frame 41) ---');
  for (let f = 35; f <= 55; f++) {
    const r = records[f - 1];
    const prev = records[f - 2];
    const dZ = prev ? ((r.z - prev.z) * 100).toFixed(2) : '0';
    console.log(`Frame ${r.frame} (${r.isWalk ? 'HELD' : 'RELEASED'}): speed=${r.speed.toFixed(3)} m/s | isMoving=${r.isMoving} | dZ=${dZ}cm | headBob=${(r.headBob*100).toFixed(2)}cm | wepY=${r.rootY.toFixed(4)} | wepRotZ=${(r.rootRotZ*180/Math.PI).toFixed(2)}°`);
  }

  client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
