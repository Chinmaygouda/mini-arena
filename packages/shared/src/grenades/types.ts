import { Vec3 } from '../types';

export type GrenadeType = 'frag' | 'flash' | 'smoke';

export interface GrenadeDef {
  id: GrenadeType;
  name: string;
  fuseTicks: number; // Ticks at 60Hz: frag 150 (2.5s), flash 100 (1.667s), smoke 120 (2.0s)
  throwSpeed: number; // m/s
  gravity: number; // m/s^2
  radius: number; // collision sphere radius (m)
  restitution: number; // coefficient of restitution on bounce (0..1)
  friction: number; // tangential friction coefficient (0..1)
  blastRadius: number; // effective radius in metres
  maxDamage: number; // max blast damage at center
  minDamage: number; // min blast damage at outer edge
  selfDamageFactor: number; // damage multiplier against the thrower
  smokeRadius: number; // smoke cloud radius (m)
  smokeDurationTicks: number; // duration smoke volume remains active
  flashDurationTicks: number; // max blind duration ticks (4.0s = 240 ticks)
  cooldownTicks: number; // cooldown ticks between throws (30 ticks = 0.5s)
  windUpTicks: number; // windup ticks before release (12 ticks = 0.2s)
}

export interface GrenadeInventory {
  counts: Record<GrenadeType, number>;
  selectedType: GrenadeType;
  cooldownRemaining: number;
}

export interface ThrowActionState {
  isWindingUp: boolean;
  windUpTicksRemaining: number;
  type: GrenadeType;
}

export interface ActiveGrenade {
  id: number;
  type: GrenadeType;
  throwerId: string;
  pos: Vec3;
  vel: Vec3;
  fuseRemaining: number;
  isAtRest: boolean;
  bounces: number;
}

export interface ActiveSmokeVolume {
  id: number;
  center: Vec3;
  radius: number;
  durationRemaining: number;
}

export interface HitTarget {
  id: string;
  isDummy?: boolean;
  pos: Vec3; // feet position
  headPos?: Vec3;
  torsoPos?: Vec3;
}

export interface GrenadeBlastDamageResult {
  targetId: string;
  damage: number;
  distance: number;
  hasLineOfSight: boolean;
  hitPoint: Vec3;
}

export interface FlashBlindResult {
  targetId: string;
  blindFraction: number; // 0.0 - 1.0 (whiteout intensity)
  durationTicks: number;
  angleDeg: number;
  hasLineOfSight: boolean;
}

export interface IGrenadeCollisionWorld {
  /**
   * Continuous collision detection query for moving grenade sphere.
   */
  sphereCast(
    start: Vec3,
    dir: Vec3,
    distance: number,
    radius: number,
  ): {
    hit: boolean;
    point: Vec3;
    normal: Vec3;
    fraction: number;
  } | null;

  /**
   * Raycast line of sight between two points (torso/head cover checks).
   * Returns true if clear (no obstructing geometry), false if blocked.
   */
  checkLineOfSight(from: Vec3, to: Vec3): boolean;
}
