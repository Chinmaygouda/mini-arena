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
  private controller: RAPIER.KinematicCharacterController;
  private playerBody: RAPIER.RigidBody;
  private standingCollider: RAPIER.Collider;
  private crouchingCollider: RAPIER.Collider;
  private scratchDelta = { x: 0, y: 0, z: 0 };

  constructor(
    controller: RAPIER.KinematicCharacterController,
    playerBody: RAPIER.RigidBody,
    standingCollider: RAPIER.Collider,
    crouchingCollider: RAPIER.Collider,
  ) {
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
    // 1. Move player body to current physics state position
    this.playerBody.setTranslation(currentPos, true);

    // 2. Select appropriate collider based on stance
    const activeCollider = isCrouching ? this.crouchingCollider : this.standingCollider;

    // 3. Compute collision and slide using Rapier controller
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
  const playerBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2.0, 0);
  const playerBody = world.createRigidBody(playerBodyDesc);

  // Standing capsule collider (total height = 1.8m, half-height = (1.8 - 2*0.4)/2 = 0.5m)
  const standHalfHeight = Math.max(0.01, (PLAYER_HEIGHT_STAND - 2 * PLAYER_RADIUS) / 2);
  const standingColliderDesc = RAPIER.ColliderDesc.capsule(standHalfHeight, PLAYER_RADIUS);
  const standingCollider = world.createCollider(standingColliderDesc, playerBody);

  // Crouching capsule collider (total height = 1.2m, half-height = (1.2 - 2*0.4)/2 = 0.2m)
  const crouchHalfHeight = Math.max(0.01, (PLAYER_HEIGHT_CROUCH - 2 * PLAYER_RADIUS) / 2);
  const crouchingColliderDesc = RAPIER.ColliderDesc.capsule(crouchHalfHeight, PLAYER_RADIUS);
  // Center crouching capsule so feet stay at ground level
  const crouchOffsetY = -(standHalfHeight - crouchHalfHeight);
  crouchingColliderDesc.setTranslation(0, crouchOffsetY, 0);
  // Set crouching collider as disabled by default until selected
  const crouchingCollider = world.createCollider(crouchingColliderDesc, playerBody);
  crouchingCollider.setEnabled(false);

  const collisionWorld = new RapierCollisionWorld(
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
