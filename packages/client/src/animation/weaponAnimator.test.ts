import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAX_COSMETIC_PHYSICS_DT, stepCosmeticPhysics } from './weaponAnimator';

describe('Cosmetic Physics Delta Time Clamping (A8)', () => {
  it('clamps dt to MAX_COSMETIC_PHYSICS_DT (1/30s) when large dt occurs after background tab', () => {
    const pos = new THREE.Vector3(0, 1.0, 0);
    const vel = new THREE.Vector3(0, 0, 0);
    const rot = new THREE.Euler(0, 0, 0);
    const rotVel = new THREE.Vector3(1, 0, 0);

    // Large delta time (e.g. tab backgrounded for 10 seconds)
    const largeDt = 10.0;
    const clampedDt = stepCosmeticPhysics(pos, vel, rot, rotVel, largeDt);

    // Assert returned dt was clamped to exactly 1/30s
    expect(clampedDt).toBeCloseTo(MAX_COSMETIC_PHYSICS_DT, 5);
    expect(clampedDt).toBeCloseTo(1 / 30, 5);

    // Velocity change is gravity * (1/30) = -9.8 / 30 = -0.3267 m/s, NOT -98 m/s!
    expect(vel.y).toBeCloseTo(-9.8 * (1 / 30), 4);
    expect(vel.y).toBeGreaterThan(-0.5);

    // Position displacement is small, preventing teleportation
    expect(pos.y).toBeLessThan(1.0);
    expect(pos.y).toBeGreaterThan(0.98);
  });

  it('integrates normal frame dt (16.6ms at 60 Hz) without modification', () => {
    const pos = new THREE.Vector3(0, 1.0, 0);
    const vel = new THREE.Vector3(0, 0, 0);
    const rot = new THREE.Euler(0, 0, 0);
    const rotVel = new THREE.Vector3(1, 0, 0);

    const normalDt = 1 / 60; // 16.67ms
    const clampedDt = stepCosmeticPhysics(pos, vel, rot, rotVel, normalDt);

    expect(clampedDt).toBeCloseTo(normalDt, 5);
    expect(vel.y).toBeCloseTo(-9.8 * (1 / 60), 4);
  });
});
