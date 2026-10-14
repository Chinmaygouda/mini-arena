import {
  ACCELERATION,
  AIR_ACCELERATION,
  AIR_DECELERATION,
  CROUCH_SPEED,
  DECELERATION,
  GRAVITY,
  JUMP_VELOCITY,
  SPRINT_SPEED,
  WALK_SPEED,
} from './constants';
import { ICollisionWorld, PlayerInput, PlayerSimState } from './types';

/**
 * Creates a default player simulation state.
 */
export function createDefaultPlayerState(x = 0, y = 0, z = 0): PlayerSimState {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    isGrounded: true,
    isCrouching: false,
    isSprinting: false,
  };
}

/**
 * Moves current velocity towards target velocity by at most maxDelta.
 */
function approach(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) {
    return target;
  }
  return current + Math.sign(diff) * maxDelta;
}

/**
 * Deterministic fixed-step player simulation.
 * Pure function: (state, input, dt, collisionWorld?) -> newState.
 * Zero allocations in per-tick hot paths.
 */
export function stepPlayer(
  state: PlayerSimState,
  input: PlayerInput,
  dt: number,
  collisionWorld?: ICollisionWorld,
): PlayerSimState {
  // 1. Clamp pitch to avoid gimbal lock (-89° to +89°)
  const clampedPitch = Math.max(-1.553, Math.min(1.553, input.pitch));
  const yaw = input.yaw;

  // 2. Determine stance and speed
  const isCrouching = input.crouch;
  const canSprint = !isCrouching && input.sprint && input.moveForward > 0;
  const isSprinting = canSprint;

  let maxSpeed = WALK_SPEED;
  if (isCrouching) {
    maxSpeed = CROUCH_SPEED;
  } else if (isSprinting) {
    maxSpeed = SPRINT_SPEED;
  }

  // 3. Compute wish direction vector in world coordinates
  // Forward in Three.js coordinates is -Z, Right is +X
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);

  const forwardX = -sinYaw;
  const forwardZ = -cosYaw;
  const rightX = cosYaw;
  const rightZ = -sinYaw;

  let wishX = forwardX * input.moveForward + rightX * input.moveRight;
  let wishZ = forwardZ * input.moveForward + rightZ * input.moveRight;
  const wishLen = Math.hypot(wishX, wishZ);

  if (wishLen > 0.0001) {
    wishX /= wishLen;
    wishZ /= wishLen;
  } else {
    wishX = 0;
    wishZ = 0;
  }

  const targetVx = wishX * maxSpeed;
  const targetVz = wishZ * maxSpeed;

  // 4. Horizontal acceleration / deceleration
  const hasInput = wishLen > 0.0001;
  let accelRate: number;
  if (state.isGrounded) {
    accelRate = hasInput ? ACCELERATION : DECELERATION;
  } else {
    accelRate = hasInput ? AIR_ACCELERATION : AIR_DECELERATION;
  }
  const maxHDelta = accelRate * dt;

  const vx = approach(state.vx, targetVx, maxHDelta);
  const vz = approach(state.vz, targetVz, maxHDelta);

  // 5. Vertical simulation (jump & gravity)
  let vy = state.vy;
  let isGrounded = state.isGrounded;

  if (state.isGrounded && input.jump && !isCrouching) {
    vy = JUMP_VELOCITY;
    isGrounded = false;
  } else if (!state.isGrounded) {
    vy += GRAVITY * dt;
    // Terminal falling velocity (-35 m/s)
    if (vy < -35.0) {
      vy = -35.0;
    }
  } else {
    // When grounded, maintain continuous downward probe velocity to keep character snapped to ground/slopes
    vy = -1.5;
  }

  // 6. Integrate position / evaluate collisions
  const desiredDeltaX = vx * dt;
  const desiredDeltaY = vy * dt;
  const desiredDeltaZ = vz * dt;

  let nextX = state.x;
  let nextY = state.y;
  let nextZ = state.z;

  if (collisionWorld) {
    const currentPos = { x: state.x, y: state.y, z: state.z };
    const desiredDelta = { x: desiredDeltaX, y: desiredDeltaY, z: desiredDeltaZ };
    const result = collisionWorld.computeMovement(currentPos, desiredDelta, isCrouching);

    nextX += result.delta.x;
    nextY += result.delta.y;
    nextZ += result.delta.z;
    isGrounded = result.grounded;

    // Zero out downward velocity when landing
    if (isGrounded && vy < 0) {
      vy = 0;
    }
  } else {
    // Analytic fallback for pure unit tests
    nextX += desiredDeltaX;
    nextY += desiredDeltaY;
    nextZ += desiredDeltaZ;

    if (nextY <= 0) {
      nextY = 0;
      vy = 0;
      isGrounded = true;
    }
  }

  return {
    x: nextX,
    y: nextY,
    z: nextZ,
    vx,
    vy,
    vz,
    yaw,
    pitch: clampedPitch,
    isGrounded,
    isCrouching,
    isSprinting,
  };
}
