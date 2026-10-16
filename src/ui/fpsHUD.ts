// src/ui/fpsHUD.ts
// Tactical Glassmorphism HUD: Dynamic bloom crosshair, hitmarkers, ammo telemetry, and hotbar

import type { WeaponState } from '../weapons/weaponManager';
import type { WeaponDef } from '../weapons/weaponTypes';
import { sound } from '../audio/soundManager';

export class FPSHUD {
  private container: HTMLDivElement;
  private crosshair: HTMLDivElement;
  private hitmarker: HTMLDivElement;
  private ammoCard: HTMLDivElement;
  private hotbar: HTMLDivElement;
  private promptOverlay: HTMLDivElement;
  private controlsCard: HTMLDivElement;
  private tuningPanel: HTMLDivElement;
  public isTuningOpen: boolean = false;
  private lastHitTime: number = 0;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'fps-hud';
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      user-select: none;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      overflow: hidden;
      z-index: 100;
    `;
    document.body.appendChild(this.container);

    // 1. Dynamic Crosshair
    this.crosshair = document.createElement('div');
    this.crosshair.id = 'dynamic-crosshair';
    this.crosshair.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
      pointer-events: none;
      transition: opacity 0.15s ease;
    `;
    this.crosshair.innerHTML = `
      <div id="ch-dot" style="position:absolute;top:50%;left:50%;width:3px;height:3px;background:#00ff88;transform:translate(-50%,-50%);border-radius:50%;box-shadow:0 0 6px #00ff88;"></div>
      <div id="ch-top" style="position:absolute;top:0;left:50%;width:2px;height:9px;background:#00ff88;transform:translateX(-50%);border-radius:1px;box-shadow:0 0 4px #00ff88;"></div>
      <div id="ch-bot" style="position:absolute;bottom:0;left:50%;width:2px;height:9px;background:#00ff88;transform:translateX(-50%);border-radius:1px;box-shadow:0 0 4px #00ff88;"></div>
      <div id="ch-left" style="position:absolute;left:0;top:50%;width:9px;height:2px;background:#00ff88;transform:translateY(-50%);border-radius:1px;box-shadow:0 0 4px #00ff88;"></div>
      <div id="ch-right" style="position:absolute;right:0;top:50%;width:9px;height:2px;background:#00ff88;transform:translateY(-50%);border-radius:1px;box-shadow:0 0 4px #00ff88;"></div>
    `;
    this.container.appendChild(this.crosshair);

    // 2. Hitmarker Ticks
    this.hitmarker = document.createElement('div');
    this.hitmarker.id = 'hitmarker';
    this.hitmarker.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 24px;
      height: 24px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.08s ease-out;
    `;
    this.hitmarker.innerHTML = `
      <div style="position:absolute;top:0;left:0;width:8px;height:2px;background:#ffffff;transform:rotate(45deg);transform-origin:left center;box-shadow:0 0 4px #fff;"></div>
      <div style="position:absolute;top:0;right:0;width:8px;height:2px;background:#ffffff;transform:rotate(-45deg);transform-origin:right center;box-shadow:0 0 4px #fff;"></div>
      <div style="position:absolute;bottom:0;left:0;width:8px;height:2px;background:#ffffff;transform:rotate(-45deg);transform-origin:left center;box-shadow:0 0 4px #fff;"></div>
      <div style="position:absolute;bottom:0;right:0;width:8px;height:2px;background:#ffffff;transform:rotate(45deg);transform-origin:right center;box-shadow:0 0 4px #fff;"></div>
    `;
    this.container.appendChild(this.hitmarker);

    // 3. Glassmorphic Ammo & Weapon Telemetry Card (Bottom-Right)
    this.ammoCard = document.createElement('div');
    this.ammoCard.style.cssText = `
      position: absolute;
      bottom: 35px;
      right: 40px;
      background: rgba(10, 16, 22, 0.75);
      border: 1px solid rgba(0, 255, 136, 0.25);
      backdrop-filter: blur(16px);
      border-radius: 16px;
      padding: 18px 24px;
      color: #ffffff;
      min-width: 260px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
    `;
    this.container.appendChild(this.ammoCard);

    // 4. Weapon Selection Hotbar (Bottom-Center)
    this.hotbar = document.createElement('div');
    this.hotbar.style.cssText = `
      position: absolute;
      bottom: 35px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 12px;
      background: rgba(10, 16, 22, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px);
      border-radius: 14px;
      padding: 8px 12px;
    `;
    this.container.appendChild(this.hotbar);

    // 5. Controls Guide Overlay (Top-Left)
    this.controlsCard = document.createElement('div');
    this.controlsCard.style.cssText = `
      position: absolute;
      top: 30px;
      left: 30px;
      background: rgba(10, 16, 22, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      padding: 14px 18px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 11px;
      letter-spacing: 0.5px;
      line-height: 1.6;
    `;
    this.controlsCard.innerHTML = `
      <div style="font-weight: 800; color: #00ff88; margin-bottom: 6px; font-size: 12px; text-transform: uppercase;">
        OPERATIVE COMBAT CONTROLS
      </div>
      <div><span style="color:#00ff88;font-weight:bold;">LMB</span> — Fire Weapon (Auto / Semi)</div>
      <div><span style="color:#00ff88;font-weight:bold;">RMB / Q</span> — Aim Down Sights (ADS)</div>
      <div><span style="color:#00ff88;font-weight:bold;">R</span> — Tactical Reload</div>
      <div><span style="color:#00ff88;font-weight:bold;">1 / 2 / 3</span> — Switch Weapon (AK-47 / Pistol / SMG)</div>
      <div><span style="color:#00ff88;font-weight:bold;">V</span> — Inspect Weapon | <span style="color:#00ff88;font-weight:bold;">T</span> — Tuning / Soundtest</div>
      <div><span style="color:#00ff88;font-weight:bold;">WASD</span> — Move | <span style="color:#00ff88;font-weight:bold;">Shift</span> — Sprint | <span style="color:#00ff88;font-weight:bold;">Space</span> — Jump</div>
    `;
    this.container.appendChild(this.controlsCard);

    // 6. Click-to-Play Overlay
    this.promptOverlay = document.createElement('div');
    this.promptOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(4, 8, 12, 0.82);
      backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #fff;
      pointer-events: auto;
      cursor: pointer;
    `;
    this.promptOverlay.innerHTML = `
      <div style="border: 1px solid rgba(0,255,136,0.4); background: rgba(0,255,136,0.1); padding: 8px 18px; border-radius: 999px; color: #00ff88; font-size: 12px; font-weight: 800; letter-spacing: 2px; margin-bottom: 16px;">
        VANGUARD BALLISTICS PROTOCOL
      </div>
      <h1 style="font-size: 56px; font-weight: 900; letter-spacing: -1px; margin: 0 0 12px 0; text-transform: uppercase; text-shadow: 0 0 35px rgba(0,255,136,0.5);">
        AK-47 PROVING GROUNDS
      </h1>
      <p style="font-size: 16px; color: rgba(255,255,255,0.7); max-width: 500px; text-align: center; margin: 0 0 32px 0; line-height: 1.5;">
        Authentic procedural recoil, multi-stage reload choreography, reactive steel targets, and optical holographic scope.
      </p>
      <div id="btn-engage" style="background: linear-gradient(135deg, #00ff88, #00bb66); color: #04080c; font-weight: 900; font-size: 14px; padding: 16px 36px; border-radius: 14px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 0 40px rgba(0,255,136,0.6); display: flex; align-items: center; gap: 10px;">
        CLICK ANYWHERE TO ENGAGE
      </div>
    `;
    this.container.appendChild(this.promptOverlay);

    // 7. Tactical Weapon Tuning & SFX Audit Panel (?soundtest=1)
    this.tuningPanel = document.createElement('div');
    this.tuningPanel.id = 'tuning-soundtest-panel';
    this.tuningPanel.style.cssText = `
      position: absolute;
      top: 30px;
      right: 30px;
      width: 320px;
      background: rgba(10, 16, 22, 0.88);
      border: 1px solid rgba(0, 255, 136, 0.35);
      backdrop-filter: blur(16px);
      border-radius: 14px;
      padding: 16px 20px;
      color: #fff;
      font-size: 11px;
      pointer-events: auto;
      display: none;
      z-index: 120;
      box-shadow: 0 12px 36px rgba(0,0,0,0.6);
    `;
    this.container.appendChild(this.tuningPanel);

    // Auto-open if query param ?soundtest=1 or ?tuning=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('soundtest') === '1' || params.get('tuning') === '1') {
      this.isTuningOpen = true;
      this.tuningPanel.style.display = 'block';
    }

    this.promptOverlay.addEventListener('click', () => {
      this.isDismissed = true;
      this.promptOverlay.style.display = 'none';
    });
  }

  public isDismissed: boolean = false;

  public setPointerLocked(isLocked: boolean) {
    if (isLocked) {
      this.isDismissed = true;
      this.promptOverlay.style.display = 'none';
    } else if (!this.isDismissed) {
      this.promptOverlay.style.display = 'flex';
    }
  }

  public toggleTuning(activeDef?: WeaponDef) {
    this.isTuningOpen = !this.isTuningOpen;
    this.tuningPanel.style.display = this.isTuningOpen ? 'block' : 'none';
    if (this.isTuningOpen && activeDef) {
      this.renderTuning(activeDef);
    }
  }

  public renderTuning(def: WeaponDef) {
    this.tuningPanel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">
        <span style="font-weight: 800; color: #00ff88; font-size: 12px;">TUNING & SFX AUDIT</span>
        <span id="close-tuning" style="cursor: pointer; color: #888; font-weight: bold; font-size: 14px;">✕</span>
      </div>

      <div style="font-weight:700; color:#fff; margin-bottom:8px;">ACTIVE: <span style="color:#00ff88;">${def.name}</span></div>

      <!-- SFX Audit Section -->
      <div style="font-size:10px; font-weight:800; color:rgba(255,255,255,0.5); text-transform:uppercase; margin-bottom:6px;">AUDIO BUS AUDIT (16-VOICE POOL)</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:14px;">
        <button id="sfx-smg-single" style="background:#1a222a; color:#00ff88; border:1px solid #00ff8844; padding:6px; border-radius:6px; cursor:pointer; font-size:10px; font-weight:700;">1x SHOT</button>
        <button id="sfx-smg-burst5" style="background:#1a222a; color:#00ff88; border:1px solid #00ff8844; padding:6px; border-radius:6px; cursor:pointer; font-size:10px; font-weight:700;">5x BURST (800 RPM)</button>
        <button id="sfx-smg-burst10" style="background:#1a222a; color:#00ff88; border:1px solid #00ff8844; padding:6px; border-radius:6px; cursor:pointer; font-size:10px; font-weight:700;">10x BURST</button>
        <button id="sfx-low-ammo" style="background:#1a222a; color:#ffaa00; border:1px solid #ffaa0044; padding:6px; border-radius:6px; cursor:pointer; font-size:10px; font-weight:700;">LOW-AMMO PING</button>
        <button id="sfx-dry-fire" style="background:#1a222a; color:#ff4444; border:1px solid #ff444444; padding:6px; border-radius:6px; cursor:pointer; font-size:10px; font-weight:700;">DRY-FIRE CLICK</button>
        <button id="sfx-reload-mech" style="background:#1a222a; color:#00e5ff; border:1px solid #00e5ff44; padding:6px; border-radius:6px; cursor:pointer; font-size:10px; font-weight:700;">RELOAD MECH</button>
      </div>

      <!-- Live Tuning Sliders -->
      <div style="font-size:10px; font-weight:800; color:rgba(255,255,255,0.5); text-transform:uppercase; margin-bottom:6px;">LIVE FEEL & RECOIL SLIDERS</div>
      
      <div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
          <span>Kick Z (Backwards)</span>
          <span id="val-kickZ">${def.recoilKickZ.toFixed(3)}</span>
        </div>
        <input id="slide-kickZ" type="range" min="0.01" max="0.15" step="0.005" value="${def.recoilKickZ}" style="width:100%; accent-color:#00ff88;">
      </div>

      <div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
          <span>Pitch X (Climb)</span>
          <span id="val-pitchX">${def.recoilPitchX.toFixed(3)}</span>
        </div>
        <input id="slide-pitchX" type="range" min="0.01" max="0.15" step="0.005" value="${def.recoilPitchX}" style="width:100%; accent-color:#00ff88;">
      </div>

      <div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
          <span>Recovery Speed</span>
          <span id="val-recovery">${def.recoilRecoverySpeed.toFixed(1)}</span>
        </div>
        <input id="slide-recovery" type="range" min="5" max="35" step="1" value="${def.recoilRecoverySpeed}" style="width:100%; accent-color:#00ff88;">
      </div>

      <div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
          <span>Camera Shake</span>
          <span id="val-camShake">${def.cameraRecoilKick.toFixed(3)}</span>
        </div>
        <input id="slide-camShake" type="range" min="0.005" max="0.05" step="0.002" value="${def.cameraRecoilKick}" style="width:100%; accent-color:#00ff88;">
      </div>

      <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-top:8px; line-height:1.4;">
        Tick Cadence: 4.5 ticks/shot avg (800 RPM @ 60Hz). Press [T] to toggle this HUD.
      </div>
    `;

    // Bind Close
    this.tuningPanel.querySelector('#close-tuning')?.addEventListener('click', () => {
      this.isTuningOpen = false;
      this.tuningPanel.style.display = 'none';
    });

    // Bind SFX Audit Buttons
    this.tuningPanel.querySelector('#sfx-smg-single')?.addEventListener('click', () => {
      sound.playSMGShot(30);
    });
    this.tuningPanel.querySelector('#sfx-smg-burst5')?.addEventListener('click', () => {
      sound.playSMGBurst(5);
    });
    this.tuningPanel.querySelector('#sfx-smg-burst10')?.addEventListener('click', () => {
      sound.playSMGBurst(10);
    });
    this.tuningPanel.querySelector('#sfx-low-ammo')?.addEventListener('click', () => {
      sound.playSMGShot(3);
    });
    this.tuningPanel.querySelector('#sfx-dry-fire')?.addEventListener('click', () => {
      sound.playDryFire();
    });
    this.tuningPanel.querySelector('#sfx-reload-mech')?.addEventListener('click', () => {
      sound.playMagOut();
      setTimeout(() => sound.playMagIn(), 500);
      setTimeout(() => sound.playBoltRack(), 900);
    });

    // Bind Sliders to def
    const bindSlider = (id: string, valId: string, prop: keyof WeaponDef, decimals: number = 3) => {
      const slider = this.tuningPanel.querySelector<HTMLInputElement>(`#${id}`);
      const valLabel = this.tuningPanel.querySelector<HTMLSpanElement>(`#${valId}`);
      if (slider && valLabel) {
        slider.addEventListener('input', () => {
          const num = parseFloat(slider.value);
          (def as unknown as Record<string, number>)[prop as string] = num;
          valLabel.textContent = num.toFixed(decimals);
        });
      }
    };

    bindSlider('slide-kickZ', 'val-kickZ', 'recoilKickZ', 3);
    bindSlider('slide-pitchX', 'val-pitchX', 'recoilPitchX', 3);
    bindSlider('slide-recovery', 'val-recovery', 'recoilRecoverySpeed', 1);
    bindSlider('slide-camShake', 'val-camShake', 'cameraRecoilKick', 3);
  }

  public triggerHitmarker(isCrit: boolean = false) {
    this.lastHitTime = performance.now();
    this.hitmarker.style.opacity = '1';
    const lines = this.hitmarker.querySelectorAll('div');
    lines.forEach((line) => {
      line.style.background = isCrit ? '#ff3b30' : '#ffffff';
      line.style.boxShadow = isCrit ? '0 0 8px #ff3b30' : '0 0 6px #ffffff';
    });

    setTimeout(() => {
      if (performance.now() - this.lastHitTime >= 70) {
        this.hitmarker.style.opacity = '0';
      }
    }, 80);
  }

  public update(state: WeaponState, def: WeaponDef) {
    if (this.isTuningOpen && this.tuningPanel.innerHTML === '') {
      this.renderTuning(def);
    }

    // 1. Crosshair Bloom & ADS Hide
    if (state.isScoped) {
      this.crosshair.style.opacity = '0';
    } else {
      this.crosshair.style.opacity = '1';
      const spreadPx = Math.round(state.spreadRadius * 500);
      const size = Math.max(28, spreadPx);
      this.crosshair.style.width = `${size}px`;
      this.crosshair.style.height = `${size}px`;
    }

    // 2. Ammo Card Content
    const pct = Math.max(0, Math.min(100, (state.ammoInClip / def.magCapacity) * 100));
    const barColor = state.ammoInClip <= 5 ? '#ff3b30' : '#00ff88';

    this.ammoCard.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
        <div>
          <div style="font-weight: 900; font-size: 15px; letter-spacing: 0.5px;">${def.name}</div>
          <div style="font-size: 11px; color: rgba(255,255,255,0.5);">${def.caliber}</div>
        </div>
        <div style="font-size: 10px; font-weight: 800; background: rgba(0,255,136,0.15); border: 1px solid rgba(0,255,136,0.3); color: #00ff88; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
          ${def.fireMode}
        </div>
      </div>

      <div style="display: flex; align-items: baseline; gap: 8px; margin: 12px 0 8px 0;">
        <span style="font-size: 44px; font-weight: 900; line-height: 1; color: ${state.ammoInClip === 0 ? '#ff3b30' : '#ffffff'}; font-variant-numeric: tabular-nums;">
          ${state.ammoInClip}
        </span>
        <span style="font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.4);">
          / ${state.reserveAmmo}
        </span>
      </div>

      <!-- Capacity Gauge Bar -->
      <div style="width: 100%; height: 5px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
        <div style="width: ${pct}%; height: 100%; background: ${barColor}; transition: width 0.1s ease-out, background 0.2s;"></div>
      </div>

      ${
        state.isReloading
          ? `<div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #ffaa00;">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#ffaa00; animation: pulse 1s infinite;"></span>
              RELOADING (${Math.round(state.reloadProgress * 100)}%)
            </div>`
          : `<div style="font-size: 11px; color: rgba(255,255,255,0.4);">PRESS [R] TO RELOAD</div>`
      }
    `;

    // 3. Hotbar
    const isAK = state.currentWeaponId === 'ak47';
    const isPistol = state.currentWeaponId === 'pistol';
    const isSMG = state.currentWeaponId === 'smg';
    this.hotbar.innerHTML = `
      <div style="padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; display:flex; align-items:center; gap:6px; ${
        isAK ? 'background: #00ff88; color: #000; box-shadow: 0 0 16px rgba(0,255,136,0.4);' : 'color: rgba(255,255,255,0.6);'
      }">
        <span style="font-size:10px;opacity:0.7;">[1]</span> AK-47 ASSAULT
      </div>
      <div style="padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; display:flex; align-items:center; gap:6px; ${
        isPistol ? 'background: #00ff88; color: #000; box-shadow: 0 0 16px rgba(0,255,136,0.4);' : 'color: rgba(255,255,255,0.6);'
      }">
        <span style="font-size:10px;opacity:0.7;">[2]</span> M9 COMBAT PISTOL
      </div>
      <div style="padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; display:flex; align-items:center; gap:6px; ${
        isSMG ? 'background: #00ff88; color: #000; box-shadow: 0 0 16px rgba(0,255,136,0.4);' : 'color: rgba(255,255,255,0.6);'
      }">
        <span style="font-size:10px;opacity:0.7;">[3]</span> CYCLONE-9 SMG
      </div>
    `;
  }
}
