import { WeaponId } from '@mini-arena/shared';

/**
 * Procedural Web Audio API sound synthesizer for Mini Arena weapon firing feedback.
 * Uses native Web Audio synthesis nodes (oscillators + noise buffers + biquad filters + gain envelopes).
 * Requires zero external audio asset downloads, eliminating 404s, CORS issues, or network lag.
 * Zero per-frame allocations during active gameplay.
 */
export class WeaponAudioSystem {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isMuted = false;

  constructor() {
    // AudioContext will be initialized on user interaction (pointerlock/click)
  }

  /**
   * Initializes the AudioContext upon user gesture.
   */
  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    if (typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.createNoiseBuffer();
    } catch (err) {
      console.warn('Web Audio API not supported or blocked:', err);
    }
  }

  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 1.0; // 1 second of white noise
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  /**
   * Synthesizes a weapon-specific gunshot sound based on real firearm acoustic characteristics.
   */
  public playShot(weaponId: WeaponId): void {
    if (this.isMuted) return;
    if (!this.ctx) {
      this.init();
    }
    if (!this.ctx || !this.noiseBuffer) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;

    switch (weaponId) {
      case 'pistol':
        this.playPistol(t);
        break;
      case 'smg':
        this.playSmg(t);
        break;
      case 'assault_rifle':
        this.playAssaultRifle(t);
        break;
      case 'shotgun':
        this.playShotgun(t);
        break;
      case 'sniper':
        this.playSniper(t);
        break;
    }
  }

  /**
   * Tactical Pistol: Crisp 9mm pop with short transient mechanical click (0.12s decay)
   */
  private playPistol(t: number): void {
    if (!this.ctx || !this.noiseBuffer) return;

    // 1. High transient crack
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1200, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + 0.08);

    // 2. Punchy body
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * Rapid SMG: Fast sharp 9mm crack with compact lowpass punch (0.08s decay)
   */
  private playSmg(t: number): void {
    if (!this.ctx || !this.noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1400, t);
    noiseFilter.Q.setValueAtTime(1.5, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + 0.06);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  /**
   * Assault Rifle (AK-47): Heavy 7.62x39mm resonant punch with deep mechanical roar (0.22s decay)
   */
  private playAssaultRifle(t: number): void {
    if (!this.ctx || !this.noiseBuffer) return;

    // 1. Muzzle crack noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(900, t);
    noiseFilter.Q.setValueAtTime(1.2, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + 0.16);

    // 2. Heavy 7.62mm low thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.22);

    const oscFilter = this.ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.setValueAtTime(450, t);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.9, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  /**
   * Combat Shotgun: Deep booming 12-gauge blast with wide white-noise explosion (0.35s decay)
   */
  private playShotgun(t: number): void {
    if (!this.ctx || !this.noiseBuffer) return;

    // 1. Massive explosive noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(150, t + 0.35);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + 0.35);

    // 2. Sub-bass concussive punch
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(100, t);
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.30);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(1.0, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);

    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(t);
    sub.stop(t + 0.30);
  }

  /**
   * Precision Sniper: High-velocity supersonic whip-crack transient + heavy reverberant boom (0.50s decay)
   */
  private playSniper(t: number): void {
    if (!this.ctx || !this.noiseBuffer) return;

    // 1. Supersonic whip crack
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(2500, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + 0.05);

    // 2. Massive rolling bass echo
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.50);

    const oscFilter = this.ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.setValueAtTime(350, t);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(1.0, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.50);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.50);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }
}

export const weaponAudio = new WeaponAudioSystem();
