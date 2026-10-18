// scripts/capture-active-chrome-weapons.mjs
import fs from 'fs';
import path from 'path';

const ARTIFACTS = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/5618d13b-17a0-4ad6-8787-4ecd7ffd8f73';

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

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${path.basename(filePath)}`);
  }

  close() {
    this.ws.close();
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const wsUrl = await getWsUrl();
  const client = new CDPClient(wsUrl);
  await client.connect();

  console.log('Dismissing overlay if present...');
  await client.eval(`(() => {
    const overlay = document.getElementById('overlay');
    if (overlay && overlay.style.display !== 'none') {
      overlay.click();
    }
    const app = window.__fpsApp;
    if (app) {
      app.controls.isLocked = true;
    }
  })()`);

  await sleep(400);

  const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];

  for (const w of weapons) {
    console.log(`\n=== WEAPON: ${w.toUpperCase()} ===`);
    // Switch weapon
    await client.eval(`(() => {
      const app = window.__fpsApp;
      app.weaponManager.switchWeapon('${w}');
      app.controls.input.forward = false;
      app.controls.input.sprint = false;
    })()`);
    await sleep(500);

    // Capture IDLE
    const idlePath = path.join(ARTIFACTS, `clean_${w}_idle.png`);
    await client.screenshot(idlePath);

    // Trigger sprint
    await client.eval(`(() => {
      const app = window.__fpsApp;
      app.controls.input.forward = true;
      app.controls.input.sprint = true;
    })()`);
    await sleep(400);

    // Capture SPRINT
    const sprintPath = path.join(ARTIFACTS, `clean_${w}_sprint.png`);
    await client.screenshot(sprintPath);

    // Release sprint
    await client.eval(`(() => {
      const app = window.__fpsApp;
      app.controls.input.forward = false;
      app.controls.input.sprint = false;
    })()`);
    await sleep(300);
  }

  client.close();
  console.log('\nAll clean weapon screenshots captured successfully!');
}

main().catch(err => { console.error(err); process.exit(1); });
