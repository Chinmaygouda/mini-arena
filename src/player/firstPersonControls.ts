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

    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;
    this.position.y += this.velocity.y * delta;

    // Floor Boundary / Range Platform Limits
    if (this.position.y <= this.eyeHeight) {
      this.position.y = this.eyeHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Keep player in shooting stall area
    this.position.x = THREE.MathUtils.clamp(this.position.x, -7.5, 7.5);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -3.2, 5.5);

    // 4. Subtle Head Bob
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
