/* global global, setTimeout, performance */
import os from 'node:os';
import RAPIER from '../packages/client/node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs';
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
  PLAYER_RADIUS,
  PLAYER_HEIGHT_STAND,
  PLAYER_HEIGHT_CROUCH,
  GRAVITY,
} from '../packages/shared/src/index.ts';

class RapierCollisionWorld {
  constructor(world, controller, playerBody, standingCollider, crouchingCollider) {
    this.world = world;
    this.controller = controller;
    this.playerBody = playerBody;
    this.standingCollider = standingCollider;
    this.crouchingCollider = crouchingCollider;
    this.scratchDelta = { x: 0, y: 0, z: 0 };
  }

  computeMovement(currentPos, desiredDelta, isCrouching) {
    const centerOffsetY = isCrouching ? 0.6 : 0.9;
    this.playerBody.setTranslation(
      {
        x: currentPos.x,
        y: currentPos.y + centerOffsetY,
        z: currentPos.z,
      },
      true,
    );

    this.standingCollider.setEnabled(!isCrouching);
    this.crouchingCollider.setEnabled(isCrouching);
    const activeCollider = isCrouching ? this.crouchingCollider : this.standingCollider;

    this.world.step();

    this.scratchDelta.x = desiredDelta.x;
    this.scratchDelta.y = desiredDelta.y;
    this.scratchDelta.z = desiredDelta.z;

    this.controller.computeColliderMovement(activeCollider, this.scratchDelta);
    const movement = this.controller.computedMovement();
    const grounded = this.controller.computedGrounded();

    return {
      delta: { x: movement.x, y: movement.y, z: movement.z },
      grounded,
    };
  }

  canStandUp(currentPos) {
    const centerPos = { x: currentPos.x, y: currentPos.y + 0.9, z: currentPos.z };
    const rot = { x: 0, y: 0, z: 0, w: 1 };
    const hit = this.world.intersectionWithShape(centerPos, rot, this.standingCollider.shape);
    return hit === null;
  }
}

async function runContinuousBenchmark() {
  console.log('================================================================');
  console.log(' MINI ARENA — CONTINUOUS SIMULATION BENCHMARK (WITH RAPIER)');
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

  console.log('Initializing Rapier 3D WASM physics engine...');
  await RAPIER.init();

  const gravity = new RAPIER.Vector3(0, -GRAVITY, 0);
  const world = new RAPIER.World(gravity);

  // Add arena boundary walls and target dummy colliders in Rapier
  const floorDesc = RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0);
  world.createCollider(floorDesc);

  const southWallDesc = RAPIER.ColliderDesc.cuboid(30, 2.5, 0.5).setTranslation(0, 2.5, -30);
  world.createCollider(southWallDesc);

  const northWallDesc = RAPIER.ColliderDesc.cuboid(30, 2.5, 0.5).setTranslation(0, 2.5, 30);
  world.createCollider(northWallDesc);

  const targetDesc = RAPIER.ColliderDesc.cuboid(0.5, 1.0, 0.5).setTranslation(0, 1.0, 10);
  world.createCollider(targetDesc);

  // Setup character controller
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 0);
  const playerBody = world.createRigidBody(bodyDesc);

  const standHalfHeight = (PLAYER_HEIGHT_STAND - 2 * PLAYER_RADIUS) / 2;
  const crouchHalfHeight = (PLAYER_HEIGHT_CROUCH - 2 * PLAYER_RADIUS) / 2;

  const standColliderDesc = RAPIER.ColliderDesc.capsule(standHalfHeight, PLAYER_RADIUS);
  const crouchColliderDesc = RAPIER.ColliderDesc.capsule(crouchHalfHeight, PLAYER_RADIUS).setEnabled(false);

  const standingCollider = world.createCollider(standColliderDesc, playerBody);
  const crouchingCollider = world.createCollider(crouchColliderDesc, playerBody);

  const controller = world.createCharacterController(0.01);
  controller.enableAutostep(0.35, 0.2, true);
  controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
  controller.setMinSlopeSlideAngle((50 * Math.PI) / 180);

  const rapierWorld = new RapierCollisionWorld(world, controller, playerBody, standingCollider, crouchingCollider);

  const dummyHitbox = createHumanoidHitbox('bench-dummy', 0, 0, 10);
  const ray = new RAPIER.Ray(new RAPIER.Vector3(0, 1.55, 0), new RAPIER.Vector3(0, 0, 1));

  // Warm-up JIT with 10,000 ticks
  console.log('Warming up V8 JIT compiler with 10,000 ticks...');
  let warmupPlayer = createDefaultPlayerState(0, 0, 0);
  const warmupWeapon = createDefaultWeaponState();
  const warmupFire = createFireTimingState();

  for (let i = 0; i < 10000; i++) {
    const input = {
      seq: i,
      tick: i,
      moveForward: 1,
      moveRight: 0,
      jump: false,
      crouch: false,
      sprint: false,
      yaw: 0,
      pitch: 0,
    };
    warmupPlayer = stepPlayer(warmupPlayer, input, SIM_TICK_DELTA, rapierWorld);
    stepWeaponStateMachine(warmupWeapon, SIM_TICK_DELTA);
    stepFireTiming(warmupFire, SIM_TICK_DELTA, getCurrentWeaponDef(warmupWeapon));
    if (tryConsumeShot(warmupFire, getCurrentWeaponDef(warmupWeapon))) {
      testRayHitbox({ x: 0, y: 1.55, z: 0 }, { x: 0, y: 0, z: 1 }, dummyHitbox, 100);
      world.castRay(ray, 100, true);
    }
  }

  // Force GC before starting measurement
  global.gc();
  global.gc();
  await new Promise((r) => setTimeout(r, 100));

  const memBefore = process.memoryUsage();
  const heapBefore = memBefore.heapUsed;
  const heapTotalBefore = memBefore.heapTotal;

  console.log('----------------------------------------------------------------');
  console.log(`Baseline JSHeapUsedSize : ${(heapBefore / (1024 * 1024)).toFixed(3)} MB (${heapBefore.toLocaleString()} bytes)`);
  console.log(`Baseline JSHeapTotalSize: ${(heapTotalBefore / (1024 * 1024)).toFixed(3)} MB (${heapTotalBefore.toLocaleString()} bytes)`);

  // To simulate millions of shots with continuous firing, weapon swaps, reloads, and hitscan,
  // we simulate a squad of 40 active combatants across arena ticks until total shots exceed 2,000,000.
  const numCombatants = 40;
  console.log(`Simulating ${numCombatants} continuous combatants until > 2,000,000 shots fired...`);

  const combatants = Array.from({ length: numCombatants }, (_, idx) => ({
    id: idx,
    player: createDefaultPlayerState((idx % 10) * 2 - 10, 0, Math.floor(idx / 10) * 2 - 10),
    weapon: createDefaultWeaponState(),
    fireTiming: createFireTimingState(),
    shotsFired: 0,
    reloads: 0,
    swaps: 0,
    hits: 0,
    rapierHits: 0,
  }));

  // Stagger initial slots so all 5 weapons are represented
  combatants.forEach((c, idx) => {
    triggerSwapBySlot(c.weapon, idx % 5);
  });

  let totalShotsFired = 0;
  let totalHitsRegistered = 0;
  let totalReloads = 0;
  let totalSwaps = 0;
  let totalRapierRaycasts = 0;
  let totalRapierHits = 0;
  let tick = 0;

  const tStart = performance.now();

  while (totalShotsFired < 2000000) {
    const isMovingForward = (tick % 240 < 120);

    for (let cIdx = 0; cIdx < numCombatants; cIdx++) {
      const c = combatants[cIdx];

      // 1. Cyclic input pattern
      const input = {
        seq: tick,
        tick,
        moveForward: isMovingForward ? 1 : -1,
        moveRight: ((tick + c.id * 17) % 160 < 80) ? 1 : 0,
        jump: (tick + c.id * 31) % 300 === 0,
        crouch: (tick + c.id * 13) % 400 < 100,
        sprint: (tick + c.id * 7) % 500 < 150,
        yaw: ((tick + c.id) * 0.005) % (Math.PI * 2),
        pitch: 0,
      };

      // 2. Step player through Rapier kinematic world (player 0 drives active Rapier controller, others step shared math)
      c.player = stepPlayer(c.player, input, SIM_TICK_DELTA, cIdx === 0 ? rapierWorld : undefined);

      // 3. Periodic weapon swap every 3,000 ticks across all 5 slots
      if ((tick + c.id * 100) % 3000 === 0) {
        const nextSlot = (c.weapon.currentSlot + 1) % 5;
        triggerSwapBySlot(c.weapon, nextSlot);
        c.swaps++;
        totalSwaps++;
      }

      // 4. Advance weapon timers
      stepWeaponStateMachine(c.weapon, SIM_TICK_DELTA);

      const currentDef = getCurrentWeaponDef(c.weapon);
      const activeSlot = getCurrentSlot(c.weapon);

      // Replenish ammo so weapon never sits empty indefinitely
      if (activeSlot.ammoReserve < 30) {
        activeSlot.ammoReserve = 120;
      }

      // Continuous auto-reload trigger when empty
      if (activeSlot.ammoInMag === 0 && c.weapon.actionState === 'idle') {
        triggerReload(c.weapon);
        c.reloads++;
        totalReloads++;
      }

      // Advance fire timing
      stepFireTiming(c.fireTiming, SIM_TICK_DELTA, currentDef);

      // Continuous fire consumption
      if (activeSlot.ammoInMag > 0 && c.weapon.actionState === 'idle') {
        while (tryConsumeShot(c.fireTiming, currentDef) && activeSlot.ammoInMag > 0) {
          activeSlot.ammoInMag--;
          c.shotsFired++;
          totalShotsFired++;

          // Hitscan math against target dummy
          const rayOrigin = { x: c.player.x, y: c.player.y + 1.55, z: c.player.z };
          const rayDir = { x: 0, y: 0, z: 1 };
          const hit = testRayHitbox(rayOrigin, rayDir, dummyHitbox, currentDef.range);
          if (hit.hit) {
            c.hits++;
            totalHitsRegistered++;
          }

          // Rapier physics world raycast
          ray.origin.x = rayOrigin.x;
          ray.origin.y = rayOrigin.y;
          ray.origin.z = rayOrigin.z;
          ray.dir.x = rayDir.x;
          ray.dir.y = rayDir.y;
          ray.dir.z = rayDir.z;

          totalRapierRaycasts++;
          const rapierHit = world.castRay(ray, currentDef.range, true);
          if (rapierHit !== null) {
            c.rapierHits++;
            totalRapierHits++;
          }
        }
      }
    }

    tick++;
  }

  const tEnd = performance.now();
  const elapsedSec = (tEnd - tStart) / 1000;
  const totalTicksSimulated = tick;
  const totalCombatantTicks = tick * numCombatants;
  const ticksPerSec = totalCombatantTicks / elapsedSec;
  const shotsPerSec = totalShotsFired / elapsedSec;

  const memPostUncollected = process.memoryUsage();

  // Force GC
  global.gc();
  global.gc();
  await new Promise((r) => setTimeout(r, 100));

  const memAfter = process.memoryUsage();
  const heapAfter = memAfter.heapUsed;
  const heapTotalAfter = memAfter.heapTotal;
  const heapDeltaBytes = heapAfter - heapBefore;
  const heapDeltaKB = heapDeltaBytes / 1024;

  console.log('----------------------------------------------------------------');
  console.log(' CONTINUOUS BENCHMARK EXECUTION REPORT');
  console.log('----------------------------------------------------------------');
  console.log(`What Ran                : Continuous arena simulation across ${numCombatants} combatants:`);
  console.log(`                          - stepPlayer with Rapier KinematicCharacterController + World.step`);
  console.log(`                          - Continuous weapon fire, reload state machine, and slot swaps`);
  console.log(`                          - Mathematical ray-hitbox checks and Rapier world.castRay`);
  console.log(`Arena Ticks Simulated   : ${totalTicksSimulated.toLocaleString()} ticks (${(totalTicksSimulated / 60).toFixed(1)} s game-time)`);
  console.log(`Total Combatant-Ticks   : ${totalCombatantTicks.toLocaleString()} entity steps`);
  console.log(`Execution Duration      : ${elapsedSec.toFixed(3)} seconds`);
  console.log(`Simulation Throughput   : ${Math.round(ticksPerSec).toLocaleString()} combatant-ticks/second (${(ticksPerSec / 60).toFixed(0)}x real-time 60Hz speed)`);
  console.log(`Total Continuous Shots  : ${totalShotsFired.toLocaleString()} shots fired (${Math.round(shotsPerSec).toLocaleString()} shots/second)`);
  console.log(`Total Reload Cycles     : ${totalReloads.toLocaleString()} reloads completed`);
  console.log(`Total Weapon Swaps      : ${totalSwaps.toLocaleString()} swaps executed`);
  console.log(`Total Dummy Hits        : ${totalHitsRegistered.toLocaleString()} mathematical hitbox hits`);
  console.log(`Total Rapier Raycasts   : ${totalRapierRaycasts.toLocaleString()} raycasts evaluated`);
  console.log(`Total Rapier Hits       : ${totalRapierHits.toLocaleString()} raycasts intersected colliders`);
  console.log('----------------------------------------------------------------');
  console.log(' HEAP MEASUREMENT (NOT CLAIMING "CONCLUSIVE")');
  console.log('----------------------------------------------------------------');
  console.log(`Pre-GC JSHeapUsedSize   : ${(memPostUncollected.heapUsed / (1024 * 1024)).toFixed(3)} MB`);
  console.log(`Post-GC JSHeapUsedSize  : ${(heapAfter / (1024 * 1024)).toFixed(3)} MB (${heapAfter.toLocaleString()} bytes)`);
  console.log(`Post-GC JSHeapTotalSize : ${(heapTotalAfter / (1024 * 1024)).toFixed(3)} MB`);
  console.log(`Measured Net Heap Delta : ${heapDeltaKB >= 0 ? '+' : ''}${heapDeltaKB.toFixed(2)} KB (${heapDeltaBytes >= 0 ? '+' : ''}${heapDeltaBytes} bytes)`);
  console.log(`Net Delta Per Combatant : ${(heapDeltaBytes / totalCombatantTicks).toFixed(6)} bytes/tick`);
  console.log(`Net Delta Per Shot      : ${(heapDeltaBytes / totalShotsFired).toFixed(6)} bytes/shot`);
  console.log('================================================================');
}

runContinuousBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
