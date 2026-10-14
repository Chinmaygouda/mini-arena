import RAPIER from '@dimforge/rapier3d-compat';
import { GRAVITY, PLAYER_HEIGHT_STAND, PLAYER_RADIUS } from '@mini-arena/shared';

export interface PhysicsEngine {
  raw: typeof RAPIER;
  world: RAPIER.World;
  controller: RAPIER.KinematicCharacterController;
  playerBody: RAPIER.RigidBody;
  playerCollider: RAPIER.Collider;
  scratchVec: { x: number; y: number; z: number };
}

let isInitialized = false;

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

  // Character controller with smooth autostep, snap-to-ground, and slope sliding
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

  // Player capsule collider (half-height = (totalHeight - 2 * radius) / 2)
  const standHalfHeight = Math.max(0.01, (PLAYER_HEIGHT_STAND - 2 * PLAYER_RADIUS) / 2);
  const playerColliderDesc = RAPIER.ColliderDesc.capsule(standHalfHeight, PLAYER_RADIUS);
  const playerCollider = world.createCollider(playerColliderDesc, playerBody);

  return {
    raw: RAPIER,
    world,
    controller,
    playerBody,
    playerCollider,
    scratchVec: { x: 0, y: 0, z: 0 },
  };
}
