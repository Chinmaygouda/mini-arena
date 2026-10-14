import { describe, expect, it } from 'vitest';
import {
  createDefaultPlayerState,
  createTimestepState,
  MAX_FRAME_DELTA,
  MAX_TICKS_PER_FRAME,
  PlayerInput,
  SIM_TICK_DELTA,
  stepPlayer,
  updateAccumulator,
} from './index';

describe('Fixed-Timestep Accumulator & Frame-Rate Independence', () => {
  it('caps frame delta and ticks to prevent spiral of death after tab switch', () => {
    const ts = createTimestepState(1000);

    // Normal 60 Hz frame (1 tick later)
    const normalStep = updateAccumulator(ts, 1000 + SIM_TICK_DELTA * 1000);
    expect(normalStep.frameDelta).toBeCloseTo(SIM_TICK_DELTA, 5);
    expect(normalStep.ticksToRun).toBe(1);

    // Tab switch: user returns 10.0 seconds later (11000ms)
    const tabSwitchStep = updateAccumulator(ts, 11000 + SIM_TICK_DELTA * 1000);

    // Assert that raw 10.0s delta was strictly clamped to MAX_FRAME_DELTA (0.25s)
    expect(tabSwitchStep.frameDelta).toBe(MAX_FRAME_DELTA);
    expect(tabSwitchStep.frameDelta).toBeLessThanOrEqual(0.25);

    // Assert that ticks to run is strictly capped to MAX_TICKS_PER_FRAME (8 ticks = 133ms)
    expect(tabSwitchStep.ticksToRun).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME);
    expect(tabSwitchStep.ticksToRun).toBe(8);

    // Next frame (16.6ms later): accumulator is not spiraling
    const postTabStep = updateAccumulator(ts, 11033.333);
    expect(postTabStep.ticksToRun).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME);
  });

  it('guarantees identical final state and smooth interpolation at 30 Hz, 60 Hz, and 144 Hz', () => {
    const totalSimDurationSec = 1.0;
    const targetTicks = Math.round(totalSimDurationSec / SIM_TICK_DELTA); // 60 ticks

    function runDisplaySimulation(fps: number) {
      const frameDurationMs = 1000 / fps;
      const ts = createTimestepState(0);
      let simState = createDefaultPlayerState(0, 0, 0);
      let tickCount = 0;
      const alphas: number[] = [];
      const renderZPositions: number[] = [];

      let currentTimeMs = 0;
      const totalFrames = Math.ceil((totalSimDurationSec * 1000) / frameDurationMs);

      for (let f = 0; f < totalFrames; f++) {
        currentTimeMs += frameDurationMs;
        const { ticksToRun, alpha } = updateAccumulator(ts, currentTimeMs);

        alphas.push(alpha);

        let prevState = { ...simState };
        for (let t = 0; t < ticksToRun; t++) {
          tickCount++;
          const input: PlayerInput = {
            seq: tickCount,
            tick: tickCount,
            moveForward: 1, // moving forward (-Z)
            moveRight: 0,
            jump: false,
            crouch: false,
            sprint: false,
            yaw: 0,
            pitch: 0,
          };
          prevState = { ...simState };
          simState = stepPlayer(simState, input, SIM_TICK_DELTA);
        }

        const renderZ = prevState.z + (simState.z - prevState.z) * alpha;
        renderZPositions.push(renderZ);
      }

      return {
        tickCount,
        finalState: simState,
        alphas,
        renderZPositions,
      };
    }

    const sim30 = runDisplaySimulation(30);
    const sim60 = runDisplaySimulation(60);
    const sim144 = runDisplaySimulation(144);

    // All simulations must execute exactly the required 60 physics ticks
    expect(sim30.tickCount).toBe(targetTicks);
    expect(sim60.tickCount).toBe(targetTicks);
    expect(sim144.tickCount).toBe(targetTicks);

    // Deterministic state equality: exactly the same final position
    expect(sim30.finalState.z).toBeCloseTo(sim60.finalState.z, 6);
    expect(sim144.finalState.z).toBeCloseTo(sim60.finalState.z, 6);
    expect(sim30.finalState.vz).toBeCloseTo(sim60.finalState.vz, 6);
    expect(sim144.finalState.vz).toBeCloseTo(sim60.finalState.vz, 6);

    // Interpolation smoothness: alpha must remain within [0, 1] at all times
    for (const alpha of sim30.alphas) {
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1.0);
    }
    for (const alpha of sim60.alphas) {
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1.0);
    }
    for (const alpha of sim144.alphas) {
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1.0);
    }

    // Rendered positions must monotonically advance forward (z becomes increasingly negative)
    for (let i = 1; i < sim144.renderZPositions.length; i++) {
      const prev = sim144.renderZPositions[i - 1]!;
      const curr = sim144.renderZPositions[i]!;
      expect(curr).toBeLessThanOrEqual(prev);
    }
  });
});
