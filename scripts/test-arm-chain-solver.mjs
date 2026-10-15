import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

/**
 * Clean Two-Bone Analytical IK Solver with explicit pole target constraint.
 */
export class TwoBoneAnalyticIK {
  constructor() {
    this.dir = new THREE.Vector3();
    this.poleDir = new THREE.Vector3();
    this.planeNormal = new THREE.Vector3();
    this.bendDir = new THREE.Vector3();
    this.elbowPos = new THREE.Vector3();

    this.upperDir = new THREE.Vector3();
    this.foreDir = new THREE.Vector3();

    this.mUpper = new THREE.Matrix4();
    this.mFore = new THREE.Matrix4();

    this.xAxis = new THREE.Vector3();
    this.yAxis = new THREE.Vector3();
    this.zAxis = new THREE.Vector3();

    this.qUpperWorld = new THREE.Quaternion();
    this.qForeWorld = new THREE.Quaternion();
    this.qParentWorldInv = new THREE.Quaternion();
  }

  solveElbowPosition(shoulderPos, targetPos, polePos, len1, len2, outElbowPos) {
    this.dir.subVectors(targetPos, shoulderPos);
    const dist = this.dir.length();
    const maxReach = len1 + len2 - 0.001;
    const minReach = Math.max(0.001, Math.abs(len1 - len2) + 0.001);
    const clampedDist = Math.max(minReach, Math.min(maxReach, dist));

    if (dist > 0.0001) {
      this.dir.multiplyScalar(1.0 / dist);
    } else {
      this.dir.set(0, 0, -1);
    }

    const cosAlpha = (len1 * len1 + clampedDist * clampedDist - len2 * len2) / (2 * len1 * clampedDist);
    const clampedCosAlpha = Math.max(-1, Math.min(1, cosAlpha));
    const sinAlpha = Math.sqrt(Math.max(0, 1 - clampedCosAlpha * clampedCosAlpha));

    this.poleDir.subVectors(polePos, shoulderPos);
    this.planeNormal.crossVectors(this.dir, this.poleDir);
    if (this.planeNormal.lengthSq() < 1e-6) {
      this.planeNormal.set(0, 1, 0).cross(this.dir);
      if (this.planeNormal.lengthSq() < 1e-6) {
        this.planeNormal.set(1, 0, 0).cross(this.dir);
      }
    }
    this.planeNormal.normalize();

    this.bendDir.crossVectors(this.planeNormal, this.dir).normalize();

    outElbowPos
      .copy(shoulderPos)
      .addScaledVector(this.dir, len1 * clampedCosAlpha)
      .addScaledVector(this.bendDir, len1 * sinAlpha);
  }

  /**
   * Constructs an orientation matrix where:
   * +Y points along bone direction (from start to end)
   * +Z points along the pole bend plane (hinge axis)
   * +X = Y x Z
   */
  orientBoneTo(bone, startPos, endPos, bendPlaneNormal, parentBone, isLeft = false) {
    this.yAxis.subVectors(endPos, startPos).normalize(); // Primary bone length axis

    // For Drillimpact rig: hinge axis is aligned with plane normal
    this.zAxis.copy(bendPlaneNormal).normalize();
    if (isLeft) {
      this.zAxis.negate();
    }

    this.xAxis.crossVectors(this.yAxis, this.zAxis).normalize();
    // Re-orthogonalize Z
    this.zAxis.crossVectors(this.xAxis, this.yAxis).normalize();

    this.mUpper.makeBasis(this.xAxis, this.yAxis, this.zAxis);
    this.qUpperWorld.setFromRotationMatrix(this.mUpper);

    if (parentBone) {
      parentBone.getWorldQuaternion(this.qParentWorldInv).invert();
      bone.quaternion.copy(this.qParentWorldInv).multiply(this.qUpperWorld);
    } else {
      bone.quaternion.copy(this.qUpperWorld);
    }
    bone.updateMatrixWorld(true);
  }
}

async function testRig() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));
  const scene = gltf.scene;

  scene.position.set(0, -1.743155, 0);
  scene.updateMatrixWorld(true);

  const upperR = scene.getObjectByName('upper_armR');
  const foreR = scene.getObjectByName('forearmR');
  const handR = scene.getObjectByName('handR');
  const shoulderR = scene.getObjectByName('shoulderR');

  const solver = new TwoBoneAnalyticIK();

  const shoulderPos = new THREE.Vector3();
  upperR.getWorldPosition(shoulderPos);

  const targetPos = new THREE.Vector3(0.08, -0.15, -0.32); // Typical AK grip position in viewmodel space
  const polePos = new THREE.Vector3(0.35, -0.65, 0.05); // low and outward

  const elbowPos = new THREE.Vector3();
  solver.solveElbowPosition(shoulderPos, targetPos, polePos, 0.3222, 0.2373, elbowPos);

  console.log('Shoulder world pos:', shoulderPos.toArray().map(v=>v.toFixed(4)));
  console.log('Elbow world pos:', elbowPos.toArray().map(v=>v.toFixed(4)));
  console.log('Target world pos:', targetPos.toArray().map(v=>v.toFixed(4)));

  solver.orientBoneTo(upperR, shoulderPos, elbowPos, solver.planeNormal, shoulderR, false);
  solver.orientBoneTo(foreR, elbowPos, targetPos, solver.planeNormal, upperR, false);

  const solvedHandPos = new THREE.Vector3();
  handR.getWorldPosition(solvedHandPos);

  console.log('Solved hand world pos:', solvedHandPos.toArray().map(v=>v.toFixed(4)));
  console.log('Hand distance to target (m):', solvedHandPos.distanceTo(targetPos).toFixed(5));
}

testRig().catch(console.error);
