import { Vec3 } from '../types';
import {
  DUMMY_MAX_HEALTH,
  DUMMY_RESPAWN_TICKS,
  MAX_PLAYER_HEALTH,
  RESPAWN_DURATION_TICKS,
  SPAWN_PROTECTION_TICKS,
} from './definitions';
import { DamageEvent, DamageType, DummyTargetVitals, HitPart, PlayerVitalsState } from './types';

/**
 * Applies damage to a player vitals state.
 * Returns the resulting DamageEvent, or null if damage was blocked (e.g. spawn protection or dead).
 */
export function applyPlayerDamage(
  vitals: PlayerVitalsState,
  attackerId: string,
  damageAmount: number,
  damageType: DamageType,
  part: HitPart,
  sourcePos: Vec3,
  playerPos: Vec3,
  currentTick: number,
): DamageEvent | null {
  if (!vitals.isAlive || damageAmount <= 0) {
    return null;
  }

  // Spawn protection absorbs all damage
  if (vitals.spawnProtectionTicksRemaining > 0) {
    return null;
  }

  // Direction pointing from player toward damage source
  const dx = sourcePos.x - playerPos.x;
  const dy = sourcePos.y - playerPos.y;
  const dz = sourcePos.z - playerPos.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const direction: Vec3 = len > 1e-5
    ? { x: dx / len, y: dy / len, z: dz / len }
    : { x: 0, y: 0, z: 1 };

  const finalDamage = Math.min(vitals.health, Math.round(damageAmount));
  vitals.health -= finalDamage;

  const isFatal = vitals.health <= 0;
  if (isFatal) {
    vitals.health = 0;
    vitals.isAlive = false;
    vitals.respawnTicksRemaining = RESPAWN_DURATION_TICKS;
    vitals.deaths++;
  }

  const event: DamageEvent = {
    targetId: vitals.id,
    attackerId,
    damage: finalDamage,
    damageType,
    part,
    isFatal,
    direction,
    tick: currentTick,
  };

  vitals.lastDamageEvent = event;
  return event;
}

/**
 * Steps player vitals by one tick at 60 Hz.
 * Handles spawn protection decay and respawn countdown.
 */
export function stepPlayerVitals(
  vitals: PlayerVitalsState,
): { respawned: boolean } {
  let respawned = false;

  if (vitals.spawnProtectionTicksRemaining > 0) {
    vitals.spawnProtectionTicksRemaining--;
  }

  if (!vitals.isAlive) {
    if (vitals.respawnTicksRemaining > 0) {
      vitals.respawnTicksRemaining--;
    }

    if (vitals.respawnTicksRemaining <= 0) {
      vitals.isAlive = true;
      vitals.health = MAX_PLAYER_HEALTH;
      vitals.spawnProtectionTicksRemaining = SPAWN_PROTECTION_TICKS;
      respawned = true;
    }
  }

  return { respawned };
}

/**
 * Creates an active dummy target vitals instance.
 */
export function createDummyTarget(id: string, pos: Vec3): DummyTargetVitals {
  return {
    id,
    pos: { x: pos.x, y: pos.y, z: pos.z },
    health: DUMMY_MAX_HEALTH,
    maxHealth: DUMMY_MAX_HEALTH,
    isAlive: true,
    respawnTicksRemaining: 0,
  };
}

/**
 * Applies damage to a dummy target.
 */
export function applyDummyDamage(
  dummy: DummyTargetVitals,
  damageAmount: number,
): { damageDealt: number; killed: boolean } {
  if (!dummy.isAlive || damageAmount <= 0) {
    return { damageDealt: 0, killed: false };
  }

  const damageDealt = Math.min(dummy.health, Math.round(damageAmount));
  dummy.health -= damageDealt;

  const killed = dummy.health <= 0;
  if (killed) {
    dummy.health = 0;
    dummy.isAlive = false;
    dummy.respawnTicksRemaining = DUMMY_RESPAWN_TICKS;
  }

  return { damageDealt, killed };
}

/**
 * Steps a dummy target's respawn timer.
 */
export function stepDummyVitals(dummy: DummyTargetVitals): { respawned: boolean } {
  if (!dummy.isAlive) {
    if (dummy.respawnTicksRemaining > 0) {
      dummy.respawnTicksRemaining--;
    }

    if (dummy.respawnTicksRemaining <= 0) {
      dummy.isAlive = true;
      dummy.health = dummy.maxHealth;
      return { respawned: true };
    }
  }

  return { respawned: false };
}
