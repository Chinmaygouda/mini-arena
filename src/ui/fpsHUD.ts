// src/ui/fpsHUD.ts
// Tactical Glassmorphism HUD: Dynamic bloom crosshair, hitmarkers, ammo telemetry,
// hotbar for 5 weapons, telescopic sniper scope overlay, and map selection modal.

import type { WeaponState } from '../weapons/weaponManager';
import type { WeaponDef } from '../weapons/weaponTypes';
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

  public isTuningOpen: boolean = false;
  public isMapModalOpen: boolean = false;
  public isDismissed: boolean = false;
  private lastHitTime: number = 0;

  public onMapSelect?: (mapId: MapId) => void;
  public onModalOpen?: () => void;
  public onModalClose?: () => void;

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

    // 1.2 Debug Rangefinder Overlay (?debug=1)
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
      gap: 8px;
      background: rgba(10, 16, 22, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px);
      border-radius: 14px;
      padding: 8px 12px;
    `;
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
        4 arena maps (Foundry Yard, Cul-de-Sac, Dustline Village, Overpass), and tactical proving grounds.
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
    const maps: MapId[] = ['range', 'foundry', 'culdesac', 'dustline', 'overpass'];
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

    // 2. Ammo Card Content
    const pct = Math.max(0, Math.min(100, (state.ammoInClip / def.magCapacity) * 100));
    const barColor = state.ammoInClip <= 3 ? '#ff3b30' : '#00ff88';

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
        <span id="ammo-counter" style="font-size: 44px; font-weight: 900; line-height: 1; color: ${state.ammoInClip === 0 ? '#ff3b30' : '#ffffff'}; font-variant-numeric: tabular-nums;">
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
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#ffaa00;"></span>
              RELOADING (${Math.round(state.reloadProgress * 100)}%)
            </div>`
          : `<div style="font-size: 11px; color: rgba(255,255,255,0.4);">PRESS [R] TO RELOAD</div>`
      }
    `;

    // 3. Hotbar: 5 Weapons
    const active = state.currentWeaponId;
    const hotbarSlots = [
      { key: '1', id: 'ak47', label: 'AK-47' },
      { key: '2', id: 'pistol', label: 'M9 PISTOL' },
      { key: '3', id: 'smg', label: 'CYCLONE-9' },
      { key: '4', id: 'shotgun', label: 'SPAS-12' },
      { key: '5', id: 'sniper', label: 'AW-50' },
    ];

    this.hotbar.innerHTML = hotbarSlots
      .map((slot) => {
        const isSel = active === slot.id;
        return `
          <div style="padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; display:flex; align-items:center; gap:5px; ${
            isSel
              ? 'background: #00ff88; color: #000; box-shadow: 0 0 16px rgba(0,255,136,0.4);'
              : 'color: rgba(255,255,255,0.6);'
          }">
            <span style="font-size:10px;opacity:0.7;">[${slot.key}]</span> ${slot.label}
          </div>
        `;
      })
      .join('');
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
}

