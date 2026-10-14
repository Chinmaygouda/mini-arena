/**
 * Simulation input and state interfaces.
 * Zero external imports.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerInput {
  seq: number;
  tick: number;
  moveForward: number; // -1 (back), 0, +1 (forward)
  moveRight: number; // -1 (left), 0, +1 (right)
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  yaw: number; // radians (rotation around Y)
  pitch: number; // radians (look up/down)
}

export interface PlayerSimState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  isGrounded: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
}

export interface ICollisionWorld {
  /**
   * Computes collision-corrected displacement for the player capsule.
   */
  computeMovement(
    currentPos: Vec3,
    desiredDelta: Vec3,
    isCrouching: boolean,
  ): {
    delta: Vec3;
    grounded: boolean;
  };

  /**
   * Checks whether the player has clearance to stand up from crouch.
   */
  canStandUp?(currentPos: Vec3): boolean;
}
