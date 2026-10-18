// src/audio/soundManager.ts
// Zero-latency procedural Web Audio synthesizer for gunshots, reload mechanics, and impact pings

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeVoices: Array<{ gain: GainNode; stop: () => void; endTime: number }> = [];
  private readonly MAX_VOICES = 16;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    // Prune completed voices
    const now = this.ctx.currentTime;
    this.activeVoices = this.activeVoices.filter(v => v.endTime > now);
  }

  private registerVoice(gain: GainNode, stopFn: () => void, duration: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Voice stealing if at capacity: fade out oldest voice smoothly
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

  // Heavy AK-47 7.62mm Gunshot
  public playAK47Shot() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 1. Low-end Sub Punch
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.16);
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.22);

    // 2. High-energy Crack & Gas Expansion (White noise burst)
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
    noiseGain.connect(this.masterGain);
    noise.start(now);

    // 3. Metallic Bolt Slap Acoustic
    const boltOsc = this.ctx.createOscillator();
    const boltGain = this.ctx.createGain();
    boltOsc.type = 'sawtooth';
    boltOsc.frequency.setValueAtTime(580, now + 0.02);
    boltOsc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
    boltGain.gain.setValueAtTime(0.35, now + 0.02);
    boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    boltOsc.connect(boltGain);
    boltGain.connect(this.masterGain);
    boltOsc.start(now + 0.02);
    boltOsc.stop(now + 0.09);
  }

  // Snappy Tactical Pistol 9mm Gunshot
  public playPistolShot() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Transient snap
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);

    // High frequency pop
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
    noiseGain.connect(this.masterGain);
    noise.start(now);
  }

  // Snappy High-Cadence CYCLONE-9 SMG (800 RPM / 13.3 shots/sec)
  public playSMGShot(ammoRemaining?: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 1. Fast Sub-Bass Punch (180Hz -> 48Hz in 55ms)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(180, now);
    subOsc.frequency.exponentialRampToValueAtTime(48, now + 0.055);
    subGain.gain.setValueAtTime(0.75, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.075);
    this.registerVoice(subGain, () => subOsc.stop(), 0.075);

    // 2. High-energy Crack & Gas Port Expansion (Bandpass White Noise)
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
    noiseGain.connect(this.masterGain);
    noise.start(now);
    this.registerVoice(noiseGain, () => noise.stop(), 0.075);

    // 3. Metallic High-Speed Bolt Slap (720Hz -> 180Hz in 35ms)
    const boltOsc = this.ctx.createOscillator();
    const boltGain = this.ctx.createGain();
    boltOsc.type = 'sawtooth';
    boltOsc.frequency.setValueAtTime(720, now + 0.01);
    boltOsc.frequency.exponentialRampToValueAtTime(180, now + 0.038);
    boltGain.gain.setValueAtTime(0.3, now + 0.01);
    boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
    boltOsc.connect(boltGain);
    boltGain.connect(this.masterGain);
    boltOsc.start(now + 0.01);
    boltOsc.stop(now + 0.042);
    this.registerVoice(boltGain, () => boltOsc.stop(), 0.042);

    // 4. Low-Ammo Auditory Cue (Ting / Resonance when <= 5 rounds)
    if (ammoRemaining !== undefined && ammoRemaining <= 5 && ammoRemaining > 0) {
      const lowAmmoOsc = this.ctx.createOscillator();
      const lowAmmoGain = this.ctx.createGain();
      lowAmmoOsc.type = 'sine';
      lowAmmoOsc.frequency.setValueAtTime(2200, now);
      lowAmmoGain.gain.setValueAtTime(0.28, now);
      lowAmmoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      lowAmmoOsc.connect(lowAmmoGain);
      lowAmmoGain.connect(this.masterGain);
      lowAmmoOsc.start(now);
      lowAmmoOsc.stop(now + 0.09);
      this.registerVoice(lowAmmoGain, () => lowAmmoOsc.stop(), 0.09);
    }
  }

  // Rapid Burst Test Helper (for ?soundtest=1)
  public playSMGBurst(rounds: number = 5, onShot?: (index: number) => void) {
    for (let i = 0; i < rounds; i++) {
      setTimeout(() => {
        this.playSMGShot(rounds - i);
        if (onShot) onShot(i);
      }, i * 75); // 75ms = exactly 800 RPM
    }
  }

  // Reload Mechanical Sounds
  public playMagOut() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.14);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playMagIn() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Solid mechanical latch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playBoltRack() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Pull back
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(500, now);
    osc1.frequency.exponentialRampToValueAtTime(280, now + 0.1);
    gain1.gain.setValueAtTime(0.45, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + 0.11);

    // Spring slap forward
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(650, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(220, now + 0.24);
    gain2.gain.setValueAtTime(0.5, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.25);
  }

  // Dry Fire Click
  public playDryFire() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Steel Target Hit Ping
  public playTargetHit(isHeadshot: boolean = false) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
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
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  // Barrel Explosion
  public playExplosion() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(100, now);
    sub.frequency.exponentialRampToValueAtTime(25, now + 0.8);
    subGain.gain.setValueAtTime(1.3, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
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
    noiseGain.connect(this.masterGain);
    noise.start(now);
  }

  // Weapon Switch Whoosh
  public playWeaponSwitch() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.12);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // 12-Gauge Combat Shotgun Blast
  public playShotgunShot() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Heavy Sub Punch
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.28);
    subGain.gain.setValueAtTime(1.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.32);

    // Concussive Gas Expansion
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
    noiseGain.connect(this.masterGain);
    noise.start(now);
  }

  // Shotgun Pump Action (Rack-Back then Rack-Forward)
  public playShotgunPump() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Click 1: Back (Slide unlock & shell eject)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(420, now);
    osc1.frequency.exponentialRampToValueAtTime(160, now + 0.06);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(now);
    osc1.stop(now + 0.07);

    // Click 2: Forward (Chamber shell & lock bolt)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(280, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(550, now + 0.20);
    gain2.gain.setValueAtTime(0.45, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.22);
  }

  // High-Caliber Anti-Materiel Sniper Blast (.50 BMG)
  public playSniperShot() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Massive Sub-Bass Shockwave
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(220, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.45);
    subGain.gain.setValueAtTime(1.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.55);

    // Supersonic Crack (High-frequency burst)
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
    noiseGain.connect(this.masterGain);
    noise.start(now);
  }

  // Sniper Bolt Cycle (Up, Pull-Back, Push-Forward, Down)
  public playSniperBolt() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Unlock bolt
    const o1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    o1.type = 'triangle';
    o1.frequency.setValueAtTime(620, now);
    o1.frequency.exponentialRampToValueAtTime(320, now + 0.08);
    g1.gain.setValueAtTime(0.4, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    o1.connect(g1);
    g1.connect(this.masterGain);
    o1.start(now);
    o1.stop(now + 0.09);

    // Pull back
    const o2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(250, now + 0.16);
    o2.frequency.exponentialRampToValueAtTime(180, now + 0.28);
    g2.gain.setValueAtTime(0.35, now + 0.16);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    o2.connect(g2);
    g2.connect(this.masterGain);
    o2.start(now + 0.16);
    o2.stop(now + 0.30);

    // Lock forward
    const o3 = this.ctx.createOscillator();
    const g3 = this.ctx.createGain();
    o3.type = 'sawtooth';
    o3.frequency.setValueAtTime(380, now + 0.42);
    o3.frequency.exponentialRampToValueAtTime(580, now + 0.52);
    g3.gain.setValueAtTime(0.5, now + 0.42);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    o3.connect(g3);
    g3.connect(this.masterGain);
    o3.start(now + 0.42);
    o3.stop(now + 0.55);
  }
}

export const sound = new SoundManager();
