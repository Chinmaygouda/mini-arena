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

    // Mouse button controls (Fire & ADS)
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.isFiring = true;
      if (e.button === 2) this.isAds = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isFiring = false;
      if (e.button === 2) this.isAds = false;
    });

    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Digit1') this.selectedSlot = 0;
      if (e.code === 'Digit2') this.selectedSlot = 1;
      if (e.code === 'Digit3') this.selectedSlot = 2;
      if (e.code === 'Digit4') this.selectedSlot = 3;
      if (e.code === 'Digit5') this.selectedSlot = 4;
      if (e.code === 'KeyR') this.reloadRequested = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Handle blur / focus loss
    window.addEventListener('blur', () => {
      this.keys = {};
      this.isFiring = false;
      this.isAds = false;
      this.reloadRequested = false;
    });
  }

  public isFiring = false;
  public isAds = false;
  public selectedSlot: number | undefined = undefined;
  public reloadRequested = false;

  /**
   * Programmatic control hooks for automated E2E tests.
   */
  public setKey(code: string, pressed: boolean): void {
    this.keys[code] = pressed;
  }

  public setFire(firing: boolean): void {
    this.isFiring = firing;
  }

  public setAds(ads: boolean): void {
    this.isAds = ads;
  }

  public setReload(reload: boolean): void {
    this.reloadRequested = reload;
  }

  public setWeaponSlot(slot: number): void {
    this.selectedSlot = slot;
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

    const fire = this.isFiring || Boolean(this.keys['Mouse0']);
    const ads = this.isAds || Boolean(this.keys['Mouse2']);
    const reload = this.reloadRequested || Boolean(this.keys['KeyR']);
    this.reloadRequested = false;
    const slot = this.selectedSlot;
    // Clear slot trigger once sampled
    this.selectedSlot = undefined;

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
      fire,
      ads,
      reload,
      weaponSlot: slot,
    };
  }
}
