import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SNIPER_DEF } from '@mini-arena/shared';
import { KeyframeClip, WeaponVisualDef } from '../animation/types';
import { SplitWeaponMesh } from './assaultRifle';
import { RealWeaponSliceResult, countObjectTriangles } from './realWeaponSlice';

/**
 * Parses a loaded Precision Sniper Rifle (sniper.glb) GLTF scene into an asset-swappable SplitWeaponMesh.
 * Separates `snipermagazine_low` cleanly from `awp` for discrete reload kinematics.
 * Adds dedicated bolt handle with knob for discrete 80-tick bolt cycling kinematics.
 * Orients the barrel along -Z and centers the receiver at the weapon root.
 */
export function parseRealSniperModel(gltfScene: THREE.Group): SplitWeaponMesh {
  let awpMesh: THREE.Mesh | null = null;
  let magMesh: THREE.Mesh | null = null;

  gltfScene.traverse((child) => {
    if (child.name === 'awp' && (child as THREE.Mesh).isMesh) {
      awpMesh = child as THREE.Mesh;
    }
    if (child.name === 'snipermagazine_low' && (child as THREE.Mesh).isMesh) {
      magMesh = child as THREE.Mesh;
    }
  });

  const awp = awpMesh as THREE.Mesh | null;
  const mag = magMesh as THREE.Mesh | null;

  if (!awp || !mag) {
    throw new Error('parseRealSniperModel: Failed to find awp or snipermagazine_low nodes in GLTF scene.');
  }

  // Detach magazine from hierarchy
  if (mag.parent) {
    mag.parent.remove(mag);
  }
  const magBox = new THREE.Box3().setFromObject(mag);
  const magCenter = new THREE.Vector3();
  magBox.getCenter(magCenter);
  mag.geometry = mag.geometry.clone();
  mag.geometry.translate(-magCenter.x, -magCenter.y, -magCenter.z);

  // Receiver body group
  const body = new THREE.Group();
  body.name = 'Sniper_Real_Body';
  body.add(awp);

  // Dedicated bolt handle with knob for bolt cycling kinematics
  // 6 radial segments cylinder (24 tris) + 6x6 sphere knob (60 tris) = 84 tris
  const boltStemGeom = new THREE.CylinderGeometry(0.005, 0.005, 0.04, 6);
  boltStemGeom.rotateZ(Math.PI / 2);
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.3,
    metalness: 0.9,
  });
  const boltStem = new THREE.Mesh(boltStemGeom, boltMat);
  boltStem.name = 'Sniper_Real_Bolt';
  boltStem.position.set(0.02, 0, 0);

  const boltKnobGeom = new THREE.SphereGeometry(0.012, 6, 6);
  const boltKnob = new THREE.Mesh(boltKnobGeom, boltMat);
  boltKnob.name = 'Sniper_Real_Bolt_Knob';
  boltKnob.position.set(0.042, -0.008, 0);
  boltStem.add(boltKnob);

  // Rotate +90 deg around Y so barrel points down -Z
  body.rotation.y = Math.PI / 2;
  mag.rotation.y = Math.PI / 2;

  // Bolt rest position in rotated weapon frame
  const boltRestPos = new THREE.Vector3(0.028, 0.045, -0.01);
  boltStem.position.copy(boltRestPos);

  // Magazine rest position in rotated weapon frame
  // magCenter raw: [0.0209, -0.0042, 0] -> rotated: [0, -0.0042, -0.0209]
  const magRestPos = new THREE.Vector3(
    magCenter.z,
    magCenter.y,
    -magCenter.x,
  );
  mag.position.copy(magRestPos);

  // Sockets in weapon space
  // Barrel tip raw: x=0.7842, y=0.040, z=0 -> rotated: [0, 0.040, -0.785]
  const muzzlePos = new THREE.Vector3(0, 0.040, -0.785);
  const ejectPos = new THREE.Vector3(0.026, 0.045, 0.0);

  const root = new THREE.Group();
  root.name = 'Sniper_Root';
  root.add(body);
  root.add(mag);
  root.add(boltStem);

  const triangleCount = countObjectTriangles(root);

  return {
    root,
    body,
    mag,
    bolt: boltStem,
    muzzle: muzzlePos,
    ejectionPort: ejectPos,
    magRestPos,
    boltRestPos,
    triangleCount,
  };
}

/**
 * Builds the complete procedural + keyframed WeaponVisualDef for the real Precision Sniper Rifle.
 */
export function buildSniperVisualDef(model: SplitWeaponMesh): WeaponVisualDef {
  const rightGripRest = {
    pos: new THREE.Vector3(0, -0.045, 0.085),
    rot: new THREE.Euler(0.2, 0, 0),
  };
  const leftForendRest = {
    pos: new THREE.Vector3(0, 0.015, -0.18),
    rot: new THREE.Euler(0.1, 0, 0),
  };

  // 1. IDLE CLIP (3.0s = 180 ticks @ 60 Hz)
  const idleClip: KeyframeClip = {
    name: 'idle',
    duration: 3.0,
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
        time: 1.5,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.001, 0),
        weaponRotOffset: new THREE.Euler(0.003, 0, 0),
      },
      {
        time: 3.0,
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

  // 2. DRAW CLIP (0.5s = 30 ticks @ 60 Hz)
  const drawClip: KeyframeClip = {
    name: 'draw',
    duration: 0.5,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, -0.22, 0.1),
        weaponRotOffset: new THREE.Euler(-0.4, 0.1, -0.1),
      },
      {
        time: 0.7,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.015, -0.01),
        weaponRotOffset: new THREE.Euler(0.03, -0.01, 0.01),
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

  // 3. INSPECT CLIP (2.5s = 150 ticks @ 60 Hz)
  const inspectClip: KeyframeClip = {
    name: 'inspect',
    duration: 2.5,
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
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.04, 0.03, 0.02),
        weaponRotOffset: new THREE.Euler(0.2, 0.45, -0.3),
      },
      {
        time: 0.70,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.03, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(-0.1, -0.35, 0.2),
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

  // 4. FIRE CLIP (0.15s = 9 ticks @ 60 Hz)
  const fireClip: KeyframeClip = {
    name: 'fire',
    duration: 0.15,
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
        time: 0.2,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.03, 0.07),
        weaponRotOffset: new THREE.Euler(0.25, 0, 0.02),
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

  // 5. 80-TICK BOLT CYCLE CLIP (80 / 60 = 1.3333s authoritative in SNIPER_DEF)
  const boltCycleDuration = 80 / 60;
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
        time: 0.18, // Right hand reaches up to bolt handle
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.035, 0.025, 0.01),
          rot: new THREE.Euler(-0.1, 0.15, -0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.005, 0.0),
        weaponRotOffset: new THREE.Euler(0.04, 0.04, -0.03),
      },
      {
        time: 0.35, // Lifts bolt handle upward
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.035, 0.05, 0.01),
          rot: new THREE.Euler(0.1, 0.15, -0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0.01, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.01, 0.0),
        weaponRotOffset: new THREE.Euler(0.05, 0.05, -0.04),
      },
      {
        time: 0.55, // Pulls bolt back -> spent shell casing ejects
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.035, 0.05, 0.08),
          rot: new THREE.Euler(0.1, 0.15, -0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0.01, 0.07),
        weaponPosOffset: new THREE.Vector3(-0.015, 0.01, 0.01),
        weaponRotOffset: new THREE.Euler(0.07, 0.06, -0.05),
      },
      {
        time: 0.75, // Pushes bolt forward -> chambers fresh round
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.035, 0.05, 0.01),
          rot: new THREE.Euler(0.1, 0.15, -0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0.01, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.005, 0.0),
        weaponRotOffset: new THREE.Euler(0.04, 0.04, -0.03),
      },
      {
        time: 0.88, // Rotates bolt handle down, locking receiver
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.035, 0.025, 0.01),
          rot: new THREE.Euler(-0.1, 0.15, -0.1),
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

  // 6. TACTICAL RELOAD CLIP (168 ticks = 2.8s @ 60 Hz, commit at tick 96 = 0.5714)
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
          pos: new THREE.Vector3(-0.05, -0.18, -0.05),
          rot: new THREE.Euler(0.2, 0.1, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.025, 0.0),
        weaponRotOffset: new THREE.Euler(0.18, 0.12, -0.08),
      },
      {
        time: 0.42, // Mag dropped
        leftHand: {
          pos: new THREE.Vector3(-0.02, -0.15, -0.05),
          rot: new THREE.Euler(0.2, 0.1, -0.1),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.08, 0.02),
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.0),
        weaponRotOffset: new THREE.Euler(0.2, 0.12, -0.08),
      },
      {
        time: 0.57, // Commit tick 96 / 168 = 0.5714 -> fresh mag seated
        leftHand: {
          pos: new THREE.Vector3(0.0, -0.06, -0.05),
          rot: new THREE.Euler(0.1, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(0.12, 0.04, -0.04),
      },
      {
        time: 0.80,
        leftHand: leftForendRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.005, 0.0),
        weaponRotOffset: new THREE.Euler(0.03, 0, 0),
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

  // 7. EMPTY RELOAD CLIP (210 ticks = 3.5s @ 60 Hz, commit at tick 114 = 0.5428)
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
          pos: new THREE.Vector3(-0.05, -0.18, -0.05),
          rot: new THREE.Euler(0.2, 0.1, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.08, 0.02),
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.025, 0.0),
        weaponRotOffset: new THREE.Euler(0.18, 0.12, -0.08),
      },
      {
        time: 0.54, // Commit tick 114 / 210 = 0.5428 -> fresh mag inserted
        leftHand: {
          pos: new THREE.Vector3(0.0, -0.06, -0.05),
          rot: new THREE.Euler(0.1, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.018, 0.0),
        weaponRotOffset: new THREE.Euler(0.14, 0.04, -0.04),
      },
      {
        time: 0.72, // Right hand cycles bolt to chamber first round
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.035, 0.045, 0.06),
          rot: new THREE.Euler(0.1, 0.15, -0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0.01, 0.06),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.012, 0.0),
        weaponRotOffset: new THREE.Euler(0.05, 0.05, -0.03),
      },
      {
        time: 0.88, // Bolt locked forward
        leftHand: leftForendRest,
        rightHand: {
          pos: new THREE.Vector3(0.035, 0.025, 0.01),
          rot: new THREE.Euler(-0.1, 0.15, -0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.004, 0.0),
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

/**
 * Asynchronously loads the real Sniper model slice (/models/sniper.glb).
 */
export async function loadRealSniperSlice(basePath = '/models'): Promise<RealWeaponSliceResult> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(`${basePath}/sniper.glb`);
  const splitModel = parseRealSniperModel(gltf.scene);
  const visualDef = buildSniperVisualDef(splitModel);

  const gunTriangles = countObjectTriangles(visualDef.bodyMesh) +
    (visualDef.magMesh ? countObjectTriangles(visualDef.magMesh) : 0) +
    (visualDef.boltMesh ? countObjectTriangles(visualDef.boltMesh) : 0);

  return {
    visualDef,
    rawGltfScene: gltf.scene,
    armsMesh: null,
    armsRigGroup: null,
    triangleCount: gunTriangles,
    gunTriangles,
    armsTriangles: 0,
    fileSizeBytes: 1462200,
  };
}
