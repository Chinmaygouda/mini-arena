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
  cancelReloadOnSprint,
  cancelReloadOnFire,
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
    it('loads shells incrementally and pumps first shell when empty', () => {
      const state = createDefaultWeaponState();
      state.currentSlot = 3; // Shotgun slot
      const slot = getCurrentSlot(state);
      slot.ammoInMag = 0;
      slot.ammoReserve = 12;

      // Trigger reload from empty: initial pump delay is reloadTimeEmpty (0.75s)
      const started = triggerReload(state);
      expect(started).toBe(true);
      expect(state.actionState).toBe('reloading_shell');
      expect(state.stateTimer).toBe(SHOTGUN_DEF.reloadTimeEmpty);

      // Advance by 0.75s: 1st shell inserted
      stepWeaponStateMachine(state, SHOTGUN_DEF.reloadTimeEmpty);
      expect(slot.ammoInMag).toBe(1);
      expect(slot.ammoReserve).toBe(11);
      // Automatically transitions to loading 2nd shell at shellReloadTime (0.55s)
      expect(state.actionState).toBe('reloading_shell');
      expect(state.stateTimer).toBe(SHOTGUN_DEF.shellReloadTime);

      // Advance by 0.55s: 2nd shell inserted
      stepWeaponStateMachine(state, SHOTGUN_DEF.shellReloadTime!);
      expect(slot.ammoInMag).toBe(2);
      expect(slot.ammoReserve).toBe(10);
      expect(state.actionState).toBe('reloading_shell');
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
});
