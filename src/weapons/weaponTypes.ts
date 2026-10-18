// src/weapons/weaponTypes.ts
// Weapon definitions, states, ballistics, and animation parameters

export type WeaponId = 'ak47' | 'pistol' | 'smg' | 'shotgun' | 'sniper';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  caliber: string;
  fireMode: 'auto' | 'semi';
  fireRate: number; // Seconds per shot (e.g., 0.1s = 600 RPM)
  damage: number;
  critMultiplier: number;
  magCapacity: number;
  reserveCapacity: number;
  reloadDuration: number; // in seconds
  spreadBase: number;
  spreadBloomPerShot: number;
  spreadMax: number;
  spreadDecayRate: number;
  pellets?: number; // Number of pellets fired per shot (e.g., 8 for shotgun)
  isSniperScope?: boolean; // True if weapon uses high-power telescopic overlay
  
  // Recoil Profile
  recoilKickZ: number; // Backward kick
  recoilPitchX: number; // Upward muzzle pitch
  recoilYawY: number; // Horizontal spray oscillation
  recoilRecoverySpeed: number; // How quickly recoil snaps back
  cameraRecoilKick: number; // Camera shake pitch impulse

  // Viewmodel resting transforms (Hipfire)
  hipPosition: [number, number, number];
  hipRotation: [number, number, number];

  // Viewmodel ADS transforms (Aligned to sight)
  adsPosition: [number, number, number];
  adsRotation: [number, number, number];
  adsFov: number; // Camera FOV in ADS
}

export const WEAPON_REGISTRY: Record<WeaponId, WeaponDef> = {
  ak47: {
    id: 'ak47',
    name: 'AK-47 VANGUARD',
    caliber: '7.62×39mm Soviet',
    fireMode: 'auto',
    fireRate: 0.1, // 600 RPM
    damage: 38,
    critMultiplier: 2.4, // 91 headshot dmg
    magCapacity: 30,
    reserveCapacity: 120,
    reloadDuration: 2.2,
    spreadBase: 0.008,
    spreadBloomPerShot: 0.007,
    spreadMax: 0.065,
    spreadDecayRate: 0.25,
    
    // Recoil
    recoilKickZ: 0.075,
    recoilPitchX: 0.065,
    recoilYawY: 0.02,
    recoilRecoverySpeed: 14.0,
    cameraRecoilKick: 0.028,

    // Transforms
    hipPosition: [0.2, -0.22, -0.45],
    hipRotation: [0, 0, 0],
    adsPosition: [0.0, -0.116, -0.28],
    adsRotation: [0, 0, 0],
    adsFov: 48,
  },
  pistol: {
    id: 'pistol',
    name: 'TACTICAL M9 COMBAT',
    caliber: '9×19mm Parabellum',
    fireMode: 'semi',
    fireRate: 0.18, // Semi-auto click rate
    damage: 26,
    critMultiplier: 2.0, // 52 headshot dmg
    magCapacity: 15,
    reserveCapacity: 60,
    reloadDuration: 1.6,
    spreadBase: 0.004,
    spreadBloomPerShot: 0.012,
    spreadMax: 0.045,
    spreadDecayRate: 0.35,

    // Recoil
    recoilKickZ: 0.09,
    recoilPitchX: 0.095,
    recoilYawY: 0.01,
    recoilRecoverySpeed: 18.0,
    cameraRecoilKick: 0.018,

    // Transforms
    hipPosition: [0.18, -0.2, -0.4],
    hipRotation: [0, 0, 0],
    adsPosition: [0.0, -0.042, -0.38],
    adsRotation: [0, 0, 0],
    adsFov: 62,
  },
  smg: {
    id: 'smg',
    name: 'CYCLONE-9 SMG',
    caliber: '9×19mm Sub-Sonic',
    fireMode: 'auto',
    fireRate: 0.075, // 800 RPM
    damage: 19,
    critMultiplier: 1.7, // 32.3 headshot dmg
    magCapacity: 30,
    reserveCapacity: 120,
    reloadDuration: 1.8,
    spreadBase: 0.012,
    spreadBloomPerShot: 0.005,
    spreadMax: 0.085,
    spreadDecayRate: 0.35,

    // Recoil Profile
    recoilKickZ: 0.045,
    recoilPitchX: 0.038,
    recoilYawY: 0.024,
    recoilRecoverySpeed: 20.0,
    cameraRecoilKick: 0.016,

    // Transforms
    hipPosition: [0.18, -0.20, -0.42],
    hipRotation: [0, 0, 0],
    adsPosition: [0.0, -0.074, -0.26],
    adsRotation: [0, 0, 0],
    adsFov: 54,
  },
  shotgun: {
    id: 'shotgun',
    name: 'SPAS-12 COMBAT SHOTGUN',
    caliber: '12-Gauge 00 Buckshot',
    fireMode: 'semi',
    fireRate: 0.75, // Authentic pump cycle cadence (45 ticks)
    damage: 14, // 14 x 8 pellets = 112 burst damage!
    critMultiplier: 1.75,
    magCapacity: 8,
    reserveCapacity: 32,
    reloadDuration: 2.6,
    pellets: 8,
    spreadBase: 0.038, // 8-pellet buckshot spread cone
    spreadBloomPerShot: 0.025,
    spreadMax: 0.09,
    spreadDecayRate: 0.28,

    // Recoil Profile: Heavy concussive kick
    recoilKickZ: 0.13,
    recoilPitchX: 0.125,
    recoilYawY: 0.02,
    recoilRecoverySpeed: 10.0,
    cameraRecoilKick: 0.045,

    // Transforms
    hipPosition: [0.18, -0.20, -0.42],
    hipRotation: [0, 0, 0],
    adsPosition: [0.0, -0.055, -0.32],
    adsRotation: [0, 0, 0],
    adsFov: 58,
  },
  sniper: {
    id: 'sniper',
    name: 'AW-50 HEAVY SNIPER',
    caliber: '.50 BMG Heavy Anti-Materiel',
    fireMode: 'semi',
    fireRate: 1.25, // Manual bolt action cycle
    damage: 135, // High damage high impact
    critMultiplier: 2.5, // 337 headshot damage
    magCapacity: 5,
    reserveCapacity: 20,
    reloadDuration: 3.2,
    isSniperScope: true,
    spreadBase: 0.001, // Pinpoint precision
    spreadBloomPerShot: 0.06,
    spreadMax: 0.12,
    spreadDecayRate: 0.18,

    // Recoil Profile: Massive high-caliber recoil
    recoilKickZ: 0.15,
    recoilPitchX: 0.16,
    recoilYawY: 0.015,
    recoilRecoverySpeed: 8.5,
    cameraRecoilKick: 0.055,

    // Transforms
    hipPosition: [0.19, -0.21, -0.44],
    hipRotation: [0, 0, 0],
    adsPosition: [0.0, -0.092, -0.22],
    adsRotation: [0, 0, 0],
    adsFov: 16, // High telescopic optical magnification
  },
};
