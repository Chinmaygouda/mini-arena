import { SIM_TICK_DELTA } from './constants';

export const MAX_FRAME_DELTA = 0.25; // 250 ms maximum delta per render frame
export const MAX_TICKS_PER_FRAME = 8; // Caps ticks per render frame to prevent spiral of death

export interface TimestepState {
  accumulator: number;
  lastTime: number;
}

export function createTimestepState(initialTime = 0): TimestepState {
  return {
    accumulator: 0,
    lastTime: initialTime,
  };
}

export interface TimestepUpdateResult {
  frameDelta: number;
  ticksToRun: number;
  alpha: number;
}

/**
 * Updates the fixed-timestep accumulator with frame delta clamping to prevent spiral of death.
 * Caps frameDelta to MAX_FRAME_DELTA (e.g. after background tab suspension).
 * Caps ticksToRun to MAX_TICKS_PER_FRAME.
 */
export function updateAccumulator(
  state: TimestepState,
  currentTimeMs: number,
  maxFrameDelta = MAX_FRAME_DELTA,
  maxTicks = MAX_TICKS_PER_FRAME,
): TimestepUpdateResult {
  const rawDeltaSec = (currentTimeMs - state.lastTime) / 1000;
  state.lastTime = currentTimeMs;

  // Frame delta clamping: never negative, never exceeds maxFrameDelta
  const frameDelta = Math.max(0, Math.min(rawDeltaSec, maxFrameDelta));

  // Cap accumulator as well to strictly bound catch-up
  state.accumulator = Math.min(state.accumulator + frameDelta, maxFrameDelta);

  // Add small epsilon tolerance (1e-6s = 1 microsecond) to prevent floating-point rounding jitter
  const potentialTicks = Math.floor((state.accumulator + 1e-6) / SIM_TICK_DELTA);
  const ticksToRun = Math.min(potentialTicks, maxTicks);

  // Consume time for the ticks that will run
  state.accumulator = Math.max(0, state.accumulator - ticksToRun * SIM_TICK_DELTA);

  // Render interpolation factor alpha in [0, 1]
  const alpha = Math.max(0, Math.min(1.0, state.accumulator / SIM_TICK_DELTA));

  return {
    frameDelta,
    ticksToRun,
    alpha,
  };
}
