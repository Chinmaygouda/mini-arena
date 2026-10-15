import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function testLeftRig() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));
  const scene = gltf.scene;

  scene.position.set(0, -1.743155, 0);
  scene.updateMatrixWorld(true);

  const upperL = scene.getObjectByName('upper_armL');
  const foreL = scene.getObjectByName('forearmL');
  const handL = scene.getObjectByName('handL');
  const shoulderL = scene.getObjectByName('shoulderL');

  // Let's import the TwoBoneIKSolver from packages/client/src/animation/twoBoneIk.ts or write the logic here
  const shoulderPos = new THREE.Vector3();
  upperL.getWorldPosition(shoulderPos);

  console.log('Left shoulder world pos:', shoulderPos.toArray().map(v=>v.toFixed(4)));

  // Typical AK foregrip target
  const targetPos = new THREE.Vector3(-0.02, -0.05, -0.45);
  const polePos = new THREE.Vector3(-0.35, -0.65, 0.05);

  const dir = new THREE.Vector3().subVectors(targetPos, shoulderPos);
  const dist = dir.length();
  dir.normalize();

  const len1 = 0.3222;
  const len2 = 0.2373;
  const cosAlpha = Math.max(-1, Math.min(1, (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist)));
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  const poleDir = new THREE.Vector3().subVectors(polePos, shoulderPos);
  const planeNormal = new THREE.Vector3().crossVectors(dir, poleDir).normalize();
  const bendDir = new THREE.Vector3().crossVectors(planeNormal, dir).normalize();

  const elbowPos = new THREE.Vector3()
    .copy(shoulderPos)
    .addScaledVector(dir, len1 * cosAlpha)
    .addScaledVector(bendDir, len1 * sinAlpha);

  console.log('Left elbow world pos:', elbowPos.toArray().map(v=>v.toFixed(4)));
  console.log('Left target world pos:', targetPos.toArray().map(v=>v.toFixed(4)));

  // Now test orientation:
  function orient(bone, startPos, endPos, bendPlaneNorm, parent, isLeft) {
    const yAxis = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const zAxis = bendPlaneNorm.clone().normalize();
    if (isLeft) zAxis.negate();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
    zAxis.crossVectors(xAxis, yAxis).normalize();

    const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    const qWorld = new THREE.Quaternion().setFromRotationMatrix(m);

    if (parent) {
      const qParentInv = new THREE.Quaternion();
      parent.getWorldQuaternion(qParentInv).invert();
      bone.quaternion.copy(qParentInv).multiply(qWorld);
    } else {
      bone.quaternion.copy(qWorld);
    }
    bone.updateMatrixWorld(true);
  }

  orient(upperL, shoulderPos, elbowPos, planeNormal, shoulderL, true);
  orient(foreL, elbowPos, targetPos, planeNormal, upperL, true);

  const solvedHandPos = new THREE.Vector3();
  handL.getWorldPosition(solvedHandPos);
  console.log('Solved left hand world pos:', solvedHandPos.toArray().map(v=>v.toFixed(4)));
  console.log('Left hand distance to target (m):', solvedHandPos.distanceTo(targetPos).toFixed(5));
}

testLeftRig().catch(console.error);
