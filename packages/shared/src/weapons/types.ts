export type WeaponId = 'pistol' | 'smg' | 'assault_rifle' | 'shotgun' | 'sniper';

export type FireMode = 'auto' | 'semi';

export interface RecoilKick {
  pitch: number; // Vertical kick in radians (positive = kick upwards)
  yaw: number; // Horizontal kick in radians (positive = kick right, negative = kick left)
}

export interface WeaponSpreadDef {
  base: number; // In radians (cone half-angle)
  moveMultiplier: number;
  crouchMultiplier: number;
  adsMultiplier: number;
  sprintMultiplier: number;
}

export interface WeaponDamageFalloffDef {
  startDist: number; // Distance in meters where full damage applies
  endDist: number; // Distance in meters where minDamage applies
  minDamage: number; // Damage floor beyond endDist
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  fireMode: FireMode;
  rpm: number; // Rounds per minute
  magSize: number;
  reserveMax: number;
  damageBase: number;
  headshotMultiplier: number;
  pellets: number; // 1 for bullet weapons, >1 for shotgun
  range: number; // Maximum effective raycast range in meters
  damageFalloff: WeaponDamageFalloffDef;
  spread: WeaponSpreadDef;
  reloadTimeTactical: number; // Duration in seconds when reloading with round in chamber (mag > 0)
  reloadTimeEmpty: number; // Duration in seconds when reloading empty mag (mag == 0)
  swapTime: number; // Duration in seconds to equip/swap
  adsFovMultiplier: number; // Camera FOV multiplier when ADS (e.g. 0.8 for ironsights, 0.25 for sniper)
  recoil: {
    pattern: RecoilKick[]; // Per-shot recoil kicks indexed by shot count in spray
    recoverySpeed: number; // Speed of recoil recovery towards center
    resetTime: number; // Time without firing before recoil pattern resets to 0
  };
}
