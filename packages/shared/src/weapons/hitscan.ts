import { Vec3 } from '../types';

export type HitboxPart = 'head' | 'body';

export interface TargetHitboxDef {
  id: string;
  position: Vec3; // Base feet position
  headOffset: Vec3; // Center offset of head sphere relative to base
  headRadius: number; // Head sphere radius (typically ~0.20m - 0.24m)
  bodyCenter: Vec3; // Center of body capsule/cylinder
  bodyHalfHeight: number; // Half-height of body cylinder
  bodyRadius: number; // Radius of body cylinder
}

export interface RayHitResult {
  hit: boolean;
  distance: number;
  part: HitboxPart | null;
  hitPoint: Vec3 | null;
}

/**
 * Standard default humanoid hitbox (matches 1.8m tall player capsule).
 * Head: Sphere at y = 1.55m, radius 0.22m.
 * Body: Vertical capsule/cylinder from y = 0.2m to y = 1.35m, radius 0.36m.
 */
export function createHumanoidHitbox(id: string, x = 0, y = 0, z = 0): TargetHitboxDef {
  return {
    id,
    position: { x, y, z },
    headOffset: { x: 0, y: 1.55, z: 0 },
    headRadius: 0.22,
    bodyCenter: { x: 0, y: 0.75, z: 0 },
    bodyHalfHeight: 0.55,
    bodyRadius: 0.36,
  };
}

/**
 * Pure mathematical ray-vs-sphere intersection.
 * Ray: O + t * D where D is normalized.
 */
export function rayIntersectsSphere(
  rayOrigin: Vec3,
  rayDir: Vec3,
  sphereCenter: Vec3,
  radius: number,
  maxDistance: number,
): { hit: boolean; distance: number } {
  const lx = sphereCenter.x - rayOrigin.x;
  const ly = sphereCenter.y - rayOrigin.y;
  const lz = sphereCenter.z - rayOrigin.z;

  const tca = lx * rayDir.x + ly * rayDir.y + lz * rayDir.z;
  if (tca < 0) {
    return { hit: false, distance: Infinity };
  }

  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = radius * radius;
  if (d2 > r2) {
    return { hit: false, distance: Infinity };
  }

  const thc = Math.sqrt(r2 - d2);
  const t0 = tca - thc;
  const t1 = tca + thc;

  const dist = t0 >= 0 ? t0 : t1;
  if (dist >= 0 && dist <= maxDistance) {
    return { hit: true, distance: dist };
  }

  return { hit: false, distance: Infinity };
}

/**
 * Pure mathematical ray-vs-vertical-cylinder/capsule intersection.
 */
export function rayIntersectsVerticalCylinder(
  rayOrigin: Vec3,
  rayDir: Vec3,
  center: Vec3,
  halfHeight: number,
  radius: number,
  maxDistance: number,
): { hit: boolean; distance: number } {
  // Translate to origin
  const ox = rayOrigin.x - center.x;
  const oz = rayOrigin.z - center.z;

  const a = rayDir.x * rayDir.x + rayDir.z * rayDir.z;
  if (a < 1e-8) {
    return { hit: false, distance: Infinity };
  }

  const b = 2 * (ox * rayDir.x + oz * rayDir.z);
  const c = ox * ox + oz * oz - radius * radius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return { hit: false, distance: Infinity };
  }

  const sqrtDisc = Math.sqrt(discriminant);
  const t0 = (-b - sqrtDisc) / (2 * a);
  const t1 = (-b + sqrtDisc) / (2 * a);

  const minY = center.y - halfHeight;
  const maxY = center.y + halfHeight;

  // Check t0 first
  if (t0 >= 0 && t0 <= maxDistance) {
    const hitY = rayOrigin.y + t0 * rayDir.y;
    if (hitY >= minY && hitY <= maxY) {
      return { hit: true, distance: t0 };
    }
  }

  // Check t1
  if (t1 >= 0 && t1 <= maxDistance) {
    const hitY = rayOrigin.y + t1 * rayDir.y;
    if (hitY >= minY && hitY <= maxY) {
      return { hit: true, distance: t1 };
    }
  }

  return { hit: false, distance: Infinity };
}

/**
 * Tests ray intersection against a target dummy / player hitbox.
 * Tests head first (headshot priority), then body.
 * Pure math, zero dependencies, reusable on client and authoritative server.
 */
export function testRayHitbox(
  rayOrigin: Vec3,
  rayDir: Vec3,
  target: TargetHitboxDef,
  maxRange: number,
): RayHitResult {
  // Normalize ray direction
  const dirLen = Math.hypot(rayDir.x, rayDir.y, rayDir.z);
  const ndx = dirLen > 0 ? rayDir.x / dirLen : 0;
  const ndy = dirLen > 0 ? rayDir.y / dirLen : 0;
  const ndz = dirLen > 0 ? rayDir.z / dirLen : -1;
  const normDir: Vec3 = { x: ndx, y: ndy, z: ndz };

  // 1. Test Head Sphere
  const headPos: Vec3 = {
    x: target.position.x + target.headOffset.x,
    y: target.position.y + target.headOffset.y,
    z: target.position.z + target.headOffset.z,
  };

  const headHit = rayIntersectsSphere(
    rayOrigin,
    normDir,
    headPos,
    target.headRadius,
    maxRange,
  );

  // 2. Test Body Cylinder
  const bodyCenter: Vec3 = {
    x: target.position.x + target.bodyCenter.x,
    y: target.position.y + target.bodyCenter.y,
    z: target.position.z + target.bodyCenter.z,
  };

  const bodyHit = rayIntersectsVerticalCylinder(
    rayOrigin,
    normDir,
    bodyCenter,
    target.bodyHalfHeight,
    target.bodyRadius,
    maxRange,
  );

  // If head is hit and is closer or within tolerance of body hit, register headshot
  if (headHit.hit && (!bodyHit.hit || headHit.distance <= bodyHit.distance)) {
    return {
      hit: true,
      distance: headHit.distance,
      part: 'head',
      hitPoint: {
        x: rayOrigin.x + normDir.x * headHit.distance,
        y: rayOrigin.y + normDir.y * headHit.distance,
        z: rayOrigin.z + normDir.z * headHit.distance,
      },
    };
  }

  if (bodyHit.hit) {
    return {
      hit: true,
      distance: bodyHit.distance,
      part: 'body',
      hitPoint: {
        x: rayOrigin.x + normDir.x * bodyHit.distance,
        y: rayOrigin.y + normDir.y * bodyHit.distance,
        z: rayOrigin.z + normDir.z * bodyHit.distance,
      },
    };
  }

  return {
    hit: false,
    distance: Infinity,
    part: null,
    hitPoint: null,
  };
}
