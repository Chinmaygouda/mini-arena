import * as THREE from 'three';
import { ASSAULT_RIFLE_DEF } from '@mini-arena/shared';
import { KeyframeClip, WeaponVisualDef } from './types';
import { buildAssaultRifleModel } from '../models/assaultRifle';

/**
 * Creates the asset-swappable WeaponVisualDef for the Assault Rifle.
 * Authors data-driven keyframes for idle, draw, inspect, tactical reload, empty reload, and fire.
 * Timing is scaled to match pure shared gameplay rules authoritative in ASSAULT_RIFLE_DEF.
 */
export function createAssaultRifleVisualDef(): WeaponVisualDef {
  const model = buildAssaultRifleModel();

  // Baseline hand rests relative to weapon root
  // Right hand grips pistol grip
  const rightGripRest = {
    pos: new THREE.Vector3(0.012, -0.065, 0.04),
    rot: new THREE.Euler(-0.35, 0, 0),
  };

  // Left hand supports handguard
  const leftHandguardRest = {
    pos: new THREE.Vector3(-0.03, -0.01, -0.16),
    rot: new THREE.Euler(0.2, 0.35, -0.45),
  };

  // --- 1. IDLE CLIP ---
  const idleClip: KeyframeClip = {
    name: 'idle',
    duration: 3.0,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftHandguardRest,
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
          pos: leftHandguardRest.pos.clone().add(new THREE.Vector3(0, 0.003, 0)),
          rot: leftHandguardRest.rot,
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0, 0.003, 0)),
          rot: rightGripRest.rot,
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.003, 0),
        weaponRotOffset: new THREE.Euler(0.004, 0, 0.002),
      },
      {
        time: 1.0,
        leftHand: leftHandguardRest,
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
  const drawDuration = ASSAULT_RIFLE_DEF.swapTime / 2; // e.g. 0.35s
  const drawClip: KeyframeClip = {
    name: 'draw',
    duration: drawDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: {
          pos: new THREE.Vector3(-0.15, -0.35, -0.1),
          rot: new THREE.Euler(0.4, 0.2, -0.2),
        },
        rightHand: {
          pos: new THREE.Vector3(0.12, -0.32, 0.08),
          rot: new THREE.Euler(-0.5, 0.1, 0.2),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.08, -0.25, 0.06),
        weaponRotOffset: new THREE.Euler(0.45, -0.25, 0.2),
      },
      {
        time: 0.6,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.015, -0.02),
        weaponRotOffset: new THREE.Euler(-0.05, 0.03, -0.02),
      },
      {
        time: 1.0,
        leftHand: leftHandguardRest,
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
    duration: 2.2,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftHandguardRest,
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
          pos: new THREE.Vector3(-0.06, -0.06, -0.18),
          rot: new THREE.Euler(0.3, 0.6, -0.7),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.04, 0.02, 0.02),
        weaponRotOffset: new THREE.Euler(0.2, 0.35, -0.65), // Tilt gun sideways to inspect ejection chamber
      },
      {
        time: 0.65,
        leftHand: {
          pos: new THREE.Vector3(0.04, 0.03, -0.08), // Left hand checks receiver
          rot: new THREE.Euler(0.1, 0.2, -0.3),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.03, -0.01, 0.01),
        weaponRotOffset: new THREE.Euler(0.1, -0.2, 0.3), // Tilt back right
      },
      {
        time: 1.0,
        leftHand: leftHandguardRest,
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

  // --- 4. TACTICAL RELOAD CLIP (Round in chamber: 2.1s) ---
  const reloadTacticalClip: KeyframeClip = {
    name: 'reloadTactical',
    duration: ASSAULT_RIFLE_DEF.reloadTimeTactical, // 2.1s
    keyframes: [
      {
        time: 0.0,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.2,
        leftHand: {
          pos: new THREE.Vector3(-0.02, -0.12, -0.08), // Reach to mag
          rot: new THREE.Euler(0.3, 0.2, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.02, 0.02, -0.02),
        weaponRotOffset: new THREE.Euler(-0.1, 0.05, 0.15),
      },
      {
        time: 0.42,
        leftHand: {
          pos: new THREE.Vector3(-0.02, -0.26, -0.08), // Pull mag down out of magwell
          rot: new THREE.Euler(0.4, 0.1, -0.15),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.16, 0.02), // Mag detached and moving with hand
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.02, 0.02, -0.02),
        weaponRotOffset: new THREE.Euler(-0.1, 0.05, 0.15),
      },
      {
        time: 0.65,
        leftHand: {
          pos: new THREE.Vector3(-0.05, -0.32, -0.12), // Retrieve fresh mag
          rot: new THREE.Euler(0.2, 0.1, -0.1),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.28, 0.04), // Empty mag dropping
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.01, 0.01, -0.01),
        weaponRotOffset: new THREE.Euler(-0.05, 0.03, 0.1),
      },
      {
        time: 0.82,
        leftHand: {
          pos: new THREE.Vector3(-0.01, -0.10, -0.08), // Slam fresh mag into well
          rot: new THREE.Euler(0.1, 0.1, -0.1),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0), // Reseated!
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.03, -0.01), // Slap impact
        weaponRotOffset: new THREE.Euler(-0.08, 0.02, 0.05),
      },
      {
        time: 1.0,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [
      { timeFraction: 0.35, type: 'mag_detach' },
      { timeFraction: 0.45, type: 'mag_drop' },
      { timeFraction: 0.82, type: 'mag_insert' },
    ],
  };

  // --- 5. EMPTY RELOAD CLIP (Mag empty + Bolt rack: 2.6s) ---
  const reloadEmptyClip: KeyframeClip = {
    name: 'reloadEmpty',
    duration: ASSAULT_RIFLE_DEF.reloadTimeEmpty, // 2.6s
    keyframes: [
      {
        time: 0.0,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.16,
        leftHand: {
          pos: new THREE.Vector3(-0.02, -0.12, -0.08),
          rot: new THREE.Euler(0.3, 0.2, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.02, 0.02, -0.02),
        weaponRotOffset: new THREE.Euler(-0.1, 0.05, 0.15),
      },
      {
        time: 0.35,
        leftHand: {
          pos: new THREE.Vector3(-0.02, -0.28, -0.08), // Mag dropped
          rot: new THREE.Euler(0.4, 0.1, -0.15),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.22, 0.03),
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.02, 0.02, -0.02),
        weaponRotOffset: new THREE.Euler(-0.1, 0.05, 0.15),
      },
      {
        time: 0.58,
        leftHand: {
          pos: new THREE.Vector3(-0.01, -0.10, -0.08), // Reseat new mag
          rot: new THREE.Euler(0.1, 0.1, -0.1),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.025, -0.01),
        weaponRotOffset: new THREE.Euler(-0.06, 0.02, 0.05),
      },
      {
        time: 0.72,
        leftHand: {
          pos: new THREE.Vector3(0.03, 0.035, -0.05), // Reach back to charging handle/bolt
          rot: new THREE.Euler(0.2, -0.2, 0.3),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, -0.01, 0.01),
        weaponRotOffset: new THREE.Euler(0.05, -0.08, 0.05),
      },
      {
        time: 0.82,
        leftHand: {
          pos: new THREE.Vector3(0.03, 0.035, 0.02), // Pull bolt back
          rot: new THREE.Euler(0.2, -0.2, 0.3),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.045), // Bolt fully retracted
        weaponPosOffset: new THREE.Vector3(-0.02, -0.02, 0.03),
        weaponRotOffset: new THREE.Euler(0.08, -0.12, 0.06),
      },
      {
        time: 0.88,
        leftHand: {
          pos: new THREE.Vector3(0.02, 0.03, -0.02), // Release bolt
          rot: new THREE.Euler(0.1, -0.1, 0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0), // Bolt snapped forward!
        weaponPosOffset: new THREE.Vector3(0, 0.01, -0.01),
        weaponRotOffset: new THREE.Euler(-0.04, 0.02, -0.02),
      },
      {
        time: 1.0,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [
      { timeFraction: 0.25, type: 'mag_detach' },
      { timeFraction: 0.35, type: 'mag_drop' },
      { timeFraction: 0.58, type: 'mag_insert' },
      { timeFraction: 0.82, type: 'bolt_pull' },
      { timeFraction: 0.88, type: 'bolt_release' },
    ],
  };

  // --- 6. FIRE / RECOIL CLIP ---
  const shotInterval = 60 / ASSAULT_RIFLE_DEF.rpm; // 0.1s
  const fireClip: KeyframeClip = {
    name: 'fire',
    duration: shotInterval,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.25,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.035), // Bolt kicks back
        weaponPosOffset: new THREE.Vector3(0, 0.008, 0.038), // Sharp kickback
        weaponRotOffset: new THREE.Euler(0.048, (Math.random() - 0.5) * 0.012, 0.005),
      },
      {
        time: 1.0,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [{ timeFraction: 0.0, type: 'fire_recoil' }],
  };

  return {
    weaponId: 'assault_rifle',
    name: 'Assault Rifle',
    bodyMesh: model.body,
    magMesh: model.mag,
    boltMesh: model.bolt,
    muzzleOffset: model.muzzle,
    ejectionPortOffset: model.ejectionPort,
    magRestPos: model.magRestPos,
    magDropVelocity: new THREE.Vector3(0, -1.8, 0.2),
    boltRestPos: model.boltRestPos,
    boltTravelVector: new THREE.Vector3(0, 0, 1),
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
