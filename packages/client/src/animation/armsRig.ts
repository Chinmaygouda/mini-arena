import * as THREE from 'three';
import { TwoBoneIKSolver } from './twoBoneIk';

export interface ArmBones {
  root: THREE.Group;
  upperArm: THREE.Mesh;
  forearm: THREE.Mesh;
  hand: THREE.Group;
  shoulderPos: THREE.Vector3;
  poleHint: THREE.Vector3;
  upperLength: number;
  foreLength: number;
}

/**
 * First-person rigged arms featuring realistic tactical sleeves and gloves.
 * Driven in real-time by the analytical TwoBoneIKSolver with zero heap allocation.
 */
export class FirstPersonArmsRig {
  public group: THREE.Group;
  public leftArm: ArmBones;
  public rightArm: ArmBones;

  private ikSolver: TwoBoneIKSolver;

  // Preallocated vector scratchpads for zero-allocation IK evaluation
  private leftElbowPos = new THREE.Vector3();
  private rightElbowPos = new THREE.Vector3();
  private scratchUp = new THREE.Vector3(0, 1, 0);

  public totalTriangles = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'FPArms_Rig';
    this.ikSolver = new TwoBoneIKSolver();

    // Arm bone lengths tuned for first-person viewmodel perspective
    const upperLen = 0.32;
    const foreLen = 0.30;

    // Tactical sleeve material (dark slate fabric)
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
      metalness: 0.1,
    });

    // Tactical combat glove material (reinforced polymer/leather)
    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.6,
      metalness: 0.2,
    });

    const palmMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.7,
      metalness: 0.3,
    });

    const buildArmMesh = (isLeft: boolean): ArmBones => {
      const armGroup = new THREE.Group();
      armGroup.name = isLeft ? 'Arm_Left' : 'Arm_Right';

      const sideSign = isLeft ? -1 : 1;
      const shoulderPos = new THREE.Vector3(sideSign * 0.20, -0.15, -0.05);
      const poleHint = new THREE.Vector3(sideSign * 0.42, -0.42, -0.18);

      // Upper arm
      const upperGeom = new THREE.CylinderGeometry(0.042, 0.038, upperLen, 8);
      // Center along Y-axis
      upperGeom.translate(0, -upperLen / 2, 0);
      const upperArm = new THREE.Mesh(upperGeom, sleeveMat);
      armGroup.add(upperArm);
      this.countMesh(upperArm);

      // Forearm
      const foreGeom = new THREE.CylinderGeometry(0.038, 0.032, foreLen, 8);
      foreGeom.translate(0, -foreLen / 2, 0);
      const forearm = new THREE.Mesh(foreGeom, sleeveMat);
      armGroup.add(forearm);
      this.countMesh(forearm);

      // Hand and fingers group
      const hand = new THREE.Group();
      hand.name = isLeft ? 'Hand_Left' : 'Hand_Right';

      // Palm
      const palmGeom = new THREE.BoxGeometry(0.065, 0.035, 0.08);
      const palm = new THREE.Mesh(palmGeom, gloveMat);
      palm.position.set(0, 0, -0.04);
      hand.add(palm);
      this.countMesh(palm);

      // Knuckle guard
      const knuckleGeom = new THREE.BoxGeometry(0.068, 0.02, 0.025);
      const knuckle = new THREE.Mesh(knuckleGeom, palmMat);
      knuckle.position.set(0, 0.012, -0.05);
      hand.add(knuckle);
      this.countMesh(knuckle);

      // Thumb
      const thumbGeom = new THREE.BoxGeometry(0.022, 0.022, 0.05);
      const thumb = new THREE.Mesh(thumbGeom, gloveMat);
      thumb.position.set(sideSign * -0.035, -0.01, -0.02);
      thumb.rotation.y = sideSign * 0.35;
      hand.add(thumb);
      this.countMesh(thumb);

      armGroup.add(hand);
      this.group.add(armGroup);

      return {
        root: armGroup,
        upperArm,
        forearm,
        hand,
        shoulderPos,
        poleHint,
        upperLength: upperLen,
        foreLength: foreLen,
      };
    };

    this.leftArm = buildArmMesh(true);
    this.rightArm = buildArmMesh(false);
  }

  private countMesh(mesh: THREE.Mesh): void {
    if (mesh.geometry.index) {
      this.totalTriangles += mesh.geometry.index.count / 3;
    } else if (mesh.geometry.attributes.position) {
      this.totalTriangles += mesh.geometry.attributes.position.count / 3;
    }
  }

  /**
   * Updates arm bones using two-bone IK to reach target hand positions.
   *
   * @param leftTarget Hand position and orientation for the left arm (supports weapon handguard or magazine)
   * @param rightTarget Hand position and orientation for the right arm (grips pistol grip and trigger)
   */
  public updateIK(
    leftTargetPos: THREE.Vector3,
    leftTargetRot: THREE.Euler,
    rightTargetPos: THREE.Vector3,
    rightTargetRot: THREE.Euler,
  ): void {
    // 1. Solve Left Arm IK
    this.ikSolver.solve(
      this.leftArm.shoulderPos,
      leftTargetPos,
      this.leftArm.poleHint,
      this.leftArm.upperLength,
      this.leftArm.foreLength,
      this.leftElbowPos,
    );

    this.positionBone(this.leftArm.upperArm, this.leftArm.shoulderPos, this.leftElbowPos, this.leftArm.upperLength);
    this.positionBone(this.leftArm.forearm, this.leftElbowPos, leftTargetPos, this.leftArm.foreLength);
    this.leftArm.hand.position.copy(leftTargetPos);
    this.leftArm.hand.rotation.copy(leftTargetRot);

    // 2. Solve Right Arm IK
    this.ikSolver.solve(
      this.rightArm.shoulderPos,
      rightTargetPos,
      this.rightArm.poleHint,
      this.rightArm.upperLength,
      this.rightArm.foreLength,
      this.rightElbowPos,
    );

    this.positionBone(this.rightArm.upperArm, this.rightArm.shoulderPos, this.rightElbowPos, this.rightArm.upperLength);
    this.positionBone(this.rightArm.forearm, this.rightElbowPos, rightTargetPos, this.rightArm.foreLength);
    this.rightArm.hand.position.copy(rightTargetPos);
    this.rightArm.hand.rotation.copy(rightTargetRot);
  }

  private positionBone(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, baseLen: number): void {
    mesh.position.copy(from);
    this.scratchUp.subVectors(to, from);
    const dist = this.scratchUp.length();
    if (dist > 0.0001) {
      this.scratchUp.multiplyScalar(1.0 / dist);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), this.scratchUp);
      mesh.scale.set(1, dist / baseLen, 1);
    }
  }
}
