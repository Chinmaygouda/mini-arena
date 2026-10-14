import { describe, it, expect } from 'vitest';
import { SIM_TICK_RATE, SIM_TICK_DELTA, clamp, MAX_PLAYERS } from './index';

describe('Shared Sim Constants & Math', () => {
  it('has consistent tick rate definitions', () => {
    expect(SIM_TICK_RATE).toBe(60);
    expect(SIM_TICK_DELTA).toBeCloseTo(1 / 60, 5);
    expect(MAX_PLAYERS).toBe(4);
  });

  it('clamps values deterministically', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
