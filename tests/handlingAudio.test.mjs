// tests/handlingAudio.test.mjs
// Automated verification for weapon handling audio:
// 1. 20 consecutive reloads per weapon producing exactly expected events once each
// 2. Mid-reload interrupt tests (cancel & weapon swap) ensuring zero stray sounds
// 3. Map switch and weapon swap voice clearance (zero stale playing voices)
// 4. No handling sounds during gunfire

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WeaponManager } from '../src/weapons/weaponManager.ts';
import { sound } from '../src/audio/soundManager.ts';
import { WEAPON_REGISTRY } from '../src/weapons/weaponTypes.ts';

function createTestWeaponManager() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
  return new WeaponManager(scene, camera);
}

function simulateTime(wm, seconds, dt = 1 / 60) {
  let elapsed = 0;
  while (elapsed < seconds) {
    const step = Math.min(dt, seconds - elapsed);
    wm.update(step, { x: 0, y: 0 }, false, false);
    elapsed += step;
  }
}

test('20 consecutive reloads per weapon produce exactly the expected sound events once each', () => {
  const wm = createTestWeaponManager();
  const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];

  const EXPECTED_PER_RELOAD = {
    ak47: {
      total: 3,
      events: { ak_mag_out: 1, ak_mag_in: 1, ak_bolt_rack: 1 }
    },
    pistol: {
      total: 3,
      events: { pistol_mag_out: 1, pistol_mag_in: 1, pistol_slide_release: 1 }
    },
    smg: {
      total: 3,
      events: { smg_mag_out: 1, smg_mag_in: 1, smg_bolt: 1 }
    },
    shotgun: {
      total: 6,
      events: { shotgun_shell_insert: 4, shotgun_pump_back: 1, shotgun_pump_forward: 1 }
    },
    sniper: {
      total: 6,
      events: {
        sniper_bolt_unlock: 1,
        sniper_bolt_pull: 1,
        sniper_mag_out: 1,
        sniper_mag_in: 1,
        sniper_bolt_push: 1,
        sniper_bolt_lock: 1
      }
    }
  };

  for (const weaponId of weapons) {
    wm.switchWeapon(weaponId);
    const def = WEAPON_REGISTRY[weaponId];
    sound.clearHandlingEventLog();

    for (let r = 0; r < 20; r++) {
      // Empty the magazine to test full empty reload cycle
      wm.setAmmo(0);
      sound.clearHandlingEventLog();

      wm.startReload();
      assert.equal(wm.state.isReloading, true, `${weaponId}: Reload must be active at start of cycle ${r + 1}`);

      // Advance through the entire reload duration + small margin
      simulateTime(wm, def.reloadDuration + 0.1, 1 / 60);

      assert.equal(wm.state.isReloading, false, `${weaponId}: Reload must complete after duration on cycle ${r + 1}`);
      assert.equal(wm.state.ammoInClip, def.magCapacity, `${weaponId}: Mag capacity must be restored on cycle ${r + 1}`);

      const logs = sound.getHandlingEventLog().filter(e => e.weapon === weaponId && e.event !== 'STOP_ALL_HANDLING');
      const expected = EXPECTED_PER_RELOAD[weaponId];

      assert.equal(
        logs.length,
        expected.total,
        `${weaponId} cycle ${r + 1}: expected ${expected.total} events, got ${logs.length} (${logs.map(l => l.event).join(', ')})`
      );

      for (const [evName, count] of Object.entries(expected.events)) {
        const matches = logs.filter(l => l.event === evName);
        assert.equal(
          matches.length,
          count,
          `${weaponId} cycle ${r + 1}: expected exactly ${count} '${evName}', got ${matches.length}`
        );
      }
    }
  }
});

test('Interrupted reload via weapon swap leaves no stray sounds or playing voices', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('ak47');
  wm.setAmmo(0);

  sound.clearHandlingEventLog();
  wm.startReload();

  // Advance time to 0.6s (past mag out at 0.48s, before mag in at 1.36s)
  simulateTime(wm, 0.6, 1 / 60);

  const logsBeforeSwap = sound.getHandlingEventLog().filter(e => e.weapon === 'ak47');
  assert.equal(logsBeforeSwap.length, 1, 'Exactly 1 sound (ak_mag_out) should have played before swap');
  assert.equal(logsBeforeSwap[0].event, 'ak_mag_out');

  // Interrupt reload by swapping weapon
  wm.switchWeapon('pistol');

  assert.equal(wm.state.isReloading, false, 'Reload state must be false after weapon swap');
  assert.equal(sound.getActiveHandlingVoiceCount(), 0, 'Zero active handling voices after swap');

  // Clear log and simulate 3 full seconds (far past the original 2.2s AK reload)
  sound.clearHandlingEventLog();
  simulateTime(wm, 3.0, 1 / 60);

  const strayAKEvents = sound.getHandlingEventLog().filter(e => e.weapon === 'ak47');
  assert.equal(strayAKEvents.length, 0, `Zero stray AK reload events after interrupt! Got: ${strayAKEvents.map(e => e.event).join(', ')}`);
});

test('Manual reload cancellation resets subgroups and leaves no active voices', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('shotgun');
  wm.setAmmo(0);

  wm.startReload();
  // Advance through 2 shell inserts (0.45s)
  simulateTime(wm, 0.45, 1 / 60);

  wm.cancelReload();

  assert.equal(wm.state.isReloading, false);
  assert.equal(sound.getActiveHandlingVoiceCount(), 0);

  sound.clearHandlingEventLog();
  simulateTime(wm, 2.5, 1 / 60);

  const strayEvents = sound.getHandlingEventLog().filter(e => e.weapon === 'shotgun' && e.event !== 'STOP_ALL_HANDLING');
  assert.equal(strayEvents.length, 0, 'No stray shotgun events after cancellation');
});

test('Map switch (resetForMapLoad) immediately clears handling voices and pending cycles', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('sniper');
  wm.setAmmo(0);

  wm.startReload();
  simulateTime(wm, 0.2, 1 / 60);

  // Map change event
  wm.resetForMapLoad();

  assert.equal(wm.state.isReloading, false);
  assert.equal(sound.getActiveHandlingVoiceCount(), 0);

  sound.clearHandlingEventLog();
  simulateTime(wm, 4.0, 1 / 60);

  const straySniperEvents = sound.getHandlingEventLog().filter(e => e.weapon === 'sniper' && e.event !== 'STOP_ALL_HANDLING');
  assert.equal(straySniperEvents.length, 0, 'No stray sniper events after map switch');
});

test('Gunfire never triggers reload handling sounds during fire execution', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('ak47');
  wm.state.ammoInClip = 30;

  sound.clearHandlingEventLog();

  // Fire 10 rounds continuously
  wm.setTrigger(true);
  simulateTime(wm, 1.0, 1 / 60);
  wm.setTrigger(false);

  const reloadHandlingEvents = sound.getHandlingEventLog().filter(e =>
    ['ak_mag_out', 'ak_mag_in', 'ak_bolt_rack'].includes(e.event)
  );

  assert.equal(
    reloadHandlingEvents.length,
    0,
    `Never play reload handling sounds during gunfire (got ${reloadHandlingEvents.length})`
  );
});
