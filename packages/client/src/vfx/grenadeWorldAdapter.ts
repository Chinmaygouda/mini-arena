import RAPIER from '@dimforge/rapier3d-compat';
import { IGrenadeCollisionWorld, Vec3 } from '@mini-arena/shared';

export class RapierGrenadeWorldAdapter implements IGrenadeCollisionWorld {
  private world: RAPIER.World;
  private raw: typeof RAPIER;
  private ballShape: RAPIER.Ball;
  private playerBody?: RAPIER.RigidBody;
  private scratchRay: RAPIER.Ray;

  constructor(world: RAPIER.World, raw: typeof RAPIER, playerBody?: RAPIER.RigidBody) {
    this.world = world;
    this.raw = raw;
    this.playerBody = playerBody;
    this.ballShape = new this.raw.Ball(0.045);
    this.scratchRay = new this.raw.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  }

  public sphereCast(
    start: Vec3,
    dir: Vec3,
    distance: number,
    radius: number,
  ): { hit: boolean; point: Vec3; normal: Vec3; fraction: number } | null {
    if (distance <= 1e-6) return null;

    // Use Rapier castShape with Ball shape
    const shapePos = { x: start.x, y: start.y, z: start.z };
    const shapeRot = { x: 0, y: 0, z: 0, w: 1 };
    const shapeVel = { x: dir.x * distance, y: dir.y * distance, z: dir.z * distance };

    // Update ball radius if needed
    if (Math.abs(this.ballShape.radius - radius) > 0.005) {
      this.ballShape = new this.raw.Ball(radius);
    }

    const hit = this.world.castShape(
      shapePos,
      shapeRot,
      shapeVel,
      this.ballShape,
      0.0,
      1.0,
      true,
      undefined,
      undefined,
      undefined,
      this.playerBody,
    );

    if (hit && hit.time_of_impact <= 1.0) {
      return {
        hit: true,
        point: {
          x: hit.witness1.x,
          y: hit.witness1.y,
          z: hit.witness1.z,
        },
        normal: {
          x: hit.normal1.x,
          y: hit.normal1.y,
          z: hit.normal1.z,
        },
        fraction: hit.time_of_impact,
      };
    }

    // Fallback: Raycast with radius offset
    this.scratchRay.origin.x = start.x;
    this.scratchRay.origin.y = start.y;
    this.scratchRay.origin.z = start.z;
    this.scratchRay.dir.x = dir.x;
    this.scratchRay.dir.y = dir.y;
    this.scratchRay.dir.z = dir.z;

    const rayHit = this.world.castRayAndGetNormal(
      this.scratchRay,
      distance + radius,
      true,
      undefined,
      undefined,
      undefined,
      this.playerBody,
    );
    if (rayHit && rayHit.timeOfImpact <= distance + radius) {
      const frac = Math.max(0, (rayHit.timeOfImpact - radius) / distance);
      return {
        hit: true,
        point: {
          x: start.x + dir.x * (rayHit.timeOfImpact - radius),
          y: start.y + dir.y * (rayHit.timeOfImpact - radius),
          z: start.z + dir.z * (rayHit.timeOfImpact - radius),
        },
        normal: {
          x: rayHit.normal.x,
          y: rayHit.normal.y,
          z: rayHit.normal.z,
        },
        fraction: Math.min(1.0, frac),
      };
    }

    return null;
  }

  public checkLineOfSight(from: Vec3, to: Vec3): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 1e-4) return true;

    this.scratchRay.origin.x = from.x;
    this.scratchRay.origin.y = from.y;
    this.scratchRay.origin.z = from.z;
    this.scratchRay.dir.x = dx / dist;
    this.scratchRay.dir.y = dy / dist;
    this.scratchRay.dir.z = dz / dist;

    const hit = this.world.castRay(
      this.scratchRay,
      dist - 0.05,
      true,
      undefined,
      undefined,
      undefined,
      this.playerBody,
    );
    // If any solid collider intervenes before the target, LOS is blocked
    return hit === null;
  }
}
