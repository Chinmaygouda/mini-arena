// src/player/firstPersonControls.ts
// First-Person Controller: Pointer lock, smooth mouse look, WASD movement, jumping,
// stair step-up/step-down, swept AABB collision, and camera recoil integration.

import * as THREE from 'three';

export interface PlayerInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
}

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BoxCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  isWalkable?: boolean;
}

// ── Player & Locomotion constants ──────────────────────────────────────────
export const PLAYER_RADIUS        = 0.35;  // horizontal capsule radius
export const PLAYER_EYE_H         = 1.7;   // eye-level above feet (standing)
export const PLAYER_CROUCH_EYE_H  = 1.0;   // eye-level above feet (crouched)
export const PLAYER_HEAD_M        = 0.15;  // extra margin above eye (total standing 1.85m, crouched 1.15m)
export const STEP_UP_MAX          = 0.45;  // tallest step we autostep onto (~3 stair risers)
export const STEP_DOWN_MAX        = 0.55;  // how far below feet we snap down (smooth descent)
export const GROUND_MARGIN        = 0.04;  // feetY tolerance for ground detection
export const PLAYER_WALK_SPEED    = 4.8;
export const PLAYER_SPRINT_SPEED  = 8.5;
export const PLAYER_CROUCH_SPEED  = 2.4;
export const CROUCH_LERP_SPEED    = 14.0;  // smooth ergonomic crouch transition (~0.18s)

export class FirstPersonControls {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;

  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public isGrounded: boolean = true;
  public isMoving: boolean = false;
  public isSprinting: boolean = false;
  public isCrouching: boolean = false;
  public isCrouchTransitioning: boolean = false;
  public isOverheadBlocked: boolean = false;
  public crouchMode: 'hold' | 'toggle' = 'hold';
  public isCrouchToggled: boolean = false;

  public mouseDelta = { x: 0, y: 0 };
  public isLocked: boolean = false;

  public bounds: MapBounds = { minX: -7.5, maxX: 7.5, minZ: -3.2, maxZ: 5.5 };
  public colliders: BoxCollider[] = [];
  public spawnPoint = { x: 0, y: PLAYER_EYE_H, z: 0, yaw: 0 };
  public oobTimer: number = 0;
  public isOutOfBounds: boolean = false;
  public onOutOfBoundsWarning?: (remainingSec: number) => void;
  public onOutOfBoundsClear?: () => void;

  private yaw: number = 0;
  private pitch: number = 0;
  private cameraRecoilPitch: number = 0;
  private cameraRecoilYaw: number = 0;

  private headBobTimer: number = 0;
  private eyeHeight: number = PLAYER_EYE_H;
  private currentCameraEyeY: number = PLAYER_EYE_H;
  private cameraBobOffset: number = 0;

  private input: PlayerInputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    crouch: false,
  };

  private sensitivity: number = 0.002;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.position = new THREE.Vector3(0, this.eyeHeight, 0);
    this.currentCameraEyeY = this.position.y;
    this.camera.position.copy(this.position);

    this.setupListeners();
  }

  public setBounds(bounds: MapBounds) {
    this.bounds = bounds;
  }

  public setColliders(colliders: BoxCollider[]) {
    this.colliders = colliders;
  }

  public setPosition(x: number, y: number, z: number, yaw: number = 0) {
    this.position.set(x, y || this.eyeHeight, z);
    this.currentCameraEyeY = this.position.y;
    this.cameraBobOffset = 0;
    this.camera.position.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.isGrounded = true;
    this.yaw = yaw;
    this.pitch = 0;
    this.cameraRecoilPitch = 0;
    this.cameraRecoilYaw = 0;
  }

  public setSpawnPoint(x: number, y: number, z: number, yaw: number = 0) {
    this.spawnPoint = { x, y, z, yaw };
  }

  public getHorizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /** Force-release all held keys — call on pointer-lock loss or modal open. */
  public forceReleaseKeys() {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.sprint = false;
    this.input.jump = false;
    this.input.crouch = false;
    this.isCrouchToggled = false;
    this.velocity.x = 0;
    this.velocity.z = 0;
  }

  private setupListeners() {
    if (typeof document === 'undefined') return;
    this.domElement.addEventListener('click', () => {
      if (!this.isLocked) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isLocked) return;
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;

      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': this.input.forward = true; break;
        case 'KeyS': this.input.backward = true; break;
        case 'KeyA': this.input.left = true; break;
        case 'KeyD': this.input.right = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': this.input.sprint = true; break;
        case 'Space': this.input.jump = true; break;
        case 'KeyC':
          this.input.crouch = true;
          this.isCrouchToggled = !this.isCrouchToggled;
          break;
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': this.input.forward = false; break;
        case 'KeyS': this.input.backward = false; break;
        case 'KeyA': this.input.left = false; break;
        case 'KeyD': this.input.right = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': this.input.sprint = false; break;
        case 'Space': this.input.jump = false; break;
        case 'KeyC':
          this.input.crouch = false;
          break;
      }
    });
  }

  public applyCameraRecoil(pitch: number, yaw: number) {
    this.cameraRecoilPitch += pitch;
    this.cameraRecoilYaw += yaw;
  }

  // ── Collision helpers ─────────────────────────────────────────────────────

  /** Returns the highest surface Y at (px, pz) within the collider set that is
   *  walkable beneath currentFeetY (not a wall/ceiling above step-up limit).
   *  Prefers center of player footprint to prevent getting hung up on trailing steps. */
  private getSurfaceY(px: number, pz: number, currentFeetY: number): number {
    const maxAllowedY = this.isGrounded ? currentFeetY + STEP_UP_MAX : currentFeetY + GROUND_MARGIN;
    let centerSurface = -Infinity;
    let best = -Infinity;
    const r = PLAYER_RADIUS;

    for (const c of this.colliders) {
      if (c.maxY > maxAllowedY) continue; // Surface is above step-up threshold (wall/ceiling)

      if (px >= c.minX && px <= c.maxX && pz >= c.minZ && pz <= c.maxZ) {
        if (c.maxY > centerSurface) centerSurface = c.maxY;
      }

      if (
        px + r > c.minX && px - r < c.maxX &&
        pz + r > c.minZ && pz - r < c.maxZ
      ) {
        if (c.maxY > best) best = c.maxY;
      }
    }

    if (centerSurface !== -Infinity) {
      return centerSurface;
    }
    return best;
  }

  /** Returns true if the box [minX..maxX, minZ..maxZ] (at height band feetY..headY)
   *  overlaps any solid collider at the given position, accounting for step-up. */
  private isBlockedX(nextX: number, curZ: number, feetY: number, headY: number): boolean {
    const r = PLAYER_RADIUS;
    if (nextX - r < this.bounds.minX || nextX + r > this.bounds.maxX) return true;
    for (const c of this.colliders) {
      // Skip if vertically clear (above head or below step-up threshold)
      if (c.minY > headY) continue;
      if (c.maxY <= feetY + GROUND_MARGIN) continue;      // below feet entirely
      if (this.isGrounded && c.maxY <= feetY + STEP_UP_MAX) continue; // step-up ONLY while grounded
      if (
        nextX + r > c.minX && nextX - r < c.maxX &&
        curZ   + r > c.minZ && curZ   - r < c.maxZ
      ) return true;
    }
    return false;
  }

  private isBlockedZ(curX: number, nextZ: number, feetY: number, headY: number): boolean {
    const r = PLAYER_RADIUS;
    if (nextZ - r < this.bounds.minZ || nextZ + r > this.bounds.maxZ) return true;
    for (const c of this.colliders) {
      if (c.minY > headY) continue;
      if (c.maxY <= feetY + GROUND_MARGIN) continue;
      if (this.isGrounded && c.maxY <= feetY + STEP_UP_MAX) continue;
      if (
        curX  + r > c.minX && curX  - r < c.maxX &&
        nextZ + r > c.minZ && nextZ - r < c.maxZ
      ) return true;
    }
    return false;
  }

  public getCollidingHits(): BoxCollider[] {
    const r = PLAYER_RADIUS;
    const feetY = this.position.y - this.eyeHeight;
    const headY = this.position.y + PLAYER_HEAD_M;
    return this.colliders.filter(c =>
      this.position.x + r > c.minX && this.position.x - r < c.maxX &&
      this.position.z + r > c.minZ && this.position.z - r < c.maxZ &&
      headY > c.minY && feetY < c.maxY
    );
  }

  public getCollidingCount(): number {
    return this.getCollidingHits().length;
  }

  /**
   * Tests whether solid geometry overhead prevents the player from standing up.
   * Checks whether the volume from the current crouched head to the standing head
   * overlaps any solid collider.
   */
  public hasOverheadObstruction(
    px: number = this.position.x,
    pz: number = this.position.z,
    feetY: number = this.position.y - this.eyeHeight
  ): boolean {
    const r = PLAYER_RADIUS;
    const currentHeadY = feetY + this.eyeHeight + PLAYER_HEAD_M;
    const standingHeadY = feetY + PLAYER_EYE_H + PLAYER_HEAD_M;

    for (const c of this.colliders) {
      if (
        px + r > c.minX && px - r < c.maxX &&
        pz + r > c.minZ && pz - r < c.maxZ
      ) {
        // If collider starts below standing head top and ends above current head level
        if (c.minY < standingHeadY && c.maxY > currentHeadY - 0.04) {
          return true;
        }
      }
    }
    return false;
  }

  public getEyeHeight(): number {
    return this.eyeHeight;
  }

  public getEffectiveColliderHeight(): number {
    return this.eyeHeight + PLAYER_HEAD_M;
  }

  public update(delta: number) {
    // 0. Crouch Stance & Overhead Clearance Safeguard
    const currentFeetY = this.position.y - this.eyeHeight;
    const isObstructed = this.hasOverheadObstruction(this.position.x, this.position.z, currentFeetY);
    this.isOverheadBlocked = isObstructed;

    const wantsCrouch = (this.crouchMode === 'toggle') ? this.isCrouchToggled : this.input.crouch;
    // Player remains crouched if actively holding/toggled crouch OR if overhead clearance is blocked
    const shouldCrouch = wantsCrouch || isObstructed;
    this.isCrouching = shouldCrouch;

    const targetEyeHeight = shouldCrouch ? PLAYER_CROUCH_EYE_H : PLAYER_EYE_H;
    const prevEyeHeight = this.eyeHeight;
    this.eyeHeight = THREE.MathUtils.lerp(this.eyeHeight, targetEyeHeight, Math.min(1, delta * CROUCH_LERP_SPEED));

    // Smoothly shift position.y by the eyeHeight delta so player's feet stay firmly grounded
    const dEye = this.eyeHeight - prevEyeHeight;
    this.position.y += dEye;

    this.isCrouchTransitioning = Math.abs(this.eyeHeight - targetEyeHeight) > 0.005;

    // 1. Recover Camera Recoil
    this.cameraRecoilPitch = THREE.MathUtils.lerp(this.cameraRecoilPitch, 0, delta * 12);
    this.cameraRecoilYaw   = THREE.MathUtils.lerp(this.cameraRecoilYaw,   0, delta * 12);

    const finalPitch = this.pitch + this.cameraRecoilPitch;
    const finalYaw   = this.yaw   + this.cameraRecoilYaw;

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = finalPitch;
    euler.y = finalYaw;
    this.camera.quaternion.setFromEuler(euler);

    // 2. Locomotion Movement Vector
    const moveDir = new THREE.Vector3();
    if (this.input.forward)  moveDir.z -= 1;
    if (this.input.backward) moveDir.z += 1;
    if (this.input.left)     moveDir.x -= 1;
    if (this.input.right)    moveDir.x += 1;
    moveDir.normalize();

    const hasMoveInput = moveDir.lengthSq() > 0;
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);

    // Physically coupled locomotion states:
    // isMoving is true if actively inputting movement OR physically decelerating above 0.15 m/s
    this.isMoving = hasMoveInput || horizontalSpeed > 0.15;

    let speed: number;
    if (this.isCrouching) {
      speed = PLAYER_CROUCH_SPEED;
      this.isSprinting = false; // Strictly disallowed while crouched
    } else {
      const canSprint = this.input.sprint && this.input.forward;
      speed = canSprint ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
      this.isSprinting = hasMoveInput && canSprint && horizontalSpeed > 3.0;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right   = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const targetVelX = (right.x * moveDir.x + forward.x * -moveDir.z) * speed;
    const targetVelZ = (right.z * moveDir.x + forward.z * -moveDir.z) * speed;

    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelX, delta * 15);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelZ, delta * 15);

    // 3. Jump & Gravity
    if (this.input.jump && this.isGrounded) {
      if (this.isCrouching) {
        if (!this.isOverheadBlocked) {
          // If clearance exists, jumping uncrouches
          this.isCrouchToggled = false;
          this.input.crouch = false;
          this.velocity.y  = 5.2;
          this.isGrounded  = false;
          this.input.jump  = false;
        } else {
          // Overhead obstruction suppresses jump
          this.input.jump = false;
        }
      } else {
        this.velocity.y  = 5.2;
        this.isGrounded  = false;
        this.input.jump  = false; // consume to avoid multi-jump on held Space
      }
    }

    if (!this.isGrounded) {
      this.velocity.y -= 16.0 * delta;
    }

    // 4. Swept AABB Collision with step-up and step-down
    const feetY  = this.position.y - this.eyeHeight;  // feet world-Y
    const headY  = this.position.y + PLAYER_HEAD_M;

    // ── X axis ──────────────────────────────────────────────────────────
    const nextX = this.position.x + this.velocity.x * delta;
    if (!this.isBlockedX(nextX, this.position.z, feetY, headY)) {
      this.position.x = nextX;
    } else {
      this.velocity.x = 0;
    }

    // ── Z axis ──────────────────────────────────────────────────────────
    const nextZ = this.position.z + this.velocity.z * delta;
    if (!this.isBlockedZ(this.position.x, nextZ, feetY, headY)) {
      this.position.z = nextZ;
    } else {
      this.velocity.z = 0;
    }

    // ── Y axis: apply gravity then snap to ground surface ───────────────
    const prevY = this.position.y;
    this.position.y += this.velocity.y * delta;

    // Ceiling head collision: if moving upwards, clamp head against bottom of ceilings
    if (this.velocity.y > 0) {
      const r = PLAYER_RADIUS;
      const headY = this.position.y + PLAYER_HEAD_M;
      for (const c of this.colliders) {
        if (
          this.position.x + r > c.minX && this.position.x - r < c.maxX &&
          this.position.z + r > c.minZ && this.position.z - r < c.maxZ
        ) {
          // If head reached or penetrated into the underside of collider
          if (headY >= c.minY && prevY + PLAYER_HEAD_M <= c.minY + 0.15) {
            this.position.y = c.minY - PLAYER_HEAD_M - 0.002;
            this.velocity.y = 0;
            break;
          }
        }
      }
    }

    // Determine the ground surface under the player's current XZ footprint.
    const surfaceY = this.getSurfaceY(this.position.x, this.position.z, feetY);
    const groundFloorY = this.eyeHeight; // absolute minimum (world floor at y=0)

    // The effective floor the camera eyes should be at:
    let targetEyeY: number;
    if (surfaceY !== -Infinity) {
      // Standing on a collider surface
      targetEyeY = surfaceY + this.eyeHeight;
    } else {
      targetEyeY = groundFloorY;
    }

    const newFeetY = this.position.y - this.eyeHeight;

    // Step-UP: if the surface is above feet but within autostep range AND we
    // are moving horizontally AND grounded, snap up immediately.
    if (
      surfaceY !== -Infinity &&
      surfaceY > newFeetY + GROUND_MARGIN &&
      surfaceY <= newFeetY + STEP_UP_MAX &&
      this.isGrounded &&
      this.isMoving
    ) {
      this.position.y = targetEyeY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
    // Grounded: at or below the surface → push up and land.
    else if (this.position.y <= targetEyeY && this.velocity.y <= 0) {
      this.position.y = targetEyeY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
    // Step-DOWN: if we were grounded and surface dropped within STEP_DOWN_MAX, smoothly step down
    // (Does not depend on isMoving so player never airborne-drops when slowing or stopping on stairs)
    else if (
      this.isGrounded &&
      this.position.y > targetEyeY &&
      this.position.y - targetEyeY <= STEP_DOWN_MAX + 0.05 &&
      this.velocity.y <= 0
    ) {
      this.position.y = targetEyeY;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      // In the air
      this.isGrounded = false;
    }

    // Out-of-bounds detection with countdown and return to safe spawn
    const OOB_MARGIN = 1.5;
    const isOut = (
      this.position.x < this.bounds.minX - OOB_MARGIN ||
      this.position.x > this.bounds.maxX + OOB_MARGIN ||
      this.position.z < this.bounds.minZ - OOB_MARGIN ||
      this.position.z > this.bounds.maxZ + OOB_MARGIN ||
      this.position.y < -2.0
    );

    if (isOut) {
      this.isOutOfBounds = true;
      this.oobTimer += delta;
      const remaining = Math.max(0, 5.0 - this.oobTimer);
      if (this.onOutOfBoundsWarning) {
        this.onOutOfBoundsWarning(Math.ceil(remaining));
      }
      if (this.oobTimer >= 5.0) {
        // Return player to spawn point
        this.setPosition(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z, this.spawnPoint.yaw);
        this.velocity.set(0, 0, 0);
        this.oobTimer = 0;
        this.isOutOfBounds = false;
        if (this.onOutOfBoundsClear) this.onOutOfBoundsClear();
      }
    } else {
      if (this.isOutOfBounds) {
        this.isOutOfBounds = false;
        this.oobTimer = 0;
        if (this.onOutOfBoundsClear) this.onOutOfBoundsClear();
      }
    }

    // Safety boundary clamp (keeps player from infinitely falling into the void)
    this.position.x = THREE.MathUtils.clamp(this.position.x, this.bounds.minX - 3.0, this.bounds.maxX + 3.0);
    this.position.z = THREE.MathUtils.clamp(this.position.z, this.bounds.minZ - 3.0, this.bounds.maxZ + 3.0);

    // 5. Camera Eye Height Smoothing & Head Bob
    // Smooth camera eye height over stair steps to eliminate vertical camera pop while keeping collider solid
    if (this.isGrounded) {
      const eyeDiff = this.position.y - this.currentCameraEyeY;
      if (Math.abs(eyeDiff) > 0.0005) {
        this.currentCameraEyeY += eyeDiff * Math.min(1, delta * 22);
      } else {
        this.currentCameraEyeY = this.position.y;
      }
    } else {
      // Airborne / jumping: immediate 1:1 camera vertical tracking
      this.currentCameraEyeY = this.position.y;
    }

    const isActuallyMoving = this.isGrounded && horizontalSpeed > 0.15;
    if (isActuallyMoving) {
      // Natural human stride cadence:
      // ~1.3 Hz crouch walk (8.2 rad/s)
      // ~1.85 Hz walking (11.6 rad/s)
      // ~3.2 Hz sprinting (20.1 rad/s)
      let bobRate: number;
      let targetAmp: number;
      if (this.isCrouching) {
        bobRate = 8.2;
        targetAmp = 0.008;
      } else if (this.isSprinting) {
        bobRate = 20.0;
        targetAmp = 0.030;
      } else {
        bobRate = 11.6;
        targetAmp = 0.016;
      }
      const baseSpeed = this.isCrouching ? PLAYER_CROUCH_SPEED : (this.isSprinting ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED);
      const speedScale = Math.min(1.2, horizontalSpeed / baseSpeed);
      this.headBobTimer += delta * bobRate * speedScale;

      const targetBob = Math.sin(this.headBobTimer) * targetAmp * speedScale;
      this.cameraBobOffset = THREE.MathUtils.lerp(this.cameraBobOffset, targetBob, Math.min(1, delta * 15));
    } else {
      // Smoothly decay head-bob offset to zero on stop — NEVER an instantaneous jump
      this.cameraBobOffset = THREE.MathUtils.lerp(this.cameraBobOffset, 0, Math.min(1, delta * 18));
    }

    this.camera.position.set(
      this.position.x,
      this.currentCameraEyeY + this.cameraBobOffset,
      this.position.z
    );

    // Decay mouse delta
    this.mouseDelta.x = THREE.MathUtils.lerp(this.mouseDelta.x, 0, delta * 16);
    this.mouseDelta.y = THREE.MathUtils.lerp(this.mouseDelta.y, 0, delta * 16);
  }
}
