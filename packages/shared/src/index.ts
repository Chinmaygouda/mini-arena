/**
 * @mini-arena/shared
 * Pure deterministic game definitions, constants, and math.
 * Binding Rule: ZERO imports from DOM, Three.js, or Colyseus (AGENT_RULES.md Rule C).
 */

export const SIM_TICK_RATE = 60;
export const SIM_TICK_DELTA = 1 / SIM_TICK_RATE;
export const MAX_PLAYERS = 4;
export const TEAM_SIZE = 2;

export const TEAMS = {
  ALPHA: 'alpha',
  BRAVO: 'bravo',
} as const;

export type Team = (typeof TEAMS)[keyof typeof TEAMS];

export interface PlayerInput {
  seq: number;
  tick: number;
  forward: number;
  right: number;
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  yaw: number;
  pitch: number;
}

export interface PlayerSimState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  isGrounded: boolean;
}

/**
 * Pure deterministic clamping helper.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
