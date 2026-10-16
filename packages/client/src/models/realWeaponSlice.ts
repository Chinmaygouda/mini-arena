import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSAULT_RIFLE_DEF } from '@mini-arena/shared';
import { KeyframeClip, WeaponVisualDef } from '../animation/types';
import { AK_GRIP_RIGHT, AK_GRIP_LEFT } from '../animation/fingerGripPoses';
import { SplitWeaponMesh } from './assaultRifle';

export interface RealWeaponSliceResult {
  visualDef: WeaponVisualDef;
  rawGltfScene: THREE.Group;
  armsMesh: THREE.SkinnedMesh | null;
  armsRigGroup: THREE.Group | null;
  triangleCount: number;
  gunTriangles: number;
  armsTriangles: number;
  fileSizeBytes: number;
}

/**
 * Counts total triangles in a Three.js hierarchy.
 */
export function countObjectTriangles(obj: THREE.Object3D): number {
  let count = 0;
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry.index) {
        count += mesh.geometry.index.count / 3;
      } else if (mesh.geometry.attributes.position) {
        count += mesh.geometry.attributes.position.count / 3;
      }
    }
  });
  return count;
}

/**
 * Parses a loaded AK-47 GLTF scene into an asset-swappable SplitWeaponMesh.
 * Separates `akmagazine_low` cleanly from `ak47` for discrete reload kinematics.
 * Orients the barrel along -Z and centers the receiver at the weapon root.
 */
export function parseRealAK47Model(gltfScene: THREE.Group): SplitWeaponMesh {
  let ak47Mesh: THREE.Mesh | null = null;
  let magMesh: THREE.Mesh | null = null;
  let derriereMesh: THREE.Mesh | null = null;
  let triggerMesh: THREE.Mesh | null = null;

  gltfScene.traverse((child) => {
    if (child.name === 'ak47' && (child as THREE.Mesh).isMesh) {
      ak47Mesh = child as THREE.Mesh;
    }
    if (child.name === 'akmagazine_low' && (child as THREE.Mesh).isMesh) {
      magMesh = child as THREE.Mesh;
    }
    if (child.name === 'akderriere_low' && (child as THREE.Mesh).isMesh) {
      derriereMesh = child as THREE.Mesh;
    }
    if (child.name === 'aktrigger_low' && (child as THREE.Mesh).isMesh) {
      triggerMesh = child as THREE.Mesh;
    }
  });

  const ak47 = ak47Mesh as THREE.Mesh | null;
  const mag = magMesh as THREE.Mesh | null;

  if (!ak47 || !mag) {
    throw new Error('parseRealAK47Model: Failed to find ak47 or akmagazine_low nodes in GLTF scene.');
  }

  // Detach magazine from ak47 hierarchy
  if (mag.parent) {
    mag.parent.remove(mag);
  }

  // Calculate magazine center & offset geometry so local origin is at center of magazine
  const magBox = new THREE.Box3().setFromObject(mag);
  const magCenter = new THREE.Vector3();
  magBox.getCenter(magCenter);

  mag.geometry = mag.geometry.clone();
  mag.geometry.translate(-magCenter.x, -magCenter.y, -magCenter.z);

  // Receiver body group
  const body = new THREE.Group();
  body.name = 'AK47_Real_Body';
  body.add(ak47);
  if (derriereMesh) body.add(derriereMesh);
  if (triggerMesh) body.add(triggerMesh);

  // AK-47 model has barrel along +X. Rotate +90 deg around Y so barrel points down -Z.
  body.rotation.y = Math.PI / 2;

  // Bolt / charging handle on right side of receiver
  const boltRestPos = new THREE.Vector3(0.018, 0.028, -0.05);
  const boltGeom = new THREE.BoxGeometry(0.012, 0.018, 0.04);
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x2d3748,
    roughness: 0.25,
    metalness: 0.95,
  });
  const bolt = new THREE.Mesh(boltGeom, boltMat);
  bolt.name = 'AK47_Real_Bolt';
  bolt.position.copy(boltRestPos);

  // Position magazine at its rest slot in receiver coordinates (rotated +90 deg around Y)
  const magRestPos = new THREE.Vector3(0, magCenter.y, -magCenter.x);
  mag.position.copy(magRestPos);
  mag.rotation.y = Math.PI / 2;
  mag.name = 'AK47_Real_Mag';

  const root = new THREE.Group();
  root.name = 'AK47_Real_Root';
  root.add(body);
  root.add(mag);
  root.add(bolt);

  const muzzle = new THREE.Vector3(0, 0.02, -0.48);
  const ejectionPort = new THREE.Vector3(0.025, 0.025, -0.05);
  const gunTriangles = countObjectTriangles(root);

  return {
    root,
    body,
    mag,
    bolt,
    muzzle,
    ejectionPort,
    magRestPos,
    boltRestPos,
    triangleCount: gunTriangles,
  };
}

/**
 * Creates the asset-swappable WeaponVisualDef for the real AK-47 model slice.
 * Authors keyframe clips with exact integer-tick timings matching ASSAULT_RIFLE_DEF.
 */
export function createRealAK47VisualDef(model: SplitWeaponMesh): WeaponVisualDef {
  const rightGripRest = {
    pos: new THREE.Vector3(0.0, -0.065, 0.045),
    rot: new THREE.Euler(1.2, 0.2, -0.4),
  };

  const leftHandguardRest = {
    pos: new THREE.Vector3(-0.042, -0.045, -0.22),
    rot: new THREE.Euler(0.2, 0.4, -0.3),
  };

  // 1. IDLE CLIP (3.0s = 180 ticks)
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

  // 2. DRAW / EQUIP CLIP (swapTime / 2 = 0.35s = 21 ticks)
  const drawDuration = ASSAULT_RIFLE_DEF.swapTime / 2;
  const drawClip: KeyframeClip = {
    name: 'draw',
    duration: drawDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.02, -0.10, 0.03),
        weaponRotOffset: new THREE.Euler(0.2, -0.08, 0.08),
      },
      {
        time: 0.6,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.02, -0.01),
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
    events: [{ timeFraction: 0.15, type: 'draw_equip' }],
  };

  // 3. INSPECT CLIP (2.4s = 144 ticks)
  const inspectClip: KeyframeClip = {
    name: 'inspect',
    duration: 2.4,
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
        time: 0.35,
        leftHand: {
          pos: new THREE.Vector3(-0.06, -0.04, -0.14),
          rot: new THREE.Euler(0.1, 0.5, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.05, 0.04, -0.04),
        weaponRotOffset: new THREE.Euler(-0.15, 0.55, -0.35),
      },
      {
        time: 0.7,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.04, -0.02, 0.02),
        weaponRotOffset: new THREE.Euler(0.2, -0.4, 0.25),
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
    events: [{ timeFraction: 0.3, type: 'inspect_tilt' }],
  };

  // 4. TACTICAL RELOAD (tacticalReloadTicks = 126 ticks = 2.1s)
  const tacticalDuration = ASSAULT_RIFLE_DEF.reloadTimeTactical;
  const reloadTacticalClip: KeyframeClip = {
    name: 'reloadTactical',
    duration: tacticalDuration,
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
          pos: new THREE.Vector3(-0.02, -0.10, -0.12),
          rot: new THREE.Euler(0.1, 0.2, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.04),
        weaponRotOffset: new THREE.Euler(0.15, 0.12, -0.18),
      },
      {
        time: 0.42,
        leftHand: {
          pos: new THREE.Vector3(-0.03, -0.22, -0.10),
          rot: new THREE.Euler(0.2, 0.1, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.06, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.04),
        weaponRotOffset: new THREE.Euler(0.16, 0.13, -0.18),
      },
      {
        time: 0.58, // Commit tick fraction (70/120 = 0.583)
        leftHand: {
          pos: new THREE.Vector3(-0.01, -0.20, -0.12),
          rot: new THREE.Euler(0.05, 0.05, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.08, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.02, 0.03),
        weaponRotOffset: new THREE.Euler(0.14, 0.1, -0.15),
      },
      {
        time: 0.72,
        leftHand: {
          pos: new THREE.Vector3(0, -0.09, -0.12),
          rot: new THREE.Euler(0, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.04, 0.02),
        weaponRotOffset: new THREE.Euler(0.12, 0.08, -0.12),
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
      { timeFraction: 0.58, type: 'mag_insert' },
    ],
  };

  // 5. EMPTY RELOAD (emptyReloadTicks = 156 ticks = 2.6s)
  const emptyDuration = ASSAULT_RIFLE_DEF.reloadTimeEmpty;
  const reloadEmptyClip: KeyframeClip = {
    name: 'reloadEmpty',
    duration: emptyDuration,
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
          pos: new THREE.Vector3(-0.02, -0.09, -0.12),
          rot: new THREE.Euler(0.1, 0.2, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.02, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.04),
        weaponRotOffset: new THREE.Euler(0.18, 0.12, -0.2),
      },
      {
        time: 0.35, // Mag drops free
        leftHand: {
          pos: new THREE.Vector3(-0.05, -0.28, -0.08),
          rot: new THREE.Euler(0.2, 0.1, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.25, 0.05),
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.03, 0.04, 0.04),
        weaponRotOffset: new THREE.Euler(0.2, 0.14, -0.22),
      },
      {
        time: 0.58, // Commit fraction (85/150 = 0.567)
        leftHand: {
          pos: new THREE.Vector3(0, -0.09, -0.12),
          rot: new THREE.Euler(0, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.05, 0.03),
        weaponRotOffset: new THREE.Euler(0.15, 0.1, -0.16),
      },
      {
        time: 0.75, // Charging handle pull
        leftHand: {
          pos: new THREE.Vector3(0.02, 0.03, -0.05),
          rot: new THREE.Euler(0.1, -0.2, 0.3),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.04),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.02, 0.03),
        weaponRotOffset: new THREE.Euler(0.08, -0.12, 0.08),
      },
      {
        time: 0.88, // Bolt release
        leftHand: {
          pos: new THREE.Vector3(-0.02, 0.0, -0.12),
          rot: new THREE.Euler(0.15, 0.1, -0.1),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.01, 0.01),
        weaponRotOffset: new THREE.Euler(0.02, -0.02, 0.02),
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
      { timeFraction: 0.28, type: 'mag_drop' },
      { timeFraction: 0.58, type: 'mag_insert' },
      { timeFraction: 0.75, type: 'bolt_pull' },
      { timeFraction: 0.88, type: 'bolt_release' },
    ],
  };

  // 6. FIRE RECOIL CLIP (600 RPM = 0.1s = 6 ticks)
  const fireClip: KeyframeClip = {
    name: 'fire',
    duration: 0.1,
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
        boltOffset: new THREE.Vector3(0, 0, 0.035),
        weaponPosOffset: new THREE.Vector3(0, 0.008, 0.038),
        weaponRotOffset: new THREE.Euler(0.048, 0.005, 0.005),
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

  // 7. WALK CLIP
  const walkClip: KeyframeClip = {
    name: 'walk',
    duration: 0.65,
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
          pos: leftHandguardRest.pos.clone().add(new THREE.Vector3(-0.003, -0.006, 0.002)),
          rot: leftHandguardRest.rot,
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(-0.003, -0.006, 0.002)),
          rot: rightGripRest.rot,
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.003, -0.006, 0.002),
        weaponRotOffset: new THREE.Euler(-0.012, 0.015, -0.01),
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

  // 8. SPRINT CLIP (High-ready tactical carry)
  const sprintClip: KeyframeClip = {
    name: 'sprint',
    duration: 0.55,
    keyframes: [
      {
        time: 0.0,
        leftHand: {
          pos: leftHandguardRest.pos.clone().add(new THREE.Vector3(-0.015, 0.035, 0.04)),
          rot: new THREE.Euler(0.25, 0.45, -0.2),
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0.01, 0.025, 0.03)),
          rot: new THREE.Euler(-0.25, 0.1, 0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.02, -0.07, 0.04),
        weaponRotOffset: new THREE.Euler(-0.3, 0.3, -0.18),
      },
      {
        time: 0.5,
        leftHand: {
          pos: leftHandguardRest.pos.clone().add(new THREE.Vector3(-0.018, 0.03, 0.05)),
          rot: new THREE.Euler(0.28, 0.48, -0.18),
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0.012, 0.02, 0.04)),
          rot: new THREE.Euler(-0.22, 0.12, 0.12),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.025, -0.08, 0.05),
        weaponRotOffset: new THREE.Euler(-0.34, 0.34, -0.2),
      },
      {
        time: 1.0,
        leftHand: {
          pos: leftHandguardRest.pos.clone().add(new THREE.Vector3(-0.015, 0.035, 0.04)),
          rot: new THREE.Euler(0.25, 0.45, -0.2),
        },
        rightHand: {
          pos: rightGripRest.pos.clone().add(new THREE.Vector3(0.01, 0.025, 0.03)),
          rot: new THREE.Euler(-0.25, 0.1, 0.1),
        },
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.02, -0.07, 0.04),
        weaponRotOffset: new THREE.Euler(-0.3, 0.3, -0.18),
      },
    ],
    events: [],
  };

  // 9. ADS CLIP
  const adsClip: KeyframeClip = {
    name: 'ads',
    duration: 1.0,
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

  // 10. HOLSTER CLIP
  const holsterClip: KeyframeClip = {
    name: 'holster',
    duration: ASSAULT_RIFLE_DEF.swapTime / 2,
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
        time: 1.0,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.02, -0.10, 0.03),
        weaponRotOffset: new THREE.Euler(0.2, -0.08, 0.08),
      },
    ],
    events: [],
  };

  return {
    weaponId: 'assault_rifle',
    name: 'AK-47 Assault Rifle',
    bodyMesh: model.body,
    magMesh: model.mag,
    boltMesh: model.bolt,
    muzzleOffset: model.muzzle,
    ejectionPortOffset: model.ejectionPort,
    magRestPos: model.magRestPos,
    magDropVelocity: new THREE.Vector3(0, -1.8, 0.2),
    boltRestPos: model.boltRestPos,
    boltTravelVector: new THREE.Vector3(0, 0, 1),
    sockets: {
      gripR: rightGripRest.pos,
      gripL: leftHandguardRest.pos,
      muzzle: model.muzzle,
      ejectPort: model.ejectionPort,
      magWell: model.magRestPos,
    },
    fingerGrips: {
      left: AK_GRIP_LEFT,
      right: AK_GRIP_RIGHT,
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

/**
 * Asynchronously loads the real AK-47 model slice (/models/ak47.glb) and PSX arms (/models/arms_rig.glb).
 * Returns the validated WeaponVisualDef and metrics.
 */
export async function loadRealAK47Slice(basePath = '/models'): Promise<RealWeaponSliceResult> {
  const loader = new GLTFLoader();

  const [ak47Gltf, armsGltf] = await Promise.all([
    new Promise<GLTF>((resolve, reject) => {
      loader.load(`${basePath}/ak47.glb`, resolve, undefined, reject);
    }),
    new Promise<GLTF | null>((resolve, reject) => {
      loader.load(`${basePath}/arms_rig.glb`, resolve, undefined, reject);
    }).catch((err) => {
      console.warn('Arms GLB load warning:', err);
      return null;
    }),
  ]);

  const splitModel = parseRealAK47Model(ak47Gltf.scene);
  const visualDef = createRealAK47VisualDef(splitModel);

  let armsMesh: THREE.SkinnedMesh | null = null;
  let armsRigGroup: THREE.Group | null = null;
  let armsTris = 0;

  if (armsGltf && armsGltf.scene) {
    const rig = armsGltf.scene as THREE.Group;
    armsRigGroup = rig;
    rig.name = 'Real_PSX_Arms_Rig';
    rig.traverse((child: THREE.Object3D) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        armsMesh = child as THREE.SkinnedMesh;
      }
    });
    if (armsMesh) {
      armsTris = countObjectTriangles(armsMesh);
    }
  }

  const gunTriangles = splitModel.triangleCount;
  const totalTriangles = gunTriangles + armsTris;
  const fileSizeBytes = 1769496 + (armsGltf ? 1099832 : 0);

  return {
    visualDef,
    rawGltfScene: ak47Gltf.scene,
    armsMesh,
    armsRigGroup,
    triangleCount: totalTriangles,
    gunTriangles,
    armsTriangles: armsTris,
    fileSizeBytes,
  };
}
