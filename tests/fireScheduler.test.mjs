// tests/fireScheduler.test.mjs
// Unit tests for the pure fire timing scheduler.
// Executed via `npm test` using Node.js built-in test runner (`node --test`).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepFireScheduler,
  onTriggerPress,
  onTriggerRelease,
  onWeaponEquip,
  CATCH_UP_CAP,
} from '../src/weapons/fireScheduler.ts';

const WEAPONS = {
  ak47: { name: 'AK-47', fireMode: 'auto', fireRate: 0.1, magCapacity: 30, rpm: 600 },
  smg: { name: 'Cyclone-9 SMG', fireMode: 'auto', fireRate: 0.075, magCapacity: 40, rpm: 800 },
  pistol: { name: 'M9 Pistol', fireMode: 'semi', fireRate: 0.18, magCapacity: 15, rpm: 333 },
  shotgun: { name: 'SPAS-12 Shotgun', fireMode: 'semi', fireRate: 0.75, magCapacity: 8, rpm: 80 },
  sniper: { name: 'AW-50 Sniper', fireMode: 'semi', fireRate: 1.25, magCapacity: 5, rpm: 48 },
};

function createSchedulerState(weaponKey, initialAmmo = null) {
  const def = WEAPONS[weaponKey];
  return {
    simTime: 0,
    nextShotTime: 0,
    triggerHeld: false,
    triggerJustPressed: false,
    ammoInClip: initialAmmo !== null ? initialAmmo : def.magCapacity,
    isReloading: false,
    isSwapping: false,
    isSprinting: false,
    fireMode: def.fireMode,
    fireInterval: def.fireRate,
    cycleTime: def.fireRate,
  };
}

test('AK-47 30-round magazine empties in ~3.0s (600 RPM = 10 shots/s)', () => {
  const state = createSchedulerState('ak47', 30);
  onTriggerPress(state);

  const dt = 1 / 60;
  const shotTimestamps = [];
  let emptyTimestamp = null;

  while (state.simTime < 5.0) {
    stepFireScheduler(state, dt, () => {
      state.ammoInClip--;
      shotTimestamps.push(state.simTime);
      if (state.ammoInClip === 0 && emptyTimestamp === null) {
        emptyTimestamp = state.simTime;
      }
    });
  }

  assert.equal(shotTimestamps.length, 30, 'Must fire exactly 30 shots');
  assert.equal(state.ammoInClip, 0, 'Ammo must be 0 after mag empty');
  assert.ok(emptyTimestamp >= 2.85 && emptyTimestamp <= 3.05,
    `30-round mag must empty in ~3.0s, took ${emptyTimestamp.toFixed(3)}s`);

  const fireRate = 30 / emptyTimestamp;
  assert.ok(Math.abs(fireRate - 10) <= 0.5,
    `Shots per second must be ~10 shots/s, measured ${fireRate.toFixed(2)}`);
});

test('Automatic weapons fire cadence matches RPM/60 ± 1 across dt sequences (1/144, 1/60, 1/30, 1/10)', () => {
  const dtValues = [1 / 144, 1 / 60, 1 / 30, 1 / 10];

  for (const weaponKey of ['ak47', 'smg']) {
    const def = WEAPONS[weaponKey];
    const targetSPS = def.rpm / 60;

    for (const dt of dtValues) {
      // Large ammo pool to test continuous cadence over 5s
      const state = createSchedulerState(weaponKey, 9999);
      onTriggerPress(state);

      const shotTimes = [];
      const simDuration = 5.0;

      while (state.simTime < simDuration) {
        stepFireScheduler(state, dt, () => {
          state.ammoInClip--;
          shotTimes.push(state.simTime);
        });
      }

      const measuredSPS = shotTimes.length / simDuration;
      const error = Math.abs(measuredSPS - targetSPS);
      assert.ok(
        error <= 1.0,
        `${def.name} at dt=${dt.toFixed(4)}: measured ${measuredSPS.toFixed(2)} sps, target ${targetSPS.toFixed(2)} ± 1 (error: ${error.toFixed(2)})`
      );
    }
  }
});

test('Single 500ms lag spike caps at at most 2 catch-up shots and never runs away', () => {
  const state = createSchedulerState('ak47', 9999);
  onTriggerPress(state);

  const shotCountsPerFrame = [];
  let simTime = 0;
  let spikeFired = false;

  while (simTime < 3.0) {
    let dt = 1 / 60;
    if (simTime >= 1.0 && !spikeFired) {
      dt = 0.5; // 500ms lag spike
      spikeFired = true;
    }
    simTime += dt;

    let shotsThisFrame = 0;
    stepFireScheduler(state, dt, () => {
      state.ammoInClip--;
      shotsThisFrame++;
    });
    shotCountsPerFrame.push({ dt, shots: shotsThisFrame, t: state.simTime });
  }

  const spikeFrame = shotCountsPerFrame.find(f => f.dt === 0.5);
  assert.ok(spikeFrame, 'Must have executed 500ms spike frame');
  assert.ok(spikeFrame.shots <= CATCH_UP_CAP,
    `Spike frame shots (${spikeFrame.shots}) must not exceed CATCH_UP_CAP (${CATCH_UP_CAP})`);

  // Verify subsequent frames immediately return to normal cadence (0 or 1 shot per frame)
  const subsequentFrames = shotCountsPerFrame.filter(f => f.t > spikeFrame.t).slice(0, 30);
  for (const f of subsequentFrames) {
    assert.ok(f.shots <= 1,
      `Post-spike frame at t=${f.t.toFixed(3)} fired ${f.shots} shots, expected <= 1`);
  }
});

test('Semi-automatic weapons fire exactly ONE shot per trigger click when held', () => {
  for (const weaponKey of ['pistol', 'shotgun', 'sniper']) {
    const def = WEAPONS[weaponKey];
    const state = createSchedulerState(weaponKey, def.magCapacity);

    // Hold trigger for 5 simulated seconds
    onTriggerPress(state);

    let shotsFired = 0;
    const dt = 1 / 60;
    while (state.simTime < 5.0) {
      stepFireScheduler(state, dt, () => {
        state.ammoInClip--;
        shotsFired++;
      });
    }

    assert.equal(
      shotsFired,
      1,
      `${def.name}: Holding trigger for 5s must fire exactly 1 shot (got ${shotsFired})`
    );
    assert.equal(state.ammoInClip, def.magCapacity - 1);
  }
});

test('Bolt & pump weapons respect cycle time on rapid clicks', () => {
  const shotgunState = createSchedulerState('shotgun', 8); // 0.75s pump cycle
  let shotgunShots = 0;

  // Try to click 10 times in 0.5 seconds (interval = 0.05s)
  for (let i = 0; i < 10; i++) {
    onTriggerRelease(shotgunState);
    onTriggerPress(shotgunState);
    stepFireScheduler(shotgunState, 0.05, () => {
      shotgunState.ammoInClip--;
      shotgunShots++;
    });
  }

  // Only 1 shot should have fired because 0.5s is less than the 0.75s cycle time!
  assert.equal(shotgunShots, 1, `Shotgun cannot fire faster than 0.75s cycle (fired ${shotgunShots})`);

  // Advance time past 0.75s cycle time (0.3s more)
  onTriggerRelease(shotgunState);
  stepFireScheduler(shotgunState, 0.3, () => {});

  // Now click again: second shot must fire
  onTriggerPress(shotgunState);
  stepFireScheduler(shotgunState, 0.05, () => {
    shotgunState.ammoInClip--;
    shotgunShots++;
  });
  assert.equal(shotgunShots, 2, 'Shotgun fired second shot once cycle finished');
});

test('No shots fired while reloading or swapping weapons', () => {
  const state = createSchedulerState('ak47', 30);
  onTriggerPress(state);

  // 1. While reloading
  state.isReloading = true;
  let reloadShots = 0;
  for (let i = 0; i < 60; i++) {
    stepFireScheduler(state, 1 / 60, () => {
      state.ammoInClip--;
      reloadShots++;
    });
  }
  assert.equal(reloadShots, 0, 'Must fire 0 shots while isReloading=true');

  // 2. While swapping
  state.isReloading = false;
  state.isSwapping = true;
  let swapShots = 0;
  for (let i = 0; i < 60; i++) {
    stepFireScheduler(state, 1 / 60, () => {
      state.ammoInClip--;
      swapShots++;
    });
  }
  assert.equal(swapShots, 0, 'Must fire 0 shots while isSwapping=true');
});

test('Hard assertion throws if ammo drops by more than catch-up cap in one frame', () => {
  const state = createSchedulerState('ak47', 30);
  onTriggerPress(state);

  assert.throws(
    () => {
      stepFireScheduler(state, 1 / 60, () => {
        // Illegally decrement ammo by 3 in one shot callback
        state.ammoInClip -= 3;
      });
    },
    /HARD ASSERTION FAILED/,
    'Must throw hard assertion error if ammo drops by > CATCH_UP_CAP'
  );
});

test('Trigger release and weapon equip reset nextShotTime to prevent delayed burst', () => {
  const state = createSchedulerState('ak47', 30);

  // Advance simulation time by 10 seconds with trigger unpressed
  stepFireScheduler(state, 10.0, () => {});
  assert.equal(state.simTime, 10.0);

  // Equip weapon resets nextShotTime
  onWeaponEquip(state);
  assert.equal(state.nextShotTime, 10.0);

  // Press trigger: must fire exactly 1 shot on the first frame, not a backlog
  onTriggerPress(state);
  let firstFrameShots = 0;
  stepFireScheduler(state, 1 / 60, () => {
    state.ammoInClip--;
    firstFrameShots++;
  });
  assert.equal(firstFrameShots, 1, 'First frame after equip must fire at most 1 shot');
});
