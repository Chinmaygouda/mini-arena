import { Vec3 } from '../types';

export type DamageType = 'bullet' | 'blast' | 'fall';
export type HitPart = 'head' | 'body' | 'blast';

export interface DamageEvent {
  targetId: string;
  attackerId: string;
  damage: number;
  damageType: DamageType;
  part: HitPart;
  isFatal: boolean;
  direction: Vec3; // Normalized direction pointing from target to damage source
  tick: number;
}

export interface PlayerVitalsState {
  id: string;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  respawnTicksRemaining: number;
  spawnProtectionTicksRemaining: number;
  deaths: number;
  kills: number;
  lastDamageEvent?: DamageEvent;
}

export interface DummyTargetVitals {
  id: string;
  pos: Vec3;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  respawnTicksRemaining: number;
}
