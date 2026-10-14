import { describe, expect, it } from 'vitest';
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
  triggerReload,
  triggerSwap,
  tryConsumeShot,
  cancelReloadOnSprint,
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
      it(`maintains accurate RPM within ±1% over 10.0 seconds at 60 Hz for ${name} (${rpm} RPM)`, () => {
        const fireState = createFireTimingState();
        const durationSec = 10.0;
        const totalTicks = Math.round(durationSec / SIM_TICK_DELTA); // 600 ticks
        const shotInterval = 60 / rpm;
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

        // 1. Cycle rate: exact rate between first and last shot
        if (shotTimes.length >= 2) {
          const firstShot = shotTimes[0]!;
          const lastShot = shotTimes[shotTimes.length - 1]!;
          const cycleDuration = lastShot - firstShot;
          const cycleRpm = ((shotTimes.length - 1) / cycleDuration) * 60;
          const cycleError = Math.abs((cycleRpm - rpm) / rpm) * 100;
          expect(cycleError).toBeLessThanOrEqual(1.0);
        }

        // 2. Continuous rate including remaining fractional accumulator
        const fractionalProgress = fireState.fireAccumulator / shotInterval;
        const totalEffectiveShots = shotsFired + fractionalProgress;
        const continuousRpm = (totalEffectiveShots / durationSec) * 60;
        const continuousError = Math.abs((continuousRpm - rpm) / rpm) * 100;

        expect(continuousError).toBeLessThanOrEqual(1.0);
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
});
