import * as THREE from 'three';
import { PISTOL_DEF } from '@mini-arena/shared';
import { KeyframeClip, WeaponVisualDef } from './types';
import { buildPistolModel } from '../models/pistol';
import { PISTOL_GRIP_RIGHT, PISTOL_GRIP_LEFT } from './fingerGripPoses';

/**
 * Creates the asset-swappable WeaponVisualDef for the Tactical Pistol.
 * Authors data-driven keyframes for idle, draw, inspect, tactical reload, empty reload, fire, walk, sprint, and holster.
 * Timing matches pure shared gameplay rules authoritative in PISTOL_DEF.
 */
export function createPistolVisualDef(): WeaponVisualDef {
  const model = buildPistolModel();

  // Baseline hand rests relative to weapon root
  // Right hand grips pistol handle
  const rightGripRest = {
    pos: new THREE.Vector3(0.012, -0.040, 0.082),
    rot: new THREE.Euler(-1.74, 0.08, -0.12, 'YXZ'),
  };

  // Left hand wraps around right hand in modern thumbs-forward support grip
  const leftSupportRest = {
    pos: new THREE.Vector3(-0.014, -0.044, 0.076),
    rot: new THREE.Euler(-1.68, -0.10, 0.12, 'YXZ'),
  };

  // --- 1. IDLE CLIP ---
  const idleClip: KeyframeClip = {
    name: 'idle',
    duration: 3.0,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftSupportRest,
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
          pos: leftSupportRest.pos.clone().add(new THREE.Vector3(0, 0.002, 0)),
          rot: leftSupportRest.rot,
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
        leftHand: leftSupportRest,
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

  // --- 2. DRAW / EQUIP CLIP ---
  const drawDuration = PISTOL_DEF.swapTime / 2; // 0.15s
  const drawClip: KeyframeClip = {
    name: 'draw',
    duration: drawDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftSupportRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.02, -0.08, 0.02),
        weaponRotOffset: new THREE.Euler(0.2, -0.08, 0.08),
      },
      {
        time: 0.6,
        leftHand: leftSupportRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.005, -0.005),
        weaponRotOffset: new THREE.Euler(-0.02, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftSupportRest,
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
        leftHand: leftSupportRest,
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
          pos: new THREE.Vector3(-0.06, -0.1, 0.02),
          rot: new THREE.Euler(-0.1, 0.3, -0.3),
        },
        rightHand: {
          pos: new THREE.Vector3(0.02, -0.04, 0.02),
          rot: new THREE.Euler(-0.1, 0.3, -0.3),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.04, 0.03, 0.02),
        weaponRotOffset: new THREE.Euler(0.2, 0.65, -0.4),
      },
      {
        time: 0.7,
        leftHand: {
          pos: new THREE.Vector3(-0.04, -0.08, 0.02),
          rot: new THREE.Euler(-0.1, -0.3, 0.2),
        },
        rightHand: {
          pos: new THREE.Vector3(0.04, -0.05, 0.02),
          rot: new THREE.Euler(-0.1, -0.3, 0.2),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.03, 0.02, 0.01),
        weaponRotOffset: new THREE.Euler(-0.1, -0.5, 0.3),
      },
      {
        time: 1.0,
        leftHand: leftSupportRest,
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
  const fireDuration = 60 / PISTOL_DEF.rpm; // 0.15s
  const fireClip: KeyframeClip = {
    name: 'fire',
    duration: fireDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftSupportRest,
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
          pos: leftSupportRest.pos.clone().add(new THREE.Vector3(0, 0.005, 0.01)),
          rot: new THREE.Euler(-0.35, 0.25, -0.2),
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0, 0.005, 0.01)),
          rot: new THREE.Euler(-0.38, 0, 0),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.035), // Slide recoils backward!
        weaponPosOffset: new THREE.Vector3(0, 0.01, 0.025),
        weaponRotOffset: new THREE.Euler(0.12, 0, 0.01),
      },
      {
        time: 1.0,
        leftHand: leftSupportRest,
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

  // --- 5. TACTICAL RELOAD CLIP ---
  // Duration: 1.6s. Commit at tick 54 (0.90s, t = 0.5625)
  const tacDuration = PISTOL_DEF.reloadTimeTactical;
  const reloadTacticalClip: KeyframeClip = {
    name: 'reloadTactical',
    duration: tacDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftSupportRest,
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
          pos: new THREE.Vector3(-0.06, -0.22, 0.04),
          rot: new THREE.Euler(0.2, 0.1, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(0.2, 0.1, -0.15),
      },
      {
        time: 0.40,
        leftHand: {
          pos: new THREE.Vector3(-0.02, -0.16, 0.03),
          rot: new THREE.Euler(0.3, 0.1, -0.1),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.06, 0.02),
        magAttached: false, // Mag dropped
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.0),
        weaponRotOffset: new THREE.Euler(0.22, 0.1, -0.15),
      },
      {
        time: 0.56, // Commit tick 54 / 96 = 0.5625
        leftHand: {
          pos: new THREE.Vector3(0.0, -0.08, 0.03),
          rot: new THREE.Euler(0.1, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true, // New mag locked in
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.015, 0.0),
        weaponRotOffset: new THREE.Euler(0.15, 0.05, -0.05),
      },
      {
        time: 0.75,
        leftHand: {
          pos: new THREE.Vector3(0.0, -0.065, 0.03),
          rot: leftSupportRest.rot,
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.005, 0.0),
        weaponRotOffset: new THREE.Euler(0.05, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftSupportRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [
      { timeFraction: 0.35, type: 'mag_drop' },
      { timeFraction: 0.56, type: 'mag_insert' },
    ],
  };

  // --- 6. EMPTY RELOAD CLIP ---
  // Duration: 2.1s. Commit at tick 66 (1.10s, t = 0.5238)
  const emptyDuration = PISTOL_DEF.reloadTimeEmpty;
  const reloadEmptyClip: KeyframeClip = {
    name: 'reloadEmpty',
    duration: emptyDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftSupportRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.035), // Slide locked back
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.30,
        leftHand: {
          pos: new THREE.Vector3(-0.06, -0.22, 0.04),
          rot: new THREE.Euler(0.2, 0.1, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.06, 0.02),
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0.035),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(0.25, 0.1, -0.15),
      },
      {
        time: 0.52, // Commit tick 66 / 126 = 0.5238
        leftHand: {
          pos: new THREE.Vector3(0.0, -0.08, 0.03),
          rot: new THREE.Euler(0.1, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.035),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(0.18, 0.05, -0.05),
      },
      {
        time: 0.70, // Thumb hits slide release
        leftHand: {
          pos: new THREE.Vector3(-0.01, 0.01, 0.0),
          rot: new THREE.Euler(0, 0.2, -0.1),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0), // Slide snaps forward!
        weaponPosOffset: new THREE.Vector3(0, 0.01, -0.01),
        weaponRotOffset: new THREE.Euler(-0.05, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftSupportRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [
      { timeFraction: 0.28, type: 'mag_drop' },
      { timeFraction: 0.52, type: 'mag_insert' },
      { timeFraction: 0.70, type: 'bolt_release' },
    ],
  };

  // --- 7. WALK CLIP ---
  const walkClip: KeyframeClip = {
    name: 'walk',
    duration: 0.6,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftSupportRest,
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
          pos: leftSupportRest.pos.clone().add(new THREE.Vector3(-0.002, -0.005, 0.002)),
          rot: leftSupportRest.rot,
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(-0.002, -0.005, 0.002)),
          rot: rightGripRest.rot,
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.002, -0.005, 0.002),
        weaponRotOffset: new THREE.Euler(-0.01, 0.012, -0.008),
      },
      {
        time: 1.0,
        leftHand: leftSupportRest,
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

  // --- 8. SPRINT CLIP (Compressed high-ready pistol carry) ---
  const sprintClip: KeyframeClip = {
    name: 'sprint',
    duration: 0.5,
    keyframes: [
      {
        time: 0.0,
        leftHand: {
          pos: leftSupportRest.pos.clone().add(new THREE.Vector3(-0.02, 0.03, 0.03)),
          rot: new THREE.Euler(0.2, 0.35, -0.15),
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0.01, 0.02, 0.02)),
          rot: new THREE.Euler(-0.2, 0.1, 0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.015, -0.06, 0.03),
        weaponRotOffset: new THREE.Euler(-0.25, 0.25, -0.15),
      },
      {
        time: 0.5,
        leftHand: {
          pos: leftSupportRest.pos.clone().add(new THREE.Vector3(-0.022, 0.025, 0.04)),
          rot: new THREE.Euler(0.24, 0.38, -0.12),
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0.012, 0.015, 0.03)),
          rot: new THREE.Euler(-0.18, 0.12, 0.12),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.02, -0.07, 0.04),
        weaponRotOffset: new THREE.Euler(-0.28, 0.28, -0.18),
      },
      {
        time: 1.0,
        leftHand: {
          pos: leftSupportRest.pos.clone().add(new THREE.Vector3(-0.02, 0.03, 0.03)),
          rot: new THREE.Euler(0.2, 0.35, -0.15),
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0.01, 0.02, 0.02)),
          rot: new THREE.Euler(-0.2, 0.1, 0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.015, -0.06, 0.03),
        weaponRotOffset: new THREE.Euler(-0.25, 0.25, -0.15),
      },
    ],
    events: [],
  };

  // --- 9. ADS CLIP ---
  const adsClip: KeyframeClip = {
    name: 'ads',
    duration: 1.0,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftSupportRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftSupportRest,
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

  // --- 10. HOLSTER CLIP ---
  const holsterClip: KeyframeClip = {
    name: 'holster',
    duration: PISTOL_DEF.swapTime / 2,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftSupportRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftSupportRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.02, -0.08, 0.02),
        weaponRotOffset: new THREE.Euler(0.2, -0.08, 0.08),
      },
    ],
    events: [],
  };

  return {
    weaponId: 'pistol',
    name: PISTOL_DEF.name,
    bodyMesh: model.body,
    magMesh: model.mag,
    boltMesh: model.bolt,
    muzzleOffset: model.muzzle,
    ejectionPortOffset: model.ejectionPort,
    magRestPos: model.magRestPos,
    magDropVelocity: new THREE.Vector3(-0.2, -1.8, 0.1),
    boltRestPos: model.boltRestPos,
    boltTravelVector: new THREE.Vector3(0, 0, 0.035),
    sockets: {
      gripR: rightGripRest.pos,
      gripL: leftSupportRest.pos,
      muzzle: model.muzzle,
      ejectPort: model.ejectionPort,
      magWell: model.magRestPos,
    },
    fingerGrips: {
      right: PISTOL_GRIP_RIGHT,
      left: PISTOL_GRIP_LEFT,
    },
    clips: {
      idle: idleClip,
      draw: drawClip,
      inspect: inspectClip,
      reloadTactical: reloadTacticalClip,
      reloadEmpty: reloadEmptyClip,
      fire: fireClip,
      walk: walkClip,
      sprint: sprintClip,
      ads: adsClip,
      holster: holsterClip,
    },
  };
}
