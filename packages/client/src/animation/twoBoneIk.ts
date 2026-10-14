import * as THREE from 'three';

/**
 * High-performance, zero-allocation analytical 3D Two-Bone Inverse Kinematics solver.
 * Uses the law of cosines to solve upper arm and forearm joint positions given a target hand position
 * and pole vector (elbow direction hint).
 */
export class TwoBoneIKSolver {
  // Preallocated scratch vectors to prevent heap allocations in the 60 FPS hot path
  private dir = new THREE.Vector3();
  private poleDir = new THREE.Vector3();
  private planeNormal = new THREE.Vector3();
  private bendDir = new THREE.Vector3();
  private upperArmVec = new THREE.Vector3();
  private forearmVec = new THREE.Vector3();

  /**
   * Solves elbow position for a two-bone kinematic chain.
   *
   * @param rootPos Position of the root joint (shoulder)
   * @param targetPos Target position for the end effector (hand/wrist)
   * @param polePos Elbow hint / pole target position
   * @param len1 Length of the first bone (upper arm)
   * @param len2 Length of the second bone (forearm)
   * @param outElbowPos Vector3 to receive the computed elbow position
   */
  public solve(
    rootPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    polePos: THREE.Vector3,
    len1: number,
    len2: number,
    outElbowPos: THREE.Vector3,
  ): void {
    // 1. Vector from root to target
    this.dir.subVectors(targetPos, rootPos);
    const dist = this.dir.length();

    // Clamp distance within reachable range
    const maxReach = len1 + len2 - 0.0001;
    const minReach = Math.max(0.001, Math.abs(len1 - len2) + 0.0001);
    const clampedDist = Math.max(minReach, Math.min(maxReach, dist));

    if (dist > 0.0001) {
      this.dir.multiplyScalar(1.0 / dist);
    } else {
      this.dir.set(0, 0, -1);
    }

    // 2. Law of cosines to find angle at shoulder (alpha)
    const cosAlpha = (len1 * len1 + clampedDist * clampedDist - len2 * len2) / (2 * len1 * clampedDist);
    const clampedCosAlpha = Math.max(-1, Math.min(1, cosAlpha));
    const alpha = Math.acos(clampedCosAlpha);
    const sinAlpha = Math.sin(alpha);

    // 3. Construct the bending plane using pole vector
    this.poleDir.subVectors(polePos, rootPos);
    this.planeNormal.crossVectors(this.dir, this.poleDir);

    if (this.planeNormal.lengthSq() < 0.0001) {
      // Degenerate collinear case: fallback to arbitrary perpendicular plane
      this.planeNormal.set(0, 1, 0).cross(this.dir);
      if (this.planeNormal.lengthSq() < 0.0001) {
        this.planeNormal.set(1, 0, 0).cross(this.dir);
      }
    }
    this.planeNormal.normalize();

    // Bend direction perpendicular to line of action within bend plane
    this.bendDir.crossVectors(this.planeNormal, this.dir).normalize();

    // 4. Compute elbow position
    outElbowPos
      .copy(rootPos)
      .addScaledVector(this.dir, len1 * clampedCosAlpha)
      .addScaledVector(this.bendDir, len1 * sinAlpha);
  }

  /**
   * Aligns a bone Mesh/Group between two points (from -> to) along its primary -Z or -Y axis.
   */
  public orientBone(bone: THREE.Object3D, fromPos: THREE.Vector3, toPos: THREE.Vector3, upHint: THREE.Vector3): void {
    bone.position.copy(fromPos);
    bone.lookAt(toPos);
    // Align up vector if specified
    if (upHint) {
      bone.up.copy(upHint);
    }
  }
}
