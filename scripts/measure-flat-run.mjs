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

  console.log('Resetting player to (X=-6, Y=1.7, Z=2) facing +X (yaw = -PI/2) for unobstructed 12m run...');
  await client.eval(`(() => {
    const app = window.__fpsApp;
    app.controls.setPosition(-6, 1.7, 2, -Math.PI / 2);
  })()`);

  console.log('Recording 120 frames of unobstructed sprint along +X...');
  const records = await client.eval(`(async () => {
    const app = window.__fpsApp;
    const data = [];
    let frame = 0;

    return new Promise((resolve) => {
      function tick() {
        frame++;
        // Press forward (which is +X with yaw = -PI/2) and sprint
        app.controls.input.forward = true;
        app.controls.input.sprint = true;

        const p = app.controls.position;
        const v = app.controls.velocity;
        const c = app.camera.position;
        const w = app.weaponManager;

        data.push({
          frame,
          x: p.x, y: p.y, z: p.z,
          speed: Math.hypot(v.x, v.z),
          velX: v.x,
          grounded: app.controls.isGrounded,
          camY: c.y,
          headBob: c.y - p.y,
          rootY: w.rootGroup.position.y,
          rootX: w.rootGroup.position.x,
          rootRotX: w.rootGroup.rotation.x,
          rootRotZ: w.rootGroup.rotation.z,
          sprintWeight: w.sprintWeight
        });

        if (frame < 80) {
          requestAnimationFrame(tick);
        } else {
          app.controls.input.forward = false;
          app.controls.input.sprint = false;
          resolve(data);
        }
      }
      requestAnimationFrame(tick);
    });
  })()`);

  console.log(`Captured ${records.length} frames of flat unobstructed sprint:`);
  console.log('Frame 0 speed:', records[0].speed.toFixed(3), 'Frame 20 speed:', records[20].speed.toFixed(3), 'Frame 40 speed:', records[40].speed.toFixed(3));
  console.log('X range:', records[0].x.toFixed(2), '->', records[records.length-1].x.toFixed(2), `(traveled ${(records[records.length-1].x - records[0].x).toFixed(2)}m)`);
  
  // Steady sprint: frames 30 to 70
  const steady = records.slice(30, 70);
  console.log('\n--- STEADY SPRINT TELEMETRY (Frames 30..70) ---');
  console.log('Speed:', steady[0].speed.toFixed(3), 'm/s (expected ~8.5)');
  console.log('Grounded all frames?', steady.every(r => r.grounded));

  // Analyze weapon vertical and roll oscillation:
  const rootY = steady.map(r => r.rootY);
  const rootRotZ = steady.map(r => r.rootRotZ);
  console.log('Weapon rootY range:', Math.min(...rootY).toFixed(4), 'to', Math.max(...rootY).toFixed(4), 'diff =', (Math.max(...rootY) - Math.min(...rootY)).toFixed(4), 'm');
  console.log('Weapon rootRotZ range:', (Math.min(...rootRotZ)*180/Math.PI).toFixed(2) + '°', 'to', (Math.max(...rootRotZ)*180/Math.PI).toFixed(2) + '°');

  // Print first 20 frames of rootY delta and headBob
  console.log('\nConsecutive frame-to-frame weapon Y change (cm):');
  for (let i = 1; i <= 20; i++) {
    const dY = (steady[i].rootY - steady[i-1].rootY) * 100;
    const headB = steady[i].headBob * 100;
    console.log(`  Frame ${i}: deltaWepY = ${dY >= 0 ? '+' : ''}${dY.toFixed(2)} cm | headBob = ${headB >= 0 ? '+' : ''}${headB.toFixed(2)} cm | wepY = ${steady[i].rootY.toFixed(3)}`);
  }

  client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
