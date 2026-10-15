import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEATH_COLLAPSE_DURATION, TargetDummyManager } from './dummies';

describe('TargetDummyManager — Third-Person Articulated Combatants', () => {
  it('spawns 3 articulated combatants with separated upper and lower body hierarchies', () => {
    const scene = new THREE.Scene();
    const manager = new TargetDummyManager(scene);

    expect(manager.dummies).toHaveLength(3);

    for (const dummy of manager.dummies) {
      expect(dummy.upperBodyGroup).toBeDefined();
      expect(dummy.lowerBodyGroup).toBeDefined();
      expect(dummy.leftLegGroup).toBeDefined();
      expect(dummy.rightLegGroup).toBeDefined();
      expect(dummy.leftArmGroup).toBeDefined();
      expect(dummy.rightArmGroup).toBeDefined();
      expect(dummy.state).toBe('alive');
      expect(dummy.health).toBe(100);
    }
  });

  it('verifies foot-sliding check invariant during patrol locomotion', () => {
    const scene = new THREE.Scene();
    const manager = new TargetDummyManager(scene);

    const charlie = manager.dummies.find((d) => d.id === 'dummy-far')!;
    expect(charlie).toBeDefined();
    expect(charlie.velocity.x).toBeGreaterThan(0);

    const initialX = charlie.group.position.x;

    // Step 60 frames at 60 Hz (1 second)
    const dt = 1 / 60;
    for (let frame = 0; frame < 60; frame++) {
      manager.update(dt);
      // Foot-sliding error must be within mathematical float precision (< 1e-5)
      expect(charlie.footSlidingError).toBeLessThan(1e-5);
    }

    // Position must have displaced along patrol path
    expect(charlie.group.position.x).not.toBe(initialX);
    // Legs must have oscillated
    expect(Math.abs(charlie.leftLegGroup.rotation.x)).toBeGreaterThan(0.01);
  });

  it('verifies upper-body aim pitch tracks target elevation independently of legs', () => {
    const scene = new THREE.Scene();
    const manager = new TargetDummyManager(scene);

    const alpha = manager.dummies.find((d) => d.id === 'dummy-close')!;
    expect(alpha.aimPitch).toBe(0);

    // Player position at (0, 3.5, 0) — elevated 3.5 meters above dummy (dummy is at z = -8)
    const highGroundPlayer = new THREE.Vector3(0, 3.5, 0);
    manager.updateAimTracking(highGroundPlayer);

    // Alpha must pitch upward (negative angle in Three.js coordinate system)
    expect(alpha.upperBodyGroup.rotation.x).toBeLessThan(0);
    expect(alpha.aimPitch).toBeCloseTo(alpha.upperBodyGroup.rotation.x, 3);

    // Lower body remains unpitched
    expect(alpha.lowerBodyGroup.rotation.x).toBe(0);
  });

  it('executes directional death collapse and corpse hitbox ignore on lethal damage', () => {
    const scene = new THREE.Scene();
    const manager = new TargetDummyManager(scene);

    const alpha = manager.dummies.find((d) => d.id === 'dummy-close')!;

    // Initial hitscan hit succeeds
    const initialHit = manager.testRay({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: -1 }, 100);
    expect(initialHit.hit).toBe(true);
    expect(initialHit.dummyId).toBe('dummy-close');

    // Inflict lethal damage
    manager.kill('dummy-close');
    expect(alpha.state).toBe('collapsing');
    expect(alpha.deathProgress).toBe(0);

    // Step halfway through death collapse (0.3s)
    manager.update(0.3);
    expect(alpha.state).toBe('collapsing');
    expect(alpha.deathProgress).toBeCloseTo(0.5, 2);
    expect(alpha.group.position.y).toBeLessThan(0); // Sinking towards floor
    expect(alpha.group.rotation.x).toBeLessThan(0); // Falling backward

    // Complete collapse duration
    manager.update(DEATH_COLLAPSE_DURATION);
    expect(alpha.state).toBe('dead');
    expect(alpha.deathProgress).toBeGreaterThanOrEqual(1.0);

    // Hitscan against dead/collapsed dummy must pass through (no hit)
    const hitAfterDeath = manager.testRay({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: -1 }, 100);
    expect(hitAfterDeath.dummyId).not.toBe('dummy-close');
  });
});
