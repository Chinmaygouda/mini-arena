// src/ui/soundTestModal.ts
// Interactive UI for ?soundtest=1
// Provides buttons for all 29 recorded handling effects (with file, source, license),
// 'Play Full Reload' per weapon, and embedded native HTML5 audio players for the rendered WAVs.

import { sound, type HandlingSoundKey } from '../audio/soundManager.ts';
import type { WeaponManager } from '../weapons/weaponManager.ts';

interface SoundMeta {
  key: HandlingSoundKey;
  label: string;
  category: string;
  source: string;
  license: string;
  url: string;
}

const SOUND_CATALOG: SoundMeta[] = [
  // AK-47
  {
    key: 'ak_mag_out_01',
    label: 'AK-47 Mag Release & Eject',
    category: 'AK-47',
    source: 'SpringySpringo',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sounds'
  },
  {
    key: 'ak_mag_in_01',
    label: 'AK-47 Heavy Mag Rock-In',
    category: 'AK-47',
    source: 'SpringySpringo',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sounds'
  },
  {
    key: 'ak_mag_in_02',
    label: 'AK-47 Mag Seat Variant',
    category: 'AK-47',
    source: 'BMacZero',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sound-effects'
  },
  {
    key: 'ak_bolt_rack_01',
    label: 'AK-47 Charging Handle Rack',
    category: 'AK-47',
    source: 'SpringySpringo',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sounds'
  },

  // Pistol
  {
    key: 'pistol_mag_out_01',
    label: 'Pistol Mag Release & Drop',
    category: 'Pistol',
    source: 'zer0_sol',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/handgun-reload-sound-effect'
  },
  {
    key: 'pistol_mag_in_01',
    label: 'Pistol Mag Seat into Grip',
    category: 'Pistol',
    source: 'zer0_sol',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/handgun-reload-sound-effect'
  },
  {
    key: 'pistol_mag_in_02',
    label: 'Pistol Mag Seat Variant',
    category: 'Pistol',
    source: 'BMacZero',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sound-effects'
  },
  {
    key: 'pistol_slide_release_01',
    label: 'Pistol Slide Snap Forward',
    category: 'Pistol',
    source: 'zer0_sol',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/handgun-reload-sound-effect'
  },

  // SMG
  {
    key: 'smg_mag_out_01',
    label: 'SMG Mag Release',
    category: 'SMG',
    source: 'SpringySpringo',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sounds'
  },
  {
    key: 'smg_mag_in_01',
    label: 'SMG Compact Clip Lock',
    category: 'SMG',
    source: 'BMacZero',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sound-effects'
  },
  {
    key: 'smg_mag_in_02',
    label: 'SMG Clip Lock Variant',
    category: 'SMG',
    source: 'BMacZero',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sound-effects'
  },
  {
    key: 'smg_bolt_01',
    label: 'SMG High-Cadence Bolt Rack',
    category: 'SMG',
    source: 'SpringySpringo',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sounds'
  },

  // Shotgun
  {
    key: 'shotgun_shell_01',
    label: 'Shotgun Shell Click 1',
    category: 'Shotgun',
    source: 'zer0_sol',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/shotgun-reload-sound-effects'
  },
  {
    key: 'shotgun_shell_02',
    label: 'Shotgun Shell Click 2',
    category: 'Shotgun',
    source: 'zer0_sol',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/shotgun-reload-sound-effects'
  },
  {
    key: 'shotgun_shell_03',
    label: 'Shotgun Shell Click 3',
    category: 'Shotgun',
    source: 'zer0_sol',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/shotgun-reload-sound-effects'
  },
  {
    key: 'shotgun_pump_back_01',
    label: 'Shotgun Pump Stroke Back',
    category: 'Shotgun',
    source: 'zer0_sol',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/shotgun-reload-sound-effects'
  },
  {
    key: 'shotgun_pump_fwd_01',
    label: 'Shotgun Pump Stroke Forward',
    category: 'Shotgun',
    source: 'zer0_sol',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/shotgun-reload-sound-effects'
  },

  // Sniper
  {
    key: 'sniper_bolt_unlock_01',
    label: 'Sniper Bolt Handle Lift (Unlock)',
    category: 'Sniper',
    source: 'BMacZero',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sound-effects'
  },
  {
    key: 'sniper_bolt_pull_01',
    label: 'Sniper Bolt Draw (Pull)',
    category: 'Sniper',
    source: 'zer0_sol',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/shotgun-reload-sound-effects'
  },
  {
    key: 'sniper_mag_out_01',
    label: 'Sniper Heavy Mag Eject',
    category: 'Sniper',
    source: 'SpringySpringo',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sounds'
  },
  {
    key: 'sniper_mag_in_01',
    label: 'Sniper Heavy Mag Seat',
    category: 'Sniper',
    source: 'SpringySpringo',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sounds'
  },
  {
    key: 'sniper_mag_in_02',
    label: 'Sniper Mag Seat Variant',
    category: 'Sniper',
    source: 'BMacZero',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sound-effects'
  },
  {
    key: 'sniper_bolt_push_01',
    label: 'Sniper Bolt Stroke (Push)',
    category: 'Sniper',
    source: 'zer0_sol',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/shotgun-reload-sound-effects'
  },
  {
    key: 'sniper_bolt_lock_01',
    label: 'Sniper Bolt Turn Down (Lock)',
    category: 'Sniper',
    source: 'BMacZero',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sound-effects'
  },

  // General Handling
  {
    key: 'equip_01',
    label: 'Draw / Holster Scrape 1',
    category: 'Handling',
    source: 'SpringySpringo',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sounds'
  },
  {
    key: 'equip_02',
    label: 'Draw / Holster Scrape 2',
    category: 'Handling',
    source: 'SpringySpringo',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sounds'
  },
  {
    key: 'dryfire_01',
    label: 'Dry Fire Trigger Click 1',
    category: 'Handling',
    source: 'BMacZero',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sound-effects'
  },
  {
    key: 'dryfire_02',
    label: 'Dry Fire Trigger Click 2',
    category: 'Handling',
    source: 'BMacZero',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sound-effects'
  },
  {
    key: 'low_ammo_01',
    label: 'Low-Ammo Auditory Tick',
    category: 'Handling',
    source: 'BMacZero',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/gun-reload-sound-effects'
  }
];

const WEAPON_FULL_RELOADS = [
  { id: 'ak47', name: 'AK-47 VANGUARD', dur: '2.2s', wav: '/audio/handling/renders/ak47_full_reload.wav' },
  { id: 'pistol', name: 'TACTICAL M9 PISTOL', dur: '1.6s', wav: '/audio/handling/renders/pistol_full_reload.wav' },
  { id: 'smg', name: 'CYCLONE-9 SMG', dur: '1.8s', wav: '/audio/handling/renders/smg_full_reload.wav' },
  { id: 'shotgun', name: 'SPAS-12 COMBAT SHOTGUN', dur: '2.6s', wav: '/audio/handling/renders/shotgun_full_reload.wav' },
  { id: 'sniper', name: 'AW-50 HEAVY SNIPER', dur: '3.2s', wav: '/audio/handling/renders/sniper_full_reload.wav' },
];

export function initSoundTestOverlay(weaponManager?: WeaponManager): HTMLDivElement {
  const container = document.createElement('div');
  container.id = 'soundtest-overlay';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(5, 10, 16, 0.94);
    backdrop-filter: blur(12px);
    z-index: 999999;
    color: #f0f6fc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    overflow-y: auto;
    padding: 30px 40px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 24px;
    pointer-events: auto;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(0, 255, 136, 0.3);
    padding-bottom: 16px;
  `;
  header.innerHTML = `
    <div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #00ff88; letter-spacing: 1px;">
        AUDITORY TEST SUITE: WEAPON HANDLING & RELOAD AUDIO (?soundtest=1)
      </h1>
      <p style="margin: 6px 0 0; font-size: 13px; color: #8b949e;">
        29 Real Recorded Audio Effects &bull; 100% CC0 Public Domain &bull; 48 kHz Mono Normalized -3 dBFS &bull; Total Assets: 159.4 KB
      </p>
    </div>
    <button id="soundtest-close-btn" style="
      background: rgba(255, 59, 48, 0.2);
      border: 1px solid #ff3b30;
      color: #fff;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    ">CLOSE [ESC]</button>
  `;
  container.appendChild(header);

  // Section 1: Full Weapon Reload Renders
  const rendersSection = document.createElement('div');
  rendersSection.innerHTML = `
    <h2 style="font-size: 16px; margin: 0 0 12px; color: #58a6ff; text-transform: uppercase; letter-spacing: 0.5px;">
      1. Complete Reload Sequences & Rendered Master Audio
    </h2>
    <p style="font-size: 12px; color: #8b949e; margin: 0 0 16px;">
      Listen to the pre-rendered master WAVs or trigger an active live weapon reload in-engine:
    </p>
  `;
  const rendersGrid = document.createElement('div');
  rendersGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 16px;
  `;

  WEAPON_FULL_RELOADS.forEach((w) => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(22, 27, 34, 0.85);
      border: 1px solid rgba(88, 166, 255, 0.25);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight: 700; color: #fff; font-size: 14px;">${w.name}</span>
        <span style="font-size: 11px; background: rgba(88,166,255,0.2); color:#58a6ff; padding: 2px 8px; border-radius: 12px;">${w.dur} Duration</span>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <button class="live-reload-btn" data-weapon="${w.id}" style="
          background: #238636;
          border: 1px solid #2ea043;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
        ">&#9658; Play Full Reload</button>
        <span style="font-size: 11px; color: #8b949e;">Master Rendered WAV:</span>
      </div>
      <audio controls src="${w.wav}" style="width: 100%; height: 32px; outline: none;"></audio>
    `;
    rendersGrid.appendChild(card);
  });
  rendersSection.appendChild(rendersGrid);
  container.appendChild(rendersSection);

  // Section 2: Individual Sound Effects Catalog
  const individualSection = document.createElement('div');
  individualSection.innerHTML = `
    <h2 style="font-size: 16px; margin: 0 0 12px; color: #00ff88; text-transform: uppercase; letter-spacing: 0.5px;">
      2. Recorded Sound Effects Library (29 Samples)
    </h2>
    <p style="font-size: 12px; color: #8b949e; margin: 0 0 16px;">
      Click any sample to audition. Samples play through the SFX handling bus (-14 dB relative to gunfire) with subtle random micro-pitch and gain variations:
    </p>
  `;

  const catalogGrid = document.createElement('div');
  catalogGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 12px;
  `;

  SOUND_CATALOG.forEach((item) => {
    const itemCard = document.createElement('div');
    itemCard.style.cssText = `
      background: rgba(13, 17, 23, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    `;
    itemCard.innerHTML = `
      <div style="display:flex; flex-direction:column; gap: 4px; overflow: hidden;">
        <span style="font-weight: 600; font-size: 12px; color: #fff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
          ${item.label}
        </span>
        <span style="font-size: 11px; color: #7ee787; font-family: monospace;">${item.key}.ogg</span>
        <span style="font-size: 10px; color: #8b949e;">
          Author: <strong>${item.source}</strong> &bull; License: <a href="${item.url}" target="_blank" style="color: #58a6ff; text-decoration: none;">${item.license}</a>
        </span>
      </div>
      <button class="play-sample-btn" data-key="${item.key}" style="
        background: rgba(0, 255, 136, 0.15);
        border: 1px solid rgba(0, 255, 136, 0.4);
        color: #00ff88;
        font-size: 11px;
        font-weight: 700;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        white-space: nowrap;
      ">&#9658; PLAY</button>
    `;
    catalogGrid.appendChild(itemCard);
  });
  individualSection.appendChild(catalogGrid);
  container.appendChild(individualSection);

  // Wire event handlers
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'soundtest-close-btn') {
      container.remove();
    } else if (target.classList.contains('play-sample-btn')) {
      const key = target.getAttribute('data-key') as HandlingSoundKey;
      if (key) {
        sound.playHandling(key);
      }
    } else if (target.classList.contains('live-reload-btn')) {
      const wId = target.getAttribute('data-weapon') as any;
      if (weaponManager && wId) {
        weaponManager.switchWeapon(wId);
        weaponManager.setAmmo(0);
        weaponManager.startReload();
      } else if (wId) {
        // Fallback: trigger soundManager reload sequence directly
        if (wId === 'ak47') {
          sound.playAKMagOut();
          setTimeout(() => sound.playAKMagIn(), 880);
          setTimeout(() => sound.playAKBoltRack(), 1144);
        } else if (wId === 'pistol') {
          sound.playPistolMagOut();
          setTimeout(() => sound.playPistolMagIn(), 864);
          setTimeout(() => sound.playPistolSlideRelease(), 1072);
        } else if (wId === 'smg') {
          sound.playSMGMagOut();
          setTimeout(() => sound.playSMGMagIn(), 972);
          setTimeout(() => sound.playSMGBolt(), 1206);
        } else if (wId === 'shotgun') {
          sound.playShotgunShellInsert();
          setTimeout(() => sound.playShotgunShellInsert(), 468);
          setTimeout(() => sound.playShotgunShellInsert(), 936);
          setTimeout(() => sound.playShotgunShellInsert(), 1352);
          setTimeout(() => sound.playShotgunPumpBack(), 1664);
          setTimeout(() => sound.playShotgunPumpForward(), 1924);
        } else if (wId === 'sniper') {
          sound.playSniperBoltUnlock();
          setTimeout(() => sound.playSniperBoltPull(), 256);
          setTimeout(() => sound.playSniperMagOut(), 768);
          setTimeout(() => sound.playSniperMagIn(), 1824);
          setTimeout(() => sound.playSniperBoltPush(), 2304);
          setTimeout(() => sound.playSniperBoltLock(), 2624);
        }
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('soundtest-overlay')) {
      container.remove();
    }
  });

  document.body.appendChild(container);
  return container;
}
