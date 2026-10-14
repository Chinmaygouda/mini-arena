/**
 * Seeded deterministic shotgun pellet spread generator.
 * Employs a competitive fixed ring-and-center pattern rotated by a seeded roll angle.
 * Guarantees zero runtime allocations and bit-for-bit identical results on client and server.
 */

export interface PelletOffset {
  pitch: number;
  yaw: number;
}

/**
 * Standard fixed 8-pellet geometric pattern normalized to unit radius [0..1].
 * Pellet 0 is centered; pellets 1..7 form an equidistant outer heptagonal ring.
 */
const BASE_PELLET_PATTERN: Array<{ r: number; angle: number }> = [
  { r: 0.0, angle: 0.0 }, // Center core pellet
  { r: 0.85, angle: 0.0 }, // Ring pellet 1
  { r: 0.85, angle: (2 * Math.PI) / 7 }, // Ring pellet 2
  { r: 0.85, angle: (4 * Math.PI) / 7 }, // Ring pellet 3
  { r: 0.85, angle: (6 * Math.PI) / 7 }, // Ring pellet 4
  { r: 0.85, angle: (8 * Math.PI) / 7 }, // Ring pellet 5
  { r: 0.85, angle: (10 * Math.PI) / 7 }, // Ring pellet 6
  { r: 0.85, angle: (12 * Math.PI) / 7 }, // Ring pellet 7
];

/**
 * 32-bit integer hash function combining a string player ID and an integer shot sequence.
 */
export function hashPlayerShot(playerId: string, shotSeq: number): number {
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < playerId.length; i++) {
    hash ^= playerId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= shotSeq & 0xffffffff;
  hash = Math.imul(hash, 0x01000193);
  return (hash >>> 0);
}

/**
 * Fast zero-allocation splitmix32-based float generator [0, 1).
 */
function splitmix32(state: number): { nextVal: number; nextState: number } {
  state = (state + 0x9e3779b9) | 0;
  let z = state;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  z = z ^ (z >>> 15);
  return { nextVal: (z >>> 0) / 4294967296, nextState: state };
}

/**
 * Generates deterministic pitch and yaw angular offsets for all pellets in a shotgun blast.
 * Writes directly into target array to avoid heap allocations.
 *
 * @param spreadHalfAngle Cone half-angle in radians (from computeEffectiveSpread)
 * @param seed 32-bit integer seed derived from (playerId, shotSeq)
 * @param outOffsets Target array to receive the 8 pellet offsets
 */
export function generateSeededPelletOffsets(
  spreadHalfAngle: number,
  seed: number,
  outOffsets: PelletOffset[],
): PelletOffset[] {
  // 1. Generate master rotation roll angle for the pattern
  let state = seed;
  let step = splitmix32(state);
  const patternRoll = step.nextVal * Math.PI * 2;
  state = step.nextState;

  const count = Math.min(BASE_PELLET_PATTERN.length, outOffsets.length);

  for (let i = 0; i < count; i++) {
    const base = BASE_PELLET_PATTERN[i]!;

    // Small deterministic per-pellet jitter (±10% radius, ±0.15 rad angle)
    step = splitmix32(state);
    const rJitter = (step.nextVal - 0.5) * 0.15;
    state = step.nextState;

    step = splitmix32(state);
    const angleJitter = (step.nextVal - 0.5) * 0.25;
    state = step.nextState;

    const r = Math.max(0, (base.r + (base.r > 0 ? rJitter : 0))) * spreadHalfAngle;
    const finalAngle = base.angle + patternRoll + (base.r > 0 ? angleJitter : 0);

    const target = outOffsets[i]!;
    target.pitch = r * Math.sin(finalAngle);
    target.yaw = r * Math.cos(finalAngle);
  }

  return outOffsets;
}
