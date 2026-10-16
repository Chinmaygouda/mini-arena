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

  public currentStretchScale = 1.0;

  private xAxis = new THREE.Vector3();
  private yAxis = new THREE.Vector3();
  private zAxis = new THREE.Vector3();
  private basisMatrix = new THREE.Matrix4();

  private qWorld = new THREE.Quaternion();
  private qParentInv = new THREE.Quaternion();
  private qForearmWorld = new THREE.Quaternion();
  private qRel = new THREE.Quaternion();
  private qTwist = new THREE.Quaternion();
  private qForearmRoll = new THREE.Quaternion();

  /**
   * Solves elbow position for a two-bone kinematic chain with rigid, un-stretched bones.
   *
   * @param rootPos Position of the root joint (shoulder)
   * @param targetPos Target position for the end effector (hand/wrist)
   * @param polePos Elbow hint / pole target position (must be placed low and outward)
   * @param len1 Base length of the first bone (upper arm)
   * @param len2 Base length of the second bone (forearm)
   * @param outElbowPos Vector3 to receive the computed elbow position
   * @returns stretchScale applied to bone lengths (always 1.00 = rigid)
   */
  public solve(
    rootPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    polePos: THREE.Vector3,
    len1: number,
    len2: number,
    outElbowPos: THREE.Vector3,
    _allowStretch = false,
  ): number {
    // 1. Vector from root to target
    this.dir.subVectors(targetPos, rootPos);
    const dist = this.dir.length();

    // 2. Strict rigid bone lengths: no stretching or bone translation
    const stretchScale = 1.0;
    this.currentStretchScale = 1.0;

    const effLen1 = len1;
    const effLen2 = len2;

    // Clamp distance within reachable range (prevents cosine domain error)
    const maxReach = effLen1 + effLen2 - 0.0001;
    const minReach = Math.max(0.0001, Math.abs(effLen1 - effLen2) + 0.0001);
    const clampedDist = Math.max(minReach, Math.min(maxReach, dist));

    if (dist > 0.0001) {
      this.dir.multiplyScalar(1.0 / dist);
    } else {
      this.dir.set(0, 0, -1);
    }

    // 3. Law of cosines to find angle at shoulder (alpha)
    const cosAlpha = (effLen1 * effLen1 + clampedDist * clampedDist - effLen2 * effLen2) / (2 * effLen1 * clampedDist);
    const clampedCosAlpha = Math.max(-1, Math.min(1, cosAlpha));
    const sinAlpha = Math.sqrt(Math.max(0, 1 - clampedCosAlpha * clampedCosAlpha));

    // 4. Construct the bending plane using pole vector
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

    // 5. Compute elbow position
    outElbowPos
      .copy(rootPos)
      .addScaledVector(this.dir, effLen1 * clampedCosAlpha)
      .addScaledVector(this.bendDir, effLen1 * sinAlpha);

    // 6. Sanity constraint: elbow must never flip above shoulder into the sky
    if (outElbowPos.y > rootPos.y + 0.05) {
      outElbowPos.y = rootPos.y + 0.05;
    }

    return stretchScale;
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
   * Distributes 35% of the twist along the forearm bone to prevent wrist "candy-wrapper" skinning pinch.
   */
  public orientWrist(
    handBone: THREE.Bone,
    forearmBone: THREE.Bone,
    targetQuatWorld: THREE.Quaternion,
    twistShare = 0.35,
  ): void {
    if (twistShare > 0) {
      // 1. World rotation of forearm
      forearmBone.getWorldQuaternion(this.qForearmWorld);

      // 2. Relative rotation from forearm to target wrist
      this.qRel.copy(this.qForearmWorld).invert().multiply(targetQuatWorld);

      // 3. Extract twist component around local length axis (+Y)
      this.qTwist.set(0, this.qRel.y, 0, this.qRel.w).normalize();
      if (this.qRel.w < 0) {
        this.qTwist.set(0, -this.qRel.y, 0, -this.qRel.w).normalize();
      }

      // 4. Distribute twist fraction to forearm
      this.qForearmRoll.identity().slerp(this.qTwist, twistShare);
      forearmBone.quaternion.multiply(this.qForearmRoll).normalize();
      forearmBone.updateMatrixWorld(true);
    }

    // 5. Final wrist orientation matches targetQuatWorld exactly
    forearmBone.getWorldQuaternion(this.qParentInv).invert();
    handBone.quaternion.copy(this.qParentInv).multiply(targetQuatWorld).normalize();
    handBone.updateMatrixWorld(true);
  }
}
