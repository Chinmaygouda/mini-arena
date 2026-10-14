import * as THREE from 'three';
import { SNIPER_DEF } from '@mini-arena/shared';
import { KeyframeClip, WeaponVisualDef } from './types';
import { buildSniperModel } from '../models/sniper';

/**
 * Creates the asset-swappable WeaponVisualDef for the Precision Sniper Rifle.
 * Authors data-driven keyframes for idle, draw, inspect, fire, 80-tick bolt cycle,
 * and precision tactical and empty reloads.
 * Timing matches pure shared gameplay rules authoritative in SNIPER_DEF.
 */
export function createSniperVisualDef(): WeaponVisualDef {
  const model = buildSniperModel();

  // Baseline hand rests
  const rightGripRest = {
    pos: new THREE.Vector3(0.012, -0.065, 0.06),
    rot: new THREE.Euler(-0.32, 0, 0),
  };

  const leftForendRest = {
    pos: new THREE.Vector3(-0.025, -0.01, -0.25),
    rot: new THREE.Euler(0.2, 0.35, -0.35),
  };

  // --- 1. IDLE CLIP ---
  const idleClip: KeyframeClip = {
    name: 'idle',
    duration: 3.2,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.5,
        leftHand: {
          pos: leftForendRest.pos.clone().add(new THREE.Vector3(0, 0.002, 0)),
          rot: leftForendRest.rot,
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0, 0.002, 0)),
          rot: rightGripRest.rot,
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.002, 0),
        weaponRotOffset: new THREE.Euler(0.002, 0, 0.001),
      },
      {
        time: 1.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [],
  };

  // --- 2. DRAW CLIP ---
  const drawDuration = SNIPER_DEF.swapTime / 2; // 0.25s
  const drawClip: KeyframeClip = {
    name: 'draw',
    duration: drawDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: {
          pos: new THREE.Vector3(-0.16, -0.35, -0.2),
          rot: new THREE.Euler(0.4, 0.2, -0.2),
        },
        rightHand: {
          pos: new THREE.Vector3(0.12, -0.32, 0.1),
          rot: new THREE.Euler(-0.45, 0.1, 0.15),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.08, -0.24, 0.08),
        weaponRotOffset: new THREE.Euler(0.4, -0.2, 0.18),
      },
      {
        time: 0.7,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.006, -0.006),
        weaponRotOffset: new THREE.Euler(-0.02, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [{ timeFraction: 0.1, type: 'draw_equip' }],
  };

  // --- 3. INSPECT CLIP ---
  const inspectClip: KeyframeClip = {
    name: 'inspect',
    duration: 3.5,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.35,
        leftHand: {
          pos: new THREE.Vector3(-0.08, -0.04, -0.2),
          rot: new THREE.Euler(0.1, 0.4, -0.3),
        },
        rightHand: {
          pos: new THREE.Vector3(0.04, -0.05, 0.06),
          rot: new THREE.Euler(-0.2, 0.5, -0.3),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.05, 0.04, 0.02),
        weaponRotOffset: new THREE.Euler(0.3, 0.65, -0.4),
      },
      {
        time: 0.70,
        leftHand: {
          pos: new THREE.Vector3(-0.05, -0.06, -0.24),
          rot: new THREE.Euler(-0.1, -0.3, 0.2),
        },
        rightHand: {
          pos: new THREE.Vector3(0.05, -0.05, 0.06),
          rot: new THREE.Euler(-0.2, -0.3, 0.2),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.04, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(-0.15, -0.5, 0.3),
      },
      {
        time: 1.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [{ timeFraction: 0.25, type: 'inspect_tilt' }],
  };

  // --- 4. FIRE CLIP ---
  const fireClip: KeyframeClip = {
    name: 'fire',
    duration: 0.25,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.15,
        leftHand: {
          pos: leftForendRest.pos.clone().add(new THREE.Vector3(0, 0.025, 0.04)),
          rot: new THREE.Euler(0.15, 0.35, -0.35),
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0, 0.025, 0.04)),
          rot: new THREE.Euler(-0.5, 0, 0),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.035, 0.06),
        weaponRotOffset: new THREE.Euler(0.28, 0, 0.02),
      },
      {
        time: 1.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [{ timeFraction: 0.05, type: 'fire_recoil' }],
  };

  // --- 5. 80-TICK BOLT CYCLE CLIP (1.333s authoritative in SNIPER_DEF) ---
  const boltCycleDuration = 80 / 60; // 1.3333s
  const boltCycleClip: KeyframeClip = {
    name: 'boltCycle',
    duration: boltCycleDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.18, // Right hand reaches up to bolt knob
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.045, 0.02, 0.01),
          rot: new THREE.Euler(-0.2, 0.2, -0.2),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.005, 0.0),
        weaponRotOffset: new THREE.Euler(0.05, 0.05, -0.05),
      },
      {
        time: 0.35, // Lifts bolt handle upward
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.045, 0.045, 0.01),
          rot: new THREE.Euler(0.1, 0.2, -0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0.01, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.01, 0.0),
        weaponRotOffset: new THREE.Euler(0.06, 0.06, -0.05),
      },
      {
        time: 0.55, // Pulls bolt back -> shell casing ejects!
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.045, 0.045, 0.08),
          rot: new THREE.Euler(0.1, 0.2, -0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0.01, 0.07), // Bolt pulled back 7cm
        weaponPosOffset: new THREE.Vector3(-0.015, 0.01, 0.01),
        weaponRotOffset: new THREE.Euler(0.08, 0.08, -0.06),
      },
      {
        time: 0.75, // Pushes bolt forward -> chambering fresh round
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.045, 0.045, 0.01),
          rot: new THREE.Euler(0.1, 0.2, -0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0.01, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.005, 0.0),
        weaponRotOffset: new THREE.Euler(0.05, 0.05, -0.04),
      },
      {
        time: 0.88, // Rotates bolt handle down, locking receiver
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.045, 0.02, 0.01),
          rot: new THREE.Euler(-0.2, 0.2, -0.2),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.002, 0.0),
        weaponRotOffset: new THREE.Euler(0.02, 0.02, -0.02),
      },
      {
        time: 1.0, // Right hand returns to grip
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [
      { timeFraction: 0.35, type: 'bolt_pull' },
      { timeFraction: 0.88, type: 'bolt_release' },
    ],
  };

  // --- 6. TACTICAL RELOAD CLIP ---
  // Duration: 2.8s. Commit at tick 96 (1.60s, t = 96/168 = 0.5714)
  const tacDuration = SNIPER_DEF.reloadTimeTactical;
  const reloadTacticalClip: KeyframeClip = {
    name: 'reloadTactical',
    duration: tacDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.25,
        leftHand: {
          pos: new THREE.Vector3(-0.06, -0.22, -0.05),
          rot: new THREE.Euler(0.2, 0.1, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.0),
        weaponRotOffset: new THREE.Euler(0.2, 0.15, -0.1),
      },
      {
        time: 0.42,
        leftHand: {
          pos: new THREE.Vector3(-0.02, -0.16, -0.06),
          rot: new THREE.Euler(0.25, 0.1, -0.1),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.08, 0.02),
        magAttached: false, // Mag dropped
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.04, 0.0),
        weaponRotOffset: new THREE.Euler(0.22, 0.15, -0.1),
      },
      {
        time: 0.57, // Commit tick 96 / 168 = 0.5714
        leftHand: {
          pos: new THREE.Vector3(0.0, -0.08, -0.06),
          rot: new THREE.Euler(0.1, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true, // Fresh 5-round box mag seated
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.025, 0.0),
        weaponRotOffset: new THREE.Euler(0.15, 0.05, -0.05),
      },
      {
        time: 0.80,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.005, 0.0),
        weaponRotOffset: new THREE.Euler(0.04, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [
      { timeFraction: 0.38, type: 'mag_drop' },
      { timeFraction: 0.57, type: 'mag_insert' },
    ],
  };

  // --- 7. EMPTY RELOAD CLIP (Bolt cycle + mag insert) ---
  // Duration: 3.5s. Commit at tick 114 (1.90s, t = 114/210 = 0.5428)
  const emptyDuration = SNIPER_DEF.reloadTimeEmpty;
  const reloadEmptyClip: KeyframeClip = {
    name: 'reloadEmpty',
    duration: emptyDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.25, // Mag drops
        leftHand: {
          pos: new THREE.Vector3(-0.06, -0.2, -0.06),
          rot: new THREE.Euler(0.2, 0.1, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.08, 0.02),
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.0),
        weaponRotOffset: new THREE.Euler(0.22, 0.15, -0.1),
      },
      {
        time: 0.54, // Commit tick 114 / 210 = 0.5428
        leftHand: {
          pos: new THREE.Vector3(0.0, -0.08, -0.06),
          rot: new THREE.Euler(0.1, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true, // Fresh mag inserted
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(0.16, 0.05, -0.05),
      },
      {
        time: 0.72, // Right hand cycles bolt to chamber first round
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.045, 0.045, 0.06),
          rot: new THREE.Euler(0.1, 0.2, -0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0.01, 0.06),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.015, 0.0),
        weaponRotOffset: new THREE.Euler(0.06, 0.06, -0.04),
      },
      {
        time: 0.88, // Bolt locked forward
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.045, 0.02, 0.01),
          rot: new THREE.Euler(-0.2, 0.2, -0.2),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.005, 0.0),
        weaponRotOffset: new THREE.Euler(0.02, 0.02, -0.02),
      },
      {
        time: 1.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [
      { timeFraction: 0.25, type: 'mag_drop' },
      { timeFraction: 0.54, type: 'mag_insert' },
      { timeFraction: 0.72, type: 'bolt_pull' },
      { timeFraction: 0.88, type: 'bolt_release' },
    ],
  };

  return {
    weaponId: 'sniper',
    name: SNIPER_DEF.name,
    bodyMesh: model.body,
    magMesh: model.mag,
    boltMesh: model.bolt,
    muzzleOffset: model.muzzle,
    ejectionPortOffset: model.ejectionPort,
    magRestPos: model.magRestPos,
    magDropVelocity: new THREE.Vector3(-0.2, -1.9, 0.1),
    boltRestPos: model.boltRestPos,
    boltTravelVector: new THREE.Vector3(0, 0, 0.07),
    sockets: {
      gripR: rightGripRest.pos,
      gripL: leftForendRest.pos,
      muzzle: model.muzzle,
      ejectPort: model.ejectionPort,
      magWell: model.magRestPos,
    },
    clips: {
      idle: idleClip,
      draw: drawClip,
      inspect: inspectClip,
      fire: fireClip,
      boltCycle: boltCycleClip,
      reloadTactical: reloadTacticalClip,
      reloadEmpty: reloadEmptyClip,
    },
  };
}
