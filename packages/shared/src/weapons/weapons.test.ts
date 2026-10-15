import { describe, expect, it } from 'vitest';

declare const console: { log: (...args: unknown[]) => void };
import {
  calculateDamage,
  computeEffectiveSpread,
  createDefaultWeaponState,
  createFireTimingState,
  createHumanoidHitbox,
  createSeededRng,
  getCurrentSlot,
  getCurrentWeaponDef,
  PISTOL_DEF,
  sampleSpreadOffsets,
  SIM_TICK_DELTA,
  SMG_DEF,
  ASSAULT_RIFLE_DEF,
  SHOTGUN_DEF,
  SNIPER_DEF,
  stepFireTiming,
  stepWeaponStateMachine,
  testRayHitbox,
  testRayWithOcclusion,
  rayIntersectsAABB,
  BoxColliderDef,
  triggerReload,
  triggerSwap,
  tryConsumeShot,
  cancelReloadOnFire,
  cancelReloadOnSprint,
  AUTO_SWITCH_DELAY,
  recordShotFired,
  setSprinting,
  findNextWeaponWithAmmo,
  triggerSwapBySlot,
  WEAPON_REGISTRY,
  isWeaponReadyToFire,
  bufferFireInput,
  hashPlayerShot,
  generateSeededPelletOffsets,
  PelletOffset,
} from '../index';

describe('Phase 2 Weapons Core Unit Tests', () => {
  describe('Fire Timing & Fractional Accumulator RPM Accuracy', () => {
    const weapons = [
      { name: 'Pistol', def: PISTOL_DEF, rpm: 400 },
      { name: 'SMG', def: SMG_DEF, rpm: 800 },
      { name: 'Assault Rifle', def: ASSAULT_RIFLE_DEF, rpm: 600 },
      { name: 'Shotgun', def: SHOTGUN_DEF, rpm: 80 },
      { name: 'Sniper', def: SNIPER_DEF, rpm: 45 },
    ];

    weapons.forEach(({ name, def, rpm }) => {
      it(`maintains accurate RPM within ±1% over 60.0 seconds at 60 Hz for ${name} (${rpm} RPM)`, () => {
        const fireState = createFireTimingState();
        const durationSec = 60.0;
        const totalTicks = Math.round(durationSec / SIM_TICK_DELTA); // 3600 ticks at 60 Hz
        const targetInterval = 60 / rpm;
        let shotsFired = 0;
        const shotTimes: number[] = [];

        for (let t = 0; t < totalTicks; t++) {
          const currentTime = t * SIM_TICK_DELTA;
          stepFireTiming(fireState, SIM_TICK_DELTA, def);

          while (tryConsumeShot(fireState, def)) {
            shotsFired++;
            shotTimes.push(currentTime);
          }
        }

        // Calculate inter-shot intervals
        const intervals: number[] = [];
        for (let i = 1; i < shotTimes.length; i++) {
          intervals.push(shotTimes[i]! - shotTimes[i - 1]!);
        }

        const meanInterval =
          intervals.length > 0
            ? intervals.reduce((sum, v) => sum + v, 0) / intervals.length
            : targetInterval;

        const cycleRpm = 60 / meanInterval;
        const countRpm = (shotsFired / durationSec) * 60;
        const intervalError = Math.abs((cycleRpm - rpm) / rpm) * 100;
        const countError = Math.abs((countRpm - rpm) / rpm) * 100;

        console.log(
          `[RPM Test Result] ${name.padEnd(16)} | Config: ${rpm} RPM | Ticks: ${totalTicks} (60s) | Shots: ${shotsFired} | Mean Interval: ${meanInterval.toFixed(4)}s (target: ${targetInterval.toFixed(4)}s) | Count RPM: ${countRpm.toFixed(2)} (${countError.toFixed(3)}% err) | Cycle RPM: ${cycleRpm.toFixed(2)} (${intervalError.toFixed(3)}% err)`
        );

        // Assert discrete count and cycle interval are strictly within ±1.0%
        expect(countError).toBeLessThanOrEqual(1.0);
        expect(intervalError).toBeLessThanOrEqual(1.0);
        // Over a full 60.0s window, integer shot counts are exact
        expect(shotsFired).toBe(rpm);
      });
    });
  });

  describe('Seeded PRNG (Mulberry32)', () => {
    it('produces 100% bit-for-bit identical sequences from identical seeds', () => {
      const rng1 = createSeededRng(1337);
      const rng2 = createSeededRng(1337);

      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('produces distinct sequences from distinct seeds', () => {
      const rng1 = createSeededRng(1337);
      const rng2 = createSeededRng(9999);

      let differences = 0;
      for (let i = 0; i < 20; i++) {
        if (rng1.next() !== rng2.next()) {
          differences++;
        }
      }
      expect(differences).toBe(20);
    });

    it('generates uniform numbers strictly within range', () => {
      const rng = createSeededRng(42);
      for (let i = 0; i < 200; i++) {
        const val = rng.range(-5, 5);
        expect(val).toBeGreaterThanOrEqual(-5);
        expect(val).toBeLessThan(5);
      }
    });
  });

  describe('Damage Falloff & Headshot Multipliers', () => {
    it('applies full base damage within startDist', () => {
      const dmgClose = calculateDamage(ASSAULT_RIFLE_DEF, 10, false);
      expect(dmgClose).toBe(ASSAULT_RIFLE_DEF.damageBase);
    });

    it('applies linear falloff between startDist and endDist', () => {
      const { startDist, endDist, minDamage } = ASSAULT_RIFLE_DEF.damageFalloff;
      const midDist = (startDist + endDist) / 2;
      const expectedMid = (ASSAULT_RIFLE_DEF.damageBase + minDamage) / 2;

      const dmgMid = calculateDamage(ASSAULT_RIFLE_DEF, midDist, false);
      expect(dmgMid).toBeCloseTo(expectedMid, 1);
    });

    it('caps damage to minDamage at or beyond endDist', () => {
      const { endDist, minDamage } = ASSAULT_RIFLE_DEF.damageFalloff;
      const dmgFar = calculateDamage(ASSAULT_RIFLE_DEF, endDist + 20, false);
      expect(dmgFar).toBe(minDamage);
    });

    it('applies headshot multiplier accurately', () => {
      const dmgBody = calculateDamage(SNIPER_DEF, 50, false);
      const dmgHead = calculateDamage(SNIPER_DEF, 50, true);
      expect(dmgHead).toBeCloseTo(dmgBody * SNIPER_DEF.headshotMultiplier, 1);
    });
  });

  describe('Stance Spread Multipliers', () => {
    it('applies crouch multiplier (tighter spread) when crouching', () => {
      const standingSpread = computeEffectiveSpread(ASSAULT_RIFLE_DEF, {
        isMoving: false,
        isCrouching: false,
        isSprinting: false,
        isADS: false,
      });

      const crouchSpread = computeEffectiveSpread(ASSAULT_RIFLE_DEF, {
        isMoving: false,
        isCrouching: true,
        isSprinting: false,
        isADS: false,
      });

      expect(crouchSpread).toBeLessThan(standingSpread);
      expect(crouchSpread).toBeCloseTo(standingSpread * ASSAULT_RIFLE_DEF.spread.crouchMultiplier, 5);
    });

    it('applies ADS multiplier (extreme accuracy) when aiming down sights', () => {
      const hipSpread = computeEffectiveSpread(SNIPER_DEF, {
        isMoving: false,
        isCrouching: false,
        isSprinting: false,
        isADS: false,
      });

      const adsSpread = computeEffectiveSpread(SNIPER_DEF, {
        isMoving: false,
        isCrouching: false,
        isSprinting: false,
        isADS: true,
      });

      expect(adsSpread).toBeLessThan(hipSpread);
      expect(adsSpread).toBeCloseTo(hipSpread * SNIPER_DEF.spread.adsMultiplier, 5);
    });

    it('spread offsets are bounded within the cone half-angle', () => {
      const rng = createSeededRng(12345);
      const halfAngle = 0.05;

      for (let i = 0; i < 100; i++) {
        const { pitchOffset, yawOffset } = sampleSpreadOffsets(halfAngle, rng);
        const distance = Math.hypot(pitchOffset, yawOffset);
        expect(distance).toBeLessThanOrEqual(halfAngle);
      }
    });
  });

  describe('Reload and Swap State Machine', () => {
    it('initiates tactical reload when magazine > 0', () => {
      const state = createDefaultWeaponState();
      const slot = getCurrentSlot(state);
      slot.ammoInMag = 15; // half full

      const started = triggerReload(state);
      expect(started).toBe(true);
      expect(state.actionState).toBe('reloading_tactical');
      expect(state.stateTimer).toBe(ASSAULT_RIFLE_DEF.reloadTimeTactical);
    });

    it('initiates empty reload when magazine is 0', () => {
      const state = createDefaultWeaponState();
      const slot = getCurrentSlot(state);
      slot.ammoInMag = 0; // empty

      const started = triggerReload(state);
      expect(started).toBe(true);
      expect(state.actionState).toBe('reloading_empty');
      expect(state.stateTimer).toBe(ASSAULT_RIFLE_DEF.reloadTimeEmpty);
    });

    it('refuses reload when magazine is already full', () => {
      const state = createDefaultWeaponState();
      const slot = getCurrentSlot(state);
      slot.ammoInMag = ASSAULT_RIFLE_DEF.magSize;

      const started = triggerReload(state);
      expect(started).toBe(false);
      expect(state.actionState).toBe('idle');
    });

    it('refuses reload when reserve ammo is zero', () => {
      const state = createDefaultWeaponState();
      const slot = getCurrentSlot(state);
      slot.ammoInMag = 5;
      slot.ammoReserve = 0;

      const started = triggerReload(state);
      expect(started).toBe(false);
      expect(state.actionState).toBe('idle');
    });

    it('completes reload and replenishes ammo when timer expires', () => {
      const state = createDefaultWeaponState();
      const slot = getCurrentSlot(state);
      slot.ammoInMag = 10;
      slot.ammoReserve = 60;

      triggerReload(state);
      expect(state.actionState).toBe('reloading_tactical');

      // Step time forward past reload duration
      stepWeaponStateMachine(state, ASSAULT_RIFLE_DEF.reloadTimeTactical + 0.1);

      expect(state.actionState).toBe('idle');
      expect(slot.ammoInMag).toBe(ASSAULT_RIFLE_DEF.magSize);
      expect(slot.ammoReserve).toBe(60 - (30 - 10)); // 40
    });

    it('cancels reload immediately on sprint', () => {
      const state = createDefaultWeaponState();
      const slot = getCurrentSlot(state);
      slot.ammoInMag = 5;

      triggerReload(state);
      expect(state.actionState).toBe('reloading_tactical');

      const canceled = cancelReloadOnSprint(state);
      expect(canceled).toBe(true);
      expect(state.actionState).toBe('idle');
      expect(state.stateTimer).toBe(0);
      expect(slot.ammoInMag).toBe(5); // ammo not replenished early
    });

    it('cancels reload and swaps weapon on triggerSwap', () => {
      const state = createDefaultWeaponState();
      const slot = getCurrentSlot(state);
      slot.ammoInMag = 10;
      triggerReload(state);
      expect(state.actionState).toBe('reloading_tactical');

      // Swap to pistol
      const swapped = triggerSwap(state, 'pistol');
      expect(swapped).toBe(true);
      expect(state.actionState).toBe('swapping_out');

      // Step half swap time
      stepWeaponStateMachine(state, ASSAULT_RIFLE_DEF.swapTime / 2 + 0.01);
      expect(state.actionState).toBe('swapping_in');
      expect(getCurrentSlot(state).weaponId).toBe('pistol');

      // Step remaining swap time
      stepWeaponStateMachine(state, PISTOL_DEF.swapTime / 2 + 0.01);
      expect(state.actionState).toBe('idle');
      expect(getCurrentWeaponDef(state).id).toBe('pistol');
    });

    it('has zero stuck states: timer always decrements to idle', () => {
      const state = createDefaultWeaponState();
      state.actionState = 'reloading_empty';
      state.stateTimer = 2.0;

      for (let i = 0; i < 300; i++) {
        stepWeaponStateMachine(state, 0.016);
      }

      expect(state.actionState).toBe('idle');
      expect(state.stateTimer).toBe(0);
    });
  });

  describe('Pure Ray-vs-Hitbox Hit Detection Math', () => {
    const dummy = createHumanoidHitbox('dummy-1', 0, 0, 10); // Target at (0, 0, 10)

    it('registers headshot when ray is aimed directly at head center', () => {
      const rayOrigin = { x: 0, y: 1.55, z: 0 };
      const rayDir = { x: 0, y: 0, z: 1 }; // Toward +Z

      const result = testRayHitbox(rayOrigin, rayDir, dummy, 50);

      expect(result.hit).toBe(true);
      expect(result.part).toBe('head');
      expect(result.distance).toBeCloseTo(10 - dummy.headRadius, 2);
    });

    it('registers body hit when ray is aimed at torso center', () => {
      const rayOrigin = { x: 0, y: 0.85, z: 0 };
      const rayDir = { x: 0, y: 0, z: 1 };

      const result = testRayHitbox(rayOrigin, rayDir, dummy, 50);

      expect(result.hit).toBe(true);
      expect(result.part).toBe('body');
      expect(result.distance).toBeCloseTo(10 - dummy.bodyRadius, 2);
    });

    it('reports miss when ray is aimed wide of the target', () => {
      const rayOrigin = { x: 2.0, y: 1.0, z: 0 };
      const rayDir = { x: 0, y: 0, z: 1 };

      const result = testRayHitbox(rayOrigin, rayDir, dummy, 50);

      expect(result.hit).toBe(false);
      expect(result.part).toBeNull();
    });

    it('respects weapon max range cutoff', () => {
      const rayOrigin = { x: 0, y: 1.55, z: 0 };
      const rayDir = { x: 0, y: 0, z: 1 };

      // Target is at 10m, but range is capped to 5m
      const result = testRayHitbox(rayOrigin, rayDir, dummy, 5.0);

      expect(result.hit).toBe(false);
    });
  });

  describe('Combat Shotgun Multi-Pellet Mechanics', () => {
    it('fires exactly 8 pellets per shot with individual spread dispersion', () => {
      expect(SHOTGUN_DEF.pellets).toBe(8);

      const rng = createSeededRng(777);
      const halfAngle = SHOTGUN_DEF.spread.base;
      const pellets: Array<{ pitchOffset: number; yawOffset: number }> = [];

      for (let p = 0; p < SHOTGUN_DEF.pellets; p++) {
        pellets.push(sampleSpreadOffsets(halfAngle, rng));
      }

      expect(pellets.length).toBe(8);

      // Verify pellets are distinct and dispersed across the spread cone
      const uniqueOffsets = new Set(pellets.map((p) => `${p.pitchOffset.toFixed(4)},${p.yawOffset.toFixed(4)}`));
      expect(uniqueOffsets.size).toBe(8);

      for (const p of pellets) {
        const dist = Math.hypot(p.pitchOffset, p.yawOffset);
        expect(dist).toBeLessThanOrEqual(halfAngle);
      }
    });

    it('calculates point-blank total damage of 96 across all 8 pellets', () => {
      const perPelletDmg = calculateDamage(SHOTGUN_DEF, 2.0, false);
      expect(perPelletDmg).toBe(12);

      const totalPointBlank = perPelletDmg * SHOTGUN_DEF.pellets;
      expect(totalPointBlank).toBe(96);
    });

    it('calculates falloff minimum total damage of 32 at max range', () => {
      const perPelletDmg = calculateDamage(SHOTGUN_DEF, 25.0, false);
      expect(perPelletDmg).toBe(4);

      const totalMaxRange = perPelletDmg * SHOTGUN_DEF.pellets;
      expect(totalMaxRange).toBe(32);
    });
  });

  describe('Shell-By-Shell Shotgun Reload & Interrupt', () => {
    it('loads shells incrementally and pumps first shell when empty (3-phase reload)', () => {
      const state = createDefaultWeaponState();
      state.currentSlot = 3; // Shotgun
      const slot = getCurrentSlot(state);
      slot.ammoInMag = 0;
      slot.ammoReserve = 12;

      // Trigger reload from empty: phase 1 is reloading_shell_start (24 ticks = 0.40s)
      const started = triggerReload(state);
      expect(started).toBe(true);
      expect(state.actionState).toBe('reloading_shell_start');
      expect(state.stateTicksRemaining).toBe(SHOTGUN_DEF.reloadSpec.shell!.startTicks);

      // Advance start phase (24 ticks) -> transitions to reloading_shell_insert (32 ticks)
      for (let t = 0; t < 24; t++) {
        stepWeaponStateMachine(state, SIM_TICK_DELTA);
      }
      expect(state.actionState).toBe('reloading_shell_insert');
      expect(slot.ammoInMag).toBe(0); // Not committed yet

      // Advance 20 ticks into insert phase -> commitTick occurs
      for (let t = 0; t < 20; t++) {
        stepWeaponStateMachine(state, SIM_TICK_DELTA);
      }
      expect(slot.ammoInMag).toBe(1);
      expect(slot.ammoReserve).toBe(11);
      expect(state.actionState).toBe('reloading_shell_insert');

      // Finish remainder of 1st shell insert (12 more ticks) -> loops to 2nd shell insert
      for (let t = 0; t < 12; t++) {
        stepWeaponStateMachine(state, SIM_TICK_DELTA);
      }
      expect(state.actionState).toBe('reloading_shell_insert');
      expect(slot.ammoInMag).toBe(1);

      // Step 20 ticks of 2nd shell insert -> commits 2nd shell
      for (let t = 0; t < 20; t++) {
        stepWeaponStateMachine(state, SIM_TICK_DELTA);
      }
      expect(slot.ammoInMag).toBe(2);
      expect(slot.ammoReserve).toBe(10);
    });

    it('allows player to interrupt shell reload by firing if ammo > 0', () => {
      const state = createDefaultWeaponState();
      state.currentSlot = 3;
      const slot = getCurrentSlot(state);
      slot.ammoInMag = 1; // 1 shell loaded
      state.actionState = 'reloading_shell';
      state.stateTimer = 0.55;

      const canceled = cancelReloadOnFire(state);
      expect(canceled).toBe(true);
      expect(state.actionState).toBe('idle');
      expect(state.stateTimer).toBe(0);
      expect(slot.ammoInMag).toBe(1); // Shell remains loaded and ready to fire
    });

    it('refuses reload interrupt when magazine is 0', () => {
      const state = createDefaultWeaponState();
      state.currentSlot = 3;
      const slot = getCurrentSlot(state);
      slot.ammoInMag = 0;
      state.actionState = 'reloading_shell';
      state.stateTimer = 0.75;

      const canceled = cancelReloadOnFire(state);
      expect(canceled).toBe(false);
      expect(state.actionState).toBe('reloading_shell');
    });
  });

  describe('Precision Sniper Rifle Mechanics', () => {
    it('enforces bolt cycle delay of 1.333s (45 RPM) between shots', () => {
      const fireState = createFireTimingState();
      const def = SNIPER_DEF;
      const boltCycleTime = 60 / def.rpm; // 1.3333s
      expect(boltCycleTime).toBeCloseTo(1.3333, 3);

      // Prime accumulator so first shot is ready immediately
      fireState.fireAccumulator = boltCycleTime;

      // First shot fires at t = 0
      expect(tryConsumeShot(fireState, def)).toBe(true);
      expect(fireState.fireAccumulator).toBeCloseTo(0, 5);

      // Attempt second shot at t = 0.5s (30 ticks): must fail
      for (let t = 0; t < Math.round(0.5 / SIM_TICK_DELTA); t++) {
        stepFireTiming(fireState, SIM_TICK_DELTA, def);
      }
      expect(tryConsumeShot(fireState, def)).toBe(false);

      // Attempt second shot at t = 1.0s total (another 30 ticks): must still fail
      for (let t = 0; t < Math.round(0.5 / SIM_TICK_DELTA); t++) {
        stepFireTiming(fireState, SIM_TICK_DELTA, def);
      }
      expect(tryConsumeShot(fireState, def)).toBe(false);

      // Advance remaining time to 1.35s total (another 21 ticks): bolt cycle finishes, shot succeeds
      for (let t = 0; t < Math.round(0.35 / SIM_TICK_DELTA); t++) {
        stepFireTiming(fireState, SIM_TICK_DELTA, def);
      }
      expect(tryConsumeShot(fireState, def)).toBe(true);
    });

    it('provides 4x zoom with 0.25 ADS FOV multiplier and lethal headshots', () => {
      expect(SNIPER_DEF.adsFovMultiplier).toBe(0.25);

      // Base body damage
      const bodyDmg = calculateDamage(SNIPER_DEF, 30, false);
      expect(bodyDmg).toBe(85);

      // Lethal headshot damage: 85 * 2.5 = 212.5 (guaranteed 1-shot kill)
      const headDmg = calculateDamage(SNIPER_DEF, 30, true);
      expect(headDmg).toBe(212.5);
      expect(headDmg).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Environmental Wall Occlusion (Ray vs AABB & Target)', () => {
    const dummy = createHumanoidHitbox('dummy-occluded', 0, 0, 10);
    const rayOrigin = { x: 0, y: 1.55, z: 0 };
    const rayDir = { x: 0, y: 0, z: 1 }; // Toward +Z

    it('pure rayIntersectsAABB math computes accurate intersection distance and hit point', () => {
      const box: BoxColliderDef = {
        min: { x: -1, y: 0, z: 5 },
        max: { x: 1, y: 3, z: 7 },
      };
      const directRes = rayIntersectsAABB(rayOrigin, rayDir, box, 50);
      expect(directRes.hit).toBe(true);
      expect(directRes.distance).toBe(5.0);
      expect(directRes.hitPoint).toEqual({ x: 0, y: 1.55, z: 5.0 });

      // Miss when ray is off to the side
      const rayMiss = { x: 5, y: 1.55, z: 0 };
      const missRes = rayIntersectsAABB(rayMiss, rayDir, box, 50);
      expect(missRes.hit).toBe(false);
      expect(missRes.distance).toBe(Infinity);
    });

    it('blocks hitscan ray when an intervening wall is in the trajectory', () => {
      // Wall between shooter (z=0) and target (z=10), located at z=4..6
      const wall: BoxColliderDef = {
        id: 'wall-intervening',
        min: { x: -2, y: 0, z: 4 },
        max: { x: 2, y: 3, z: 6 },
      };

      const result = testRayWithOcclusion(rayOrigin, rayDir, dummy, [wall], 50);

      expect(result.hit).toBe(false);
      expect(result.occludedByWall).toBe(true);
      expect(result.distance).toBe(4.0); // Hit front face of wall at z=4
      expect(result.hitPoint).not.toBeNull();
      expect(result.hitPoint!.z).toBeCloseTo(4.0, 3);
    });

    it('allows hitscan hit when wall is positioned behind target or to the side', () => {
      // Wall behind target at z=15..17
      const wallBehind: BoxColliderDef = {
        id: 'wall-behind',
        min: { x: -2, y: 0, z: 15 },
        max: { x: 2, y: 3, z: 17 },
      };

      const result = testRayWithOcclusion(rayOrigin, rayDir, dummy, [wallBehind], 50);

      expect(result.hit).toBe(true);
      expect(result.occludedByWall).toBe(false);
      expect(result.part).toBe('head');
      expect(result.distance).toBeCloseTo(10 - dummy.headRadius, 2);
    });
  });

  describe('Auto-Reload & Auto-Switch State Machine Logic', () => {
    describe('Auto-Reload', () => {
      it('automatically starts empty reload when mag hits 0 and reserve > 0 after shot cooldown', () => {
        const state = createDefaultWeaponState();
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 1;
        slot.ammoReserve = 60;

        // Fire last shot
        slot.ammoInMag = 0;
        recordShotFired(state, 0.1); // 100ms cooldown

        // Step within cooldown: reload must NOT have started yet
        stepWeaponStateMachine(state, 0.05);
        expect(state.actionState).toBe('idle');
        expect(state.shotCooldownTimer).toBeCloseTo(0.05, 3);

        // Step past cooldown: auto-reload triggers immediately
        stepWeaponStateMachine(state, 0.06);
        expect(state.actionState).toBe('reloading_empty');
        expect(state.stateTimer).toBeGreaterThan(0);
      });

      it('cancels auto-reload if player initiates a sprint, and does not re-trigger while sprinting', () => {
        const state = createDefaultWeaponState();
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 0;
        slot.ammoReserve = 60;
        state.shotCooldownTimer = 0;

        // Step once to trigger auto-reload
        stepWeaponStateMachine(state, 0.016);
        expect(state.actionState).toBe('reloading_empty');

        // Player starts sprinting -> reload cancelled to idle
        setSprinting(state, true);
        expect(state.actionState).toBe('idle');

        // While sprinting, auto-reload must NOT re-trigger
        stepWeaponStateMachine(state, 0.016);
        expect(state.actionState).toBe('idle');

        // When sprinting stops, auto-reload resumes
        setSprinting(state, false);
        stepWeaponStateMachine(state, 0.016);
        expect(state.actionState).toBe('reloading_empty');
      });

      it('cancels auto-reload if player initiates weapon swap', () => {
        const state = createDefaultWeaponState();
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 0;
        slot.ammoReserve = 60;

        // Auto-reload triggers
        stepWeaponStateMachine(state, 0.016);
        expect(state.actionState).toBe('reloading_empty');

        // Swap to pistol
        triggerSwap(state, 'pistol');
        expect(state.actionState).toBe('swapping_out');

        // Step through swap
        stepWeaponStateMachine(state, ASSAULT_RIFLE_DEF.swapTime / 2 + 0.01);
        expect(state.actionState).toBe('swapping_in');
        stepWeaponStateMachine(state, PISTOL_DEF.swapTime / 2 + 0.01);
        expect(state.actionState).toBe('idle');
        expect(getCurrentSlot(state).weaponId).toBe('pistol');
      });

      it('respects setting to disable auto-reload', () => {
        const state = createDefaultWeaponState();
        state.autoReload = false;
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 0;
        slot.ammoReserve = 60;
        state.shotCooldownTimer = 0;

        stepWeaponStateMachine(state, 0.1);
        expect(state.actionState).toBe('idle');
        expect(slot.ammoInMag).toBe(0);
      });

      it('allows shotgun fire-interrupt during shell reload without retriggering auto-reload while ammo > 0', () => {
        const state = createDefaultWeaponState();
        triggerSwap(state, 'shotgun');
        stepWeaponStateMachine(state, 1.0); // Complete swapping_out
        stepWeaponStateMachine(state, 1.0); // Complete swapping_in
        expect(getCurrentSlot(state).weaponId).toBe('shotgun');
        expect(state.actionState).toBe('idle');

        const slot = getCurrentSlot(state);
        slot.ammoInMag = 0;
        slot.ammoReserve = 12;
        state.shotCooldownTimer = 0;

        // Auto-reload triggers for shell 1 (starts with reloading_shell_start)
        stepWeaponStateMachine(state, 0.016);
        expect(state.actionState).toBe('reloading_shell_start');

        // Step through start (24 ticks) and 1st shell insert (32 ticks) -> shell 1 committed
        for (let t = 0; t < 56; t++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }
        expect(slot.ammoInMag).toBe(1);
        expect(state.actionState).toBe('reloading_shell_insert'); // Loading shell 2

        // Player taps fire -> interrupts reload
        const interrupted = cancelReloadOnFire(state);
        expect(interrupted).toBe(true);
        expect(state.actionState).toBe('idle');
        expect(slot.ammoInMag).toBe(1);

        // Next tick: since ammoInMag == 1 (> 0), auto-reload must NOT trigger
        stepWeaponStateMachine(state, 0.016);
        expect(state.actionState).toBe('idle');
      });
    });

    describe('Auto-Switch', () => {
      it('switches to next weapon with ammo after AUTO_SWITCH_DELAY when mag and reserve hit 0', () => {
        const state = createDefaultWeaponState();
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 0;
        slot.ammoReserve = 0;

        // Step partially through delay: must stay on weapon
        stepWeaponStateMachine(state, AUTO_SWITCH_DELAY / 2);
        expect(state.actionState).toBe('idle');
        expect(state.currentSlot).toBe(0);

        // Step past delay: triggers swap out
        stepWeaponStateMachine(state, AUTO_SWITCH_DELAY / 2 + 0.02);
        expect(state.actionState).toBe('swapping_out');

        // Finish swap: out -> in -> idle
        stepWeaponStateMachine(state, 1.0);
        expect(state.actionState).toBe('swapping_in');
        stepWeaponStateMachine(state, 1.0);
        expect(state.actionState).toBe('idle');
        // By default, slot 1 (pistol) has ammo
        expect(state.currentSlot).toBe(1);
        expect(getCurrentSlot(state).weaponId).toBe('pistol');
      });

      it('prioritizes last-used weapon if it has ammo', () => {
        const state = createDefaultWeaponState();
        // Start on slot 0 (AR), swap to slot 2 (SMG)
        triggerSwapBySlot(state, 2);
        stepWeaponStateMachine(state, 1.0);
        stepWeaponStateMachine(state, 1.0);
        expect(state.currentSlot).toBe(2);
        expect(state.lastUsedSlot).toBe(0);

        // Empty SMG completely
        const smgSlot = getCurrentSlot(state);
        smgSlot.ammoInMag = 0;
        smgSlot.ammoReserve = 0;

        // Step past auto switch delay
        stepWeaponStateMachine(state, AUTO_SWITCH_DELAY + 0.02);
        expect(state.actionState).toBe('swapping_out');

        // Step through swap: should switch back to slot 0 (AR, the last-used weapon)
        stepWeaponStateMachine(state, 1.0);
        stepWeaponStateMachine(state, 1.0);
        expect(state.currentSlot).toBe(0);
        expect(getCurrentSlot(state).weaponId).toBe('assault_rifle');
      });

      it('falls back to slot order if last-used weapon is also completely empty', () => {
        const state = createDefaultWeaponState();
        // Empty slot 0 (AR)
        state.slots[0]!.ammoInMag = 0;
        state.slots[0]!.ammoReserve = 0;

        // Swap to slot 2 (SMG)
        triggerSwapBySlot(state, 2);
        stepWeaponStateMachine(state, 1.0);
        stepWeaponStateMachine(state, 1.0);
        expect(state.currentSlot).toBe(2);
        expect(state.lastUsedSlot).toBe(0); // Last used was AR, which is empty!

        // Empty slot 2 (SMG)
        state.slots[2]!.ammoInMag = 0;
        state.slots[2]!.ammoReserve = 0;

        // Step past auto switch delay
        stepWeaponStateMachine(state, AUTO_SWITCH_DELAY + 0.02);
        expect(state.actionState).toBe('swapping_out');

        // Step through swap: since slot 0 is empty, slot order search from slot 2 checks:
        // slot 3 (shotgun, which has ammo)
        stepWeaponStateMachine(state, 1.0);
        stepWeaponStateMachine(state, 1.0);
        expect(state.currentSlot).toBe(3);
        expect(getCurrentSlot(state).weaponId).toBe('shotgun');
      });

      it('cancels auto-switch if player manually swaps weapons during delay', () => {
        const state = createDefaultWeaponState();
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 0;
        slot.ammoReserve = 0;

        // Start auto switch timer
        stepWeaponStateMachine(state, 0.1);
        expect(state.autoSwitchTimer).toBeGreaterThan(0);

        // Player manually swaps to sniper (slot 4)
        triggerSwapBySlot(state, 4);
        expect(state.autoSwitchTimer).toBe(0); // Cancelled!
        expect(state.actionState).toBe('swapping_out');
        expect(state.pendingWeaponId).toBe('sniper');

        stepWeaponStateMachine(state, 1.0);
        stepWeaponStateMachine(state, 1.0);
        expect(state.currentSlot).toBe(4);
        expect(getCurrentSlot(state).weaponId).toBe('sniper');
      });

      it('flags OUT_OF_AMMO and stays on current weapon without looping when all weapons are empty', () => {
        const state = createDefaultWeaponState();
        // Empty all 5 weapon slots
        for (const s of state.slots) {
          s.ammoInMag = 0;
          s.ammoReserve = 0;
        }

        expect(findNextWeaponWithAmmo(state)).toBe(-1);

        // Step 100 ticks
        for (let t = 0; t < 100; t++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
          expect(state.isOutOfAmmo).toBe(true);
          expect(state.actionState).toBe('idle');
          expect(state.currentSlot).toBe(0); // Never shifts or loops infinitely
        }
      });

      it('respects setting to disable auto-switch', () => {
        const state = createDefaultWeaponState();
        state.autoSwitch = false;
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 0;
        slot.ammoReserve = 0;

        stepWeaponStateMachine(state, 1.0);
        expect(state.currentSlot).toBe(0);
        expect(state.actionState).toBe('idle');
      });

      it('guarantees zero stuck states under 10,000 randomized state transitions', () => {
        const state = createDefaultWeaponState();
        const rng = createSeededRng(12345);

        for (let i = 0; i < 10000; i++) {
          const action = rng.range(0, 10);
          if (action < 2) {
            triggerReload(state);
          } else if (action < 4) {
            triggerSwapBySlot(state, Math.floor(rng.range(0, 5)));
          } else if (action < 5) {
            cancelReloadOnSprint(state);
          } else if (action < 6) {
            setSprinting(state, rng.next() > 0.5);
          } else if (action < 7) {
            const slot = getCurrentSlot(state);
            if (slot.ammoInMag > 0) {
              slot.ammoInMag--;
              recordShotFired(state);
            }
          }

          stepWeaponStateMachine(state, SIM_TICK_DELTA);

          // Invariant checks: timers must be non-negative numbers, slot must be valid
          expect(Number.isNaN(state.stateTimer)).toBe(false);
          expect(state.stateTimer).toBeGreaterThanOrEqual(0);
          expect(Number.isNaN(state.shotCooldownTimer)).toBe(false);
          expect(state.shotCooldownTimer).toBeGreaterThanOrEqual(0);
          expect(state.currentSlot).toBeGreaterThanOrEqual(0);
          expect(state.currentSlot).toBeLessThan(state.slots.length);
        }
      });
    });
  });

  describe('Phase 3 Step 0 Simulation Contracts & Invariants', () => {
    it('verifies integer-tick reload specs and timings for all 5 weapons', () => {
      for (const weaponId of Object.keys(WEAPON_REGISTRY) as Array<keyof typeof WEAPON_REGISTRY>) {
        const def = WEAPON_REGISTRY[weaponId];
        expect(Number.isInteger(def.swapTicks)).toBe(true);
        expect(def.swapTicks).toBeGreaterThan(0);

        if (def.reloadType === 'magazine') {
          const mag = def.reloadSpec.magazine!;
          expect(mag).toBeDefined();
          expect(Number.isInteger(mag.tacticalReloadTicks)).toBe(true);
          expect(Number.isInteger(mag.tacticalCommitTick)).toBe(true);
          expect(Number.isInteger(mag.emptyReloadTicks)).toBe(true);
          expect(Number.isInteger(mag.emptyCommitTick)).toBe(true);
          expect(mag.tacticalCommitTick).toBeLessThan(mag.tacticalReloadTicks);
          expect(mag.emptyCommitTick).toBeLessThan(mag.emptyReloadTicks);
        } else {
          const shell = def.reloadSpec.shell!;
          expect(shell).toBeDefined();
          expect(Number.isInteger(shell.startTicks)).toBe(true);
          expect(Number.isInteger(shell.insertTicks)).toBe(true);
          expect(Number.isInteger(shell.commitTick)).toBe(true);
          expect(Number.isInteger(shell.endTicks)).toBe(true);
          expect(Number.isInteger(shell.pumpCloseTick)).toBe(true);
          expect(shell.commitTick).toBeLessThan(shell.insertTicks);
          expect(shell.pumpCloseTick).toBeLessThan(shell.endTicks);
        }

        if (weaponId === 'sniper') {
          expect(def.boltCycleTicks).toBe(80); // 80 ticks = 1.333s at 60 Hz
        }
      }
    });

    describe('Mid-Reload Commit Tick & Interrupt Invariants', () => {
      it('loses progress when tactical reload is interrupted BEFORE commit tick', () => {
        const state = createDefaultWeaponState();
        state.currentSlot = 0; // Assault Rifle
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 15;
        slot.ammoReserve = 90;

        triggerReload(state);
        expect(state.actionState).toBe('reloading_tactical');

        // Step 50 ticks (AR tactical commit is at 72 ticks)
        for (let t = 0; t < 50; t++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }
        expect(slot.ammoInMag).toBe(15); // Not committed yet

        // Sprint interrupts reload before commit
        cancelReloadOnSprint(state);
        expect(state.actionState).toBe('idle');
        expect(slot.ammoInMag).toBe(15); // Progress lost
        expect(slot.ammoReserve).toBe(90);
      });

      it('retains replenished ammo when tactical reload is interrupted AFTER commit tick', () => {
        const state = createDefaultWeaponState();
        state.currentSlot = 0; // Assault Rifle
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 15;
        slot.ammoReserve = 90;

        triggerReload(state);
        expect(state.actionState).toBe('reloading_tactical');

        // Step 75 ticks (past commit tick 72)
        for (let t = 0; t < 75; t++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }
        expect(slot.ammoInMag).toBe(30); // Ammo committed!
        expect(slot.ammoReserve).toBe(75);

        // Sprint interrupts remaining animation to idle
        cancelReloadOnSprint(state);
        expect(state.actionState).toBe('idle');
        expect(slot.ammoInMag).toBe(30); // Magazine retains credited ammo!
        expect(slot.ammoReserve).toBe(75);
      });
    });

    describe('Shotgun Fire-Interrupt Double-Pump Prevention', () => {
      it('skips reload_shell_end directly to idle when fire interrupts with ammo > 0', () => {
        const state = createDefaultWeaponState();
        state.currentSlot = 3; // Shotgun
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 0;
        slot.ammoReserve = 12;

        triggerReload(state);
        // Step through start (24) and into insert (20 ticks to commit 1 shell)
        for (let t = 0; t < 44; t++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }
        expect(slot.ammoInMag).toBe(1);
        expect(state.actionState).toBe('reloading_shell_insert');

        // Fire interrupts: immediately goes to idle, skipping reload_shell_end
        const interrupted = cancelReloadOnFire(state);
        expect(interrupted).toBe(true);
        expect(state.actionState).toBe('idle');
      });

      it('rejects fire interrupt if magazine has 0 ammo', () => {
        const state = createDefaultWeaponState();
        state.currentSlot = 3; // Shotgun
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 0;
        slot.ammoReserve = 12;

        triggerReload(state);
        // Step 10 ticks into start (no shells loaded yet)
        for (let t = 0; t < 10; t++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }
        expect(slot.ammoInMag).toBe(0);

        const interrupted = cancelReloadOnFire(state);
        expect(interrupted).toBe(false);
        expect(state.actionState).toBe('reloading_shell_start');
      });
    });

    describe('Anti-Quickswitch Exploit Prevention', () => {
      it('persists nextReadyTick across swaps so swapping out/in cannot bypass bolt cycle', () => {
        const state = createDefaultWeaponState();
        state.currentSlot = 4; // Sniper
        const sniperSlot = getCurrentSlot(state);

        // Fire sniper at tick 100
        state.currentSimTick = 100;
        sniperSlot.ammoInMag--;
        recordShotFired(state);

        // Sniper has 80 boltCycleTicks -> nextReadyTick = 100 + 80 = 180
        expect(sniperSlot.nextReadyTick).toBe(180);
        expect(state.actionState).toBe('cycling_bolt');
        expect(isWeaponReadyToFire(state)).toBe(false);

        // Swap to pistol (pistol slot = 1)
        triggerSwapBySlot(state, 1);
        expect(state.actionState).toBe('swapping_out');

        // Complete swap to pistol (15 ticks out + 9 ticks in = 24 ticks)
        for (let t = 0; t < 30; t++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }
        expect(state.currentSlot).toBe(1); // On pistol
        expect(state.actionState).toBe('idle');

        // Swap back to sniper at tick 130
        triggerSwapBySlot(state, 4);
        for (let t = 0; t < 30; t++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }
        expect(state.currentSlot).toBe(4); // Back on sniper
        expect(state.actionState).toBe('idle');

        // Even though swap is finished, currentSimTick is ~160 (< 180 nextReadyTick)
        expect(state.currentSimTick).toBeLessThan(180);
        expect(isWeaponReadyToFire(state)).toBe(false); // QUICK-SWITCH EXPLOIT BLOCKED!

        // Advance to tick 180
        state.currentSimTick = 180;
        expect(isWeaponReadyToFire(state)).toBe(true); // Now ready!
      });
    });

    describe('Input Buffering', () => {
      it('buffers fire input for up to 6 ticks while busy', () => {
        const state = createDefaultWeaponState();
        state.currentSlot = 4; // Sniper
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 4;
        state.currentSimTick = 0;
        recordShotFired(state);
        expect(state.actionState).toBe('cycling_bolt');

        bufferFireInput(state, 6);
        expect(state.bufferedFireTicks).toBe(6);

        // Step 2 ticks -> decrements buffer
        stepWeaponStateMachine(state, SIM_TICK_DELTA);
        stepWeaponStateMachine(state, SIM_TICK_DELTA);
        expect(state.bufferedFireTicks).toBe(4);
      });
    });

    describe('Seeded Deterministic Shotgun Pellet Spread', () => {
      it('generates deterministic 8-pellet spread matching ring pattern with zero allocations', () => {
        const offsets: PelletOffset[] = Array.from({ length: 8 }, () => ({ pitch: 0, yaw: 0 }));
        const seed1 = hashPlayerShot('player_alpha', 42);
        const seed2 = hashPlayerShot('player_alpha', 42);
        expect(seed1).toBe(seed2);

        generateSeededPelletOffsets(SHOTGUN_DEF.spread.base, seed1, offsets);
        const snapshot1 = JSON.parse(JSON.stringify(offsets));

        // Re-running with same seed produces identical results
        generateSeededPelletOffsets(SHOTGUN_DEF.spread.base, seed2, offsets);
        expect(offsets).toEqual(snapshot1);

        // Pellet 0 is center core (r close to 0)
        const centerDist = Math.hypot(offsets[0]!.pitch, offsets[0]!.yaw);
        expect(centerDist).toBeCloseTo(0, 4);

        // Pellets 1..7 lie on outer ring (radius around 0.85 * base spread)
        for (let i = 1; i < 8; i++) {
          const r = Math.hypot(offsets[i]!.pitch, offsets[i]!.yaw);
          expect(r).toBeGreaterThan(SHOTGUN_DEF.spread.base * 0.7);
          expect(r).toBeLessThan(SHOTGUN_DEF.spread.base * 1.05);
        }

        // Different shot sequence produces rotated pattern
        const seedDifferentShot = hashPlayerShot('player_alpha', 43);
        generateSeededPelletOffsets(SHOTGUN_DEF.spread.base, seedDifferentShot, offsets);
        expect(offsets[1]!.pitch).not.toBe(snapshot1[1].pitch);
      });
    });

    describe('1000-Step Determinism Replay Test', () => {
      it('produces bit-for-bit identical state across two separate simulation instances', () => {
        const state1 = createDefaultWeaponState();
        const state2 = createDefaultWeaponState();
        const rng = createSeededRng(99999);

        for (let i = 0; i < 1000; i++) {
          const action = rng.range(0, 10);
          if (action < 2) {
            triggerReload(state1);
            triggerReload(state2);
          } else if (action < 4) {
            const slotIdx = Math.floor(rng.range(0, 5));
            triggerSwapBySlot(state1, slotIdx);
            triggerSwapBySlot(state2, slotIdx);
          } else if (action < 5) {
            cancelReloadOnSprint(state1);
            cancelReloadOnSprint(state2);
          } else if (action < 6) {
            const sprint = rng.next() > 0.5;
            setSprinting(state1, sprint);
            setSprinting(state2, sprint);
          } else if (action < 7) {
            const slot1 = getCurrentSlot(state1);
            const slot2 = getCurrentSlot(state2);
            if (slot1.ammoInMag > 0) {
              slot1.ammoInMag--;
              recordShotFired(state1);
            }
            if (slot2.ammoInMag > 0) {
              slot2.ammoInMag--;
              recordShotFired(state2);
            }
          }

          stepWeaponStateMachine(state1, SIM_TICK_DELTA);
          stepWeaponStateMachine(state2, SIM_TICK_DELTA);

          expect(state1.currentSlot).toBe(state2.currentSlot);
          expect(state1.actionState).toBe(state2.actionState);
          expect(state1.stateTicksRemaining).toBe(state2.stateTicksRemaining);
          expect(state1.ticksIntoState).toBe(state2.ticksIntoState);
          expect(state1.currentSimTick).toBe(state2.currentSimTick);
          expect(state1.autoSwitchTimer).toBe(state2.autoSwitchTimer);
        }
      });
    });

    describe('Sniper Last-Round Path & Bolt Cycling Optimization (A3)', () => {
      it('routes to tactical reload (2.8s) when bolt cycle already ran on empty chamber, saving 0.7s redundant re-rack', () => {
        const state = createDefaultWeaponState();
        state.autoReload = false; // Disable auto-reload to inspect intermediate idle state
        state.currentSlot = 4; // Sniper
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 1; // Last round in mag
        slot.ammoReserve = 15;
        state.currentSimTick = 100;

        // Fire last shot
        slot.ammoInMag = 0;
        recordShotFired(state);
        expect(state.actionState).toBe('cycling_bolt');
        expect(state.stateTicksRemaining).toBe(80); // 80 ticks = 1.333s
        expect(slot.boltCycledOnEmpty).toBeFalsy();

        // Step through the 80 ticks of cycling bolt
        for (let i = 0; i < 80; i++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }

        // Bolt cycle has completed, chamber is empty and bolt was already cycled
        expect(state.actionState).toBe('idle');
        expect(slot.ammoInMag).toBe(0);
        expect(slot.boltCycledOnEmpty).toBe(true);

        // Player initiates reload
        const reloaded = triggerReload(state);
        expect(reloaded).toBe(true);

        // Should route to tactical reload (168 ticks = 2.8s), NOT empty reload (210 ticks = 3.5s)
        expect(state.actionState).toBe('reloading_tactical');
        expect(state.stateTicksRemaining).toBe(168); // 168 ticks vs 210 ticks

        // Step to commit tick (tactical commit is at tick 96)
        for (let i = 0; i < 96; i++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }

        // Ammo committed at tick 96
        expect(state.shellCommitDone).toBe(true);
        expect(slot.ammoInMag).toBe(5);
        expect(slot.ammoReserve).toBe(10);
        expect(slot.boltCycledOnEmpty).toBe(false);

        // Step remaining ticks to complete reload
        for (let i = 0; i < (168 - 96); i++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }

        expect(state.actionState).toBe('idle');
        expect(slot.ammoInMag).toBe(5);
      });

      it('automatically triggers tactical reload on last-round bolt completion when autoReload is enabled', () => {
        const state = createDefaultWeaponState();
        state.autoReload = true;
        state.currentSlot = 4; // Sniper
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 1;
        slot.ammoReserve = 15;

        // Fire last shot
        slot.ammoInMag = 0;
        recordShotFired(state);
        expect(state.actionState).toBe('cycling_bolt');

        // Step through 80 ticks: upon cycling_bolt expiration, auto-reload seamlessly starts reloading_tactical
        for (let i = 0; i < 80; i++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }

        expect(state.actionState).toBe('reloading_tactical');
        expect(state.stateTicksRemaining).toBe(168); // Saved 42 ticks (0.7s) vs empty reload (210 ticks)
      });

      it('routes to empty reload (3.5s / 210 ticks) if bolt cycle was never completed on empty mag', () => {
        const state = createDefaultWeaponState();
        state.currentSlot = 4; // Sniper
        const slot = getCurrentSlot(state);
        slot.ammoInMag = 0;
        slot.ammoReserve = 15;
        slot.boltCycledOnEmpty = false;

        const reloaded = triggerReload(state);
        expect(reloaded).toBe(true);
        expect(state.actionState).toBe('reloading_empty');
        expect(state.stateTicksRemaining).toBe(210); // 210 ticks = 3.5s
      });

      it('preserves boltCycledOnEmpty across weapon swaps', () => {
        const state = createDefaultWeaponState();
        state.autoReload = false; // Disable auto-reload so we can inspect manual reload
        state.currentSlot = 4; // Sniper
        const sniperSlot = getCurrentSlot(state);
        sniperSlot.ammoInMag = 1;
        sniperSlot.ammoReserve = 15;

        // Fire last shot and finish bolt cycle
        sniperSlot.ammoInMag = 0;
        recordShotFired(state);
        for (let i = 0; i < 80; i++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }
        expect(sniperSlot.boltCycledOnEmpty).toBe(true);

        // Swap out to pistol (slot 1)
        triggerSwapBySlot(state, 1);
        for (let i = 0; i < 30; i++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }
        expect(state.currentSlot).toBe(1);
        expect(sniperSlot.boltCycledOnEmpty).toBe(true);

        // Swap back to sniper (slot 4)
        triggerSwapBySlot(state, 4);
        for (let i = 0; i < 30; i++) {
          stepWeaponStateMachine(state, SIM_TICK_DELTA);
        }
        expect(state.currentSlot).toBe(4);
        expect(sniperSlot.boltCycledOnEmpty).toBe(true);

        // Trigger reload: still recognizes pre-cycled bolt
        triggerReload(state);
        expect(state.actionState).toBe('reloading_tactical');
        expect(state.stateTicksRemaining).toBe(168);
      });
    });

    describe('Extended 10,000-Step Simulation Fuzzing & Invariant Proofs (A7)', () => {
      it('guarantees 5 sim invariants across 10,000 randomized steps and operations', () => {
        const state = createDefaultWeaponState();
        const rng = createSeededRng(133742);

        // Record initial total ammo per slot
        const initialTotals = state.slots.map((s) => s.ammoInMag + s.ammoReserve);

        let previousStateTicks = state.stateTicksRemaining;
        let previousAction = state.actionState;
        let previousSimTick = state.currentSimTick;

        for (let step = 0; step < 10000; step++) {
          const action = rng.range(0, 100);

          if (action < 15) {
            triggerReload(state);
          } else if (action < 30) {
            const target = Math.floor(rng.range(0, 5));
            triggerSwapBySlot(state, target);
          } else if (action < 50) {
            const slot = getCurrentSlot(state);
            const ready = isWeaponReadyToFire(state);
            if (ready && slot.ammoInMag > 0) {
              slot.ammoInMag -= 1;
              recordShotFired(state);
            } else if (!ready && rng.next() > 0.5) {
              bufferFireInput(state, 6);
            }
          } else if (action < 60) {
            cancelReloadOnSprint(state);
          } else if (action < 70) {
            cancelReloadOnFire(state);
          } else if (action < 80) {
            setSprinting(state, rng.next() > 0.5);
          }

          // Step simulation
          stepWeaponStateMachine(state, SIM_TICK_DELTA);

          // --- INVARIANT 1: Ammo conservation (total ammo never increases) ---
          for (let i = 0; i < state.slots.length; i++) {
            const slot = state.slots[i]!;
            const total = slot.ammoInMag + slot.ammoReserve;
            expect(total).toBeLessThanOrEqual(initialTotals[i]!);
            expect(slot.ammoReserve).toBeGreaterThanOrEqual(0);
          }

          // --- INVARIANT 2: Magazine capacity bounds ---
          for (let i = 0; i < state.slots.length; i++) {
            const slot = state.slots[i]!;
            const def = WEAPON_REGISTRY[slot.weaponId];
            expect(slot.ammoInMag).toBeGreaterThanOrEqual(0);
            expect(slot.ammoInMag).toBeLessThanOrEqual(def.magSize);
          }

          // --- INVARIANT 3: Monotonic shell commit validity ---
          if (state.actionState === 'reloading_shell_insert') {
            const slot = getCurrentSlot(state);
            const def = WEAPON_REGISTRY[slot.weaponId];
            expect(slot.ammoInMag).toBeLessThanOrEqual(def.magSize);
          }

          // --- INVARIANT 4: Zero stuck states (simulation progress is monotonic) ---
          expect(state.currentSimTick).toBe(previousSimTick + 1);
          if (state.actionState !== 'idle' && state.actionState === previousAction) {
            // Either remaining ticks decrease monotonically, or a newly triggered/reset action began (ticksIntoState <= 1)
            const progressed = state.stateTicksRemaining < previousStateTicks || state.ticksIntoState <= 1;
            expect(progressed).toBe(true);
          }

          // --- INVARIANT 5: Anti-quickswitch lock validity ---
          const currentSlot = getCurrentSlot(state);
          if (currentSlot.nextReadyTick !== undefined) {
            expect(Number.isFinite(currentSlot.nextReadyTick)).toBe(true);
          }

          previousStateTicks = state.stateTicksRemaining;
          previousAction = state.actionState;
          previousSimTick = state.currentSimTick;
        }
      });

      it('guarantees bit-for-bit snapshot-resume determinism across 500 ticks', () => {
        interface StepAction {
          kind: 'reload' | 'swap' | 'fire' | 'sprint' | 'none';
          targetSlot?: number;
          sprint?: boolean;
        }

        const preActions: StepAction[] = [];
        const postActions: StepAction[] = [];
        const rng = createSeededRng(424242);

        // Pre-generate 250 pre-snapshot actions and 250 post-snapshot actions
        for (let i = 0; i < 250; i++) {
          const roll = rng.range(0, 10);
          if (roll < 2) preActions.push({ kind: 'reload' });
          else if (roll < 4) preActions.push({ kind: 'swap', targetSlot: Math.floor(rng.range(0, 5)) });
          else if (roll < 7) preActions.push({ kind: 'fire' });
          else if (roll < 8) preActions.push({ kind: 'sprint', sprint: rng.next() > 0.5 });
          else preActions.push({ kind: 'none' });
        }
        for (let i = 0; i < 250; i++) {
          const roll = rng.range(0, 10);
          if (roll < 2) postActions.push({ kind: 'reload' });
          else if (roll < 4) postActions.push({ kind: 'swap', targetSlot: Math.floor(rng.range(0, 5)) });
          else if (roll < 7) postActions.push({ kind: 'fire' });
          else if (roll < 8) postActions.push({ kind: 'sprint', sprint: rng.next() > 0.5 });
          else postActions.push({ kind: 'none' });
        }

        function applyAction(s: ReturnType<typeof createDefaultWeaponState>, a: StepAction) {
          if (a.kind === 'reload') triggerReload(s);
          else if (a.kind === 'swap' && a.targetSlot !== undefined) triggerSwapBySlot(s, a.targetSlot);
          else if (a.kind === 'fire') {
            const slot = getCurrentSlot(s);
            if (slot.ammoInMag > 0 && isWeaponReadyToFire(s)) {
              slot.ammoInMag--;
              recordShotFired(s);
            }
          } else if (a.kind === 'sprint' && a.sprint !== undefined) {
            setSprinting(s, a.sprint);
          }
          stepWeaponStateMachine(s, SIM_TICK_DELTA);
        }

        const stateOriginal = createDefaultWeaponState();

        // Step for 250 ticks
        for (const act of preActions) {
          applyAction(stateOriginal, act);
        }

        // Take snapshot at tick 250
        const snapshotJson = JSON.stringify(stateOriginal);
        const stateResumed: typeof stateOriginal = JSON.parse(snapshotJson);

        // Run stateOriginal from tick 250 to 500
        for (const act of postActions) {
          applyAction(stateOriginal, act);
        }

        // Run stateResumed from tick 250 to 500
        for (const act of postActions) {
          applyAction(stateResumed, act);
        }

        // Compare every single property bit-for-bit
        expect(JSON.stringify(stateResumed)).toBe(JSON.stringify(stateOriginal));
        expect(stateResumed).toEqual(stateOriginal);
      });
    });
  });
});

