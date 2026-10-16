import { Vec3 } from '../types';
import { GRENADE_DEFS, GRENADE_TYPES_ORDER } from './definitions';
import {
  ActiveGrenade,
  ActiveSmokeVolume,
  FlashBlindResult,
  GrenadeBlastDamageResult,
  GrenadeInventory,
  GrenadeType,
  HitTarget,
  IGrenadeCollisionWorld,
  ThrowActionState,
} from './types';

// Preallocated scratch vectors for deterministic zero-allocation simulation
const _delta = { x: 0, y: 0, z: 0 };
const _dir = { x: 0, y: 0, z: 0 };
const _blastToTarget = { x: 0, y: 0, z: 0 };
const _targetTorso = { x: 0, y: 0, z: 0 };
const _targetHead = { x: 0, y: 0, z: 0 };

/**
 * Steps an active grenade projectile by one fixed simulation tick (1/60s).
 * Enforces continuous sphere-cast collision detection to prevent wall tunneling.
 */
export function stepGrenadePhysics(
  grenade: ActiveGrenade,
  world: IGrenadeCollisionWorld,
  dt = 1 / 60,
): { detonated: boolean; bounced: boolean } {
  if (grenade.fuseRemaining <= 0) {
    return { detonated: true, bounced: false };
  }

  const def = GRENADE_DEFS[grenade.type];
  let bounced = false;

  if (!grenade.isAtRest) {
    // 1. Gravity acceleration
    grenade.vel.y -= def.gravity * dt;

    // 2. Continuous Collision Detection (CCD)
    _delta.x = grenade.vel.x * dt;
    _delta.y = grenade.vel.y * dt;
    _delta.z = grenade.vel.z * dt;

    const dist = Math.sqrt(_delta.x * _delta.x + _delta.y * _delta.y + _delta.z * _delta.z);

    if (dist > 1e-6) {
      _dir.x = _delta.x / dist;
      _dir.y = _delta.y / dist;
      _dir.z = _delta.z / dist;

      const hit = world.sphereCast(grenade.pos, _dir, dist, def.radius);

      if (hit && hit.hit) {
        bounced = true;
        grenade.bounces++;

        // Place at collision contact surface with radius offset
        grenade.pos.x = hit.point.x + hit.normal.x * (def.radius + 0.002);
        grenade.pos.y = hit.point.y + hit.normal.y * (def.radius + 0.002);
        grenade.pos.z = hit.point.z + hit.normal.z * (def.radius + 0.002);

        // Decompose velocity into normal and tangential components
        const vDotN = grenade.vel.x * hit.normal.x + grenade.vel.y * hit.normal.y + grenade.vel.z * hit.normal.z;

        if (vDotN < 0) {
          const vnX = hit.normal.x * vDotN;
          const vnY = hit.normal.y * vDotN;
          const vnZ = hit.normal.z * vDotN;

          const vtX = grenade.vel.x - vnX;
          const vtY = grenade.vel.y - vnY;
          const vtZ = grenade.vel.z - vnZ;

          // Normal rebound with restitution, tangential deceleration with friction
          grenade.vel.x = vtX * def.friction - vnX * def.restitution;
          grenade.vel.y = vtY * def.friction - vnY * def.restitution;
          grenade.vel.z = vtZ * def.friction - vnZ * def.restitution;

          const newSpeedSq =
            grenade.vel.x * grenade.vel.x + grenade.vel.y * grenade.vel.y + grenade.vel.z * grenade.vel.z;

          // Settle to rest if speed is low and surface is floor-like (normal.y > 0.65)
          if (newSpeedSq < 0.25 * 0.25 && hit.normal.y > 0.65) {
            grenade.isAtRest = true;
            grenade.vel.x = 0;
            grenade.vel.y = 0;
            grenade.vel.z = 0;
          }
        }
      } else {
        // Unobstructed trajectory
        grenade.pos.x += _delta.x;
        grenade.pos.y += _delta.y;
        grenade.pos.z += _delta.z;
      }
    }
  }

  // 3. Advance fuse
  grenade.fuseRemaining--;
  const detonated = grenade.fuseRemaining <= 0;

  return { detonated, bounced };
}

/**
 * Calculates explosive shrapnel damage against all targets within blast radius.
 * Performs line-of-sight checks against torso and head points to respect physical cover.
 */
export function calculateFragBlast(
  blastPos: Vec3,
  throwerId: string,
  targets: HitTarget[],
  world: IGrenadeCollisionWorld,
  def = GRENADE_DEFS.frag,
): GrenadeBlastDamageResult[] {
  const results: GrenadeBlastDamageResult[] = [];

  for (const target of targets) {
    // Torso point: pos.y + 0.9m; Head point: pos.y + 1.55m
    _targetTorso.x = target.torsoPos ? target.torsoPos.x : target.pos.x;
    _targetTorso.y = target.torsoPos ? target.torsoPos.y : target.pos.y + 0.9;
    _targetTorso.z = target.torsoPos ? target.torsoPos.z : target.pos.z;

    _targetHead.x = target.headPos ? target.headPos.x : target.pos.x;
    _targetHead.y = target.headPos ? target.headPos.y : target.pos.y + 1.55;
    _targetHead.z = target.headPos ? target.headPos.z : target.pos.z;

    _blastToTarget.x = _targetTorso.x - blastPos.x;
    _blastToTarget.y = _targetTorso.y - blastPos.y;
    _blastToTarget.z = _targetTorso.z - blastPos.z;

    const dist = Math.sqrt(
      _blastToTarget.x * _blastToTarget.x +
      _blastToTarget.y * _blastToTarget.y +
      _blastToTarget.z * _blastToTarget.z,
    );

    if (dist > def.blastRadius) {
      continue;
    }

    // Check line of sight: target is damaged if EITHER torso OR head has line of sight to blast
    const torsoClear = world.checkLineOfSight(blastPos, _targetTorso);
    const headClear = torsoClear ? true : world.checkLineOfSight(blastPos, _targetHead);

    if (!torsoClear && !headClear) {
      // Completely occluded behind solid cover -> 0 damage
      results.push({
        targetId: target.id,
        damage: 0,
        distance: dist,
        hasLineOfSight: false,
        hitPoint: _targetTorso,
      });
      continue;
    }

    // Linear distance falloff: maxDamage at center down to minDamage at blastRadius
    const fraction = Math.max(0, Math.min(1, dist / def.blastRadius));
    let rawDamage = Math.round(def.maxDamage - (def.maxDamage - def.minDamage) * fraction);

    if (target.id === throwerId) {
      rawDamage = Math.round(rawDamage * def.selfDamageFactor);
    }

    results.push({
      targetId: target.id,
      damage: Math.max(0, rawDamage),
      distance: dist,
      hasLineOfSight: true,
      hitPoint: torsoClear ? _targetTorso : _targetHead,
    });
  }

  return results;
}

/**
 * Calculates stun/blind duration and intensity from a flashbang detonation.
 * Takes into account distance, look angle (facing vs looking away), and solid cover.
 */
export function calculateFlashBlindness(
  blastPos: Vec3,
  player: { id: string; eyePos: Vec3; lookDir: Vec3 },
  world: IGrenadeCollisionWorld,
  def = GRENADE_DEFS.flash,
): FlashBlindResult {
  const dx = blastPos.x - player.eyePos.x;
  const dy = blastPos.y - player.eyePos.y;
  const dz = blastPos.z - player.eyePos.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist > def.blastRadius) {
    return { targetId: player.id, blindFraction: 0, durationTicks: 0, angleDeg: 180, hasLineOfSight: false };
  }

  // Cover occlusion check
  const hasLOS = world.checkLineOfSight(player.eyePos, blastPos);
  if (!hasLOS) {
    return { targetId: player.id, blindFraction: 0, durationTicks: 0, angleDeg: 180, hasLineOfSight: false };
  }

  // Angle check: angle between player look direction and vector to blast
  const toBlastX = dx / dist;
  const toBlastY = dy / dist;
  const toBlastZ = dz / dist;

  const dot = player.lookDir.x * toBlastX + player.lookDir.y * toBlastY + player.lookDir.z * toBlastZ;
  const clampedDot = Math.max(-1, Math.min(1, dot));
  const angleRad = Math.acos(clampedDot);
  const angleDeg = (angleRad * 180) / Math.PI;

  const distFactor = Math.max(0, 1.0 - dist / def.blastRadius);

  // Facing flash (< 45 deg) = full blinding effect
  // Peripheral (45 - 90 deg) = partial blinding
  // Looking away (> 90 deg) = reduced concussive disorientation (25% max intensity)
  let angleFactor = 0.25;
  if (angleDeg < 45) {
    angleFactor = 1.0;
  } else if (angleDeg < 90) {
    angleFactor = 1.0 - (angleDeg - 45) / 45 * 0.75; // blends from 1.0 to 0.25
  }

  const blindFraction = Math.min(1.0, distFactor * angleFactor);
  const durationTicks = Math.round(def.flashDurationTicks * blindFraction);

  return {
    targetId: player.id,
    blindFraction,
    durationTicks,
    angleDeg,
    hasLineOfSight: true,
  };
}

/**
 * Checks if a line of sight between two world positions intersects any active spherical smoke volumes.
 * Pure deterministic spatial query used by bots and visibility checks.
 */
export function isLineBlockedBySmoke(
  from: Vec3,
  to: Vec3,
  smokeVolumes: ActiveSmokeVolume[],
): boolean {
  if (smokeVolumes.length === 0) return false;

  const segX = to.x - from.x;
  const segY = to.y - from.y;
  const segZ = to.z - from.z;
  const segLenSq = segX * segX + segY * segY + segZ * segZ;

  if (segLenSq < 1e-6) return false;

  for (const smoke of smokeVolumes) {
    if (smoke.durationRemaining <= 0) continue;

    // Vector from line start to sphere center
    const toCenterX = smoke.center.x - from.x;
    const toCenterY = smoke.center.y - from.y;
    const toCenterZ = smoke.center.z - from.z;

    // Projection scalar t along line segment
    const t = Math.max(0, Math.min(1, (toCenterX * segX + toCenterY * segY + toCenterZ * segZ) / segLenSq));

    // Closest point on segment
    const closeX = from.x + segX * t;
    const closeY = from.y + segY * t;
    const closeZ = from.z + segZ * t;

    const distSq =
      (smoke.center.x - closeX) * (smoke.center.x - closeX) +
      (smoke.center.y - closeY) * (smoke.center.y - closeY) +
      (smoke.center.z - closeZ) * (smoke.center.z - closeZ);

    if (distSq <= smoke.radius * smoke.radius) {
      return true; // Line passes through smoke sphere
    }
  }

  return false;
}

/**
 * Cycles the selected grenade type forward among available types.
 */
export function cycleGrenadeType(inventory: GrenadeInventory): GrenadeType {
  const currentIndex = GRENADE_TYPES_ORDER.indexOf(inventory.selectedType);
  for (let i = 1; i <= GRENADE_TYPES_ORDER.length; i++) {
    const nextType = GRENADE_TYPES_ORDER[(currentIndex + i) % GRENADE_TYPES_ORDER.length]!;
    if (inventory.counts[nextType] > 0) {
      inventory.selectedType = nextType;
      return nextType;
    }
  }
  // If none have counts, keep current
  return inventory.selectedType;
}

/**
 * Initiates grenade windup action if grenade count > 0 and cooldown expired.
 */
export function startGrenadeWindUp(inventory: GrenadeInventory): ThrowActionState | null {
  if (inventory.cooldownRemaining > 0) return null;
  if (inventory.counts[inventory.selectedType] <= 0) return null;

  const def = GRENADE_DEFS[inventory.selectedType];
  return {
    isWindingUp: true,
    windUpTicksRemaining: def.windUpTicks,
    type: inventory.selectedType,
  };
}

/**
 * Steps the throw windup timer.
 * Cancels if player sprints or swaps weapons before release tick.
 */
export function stepGrenadeWindUp(
  state: ThrowActionState,
  isSprinting: boolean,
  isSwapping: boolean,
): { released: boolean; cancelled: boolean } {
  if (!state.isWindingUp) {
    return { released: false, cancelled: false };
  }

  // Cancel condition: sprinting or weapon swapping before release tick
  if (isSprinting || isSwapping) {
    state.isWindingUp = false;
    return { released: false, cancelled: true };
  }

  state.windUpTicksRemaining--;
  if (state.windUpTicksRemaining <= 0) {
    state.isWindingUp = false;
    return { released: true, cancelled: false };
  }

  return { released: false, cancelled: false };
}

/**
 * Spawns a new active grenade projectile along the player's look heading.
 */
export function createGrenadeProjectile(
  id: number,
  type: GrenadeType,
  throwerId: string,
  eyePos: Vec3,
  yaw: number,
  pitch: number,
): ActiveGrenade {
  const def = GRENADE_DEFS[type];

  // Spherical forward vector
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);

  const forwardX = -sinYaw * cosPitch;
  const forwardY = sinPitch;
  const forwardZ = -cosYaw * cosPitch;

  return {
    id,
    type,
    throwerId,
    pos: {
      x: eyePos.x + forwardX * 0.4,
      y: eyePos.y + forwardY * 0.4 - 0.1,
      z: eyePos.z + forwardZ * 0.4,
    },
    vel: {
      x: forwardX * def.throwSpeed,
      y: (forwardY + 0.15) * def.throwSpeed, // slight upward arc
      z: forwardZ * def.throwSpeed,
    },
    fuseRemaining: def.fuseTicks,
    isAtRest: false,
    bounces: 0,
  };
}
