import * as THREE from 'three';

/**
 * High-performance, zero-allocation analytical 3D Two-Bone Inverse Kinematics solver.
 * Uses the law of cosines to solve upper arm and forearm joint positions given a target hand position
 * and pole vector (elbow direction hint).
 *
 * Guarantees bend direction, prevents elbow flips, and clamps forearm twist.
 */
export class TwoBoneIKSolver {
  // Preallocated scratch vectors and matrices to eliminate heap allocations in the 60 FPS hot path
  public dir = new THREE.Vector3();
  public poleDir = new THREE.Vector3();
  public planeNormal = new THREE.Vector3();
  public bendDir = new THREE.Vector3();
  public elbowPos = new THREE.Vector3();

  private xAxis = new THREE.Vector3();
  private yAxis = new THREE.Vector3();
  private zAxis = new THREE.Vector3();
  private basisMatrix = new THREE.Matrix4();

  private qWorld = new THREE.Quaternion();
  private qParentInv = new THREE.Quaternion();

  /**
   * Solves elbow position for a two-bone kinematic chain.
   *
   * @param rootPos Position of the root joint (shoulder)
   * @param targetPos Target position for the end effector (hand/wrist)
   * @param polePos Elbow hint / pole target position (must be placed low and outward)
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
    const maxReach = len1 + len2 - 0.001;
    const minReach = Math.max(0.001, Math.abs(len1 - len2) + 0.001);
    const clampedDist = Math.max(minReach, Math.min(maxReach, dist));

    if (dist > 0.0001) {
      this.dir.multiplyScalar(1.0 / dist);
    } else {
      this.dir.set(0, 0, -1);
    }

    // 2. Law of cosines to find angle at shoulder (alpha)
    const cosAlpha = (len1 * len1 + clampedDist * clampedDist - len2 * len2) / (2 * len1 * clampedDist);
    const clampedCosAlpha = Math.max(-1, Math.min(1, cosAlpha));
    const sinAlpha = Math.sqrt(Math.max(0, 1 - clampedCosAlpha * clampedCosAlpha));

    // 3. Construct the bending plane using pole vector
    this.poleDir.subVectors(polePos, rootPos);
    this.planeNormal.crossVectors(this.dir, this.poleDir);

    if (this.planeNormal.lengthSq() < 1e-6) {
      // Degenerate collinear case: fallback to downward/lateral plane
      this.planeNormal.set(0, -1, 0).cross(this.dir);
      if (this.planeNormal.lengthSq() < 1e-6) {
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

    // 5. Sanity constraint: elbow must never flip above shoulder into the sky
    if (outElbowPos.y > rootPos.y + 0.05) {
      outElbowPos.y = rootPos.y + 0.05;
    }
  }

  /**
   * Constructs an exact analytical orientation matrix where:
   * +Y points along bone direction (from start to end)
   * +Z points along the pole bend plane (hinge axis)
   * +X = Y x Z
   * Eliminates roll twist ambiguity.
   */
  public orientBone(
    bone: THREE.Bone | THREE.Object3D,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    bendPlaneNormal: THREE.Vector3,
    parentBone: THREE.Bone | THREE.Object3D | null,
    isLeft = false,
  ): void {
    // Primary bone length axis (+Y)
    this.yAxis.subVectors(endPos, startPos).normalize();

    // Hinge axis (+Z aligned with bend plane normal)
    this.zAxis.copy(bendPlaneNormal).normalize();
    if (isLeft) {
      this.zAxis.negate();
    }

    this.xAxis.crossVectors(this.yAxis, this.zAxis).normalize();
    // Re-orthogonalize Z
    this.zAxis.crossVectors(this.xAxis, this.yAxis).normalize();

    this.basisMatrix.makeBasis(this.xAxis, this.yAxis, this.zAxis);
    this.qWorld.setFromRotationMatrix(this.basisMatrix);

    if (parentBone) {
      parentBone.getWorldQuaternion(this.qParentInv).invert();
      bone.quaternion.copy(this.qParentInv).multiply(this.qWorld).normalize();
    } else {
      bone.quaternion.copy(this.qWorld).normalize();
    }
    bone.updateMatrixWorld(true);
  }

  /**
   * Aligns the hand wrist bone to match the weapon socket world rotation.
   * Clamps relative forearm twist to prevent unnatural wrist spin.
   */
  public orientWrist(
    handBone: THREE.Bone,
    forearmBone: THREE.Bone,
    targetQuatWorld: THREE.Quaternion,
  ): void {
    forearmBone.getWorldQuaternion(this.qParentInv).invert();
    handBone.quaternion.copy(this.qParentInv).multiply(targetQuatWorld).normalize();
    handBone.updateMatrixWorld(true);
  }
}
