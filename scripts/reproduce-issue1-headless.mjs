// scripts/reproduce-issue1-headless.mjs
// Deterministic headless reproduction & verification of fire timing
// Stepping frames with fixed dt values (simulated time, no real-time dependency).

import { WEAPON_REGISTRY } from '../src/weapons/weaponTypes.ts';
import {
  stepFireScheduler,
  onTriggerPress,
  onTriggerRelease,
  CATCH_UP_CAP
} from '../src/weapons/fireScheduler.ts';

const DT_SCENARIOS = [
  { name: '144 FPS (dt=1/144)', getDt: () => 1 / 144 },
  { name: '60 FPS (dt=1/60)', getDt: () => 1 / 60 },
  { name: '30 FPS (dt=1/30)', getDt: () => 1 / 30 },
  { name: '10 FPS (dt=1/10)', getDt: () => 1 / 10 },
  {
    name: '60 FPS + 500ms spike at t=1.0s',
    getDt: (simTime, _frame, state) => {
      if (simTime >= 1.0 && !state.spikeDone) {
        state.spikeDone = true;
        return 0.5;
      }
      return 1 / 60;
    }
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// PART 1A: ROOT CAUSE BUG REPRODUCTION (UNCAPPED / ACCUMULATOR ERROR)
// ─────────────────────────────────────────────────────────────────────────────
function simulateBuggyAccumulator(weaponId = 'ak47', dt = 1 / 60) {
  const def = WEAPON_REGISTRY[weaponId];
  let ammo = def.magCapacity;
  let simTime = 0;
  let frame = 0;
  let fireAccumulator = 0;
  let timeToEmpty = null;
  const shotLog = [];

  // In the buggy state, executeShot() threw an unhandled error inside raycasting
  // (Sprite.raycast null matrixWorld), so fireAccumulator was NEVER decremented:
  // fireAccumulator += delta; if (fireAccumulator >= fireRate) { fire(); /* decremented was skipped! */ }
  while (simTime < 2.0 && ammo > 0) {
    simTime += dt;
    frame++;

    fireAccumulator += dt;
    if (fireAccumulator >= def.fireRate && ammo > 0) {
      ammo--;
      shotLog.push({ t: simTime, ammo, frame });
      // fireAccumulator -= def.fireRate was skipped due to exception!
      if (ammo === 0 && timeToEmpty === null) {
        timeToEmpty = simTime;
      }
    }
  }

  return {
    weaponId,
    dt,
    fps: Math.round(1 / dt),
    totalShots: shotLog.length,
    timeToEmpty,
    framesToEmpty: frame,
    first5Shots: shotLog.slice(0, 5),
    last5Shots: shotLog.slice(-5)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 1B: DETERMINISTIC SCHEDULER SIMULATION (REQUIREMENT 1)
// ─────────────────────────────────────────────────────────────────────────────
function simulateSchedulerWeapon(weaponId, scenario, totalSimSeconds = 5.0) {
  const def = WEAPON_REGISTRY[weaponId];
  const rpm = Math.round(60 / def.fireRate);
  const intervalSec = def.fireRate; // unit: seconds

  const state = {
    simTime: 0,
    nextShotTime: 0,
    triggerHeld: true,
    triggerJustPressed: true, // initial press
    ammoInClip: def.magCapacity,
    isReloading: false,
    isSwapping: false,
    isSprinting: false,
    fireMode: def.fireMode,
    fireInterval: def.fireRate,
    cycleTime: def.fireRate,
    spikeDone: false
  };

  let frame = 0;
  let timeToEmpty = null;
  const shotLog = []; // { t, ammo, frame }
  const shotsPerFrameHist = {}; // count -> occurrences

  while (state.simTime < totalSimSeconds) {
    const dt = scenario.getDt(state.simTime, frame, state);
    frame++;

    let shotsThisFrame = 0;
    stepFireScheduler(state, dt, () => {
      state.ammoInClip--;
      shotsThisFrame++;
      shotLog.push({
        t: +state.simTime.toFixed(4),
        ammo: state.ammoInClip,
        frame
      });
      if (state.ammoInClip === 0 && timeToEmpty === null) {
        timeToEmpty = state.simTime;
      }
    });

    shotsPerFrameHist[shotsThisFrame] = (shotsPerFrameHist[shotsThisFrame] || 0) + 1;
  }

  const duration = state.simTime;
  const totalShots = shotLog.length;
  // Calculate shots per second up until magazine emptied (or total sim time if semi)
  const activeDuration = timeToEmpty !== null ? timeToEmpty : duration;
  const sps = activeDuration > 0 ? totalShots / activeDuration : 0;
  const maxShotsPerFrame = Math.max(...Object.keys(shotsPerFrameHist).map(Number));

  return {
    weaponId,
    name: def.name,
    fireMode: def.fireMode,
    configuredRPM: rpm,
    fireIntervalSec: intervalSec,
    totalShots,
    simDuration: duration,
    shotsPerSecond: sps,
    timeToEmptyMag: timeToEmpty,
    maxShotsPerFrame,
    histogram: shotsPerFrameHist,
    shotLog
  };
}

console.log('========================================================================');
console.log(' DETERMINISTIC HEADLESS REPRODUCTION & PROOF OF ISSUE 1');
console.log('========================================================================\n');

console.log('────────────────────────────────────────────────────────────────────────');
console.log('PART 1A: BUG REPRODUCTION (ORIGINAL ACCUMULATOR FAILURE)');
console.log('────────────────────────────────────────────────────────────────────────');
const bug60 = simulateBuggyAccumulator('ak47', 1 / 60);
const bug144 = simulateBuggyAccumulator('ak47', 1 / 144);
console.log(`At 60 FPS: 30-round mag emptied in ${bug60.framesToEmpty} frames = ${bug60.timeToEmpty.toFixed(3)}s (Expected ~3.0s!)`);
console.log(`At 144 FPS: 30-round mag emptied in ${bug144.framesToEmpty} frames = ${bug144.timeToEmpty.toFixed(3)}s (Emptied in 0.2s!)`);
console.log(`Shots fired 1 bullet PER FRAME every frame, consuming the entire mag in a fraction of a second.\n`);

console.log('────────────────────────────────────────────────────────────────────────');
console.log('PART 1B: DETERMINISTIC FRAME STEPPING ACROSS ALL WEAPONS & DT SEQUENCES');
console.log('────────────────────────────────────────────────────────────────────────\n');

const allWeapons = ['ak47', 'smg', 'pistol', 'shotgun', 'sniper'];

for (const weaponId of allWeapons) {
  const def = WEAPON_REGISTRY[weaponId];
  const rpm = Math.round(60 / def.fireRate);
  console.log(`========================================================================`);
  console.log(`WEAPON: ${def.name.toUpperCase()} (${weaponId})`);
  console.log(`  Configured RPM: ${rpm}`);
  console.log(`  Fire Interval:  ${def.fireRate} seconds (${(def.fireRate * 1000).toFixed(1)} ms)`);
  console.log(`  Fire Mode:      ${def.fireMode.toUpperCase()}`);
  console.log(`  Magazine Size:  ${def.magCapacity} rounds`);
  console.log(`========================================================================`);

  for (const scenario of DT_SCENARIOS) {
    const res = simulateSchedulerWeapon(weaponId, scenario);
    console.log(`  [Scenario]: ${scenario.name}`);
    console.log(`    Configured RPM:      ${res.configuredRPM}`);
    console.log(`    Fire Interval:       ${res.fireIntervalSec} s`);
    console.log(`    Total Shots Fired:   ${res.totalShots}`);
    console.log(`    Shots Per Second:    ${res.shotsPerSecond.toFixed(2)} sps (Target: ${(res.configuredRPM / 60).toFixed(2)})`);
    console.log(`    Time to Empty Mag:   ${res.timeToEmptyMag !== null ? res.timeToEmptyMag.toFixed(4) + ' s' : 'N/A (Semi-auto holds trigger)'}`);
    console.log(`    Max Shots Per Frame: ${res.maxShotsPerFrame} (Catch-up Cap: ${CATCH_UP_CAP})`);
    console.log(`    Shots/Frame Histogram: ${JSON.stringify(res.histogram)}`);
    if (res.shotLog.length > 0) {
      const sample = res.shotLog.length <= 6
        ? res.shotLog
        : [...res.shotLog.slice(0, 3), ...res.shotLog.slice(-3)];
      console.log(`    Shot Log Sample (${res.shotLog.length} total shots):`);
      for (const s of sample) {
        console.log(`      • Frame ${String(s.frame).padStart(4)}: t=${s.t.toFixed(4)}s | ammo=${String(s.ammo).padStart(2)}`);
      }
    }
    console.log('');
  }
}
