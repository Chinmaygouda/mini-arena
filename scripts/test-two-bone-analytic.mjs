import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

/**
 * Analytical Two-Bone IK Solver with guaranteed pole orientation and zero roll twist ambiguity.
 */
class RobustTwoBoneIK {
  constructor() {
    this.dir = new THREE.Vector3();
    this.poleDir = new THREE.Vector3();
    this.planeNormal = new THREE.Vector3();
    this.bendDir = new THREE.Vector3();
    this.elbowPos = new THREE.Vector3();
    this.mat = new THREE.Matrix4();
    this.xAxis = new THREE.Vector3();
    this.yAxis = new THREE.Vector3();
    this.zAxis = new THREE.Vector3();
    this.quatUpper = new THREE.Quaternion();
    this.quatFore = new THREE.Quaternion();
    this.invParentQuat = new THREE.Quaternion();
  }

  solve(shoulderPos, targetPos, polePos, len1, len2) {
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

    this.elbowPos
      .copy(shoulderPos)
      .addScaledVector(this.dir, len1 * clampedCosAlpha)
      .addScaledVector(this.bendDir, len1 * sinAlpha);

    return {
      elbowPos: this.elbowPos,
      bendNormal: this.planeNormal,
      bendDir: this.bendDir,
    };
  }
}

async function testSolver() {
  console.log('Testing RobustTwoBoneIK...');
  const solver = new RobustTwoBoneIK();

  const shoulder = new THREE.Vector3(0.2, 1.6, -0.05);
  const target = new THREE.Vector3(0.1, 1.45, -0.35); // typical gun grip
  const pole = new THREE.Vector3(0.45, 1.1, -0.15); // low and outside

  const result = solver.solve(shoulder, target, pole, 0.3222, 0.2373);
  console.log('Computed Elbow Pos:', result.elbowPos.toArray().map(v => v.toFixed(4)));
  console.log('Elbow below shoulder?:', result.elbowPos.y < shoulder.y);
  console.log('Elbow below target?:', result.elbowPos.y < target.y + 0.1);
  console.log('Distance Shoulder->Elbow:', result.elbowPos.distanceTo(shoulder).toFixed(4), '(expected 0.3222)');
  console.log('Distance Elbow->Target:', result.elbowPos.distanceTo(target).toFixed(4), '(expected 0.2373)');
}

testSolver().catch(console.error);
