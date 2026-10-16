// src/ui/fpsHUD.ts
// Tactical Glassmorphism HUD: Dynamic bloom crosshair, hitmarkers, ammo telemetry, and hotbar

import type { WeaponState } from '../weapons/weaponManager';
import type { WeaponDef } from '../weapons/weaponTypes';

export class FPSHUD {
  private container: HTMLDivElement;
  private crosshair: HTMLDivElement;
  private hitmarker: HTMLDivElement;
  private ammoCard: HTMLDivElement;
  private hotbar: HTMLDivElement;
  private promptOverlay: HTMLDivElement;
  private controlsCard: HTMLDivElement;
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
      <div><span style="color:#00ff88;font-weight:bold;">LMB</span> — Fire Weapon (Full-Auto)</div>
      <div><span style="color:#00ff88;font-weight:bold;">RMB / Q</span> — Aim Down Sights (ADS)</div>
      <div><span style="color:#00ff88;font-weight:bold;">R</span> — Tactical Reload</div>
      <div><span style="color:#00ff88;font-weight:bold;">1 / 2</span> — Switch Weapon (AK-47 / Pistol)</div>
      <div><span style="color:#00ff88;font-weight:bold;">V</span> — Weapon Inspect Animation</div>
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
    this.hotbar.innerHTML = `
      <div style="padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; display:flex; align-items:center; gap:6px; ${
        isAK ? 'background: #00ff88; color: #000; box-shadow: 0 0 16px rgba(0,255,136,0.4);' : 'color: rgba(255,255,255,0.6);'
      }">
        <span style="font-size:10px;opacity:0.7;">[1]</span> AK-47 ASSAULT
      </div>
      <div style="padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; display:flex; align-items:center; gap:6px; ${
        !isAK ? 'background: #00ff88; color: #000; box-shadow: 0 0 16px rgba(0,255,136,0.4);' : 'color: rgba(255,255,255,0.6);'
      }">
        <span style="font-size:10px;opacity:0.7;">[2]</span> M9 COMBAT PISTOL
      </div>
    `;
  }
}
