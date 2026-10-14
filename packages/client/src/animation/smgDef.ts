import * as THREE from 'three';
import { SMG_DEF } from '@mini-arena/shared';
import { KeyframeClip, WeaponVisualDef } from './types';
import { buildSmgModel } from '../models/smg';

/**
 * Creates the asset-swappable WeaponVisualDef for the Rapid SMG.
 * Authors data-driven keyframes for idle, draw, inspect, tactical reload, empty reload (HK slap), and fire.
 * Timing matches pure shared gameplay rules authoritative in SMG_DEF.
 */
export function createSmgVisualDef(): WeaponVisualDef {
  const model = buildSmgModel();

  // Baseline hand rests
  const rightGripRest = {
    pos: new THREE.Vector3(0.012, -0.065, 0.035),
    rot: new THREE.Euler(-0.3, 0, 0),
  };

  const leftForegripRest = {
    pos: new THREE.Vector3(-0.02, -0.045, -0.15),
    rot: new THREE.Euler(0.2, 0.3, -0.3),
  };

  // --- 1. IDLE CLIP ---
  const idleClip: KeyframeClip = {
    name: 'idle',
    duration: 2.8,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForegripRest,
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
          pos: leftForegripRest.pos.clone().add(new THREE.Vector3(0, 0.002, 0)),
          rot: leftForegripRest.rot,
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
        leftHand: leftForegripRest,
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
  const drawDuration = SMG_DEF.swapTime / 2; // 0.175s
  const drawClip: KeyframeClip = {
    name: 'draw',
    duration: drawDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: {
          pos: new THREE.Vector3(-0.12, -0.3, -0.1),
          rot: new THREE.Euler(0.3, 0.2, -0.2),
        },
        rightHand: {
          pos: new THREE.Vector3(0.1, -0.25, 0.05),
          rot: new THREE.Euler(-0.4, 0.1, 0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.06, -0.2, 0.05),
        weaponRotOffset: new THREE.Euler(0.4, -0.2, 0.15),
      },
      {
        time: 0.65,
        leftHand: leftForegripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.005, -0.005),
        weaponRotOffset: new THREE.Euler(-0.02, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftForegripRest,
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
    duration: 3.0,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForegripRest,
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
          pos: new THREE.Vector3(-0.08, -0.08, -0.08),
          rot: new THREE.Euler(0, 0.3, -0.3),
        },
        rightHand: {
          pos: new THREE.Vector3(0.04, -0.05, 0.02),
          rot: new THREE.Euler(-0.2, 0.4, -0.2),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.04, 0.03, 0.02),
        weaponRotOffset: new THREE.Euler(0.25, 0.6, -0.35),
      },
      {
        time: 0.70,
        leftHand: {
          pos: new THREE.Vector3(-0.04, -0.07, -0.1),
          rot: new THREE.Euler(-0.1, -0.3, 0.2),
        },
        rightHand: {
          pos: new THREE.Vector3(0.05, -0.05, 0.02),
          rot: new THREE.Euler(-0.2, -0.3, 0.2),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.04, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(-0.15, -0.5, 0.25),
      },
      {
        time: 1.0,
        leftHand: leftForegripRest,
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

  // --- 4. FIRE CLIP (Rapid 800 RPM = 0.075s) ---
  const fireDuration = 60 / SMG_DEF.rpm; // 0.075s
  const fireClip: KeyframeClip = {
    name: 'fire',
    duration: fireDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForegripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.3,
        leftHand: {
          pos: leftForegripRest.pos.clone().add(new THREE.Vector3(0, 0.003, 0.008)),
          rot: leftForegripRest.rot,
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0, 0.003, 0.008)),
          rot: new THREE.Euler(-0.35, 0, 0),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.025), // Rapid bolt reciprocation
        weaponPosOffset: new THREE.Vector3(0, 0.006, 0.016),
        weaponRotOffset: new THREE.Euler(0.06, 0, 0.008),
      },
      {
        time: 1.0,
        leftHand: leftForegripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [{ timeFraction: 0.1, type: 'fire_recoil' }],
  };

  // --- 5. TACTICAL RELOAD CLIP ---
  // Duration: 1.8s. Commit at tick 60 (1.00s, t = 60/108 = 0.5555)
  const tacDuration = SMG_DEF.reloadTimeTactical;
  const reloadTacticalClip: KeyframeClip = {
    name: 'reloadTactical',
    duration: tacDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForegripRest,
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
          pos: new THREE.Vector3(-0.06, -0.2, -0.05),
          rot: new THREE.Euler(0.2, 0.1, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(0.2, 0.15, -0.1),
      },
      {
        time: 0.40,
        leftHand: {
          pos: new THREE.Vector3(-0.02, -0.15, -0.05),
          rot: new THREE.Euler(0.25, 0.1, -0.1),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.08, 0.02),
        magAttached: false, // Mag drops
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.0),
        weaponRotOffset: new THREE.Euler(0.22, 0.15, -0.1),
      },
      {
        time: 0.55, // Commit tick 60/108 = 0.5555
        leftHand: {
          pos: new THREE.Vector3(0.0, -0.09, -0.06),
          rot: new THREE.Euler(0.1, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true, // Fresh stick mag inserted
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(0.15, 0.05, -0.05),
      },
      {
        time: 0.80,
        leftHand: leftForegripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.005, 0.0),
        weaponRotOffset: new THREE.Euler(0.03, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftForegripRest,
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
      { timeFraction: 0.55, type: 'mag_insert' },
    ],
  };

  // --- 6. EMPTY RELOAD CLIP (With iconic HK slap bolt release!) ---
  // Duration: 2.3s. Commit at tick 72 (1.20s, t = 72/138 = 0.5217)
  const emptyDuration = SMG_DEF.reloadTimeEmpty;
  const reloadEmptyClip: KeyframeClip = {
    name: 'reloadEmpty',
    duration: emptyDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForegripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.03), // Locked back
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.28,
        leftHand: {
          pos: new THREE.Vector3(-0.06, -0.2, -0.05),
          rot: new THREE.Euler(0.2, 0.1, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.08, 0.02),
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0.03),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.0),
        weaponRotOffset: new THREE.Euler(0.25, 0.15, -0.1),
      },
      {
        time: 0.52, // Commit tick 72/138 = 0.5217
        leftHand: {
          pos: new THREE.Vector3(0.0, -0.09, -0.06),
          rot: new THREE.Euler(0.1, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.03),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(0.18, 0.05, -0.05),
      },
      {
        time: 0.72, // Hand reaches up above receiver and slaps charging handle down
        leftHand: {
          pos: new THREE.Vector3(-0.03, 0.06, -0.05),
          rot: new THREE.Euler(-0.3, 0.2, -0.4),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.03),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.015, -0.01),
        weaponRotOffset: new THREE.Euler(-0.05, 0, 0),
      },
      {
        time: 0.76, // Slap impact -> bolt snaps forward!
        leftHand: {
          pos: new THREE.Vector3(-0.03, 0.02, -0.06),
          rot: new THREE.Euler(-0.1, 0.1, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0), // Forward!
        weaponPosOffset: new THREE.Vector3(0, -0.01, 0.01),
        weaponRotOffset: new THREE.Euler(0.08, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftForegripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [
      { timeFraction: 0.26, type: 'mag_drop' },
      { timeFraction: 0.52, type: 'mag_insert' },
      { timeFraction: 0.76, type: 'bolt_release' },
    ],
  };

  return {
    weaponId: 'smg',
    name: SMG_DEF.name,
    bodyMesh: model.body,
    magMesh: model.mag,
    boltMesh: model.bolt,
    muzzleOffset: model.muzzle,
    ejectionPortOffset: model.ejectionPort,
    magRestPos: model.magRestPos,
    magDropVelocity: new THREE.Vector3(-0.25, -2.0, 0.15),
    boltRestPos: model.boltRestPos,
    boltTravelVector: new THREE.Vector3(0, 0, 0.03),
    sockets: {
      gripR: rightGripRest.pos,
      gripL: leftForegripRest.pos,
      muzzle: model.muzzle,
      ejectPort: model.ejectionPort,
      magWell: model.magRestPos,
    },
    clips: {
      idle: idleClip,
      draw: drawClip,
      inspect: inspectClip,
      reloadTactical: reloadTacticalClip,
      reloadEmpty: reloadEmptyClip,
      fire: fireClip,
    },
  };
}
