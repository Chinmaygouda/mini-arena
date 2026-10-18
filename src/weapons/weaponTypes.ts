// src/weapons/weaponTypes.ts
// Weapon definitions, states, ballistics, and animation parameters

export type WeaponId = 'ak47' | 'pistol' | 'smg' | 'shotgun' | 'sniper';

/**
 * Sprint carry pose configuration.
 *
 * Offsets are DELTAS applied on top of hipPosition/hipRotation when sprintWeight = 1.
 * Spring: critically-damped (ζ = 1) — no overshoot, no oscillation.
 * fireDelayOut: extra seconds the fire scheduler stays blocked after sprinting stops.
 */
export interface SprintPose {
  // Position delta (metres) at full sprint weight
  dx: number;    // rightward shift
  dy: number;    // vertical shift (negative = drop)
  dz: number;    // depth push (negative = pull toward camera)

  // Rotation delta (radians) at full sprint weight
  dpitch: number;  // nose-up  (positive = muzzle rises)
  dyaw: number;    // yaw      (negative = tuck toward centre)
  droll: number;   // roll

  // Bob during sprint
  bobShape: 'sine' | 'lissajous'; // 'lissajous' = Bowditch figure-8
  phaseRatio: number;              // x-freq / y-freq ratio (Lissajous only; 0 for sine)
  bobFreq: number;                 // Y oscillation frequency, Hz
  bobAmpX: number;                 // lateral amplitude, metres
  bobAmpY: number;                 // vertical amplitude, metres

  // Critically-damped spring (ζ = 1 fixed)
  omegaIn: number;   // ωₙ rad/s – sprint entry speed
  omegaOut: number;  // ωₙ rad/s – sprint exit speed (typically slightly faster)

  // Seconds the scheduler stays blocked after sprint ends (recovery before first shot)
  fireDelayOut: number;
}

export interface WeaponRangeConfig {
  fullDamageRange: number;    // meters: d <= fullDamageRange -> 100% damage
  falloffEndRange: number;    // meters: d >= falloffEndRange -> minDamageMultiplier
  minDamageMultiplier: number;// 0.0 to 1.0 (minimum damage multiplier at/beyond falloffEndRange)
  maxRange: number;           // meters: absolute ray length; nothing is hit beyond it
}

export interface WeaponDef extends WeaponRangeConfig {
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

  // Tracer Visuals
  tracerThickness?: number;
  tracerLife?: number;
  tracerColor?: number;
  tracerSpeed?: number;
  tracerBoltLength?: number;

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

  // Per-weapon sprint carry animation
  sprintPose: SprintPose;
}

/**
 * Calculates damage falloff with distance for a weapon shot.
 * - d <= fullDamageRange: 100% baseDamage
 * - fullDamageRange < d < falloffEndRange: linear drop to minDamageMultiplier
 * - falloffEndRange <= d <= maxRange: constant minDamageMultiplier
 * - d > maxRange: 0 damage (out of range, ray does not reach)
 */
export function calculateDamageFalloff(
  distance: number,
  baseDamage: number,
  rangeConfig: WeaponRangeConfig,
  isCrit: boolean = false,
  critMultiplier: number = 1.0
): {
  damage: number;
  multiplier: number;
  inRange: boolean;
} {
  if (distance > rangeConfig.maxRange) {
    return { damage: 0, multiplier: 0, inRange: false };
  }

  let multiplier = 1.0;
  if (distance <= rangeConfig.fullDamageRange) {
    multiplier = 1.0;
  } else if (distance >= rangeConfig.falloffEndRange) {
    multiplier = rangeConfig.minDamageMultiplier;
  } else {
    const t = (distance - rangeConfig.fullDamageRange) / (rangeConfig.falloffEndRange - rangeConfig.fullDamageRange);
    multiplier = 1.0 - t * (1.0 - rangeConfig.minDamageMultiplier);
  }

  // Falloff applies to body and head damage (multiply after headshot multiplier)
  const rawDamage = baseDamage * (isCrit ? critMultiplier : 1.0) * multiplier;
  const damage = Math.round(rawDamage);

  return { damage, multiplier, inRange: true };
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

    // Range & Falloff (full 30m, min 60% at 70m, max 100m)
    fullDamageRange: 30,
    falloffEndRange: 70,
    minDamageMultiplier: 0.6,
    maxRange: 100,

    // Tracer Visuals
    tracerThickness: 0.008,
    tracerLife: 1.5,
    tracerColor: 0xffea88,
    tracerSpeed: 95,
    tracerBoltLength: 1.2,

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

    // Sprint: high-port cross-chest carry — classic AK silhouette
    sprintPose: {
      dx: 0.04, dy: -0.14, dz: -0.08,
      dpitch: 0.42, dyaw: -0.32, droll: 0.05,
      bobShape: 'lissajous', phaseRatio: 2 / 3,
      bobFreq: 3.2, bobAmpX: 0.020, bobAmpY: 0.024,
      omegaIn: 16, omegaOut: 18,
      fireDelayOut: 0.22,
    },
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

    // Range & Falloff (full 15m, min 50% at 40m, max 50m)
    fullDamageRange: 15,
    falloffEndRange: 40,
    minDamageMultiplier: 0.5,
    maxRange: 50,

    // Tracer Visuals
    tracerThickness: 0.007,
    tracerLife: 1.5,
    tracerColor: 0xffdd77,
    tracerSpeed: 75,
    tracerBoltLength: 0.8,

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

    // Sprint: low-ready chest carry — compact, barrel slightly angled down
    sprintPose: {
      dx: 0.05, dy: -0.06, dz: -0.05,
      dpitch: 0.15, dyaw: -0.10, droll: 0.06,
      bobShape: 'sine', phaseRatio: 0,
      bobFreq: 3.4, bobAmpX: 0.008, bobAmpY: 0.012,
      omegaIn: 22, omegaOut: 24,
      fireDelayOut: 0.18,
    },
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

    // Range & Falloff (full 12m, min 40% at 35m, max 40m)
    fullDamageRange: 12,
    falloffEndRange: 35,
    minDamageMultiplier: 0.4,
    maxRange: 40,

    // Tracer Visuals
    tracerThickness: 0.006,
    tracerLife: 1.5,
    tracerColor: 0xffd066,
    tracerSpeed: 85,
    tracerBoltLength: 0.9,

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

    // Sprint: angled high-ready — compact stock tucked toward right shoulder
    sprintPose: {
      dx: 0.06, dy: -0.10, dz: -0.06,
      dpitch: 0.28, dyaw: -0.20, droll: 0.08,
      bobShape: 'sine', phaseRatio: 0,
      bobFreq: 3.3, bobAmpX: 0.014, bobAmpY: 0.018,
      omegaIn: 18, omegaOut: 20,
      fireDelayOut: 0.20,
    },
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

    // Range & Falloff (each of 8 pellets: full 6m, min 15% at 22m, max 25m)
    fullDamageRange: 6,
    falloffEndRange: 22,
    minDamageMultiplier: 0.15,
    maxRange: 25,

    // Tracer Visuals
    tracerThickness: 0.006,
    tracerLife: 1.5,
    tracerColor: 0xffaa44,
    tracerSpeed: 70,
    tracerBoltLength: 0.6,

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

    // Sprint: butt-to-hip muzzle-up carry — pump pulled toward belly
    sprintPose: {
      dx: 0.06, dy: -0.10, dz: -0.06,
      dpitch: 0.30, dyaw: -0.25, droll: 0.12,
      bobShape: 'lissajous', phaseRatio: 1 / 2,
      bobFreq: 3.0, bobAmpX: 0.018, bobAmpY: 0.022,
      omegaIn: 14, omegaOut: 16,
      fireDelayOut: 0.25,
    },
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

    // Range & Falloff (no falloff, max 300m)
    fullDamageRange: 300,
    falloffEndRange: 300,
    minDamageMultiplier: 1.0,
    maxRange: 300,

    // Tracer Visuals
    tracerThickness: 0.012,
    tracerLife: 2.0,
    tracerColor: 0x99ddff,
    tracerSpeed: 175,
    tracerBoltLength: 2.0,

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

    // Sprint: two-hand rifle port — nearly vertical, scope tucked away from eye
    sprintPose: {
      dx: 0.03, dy: -0.18, dz: -0.10,
      dpitch: 0.50, dyaw: -0.40, droll: 0.03,
      bobShape: 'lissajous', phaseRatio: 2 / 3,
      bobFreq: 2.8, bobAmpX: 0.015, bobAmpY: 0.018,
      omegaIn: 12, omegaOut: 14,
      fireDelayOut: 0.28,
    },
  },
};
