import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

/**
 * Solves IK for a skinned arm chain where bone axis points along local +Y.
 */
function solveSkinnedArm(
  solver,
  shoulderBone,
  upperArmBone,
  forearmBone,
  handBone,
  targetPos,
  targetRot,
  poleHint,
  upperLen,
  foreLen,
  isLeft = false
) {
  // 1. Get shoulder world position
  const shoulderWorld = new THREE.Vector3();
  upperArmBone.getWorldPosition(shoulderWorld);

  // 2. Solve elbow position
  const elbowWorld = new THREE.Vector3();
  solver.solve(shoulderWorld, targetPos, poleHint, upperLen, foreLen, elbowWorld);

  // 3. Orient upper arm: points from shoulder to elbow
  const upperDir = new THREE.Vector3().subVectors(elbowWorld, shoulderWorld).normalize();
  
  // Bone axis is +Y in local space
  // We want local +Y to align with upperDir in parent (shoulderBone) space
  const shoulderInvQuat = shoulderBone.getWorldQuaternion(new THREE.Quaternion()).invert();
  const upperDirLocal = upperDir.clone().applyQuaternion(shoulderInvQuat);

  // Default rest direction of upper_arm in parent space:
  // In rest pose, upper_arm points towards forearm
  const restUpperDir = forearmBone.position.clone().normalize();
  upperArmBone.quaternion.setFromUnitVectors(restUpperDir, upperDirLocal);

  // 4. Update world matrix of upper arm to calculate forearm world pos
  upperArmBone.updateMatrixWorld(true);
  const forearmWorld = new THREE.Vector3();
  forearmBone.getWorldPosition(forearmWorld);

  // 5. Orient forearm: points from elbow to targetPos
  const foreDir = new THREE.Vector3().subVectors(targetPos, forearmWorld).normalize();
  const upperInvQuat = upperArmBone.getWorldQuaternion(new THREE.Quaternion()).invert();
  const foreDirLocal = foreDir.clone().applyQuaternion(upperInvQuat);

  const restForeDir = handBone.position.clone().normalize();
  forearmBone.quaternion.setFromUnitVectors(restForeDir, foreDirLocal);

  // 6. Orient hand to targetRot
  forearmBone.updateMatrixWorld(true);
  const foreWorldQuatInv = forearmBone.getWorldQuaternion(new THREE.Quaternion()).invert();
  const targetQuat = new THREE.Quaternion().setFromEuler(targetRot);
  handBone.quaternion.copy(targetQuat).premultiply(foreWorldQuatInv);

  handBone.updateMatrixWorld(true);
  const finalHandPos = new THREE.Vector3();
  handBone.getWorldPosition(finalHandPos);

  return {
    shoulderWorld,
    elbowWorld,
    finalHandPos,
    distToTarget: finalHandPos.distanceTo(targetPos)
  };
}

async function testIK() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  const loader = new GLTFLoader();
  loader.parse(arrayBuffer, '', (gltf) => {
    const scene = gltf.scene;
    const solver = new TwoBoneIKSolver();

    const root = scene.getObjectByName('root');
    const camera = scene.getObjectByName('camera');
    
    // Position arms rig so camera bone is at origin (viewmodel space)
    scene.position.set(0, -1.743155, 0);
    scene.updateMatrixWorld(true);

    const shoulderR = scene.getObjectByName('shoulderR');
    const upperR = scene.getObjectByName('upper_armR');
    const foreR = scene.getObjectByName('forearmR');
    const handR = scene.getObjectByName('handR');

    const shoulderL = scene.getObjectByName('shoulderL');
    const upperL = scene.getObjectByName('upper_armL');
    const foreL = scene.getObjectByName('forearmL');
    const handL = scene.getObjectByName('handL');

    // Target sockets from AK-47 in viewmodel space (with hip offset [0.13, -0.16, -0.32]):
    // AK right grip rest pos: [0.012, -0.065, 0.04]
    // AK left handguard rest pos: [-0.03, -0.01, -0.16]
    const hipOffset = new THREE.Vector3(0.13, -0.16, -0.32);
    const targetRight = new THREE.Vector3(0.012, -0.065, 0.04).add(hipOffset);
    const targetLeft = new THREE.Vector3(-0.03, -0.01, -0.16).add(hipOffset);

    console.log('Target Right Hand:', targetRight.toArray().map(v=>v.toFixed(4)));
    console.log('Target Left Hand:', targetLeft.toArray().map(v=>v.toFixed(4)));

    const poleRight = new THREE.Vector3(0.35, -0.45, -0.2);
    const poleLeft = new THREE.Vector3(-0.35, -0.45, -0.2);

    const resR = solveSkinnedArm(
      solver, shoulderR, upperR, foreR, handR,
      targetRight, new THREE.Euler(-0.35, 0, 0),
      poleRight, 0.3222, 0.2373, false
    );
    console.log('Right Arm solved: distToTarget =', resR.distToTarget.toFixed(6));
    console.log('Final Hand R Pos:', resR.finalHandPos.toArray().map(v=>v.toFixed(4)));

    const resL = solveSkinnedArm(
      solver, shoulderL, upperL, foreL, handL,
      targetLeft, new THREE.Euler(0.2, 0.35, -0.45),
      poleLeft, 0.3222, 0.2373, true
    );
    console.log('Left Arm solved: distToTarget =', resL.distToTarget.toFixed(6));
    console.log('Final Hand L Pos:', resL.finalHandPos.toArray().map(v=>v.toFixed(4)));
  });
}

testIK().catch(console.error);
