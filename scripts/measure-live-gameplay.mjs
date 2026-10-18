// Node 24 global WebSocket

async function getWsUrl() {
  const res = await fetch('http://127.0.0.1:9222/json');
  const tabs = await res.json();
  const rangeTab = tabs.find(t => t.title.includes('RANGE') && t.type === 'page');
  return rangeTab.webSocketDebuggerUrl;
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
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
  console.log('Connecting to active Chrome tab at:', wsUrl);
  const client = new CDPClient(wsUrl);
  await client.connect();

  console.log('Connected! Inspecting app state...');

  const info = await client.eval(`(() => {
    const app = window.__fpsApp;
    if (!app) return { error: 'No __fpsApp on window' };
    return {
      map: app.hud.mapName || 'range',
      weapon: app.weaponManager.currentDef.id,
      fps: window.__simTicksThisSecond,
      playerPos: { x: app.controls.position.x, y: app.controls.position.y, z: app.controls.position.z },
      velocity: { x: app.controls.velocity.x, y: app.controls.velocity.y, z: app.controls.velocity.z },
      isGrounded: app.controls.isGrounded,
      isMoving: app.controls.isMoving,
      isSprinting: app.controls.isSprinting
    };
  })()`);

  console.log('App info:', JSON.stringify(info, null, 2));

  // Now let's inject a precise telemetry recorder that records 120 consecutive frames in the live game:
  // 30 frames idle -> 60 frames walking forward -> 30 frames after releasing forward
  console.log('\nStarting 120-frame live movement simulation & recording in Chrome...');

  const result = await client.eval(`(async () => {
    const app = window.__fpsApp;
    const records = [];
    
    // Simulate input sequence
    let currentInput = { forward: false, sprint: false };
    
    // Frame counter
    let frame = 0;
    
    return new Promise((resolve) => {
      function tick() {
        frame++;
        
        // Input script:
        // Frames 0..29: Idle
        // Frames 30..89: Walk forward
        // Frames 90..149: Sprint forward (Shift + W)
        // Frames 150..180: Release Shift (walk)
        // Frames 181..220: Release all (stop)
        
        let fwd = false;
        let spr = false;
        if (frame >= 30 && frame < 90) {
          fwd = true;
          spr = false;
        } else if (frame >= 90 && frame < 150) {
          fwd = true;
          spr = true;
        } else if (frame >= 150 && frame < 180) {
          fwd = true;
          spr = false;
        } else {
          fwd = false;
          spr = false;
        }
        
        app.controls.input.forward = fwd;
        app.controls.input.sprint = spr;
        
        records.push({
          frame,
          phase: frame < 30 ? 'idle' : (frame < 90 ? 'walk' : (frame < 150 ? 'sprint' : (frame < 180 ? 'sprint_release' : 'stop'))),
          fwd,
          spr,
          pos: { x: app.controls.position.x, y: app.controls.position.y, z: app.controls.position.z },
          vel: { x: app.controls.velocity.x, y: app.controls.velocity.y, z: app.controls.velocity.z },
          speed: Math.hypot(app.controls.velocity.x, app.controls.velocity.z),
          isMoving: app.controls.isMoving,
          isSprinting: app.controls.isSprinting,
          isGrounded: app.controls.isGrounded,
          camY: app.camera.position.y,
          headBob: app.camera.position.y - app.controls.position.y,
          rootY: app.weaponManager.rootGroup.position.y,
          rootRotX: app.weaponManager.rootGroup.rotation.x,
          rootRotZ: app.weaponManager.rootGroup.rotation.z,
          sprintWeight: app.weaponManager.sprintWeight
        });
        
        if (frame < 220) {
          requestAnimationFrame(tick);
        } else {
          // Clean up inputs
          app.controls.input.forward = false;
          app.controls.input.sprint = false;
          resolve(records);
        }
      }
      requestAnimationFrame(tick);
    });
  })()`);

  console.log(`Captured ${result.length} live frames! Analyzing...`);
  
  // Phase 1: Idle analysis (frames 0..29)
  const idle = result.filter(r => r.phase === 'idle');
  console.log('\n--- PHASE 1: IDLE (Frames 0..29) ---');
  console.log('Player displacement:', Math.hypot(idle[idle.length-1].pos.x - idle[0].pos.x, idle[idle.length-1].pos.z - idle[0].pos.z));
  console.log('Camera headBob:', idle.map(r => r.headBob.toFixed(4)).slice(0, 10).join(', '));
  console.log('Weapon rootY values:', idle.map(r => r.rootY.toFixed(4)).slice(0, 10).join(', '));
  console.log('Weapon rootRotZ values:', idle.map(r => r.rootRotZ.toFixed(4)).slice(0, 10).join(', '));
  const rootYDiffs = [];
  for (let i = 1; i < idle.length; i++) rootYDiffs.push(Math.abs(idle[i].rootY - idle[i-1].rootY));
  console.log('Max frame-to-frame weapon Y change in IDLE:', Math.max(...rootYDiffs).toFixed(5), 'm');

  // Phase 2: Walk analysis (frames 30..89)
  const walk = result.filter(r => r.phase === 'walk');
  console.log('\n--- PHASE 2: WALK (Frames 30..89) ---');
  console.log('Start speed:', walk[0].speed.toFixed(3), 'Mid speed:', walk[Math.floor(walk.length/2)].speed.toFixed(3));
  console.log('HeadBob min/max:', Math.min(...walk.map(r=>r.headBob)).toFixed(4), Math.max(...walk.map(r=>r.headBob)).toFixed(4));
  console.log('Weapon rootY min/max:', Math.min(...walk.map(r=>r.rootY)).toFixed(4), Math.max(...walk.map(r=>r.rootY)).toFixed(4));
  const walkDisplacements = [];
  for (let i = 1; i < walk.length; i++) {
    walkDisplacements.push(Math.hypot(walk[i].pos.x - walk[i-1].pos.x, walk[i].pos.z - walk[i-1].pos.z));
  }
  console.log('Walk frame displacements (first 10):', walkDisplacements.slice(0, 10).map(d => (d*100).toFixed(2) + 'cm').join(', '));

  // Phase 3: Sprint analysis (frames 90..149)
  const sprint = result.filter(r => r.phase === 'sprint');
  console.log('\n--- PHASE 3: SPRINT (Frames 90..149) ---');
  console.log('Speed min/max:', Math.min(...sprint.map(r=>r.speed)).toFixed(3), Math.max(...sprint.map(r=>r.speed)).toFixed(3));
  console.log('SprintWeight min/max:', Math.min(...sprint.map(r=>r.sprintWeight)).toFixed(3), Math.max(...sprint.map(r=>r.sprintWeight)).toFixed(3));
  console.log('HeadBob min/max:', Math.min(...sprint.map(r=>r.headBob)).toFixed(4), Math.max(...sprint.map(r=>r.headBob)).toFixed(4));
  console.log('Weapon rootY min/max:', Math.min(...sprint.map(r=>r.rootY)).toFixed(4), Math.max(...sprint.map(r=>r.rootY)).toFixed(4));
  const sprintDisplacements = [];
  for (let i = 1; i < sprint.length; i++) {
    sprintDisplacements.push(Math.hypot(sprint[i].pos.x - sprint[i-1].pos.x, sprint[i].pos.z - sprint[i-1].pos.z));
  }
  console.log('Sprint frame displacements (mid 10):', sprintDisplacements.slice(15, 25).map(d => (d*100).toFixed(2) + 'cm').join(', '));
  
  // Frame-by-frame weapon rootY delta during steady sprint:
  const wepYDelta = [];
  for (let i = 1; i < sprint.length; i++) wepYDelta.push(Math.abs(sprint[i].rootY - sprint[i-1].rootY));
  console.log('Weapon rootY frame-to-frame delta (first 15):', wepYDelta.slice(0, 15).map(d => (d*100).toFixed(2) + 'cm').join(', '));

  // Phase 4: Stop analysis (frames 181..220)
  const stop = result.filter(r => r.phase === 'stop');
  console.log('\n--- PHASE 4: STOP / RELEASE (Frames 181..220) ---');
  console.log('Speed on frame 181 (first release frame):', stop[0].speed.toFixed(3), 'isMoving:', stop[0].isMoving);
  console.log('Speed on frame 185:', stop[4].speed.toFixed(3), 'isMoving:', stop[4].isMoving);
  console.log('Speed on frame 190:', stop[9].speed.toFixed(3), 'isMoving:', stop[9].isMoving);
  console.log('HeadBob on frame 180 (walk):', result[179].headBob.toFixed(4), '-> frame 181 (stop):', stop[0].headBob.toFixed(4));
  console.log('Weapon rootY on frame 180 (walk):', result[179].rootY.toFixed(4), '-> frame 181 (stop):', stop[0].rootY.toFixed(4));

  client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
