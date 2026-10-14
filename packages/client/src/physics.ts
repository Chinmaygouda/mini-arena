import RAPIER from '@dimforge/rapier3d-compat';
import {
  GRAVITY,
  ICollisionWorld,
  PLAYER_HEIGHT_CROUCH,
  PLAYER_HEIGHT_STAND,
  PLAYER_RADIUS,
  Vec3,
} from '@mini-arena/shared';

export interface PhysicsEngine {
  raw: typeof RAPIER;
  world: RAPIER.World;
  controller: RAPIER.KinematicCharacterController;
  playerBody: RAPIER.RigidBody;
  standingCollider: RAPIER.Collider;
  crouchingCollider: RAPIER.Collider;
  collisionWorld: ICollisionWorld;
}

let isInitialized = false;

class RapierCollisionWorld implements ICollisionWorld {
  private world: RAPIER.World;
  private controller: RAPIER.KinematicCharacterController;
  private playerBody: RAPIER.RigidBody;
  private standingCollider: RAPIER.Collider;
  private crouchingCollider: RAPIER.Collider;
  private scratchDelta = { x: 0, y: 0, z: 0 };

  constructor(
    world: RAPIER.World,
    controller: RAPIER.KinematicCharacterController,
    playerBody: RAPIER.RigidBody,
    standingCollider: RAPIER.Collider,
    crouchingCollider: RAPIER.Collider,
  ) {
    this.world = world;
    this.controller = controller;
    this.playerBody = playerBody;
    this.standingCollider = standingCollider;
    this.crouchingCollider = crouchingCollider;
  }

  public computeMovement(
    currentPos: Vec3,
    desiredDelta: Vec3,
    isCrouching: boolean,
  ): { delta: Vec3; grounded: boolean } {
    // 1. Position capsule at character center (feet are at currentPos.y)
    // Standing: total height 1.8m -> center is at currentPos.y + 0.9m
    // Crouching: total height 1.2m -> center is at currentPos.y + 0.6m
    const centerOffsetY = isCrouching ? 0.6 : 0.9;
    this.playerBody.setTranslation(
      {
        x: currentPos.x,
        y: currentPos.y + centerOffsetY,
        z: currentPos.z,
      },
      true,
    );

    // 2. Select appropriate collider
    this.standingCollider.setEnabled(!isCrouching);
    this.crouchingCollider.setEnabled(isCrouching);
    const activeCollider = isCrouching ? this.crouchingCollider : this.standingCollider;

    // 3. Step world so broadphase BVH is synchronized with the new body position
    this.world.step();

    // 4. Compute movement using Rapier kinematic controller
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
}

/**
 * Initializes Rapier 3D WASM physics world and player kinematic character controller.
 */
export async function initPhysics(): Promise<PhysicsEngine> {
  if (!isInitialized) {
    await RAPIER.init();
    isInitialized = true;
  }

  const gravity = { x: 0.0, y: GRAVITY, z: 0.0 };
  const world = new RAPIER.World(gravity);

  // Character controller with autostep, snap-to-ground, and slope sliding
  const offset = 0.02;
  const controller = world.createCharacterController(offset);
  controller.setSlideEnabled(true);
  controller.enableAutostep(0.35, 0.2, false); // Autostep up to 0.35m stairs
  controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180); // 45 degree max climb angle
  controller.setMinSlopeSlideAngle((50 * Math.PI) / 180);
  controller.enableSnapToGround(0.3); // Snap to ground distance

  // Player rigid body (kinematic position-based)
  const playerBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 0);
  const playerBody = world.createRigidBody(playerBodyDesc);

  // Standing capsule collider: half-height = 0.5, radius = 0.4 -> total height 1.8m
  const standHalfHeight = Math.max(0.01, (PLAYER_HEIGHT_STAND - 2 * PLAYER_RADIUS) / 2);
  const standingColliderDesc = RAPIER.ColliderDesc.capsule(standHalfHeight, PLAYER_RADIUS);
  const standingCollider = world.createCollider(standingColliderDesc, playerBody);

  // Crouching capsule collider: half-height = 0.2, radius = 0.4 -> total height 1.2m
  const crouchHalfHeight = Math.max(0.01, (PLAYER_HEIGHT_CROUCH - 2 * PLAYER_RADIUS) / 2);
  const crouchingColliderDesc = RAPIER.ColliderDesc.capsule(crouchHalfHeight, PLAYER_RADIUS);
  const crouchingCollider = world.createCollider(crouchingColliderDesc, playerBody);
  crouchingCollider.setEnabled(false);

  const collisionWorld = new RapierCollisionWorld(
    world,
    controller,
    playerBody,
    standingCollider,
    crouchingCollider,
  );

  return {
    raw: RAPIER,
    world,
    controller,
    playerBody,
    standingCollider,
    crouchingCollider,
    collisionWorld,
  };
}
