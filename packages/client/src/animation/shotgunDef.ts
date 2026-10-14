import * as THREE from 'three';
import { SHOTGUN_DEF } from '@mini-arena/shared';
import { KeyframeClip, WeaponVisualDef } from './types';
import { buildShotgunModel } from '../models/shotgun';

/**
 * Creates the asset-swappable WeaponVisualDef for the Combat Shotgun.
 * Authors data-driven keyframes for idle, draw, inspect, fire (with pump rack),
 * and the 3-phase shell reload (start, insert, end).
 * Timing matches pure shared gameplay rules authoritative in SHOTGUN_DEF.
 */
export function createShotgunVisualDef(): WeaponVisualDef {
  const model = buildShotgunModel();

  // Baseline hand rests
  const rightGripRest = {
    pos: new THREE.Vector3(0.012, -0.065, 0.05),
    rot: new THREE.Euler(-0.32, 0, 0),
  };

  const leftPumpRest = {
    pos: new THREE.Vector3(-0.025, -0.01, -0.26),
    rot: new THREE.Euler(0.2, 0.35, -0.4),
  };

  // --- 1. IDLE CLIP ---
  const idleClip: KeyframeClip = {
    name: 'idle',
    duration: 3.0,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftPumpRest,
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
          pos: leftPumpRest.pos.clone().add(new THREE.Vector3(0, 0.002, 0)),
          rot: leftPumpRest.rot,
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0, 0.002, 0)),
          rot: rightGripRest.rot,
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.002, 0),
        weaponRotOffset: new THREE.Euler(0.003, 0, 0.002),
      },
      {
        time: 1.0,
        leftHand: leftPumpRest,
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
  const drawDuration = SHOTGUN_DEF.swapTime / 2; // 0.20s
  const drawClip: KeyframeClip = {
    name: 'draw',
    duration: drawDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: {
          pos: new THREE.Vector3(-0.15, -0.32, -0.15),
          rot: new THREE.Euler(0.4, 0.2, -0.2),
        },
        rightHand: {
          pos: new THREE.Vector3(0.12, -0.28, 0.08),
          rot: new THREE.Euler(-0.45, 0.1, 0.15),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.08, -0.22, 0.06),
        weaponRotOffset: new THREE.Euler(0.42, -0.2, 0.18),
      },
      {
        time: 0.7,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.006, -0.006),
        weaponRotOffset: new THREE.Euler(-0.02, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftPumpRest,
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
    duration: 3.2,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftPumpRest,
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
          rot: new THREE.Euler(0.1, 0.4, -0.4),
        },
        rightHand: {
          pos: new THREE.Vector3(0.04, -0.05, 0.04),
          rot: new THREE.Euler(-0.2, 0.5, -0.3),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.05, 0.04, 0.02),
        weaponRotOffset: new THREE.Euler(0.3, 0.7, -0.45),
      },
      {
        time: 0.70,
        leftHand: {
          pos: new THREE.Vector3(-0.05, -0.06, -0.24),
          rot: new THREE.Euler(-0.1, -0.3, 0.2),
        },
        rightHand: {
          pos: new THREE.Vector3(0.05, -0.05, 0.04),
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
        leftHand: leftPumpRest,
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

  // --- 4. FIRE CLIP (80 RPM = 0.75s, with mechanical pump action) ---
  const fireDuration = 60 / SHOTGUN_DEF.rpm; // 0.75s
  const fireClip: KeyframeClip = {
    name: 'fire',
    duration: fireDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.12, // Massive 12-gauge kick
        leftHand: {
          pos: leftPumpRest.pos.clone().add(new THREE.Vector3(0, 0.02, 0.03)),
          rot: new THREE.Euler(0.1, 0.35, -0.4),
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0, 0.02, 0.03)),
          rot: new THREE.Euler(-0.45, 0, 0),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.028, 0.045),
        weaponRotOffset: new THREE.Euler(0.24, 0, 0.02),
      },
      {
        time: 0.35, // Pump racks backward
        leftHand: {
          pos: leftPumpRest.pos.clone().add(new THREE.Vector3(0, 0, 0.06)),
          rot: leftPumpRest.rot,
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.06), // Pump slide pulled back
        weaponPosOffset: new THREE.Vector3(0, 0.005, 0.01),
        weaponRotOffset: new THREE.Euler(-0.04, 0.02, 0),
      },
      {
        time: 0.58, // Pump racks forward, chambering shell
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0), // Pump slide returned forward
        weaponPosOffset: new THREE.Vector3(0, -0.005, -0.005),
        weaponRotOffset: new THREE.Euler(0.04, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [
      { timeFraction: 0.05, type: 'fire_recoil' },
      { timeFraction: 0.35, type: 'bolt_pull' },
      { timeFraction: 0.58, type: 'bolt_release' },
    ],
  };

  // --- 5. SHOTGUN 3-PHASE RELOAD ---
  // Phase 1: reloadShellStart (24 ticks = 0.40s)
  const startDuration = 24 / 60;
  const reloadShellStartClip: KeyframeClip = {
    name: 'reloadShellStart',
    duration: startDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftPumpRest,
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
          pos: new THREE.Vector3(-0.06, -0.15, -0.1),
          rot: new THREE.Euler(0.2, 0.1, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.02),
        weaponRotOffset: new THREE.Euler(0.28, 0.15, -0.2), // Tilted up to expose loading port
      },
      {
        time: 1.0,
        leftHand: {
          pos: new THREE.Vector3(-0.04, -0.18, 0.0),
          rot: new THREE.Euler(0.3, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.03, 0.04, 0.03),
        weaponRotOffset: new THREE.Euler(0.32, 0.18, -0.25),
      },
    ],
    events: [],
  };

  // Phase 2: reloadShellInsert (32 ticks = 0.533s, commit at tick 20 = 0.333s = 0.625)
  const insertDuration = 32 / 60;
  const reloadShellInsertClip: KeyframeClip = {
    name: 'reloadShellInsert',
    duration: insertDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: {
          pos: new THREE.Vector3(-0.04, -0.18, 0.0),
          rot: new THREE.Euler(0.3, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.12, 0.05),
        magAttached: false, // Shell moving from pouch
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.03, 0.04, 0.03),
        weaponRotOffset: new THREE.Euler(0.32, 0.18, -0.25),
      },
      {
        time: 0.40, // Shell approaches loading gate
        leftHand: {
          pos: new THREE.Vector3(-0.01, -0.06, -0.02),
          rot: new THREE.Euler(0.2, 0.1, -0.1),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.04, 0.01),
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.03, 0.04, 0.03),
        weaponRotOffset: new THREE.Euler(0.32, 0.18, -0.25),
      },
      {
        time: 0.625, // Commit tick 20 / 32 = 0.625 -> shell clicks into magazine tube!
        leftHand: {
          pos: new THREE.Vector3(0.0, -0.02, -0.02),
          rot: new THREE.Euler(0.1, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true, // Shell committed!
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.03, 0.045, 0.03),
        weaponRotOffset: new THREE.Euler(0.34, 0.18, -0.25),
      },
      {
        time: 1.0, // Hand drops to grab next shell
        leftHand: {
          pos: new THREE.Vector3(-0.04, -0.18, 0.0),
          rot: new THREE.Euler(0.3, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.03, 0.04, 0.03),
        weaponRotOffset: new THREE.Euler(0.32, 0.18, -0.25),
      },
    ],
    events: [{ timeFraction: 0.625, type: 'shell_insert' }],
  };

  // Phase 3: reloadShellEnd (24 ticks = 0.40s)
  const endDuration = 24 / 60;
  const reloadShellEndClip: KeyframeClip = {
    name: 'reloadShellEnd',
    duration: endDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: {
          pos: new THREE.Vector3(-0.04, -0.18, 0.0),
          rot: new THREE.Euler(0.3, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.03, 0.04, 0.03),
        weaponRotOffset: new THREE.Euler(0.32, 0.18, -0.25),
      },
      {
        time: 0.5, // Hand returns to pump slide, racks slightly
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.02),
        weaponPosOffset: new THREE.Vector3(0, 0.01, 0.0),
        weaponRotOffset: new THREE.Euler(0.1, 0.05, 0),
      },
      {
        time: 1.0, // Settled back into ready
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [{ timeFraction: 0.5, type: 'bolt_release' }],
  };

  return {
    weaponId: 'shotgun',
    name: SHOTGUN_DEF.name,
    bodyMesh: model.body,
    magMesh: model.mag,
    boltMesh: model.bolt,
    muzzleOffset: model.muzzle,
    ejectionPortOffset: model.ejectionPort,
    magRestPos: model.magRestPos,
    magDropVelocity: new THREE.Vector3(-0.2, -1.8, 0.1),
    boltRestPos: model.boltRestPos,
    boltTravelVector: new THREE.Vector3(0, 0, 0.06),
    sockets: {
      gripR: rightGripRest.pos,
      gripL: leftPumpRest.pos,
      muzzle: model.muzzle,
      ejectPort: model.ejectionPort,
      magWell: model.magRestPos,
    },
    clips: {
      idle: idleClip,
      draw: drawClip,
      inspect: inspectClip,
      fire: fireClip,
      reloadTactical: reloadShellStartClip,
      reloadEmpty: reloadShellStartClip,
      reloadShellStart: reloadShellStartClip,
      reloadShellInsert: reloadShellInsertClip,
      reloadShellEnd: reloadShellEndClip,
    },
  };
}
