// scripts/diagnose-movement-pipeline.mjs
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173/?map=range';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);

  // Setup diagnostic telemetry hook
  await page.evaluate(() => {
    HTMLElement.prototype.requestPointerLock = function() {};
    document.exitPointerLock = () => {};
    Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true });
    document.dispatchEvent(new Event('pointerlockchange'));

    const app = window.__fpsApp;
    window.__telemetry = [];
    window.__recording = false;

    // Wrap controls.update to record telemetry
    const origControlsUpdate = app.controls.update.bind(app.controls);
    const origWeaponUpdate = app.weaponManager.update.bind(app.weaponManager);

    let lastRecord = null;

    app.controls.update = function(delta) {
      const posBefore = { x: this.position.x, y: this.position.y, z: this.position.z };
      const velBefore = { x: this.velocity.x, y: this.velocity.y, z: this.velocity.z };
      
      origControlsUpdate(delta);

      if (window.__recording) {
        lastRecord = {
          delta,
          input: { ...this.input },
          isMoving: this.isMoving,
          isSprinting: this.isSprinting,
          isGrounded: this.isGrounded,
          posBefore,
          posAfter: { x: this.position.x, y: this.position.y, z: this.position.z },
          velAfter: { x: this.velocity.x, y: this.velocity.y, z: this.velocity.z },
          cameraPos: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
          headBobTimer: this.headBobTimer,
        };
      }
    };

    app.weaponManager.update = function(delta, mouseDelta, isMoving, isSprinting) {
      origWeaponUpdate(delta, mouseDelta, isMoving, isSprinting);
      if (window.__recording && lastRecord) {
        lastRecord.weapon = {
          sprintWeight: this.sprintWeight,
          sprintVel: this.sprintVel,
          sway: { x: this.sway.x, y: this.sway.y },
          recoil: { ...this.recoil },
          rootPos: { x: this.rootGroup.position.x, y: this.rootGroup.position.y, z: this.rootGroup.position.z },
          rootRot: { x: this.rootGroup.rotation.x, y: this.rootGroup.rotation.y, z: this.rootGroup.rotation.z }
        };
        window.__telemetry.push(lastRecord);
        lastRecord = null;
      }
    };
  });

  console.log('\n--- SCENARIO 1: IDLE (Standing Still for 60 frames) ---');
  await page.evaluate(() => { window.__telemetry = []; window.__recording = true; });
  await sleep(1000);
  await page.evaluate(() => { window.__recording = false; });
  
  const idleFrames = await page.evaluate(() => window.__telemetry);
  console.log(`Captured ${idleFrames.length} idle frames.`);
  analyzeIdle(idleFrames);

  console.log('\n--- SCENARIO 2: WALK FORWARD (Press W for 1.2s then release for 1s) ---');
  await page.evaluate(() => { window.__telemetry = []; window.__recording = true; });
  await page.keyboard.down('KeyW');
  await sleep(1200);
  await page.keyboard.up('KeyW');
  await sleep(1000);
  await page.evaluate(() => { window.__recording = false; });

  const walkFrames = await page.evaluate(() => window.__telemetry);
  console.log(`Captured ${walkFrames.length} walk+release frames.`);
  analyzeWalkAndStop(walkFrames);

  console.log('\n--- SCENARIO 3: SPRINT FORWARD (Press W + Shift for 1.5s then release Shift then release W) ---');
  await page.evaluate(() => { window.__telemetry = []; window.__recording = true; });
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await sleep(1500);
  await page.keyboard.up('ShiftLeft');
  await sleep(600);
  await page.keyboard.up('KeyW');
  await sleep(800);
  await page.evaluate(() => { window.__recording = false; });

  const sprintFrames = await page.evaluate(() => window.__telemetry);
  console.log(`Captured ${sprintFrames.length} sprint frames.`);
  analyzeSprint(sprintFrames);

  await browser.close();
}

function analyzeIdle(frames) {
  if (!frames.length) return;
  const f0 = frames[0];
  const fEnd = frames[frames.length - 1];
  const maxVel = Math.max(...frames.map(f => Math.hypot(f.velAfter.x, f.velAfter.z)));
  const posDisplacement = Math.hypot(fEnd.posAfter.x - f0.posAfter.x, fEnd.posAfter.z - f0.posAfter.z);
  
  console.log(`  Max horizontal velocity while idle: ${maxVel.toFixed(6)} m/s`);
  console.log(`  Net player displacement over ${frames.length} frames: ${posDisplacement.toFixed(6)} m`);
  console.log(`  Camera Y range: [${Math.min(...frames.map(f => f.cameraPos.y)).toFixed(4)}, ${Math.max(...frames.map(f => f.cameraPos.y)).toFixed(4)}]`);
  console.log(`  Weapon rootPos.y range: [${Math.min(...frames.map(f => f.weapon.rootPos.y)).toFixed(4)}, ${Math.max(...frames.map(f => f.weapon.rootPos.y)).toFixed(4)}]`);
  console.log(`  Weapon rootPos.x range: [${Math.min(...frames.map(f => f.weapon.rootPos.x)).toFixed(4)}, ${Math.max(...frames.map(f => f.weapon.rootPos.x)).toFixed(4)}]`);
  console.log(`  Weapon rootRot.x range: [${Math.min(...frames.map(f => f.weapon.rootRot.x)).toFixed(4)}, ${Math.max(...frames.map(f => f.weapon.rootRot.x)).toFixed(4)}]`);
  console.log(`  Weapon sprintWeight: min=${Math.min(...frames.map(f => f.weapon.sprintWeight)).toFixed(4)}, max=${Math.max(...frames.map(f => f.weapon.sprintWeight)).toFixed(4)}`);
}

function analyzeWalkAndStop(frames) {
  // Find frame where KeyW was released
  const releaseIndex = frames.findIndex((f, i) => i > 10 && !f.input.forward && frames[i-1].input.forward);
  console.log(`  KeyW released at frame index: ${releaseIndex} / ${frames.length}`);

  if (releaseIndex > 0) {
    const steadyWalking = frames.slice(20, releaseIndex - 5);
    console.log(`  Steady walk analysis (${steadyWalking.length} frames):`);
    const speeds = steadyWalking.map(f => Math.hypot(f.velAfter.x, f.velAfter.z));
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    console.log(`    Average horizontal speed: ${avgSpeed.toFixed(2)} m/s (expected ~4.8 m/s)`);
    
    // Check frame-to-frame displacement variance
    const displacements = steadyWalking.map(f => Math.hypot(f.posAfter.x - f.posBefore.x, f.posAfter.z - f.posBefore.z));
    console.log(`    Displacement per frame: min=${Math.min(...displacements).toFixed(4)}m, max=${Math.max(...displacements).toFixed(4)}m, avg=${(displacements.reduce((a,b)=>a+b,0)/displacements.length).toFixed(4)}m`);
    
    // Ground state stability
    const airborneCount = steadyWalking.filter(f => !f.isGrounded).length;
    console.log(`    Airborne frames during steady walk: ${airborneCount} / ${steadyWalking.length}`);

    // Stopping analysis
    const postRelease = frames.slice(releaseIndex);
    console.log(`  Post-release stopping analysis (${postRelease.length} frames):`);
    const firstZeroVel = postRelease.findIndex(f => Math.hypot(f.velAfter.x, f.velAfter.z) < 0.001);
    console.log(`    Frames until velocity < 0.001 m/s: ${firstZeroVel} frames (~${(firstZeroVel * 16.6).toFixed(1)} ms)`);
    
    // What was isMoving during those stopping frames?
    if (firstZeroVel > 0) {
      const stoppingFrames = postRelease.slice(0, firstZeroVel);
      console.log(`    During stopping (${firstZeroVel} frames): isMoving is ${stoppingFrames[0].isMoving}, but velocity is ${Math.hypot(stoppingFrames[0].velAfter.x, stoppingFrames[0].velAfter.z).toFixed(2)} m/s!`);
      console.log(`    Residual displacement while isMoving=false: ${postRelease.slice(0, firstZeroVel).reduce((acc, f) => acc + Math.hypot(f.posAfter.x - f.posBefore.x, f.posAfter.z - f.posBefore.z), 0).toFixed(4)} m`);
    }
  }
}

function analyzeSprint(frames) {
  // Find sprint phase
  const sprintFrames = frames.filter(f => f.input.sprint && f.input.forward);
  console.log(`  Sprint active frames: ${sprintFrames.length}`);
  if (sprintFrames.length > 20) {
    const steadySprint = sprintFrames.slice(15, -5);
    const speeds = steadySprint.map(f => Math.hypot(f.velAfter.x, f.velAfter.z));
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    console.log(`    Average sprint speed: ${avgSpeed.toFixed(2)} m/s (expected ~8.5 m/s)`);

    const displacements = steadySprint.map(f => Math.hypot(f.posAfter.x - f.posBefore.x, f.posAfter.z - f.posBefore.z));
    console.log(`    Displacement per frame: min=${Math.min(...displacements).toFixed(4)}m, max=${Math.max(...displacements).toFixed(4)}m`);
    
    // Check jitter: differences in consecutive displacements
    let maxJitter = 0;
    for (let i = 1; i < displacements.length; i++) {
      const diff = Math.abs(displacements[i] - displacements[i-1]);
      if (diff > maxJitter) maxJitter = diff;
    }
    console.log(`    Max frame-to-frame displacement delta (jitter): ${maxJitter.toFixed(5)} m`);

    // Camera and weapon oscillation
    const camY = steadySprint.map(f => f.cameraPos.y);
    const camYRange = Math.max(...camY) - Math.min(...camY);
    console.log(`    Camera Y bob range: ${camYRange.toFixed(4)} m`);

    const wepY = steadySprint.map(f => f.weapon.rootPos.y);
    const wepYRange = Math.max(...wepY) - Math.min(...wepY);
    console.log(`    Weapon root Y bob range: ${wepYRange.toFixed(4)} m`);

    const wepSprintWeights = steadySprint.map(f => f.weapon.sprintWeight);
    console.log(`    Weapon sprintWeight in steady sprint: min=${Math.min(...wepSprintWeights).toFixed(4)}, max=${Math.max(...wepSprintWeights).toFixed(4)}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
