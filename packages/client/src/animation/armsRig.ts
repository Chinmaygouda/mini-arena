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

export interface SkinnedArmsData {
  rigGroup: THREE.Group;
  skinnedMesh: THREE.SkinnedMesh;
  shoulderR: THREE.Bone;
  upperArmR: THREE.Bone;
  forearmR: THREE.Bone;
  handR: THREE.Bone;
  shoulderL: THREE.Bone;
  upperArmL: THREE.Bone;
  forearmL: THREE.Bone;
  handL: THREE.Bone;
  restUpperRDir: THREE.Vector3;
  restForeRDir: THREE.Vector3;
  restUpperLDir: THREE.Vector3;
  restForeLDir: THREE.Vector3;
}

/**
 * First-person rigged arms featuring realistic tactical sleeves and gloves.
 * Supports both procedural geometry and external GLB SkinnedMesh (Drillimpact CC0 rig).
 * Driven in real-time by the analytical TwoBoneIKSolver with zero heap allocation.
 */
export class FirstPersonArmsRig {
  public group: THREE.Group;
  public leftArm: ArmBones;
  public rightArm: ArmBones;

  private ikSolver: TwoBoneIKSolver;

  // Skinned GLB arms support (Option A-lite)
  private skinnedArms: SkinnedArmsData | null = null;

  // Preallocated vector & quaternion scratchpads for zero-allocation IK evaluation
  private leftElbowPos = new THREE.Vector3();
  private rightElbowPos = new THREE.Vector3();
  private scratchUp = new THREE.Vector3(0, 1, 0);
  private scratchVec1 = new THREE.Vector3();
  private scratchVec2 = new THREE.Vector3();
  private scratchVec3 = new THREE.Vector3();
  private scratchQuat1 = new THREE.Quaternion();
  private scratchQuat2 = new THREE.Quaternion();
  private scratchQuat3 = new THREE.Quaternion();

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
   * Binds an external GLTF SkinnedMesh dual-arm rig (Option A-lite Drillimpact arms).
   * Applies matte tactical PBR material (slate sleeves, dark combat gloves), hides procedural meshes,
   * and hooks bones up to analytical Two-Bone IK.
   */
  public setSkinnedArms(rigGroup: THREE.Group, skinnedMesh: THREE.SkinnedMesh): void {
    this.group.add(rigGroup);

    // Drillimpact rig has camera at Y = 1.743155 in rest pose.
    // Offset root by -1.743155 so the camera / eye socket sits at (0, 0, 0) in viewmodel space.
    rigGroup.position.set(0, -1.743155, 0);
    rigGroup.updateMatrixWorld(true);

    // Option A-lite material swap: sleek tactical matte PBR palette matching Styloo weapons
    const aLiteMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155, // Tactical slate gray
      roughness: 0.75,
      metalness: 0.15,
    });
    skinnedMesh.material = aLiteMaterial;

    // Hide procedural arm blocks
    this.leftArm.root.visible = false;
    this.rightArm.root.visible = false;

    // Cache bone references
    const shoulderR = (rigGroup.getObjectByName('shoulderR') || rigGroup.getObjectByName('upper_armR')) as THREE.Bone;
    const upperArmR = rigGroup.getObjectByName('upper_armR') as THREE.Bone;
    const forearmR = rigGroup.getObjectByName('forearmR') as THREE.Bone;
    const handR = rigGroup.getObjectByName('handR') as THREE.Bone;

    const shoulderL = (rigGroup.getObjectByName('shoulderL') || rigGroup.getObjectByName('upper_armL')) as THREE.Bone;
    const upperArmL = rigGroup.getObjectByName('upper_armL') as THREE.Bone;
    const forearmL = rigGroup.getObjectByName('forearmL') as THREE.Bone;
    const handL = rigGroup.getObjectByName('handL') as THREE.Bone;

    if (!upperArmR || !forearmR || !handR || !upperArmL || !forearmL || !handL) {
      console.warn('FirstPersonArmsRig: Missing bone hierarchy in skinned mesh.');
      return;
    }

    // Cache rest bone unit vectors
    const restUpperRDir = forearmR.position.clone().normalize();
    const restForeRDir = handR.position.clone().normalize();
    const restUpperLDir = forearmL.position.clone().normalize();
    const restForeLDir = handL.position.clone().normalize();

    // Apply natural finger curls to wrap around weapon grips
    const curlFinger = (prefix: string, side: string, c1: number, c2: number, c3: number) => {
      const f1 = rigGroup.getObjectByName(`f_${prefix}01${side}`);
      const f2 = rigGroup.getObjectByName(`f_${prefix}02${side}`);
      const f3 = rigGroup.getObjectByName(`f_${prefix}03${side}`);
      if (f1) f1.rotation.x += c1;
      if (f2) f2.rotation.x += c2;
      if (f3) f3.rotation.x += c3;
    };
    const curlThumb = (side: string, c1: number, c2: number, c3: number) => {
      const t1 = rigGroup.getObjectByName(`thumb01${side}`);
      const t2 = rigGroup.getObjectByName(`thumb02${side}`);
      const t3 = rigGroup.getObjectByName(`thumb03${side}`);
      if (t1) { t1.rotation.z += c1; t1.rotation.y += c1 * 0.5; }
      if (t2) t2.rotation.x += c2;
      if (t3) t3.rotation.x += c3;
    };

    // Right hand pistol grip curl
    ['index', 'middle', 'ring', 'pinky'].forEach(f => curlFinger(f, 'R', 1.0, 1.2, 0.8));
    curlThumb('R', 0.8, 0.6, 0.6);

    // Left hand handguard support curl
    ['index', 'middle', 'ring', 'pinky'].forEach(f => curlFinger(f, 'L', 0.8, 1.0, 0.7));
    curlThumb('L', -0.6, 0.6, 0.6);

    this.skinnedArms = {
      rigGroup,
      skinnedMesh,
      shoulderR,
      upperArmR,
      forearmR,
      handR,
      shoulderL,
      upperArmL,
      forearmL,
      handL,
      restUpperRDir,
      restForeRDir,
      restUpperLDir,
      restForeLDir,
    };

    // Calculate actual triangles
    this.totalTriangles = 0;
    this.countMesh(skinnedMesh);
  }

  /**
   * Updates arm bones using two-bone IK to reach target hand positions.
   *
   * @param leftTargetPos Hand position for the left arm (weapon handguard or magazine)
   * @param leftTargetRot Hand orientation for the left arm
   * @param rightTargetPos Hand position for the right arm (pistol grip and trigger)
   * @param rightTargetRot Hand orientation for the right arm
   */
  public updateIK(
    leftTargetPos: THREE.Vector3,
    leftTargetRot: THREE.Euler,
    rightTargetPos: THREE.Vector3,
    rightTargetRot: THREE.Euler,
  ): void {
    if (this.skinnedArms) {
      this.updateSkinnedIK(leftTargetPos, leftTargetRot, rightTargetPos, rightTargetRot);
      return;
    }

    // Procedural Fallback Arms
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

  /**
   * Solves two-bone IK for articulated GLTF SkinnedMesh dual arms with zero per-frame allocation.
   */
  private updateSkinnedIK(
    leftTargetPos: THREE.Vector3,
    leftTargetRot: THREE.Euler,
    rightTargetPos: THREE.Vector3,
    rightTargetRot: THREE.Euler,
  ): void {
    const s = this.skinnedArms!;
    this.group.updateMatrixWorld(true);

    // Pole hints (elbows bend naturally down and out in world space)
    const poleR = this.scratchVec1.set(0.35, -0.45, -0.2).applyMatrix4(this.group.matrixWorld);
    const poleL = this.scratchVec2.set(-0.35, -0.45, -0.2).applyMatrix4(this.group.matrixWorld);

    // 1. Solve Right Arm (Pistol Grip)
    this.solveSkinnedArmChain(
      s.shoulderR,
      s.upperArmR,
      s.forearmR,
      s.handR,
      s.restUpperRDir,
      s.restForeRDir,
      rightTargetPos,
      rightTargetRot,
      poleR,
      0.3222,
      0.2373,
    );

    // 2. Solve Left Arm (Handguard / Mag)
    this.solveSkinnedArmChain(
      s.shoulderL,
      s.upperArmL,
      s.forearmL,
      s.handL,
      s.restUpperLDir,
      s.restForeLDir,
      leftTargetPos,
      leftTargetRot,
      poleL,
      0.3222,
      0.2373,
    );
  }

  private solveSkinnedArmChain(
    shoulderBone: THREE.Bone,
    upperArmBone: THREE.Bone,
    forearmBone: THREE.Bone,
    handBone: THREE.Bone,
    restUpperDir: THREE.Vector3,
    restForeDir: THREE.Vector3,
    targetPos: THREE.Vector3,
    targetRot: THREE.Euler,
    poleHint: THREE.Vector3,
    upperLen: number,
    foreLen: number,
  ): void {
    shoulderBone.updateMatrixWorld(true);

    // 1. Get shoulder world position
    const shoulderWorld = this.scratchVec3;
    upperArmBone.getWorldPosition(shoulderWorld);

    // 2. Solve elbow position
    const elbowWorld = this.scratchVec1;
    this.ikSolver.solve(shoulderWorld, targetPos, poleHint, upperLen, foreLen, elbowWorld);

    // 3. Orient upper arm from shoulder to elbow
    const upperDir = this.scratchVec2.subVectors(elbowWorld, shoulderWorld).normalize();
    const shoulderWorldQuat = shoulderBone.getWorldQuaternion(this.scratchQuat1);
    const upperDirLocal = upperDir.applyQuaternion(shoulderWorldQuat.invert());
    upperArmBone.quaternion.setFromUnitVectors(restUpperDir, upperDirLocal);
    upperArmBone.updateMatrixWorld(true);

    // 4. Orient forearm from elbow to targetPos
    const forearmWorld = shoulderWorld;
    forearmBone.getWorldPosition(forearmWorld);
    const foreDir = this.scratchVec2.subVectors(targetPos, forearmWorld).normalize();
    const upperWorldQuat = upperArmBone.getWorldQuaternion(this.scratchQuat2);
    const foreDirLocal = foreDir.applyQuaternion(upperWorldQuat.invert());
    forearmBone.quaternion.setFromUnitVectors(restForeDir, foreDirLocal);
    forearmBone.updateMatrixWorld(true);

    // 5. Orient hand to targetRot
    const foreWorldQuat = forearmBone.getWorldQuaternion(this.scratchQuat3);
    const targetQuat = this.scratchQuat1.setFromEuler(targetRot);
    handBone.quaternion.copy(targetQuat).premultiply(foreWorldQuat.invert());
    handBone.updateMatrixWorld(true);
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

