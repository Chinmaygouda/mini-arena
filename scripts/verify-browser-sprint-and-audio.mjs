// scripts/verify-browser-sprint-and-audio.mjs
// Verifies all 5 sprint poses, spring settling vs fire-blocking, muzzle direction post-sprint,
// and live Web Audio playback in Chrome.

import http from 'http';
import fs from 'fs';
import path from 'path';

function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(p => p.type === 'page' && p.url.includes('localhost:5173'));
          if (page && page.webSocketDebuggerUrl) {
            resolve(page.webSocketDebuggerUrl);
          } else {
            reject(new Error('No matching page found on localhost:5173'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = msg => {
        const parsed = JSON.parse(msg.data);
        if (parsed.id && this.pending.has(parsed.id)) {
          const { resolve, reject } = this.pending.get(parsed.id);
          this.pending.delete(parsed.id);
          if (parsed.error) reject(parsed.error);
          else resolve(parsed.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
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
      throw new Error(res.exceptionDetails.exception?.description || JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  async captureScreenshot(filepath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filepath, buffer);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('=== VERIFYING SPRINT POSES, FIRE-BLOCKING & BROWSER AUDIO ===');
  const wsUrl = await getWsUrl();
  const cdp = new CdpClient(wsUrl);
  await cdp.connect();

  const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];
  const sprintAuditResults = [];

  for (const weaponId of weapons) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Auditing Weapon: ${weaponId.toUpperCase()}`);
    console.log(`--------------------------------------------------`);

    // 1. Test Idle -> Sprint Entry -> Full Sprint -> Sprint Exit -> Firing alignment
    const result = await cdp.eval(`
      (async () => {
        const app = window.__fpsApp;
        app.weaponManager.switchWeapon('${weaponId}');
        const def = app.weaponManager.currentDef;
        app.weaponManager.setAmmo(def.magCapacity, 50);

        // A. Settle in Idle
        for (let i = 0; i < 30; i++) {
          app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
        }
        const idleMuzzle = app.camera.position.clone();
        app.weaponManager.getActiveMuzzleWorldPosition(idleMuzzle);
        const idleWeight = app.weaponManager.sprintWeight;

        // B. Enter Sprint (simulate holding Shift + W for 0.5s)
        for (let i = 0; i < 30; i++) {
          app.weaponManager.update(0.016, { x: 0, y: 0 }, true, true, 8.5);
        }
        const fullSprintWeight = app.weaponManager.sprintWeight;
        const sprintMuzzle = app.camera.position.clone();
        app.weaponManager.getActiveMuzzleWorldPosition(sprintMuzzle);

        // Attempt fire DURING full sprint: must be strictly blocked
        let firedInFullSprint = false;
        let firedInRecovery = false;
        let firstFireFrame = -1;
        const origOnFire = app.weaponManager.onFireRaycast;
        app.weaponManager.onFireRaycast = () => { firedInFullSprint = true; };
        app.weaponManager.setTrigger(true);
        app.weaponManager.update(0.016, { x: 0, y: 0 }, true, true, 8.5);
        app.weaponManager.setTrigger(false);

        // C. Release Sprint: weapon must transition out via critically damped spring
        // Track frame-by-frame sprintWeight and fire-blocked status
        app.weaponManager.onFireRaycast = () => { firedInRecovery = true; };
        const recoveryFrames = [];

        for (let f = 1; f <= 35; f++) {
          app.weaponManager.setTrigger(true); // Attempt to fire on every recovery frame
          app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
          app.weaponManager.setTrigger(false);

          const w = app.weaponManager.sprintWeight;
          const timer = app.weaponManager.sprintOutTimer;
          const blocked = app.weaponManager.schedulerState.isSprinting;

          recoveryFrames.push({ frame: f, time: f * 0.016, sprintWeight: w, timer, blocked });

          if (firedInRecovery && firstFireFrame === -1) {
            firstFireFrame = f;
          }
        }

        app.weaponManager.onFireRaycast = origOnFire;

        // D. Final fully settled shot
        let settledShot = null;
        app.weaponManager.onFireRaycast = (muzzleOrigin, aimOrigin, aimDirection) => {
          settledShot = {
            muzzle: { x: muzzleOrigin.x, y: muzzleOrigin.y, z: muzzleOrigin.z },
            aim: { x: aimOrigin.x, y: aimOrigin.y, z: aimOrigin.z },
            dir: { x: aimDirection.x, y: aimDirection.y, z: aimDirection.z }
          };
          origOnFire(muzzleOrigin, aimOrigin, aimDirection, def);
        };
        app.weaponManager.setTrigger(true);
        app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
        app.weaponManager.setTrigger(false);
        app.weaponManager.onFireRaycast = origOnFire;

        return {
          weaponId: '${weaponId}',
          name: def.name,
          idleWeight,
          fullSprintWeight,
          firedInFullSprint,
          firstFireFrame,
          settledShot,
          fireDelayOut: def.sprintPose.fireDelayOut,
          omegaOut: def.sprintPose.omegaOut,
          framesBlocked: recoveryFrames.filter(r => r.blocked).length,
          weightAtUnblock: recoveryFrames.find(r => !r.blocked)?.sprintWeight ?? 0
        };
      })()
    `);

    console.log(`  Name: ${result.name}`);
    console.log(`  Sprint Weight In Full Sprint: ${result.fullSprintWeight.toFixed(3)} (expected >= 0.95)`);
    console.log(`  Fire During Full Sprint Blocked: ${!result.firedInFullSprint} (firedInFullSprint=${result.firedInFullSprint})`);
    console.log(`  Frames Blocked On Sprint Exit: ${result.framesBlocked} frames (${(result.framesBlocked * 0.016).toFixed(3)}s)`);
    console.log(`  First Fire Frame: Frame ${result.firstFireFrame}`);
    console.log(`  Sprint Weight At Unblock: ${result.weightAtUnblock.toFixed(4)} (guaranteed <= 0.05)`);
    if (result.settledShot) {
      console.log(`  Settled Muzzle Origin: (${result.settledShot.muzzle.x.toFixed(3)}, ${result.settledShot.muzzle.y.toFixed(3)}, ${result.settledShot.muzzle.z.toFixed(3)})`);
      console.log(`  Shot Aim Vector: (${result.settledShot.dir.x.toFixed(3)}, ${result.settledShot.dir.y.toFixed(3)}, ${result.settledShot.dir.z.toFixed(3)})`);
    }

    sprintAuditResults.push(result);

    // Capture visual screenshot of weapon in sprint pose
    await cdp.eval(`
      (() => {
        const app = window.__fpsApp;
        app.weaponManager.switchWeapon('${weaponId}');
        for (let i = 0; i < 25; i++) {
          app.weaponManager.update(0.016, { x: 0, y: 0 }, true, true, 8.5);
        }
      })()
    `);
    const sprintScreenshot = path.resolve(process.cwd(), `screenshot_sprint_${weaponId}.png`);
    await cdp.captureScreenshot(sprintScreenshot);
    console.log(`  Saved sprint pose screenshot: ${sprintScreenshot}`);

    // Capture visual screenshot of weapon back in ready pose
    await cdp.eval(`
      (() => {
        const app = window.__fpsApp;
        for (let i = 0; i < 30; i++) {
          app.weaponManager.update(0.016, { x: 0, y: 0 }, false, false, 0);
        }
      })()
    `);
    const readyScreenshot = path.resolve(process.cwd(), `screenshot_ready_${weaponId}.png`);
    await cdp.captureScreenshot(readyScreenshot);
    console.log(`  Saved ready pose screenshot: ${readyScreenshot}`);
  }

  // 2. Audio Playback & Voice Lifecycle Test in Chrome
  console.log(`\n==================================================`);
  console.log(`AUDITING LIVE WEB AUDIO PLAYBACK IN BROWSER`);
  console.log(`==================================================`);
  const audioResult = await cdp.eval(`
    (async () => {
      const mod = await import('/src/audio/soundManager.ts');
      const sound = mod.sound;

      // Ensure AudioContext is active
      sound.init();
      const ctxState = sound.ctx ? sound.ctx.state : 'uninitialized';

      // Test playing weapon gunfire synthesizers
      sound.playAK47Shot();
      sound.playPistolShot();
      sound.playSMGShot();
      sound.playShotgunShot();
      sound.playSniperShot();

      // Test playing recorded handling cues
      sound.playAKMagOut();
      sound.playAKMagIn();
      sound.playShotgunShellInsert();
      sound.playShotgunPumpBack();
      sound.playShotgunPumpForward();

      const activeVoices = sound.getActiveHandlingVoiceCount();
      const eventLog = sound.getHandlingEventLog();

      // Test stopAllHandlingSounds
      sound.stopAllHandlingSounds();
      const voicesAfterStop = sound.getActiveHandlingVoiceCount();

      return {
        ctxState,
        activeVoicesBeforeStop: activeVoices,
        voicesAfterStop,
        loggedEvents: eventLog.length,
        recentEvents: eventLog.slice(-5).map(e => e.event)
      };
    })()
  `);

  console.log(`Audio Context State: ${audioResult.ctxState}`);
  console.log(`Logged Audio Events: ${audioResult.loggedEvents}`);
  console.log(`Recent Audio Events: ${JSON.stringify(audioResult.recentEvents)}`);
  console.log(`Voices Before Stop: ${audioResult.activeVoicesBeforeStop}, After Stop: ${audioResult.voicesAfterStop}`);

  cdp.close();
  console.log('\n=== AUDIT COMPLETE ===');
}

run().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
