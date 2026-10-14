import { PlayerInput } from '@mini-arena/shared';

export class InputManager {
  private element: HTMLElement;
  private isLocked = false;
  private seq = 0;

  // Angles in radians
  public yaw = 0;
  public pitch = 0;

  public sensitivity = 0.0022;

  private keys: Record<string, boolean> = {};

  constructor(element: HTMLElement) {
    this.element = element;
    this.bindEvents();
  }

  private bindEvents(): void {
    // Pointer lock request on click
    this.element.addEventListener('click', () => {
      if (!this.isLocked) {
        this.element.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.element;
      const overlay = document.getElementById('lock-prompt');
      if (overlay) {
        overlay.style.display = this.isLocked ? 'none' : 'flex';
      }
    });

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;

      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;

      // Wrap yaw between 0 and 2*PI
      const twoPi = Math.PI * 2;
      this.yaw = ((this.yaw % twoPi) + twoPi) % twoPi;

      // Clamp pitch to avoid gimbal lock (-89.5° to +89.5°)
      const maxPitch = (89.5 * Math.PI) / 180;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Handle blur / focus loss
    window.addEventListener('blur', () => {
      this.keys = {};
    });
  }

  /**
   * Programmatic control hook for automated E2E tests.
   */
  public setKey(code: string, pressed: boolean): void {
    this.keys[code] = pressed;
  }

  public setLook(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = pitch;
  }

  public getIsLocked(): boolean {
    return this.isLocked;
  }

  /**
   * Samples the current input frame into a deterministic PlayerInput struct.
   */
  public sampleInput(tick: number): PlayerInput {
    let moveForward = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveForward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveForward -= 1;

    let moveRight = 0;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveRight += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveRight -= 1;

    const jump = Boolean(this.keys['Space']);
    const sprint = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const crouch = Boolean(this.keys['KeyC'] || this.keys['ControlLeft']);

    this.seq++;

    return {
      seq: this.seq,
      tick,
      moveForward,
      moveRight,
      jump,
      crouch,
      sprint,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }
}
