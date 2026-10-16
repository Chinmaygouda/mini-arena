import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KeyframeClip, WeaponVisualDef } from '../animation/types';
import { SHOTGUN_GRIP_RIGHT, SHOTGUN_GRIP_LEFT } from '../animation/fingerGripPoses';
import { SplitWeaponMesh } from './assaultRifle';
import { RealWeaponSliceResult, countObjectTriangles } from './realWeaponSlice';

/**
 * Parses a loaded Combat Shotgun (shotgun.glb) GLTF scene into an asset-swappable SplitWeaponMesh.
 * Separates `shotgunpomp` (pump slide) cleanly from `shotgun` for discrete pump-action kinematics.
 * Orients the barrel along -Z and centers the receiver at the weapon root.
 */
export function parseRealShotgunModel(gltfScene: THREE.Group): SplitWeaponMesh {
  let shotgunMesh: THREE.Mesh | null = null;
  let pumpMesh: THREE.Mesh | null = null;
  let triggerMesh: THREE.Mesh | null = null;

  gltfScene.traverse((child) => {
    if (child.name === 'shotgun' && (child as THREE.Mesh).isMesh) {
      shotgunMesh = child as THREE.Mesh;
    }
    if (child.name === 'shotgunpomp' && (child as THREE.Mesh).isMesh) {
      pumpMesh = child as THREE.Mesh;
    }
    if (child.name === 'shotguntrigger' && (child as THREE.Mesh).isMesh) {
      triggerMesh = child as THREE.Mesh;
    }
  });

  const shotgun = shotgunMesh as THREE.Mesh | null;
  const pump = pumpMesh as THREE.Mesh | null;

  if (!shotgun || !pump) {
    throw new Error('parseRealShotgunModel: Failed to find shotgun or shotgunpomp nodes in GLTF scene.');
  }

  // Detach pump slide from hierarchy so it can slide independently along the magazine tube
  if (pump.parent) {
    pump.parent.remove(pump);
  }
  const pumpBox = new THREE.Box3().setFromObject(pump);
  const pumpCenter = new THREE.Vector3();
  pumpBox.getCenter(pumpCenter);
  pump.geometry = pump.geometry.clone();
  pump.geometry.translate(-pumpCenter.x, -pumpCenter.y, -pumpCenter.z);

  // Receiver body group
  const body = new THREE.Group();
  body.name = 'Shotgun_Real_Body';
  body.add(shotgun);
  if (triggerMesh) body.add(triggerMesh);

  // Rotate +90 deg around Y so barrel points down -Z
  body.rotation.y = Math.PI / 2;
  pump.rotation.y = Math.PI / 2;

  // Pump rest position in rotated weapon frame
  // pumpCenter raw: x=0.1459, y=0.0327, z=0.0001
  // In rotated space: x_rot = z_raw, y_rot = y_raw, z_rot = -x_raw
  const pumpRestPos = new THREE.Vector3(
    pumpCenter.z,
    pumpCenter.y,
    -pumpCenter.x,
  );
  pump.position.copy(pumpRestPos);

  // Tube magazine is internal; placeholder shell mesh for drop/eject
  const shellGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.06, 8);
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626, // Red 12-gauge hull
    roughness: 0.35,
    metalness: 0.6,
  });
  const magShell = new THREE.Mesh(shellGeom, shellMat);
  magShell.name = 'Shotgun_Shell';
  magShell.rotation.x = Math.PI / 2;

  const magRestPos = new THREE.Vector3(0, -0.025, -0.02);
  magShell.position.copy(magRestPos);

  // Sockets in weapon space
  const muzzlePos = new THREE.Vector3(0, 0.035, -0.317);
  const ejectPos = new THREE.Vector3(0.014, 0.033, -0.04);

  const root = new THREE.Group();
  root.name = 'Shotgun_Root';
  root.add(body);
  root.add(pump);
  root.add(magShell);

  const triangleCount = countObjectTriangles(root);

  return {
    root,
    body,
    mag: magShell,
    bolt: pump, // Pump slide functions as the reciprocating action handle
    muzzle: muzzlePos,
    ejectionPort: ejectPos,
    magRestPos,
    boltRestPos: pumpRestPos,
    triangleCount,
  };
}

/**
 * Builds the complete procedural + keyframed WeaponVisualDef for the real Combat Shotgun.
 */
export function buildShotgunVisualDef(model: SplitWeaponMesh): WeaponVisualDef {
  const rightGripRest = {
    pos: new THREE.Vector3(0, -0.045, 0.08),
    rot: new THREE.Euler(1.2, 0.2, -0.4),
  };
  const leftPumpRest = {
    pos: new THREE.Vector3(-0.042, -0.048, -0.15),
    rot: new THREE.Euler(0.2, 0.35, -0.25),
  };

  // 1. IDLE CLIP
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
        time: 1.5,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.0015, 0),
        weaponRotOffset: new THREE.Euler(0.005, 0, 0),
      },
      {
        time: 3.0,
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

  // 2. DRAW CLIP (0.4s = 24 ticks)
  const drawClip: KeyframeClip = {
    name: 'draw',
    duration: 0.4,
    keyframes: [
      {
        time: 0.0,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, -0.18, 0.08),
        weaponRotOffset: new THREE.Euler(-0.4, 0.1, -0.1),
      },
      {
        time: 0.7,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.015, -0.01),
        weaponRotOffset: new THREE.Euler(0.03, -0.01, 0.01),
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

  // 3. INSPECT CLIP (2.0s)
  const inspectClip: KeyframeClip = {
    name: 'inspect',
    duration: 2.0,
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
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.05, 0.03, 0),
        weaponRotOffset: new THREE.Euler(0.12, -0.4, 0.3),
      },
      {
        time: 0.7,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0.04, -0.01, 0),
        weaponRotOffset: new THREE.Euler(-0.05, 0.35, -0.2),
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

  // 4. RELOAD SHELL START (0.40s = 24 ticks)
  const reloadShellStartClip: KeyframeClip = {
    name: 'reloadShellStart',
    duration: 0.4,
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
        time: 1.0,
        leftHand: { pos: new THREE.Vector3(-0.02, -0.06, -0.04), rot: new THREE.Euler(1.5, 0.0, -0.7) },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.04, 0.02),
        weaponRotOffset: new THREE.Euler(0.2, -0.15, 0.35), // Tilt up to expose loading port
      },
    ],
    events: [],
  };

  // 5. RELOAD SHELL INSERT (32/60s = 32 ticks, commit at 20 ticks = 62.5%)
  const reloadShellInsertClip: KeyframeClip = {
    name: 'reloadShellInsert',
    duration: 32 / 60, // Exactly 32 ticks at 60 Hz
    keyframes: [
      {
        time: 0.0,
        leftHand: { pos: new THREE.Vector3(-0.02, -0.09, -0.04), rot: new THREE.Euler(1.5, 0.0, -0.7) },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, -0.08, 0.04),
        magAttached: false,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.04, 0.02),
        weaponRotOffset: new THREE.Euler(0.2, -0.15, 0.35),
      },
      {
        time: 0.625, // Commit tick 20/32
        leftHand: { pos: new THREE.Vector3(-0.01, -0.025, -0.02), rot: new THREE.Euler(1.6, 0.1, -0.5) }, // Shell clicked into tube!
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.015, 0.045, 0.02),
        weaponRotOffset: new THREE.Euler(0.22, -0.12, 0.32),
      },
      {
        time: 1.0,
        leftHand: { pos: new THREE.Vector3(-0.02, -0.05, -0.03), rot: new THREE.Euler(1.5, 0.0, -0.7) },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.04, 0.02),
        weaponRotOffset: new THREE.Euler(0.2, -0.15, 0.35),
      },
    ],
    events: [
      { timeFraction: 0.625, type: 'mag_insert' },
    ],
  };

  // 6. RELOAD SHELL END (0.40s = 24 ticks, pump rack at 50%)
  const reloadShellEndClip: KeyframeClip = {
    name: 'reloadShellEnd',
    duration: 0.4,
    keyframes: [
      {
        time: 0.0,
        leftHand: { pos: new THREE.Vector3(-0.02, -0.05, -0.03), rot: new THREE.Euler(1.5, 0.0, -0.7) },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(-0.02, 0.04, 0.02),
        weaponRotOffset: new THREE.Euler(0.2, -0.15, 0.35),
      },
      {
        time: 0.4,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.06), // Pump racked back
        weaponPosOffset: new THREE.Vector3(0, 0.01, 0),
        weaponRotOffset: new THREE.Euler(0.04, 0, 0),
      },
      {
        time: 0.7,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.0), // Pump pushed forward into battery
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
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
      { timeFraction: 0.4, type: 'bolt_pull' },
      { timeFraction: 0.7, type: 'bolt_release' },
    ],
  };

  // 7. FIRE RECOIL CLIP (80 RPM = 0.75s = 45 ticks)
  const fireClip: KeyframeClip = {
    name: 'fire',
    duration: 0.75,
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
        time: 0.15,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, 0.03, 0.06), // Heavy shotgun muzzle kick
        weaponRotOffset: new THREE.Euler(0.12, 0.01, 0.01),
      },
      {
        time: 0.45,
        leftHand: { pos: new THREE.Vector3(0, 0.033, -0.086), rot: new THREE.Euler(0.1, 0, 0) },
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.06), // Pump racked back
        weaponPosOffset: new THREE.Vector3(0, 0.01, 0.02),
        weaponRotOffset: new THREE.Euler(0.04, 0, 0),
      },
      {
        time: 0.7,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0.0), // Pump pushed forward
        weaponPosOffset: new THREE.Vector3(0, 0, 0),
        weaponRotOffset: new THREE.Euler(0, 0, 0),
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
      { timeFraction: 0.0, type: 'fire_recoil' },
      { timeFraction: 0.45, type: 'bolt_pull' },
      { timeFraction: 0.7, type: 'bolt_release' },
    ],
  };

  // 8. WALK CLIP
  const walkClip: KeyframeClip = {
    name: 'walk',
    duration: 0.65,
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
          pos: leftPumpRest.pos.clone().add(new THREE.Vector3(-0.003, -0.006, 0.002)),
          rot: leftPumpRest.rot,
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

  // 9. SPRINT CLIP (High-ready Shotgun carry)
  const sprintClip: KeyframeClip = {
    name: 'sprint',
    duration: 0.55,
    keyframes: [
      {
        time: 0.0,
        leftHand: {
          pos: leftPumpRest.pos.clone().add(new THREE.Vector3(-0.015, 0.035, 0.04)),
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
          pos: leftPumpRest.pos.clone().add(new THREE.Vector3(-0.018, 0.03, 0.05)),
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
          pos: leftPumpRest.pos.clone().add(new THREE.Vector3(-0.015, 0.035, 0.04)),
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

  // 10. ADS CLIP
  const adsClip: KeyframeClip = {
    name: 'ads',
    duration: 1.0,
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

  // 11. HOLSTER CLIP
  const holsterClip: KeyframeClip = {
    name: 'holster',
    duration: 0.35,
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
        time: 1.0,
        leftHand: leftPumpRest,
        rightHand: rightGripRest,
        magOffset: new THREE.Vector3(0, 0, 0),
        magAttached: true,
        boltOffset: new THREE.Vector3(0, 0, 0),
        weaponPosOffset: new THREE.Vector3(0, -0.18, 0.08),
        weaponRotOffset: new THREE.Euler(-0.4, 0.1, -0.1),
      },
    ],
    events: [],
  };

  return {
    weaponId: 'shotgun',
    name: 'Combat Shotgun',
    bodyMesh: model.body,
    magMesh: model.mag,
    boltMesh: model.bolt, // Pump slide
    muzzleOffset: model.muzzle,
    ejectionPortOffset: model.ejectionPort,
    magRestPos: model.magRestPos,
    magDropVelocity: new THREE.Vector3(0, -1.8, 0.15),
    boltRestPos: model.boltRestPos,
    boltTravelVector: new THREE.Vector3(0, 0, 1),
    sockets: {
      gripR: rightGripRest.pos,
      gripL: leftPumpRest.pos,
      muzzle: model.muzzle,
      ejectPort: model.ejectionPort,
      magWell: model.magRestPos,
    },
    fingerGrips: {
      right: SHOTGUN_GRIP_RIGHT,
      left: SHOTGUN_GRIP_LEFT,
    },
    clips: {
      idle: idleClip,
      draw: drawClip,
      inspect: inspectClip,
      reloadTactical: reloadShellStartClip,
      reloadEmpty: reloadShellStartClip,
      reloadShellStart: reloadShellStartClip,
      reloadShellInsert: reloadShellInsertClip,
      reloadShellEnd: reloadShellEndClip,
      fire: fireClip,
      walk: walkClip,
      sprint: sprintClip,
      ads: adsClip,
      holster: holsterClip,
    },
  };
}

/**
 * Asynchronously loads the real Shotgun model slice (/models/shotgun.glb).
 */
export async function loadRealShotgunSlice(basePath = '/models'): Promise<RealWeaponSliceResult> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(`${basePath}/shotgun.glb`);
  const splitModel = parseRealShotgunModel(gltf.scene);
  const visualDef = buildShotgunVisualDef(splitModel);

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
    fileSizeBytes: 1155228,
  };
}
