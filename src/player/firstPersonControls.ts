// src/player/firstPersonControls.ts
// First-Person Controller: Pointer lock, smooth mouse look, WASD movement, jumping, and camera recoil integration

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
  private eyeHeight: number = 1.7;

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
    this.yaw = yaw;
    this.pitch = 0;
    this.cameraRecoilPitch = 0;
    this.cameraRecoilYaw = 0;
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

  public update(delta: number) {
    // 1. Recover Camera Recoil
    this.cameraRecoilPitch = THREE.MathUtils.lerp(this.cameraRecoilPitch, 0, delta * 12);
    this.cameraRecoilYaw = THREE.MathUtils.lerp(this.cameraRecoilYaw, 0, delta * 12);

    // Apply combined rotations to Camera
    const finalPitch = this.pitch + this.cameraRecoilPitch;
    const finalYaw = this.yaw + this.cameraRecoilYaw;

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = finalPitch;
    euler.y = finalYaw;
    this.camera.quaternion.setFromEuler(euler);

    // 2. Locomotion Movement Vector
    const moveDir = new THREE.Vector3();
    if (this.input.forward) moveDir.z -= 1;
    if (this.input.backward) moveDir.z += 1;
    if (this.input.left) moveDir.x -= 1;
    if (this.input.right) moveDir.x += 1;
    moveDir.normalize();

    this.isMoving = moveDir.lengthSq() > 0;
    this.isSprinting = this.isMoving && this.input.sprint && this.input.forward;

    const speed = this.isSprinting ? 8.5 : 4.8;

    // Transform move direction into world coordinates based on player yaw
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const targetVelX = (right.x * moveDir.x + forward.x * -moveDir.z) * speed;
    const targetVelZ = (right.z * moveDir.x + forward.z * -moveDir.z) * speed;

    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelX, delta * 15);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelZ, delta * 15);

    // 3. Jump & Gravity
    if (this.input.jump && this.isGrounded) {
      this.velocity.y = 5.2;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.velocity.y -= 16.0 * delta; // Gravity
    }

    // 4. Movement with Axis-Aligned Box Collision
    const radius = 0.35;
    const feetY = this.position.y - this.eyeHeight;
    const headY = this.position.y + 0.15;

    // Attempt X movement
    const nextX = this.position.x + this.velocity.x * delta;
    let blockedX = false;

    // Check bounds
    if (nextX - radius < this.bounds.minX || nextX + radius > this.bounds.maxX) {
      blockedX = true;
    } else {
      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i];
        if (c.isWalkable && c.maxY <= feetY + 0.35) continue;
        if (c.minY > headY || c.maxY < feetY + 0.1) continue;

        if (
          nextX + radius > c.minX &&
          nextX - radius < c.maxX &&
          this.position.z + radius > c.minZ &&
          this.position.z - radius < c.maxZ
        ) {
          blockedX = true;
          break;
        }
      }
    }

    if (!blockedX) {
      this.position.x = nextX;
    } else {
      this.velocity.x = 0;
    }

    // Attempt Z movement
    const nextZ = this.position.z + this.velocity.z * delta;
    let blockedZ = false;

    if (nextZ - radius < this.bounds.minZ || nextZ + radius > this.bounds.maxZ) {
      blockedZ = true;
    } else {
      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i];
        if (c.isWalkable && c.maxY <= feetY + 0.35) continue;
        if (c.minY > headY || c.maxY < feetY + 0.1) continue;

        if (
          this.position.x + radius > c.minX &&
          this.position.x - radius < c.maxX &&
          nextZ + radius > c.minZ &&
          nextZ - radius < c.maxZ
        ) {
          blockedZ = true;
          break;
        }
      }
    }

    if (!blockedZ) {
      this.position.z = nextZ;
    } else {
      this.velocity.z = 0;
    }

    // Attempt Y movement
    this.position.y += this.velocity.y * delta;

    // Floor Boundary / Ground Limits
    let targetFloorY = this.eyeHeight;
    // Check if on top of a walkable platform or step
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (
        this.position.x >= c.minX - radius &&
        this.position.x <= c.maxX + radius &&
        this.position.z >= c.minZ - radius &&
        this.position.z <= c.maxZ + radius
      ) {
        if (c.isWalkable && c.maxY + this.eyeHeight > targetFloorY) {
          if (this.position.y >= c.maxY + this.eyeHeight - 0.4) {
            targetFloorY = c.maxY + this.eyeHeight;
          }
        }
      }
    }

    if (this.position.y <= targetFloorY) {
      this.position.y = targetFloorY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Final boundary clamp safety
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
