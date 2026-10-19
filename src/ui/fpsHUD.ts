// src/ui/fpsHUD.ts
// Tactical Glassmorphism HUD: Dynamic bloom crosshair, hitmarkers, ammo telemetry,
// hotbar for 5 weapons, telescopic sniper scope overlay, and map selection modal.

import type { WeaponState } from '../weapons/weaponManager';
import type { WeaponDef, WeaponId } from '../weapons/weaponTypes';
import { BUILD_STAMP } from '../buildStamp';
import { MAP_INFO, type MapId } from '../environment/blueprintMapLoader';

export class FPSHUD {
  private container: HTMLDivElement;
  private crosshair: HTMLDivElement;
  private hitmarker: HTMLDivElement;
  private ammoCard: HTMLDivElement;
  private hotbar: HTMLDivElement;
  private promptOverlay: HTMLDivElement;
  private controlsCard: HTMLDivElement;
  private tuningPanel: HTMLDivElement;
  private sniperScope: HTMLDivElement;
  private mapBadge: HTMLDivElement;
  private mapModal: HTMLDivElement;
  private oobBanner: HTMLDivElement;
  private rangefinder: HTMLDivElement | null = null;

  private ammoWeaponTitle!: HTMLDivElement;
  private ammoWeaponCaliber!: HTMLDivElement;
  private ammoWeaponMode!: HTMLDivElement;
  private ammoCounterVal!: HTMLSpanElement;
  private ammoReserveVal!: HTMLSpanElement;
  private ammoGaugeFill!: HTMLDivElement;
  private reloadBtn!: HTMLButtonElement;
  private reloadStatusText!: HTMLDivElement;
  private reloadReticle!: HTMLDivElement;
  private reloadReticleCircle!: SVGCircleElement;
  private reloadReticleText!: HTMLDivElement;
  private reloadReadyAlert!: HTMLDivElement;
  private stanceBadge!: HTMLDivElement;

  private lastAmmoInClip: number = -1;
  private lastWeaponId: string = '';
  private lastStatusText: string = '';
  private wasReloading: boolean = false;

  public isTuningOpen: boolean = false;
  public isMapModalOpen: boolean = false;
  public isDismissed: boolean = false;
  private lastHitTime: number = 0;

  public onMapSelect?: (mapId: MapId) => void;
  public onModalOpen?: () => void;
  public onModalClose?: () => void;
  public onReload?: () => void;
  public onWeaponSelect?: (weaponId: WeaponId) => void;

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

    // 0. Build Stamp in HUD Corner
    const stampEl = document.createElement('div');
    stampEl.id = 'hud-build-stamp';
    stampEl.style.cssText = `
      position: absolute;
      top: 14px;
      left: 18px;
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 11px;
      font-weight: 500;
      color: rgba(0, 255, 136, 0.85);
      background: rgba(10, 16, 22, 0.65);
      border: 1px solid rgba(0, 255, 136, 0.25);
      border-radius: 6px;
      padding: 4px 10px;
      letter-spacing: 0.5px;
      backdrop-filter: blur(8px);
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      pointer-events: none;
    `;
    stampEl.textContent = BUILD_STAMP;
    this.container.appendChild(stampEl);

    // 0.05 Stance Badge
    this.stanceBadge = document.createElement('div');
    this.stanceBadge.id = 'hud-stance-badge';
    this.stanceBadge.style.cssText = `
      position: absolute;
      top: 14px;
      left: 170px;
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.75);
      background: rgba(10, 16, 22, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 4px 10px;
      letter-spacing: 0.5px;
      backdrop-filter: blur(8px);
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      pointer-events: none;
      transition: all 0.15s ease;
    `;
    this.stanceBadge.textContent = 'STANCE: STAND [C]';
    this.container.appendChild(this.stanceBadge);

    // 0.1 Map Selector Badge (Top Center)
    this.mapBadge = document.createElement('div');
    this.mapBadge.id = 'hud-map-badge';
    this.mapBadge.style.cssText = `
      position: absolute;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10, 16, 22, 0.8);
      border: 1px solid rgba(0, 255, 136, 0.35);
      backdrop-filter: blur(12px);
      border-radius: 8px;
      padding: 6px 16px;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      cursor: pointer;
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      transition: all 0.15s ease;
    `;
    this.mapBadge.innerHTML = `
      <span style="color:#00ff88;font-size:12px;">◈</span>
      <span id="map-badge-name">MAP: SHOOTING RANGE</span>
      <span style="background:rgba(0,255,136,0.15);padding:2px 6px;border-radius:4px;font-size:10px;color:#00ff88;">[M]</span>
    `;
    this.mapBadge.addEventListener('click', () => this.toggleMapModal());
    this.container.appendChild(this.mapBadge);

    // 0.2 Map Selection Modal
    this.mapModal = document.createElement('div');
    this.mapModal.id = 'map-selection-modal';
    this.mapModal.style.cssText = `
      position: absolute;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10, 16, 22, 0.95);
      border: 1px solid rgba(0, 255, 136, 0.4);
      backdrop-filter: blur(16px);
      border-radius: 14px;
      padding: 16px 20px;
      color: #fff;
      display: none;
      pointer-events: auto;
      z-index: 130;
      box-shadow: 0 16px 40px rgba(0,0,0,0.8);
      min-width: 380px;
    `;
    this.renderMapModal();
    this.container.appendChild(this.mapModal);

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

    // 1.1 Center Tactical Reload Reticle Indicator
    this.reloadReticle = document.createElement('div');
    this.reloadReticle.id = 'hud-reload-reticle';
    this.reloadReticle.innerHTML = `
      <svg width="96" height="96" viewBox="0 0 96 96" style="display:block;">
        <circle cx="48" cy="48" r="38" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="3" />
        <circle id="reload-ring-circle" class="reload-reticle-ring" cx="48" cy="48" r="38" fill="none" stroke="#ffaa00" stroke-width="3.5" stroke-dasharray="238.76" stroke-dashoffset="238.76" stroke-linecap="round" />
      </svg>
      <div id="reload-reticle-text" style="position:absolute;top:calc(50% + 44px);left:50%;transform:translateX(-50%);font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;font-weight:800;letter-spacing:1px;color:#ffaa00;white-space:nowrap;text-shadow:0 0 10px rgba(255,170,0,0.65);text-transform:uppercase;">
        RELOADING
      </div>
    `;
    this.reloadReticleCircle = this.reloadReticle.querySelector('#reload-ring-circle') as SVGCircleElement;
    this.reloadReticleText = this.reloadReticle.querySelector('#reload-reticle-text') as HTMLDivElement;
    this.container.appendChild(this.reloadReticle);

    // 1.2 Center Reload Ready Flash Alert
    this.reloadReadyAlert = document.createElement('div');
    this.reloadReadyAlert.id = 'hud-reload-ready-alert';
    this.reloadReadyAlert.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 2.5px;
      color: #00ff88;
      text-shadow: 0 0 14px #00ff88, 0 0 28px rgba(0,255,136,0.6);
      pointer-events: none;
      display: none;
      z-index: 121;
      white-space: nowrap;
    `;
    this.reloadReadyAlert.textContent = 'READY';
    this.container.appendChild(this.reloadReadyAlert);

    // 1.3 Debug Rangefinder Overlay (?debug=1)
    const isDebugUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
    if (isDebugUrl) {
      this.rangefinder = document.createElement('div');
      this.rangefinder.id = 'hud-rangefinder';
      this.rangefinder.style.cssText = `
        position: absolute;
        top: calc(50% + 28px);
        left: 50%;
        transform: translateX(-50%);
        font-family: 'JetBrains Mono', Consolas, monospace;
        font-size: 11px;
        font-weight: 600;
        color: #00ff88;
        background: rgba(10, 16, 22, 0.75);
        border: 1px solid rgba(0, 255, 136, 0.35);
        border-radius: 4px;
        padding: 2px 8px;
        letter-spacing: 0.5px;
        pointer-events: none;
        white-space: nowrap;
        backdrop-filter: blur(4px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      `;
      this.rangefinder.textContent = 'RANGE: -- | MULT: 100%';
      this.container.appendChild(this.rangefinder);
    }

    // 1.5 High-Power Telescopic Sniper Scope Overlay
    this.sniperScope = document.createElement('div');
    this.sniperScope.id = 'sniper-scope-overlay';
    this.sniperScope.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      display: none;
      z-index: 95;
    `;
    this.sniperScope.innerHTML = `
      <div style="position:absolute;inset:0;background:radial-gradient(circle 380px at center, transparent 350px, rgba(4,6,8,0.96) 370px, #000 100%);"></div>
      <div style="position:absolute;top:50%;left:0;width:100%;height:1px;background:rgba(255,255,255,0.7);box-shadow:0 0 2px #fff;"></div>
      <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:rgba(255,255,255,0.7);box-shadow:0 0 2px #fff;"></div>
      <div style="position:absolute;top:50%;left:50%;width:4px;height:4px;background:#ff3333;transform:translate(-50%,-50%);border-radius:50%;box-shadow:0 0 6px #ff2222;"></div>
      <!-- Mil-dot ticks -->
      <div style="position:absolute;top:calc(50% - 40px);left:50%;width:8px;height:1px;background:#fff;transform:translateX(-50%);"></div>
      <div style="position:absolute;top:calc(50% + 40px);left:50%;width:8px;height:1px;background:#fff;transform:translateX(-50%);"></div>
      <div style="position:absolute;left:calc(50% - 40px);top:50%;width:1px;height:8px;background:#fff;transform:translateY(-50%);"></div>
      <div style="position:absolute;left:calc(50% + 40px);top:50%;width:1px;height:8px;background:#fff;transform:translateY(-50%);"></div>
      <div style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);font-family:monospace;font-size:12px;color:rgba(0,255,136,0.8);letter-spacing:2px;">AW-50 OPTIC [8X TELESCOPIC]</div>
    `;
    this.container.appendChild(this.sniperScope);

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
    this.ammoCard.id = 'hud-ammo-card';
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
      pointer-events: auto;
    `;
    this.ammoCard.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
        <div>
          <div id="ammo-weapon-title" style="font-weight: 900; font-size: 15px; letter-spacing: 0.5px; transition: transform 0.2s ease;">AK-47</div>
          <div id="ammo-weapon-caliber" style="font-size: 11px; color: rgba(255,255,255,0.5);">7.62x39mm</div>
        </div>
        <div id="ammo-weapon-mode" style="font-size: 10px; font-weight: 800; background: rgba(0,255,136,0.15); border: 1px solid rgba(0,255,136,0.3); color: #00ff88; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
          AUTO
        </div>
      </div>

      <div style="display: flex; align-items: baseline; gap: 8px; margin: 10px 0 6px 0;">
        <span id="ammo-counter" style="font-size: 46px; font-weight: 900; line-height: 1; color: #ffffff; font-variant-numeric: tabular-nums; display: inline-block;">
          30
        </span>
        <span id="ammo-reserve" style="font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.4);">
          / 90
        </span>
      </div>

      <!-- Tactical Phase Status Ticker -->
      <div id="hud-reload-status" style="font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.5); font-family: 'JetBrains Mono', Consolas, monospace; letter-spacing: 0.8px; margin-bottom: 6px; height: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        STATUS: READY
      </div>

      <!-- Capacity Gauge Bar -->
      <div id="ammo-gauge-track" style="width: 100%; height: 5px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-bottom: 8px; position: relative;">
        <div id="ammo-gauge-fill" style="width: 100%; height: 100%; background: #00ff88; transition: width 0.12s ease-out, background 0.2s;"></div>
      </div>

      <!-- Interactive Tactical Reload Button -->
      <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between;">
        <button id="hud-reload-btn" class="hud-reload-action" style="
          background: rgba(0,255,136,0.18);
          border: 1px solid rgba(0,255,136,0.45);
          color: #00ff88;
          padding: 6px 14px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          cursor: pointer;
          pointer-events: auto;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 0 10px rgba(0,255,136,0.15);
        ">
          [R] RELOAD
        </button>
        <span style="font-size: 10px; color: rgba(255,255,255,0.4); font-family: 'JetBrains Mono', Consolas, monospace;">PRESS [R]</span>
      </div>
    `;

    this.ammoWeaponTitle = this.ammoCard.querySelector('#ammo-weapon-title') as HTMLDivElement;
    this.ammoWeaponCaliber = this.ammoCard.querySelector('#ammo-weapon-caliber') as HTMLDivElement;
    this.ammoWeaponMode = this.ammoCard.querySelector('#ammo-weapon-mode') as HTMLDivElement;
    this.ammoCounterVal = this.ammoCard.querySelector('#ammo-counter') as HTMLSpanElement;
    this.ammoReserveVal = this.ammoCard.querySelector('#ammo-reserve') as HTMLSpanElement;
    this.ammoGaugeFill = this.ammoCard.querySelector('#ammo-gauge-fill') as HTMLDivElement;
    this.reloadBtn = this.ammoCard.querySelector('#hud-reload-btn') as HTMLButtonElement;
    this.reloadStatusText = this.ammoCard.querySelector('#hud-reload-status') as HTMLDivElement;

    this.ammoCard.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target && (target.id === 'hud-reload-btn' || target.closest('#hud-reload-btn') || target.classList.contains('hud-reload-action') || target.closest('.hud-reload-action'))) {
        e.stopPropagation();
        this.onReload?.();
      }
    });
    this.container.appendChild(this.ammoCard);

    // 4. Weapon Selection Hotbar (Bottom-Center)
    this.hotbar = document.createElement('div');
    this.hotbar.style.cssText = `
      position: absolute;
      bottom: 35px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
      background: rgba(10, 16, 22, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px);
      border-radius: 14px;
      padding: 8px 12px;
      pointer-events: auto;
    `;
    this.hotbar.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-weapon-id]') as HTMLElement;
      if (target) {
        const wid = target.getAttribute('data-weapon-id') as WeaponId;
        if (wid && this.onWeaponSelect) {
          e.stopPropagation();
          this.onWeaponSelect(wid);
        }
      }
    });
    this.renderHotbar();
    this.container.appendChild(this.hotbar);

    // 4.1 Out-Of-Bounds Tactical Alert Banner (Center Screen)
    this.oobBanner = document.createElement('div');
    this.oobBanner.id = 'hud-oob-banner';
    this.oobBanner.style.cssText = `
      position: absolute;
      top: 25%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(220, 20, 60, 0.9);
      border: 2px solid #ff4466;
      border-radius: 10px;
      padding: 14px 30px;
      color: #fff;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      box-shadow: 0 0 30px rgba(255, 0, 50, 0.6);
      display: none;
      z-index: 150;
      pointer-events: none;
      text-align: center;
      line-height: 1.4;
    `;
    this.container.appendChild(this.oobBanner);

    // 5. Controls Guide Overlay (Top-Left)
    this.controlsCard = document.createElement('div');
    this.controlsCard.style.cssText = `
      position: absolute;
      top: 52px;
      left: 18px;
      background: rgba(10, 16, 22, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      padding: 12px 16px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 11px;
      letter-spacing: 0.5px;
      line-height: 1.5;
    `;
    this.controlsCard.innerHTML = `
      <div style="font-weight: 800; color: #00ff88; margin-bottom: 4px; font-size: 11px; text-transform: uppercase;">
        OPERATIVE COMBAT CONTROLS
      </div>
      <div><span style="color:#00ff88;font-weight:bold;">LMB</span> — Fire Weapon | <span style="color:#00ff88;font-weight:bold;">RMB / Q</span> — ADS</div>
      <div><span style="color:#00ff88;font-weight:bold;">1-5</span> — Switch (AK / Pistol / SMG / Shotgun / Sniper)</div>
      <div><span style="color:#00ff88;font-weight:bold;">M</span> — Map Select | <span style="color:#00ff88;font-weight:bold;">R</span> — Reload | <span style="color:#00ff88;font-weight:bold;">V</span> — Inspect</div>
      <div><span style="color:#00ff88;font-weight:bold;">WASD</span> — Move | <span style="color:#00ff88;font-weight:bold;">Shift</span> — Sprint | <span style="color:#00ff88;font-weight:bold;">Space</span> — Jump</div>
    `;
    this.container.appendChild(this.controlsCard);

    // 6. Click-to-Play Overlay
    this.promptOverlay = document.createElement('div');
    this.promptOverlay.id = 'instructions-overlay';
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
        VANGUARD COMBAT PROTOCOL
      </div>
      <h1 style="font-size: 52px; font-weight: 900; letter-spacing: -1px; margin: 0 0 12px 0; text-transform: uppercase; text-shadow: 0 0 35px rgba(0,255,136,0.5);">
        VANGUARD ARENA FPS
      </h1>
      <p style="font-size: 15px; color: rgba(255,255,255,0.7); max-width: 520px; text-align: center; margin: 0 0 28px 0; line-height: 1.5;">
        5 authentic firearms (AK-47, M9 Pistol, Cyclone-9 SMG, SPAS-12 Shotgun, AW-50 Sniper),
        6 arena maps (Foundry Yard, Cul-de-Sac, Dustline Village, Overpass, Neighborhood, Warehouse), and tactical proving grounds.
      </p>
      <div id="btn-engage" style="background: linear-gradient(135deg, #00ff88, #00bb66); color: #04080c; font-weight: 900; font-size: 14px; padding: 16px 36px; border-radius: 14px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 0 40px rgba(0,255,136,0.6); display: flex; align-items: center; gap: 10px;">
        CLICK ANYWHERE TO ENGAGE
      </div>
    `;
    this.container.appendChild(this.promptOverlay);

    // 7. Tactical Weapon Tuning Panel
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

    this.promptOverlay.addEventListener('click', () => {
      this.isDismissed = true;
      this.promptOverlay.style.display = 'none';
    });
  }

  public setMapName(name: string) {
    const el = this.mapBadge.querySelector('#map-badge-name');
    if (el) {
      el.textContent = `MAP: ${name.toUpperCase()}`;
    }
  }

  public toggleMapModal() {
    this.isMapModalOpen = !this.isMapModalOpen;
    this.mapModal.style.display = this.isMapModalOpen ? 'block' : 'none';
    if (this.isMapModalOpen) {
      this.onModalOpen?.();
    } else {
      this.onModalClose?.();
    }
  }

  public closeMapModal() {
    if (this.isMapModalOpen) {
      this.isMapModalOpen = false;
      this.mapModal.style.display = 'none';
      this.onModalClose?.();
    }
  }

  private renderMapModal() {
    const maps: MapId[] = ['range', 'foundry', 'culdesac', 'dustline', 'overpass', 'neighborhood', 'warehouse'];
    // Registered tactical map selector suites: ['neighborhood'] and ['warehouse']
    this.mapModal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
        <span style="font-weight: 800; color: #00ff88; font-size: 13px;">TACTICAL MAP ARENA SELECTOR</span>
        <span id="close-map-modal" style="cursor: pointer; color: #888; font-weight: bold; font-size: 14px;">✕</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${maps
          .map(
            (id) => `
          <button data-map-id="${id}" style="
            background: rgba(20, 28, 36, 0.7);
            border: 1px solid rgba(0, 255, 136, 0.2);
            color: #ffffff;
            padding: 10px 14px;
            border-radius: 8px;
            cursor: pointer;
            text-align: left;
            font-size: 12px;
            font-weight: 700;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.15s ease;
          " onmouseover="this.style.background='rgba(0,255,136,0.15)';this.style.borderColor='#00ff88';" onmouseout="this.style.background='rgba(20,28,36,0.7)';this.style.borderColor='rgba(0,255,136,0.2)';">
            <span>${MAP_INFO[id].name}</span>
            <span style="font-size:10px; color:#00ff88; opacity:0.8;">LOAD</span>
          </button>
        `
          )
          .join('')}
      </div>
    `;

    this.mapModal.querySelector('#close-map-modal')?.addEventListener('click', () => {
      this.closeMapModal();
    });

    this.mapModal.querySelectorAll('button[data-map-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = (e.currentTarget as HTMLElement).getAttribute('data-map-id') as MapId;
        if (target && this.onMapSelect) {
          this.closeMapModal();
          this.onMapSelect(target);
        }
      });
    });
  }

  public setPointerLocked(isLocked: boolean) {
    if (isLocked) {
      this.isDismissed = true;
      this.promptOverlay.style.display = 'none';
    } else if (!this.isDismissed) {
      this.promptOverlay.style.display = 'flex';
    }
  }

  public toggleTuning(_activeDef?: WeaponDef) {
    this.isTuningOpen = !this.isTuningOpen;
    this.tuningPanel.style.display = this.isTuningOpen ? 'block' : 'none';
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

  private renderHotbar() {
    const hotbarSlots = [
      { key: '1', id: 'ak47', label: 'AK-47' },
      { key: '2', id: 'pistol', label: 'M9 PISTOL' },
      { key: '3', id: 'smg', label: 'CYCLONE-9' },
      { key: '4', id: 'shotgun', label: 'SPAS-12' },
      { key: '5', id: 'sniper', label: 'AW-50' },
    ];

    this.hotbar.innerHTML = hotbarSlots
      .map((slot) => `
        <div data-weapon-id="${slot.id}" style="padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; display:flex; align-items:center; gap:5px; cursor: pointer; pointer-events: auto; user-select: none; transition: all 0.15s ease; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.04);">
          <span style="font-size:10px;opacity:0.7;">[${slot.key}]</span> ${slot.label}
        </div>
      `)
      .join('');
  }

  private getTacticalStatusText(
    weaponId: WeaponId,
    progress: number,
    isReloading: boolean,
    ammoInClip: number,
    magCapacity: number
  ): string {
    if (isReloading) {
      const pct = Math.round(progress * 100);
      switch (weaponId) {
        case 'ak47':
          if (progress < 0.20) return `WORKSPACE TILT & RELEASE (${pct}%)`;
          if (progress < 0.44) return `EJECTING BANANA MAG (${pct}%)`;
          if (progress < 0.68) return `INSERTING FRESH 30-RD MAG (${pct}%)`;
          if (ammoInClip === 0 || progress < 0.85) return `CYCLING CHARGING HANDLE (${pct}%)`;
          return `RETURNING TO FOREGRIP (${pct}%)`;
        case 'shotgun':
          return `FEEDING 12-GAUGE SHELL (${pct}%)`;
        case 'sniper':
          if (progress < 0.20) return `UNLOCKING .50 BMG BOLT (${pct}%)`;
          if (progress < 0.44) return `REMOVING BOX MAG (${pct}%)`;
          if (progress < 0.72) return `SEATING HEAVY .50 BMG MAG (${pct}%)`;
          return `CHAMBERING & BOLT LOCK (${pct}%)`;
        case 'pistol':
          if (progress < 0.22) return `RETRIEVING COMBAT MAG (${pct}%)`;
          if (progress < 0.68) return `SEATING 15-RD MAG (${pct}%)`;
          return `TACTICAL SLIDE RELEASE (${pct}%)`;
        case 'smg':
          if (progress < 0.20) return `STRIPPING STICK MAG (${pct}%)`;
          if (progress < 0.68) return `SLAPPING 30-RD STICK (${pct}%)`;
          return `RACKING CHARGING HANDLE (${pct}%)`;
        default:
          return `TACTICAL RELOAD (${pct}%)`;
      }
    }

    if (ammoInClip === 0) {
      return 'CRITICAL: EMPTY - PRESS [R]';
    }
    if (ammoInClip <= 3) {
      return 'WARNING: LOW AMMO ADVISORY';
    }
    if (ammoInClip >= magCapacity) {
      return 'STATUS: FULL / READY';
    }
    return 'STATUS: WEAPON HOT';
  }

  public update(state: WeaponState, def: WeaponDef) {
    // 1. Crosshair Bloom & Sniper Scope Overlay
    if (def.isSniperScope && state.isScoped) {
      this.crosshair.style.opacity = '0';
      this.sniperScope.style.display = 'block';
    } else if (state.isScoped) {
      this.crosshair.style.opacity = '0';
      this.sniperScope.style.display = 'none';
    } else {
      this.crosshair.style.opacity = '1';
      this.sniperScope.style.display = 'none';
      const spreadPx = Math.round(state.spreadRadius * 500);
      const size = Math.max(28, spreadPx);
      this.crosshair.style.width = `${size}px`;
      this.crosshair.style.height = `${size}px`;
    }

    // 2. Weapon Switch Detection & Text Reveal
    if (state.currentWeaponId !== this.lastWeaponId) {
      this.lastWeaponId = state.currentWeaponId;
      this.ammoWeaponTitle.textContent = def.name;
      this.ammoWeaponCaliber.textContent = def.caliber;
      this.ammoWeaponMode.textContent = def.fireMode;

      this.ammoWeaponTitle.classList.remove('weapon-title-reveal');
      void this.ammoWeaponTitle.offsetWidth; // trigger reflow
      this.ammoWeaponTitle.classList.add('weapon-title-reveal');

      this.ammoWeaponCaliber.classList.remove('caliber-slide-reveal');
      void this.ammoWeaponCaliber.offsetWidth;
      this.ammoWeaponCaliber.classList.add('caliber-slide-reveal');

      this.ammoWeaponMode.classList.remove('badge-pop-reveal');
      void this.ammoWeaponMode.offsetWidth;
      this.ammoWeaponMode.classList.add('badge-pop-reveal');

      // Update hotbar selection
      const slots = this.hotbar.querySelectorAll('[data-weapon-id]');
      slots.forEach((slot) => {
        const wid = slot.getAttribute('data-weapon-id');
        const isSel = wid === state.currentWeaponId;
        (slot as HTMLElement).style.background = isSel ? '#00ff88' : 'rgba(255,255,255,0.04)';
        (slot as HTMLElement).style.color = isSel ? '#000000' : 'rgba(255,255,255,0.6)';
        (slot as HTMLElement).style.boxShadow = isSel ? '0 0 16px rgba(0,255,136,0.4)' : 'none';
        (slot as HTMLElement).style.transform = isSel ? 'translateY(-1px)' : 'none';
      });
    }

    // 3. Kinetic Ammo Counter Animation on Shot & Reload Commit
    if (this.lastAmmoInClip !== -1) {
      if (state.ammoInClip < this.lastAmmoInClip) {
        this.ammoCounterVal.classList.remove('ammo-punch');
        this.ammoCounterVal.classList.remove('ammo-restock-bloom');
        void this.ammoCounterVal.offsetWidth; // trigger reflow
        this.ammoCounterVal.classList.add('ammo-punch');
      } else if (state.ammoInClip > this.lastAmmoInClip) {
        this.ammoCounterVal.classList.remove('ammo-punch');
        this.ammoCounterVal.classList.remove('ammo-restock-bloom');
        void this.ammoCounterVal.offsetWidth;
        this.ammoCounterVal.classList.add('ammo-restock-bloom');
      }
    }
    this.lastAmmoInClip = state.ammoInClip;

    this.ammoCounterVal.textContent = `${state.ammoInClip}`;
    this.ammoReserveVal.textContent = `/ ${state.reserveAmmo}`;

    // 4. Low Ammo & Critical Alert Typography
    if (state.ammoInClip === 0) {
      this.ammoCounterVal.style.color = '#ff3b30';
      this.ammoCounterVal.classList.remove('ammo-low-pulse');
      this.ammoCounterVal.classList.add('hud-empty-flash');
    } else if (state.ammoInClip <= 3) {
      this.ammoCounterVal.classList.remove('hud-empty-flash');
      this.ammoCounterVal.classList.add('ammo-low-pulse');
    } else {
      this.ammoCounterVal.classList.remove('ammo-low-pulse');
      this.ammoCounterVal.classList.remove('hud-empty-flash');
      this.ammoCounterVal.style.color = '#ffffff';
    }

    // 5. Gauge Bar Fill & Shimmer Effect
    const pct = Math.max(0, Math.min(100, (state.ammoInClip / def.magCapacity) * 100));
    this.ammoGaugeFill.style.width = `${pct}%`;

    if (state.isReloading) {
      this.ammoGaugeFill.classList.add('reload-shimmer-bar');
    } else {
      this.ammoGaugeFill.classList.remove('reload-shimmer-bar');
      this.ammoGaugeFill.style.background = state.ammoInClip <= 3 ? '#ff3b30' : '#00ff88';
      this.ammoGaugeFill.style.boxShadow = state.ammoInClip <= 3 ? '0 0 8px rgba(255,59,48,0.5)' : '0 0 8px rgba(0,255,136,0.4)';
    }

    // 6. Tactical Status Text Ticker with Smooth Phase Swap
    const statusText = this.getTacticalStatusText(
      state.currentWeaponId,
      state.reloadProgress,
      state.isReloading,
      state.ammoInClip,
      def.magCapacity
    );
    if (statusText !== this.lastStatusText) {
      this.lastStatusText = statusText;
      this.reloadStatusText.textContent = statusText;
      this.reloadStatusText.classList.remove('status-ticker-swap');
      void this.reloadStatusText.offsetWidth;
      this.reloadStatusText.classList.add('status-ticker-swap');
    }
    if (state.isReloading) {
      this.reloadStatusText.style.color = '#ffaa00';
    } else if (state.ammoInClip === 0) {
      this.reloadStatusText.style.color = '#ff4455';
    } else if (state.ammoInClip <= 3) {
      this.reloadStatusText.style.color = '#ffaa00';
    } else {
      this.reloadStatusText.style.color = 'rgba(255,255,255,0.45)';
    }

    // 7. Tactical Reload Button State
    if (state.isReloading) {
      this.reloadBtn.style.background = 'rgba(255,170,0,0.22)';
      this.reloadBtn.style.borderColor = '#ffaa00';
      this.reloadBtn.style.color = '#ffaa00';
      this.reloadBtn.style.boxShadow = '0 0 12px rgba(255,170,0,0.3)';
      this.reloadBtn.style.cursor = 'default';
      this.reloadBtn.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ffaa00;"></span> RELOADING (${Math.round(state.reloadProgress * 100)}%)`;
    } else if (state.ammoInClip === 0) {
      this.reloadBtn.style.background = 'rgba(255,59,48,0.28)';
      this.reloadBtn.style.borderColor = '#ff3b30';
      this.reloadBtn.style.color = '#ff6677';
      this.reloadBtn.style.boxShadow = '0 0 14px rgba(255,59,48,0.4)';
      this.reloadBtn.style.cursor = 'pointer';
      this.reloadBtn.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff3b30;"></span> [R] RELOAD NOW`;
    } else if (state.ammoInClip >= def.magCapacity) {
      this.reloadBtn.style.background = 'rgba(255,255,255,0.06)';
      this.reloadBtn.style.borderColor = 'rgba(255,255,255,0.15)';
      this.reloadBtn.style.color = 'rgba(255,255,255,0.5)';
      this.reloadBtn.style.boxShadow = 'none';
      this.reloadBtn.style.cursor = 'pointer';
      this.reloadBtn.textContent = 'FULL [R]';
    } else {
      this.reloadBtn.style.background = 'rgba(0,255,136,0.18)';
      this.reloadBtn.style.borderColor = 'rgba(0,255,136,0.45)';
      this.reloadBtn.style.color = '#00ff88';
      this.reloadBtn.style.boxShadow = '0 0 10px rgba(0,255,136,0.15)';
      this.reloadBtn.style.cursor = 'pointer';
      this.reloadBtn.textContent = '[R] RELOAD';
    }

    // 8. Center-Screen Tactical Reload Reticle Indicator
    if (state.isReloading) {
      this.reloadReticle.classList.add('active');
      const circumference = 238.76;
      const offset = circumference * (1 - state.reloadProgress);
      this.reloadReticleCircle.style.strokeDashoffset = `${offset.toFixed(1)}`;
      this.reloadReticleText.textContent = `${Math.round(state.reloadProgress * 100)}%`;
    } else {
      this.reloadReticle.classList.remove('active');
    }

    // Flash READY banner when reload finishes
    if (this.wasReloading && !state.isReloading) {
      this.reloadReadyAlert.style.display = 'block';
      this.reloadReadyAlert.classList.remove('reload-ready-banner');
      void this.reloadReadyAlert.offsetWidth;
      this.reloadReadyAlert.classList.add('reload-ready-banner');
      setTimeout(() => {
        this.reloadReadyAlert.style.display = 'none';
      }, 650);
    }
    this.wasReloading = state.isReloading;
  }

  public showOOBWarning(remainingSec: number) {
    if (this.oobBanner) {
      this.oobBanner.style.display = 'block';
      this.oobBanner.innerHTML = `
        <div style="font-size:13px;letter-spacing:2px;opacity:0.85;margin-bottom:4px;">⚠ COMBAT AREA BOUNDARY EXCEEDED</div>
        <div style="font-size:22px;color:#ffff00;font-weight:900;">RETURN TO BATTLEFIELD: ${remainingSec}s</div>
      `;
    }
  }

  public clearOOBWarning() {
    if (this.oobBanner) {
      this.oobBanner.style.display = 'none';
    }
  }

  public updateDebugRangefinder(
    distance: number | null,
    multiplier: number,
    damage: number,
    inRange: boolean,
    weaponName?: string
  ) {
    if (!this.rangefinder) return;
    if (distance === null || !inRange) {
      this.rangefinder.textContent = `RANGE: ${distance !== null ? distance.toFixed(1) + 'm' : '--'} | OUT OF RANGE (0 dmg)`;
      this.rangefinder.style.color = '#ff4444';
      this.rangefinder.style.borderColor = 'rgba(255, 68, 68, 0.4)';
    } else {
      const pct = Math.round(multiplier * 100);
      this.rangefinder.textContent = `DST: ${distance.toFixed(1)}m | DMG: ${damage} (${pct}%) ${weaponName ? '[' + weaponName + ']' : ''}`;
      this.rangefinder.style.color = multiplier === 1.0 ? '#00ff88' : (multiplier > 0.4 ? '#ffcc00' : '#ff8844');
      this.rangefinder.style.borderColor = multiplier === 1.0 ? 'rgba(0, 255, 136, 0.35)' : 'rgba(255, 204, 0, 0.4)';
    }
  }

  public updateStance(isCrouching: boolean, isOverheadBlocked: boolean) {
    if (!this.stanceBadge) return;
    if (isCrouching) {
      if (isOverheadBlocked) {
        this.stanceBadge.textContent = 'STANCE: CROUCH [CEILING BLOCKED]';
        this.stanceBadge.style.color = '#ffaa00';
        this.stanceBadge.style.borderColor = 'rgba(255, 170, 0, 0.6)';
        this.stanceBadge.style.background = 'rgba(35, 22, 8, 0.85)';
      } else {
        this.stanceBadge.textContent = 'STANCE: CROUCH [C]';
        this.stanceBadge.style.color = '#00ff88';
        this.stanceBadge.style.borderColor = 'rgba(0, 255, 136, 0.5)';
        this.stanceBadge.style.background = 'rgba(10, 24, 16, 0.8)';
      }
    } else {
      this.stanceBadge.textContent = 'STANCE: STAND [C]';
      this.stanceBadge.style.color = 'rgba(255, 255, 255, 0.75)';
      this.stanceBadge.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      this.stanceBadge.style.background = 'rgba(10, 16, 22, 0.65)';
    }
  }
}

