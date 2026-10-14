import { WeaponDef, WeaponId } from './types';

// Helper to generate a procedural recoil curve
function generateRecoilPattern(
  length: number,
  basePitch: number,
  yawDrift: number,
): Array<{ pitch: number; yaw: number }> {
  const pattern: Array<{ pitch: number; yaw: number }> = [];
  for (let i = 0; i < length; i++) {
    const t = i / length;
    // Initial climb followed by horizontal shake/drift
    const pitch = basePitch * (1 - t * 0.4);
    const yaw = Math.sin(i * 0.8) * yawDrift;
    pattern.push({ pitch, yaw });
  }
  return pattern;
}

export const PISTOL_DEF: WeaponDef = {
  id: 'pistol',
  name: 'Tactical Pistol',
  fireMode: 'semi',
  rpm: 400,
  magSize: 12,
  reserveMax: 36,
  damageBase: 34,
  headshotMultiplier: 2.0,
  pellets: 1,
  range: 60,
  damageFalloff: {
    startDist: 15,
    endDist: 35,
    minDamage: 18,
  },
  spread: {
    base: 0.008,
    moveMultiplier: 1.8,
    crouchMultiplier: 0.7,
    adsMultiplier: 0.5,
    sprintMultiplier: 3.0,
  },
  reloadType: 'magazine',
  reloadTimeTactical: 1.6,
  reloadTimeEmpty: 2.1,
  swapTime: 0.3,
  adsFovMultiplier: 0.85,
  recoil: {
    pattern: generateRecoilPattern(12, 0.035, 0.008),
    recoverySpeed: 18.0,
    resetTime: 0.25,
  },
};

export const SMG_DEF: WeaponDef = {
  id: 'smg',
  name: 'Rapid SMG',
  fireMode: 'auto',
  rpm: 800,
  magSize: 30,
  reserveMax: 120,
  damageBase: 22,
  headshotMultiplier: 1.6,
  pellets: 1,
  range: 50,
  damageFalloff: {
    startDist: 12,
    endDist: 28,
    minDamage: 12,
  },
  spread: {
    base: 0.015,
    moveMultiplier: 1.4,
    crouchMultiplier: 0.75,
    adsMultiplier: 0.45,
    sprintMultiplier: 3.5,
  },
  reloadType: 'magazine',
  reloadTimeTactical: 1.8,
  reloadTimeEmpty: 2.3,
  swapTime: 0.35,
  adsFovMultiplier: 0.8,
  recoil: {
    pattern: generateRecoilPattern(30, 0.022, 0.015),
    recoverySpeed: 14.0,
    resetTime: 0.25,
  },
};

export const ASSAULT_RIFLE_DEF: WeaponDef = {
  id: 'assault_rifle',
  name: 'Assault Rifle',
  fireMode: 'auto',
  rpm: 600,
  magSize: 30,
  reserveMax: 90,
  damageBase: 30,
  headshotMultiplier: 2.2,
  pellets: 1,
  range: 100,
  damageFalloff: {
    startDist: 25,
    endDist: 60,
    minDamage: 20,
  },
  spread: {
    base: 0.006,
    moveMultiplier: 2.5,
    crouchMultiplier: 0.65,
    adsMultiplier: 0.3,
    sprintMultiplier: 4.0,
  },
  reloadType: 'magazine',
  reloadTimeTactical: 2.2,
  reloadTimeEmpty: 2.8,
  swapTime: 0.45,
  adsFovMultiplier: 0.75,
  recoil: {
    pattern: generateRecoilPattern(30, 0.03, 0.012),
    recoverySpeed: 12.0,
    resetTime: 0.3,
  },
};

export const SHOTGUN_DEF: WeaponDef = {
  id: 'shotgun',
  name: 'Combat Shotgun',
  fireMode: 'semi',
  rpm: 80,
  magSize: 6,
  reserveMax: 24,
  damageBase: 12, // 8 pellets * 12 = 96 damage point-blank
  headshotMultiplier: 1.5,
  pellets: 8,
  range: 30,
  damageFalloff: {
    startDist: 6,
    endDist: 18,
    minDamage: 4,
  },
  spread: {
    base: 0.045,
    moveMultiplier: 1.3,
    crouchMultiplier: 0.85,
    adsMultiplier: 0.75,
    sprintMultiplier: 2.5,
  },
  reloadType: 'shell_by_shell',
  shellReloadTime: 0.55, // 550ms per shell insertion
  reloadTimeTactical: 0.55,
  reloadTimeEmpty: 0.75, // Extra 200ms to pump first shell into chamber
  swapTime: 0.5,
  adsFovMultiplier: 0.85,
  recoil: {
    pattern: generateRecoilPattern(6, 0.08, 0.02),
    recoverySpeed: 10.0,
    resetTime: 0.45,
  },
};

export const SNIPER_DEF: WeaponDef = {
  id: 'sniper',
  name: 'Precision Sniper',
  fireMode: 'semi',
  rpm: 45,
  magSize: 5,
  reserveMax: 15,
  damageBase: 85,
  headshotMultiplier: 2.5, // 212.5 headshot kill
  pellets: 1,
  range: 200,
  damageFalloff: {
    startDist: 60,
    endDist: 150,
    minDamage: 75,
  },
  spread: {
    base: 0.001,
    moveMultiplier: 8.0,
    crouchMultiplier: 0.5,
    adsMultiplier: 0.05, // Pinpoint precision when ADS
    sprintMultiplier: 12.0,
  },
  reloadType: 'magazine',
  reloadTimeTactical: 2.8,
  reloadTimeEmpty: 3.5,
  swapTime: 0.6,
  adsFovMultiplier: 0.25, // 4x high zoom scope
  recoil: {
    pattern: generateRecoilPattern(5, 0.12, 0.01),
    recoverySpeed: 6.0,
    resetTime: 0.6,
  },
};

export const WEAPON_REGISTRY: Record<WeaponId, WeaponDef> = {
  pistol: PISTOL_DEF,
  smg: SMG_DEF,
  assault_rifle: ASSAULT_RIFLE_DEF,
  shotgun: SHOTGUN_DEF,
  sniper: SNIPER_DEF,
};

export function getWeaponDef(id: WeaponId): WeaponDef {
  const def = WEAPON_REGISTRY[id];
  if (!def) {
    throw new Error(`Unknown weapon id: ${id}`);
  }
  return def;
}
