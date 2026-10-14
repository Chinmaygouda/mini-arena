/* global global, setTimeout, performance */
import os from 'node:os';
import {
  createDefaultPlayerState,
  createDefaultWeaponState,
  createFireTimingState,
  createHumanoidHitbox,
  getCurrentSlot,
  getCurrentWeaponDef,
  SIM_TICK_DELTA,
  stepFireTiming,
  stepPlayer,
  stepWeaponStateMachine,
  testRayHitbox,
  triggerReload,
  triggerSwapBySlot,
  tryConsumeShot,
} from '../packages/shared/src/index.ts';

async function runMillionTickBenchmark() {
  console.log('================================================================');
  console.log(' MINI ARENA — 1,000,000 TICK HEADLESS ALLOCATION & HEAP PROFILER');
  console.log('================================================================');

  const cpus = os.cpus();
  console.log(`Device CPU Model  : ${cpus[0]?.model || 'Unknown'} (${cpus.length} logical cores)`);
  console.log(`OS Platform       : ${os.platform()} ${os.release()} (${os.arch()})`);
  console.log(`System Memory     : ${(os.freemem() / (1024 ** 3)).toFixed(2)} GB free / ${(os.totalmem() / (1024 ** 3)).toFixed(2)} GB total`);
  console.log(`Node.js Version   : ${process.version}`);

  if (typeof global.gc !== 'function') {
    console.error('ERROR: global.gc is not exposed. Run node with --expose-gc flag.');
    process.exit(1);
  }

  // Warm-up JIT compilation with 10,000 ticks
  console.log('Warming up V8 JIT compiler with 10,000 ticks...');
  let warmupPlayer = createDefaultPlayerState(0, 0, 0);
  const warmupWeapon = createDefaultWeaponState();
  const warmupFire = createFireTimingState();
  const dummyHitbox = createHumanoidHitbox('bench-dummy', 0, 0, 10);

  for (let i = 0; i < 10000; i++) {
    const input = {
      seq: i,
      tick: i,
      moveForward: 1,
      moveRight: 0,
      jump: i % 120 === 0,
      crouch: i % 180 < 60,
      sprint: i % 240 < 120,
      yaw: (i * 0.01) % (Math.PI * 2),
      pitch: 0,
    };
    warmupPlayer = stepPlayer(warmupPlayer, input, SIM_TICK_DELTA);
    stepWeaponStateMachine(warmupWeapon, SIM_TICK_DELTA);
    stepFireTiming(warmupFire, SIM_TICK_DELTA, getCurrentWeaponDef(warmupWeapon));
    if (tryConsumeShot(warmupFire, getCurrentWeaponDef(warmupWeapon))) {
      testRayHitbox({ x: 0, y: 1.55, z: 0 }, { x: 0, y: 0, z: 1 }, dummyHitbox, 100);
    }
  }

  // Force GC before starting measurement to obtain clean baseline
  global.gc();
  global.gc();
  await new Promise((r) => setTimeout(r, 100));

  const memBefore = process.memoryUsage();
  const heapBefore = memBefore.heapUsed;
  const heapTotalBefore = memBefore.heapTotal;

  console.log('----------------------------------------------------------------');
  console.log(`Baseline JSHeapUsedSize : ${(heapBefore / (1024 * 1024)).toFixed(3)} MB (${heapBefore.toLocaleString()} bytes)`);
  console.log(`Baseline JSHeapTotalSize: ${(heapTotalBefore / (1024 * 1024)).toFixed(3)} MB (${heapTotalBefore.toLocaleString()} bytes)`);
  console.log('Executing 1,000,000 ticks of full simulation hot-paths...');

  const totalTicks = 1000000;
  let playerState = createDefaultPlayerState(0, 0, 0);
  const weaponState = createDefaultWeaponState();
  const fireTiming = createFireTimingState();
  let totalShotsFired = 0;
  let totalHitsRegistered = 0;

  const tStart = performance.now();

  for (let t = 0; t < totalTicks; t++) {
    // 1. Cyclic input pattern exercising all movement paths
    const input = {
      seq: t,
      tick: t,
      moveForward: (t % 120 < 60) ? 1 : -1,
      moveRight: (t % 180 < 90) ? 1 : 0,
      jump: t % 200 === 0,
      crouch: t % 300 < 100,
      sprint: t % 400 < 200,
      yaw: (t * 0.005) % (Math.PI * 2),
      pitch: Math.sin(t * 0.01) * 0.3,
    };

    // 2. Step player movement
    playerState = stepPlayer(playerState, input, SIM_TICK_DELTA);

    // 3. Cyclic weapon operations: reload, swap, fire
    if (t % 600 === 0) {
      triggerReload(weaponState);
    }
    if (t % 1200 === 0) {
      triggerSwapBySlot(weaponState, (weaponState.currentSlot + 1) % 5);
    }

    stepWeaponStateMachine(weaponState, SIM_TICK_DELTA);

    const currentDef = getCurrentWeaponDef(weaponState);
    const activeSlot = getCurrentSlot(weaponState);

    stepFireTiming(fireTiming, SIM_TICK_DELTA, currentDef);

    // Continuous fire attempt when mag has ammo and idle
    if (activeSlot.ammoInMag > 0 && weaponState.actionState === 'idle') {
      if (tryConsumeShot(fireTiming, currentDef)) {
        activeSlot.ammoInMag--;
        totalShotsFired++;

        const rayOrigin = { x: playerState.x, y: playerState.y + 1.55, z: playerState.z };
        const rayDir = { x: 0, y: 0, z: 1 };
        const hit = testRayHitbox(rayOrigin, rayDir, dummyHitbox, currentDef.range);
        if (hit.hit) {
          totalHitsRegistered++;
        }
      }
    }
  }

  const tEnd = performance.now();
  const elapsedSec = (tEnd - tStart) / 1000;
  const ticksPerSec = totalTicks / elapsedSec;

  // Measure memory immediately after 1,000,000 ticks BEFORE forced GC
  const memPostUncollected = process.memoryUsage();

  // Force GC to clear any transient stack scopes
  global.gc();
  global.gc();
  await new Promise((r) => setTimeout(r, 100));

  const memAfter = process.memoryUsage();
  const heapAfter = memAfter.heapUsed;
  const heapTotalAfter = memAfter.heapTotal;
  const heapDeltaBytes = heapAfter - heapBefore;
  const heapDeltaKB = heapDeltaBytes / 1024;

  console.log('----------------------------------------------------------------');
  console.log(' 1,000,000 TICK BENCHMARK RESULTS');
  console.log('----------------------------------------------------------------');
  console.log(`Execution Duration      : ${elapsedSec.toFixed(3)} seconds`);
  console.log(`Throughput Rate         : ${Math.round(ticksPerSec).toLocaleString()} ticks/second (${(1000000 / (elapsedSec * 60)).toFixed(0)}x real-time speed)`);
  console.log(`Total Shots Consumed    : ${totalShotsFired.toLocaleString()}`);
  console.log(`Total Hits Calculated   : ${totalHitsRegistered.toLocaleString()}`);
  console.log(`Pre-GC JSHeapUsedSize   : ${(memPostUncollected.heapUsed / (1024 * 1024)).toFixed(3)} MB`);
  console.log(`Post-GC JSHeapUsedSize  : ${(heapAfter / (1024 * 1024)).toFixed(3)} MB (${heapAfter.toLocaleString()} bytes)`);
  console.log(`Post-GC JSHeapTotalSize : ${(heapTotalAfter / (1024 * 1024)).toFixed(3)} MB`);
  console.log(`Net Heap Delta (After GC): ${heapDeltaKB >= 0 ? '+' : ''}${heapDeltaKB.toFixed(2)} KB (${heapDeltaBytes >= 0 ? '+' : ''}${heapDeltaBytes} bytes)`);
  console.log(`Allocation Rate Per Tick: ${(heapDeltaBytes / totalTicks).toFixed(6)} bytes/tick`);
  console.log('================================================================');
}

runMillionTickBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
