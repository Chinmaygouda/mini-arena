// scripts/capture-after-reloads.mjs
// Captures AFTER state of pistol, smg, and shotgun reloads from the live browser game,
// plus a live shotgun reload interrupt test.

import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/fd669695-232e-421c-895b-222183896b36';
const SCRIPTS_DIR = 'd:/Games/frist person shooter/scripts';

async function getWsUrl() {
  const res = await fetch('http://127.0.0.1:9222/json');
  const tabs = await res.json();
  const rangeTab = tabs.find(t => t.url.includes('localhost:5173') && t.type === 'page');
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
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    
    fs.writeFileSync(path.join(SCRIPTS_DIR, filename), buf);
    fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);

    console.log(`[Screenshot] Saved ${filename} (${buf.length} bytes)`);
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

  console.log('Dismissing overlay and setting view...');
  await client.eval(`(() => {
    const overlay = document.getElementById('overlay');
    if (overlay && overlay.style.display !== 'none') overlay.click();
    window.__fpsApp.controls.isLocked = true;
    window.__fpsApp.weaponManager.setDebugMuzzleMarker(false);
  })()`);
  await sleep(400);

  const targets = ['pistol', 'smg', 'shotgun'];

  for (const w of targets) {
    console.log(`\n=== Capturing AFTER reload for ${w.toUpperCase()} ===`);
    // Equip and empty magazine
    await client.eval(`(() => {
      const app = window.__fpsApp;
      app.weaponManager.switchWeapon('${w}');
      app.weaponManager.setAmmo(0, 100);
      for (let i = 0; i < 20; i++) app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
    })()`);
    await sleep(400);

    // Frame 0: Ready pose before reload
    await client.screenshot(`after_${w}_reload_0_ready.png`);

    // Start reload
    await client.eval(`window.__fpsApp.weaponManager.startReload()`);

    // Step to progress ~0.25 (removal phase / shell rise)
    await client.eval(`(() => {
      const wm = window.__fpsApp.weaponManager;
      const targetTime = wm.reloadDuration * 0.25;
      while (wm.reloadTimer < targetTime) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()`);
    await sleep(200);
    await client.screenshot(`after_${w}_reload_1_mag_out.png`);

    // Step to progress ~0.55 (insertion phase / shell into gate)
    await client.eval(`(() => {
      const wm = window.__fpsApp.weaponManager;
      const targetTime = wm.reloadDuration * 0.55;
      while (wm.reloadTimer < targetTime) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()`);
    await sleep(200);
    await client.screenshot(`after_${w}_reload_2_insert.png`);

    // Step to progress ~0.88 (action phase: slide release, bolt rack, or pump rack)
    await client.eval(`(() => {
      const wm = window.__fpsApp.weaponManager;
      const targetTime = wm.reloadDuration * 0.88;
      while (wm.reloadTimer < targetTime) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()`);
    await sleep(200);
    await client.screenshot(`after_${w}_reload_3_action.png`);

    // Step to completion (progress 1.0)
    await client.eval(`(() => {
      const wm = window.__fpsApp.weaponManager;
      while (wm.state.isReloading) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }
    })()`);
    await sleep(200);
    await client.screenshot(`after_${w}_reload_4_complete.png`);
  }

  // Also capture Shotgun Mid-Reload Interruption & immediate shot
  console.log(`\n=== Testing & Capturing Shotgun Reload Interruption ===`);
  const interruptResult = await client.eval(`(() => {
    const app = window.__fpsApp;
    const wm = app.weaponManager;
    wm.switchWeapon('shotgun');
    wm.setAmmo(0, 20);
    wm.startReload();

    // Advance to 0.35 (stage 0 commit committed 2 shells, now clip = 2)
    const targetTime = wm.reloadDuration * 0.35;
    while (wm.reloadTimer < targetTime) {
      wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
    }
    const ammoBeforeInterrupt = wm.state.ammoInClip;
    const wasReloading = wm.state.isReloading;

    // Interrupt with trigger press
    wm.setTrigger(true);
    const reloadingAfterInterrupt = wm.state.isReloading;

    // Step one frame to execute the shot
    wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
    wm.setTrigger(false);

    return {
      ammoBeforeInterrupt,
      wasReloading,
      reloadingAfterInterrupt,
      ammoAfterFire: wm.state.ammoInClip,
      leftHandPosZ: wm.shotgun.leftHandGroup ? wm.shotgun.leftHandGroup.position.z : 0,
      shellVisible: wm.shotgun.shellGroup.visible,
    };
  })()`);
  console.log('Shotgun interrupt evaluation result:', interruptResult);
  await sleep(200);
  await client.screenshot(`after_shotgun_interrupted_fire.png`);

  client.close();
  console.log('\nAll AFTER reload states and interrupt verification captured successfully.');
}

main().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
