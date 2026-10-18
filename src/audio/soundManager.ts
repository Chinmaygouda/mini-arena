// src/audio/soundManager.ts
// Web Audio system with real recorded handling & reload effects, SFX bus architecture,
// master dynamics limiter, random pitch/gain micro-variations, and instant cancelation.

export type HandlingSoundKey =
  | 'ak_mag_out_01'
  | 'ak_mag_in_01'
  | 'ak_mag_in_02'
  | 'ak_bolt_rack_01'
  | 'pistol_mag_out_01'
  | 'pistol_mag_in_01'
  | 'pistol_mag_in_02'
  | 'pistol_slide_release_01'
  | 'smg_mag_out_01'
  | 'smg_mag_in_01'
  | 'smg_mag_in_02'
  | 'smg_bolt_01'
  | 'shotgun_shell_01'
  | 'shotgun_shell_02'
  | 'shotgun_shell_03'
  | 'shotgun_pump_back_01'
  | 'shotgun_pump_fwd_01'
  | 'sniper_bolt_unlock_01'
  | 'sniper_bolt_pull_01'
  | 'sniper_bolt_push_01'
  | 'sniper_bolt_lock_01'
  | 'sniper_mag_out_01'
  | 'sniper_mag_in_01'
  | 'sniper_mag_in_02'
  | 'equip_01'
  | 'equip_02'
  | 'dryfire_01'
  | 'dryfire_02'
  | 'low_ammo_01';

export const HANDLING_SOUND_PATHS: Record<HandlingSoundKey, string> = {
  ak_mag_out_01: '/audio/handling/ak_mag_out_01.ogg',
  ak_mag_in_01: '/audio/handling/ak_mag_in_01.ogg',
  ak_mag_in_02: '/audio/handling/ak_mag_in_02.ogg',
  ak_bolt_rack_01: '/audio/handling/ak_bolt_rack_01.ogg',
  pistol_mag_out_01: '/audio/handling/pistol_mag_out_01.ogg',
  pistol_mag_in_01: '/audio/handling/pistol_mag_in_01.ogg',
  pistol_mag_in_02: '/audio/handling/pistol_mag_in_02.ogg',
  pistol_slide_release_01: '/audio/handling/pistol_slide_release_01.ogg',
  smg_mag_out_01: '/audio/handling/smg_mag_out_01.ogg',
  smg_mag_in_01: '/audio/handling/smg_mag_in_01.ogg',
  smg_mag_in_02: '/audio/handling/smg_mag_in_02.ogg',
  smg_bolt_01: '/audio/handling/smg_bolt_01.ogg',
  shotgun_shell_01: '/audio/handling/shotgun_shell_01.ogg',
  shotgun_shell_02: '/audio/handling/shotgun_shell_02.ogg',
  shotgun_shell_03: '/audio/handling/shotgun_shell_03.ogg',
  shotgun_pump_back_01: '/audio/handling/shotgun_pump_back_01.ogg',
  shotgun_pump_fwd_01: '/audio/handling/shotgun_pump_fwd_01.ogg',
  sniper_bolt_unlock_01: '/audio/handling/sniper_bolt_unlock_01.ogg',
  sniper_bolt_pull_01: '/audio/handling/sniper_bolt_pull_01.ogg',
  sniper_bolt_push_01: '/audio/handling/sniper_bolt_push_01.ogg',
  sniper_bolt_lock_01: '/audio/handling/sniper_bolt_lock_01.ogg',
  sniper_mag_out_01: '/audio/handling/sniper_mag_out_01.ogg',
  sniper_mag_in_01: '/audio/handling/sniper_mag_in_01.ogg',
  sniper_mag_in_02: '/audio/handling/sniper_mag_in_02.ogg',
  equip_01: '/audio/handling/equip_01.ogg',
  equip_02: '/audio/handling/equip_02.ogg',
  dryfire_01: '/audio/handling/dryfire_01.ogg',
  dryfire_02: '/audio/handling/dryfire_02.ogg',
  low_ammo_01: '/audio/handling/low_ammo_01.ogg',
};

export interface HandlingVoice {
  id: number;
  key: HandlingSoundKey;
  source: AudioBufferSourceNode;
  gain: GainNode;
  stop: () => void;
  endTime: number;
}

export interface SoundEventLogItem {
  id: number;
  time: number;
  event: string;
  soundKey?: HandlingSoundKey;
  weapon?: string;
  stage?: number;
  cancelled?: boolean;
}

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private gunfireGain: GainNode | null = null;
  private handlingGain: GainNode | null = null;

  private activeVoices: Array<{ gain: GainNode; stop: () => void; endTime: number }> = [];
  private activeHandlingVoices: HandlingVoice[] = [];
  private readonly MAX_VOICES = 24;

  private audioBuffers: Map<HandlingSoundKey, AudioBuffer> = new Map();
  private isPreloading = false;
  public get isCurrentlyPreloading(): boolean {
    return this.isPreloading;
  }
  private preloadPromise: Promise<void> | null = null;
  private unlockHookInstalled = false;

  private eventLog: SoundEventLogItem[] = [];
  private nextEventId = 1;
  private nextVoiceId = 1;

  constructor() {
    this.installUnlockOnFirstGesture();
  }

  public init() {
    if (typeof window === 'undefined') return;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master Limiter: brickwall dynamics compressor to prevent clipping
      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.setValueAtTime(-1.0, this.ctx.currentTime);
      this.masterLimiter.knee.setValueAtTime(0, this.ctx.currentTime);
      this.masterLimiter.ratio.setValueAtTime(20, this.ctx.currentTime);
      this.masterLimiter.attack.setValueAtTime(0.001, this.ctx.currentTime);
      this.masterLimiter.release.setValueAtTime(0.05, this.ctx.currentTime);
      this.masterLimiter.connect(this.ctx.destination);

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.masterGain.connect(this.masterLimiter);

      // Gunfire SFX Bus
      this.gunfireGain = this.ctx.createGain();
      this.gunfireGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.gunfireGain.connect(this.masterGain);

      // Handling SFX Bus: sits 14 dB below gunfire (10^(-14/20) ~= 0.20)
      this.handlingGain = this.ctx.createGain();
      this.handlingGain.gain.setValueAtTime(0.20, this.ctx.currentTime);
      this.handlingGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // Prune completed voices
    const now = this.ctx.currentTime;
    this.activeVoices = this.activeVoices.filter(v => v.endTime > now);
    this.activeHandlingVoices = this.activeHandlingVoices.filter(v => v.endTime > now);
  }

  /**
   * Unlock Web Audio on first user interaction gesture.
   */
  public installUnlockOnFirstGesture() {
    if (typeof window === 'undefined' || this.unlockHookInstalled) return;
    this.unlockHookInstalled = true;

    const unlock = () => {
      this.init();
      this.preloadHandlingSounds();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    window.addEventListener('click', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
  }

  /**
   * Preload & decode all 29 handling sound buffers into memory once.
   */
  public async preloadHandlingSounds(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;
    this.init();
    if (!this.ctx) return;

    this.isPreloading = true;
    const keys = Object.keys(HANDLING_SOUND_PATHS) as HandlingSoundKey[];

    this.preloadPromise = Promise.all(
      keys.map(async (key) => {
        if (this.audioBuffers.has(key)) return;
        try {
          const path = HANDLING_SOUND_PATHS[key];
          const res = await fetch(path);
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
          const arrayBuf = await res.arrayBuffer();
          if (this.ctx) {
            const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
            this.audioBuffers.set(key, audioBuf);
          }
        } catch (err) {
          console.warn(`[SoundManager] Failed to load buffer for ${key}:`, err);
        }
      })
    ).then(() => {
      this.isPreloading = false;
    });

    return this.preloadPromise;
  }

  public isHandlingLoaded(): boolean {
    return this.audioBuffers.size >= Object.keys(HANDLING_SOUND_PATHS).length;
  }

  public getAudioBuffer(key: HandlingSoundKey): AudioBuffer | undefined {
    return this.audioBuffers.get(key);
  }

  private registerVoice(gain: GainNode, stopFn: () => void, duration: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    while (this.activeVoices.length >= this.MAX_VOICES) {
      const oldest = this.activeVoices.shift();
      if (oldest) {
        try {
          oldest.gain.gain.setValueAtTime(oldest.gain.gain.value, now);
          oldest.gain.gain.linearRampToValueAtTime(0.001, now + 0.005);
          oldest.stop();
        } catch {
          // already stopped
        }
      }
    }
    this.activeVoices.push({ gain, stop: stopFn, endTime: now + duration });
  }

  /**
   * Play a recorded handling sound buffer with pitch variance (+/-3%) and gain variance (+/-1.5 dB).
   * Fully tracked in activeHandlingVoices for immediate, click-free cancellation.
   */
  public playHandling(
    key: HandlingSoundKey,
    meta?: { weapon?: string; stage?: number; eventName?: string }
  ): AudioBufferSourceNode | null {
    this.init();
    if (!this.ctx || !this.handlingGain) {
      this.logEvent(meta?.eventName || key, key, meta?.weapon, meta?.stage);
      return null;
    }

    const buffer = this.audioBuffers.get(key);
    if (!buffer) {
      // Buffer not decoded yet; trigger lazy preload and log
      this.preloadHandlingSounds();
      this.logEvent(meta?.eventName || key, key, meta?.weapon, meta?.stage);
      return null;
    }

    const now = this.ctx.currentTime;

    // Pitch variance: +/- 3% (0.97 to 1.03)
    const pitchOffset = (Math.random() * 0.06 - 0.03);
    const playbackRate = Math.max(0.9, Math.min(1.1, 1.0 + pitchOffset));

    // Gain variance: +/- 1.5 dB
    const gainDb = (Math.random() * 3.0 - 1.5);
    const gainScale = Math.pow(10, gainDb / 20);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, now);

    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(gainScale, now);

    source.connect(voiceGain);
    voiceGain.connect(this.handlingGain);

    const duration = buffer.duration / playbackRate;
    source.start(now);

    const voiceId = this.nextVoiceId++;
    const voice: HandlingVoice = {
      id: voiceId,
      key,
      source,
      gain: voiceGain,
      stop: () => {
        try {
          source.stop();
          source.disconnect();
          voiceGain.disconnect();
        } catch {}
      },
      endTime: now + duration + 0.02,
    };

    source.onended = () => {
      const idx = this.activeHandlingVoices.findIndex(v => v.id === voiceId);
      if (idx !== -1) {
        this.activeHandlingVoices.splice(idx, 1);
      }
    };

    this.activeHandlingVoices.push(voice);
    this.logEvent(meta?.eventName || key, key, meta?.weapon, meta?.stage);

    return source;
  }

  /**
   * Stop and smoothly fade out all active or pending handling sounds.
   * Triggered immediately when reload is interrupted, weapon is swapped, map is switched, or player dies.
   */
  public stopAllHandlingSounds() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    for (const v of this.activeHandlingVoices) {
      try {
        if (this.ctx) {
          v.gain.gain.setValueAtTime(v.gain.gain.value, now);
          v.gain.gain.linearRampToValueAtTime(0.0001, now + 0.005);
          setTimeout(() => {
            v.stop();
          }, 6);
        } else {
          v.stop();
        }
      } catch {}
    }
    this.activeHandlingVoices = [];
    this.logEvent('STOP_ALL_HANDLING', undefined, undefined, undefined, true);
  }

  public getActiveHandlingVoiceCount(): number {
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.activeHandlingVoices = this.activeHandlingVoices.filter(v => v.endTime > now);
    }
    return this.activeHandlingVoices.length;
  }

  private logEvent(
    event: string,
    soundKey?: HandlingSoundKey,
    weapon?: string,
    stage?: number,
    cancelled?: boolean
  ) {
    const item: SoundEventLogItem = {
      id: this.nextEventId++,
      time: performance.now(),
      event,
      soundKey,
      weapon,
      stage,
      cancelled
    };
    this.eventLog.push(item);
    if (this.eventLog.length > 200) {
      this.eventLog.shift();
    }
  }

  public getHandlingEventLog(): SoundEventLogItem[] {
    return [...this.eventLog];
  }

  public clearHandlingEventLog() {
    this.eventLog = [];
  }

  // ==========================================
  // WEAPON HANDLING SOUND APIS
  // ==========================================

  // Equip / Weapon Draw
  public playWeaponSwitch() {
    this.playEquip();
  }

  public playEquip(weaponId?: string) {
    const variant: HandlingSoundKey = Math.random() < 0.5 ? 'equip_01' : 'equip_02';
    this.playHandling(variant, { weapon: weaponId, eventName: 'equip' });
  }

  // Dry Fire
  public playDryFire(weaponId?: string) {
    const variant: HandlingSoundKey = Math.random() < 0.5 ? 'dryfire_01' : 'dryfire_02';
    this.playHandling(variant, { weapon: weaponId, eventName: 'dry_fire' });
  }

  // Low Ammo Auditory Cue
  public playLowAmmoCue(weaponId?: string) {
    this.playHandling('low_ammo_01', { weapon: weaponId, eventName: 'low_ammo' });
  }

  // AK-47 Reload Stages
  public playAKMagOut() {
    this.playHandling('ak_mag_out_01', { weapon: 'ak47', stage: 1, eventName: 'ak_mag_out' });
  }

  public playAKMagIn() {
    const variant: HandlingSoundKey = Math.random() < 0.5 ? 'ak_mag_in_01' : 'ak_mag_in_02';
    this.playHandling(variant, { weapon: 'ak47', stage: 2, eventName: 'ak_mag_in' });
  }

  public playAKBoltRack() {
    this.playHandling('ak_bolt_rack_01', { weapon: 'ak47', stage: 3, eventName: 'ak_bolt_rack' });
  }

  // Pistol Reload Stages
  public playPistolMagOut() {
    this.playHandling('pistol_mag_out_01', { weapon: 'pistol', stage: 1, eventName: 'pistol_mag_out' });
  }

  public playPistolMagIn() {
    const variant: HandlingSoundKey = Math.random() < 0.5 ? 'pistol_mag_in_01' : 'pistol_mag_in_02';
    this.playHandling(variant, { weapon: 'pistol', stage: 2, eventName: 'pistol_mag_in' });
  }

  public playPistolSlideRelease() {
    this.playHandling('pistol_slide_release_01', { weapon: 'pistol', stage: 3, eventName: 'pistol_slide_release' });
  }

  // SMG Reload Stages
  public playSMGMagOut() {
    this.playHandling('smg_mag_out_01', { weapon: 'smg', stage: 1, eventName: 'smg_mag_out' });
  }

  public playSMGMagIn() {
    const variant: HandlingSoundKey = Math.random() < 0.5 ? 'smg_mag_in_01' : 'smg_mag_in_02';
    this.playHandling(variant, { weapon: 'smg', stage: 2, eventName: 'smg_mag_in' });
  }

  public playSMGBolt() {
    this.playHandling('smg_bolt_01', { weapon: 'smg', stage: 3, eventName: 'smg_bolt' });
  }

  // Shotgun Reload Stages (Tubular shell-by-shell commit & pump action)
  public playShotgunShellInsert() {
    const r = Math.random();
    const variant: HandlingSoundKey = r < 0.33 ? 'shotgun_shell_01' : r < 0.66 ? 'shotgun_shell_02' : 'shotgun_shell_03';
    this.playHandling(variant, { weapon: 'shotgun', stage: 1, eventName: 'shotgun_shell_insert' });
  }

  public playShotgunPumpBack() {
    this.playHandling('shotgun_pump_back_01', { weapon: 'shotgun', stage: 2, eventName: 'shotgun_pump_back' });
  }

  public playShotgunPumpForward() {
    this.playHandling('shotgun_pump_fwd_01', { weapon: 'shotgun', stage: 3, eventName: 'shotgun_pump_forward' });
  }

  // Sniper Reload Stages (Bolt unlock, pull, mag out, mag in, push, lock)
  public playSniperBoltUnlock() {
    this.playHandling('sniper_bolt_unlock_01', { weapon: 'sniper', stage: 1, eventName: 'sniper_bolt_unlock' });
  }

  public playSniperBoltPull() {
    this.playHandling('sniper_bolt_pull_01', { weapon: 'sniper', stage: 2, eventName: 'sniper_bolt_pull' });
  }

  public playSniperMagOut() {
    this.playHandling('sniper_mag_out_01', { weapon: 'sniper', stage: 3, eventName: 'sniper_mag_out' });
  }

  public playSniperMagIn() {
    const variant: HandlingSoundKey = Math.random() < 0.5 ? 'sniper_mag_in_01' : 'sniper_mag_in_02';
    this.playHandling(variant, { weapon: 'sniper', stage: 4, eventName: 'sniper_mag_in' });
  }

  public playSniperBoltPush() {
    this.playHandling('sniper_bolt_push_01', { weapon: 'sniper', stage: 5, eventName: 'sniper_bolt_push' });
  }

  public playSniperBoltLock() {
    this.playHandling('sniper_bolt_lock_01', { weapon: 'sniper', stage: 6, eventName: 'sniper_bolt_lock' });
  }

  // Backward-compatibility legacy methods mapping to recorded sounds
  public playMagOut() {
    this.playAKMagOut();
  }

  public playMagIn() {
    this.playAKMagIn();
  }

  public playBoltRack() {
    this.playAKBoltRack();
  }

  public playShotgunPump() {
    this.playShotgunPumpBack();
    setTimeout(() => {
      this.playShotgunPumpForward();
    }, 140);
  }

  public playSniperBolt() {
    this.playSniperBoltUnlock();
    setTimeout(() => {
      this.playSniperBoltPull();
      setTimeout(() => {
        this.playSniperBoltPush();
        setTimeout(() => {
          this.playSniperBoltLock();
        }, 120);
      }, 160);
    }, 100);
  }

  // ==========================================
  // GUNFIRE SYNTHESIZERS (UNTOUCHED SOUNDS)
  // ==========================================

  public playAK47Shot() {
    this.init();
    if (!this.ctx || !this.gunfireGain) return;
    const now = this.ctx.currentTime;

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.16);
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    subOsc.connect(subGain);
    subGain.connect(this.gunfireGain);
    subOsc.start(now);
    subOsc.stop(now + 0.22);

    const bufferSize = this.ctx.sampleRate * 0.18;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    noiseFilter.Q.setValueAtTime(1.8, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.gunfireGain);
    noise.start(now);

    const boltOsc = this.ctx.createOscillator();
    const boltGain = this.ctx.createGain();
    boltOsc.type = 'sawtooth';
    boltOsc.frequency.setValueAtTime(580, now + 0.02);
    boltOsc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
    boltGain.gain.setValueAtTime(0.35, now + 0.02);
    boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    boltOsc.connect(boltGain);
    boltGain.connect(this.gunfireGain);
    boltOsc.start(now + 0.02);
    boltOsc.stop(now + 0.09);
  }

  public playPistolShot() {
    this.init();
    if (!this.ctx || !this.gunfireGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.gunfireGain);
    osc.start(now);
    osc.stop(now + 0.14);

    const bufferSize = this.ctx.sampleRate * 0.1;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2400, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.gunfireGain);
    noise.start(now);
  }

  public playSMGShot(ammoRemaining?: number) {
    this.init();
    if (!this.ctx || !this.gunfireGain) return;
    const now = this.ctx.currentTime;

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(180, now);
    subOsc.frequency.exponentialRampToValueAtTime(48, now + 0.055);
    subGain.gain.setValueAtTime(0.75, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    subOsc.connect(subGain);
    subGain.connect(this.gunfireGain);
    subOsc.start(now);
    subOsc.stop(now + 0.075);
    this.registerVoice(subGain, () => subOsc.stop(), 0.075);

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2400, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(600, now + 0.07);
    noiseFilter.Q.setValueAtTime(2.2, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.05, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.075);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.gunfireGain);
    noise.start(now);
    this.registerVoice(noiseGain, () => noise.stop(), 0.075);

    const boltOsc = this.ctx.createOscillator();
    const boltGain = this.ctx.createGain();
    boltOsc.type = 'sawtooth';
    boltOsc.frequency.setValueAtTime(720, now + 0.01);
    boltOsc.frequency.exponentialRampToValueAtTime(180, now + 0.038);
    boltGain.gain.setValueAtTime(0.3, now + 0.01);
    boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
    boltOsc.connect(boltGain);
    boltGain.connect(this.gunfireGain);
    boltOsc.start(now + 0.01);
    boltOsc.stop(now + 0.042);
    this.registerVoice(boltGain, () => boltOsc.stop(), 0.042);

    if (ammoRemaining !== undefined && ammoRemaining <= 5 && ammoRemaining > 0) {
      this.playLowAmmoCue('smg');
    }
  }

  public playSMGBurst(rounds: number = 5, onShot?: (index: number) => void) {
    for (let i = 0; i < rounds; i++) {
      setTimeout(() => {
        this.playSMGShot(rounds - i);
        if (onShot) onShot(i);
      }, i * 75);
    }
  }

  public playTargetHit(isHeadshot: boolean = false) {
    this.init();
    if (!this.ctx || !this.gunfireGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const freq = isHeadshot ? 1650 : 1100;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.98, now + 0.35);

    gain.gain.setValueAtTime(isHeadshot ? 0.75 : 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.gunfireGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playExplosion() {
    this.init();
    if (!this.ctx || !this.gunfireGain) return;
    const now = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(100, now);
    sub.frequency.exponentialRampToValueAtTime(25, now + 0.8);
    subGain.gain.setValueAtTime(1.3, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    sub.connect(subGain);
    subGain.connect(this.gunfireGain);
    sub.start(now);
    sub.stop(now + 0.9);

    const bufferSize = this.ctx.sampleRate * 0.6;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.6);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.gunfireGain);
    noise.start(now);
  }

  public playShotgunShot() {
    this.init();
    if (!this.ctx || !this.gunfireGain) return;
    const now = this.ctx.currentTime;

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.28);
    subGain.gain.setValueAtTime(1.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    subOsc.connect(subGain);
    subGain.connect(this.gunfireGain);
    subOsc.start(now);
    subOsc.stop(now + 0.32);

    const bufferSize = this.ctx.sampleRate * 0.35;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.3);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.gunfireGain);
    noise.start(now);
  }

  public playSniperShot() {
    this.init();
    if (!this.ctx || !this.gunfireGain) return;
    const now = this.ctx.currentTime;

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(220, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.45);
    subGain.gain.setValueAtTime(1.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    subOsc.connect(subGain);
    subGain.connect(this.gunfireGain);
    subOsc.start(now);
    subOsc.stop(now + 0.55);

    const bufferSize = this.ctx.sampleRate * 0.45;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.frequency.exponentialRampToValueAtTime(350, now + 0.4);
    filter.Q.setValueAtTime(2.2, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.gunfireGain);
    noise.start(now);
  }
}

export const sound = new SoundManager();
