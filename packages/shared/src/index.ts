/**
 * @mini-arena/shared
 * Pure deterministic game definitions, constants, and math.
 * Binding Rule: ZERO imports from DOM, Three.js, or Colyseus (AGENT_RULES.md Rule C).
 */

export * from './constants';
export * from './types';
export * from './movement';

/**
 * Pure deterministic clamping helper.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
