import { SeededRng } from '../rng';
import { WeaponDef } from './types';

export interface StanceState {
  isMoving: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  isADS: boolean;
}

export interface FireTimingState {
  fireAccumulator: number;
  shotsFiredInBurst: number;
  timeSinceLastShot: number;
}

export function createFireTimingState(): FireTimingState {
  return {
    fireAccumulator: 0,
    shotsFiredInBurst: 0,
    timeSinceLastShot: 999.0, // Ready to fire immediately
  };
}

/**
 * Calculates deterministic damage with linear falloff and headshot multiplier.
 */
export function calculateDamage(
  weapon: WeaponDef,
  distanceMeters: number,
  isHeadshot: boolean,
): number {
  const { startDist, endDist, minDamage } = weapon.damageFalloff;
  const baseDamage = weapon.damageBase;

  let damage: number;
  if (distanceMeters <= startDist) {
    damage = baseDamage;
  } else if (distanceMeters >= endDist) {
    damage = minDamage;
  } else {
    // Linear interpolation between startDist and endDist
    const t = (distanceMeters - startDist) / (endDist - startDist);
    damage = baseDamage - t * (baseDamage - minDamage);
  }

  if (isHeadshot) {
    damage *= weapon.headshotMultiplier;
  }

  return Math.round(damage * 10) / 10;
}

/**
 * Calculates effective bullet spread cone half-angle (in radians) given player stance.
 */
export function computeEffectiveSpread(weapon: WeaponDef, stance: StanceState): number {
  let spread = weapon.spread.base;

  if (stance.isSprinting) {
    spread *= weapon.spread.sprintMultiplier;
  } else if (stance.isMoving) {
    spread *= weapon.spread.moveMultiplier;
  }

  if (stance.isCrouching) {
    spread *= weapon.spread.crouchMultiplier;
  }

  if (stance.isADS) {
    spread *= weapon.spread.adsMultiplier;
  }

  return spread;
}

/**
 * Generates deterministic pitch and yaw bullet spread offsets from a cone half-angle using seeded PRNG.
 */
export function sampleSpreadOffsets(
  spreadHalfAngle: number,
  rng: SeededRng,
): { pitchOffset: number; yawOffset: number } {
  if (spreadHalfAngle <= 0.00001) {
    return { pitchOffset: 0, yawOffset: 0 };
  }

  // Uniform distribution within circular cross-section
  const r = Math.sqrt(rng.next()) * spreadHalfAngle;
  const theta = rng.range(0, Math.PI * 2);

  return {
    pitchOffset: r * Math.sin(theta),
    yawOffset: r * Math.cos(theta),
  };
}

/**
 * Steps the fractional fire accumulator by fixed dt.
 * Fractional accumulator guarantees that weapon RPM is accurate across any fire rate at 60 Hz.
 */
export function stepFireTiming(state: FireTimingState, dt: number, weapon: WeaponDef): void {
  const shotInterval = 60 / weapon.rpm;
  state.fireAccumulator = Math.min(state.fireAccumulator + dt, shotInterval * 2);
  state.timeSinceLastShot += dt;

  // Reset recoil burst counter if firing stopped longer than resetTime
  if (state.timeSinceLastShot >= weapon.recoil.resetTime) {
    state.shotsFiredInBurst = 0;
  }
}

/**
 * Attempts to consume one shot from the fractional fire accumulator.
 * Returns true if a shot was fired.
 */
export function tryConsumeShot(state: FireTimingState, weapon: WeaponDef): boolean {
  const shotInterval = 60 / weapon.rpm;

  // Small epsilon tolerance (1 microsecond) for floating point precision
  if (state.fireAccumulator + 1e-6 >= shotInterval) {
    state.fireAccumulator -= shotInterval;
    state.shotsFiredInBurst++;
    state.timeSinceLastShot = 0;
    return true;
  }

  return false;
}
