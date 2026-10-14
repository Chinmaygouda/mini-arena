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

export interface MagazineReloadSpec {
  tacticalReloadTicks: number; // e.g. 126 ticks (2.10s)
  tacticalCommitTick: number; // e.g. 72 ticks (1.20s, when ammo commits)
  emptyReloadTicks: number; // e.g. 156 ticks (2.60s)
  emptyCommitTick: number; // e.g. 78 ticks (1.30s)
}

export interface ShellReloadSpec {
  startTicks: number; // e.g. 24 ticks (0.40s) to bring up gun & open loading gate
  insertTicks: number; // e.g. 32 ticks (0.533s) per shell insertion
  commitTick: number; // e.g. 20 ticks when shell commits to magazine
  endTicks: number; // e.g. 24 ticks (0.40s) to close gate & rack pump
  pumpCloseTick: number; // e.g. 12 ticks when pump closing allows early fire interrupt
}

export interface ReloadSpec {
  type: 'magazine' | 'shell_by_shell';
  magazine?: MagazineReloadSpec;
  shell?: ShellReloadSpec;
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
  reloadType: 'magazine' | 'shell_by_shell'; // Standard magazine swap vs sequential shell insertion
  reloadSpec: ReloadSpec; // Precise integer-tick reload timing specification
  shellReloadTime?: number; // Time in seconds to insert each individual shell (for shotgun)
  boltCycleTicks?: number; // Integer ticks required to cycle bolt between shots (e.g. 80 ticks for sniper)
  swapTicks: number; // Integer ticks required to swap/equip weapon
  swapTime: number; // Duration in seconds to equip/swap
  adsFovMultiplier: number; // Camera FOV multiplier when ADS (e.g. 0.8 for ironsights, 0.25 for sniper)
  recoil: {
    pattern: RecoilKick[]; // Per-shot recoil kicks indexed by shot count in spray
    recoverySpeed: number; // Speed of recoil recovery towards center
    resetTime: number; // Time without firing before recoil pattern resets to 0
  };
}
