import { describe, it, expect } from 'vitest';
import {
  CROUCH_SPEED,
  GRAVITY,
  JUMP_VELOCITY,
  SIM_TICK_DELTA,
  SPRINT_SPEED,
  WALK_SPEED,
} from './constants';
import { createDefaultPlayerState, stepPlayer } from './movement';
import { PlayerInput } from './types';

function createInput(partial: Partial<PlayerInput> = {}): PlayerInput {
  return {
    seq: 1,
    tick: 1,
    moveForward: 0,
    moveRight: 0,
    jump: false,
    crouch: false,
    sprint: false,
    yaw: 0,
    pitch: 0,
    ...partial,
  };
}

describe('stepPlayer Deterministic Simulation', () => {
  it('is 100% bit-for-bit deterministic over 200 ticks', () => {
    let state1 = createDefaultPlayerState(0, 0, 0);
    let state2 = createDefaultPlayerState(0, 0, 0);

    const inputSequence: PlayerInput[] = [];
    for (let i = 0; i < 200; i++) {
      inputSequence.push(
        createInput({
          seq: i,
          tick: i,
          moveForward: i % 2 === 0 ? 1 : 0,
          moveRight: i % 3 === 0 ? 1 : -1,
          jump: i === 30 || i === 80,
          sprint: i > 50 && i < 120,
          crouch: i > 150,
          yaw: (i * 0.05) % (Math.PI * 2),
          pitch: Math.sin(i * 0.1),
        }),
      );
    }

    for (const input of inputSequence) {
      state1 = stepPlayer(state1, input, SIM_TICK_DELTA);
    }

    for (const input of inputSequence) {
      state2 = stepPlayer(state2, input, SIM_TICK_DELTA);
    }

    expect(state1).toEqual(state2);
    expect(state1.x).not.toBeNaN();
    expect(state1.y).not.toBeNaN();
    expect(state1.z).not.toBeNaN();
  });

  it('accelerates forward up to WALK_SPEED when walking', () => {
    let state = createDefaultPlayerState(0, 0, 0);
    const input = createInput({ moveForward: 1, yaw: 0 });

    // Step for 1 second (60 ticks)
    for (let i = 0; i < 60; i++) {
      state = stepPlayer(state, input, SIM_TICK_DELTA);
    }

    // In Three.js coordinates, forward (yaw = 0) is along -Z
    expect(state.vz).toBeCloseTo(-WALK_SPEED, 2);
    expect(state.vx).toBeCloseTo(0, 2);
    expect(state.z).toBeLessThan(0);
  });

  it('accelerates to SPRINT_SPEED when sprinting forward', () => {
    let state = createDefaultPlayerState(0, 0, 0);
    const input = createInput({ moveForward: 1, sprint: true, yaw: 0 });

    for (let i = 0; i < 60; i++) {
      state = stepPlayer(state, input, SIM_TICK_DELTA);
    }

    expect(state.vz).toBeCloseTo(-SPRINT_SPEED, 2);
    expect(state.isSprinting).toBe(true);
  });

  it('restricts speed to CROUCH_SPEED when crouching', () => {
    let state = createDefaultPlayerState(0, 0, 0);
    const input = createInput({ moveForward: 1, crouch: true, sprint: true, yaw: 0 });

    for (let i = 0; i < 60; i++) {
      state = stepPlayer(state, input, SIM_TICK_DELTA);
    }

    expect(state.vz).toBeCloseTo(-CROUCH_SPEED, 2);
    expect(state.isCrouching).toBe(true);
    expect(state.isSprinting).toBe(false); // sprint canceled by crouch
  });

  it('applies jump impulse and falls back down with gravity', () => {
    let state = createDefaultPlayerState(0, 0, 0);
    const jumpInput = createInput({ jump: true });
    const idleInput = createInput({ jump: false });

    // Tick 1: trigger jump
    state = stepPlayer(state, jumpInput, SIM_TICK_DELTA);
    expect(state.vy).toBe(JUMP_VELOCITY);
    expect(state.isGrounded).toBe(false);

    // Let player rise
    let maxHeight = 0;
    for (let i = 0; i < 30; i++) {
      state = stepPlayer(state, idleInput, SIM_TICK_DELTA);
      if (state.y > maxHeight) maxHeight = state.y;
    }
    expect(maxHeight).toBeGreaterThan(0.5);

    // Continue simulation until player lands
    for (let i = 0; i < 60; i++) {
      state = stepPlayer(state, idleInput, SIM_TICK_DELTA);
    }
    expect(state.y).toBe(0);
    expect(state.isGrounded).toBe(true);
    expect(state.vy).toBe(0);
  });
});
