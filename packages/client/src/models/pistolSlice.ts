import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PISTOL_DEF } from '@mini-arena/shared';
import { KeyframeClip, WeaponVisualDef } from '../animation/types';
import { PISTOL_GRIP_RIGHT, PISTOL_GRIP_LEFT } from '../animation/fingerGripPoses';
import { SplitWeaponMesh } from './assaultRifle';
import { RealWeaponSliceResult, countObjectTriangles } from './realWeaponSlice';

/**
 * Parses a loaded Pistol (pew.glb) GLTF scene into an asset-swappable SplitWeaponMesh.
 * Separates `pewmagazine` cleanly from `pew` and `pewhaut` (slide) for discrete reload kinematics.
 * Orients the barrel along -Z and centers the receiver at the weapon root.
 */
export function parseRealPistolModel(gltfScene: THREE.Group): SplitWeaponMesh {
  let pewMesh: THREE.Mesh | null = null;
  let slideMesh: THREE.Mesh | null = null;
  let magMesh: THREE.Mesh | null = null;
  let triggerMesh: THREE.Mesh | null = null;

  gltfScene.traverse((child) => {
    if (child.name === 'pew' && (child as THREE.Mesh).isMesh) {
      pewMesh = child as THREE.Mesh;
    }
    if (child.name === 'pewhaut' && (child as THREE.Mesh).isMesh) {
      slideMesh = child as THREE.Mesh;
    }
    if (child.name === 'pewmagazine' && (child as THREE.Mesh).isMesh) {
      magMesh = child as THREE.Mesh;
    }
    if (child.name === 'pewtrigger' && (child as THREE.Mesh).isMesh) {
      triggerMesh = child as THREE.Mesh;
    }
  });

  const pew = pewMesh as THREE.Mesh | null;
  const slide = slideMesh as THREE.Mesh | null;
  const mag = magMesh as THREE.Mesh | null;

  if (!pew || !slide || !mag) {
    throw new Error('parseRealPistolModel: Failed to find pew, pewhaut, or pewmagazine nodes in GLTF scene.');
  }

  // Detach magazine from hierarchy
  if (mag.parent) {
    mag.parent.remove(mag);
  }

  // Calculate magazine center & offset geometry so local origin is at center of magazine
  const magBox = new THREE.Box3().setFromObject(mag);
  const magCenter = new THREE.Vector3();
  magBox.getCenter(magCenter);

  mag.geometry = mag.geometry.clone();
  mag.geometry.translate(-magCenter.x, -magCenter.y, -magCenter.z);

  // Detach slide from hierarchy so it can blow back along -Z during firing/bolt cycling
  if (slide.parent) {
    slide.parent.remove(slide);
  }
  const slideBox = new THREE.Box3().setFromObject(slide);
  const slideCenter = new THREE.Vector3();
  slideBox.getCenter(slideCenter);

  slide.geometry = slide.geometry.clone();
  slide.geometry.translate(-slideCenter.x, -slideCenter.y, -slideCenter.z);

  // Receiver body group
  const body = new THREE.Group();
  body.name = 'Pistol_Real_Body';
  body.add(pew);
  if (triggerMesh) body.add(triggerMesh);

  // Scale uniformly by 1.45 to match realistic pistol scale (19.8 cm long)
  const SCALE = 1.45;
  body.scale.set(SCALE, SCALE, SCALE);
  slide.scale.set(SCALE, SCALE, SCALE);
  mag.scale.set(SCALE, SCALE, SCALE);

  // Barrel points along +X in raw GLB. Rotate +90 deg around Y so barrel points down -Z.
  body.rotation.y = Math.PI / 2;
  slide.rotation.y = Math.PI / 2;
  mag.rotation.y = Math.PI / 2;

  // Slide rest position in rotated weapon frame
  // slideCenter raw: x=-0.0114, y=0.0357, z=0.0002
  // In rotated space (y=rotY(pi/2)): x_rot = z_raw, y_rot = y_raw, z_rot = -x_raw
  const slideRestPos = new THREE.Vector3(
    slideCenter.z * SCALE,
    slideCenter.y * SCALE,
    -slideCenter.x * SCALE,
  );
  slide.position.copy(slideRestPos);

  // Magazine rest position in rotated weapon frame
  const magRestPos = new THREE.Vector3(
    magCenter.z * SCALE,
    magCenter.y * SCALE,
    -magCenter.x * SCALE,
  );
  mag.position.copy(magRestPos);

  // Sockets in weapon space
  const muzzlePos = new THREE.Vector3(0, 0.036 * SCALE, -0.058 * SCALE);
  const ejectPos = new THREE.Vector3(0.012 * SCALE, 0.040 * SCALE, -0.015 * SCALE);

  const root = new THREE.Group();
  root.name = 'Pistol_Root';
  root.add(body);
  root.add(slide);
  root.add(mag);

  const triangleCount = countObjectTriangles(root);

  return {
    root,
    body,
    mag,
    bolt: slide, // Slide functions as the reciprocating bolt/slide for the pistol
    muzzle: muzzlePos,
    ejectionPort: ejectPos,
    magRestPos,
    boltRestPos: slideRestPos,
    triangleCount,
  };
}

/**
 * Builds the complete procedural + keyframed WeaponVisualDef for the real Pistol.
 */
export function buildPistolVisualDef(model: SplitWeaponMesh): WeaponVisualDef {
  // Grip sockets calibrated to natural two-handed thumbs-forward pistol grip
  const rightGripRest = {
    pos: new THREE.Vector3(0.012, -0.040, 0.082),
    rot: new THREE.Euler(-1.74, 0.08, -0.12, 'YXZ'),
  };
  const leftGripRest = {
    pos: new THREE.Vector3(-0.014, -0.044, 0.076),
    rot: new THREE.Euler(-1.68, -0.10, 0.12, 'YXZ'),
  };

  // 1. IDLE CLIP
  const idleClip: KeyframeClip = {
    name: 'idle',
    duration: 3.0,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 1.5,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.0015, 0),
        weaponRotOffset: new THREE.Euler(0.006, 0, 0),
      },
      {
        time: 3.0,
        leftHand: leftGripRest,
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

  // 2. DRAW CLIP (0.3s)
  const drawClip: KeyframeClip = {
    name: 'draw',
    duration: 0.3,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, -0.12, 0.05),
        weaponRotOffset: new THREE.Euler(-0.4, 0.1, -0.1),
      },
      {
        time: 0.7,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.01, -0.01),
        weaponRotOffset: new THREE.Euler(0.03, -0.01, 0.01),
      },
      {
        time: 1.0,
        leftHand: leftGripRest,
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

  // 3. INSPECT CLIP (2.0s)
  const inspectClip: KeyframeClip = {
    name: 'inspect',
    duration: 2.0,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.35,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.04, 0.02, 0),
        weaponRotOffset: new THREE.Euler(0.1, -0.4, 0.35),
      },
      {
        time: 0.7,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.03, -0.01, 0),
        weaponRotOffset: new THREE.Euler(-0.05, 0.35, -0.25),
      },
      {
        time: 1.0,
        leftHand: leftGripRest,
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

  // 4. TACTICAL RELOAD (1.6s = 96 ticks, commit at tick 54 = 56.25%)
  const tacDuration = PISTOL_DEF.reloadTimeTactical;
  const reloadTacticalClip: KeyframeClip = {
    name: 'reloadTactical',
    duration: tacDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftGripRest,
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
          pos: new THREE.Vector3(-0.04, -0.16, 0.04),
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
        time: 0.35,
        leftHand: {
          pos: new THREE.Vector3(-0.02, -0.15, 0.03),
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
          pos: new THREE.Vector3(0.0, -0.065, 0.03),
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
          pos: new THREE.Vector3(-0.01, -0.05, 0.03),
          rot: leftGripRest.rot,
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
        leftHand: leftGripRest,
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

  // 5. EMPTY RELOAD (2.1s = 126 ticks, commit at tick 66 = 52.38%, slide release at 78%)
  const emptyDuration = PISTOL_DEF.reloadTimeEmpty;
  const reloadEmptyClip: KeyframeClip = {
    name: 'reloadEmpty',
    duration: emptyDuration,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.035), // Slide locked back
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.25,
        leftHand: {
          pos: new THREE.Vector3(-0.04, -0.16, 0.04),
          rot: new THREE.Euler(0.2, 0.1, -0.2),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.035),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(0.2, 0.1, -0.15),
      },
      {
        time: 0.30,
        leftHand: {
          pos: new THREE.Vector3(-0.02, -0.16, 0.03),
          rot: new THREE.Euler(0.3, 0.1, -0.1),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.08, 0.02),
        magAttached: false, // Mag dropped
        boltOffset: new THREE.Vector3(0, 0, 0.035),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.0),
        weaponRotOffset: new THREE.Euler(0.25, 0.1, -0.15),
      },
      {
        time: 0.52, // Commit tick 66 / 126 = 0.5238
        leftHand: {
          pos: new THREE.Vector3(0.0, -0.065, 0.03),
          rot: new THREE.Euler(0.1, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true, // Fresh mag seated
        boltOffset: new THREE.Vector3(0, 0, 0.035),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.02, 0.0),
        weaponRotOffset: new THREE.Euler(0.15, 0.05, -0.05),
      },
      {
        time: 0.78, // Slide release tick
        leftHand: {
          pos: new THREE.Vector3(-0.015, 0.03, 0.02),
          rot: new THREE.Euler(0.1, 0, 0),
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.0), // Slide snaps forward!
        weaponPosOffset: new THREE.Vector3(0, 0.01, 0.01),
        weaponRotOffset: new THREE.Euler(0.05, -0.02, 0.02),
      },
      {
        time: 0.90,
        leftHand: {
          pos: new THREE.Vector3(-0.01, -0.05, 0.03),
          rot: leftGripRest.rot,
        },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.005, 0.0),
        weaponRotOffset: new THREE.Euler(0.02, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
    ],
    events: [
      { timeFraction: 0.30, type: 'mag_drop' },
      { timeFraction: 0.52, type: 'mag_insert' },
      { timeFraction: 0.78, type: 'bolt_release' },
    ],
  };

  // 6. FIRE RECOIL CLIP (400 RPM = 0.15s = 9 ticks)
  const fireClip: KeyframeClip = {
    name: 'fire',
    duration: 0.15,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 0.22,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.025), // Slide blowback!
        weaponPosOffset: new THREE.Vector3(0, 0.01, 0.025),
        weaponRotOffset: new THREE.Euler(0.065, 0.005, 0.005),
      },
      {
        time: 1.0,
        leftHand: leftGripRest,
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
    duration: 0.6,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftGripRest,
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
          pos: leftGripRest.pos.clone().add(new THREE.Vector3(-0.002, -0.005, 0.002)),
          rot: leftGripRest.rot,
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
        leftHand: leftGripRest,
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

  // 8. SPRINT CLIP
  const sprintClip: KeyframeClip = {
    name: 'sprint',
    duration: 0.5,
    keyframes: [
      {
        time: 0.0,
        leftHand: {
          pos: leftGripRest.pos.clone().add(new THREE.Vector3(-0.02, 0.03, 0.03)),
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
          pos: leftGripRest.pos.clone().add(new THREE.Vector3(-0.022, 0.025, 0.04)),
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
          pos: leftGripRest.pos.clone().add(new THREE.Vector3(-0.02, 0.03, 0.03)),
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

  // 9. ADS CLIP
  const adsClip: KeyframeClip = {
    name: 'ads',
    duration: 1.0,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftGripRest,
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
    duration: 0.15,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
      },
      {
        time: 1.0,
        leftHand: leftGripRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, -0.12, 0.05),
        weaponRotOffset: new THREE.Euler(-0.4, 0.1, -0.1),
      },
    ],
    events: [],
  };

  return {
    weaponId: 'pistol',
    name: 'Tactical Pistol',
    bodyMesh: model.body,
    magMesh: model.mag,
    boltMesh: model.bolt,
    muzzleOffset: model.muzzle,
    ejectionPortOffset: model.ejectionPort,
    magRestPos: model.magRestPos,
    magDropVelocity: new THREE.Vector3(0, -1.8, 0.15),
    boltRestPos: model.boltRestPos,
    boltTravelVector: new THREE.Vector3(0, 0, 1),
    sockets: {
      gripR: rightGripRest.pos,
      gripL: leftGripRest.pos,
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

/**
 * Asynchronously loads the real Pistol model slice (/models/pistol.glb).
 */
export async function loadRealPistolSlice(basePath = '/models'): Promise<RealWeaponSliceResult> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(`${basePath}/pistol.glb`);
  const splitModel = parseRealPistolModel(gltf.scene);
  const visualDef = buildPistolVisualDef(splitModel);

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
    fileSizeBytes: 1738440,
  };
}
