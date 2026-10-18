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

// ── Stair/step constants ──────────────────────────────────────────────────
const PLAYER_RADIUS   = 0.35;  // horizontal capsule radius
const PLAYER_EYE_H   = 1.7;   // eye-level above feet
const PLAYER_HEAD_M  = 0.15;  // extra margin above eye
const STEP_UP_MAX    = 0.45;  // tallest step we autostep onto (~3 stair risers)
const STEP_DOWN_MAX  = 0.55;  // how far below feet we snap down (smooth descent)
const GROUND_MARGIN  = 0.04;  // feetY tolerance for ground detection

export class FirstPersonControls {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;

  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public isGrounded: boolean = true;
  public isMoving: boolean = false;
  public isSprinting: boolean = false;

  public mouseDelta = { x: 0, y: 0 };
  public isLocked: boolean = false;

  public bounds: MapBounds = { minX: -7.5, maxX: 7.5, minZ: -3.2, maxZ: 5.5 };
  public colliders: BoxCollider[] = [];

  private yaw: number = 0;
  private pitch: number = 0;
  private cameraRecoilPitch: number = 0;
  private cameraRecoilYaw: number = 0;

  private headBobTimer: number = 0;
  private eyeHeight: number = PLAYER_EYE_H;

  private input: PlayerInputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
  };

  private sensitivity: number = 0.002;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.position = new THREE.Vector3(0, this.eyeHeight, 0);
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
    this.camera.position.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.isGrounded = true;
    this.yaw = yaw;
    this.pitch = 0;
    this.cameraRecoilPitch = 0;
    this.cameraRecoilYaw = 0;
  }

  /** Force-release all held keys — call on pointer-lock loss or modal open. */
  public forceReleaseKeys() {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.sprint = false;
    this.input.jump = false;
    this.velocity.x = 0;
    this.velocity.z = 0;
  }

  private setupListeners() {
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
      }
    });
  }

  public applyCameraRecoil(pitch: number, yaw: number) {
    this.cameraRecoilPitch += pitch;
    this.cameraRecoilYaw += yaw;
  }

  // ── Collision helpers ─────────────────────────────────────────────────────

  /** Returns the highest surface Y at (px, pz) within the collider set, or
   *  -Infinity if no collider occupies that XZ footprint. */
  private getSurfaceY(px: number, pz: number): number {
    let best = -Infinity;
    const r = PLAYER_RADIUS;
    for (const c of this.colliders) {
      if (
        px + r > c.minX && px - r < c.maxX &&
        pz + r > c.minZ && pz - r < c.maxZ
      ) {
        if (c.maxY > best) best = c.maxY;
      }
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
      if (c.maxY <= feetY + STEP_UP_MAX) continue;        // short enough to step over
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
      if (c.maxY <= feetY + STEP_UP_MAX) continue;
      if (
        curX  + r > c.minX && curX  - r < c.maxX &&
        nextZ + r > c.minZ && nextZ - r < c.maxZ
      ) return true;
    }
    return false;
  }

  public update(delta: number) {
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

    this.isMoving    = moveDir.lengthSq() > 0;
    this.isSprinting = this.isMoving && this.input.sprint && this.input.forward;

    const speed = this.isSprinting ? 8.5 : 4.8;

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right   = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const targetVelX = (right.x * moveDir.x + forward.x * -moveDir.z) * speed;
    const targetVelZ = (right.z * moveDir.x + forward.z * -moveDir.z) * speed;

    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelX, delta * 15);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelZ, delta * 15);

    // 3. Jump & Gravity
    if (this.input.jump && this.isGrounded) {
      this.velocity.y  = 5.2;
      this.isGrounded  = false;
      this.input.jump  = false; // consume to avoid multi-jump on held Space
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
    this.position.y += this.velocity.y * delta;

    // Determine the ground surface under the player's current XZ footprint.
    const surfaceY = this.getSurfaceY(this.position.x, this.position.z);
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
      // Step-DOWN: if we just walked off an edge, smoothly snap down rather
      // than free-falling, so descending stairs doesn't look like falling.
      if (
        !this.isGrounded &&
        targetEyeY < this.position.y &&
        this.position.y - targetEyeY <= STEP_DOWN_MAX + 0.05
      ) {
        // Smooth step-down: lerp toward target rather than instant snap
        this.position.y = THREE.MathUtils.lerp(this.position.y, targetEyeY, Math.min(1, delta * 30));
      } else {
        this.position.y = targetEyeY;
      }
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      // In the air
      this.isGrounded = false;
    }

    // Safety boundary clamp
    this.position.x = THREE.MathUtils.clamp(this.position.x, this.bounds.minX, this.bounds.maxX);
    this.position.z = THREE.MathUtils.clamp(this.position.z, this.bounds.minZ, this.bounds.maxZ);

    // 5. Subtle Head Bob
    if (this.isMoving && this.isGrounded) {
      this.headBobTimer += delta * (this.isSprinting ? 14 : 9);
      const bobOffset = Math.sin(this.headBobTimer) * (this.isSprinting ? 0.04 : 0.02);
      this.camera.position.set(this.position.x, this.position.y + bobOffset, this.position.z);
    } else {
      this.camera.position.copy(this.position);
    }

    // Decay mouse delta
    this.mouseDelta.x = THREE.MathUtils.lerp(this.mouseDelta.x, 0, delta * 16);
    this.mouseDelta.y = THREE.MathUtils.lerp(this.mouseDelta.y, 0, delta * 16);
  }
}
