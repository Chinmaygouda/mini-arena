import { GrenadeDef, GrenadeInventory, GrenadeType } from './types';

export const FRAG_GRENADE_DEF: GrenadeDef = {
  id: 'frag',
  name: 'M67 Frag Grenade',
  fuseTicks: 150, // 2.5 seconds at 60 Hz
  throwSpeed: 18.0, // m/s
  gravity: 19.6, // 2G gravity for snappy tactical trajectory
  radius: 0.045, // 4.5 cm physical radius
  restitution: 0.42, // Steel/composite bounce factor
  friction: 0.85, // Tangential friction on floor contact
  blastRadius: 7.0, // 7.0m lethal/concussive radius
  maxDamage: 120, // 1-hit kill at point-blank (< 1.5m)
  minDamage: 15, // minimum shrapnel damage at outer perimeter
  selfDamageFactor: 0.75, // 75% damage to thrower
  smokeRadius: 0,
  smokeDurationTicks: 0,
  flashDurationTicks: 0,
  cooldownTicks: 30, // 0.5s cooldown
  windUpTicks: 12, // 0.2s throw windup
};

export const FLASH_GRENADE_DEF: GrenadeDef = {
  id: 'flash',
  name: 'M84 Stun Grenade',
  fuseTicks: 100, // 1.667 seconds at 60 Hz
  throwSpeed: 18.0,
  gravity: 19.6,
  radius: 0.040,
  restitution: 0.48,
  friction: 0.82,
  blastRadius: 16.0, // 16.0m blinding radius
  maxDamage: 0,
  minDamage: 0,
  selfDamageFactor: 1.0, // thrower can be flashed too
  smokeRadius: 0,
  smokeDurationTicks: 0,
  flashDurationTicks: 240, // Up to 4.0 seconds max blindness
  cooldownTicks: 30,
  windUpTicks: 12,
};

export const SMOKE_GRENADE_DEF: GrenadeDef = {
  id: 'smoke',
  name: 'M18 Smoke Grenade',
  fuseTicks: 120, // 2.0 seconds at 60 Hz
  throwSpeed: 16.5,
  gravity: 19.6,
  radius: 0.045,
  restitution: 0.35, // heavier can, lower bounce
  friction: 0.90,
  blastRadius: 5.5,
  maxDamage: 0,
  minDamage: 0,
  selfDamageFactor: 0,
  smokeRadius: 5.5, // 5.5m radius spherical concealment cloud
  smokeDurationTicks: 600, // 10.0 seconds concealment
  flashDurationTicks: 0,
  cooldownTicks: 30,
  windUpTicks: 12,
};

export const GRENADE_DEFS: Record<GrenadeType, GrenadeDef> = {
  frag: FRAG_GRENADE_DEF,
  flash: FLASH_GRENADE_DEF,
  smoke: SMOKE_GRENADE_DEF,
};

export const INITIAL_GRENADE_INVENTORY: GrenadeInventory = {
  counts: {
    frag: 2,
    flash: 1,
    smoke: 1,
  },
  selectedType: 'frag',
  cooldownRemaining: 0,
};

export const GRENADE_TYPES_ORDER: GrenadeType[] = ['frag', 'flash', 'smoke'];
