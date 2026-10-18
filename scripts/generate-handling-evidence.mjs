// scripts/generate-handling-evidence.mjs
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { WeaponManager } from '../src/weapons/weaponManager.ts';
import { sound } from '../src/audio/soundManager.ts';

function createWeaponManager() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
  return new WeaponManager(scene, camera);
}

// 1. Wire-size check of audio assets and entire public folder
function checkWireSize() {
  const publicDir = path.resolve('public');
  const handlingDir = path.resolve('public/audio/handling');

  function getDirSize(dir) {
    let total = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        total += getDirSize(full);
      } else {
        total += fs.statSync(full).size;
      }
    }
    return total;
  }

  const handlingFiles = fs.readdirSync(handlingDir).filter(f => f.endsWith('.ogg'));
  let handlingSize = 0;
  for (const f of handlingFiles) {
    handlingSize += fs.statSync(path.join(handlingDir, f)).size;
  }

  const rendersDir = path.join(handlingDir, 'renders');
  let rendersSize = 0;
  if (fs.existsSync(rendersDir)) {
    rendersSize = getDirSize(rendersDir);
  }

  const totalPublicSize = getDirSize(publicDir);

  return {
    handlingOggCount: handlingFiles.length,
    handlingOggBytes: handlingSize,
    handlingOggKB: (handlingSize / 1024).toFixed(2),
    rendersBytes: rendersSize,
    rendersKB: (rendersSize / 1024).toFixed(2),
    totalPublicBytes: totalPublicSize,
    totalPublicMB: (totalPublicSize / (1024 * 1024)).toFixed(2)
  };
}

// 2. Full reload logs per weapon
function logFullReloads() {
  const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];
  const logs = {};

  for (const wId of weapons) {
    const wm = createWeaponManager();
    wm.switchWeapon(wId);
    wm.setAmmo(0, 100); // Empty reload so all stages (including bolt/slide rack) trigger
    sound.clearHandlingEventLog();

    const dt = 1 / 60;
    const weaponLog = [];

    wm.startReload();

    // Step for up to 4.0 seconds (240 ticks)
    for (let tick = 0; tick <= 240; tick++) {
      const simTime = tick * dt;
      const eventsBefore = sound.getHandlingEventLog().length;
      wm.update(dt, { x: 0, y: 0 });
      const eventsAfter = sound.getHandlingEventLog();

      if (eventsAfter.length > eventsBefore) {
        for (let i = eventsBefore; i < eventsAfter.length; i++) {
          const ev = eventsAfter[i];
          const st = wm.weaponState;
          weaponLog.push({
            event: ev.event,
            soundKey: ev.soundKey,
            simTimeMs: Math.round(simTime * 1000),
            stage: st ? st.reloadStage : 'complete',
            stageProgress: st ? +(st.reloadProgress).toFixed(3) : 1.0,
            ammo: st ? st.ammoInClip : 0
          });
        }
      }
      if (!wm.weaponState.isReloading && tick > 10) {
        break;
      }
    }
    logs[wId] = weaponLog;
  }
  return logs;
}

// 3. Interrupted reload log (weapon swap in the middle)
function logInterruptedReload() {
  const wm = createWeaponManager();
  wm.switchWeapon('ak47');
  wm.setAmmo(0, 100);
  sound.clearHandlingEventLog();

  const dt = 1 / 60;
  const log = [];

  wm.startReload();

  // Step 40 ticks (~0.66s), mid-reload (during 'pull_mag' or right after 'mag_out')
  for (let tick = 0; tick < 40; tick++) {
    const simTime = tick * dt;
    const eventsBefore = sound.getHandlingEventLog().length;
    wm.update(dt, { x: 0, y: 0 });
    const eventsAfter = sound.getHandlingEventLog();

    if (eventsAfter.length > eventsBefore) {
      for (let i = eventsBefore; i < eventsAfter.length; i++) {
        const ev = eventsAfter[i];
        const st = wm.weaponState;
        log.push({
          action: 'reloading',
          event: ev.event,
          soundKey: ev.soundKey,
          simTimeMs: Math.round(simTime * 1000),
          stage: st ? st.reloadStage : 'unknown'
        });
      }
    }
  }

  // Interruption: Swap to pistol
  log.push({
    action: 'SWAP_TRIGGERED',
    event: 'switchWeapon(pistol)',
    simTimeMs: Math.round(40 * dt * 1000),
    activeHandlingVoices: sound.getActiveHandlingVoiceCount()
  });

  wm.switchWeapon('pistol');

  log.push({
    action: 'AFTER_SWAP',
    event: 'equip_sound_played',
    activeHandlingVoices: sound.getActiveHandlingVoiceCount(),
    isReloadingAfterSwap: !!wm.weaponState.isReloading
  });

  // Step another 120 ticks (2.0s) to prove zero stray AK reload sounds fire
  const strayEvents = [];
  for (let tick = 41; tick <= 160; tick++) {
    const simTime = tick * dt;
    const eventsBefore = sound.getHandlingEventLog().length;
    wm.update(dt, { x: 0, y: 0 });
    const eventsAfter = sound.getHandlingEventLog();
    if (eventsAfter.length > eventsBefore) {
      for (let i = eventsBefore; i < eventsAfter.length; i++) {
        strayEvents.push({
          event: eventsAfter[i].event,
          simTimeMs: Math.round(simTime * 1000)
        });
      }
    }
  }

  return {
    interruptedLog: log,
    strayEventsAfterSwap: strayEvents,
    finalActiveHandlingVoices: sound.getActiveHandlingVoiceCount()
  };
}

const wire = checkWireSize();
console.log('=== WIRE SIZE REPORT ===');
console.log(JSON.stringify(wire, null, 2));

console.log('\n=== FULL RELOAD EVENT LOGS PER WEAPON ===');
const reloads = logFullReloads();
console.log(JSON.stringify(reloads, null, 2));

console.log('\n=== INTERRUPTED RELOAD EVENT LOG ===');
const interrupted = logInterruptedReload();
console.log(JSON.stringify(interrupted, null, 2));
