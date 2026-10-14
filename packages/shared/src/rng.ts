/**
 * Pure deterministic seeded pseudo-random number generator (Mulberry32).
 * Binding Rule: No Math.random() in shared simulation (AGENT_RULES.md Rule C).
 */

export interface SeededRng {
  next(): number; // Returns float in [0, 1)
  range(min: number, max: number): number; // Returns float in [min, max)
  nextSeed(): number;
}

export function createSeededRng(seed: number): SeededRng {
  let s = seed >>> 0;

  function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min: number, max: number): number {
    return min + next() * (max - min);
  }

  function nextSeed(): number {
    return ((next() * 0xffffffff) >>> 0);
  }

  return {
    next,
    range,
    nextSeed,
  };
}
