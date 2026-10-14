/**
 * Physics, player dimensions, and movement simulation constants.
 * All speeds in m/s, acceleration in m/s², dimensions in meters.
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

// Player physical dimensions
export const PLAYER_HEIGHT_STAND = 1.8;
export const PLAYER_HEIGHT_CROUCH = 1.2;
export const PLAYER_RADIUS = 0.4;
export const PLAYER_EYE_HEIGHT_STAND = 1.65;
export const PLAYER_EYE_HEIGHT_CROUCH = 1.05;

// Movement speeds
export const WALK_SPEED = 4.5;
export const SPRINT_SPEED = 7.0;
export const CROUCH_SPEED = 2.2;
export const JUMP_VELOCITY = 6.0;

// Snappy tactical gravity & accelerations
export const GRAVITY = -19.6;
export const ACCELERATION = 40.0;
export const DECELERATION = 30.0;
export const AIR_ACCELERATION = 10.0;
export const AIR_DECELERATION = 2.0;
