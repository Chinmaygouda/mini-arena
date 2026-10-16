import { PlayerVitalsState } from './types';

export const MAX_PLAYER_HEALTH = 100;
export const RESPAWN_DURATION_TICKS = 180; // 3.0 seconds at 60 Hz
export const SPAWN_PROTECTION_TICKS = 90; // 1.5 seconds at 60 Hz
export const DUMMY_MAX_HEALTH = 100;
export const DUMMY_RESPAWN_TICKS = 120; // 2.0 seconds at 60 Hz

export function createInitialPlayerVitals(id: string): PlayerVitalsState {
  return {
    id,
    health: MAX_PLAYER_HEALTH,
    maxHealth: MAX_PLAYER_HEALTH,
    isAlive: true,
    respawnTicksRemaining: 0,
    spawnProtectionTicksRemaining: SPAWN_PROTECTION_TICKS,
    deaths: 0,
    kills: 0,
  };
}
