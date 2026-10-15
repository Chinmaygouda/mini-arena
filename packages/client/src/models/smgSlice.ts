import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KeyframeClip, WeaponVisualDef } from '../animation/types';
import { SplitWeaponMesh } from './assaultRifle';
import { RealWeaponSliceResult, countObjectTriangles } from './realWeaponSlice';

/**
 * Parses a loaded SMG (mac10.glb) GLTF scene into an asset-swappable SplitWeaponMesh.
 * Separates `mac10magazine_low` cleanly from `mac10` and `mac10bt_low` (bolt) for discrete reload kinematics.
 * Orients the barrel along -Z and centers the receiver at the weapon root.
 */
export function parseRealSmgModel(gltfScene: THREE.Group): SplitWeaponMesh {
  let mac10Mesh: THREE.Mesh | null = null;
  let boltMesh: THREE.Mesh | null = null;
  let magMesh: THREE.Mesh | null = null;
  let stockMesh: THREE.Mesh | null = null;
  let sightMesh: THREE.Mesh | null = null;
  let triggerMesh: THREE.Mesh | null = null;

  gltfScene.traverse((child) => {
    if (child.name === 'mac10' && (child as THREE.Mesh).isMesh) {
      mac10Mesh = child as THREE.Mesh;
    }
    if (child.name === 'mac10bt_low' && (child as THREE.Mesh).isMesh) {
      boltMesh = child as THREE.Mesh;
    }
    if (child.name === 'mac10magazine_low' && (child as THREE.Mesh).isMesh) {
      magMesh = child as THREE.Mesh;
    }
    if (child.name === 'mac10derriere_low' && (child as THREE.Mesh).isMesh) {
      stockMesh = child as THREE.Mesh;
    }
    if (child.name === 'mac10rond_low' && (child as THREE.Mesh).isMesh) {
      sightMesh = child as THREE.Mesh;
    }
    if (child.name === 'mac10trigger_low' && (child as THREE.Mesh).isMesh) {
      triggerMesh = child as THREE.Mesh;
    }
  });

  const mac10 = mac10Mesh as THREE.Mesh | null;
  const bolt = boltMesh as THREE.Mesh | null;
  const mag = magMesh as THREE.Mesh | null;

  if (!mac10 || !bolt || !mag) {
    throw new Error('parseRealSmgModel: Failed to find mac10, mac10bt_low, or mac10magazine_low nodes in GLTF scene.');
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

  // Detach bolt from hierarchy
  if (bolt.parent) {
    bolt.parent.remove(bolt);
  }
  const boltBox = new THREE.Box3().setFromObject(bolt);
  const boltCenter = new THREE.Vector3();
  boltBox.getCenter(boltCenter);
  bolt.geometry = bolt.geometry.clone();
  bolt.geometry.translate(-boltCenter.x, -boltCenter.y, -boltCenter.z);

  // Receiver body group
  const body = new THREE.Group();
  body.name = 'SMG_Real_Body';
  body.add(mac10);
  if (stockMesh) body.add(stockMesh);
  if (sightMesh) body.add(sightMesh);
  if (triggerMesh) body.add(triggerMesh);

  // Scale uniformly by 1.15 to match 27 cm realistic length
  const SCALE = 1.15;
  body.scale.set(SCALE, SCALE, SCALE);
  bolt.scale.set(SCALE, SCALE, SCALE);
  mag.scale.set(SCALE, SCALE, SCALE);

  // Rotate +90 deg around Y so barrel points down -Z
  body.rotation.y = Math.PI / 2;
  bolt.rotation.y = Math.PI / 2;
  mag.rotation.y = Math.PI / 2;

  // Bolt rest position in rotated weapon frame
  const boltRestPos = new THREE.Vector3(
    boltCenter.z * SCALE,
    boltCenter.y * SCALE,
    -boltCenter.x * SCALE,
  );
  bolt.position.copy(boltRestPos);

  // Magazine rest position in rotated weapon frame
  const magRestPos = new THREE.Vector3(
    magCenter.z * SCALE,
    magCenter.y * SCALE,
    -magCenter.x * SCALE,
  );
  mag.position.copy(magRestPos);

  // Sockets in weapon space
  const muzzlePos = new THREE.Vector3(0, 0.015 * SCALE, -0.124 * SCALE);
  const ejectPos = new THREE.Vector3(0.015 * SCALE, 0.02 * SCALE, -0.05 * SCALE);

  const root = new THREE.Group();
  root.name = 'SMG_Root';
  root.add(body);
  root.add(bolt);
  root.add(mag);

  const triangleCount = countObjectTriangles(root);

  return {
    root,
    body,
    mag,
    bolt,
    muzzle: muzzlePos,
    ejectionPort: ejectPos,
    magRestPos,
    boltRestPos,
    triangleCount,
  };
}

/**
 * Builds the complete procedural + keyframed WeaponVisualDef for the real SMG.
 */
export function buildSmgVisualDef(model: SplitWeaponMesh): WeaponVisualDef {
  const rightGripRest = {
    pos: new THREE.Vector3(0, -0.065, 0.025),
    rot: new THREE.Euler(0.2, 0, 0),
  };
  const leftHandguardRest = {
    pos: new THREE.Vector3(-0.02, -0.01, -0.075),
    rot: new THREE.Euler(0.1, 0.2, -0.3),
  };

  // 1. IDLE CLIP
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
        time: 1.5,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.0012, 0),
        weaponRotOffset: new THREE.Euler(0.005, 0, 0),
      },
      {
        time: 3.0,
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

  // 2. DRAW CLIP (0.35s = 21 ticks)
  const drawClip: KeyframeClip = {
    name: 'draw',
    duration: 0.35,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, -0.15, 0.05),
        weaponRotOffset: new THREE.Euler(-0.45, 0.1, -0.1),
      },
      {
        time: 0.7,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.01, -0.01),
        weaponRotOffset: new THREE.Euler(0.03, -0.01, 0.01),
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

  // 3. INSPECT CLIP (2.0s)
  const inspectClip: KeyframeClip = {
    name: 'inspect',
    duration: 2.0,
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
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.04, 0.02, 0),
        weaponRotOffset: new THREE.Euler(0.12, -0.45, 0.35),
      },
      {
        time: 0.7,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.03, -0.01, 0),
        weaponRotOffset: new THREE.Euler(-0.05, 0.35, -0.25),
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

  // 4. TACTICAL RELOAD (1.8s = 108 ticks, commit at tick 60 = 55%)
  const reloadTacticalClip: KeyframeClip = {
    name: 'reloadTactical',
    duration: 1.8,
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
        time: 0.3,
        leftHand: { pos: new THREE.Vector3(0, -0.2, 0.02), rot: new THREE.Euler(0, 0, 0) },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.1, 0),
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.02),
        weaponRotOffset: new THREE.Euler(0.25, -0.15, 0.25),
      },
      {
        time: 0.55,
        leftHand: { pos: new THREE.Vector3(0, -0.06, 0.02), rot: new THREE.Euler(0, 0, 0) },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.04, 0.01),
        weaponRotOffset: new THREE.Euler(0.3, -0.1, 0.2),
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
      { timeFraction: 0.3, type: 'mag_drop' },
      { timeFraction: 0.55, type: 'mag_insert' },
    ],
  };

  // 5. EMPTY RELOAD (2.3s = 138 ticks, commit at tick 72 = 52%, bolt cocked at 72%)
  const reloadEmptyClip: KeyframeClip = {
    name: 'reloadEmpty',
    duration: 2.3,
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
        leftHand: { pos: new THREE.Vector3(0, -0.2, 0.02), rot: new THREE.Euler(0, 0, 0) },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.12, 0),
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.03, 0.02),
        weaponRotOffset: new THREE.Euler(0.25, -0.15, 0.3),
      },
      {
        time: 0.52,
        leftHand: { pos: new THREE.Vector3(0, -0.06, 0.02), rot: new THREE.Euler(0, 0, 0) },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.01, 0.04, 0.01),
        weaponRotOffset: new THREE.Euler(0.28, -0.1, 0.25),
      },
      {
        time: 0.72,
        leftHand: { pos: new THREE.Vector3(0.015, 0.02, -0.05), rot: new THREE.Euler(0.1, 0, 0) },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.03), // Bolt cocked!
        weaponPosOffset: new THREE.Vector3(0, 0.01, 0.01),
        weaponRotOffset: new THREE.Euler(0.05, -0.02, 0.02),
      },
      {
        time: 0.85,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.0), // Bolt returned into battery
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
    events: [
      { timeFraction: 0.25, type: 'mag_drop' },
      { timeFraction: 0.52, type: 'mag_insert' },
      { timeFraction: 0.72, type: 'bolt_pull' },
      { timeFraction: 0.85, type: 'bolt_release' },
    ],
  };

  // 6. FIRE RECOIL CLIP (800 RPM = 0.075s = 4.5 ticks)
  const fireClip: KeyframeClip = {
    name: 'fire',
    duration: 0.075,
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
        time: 0.3,
        leftHand: leftHandguardRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.025), // Bolt blows back!
        weaponPosOffset: new THREE.Vector3(0, 0.006, 0.02),
        weaponRotOffset: new THREE.Euler(0.045, 0.003, 0.003),
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
    weaponId: 'smg',
    name: 'Rapid SMG',
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
      gripL: leftHandguardRest.pos,
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

/**
 * Asynchronously loads the real SMG model slice (/models/smg.glb).
 */
export async function loadRealSmgSlice(basePath = '/models'): Promise<RealWeaponSliceResult> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(`${basePath}/smg.glb`);
  const splitModel = parseRealSmgModel(gltf.scene);
  const visualDef = buildSmgVisualDef(splitModel);

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
    fileSizeBytes: 1507340,
  };
}
