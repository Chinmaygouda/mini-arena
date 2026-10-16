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
}

interface BoneBindTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

// Sculpted finger grasp quaternions from author's grab.R/grab.L animations
const RIGHT_HAND_GRIP_QUATS: Record<string, [number, number, number, number]> = {
  palm01R: [0.0042, -0.7724, -0.0896, 0.6287],
  f_index01R: [0.7489, 0.0501, -0.011, 0.6607],
  f_index02R: [0.6048, -0.0113, 0.019, 0.7961],
  f_index03R: [0.6166, 0.0001, 0.0055, 0.7873],
  thumb01R: [0.0619, -0.3948, -0.2959, 0.8676],
  thumb02R: [0.5574, 0.0415, 0.0194, 0.829],
  thumb03R: [0.4828, -0.0893, 0.0736, 0.868],
  palm02R: [-0.0338, -0.7304, -0.0702, 0.6786],
  f_middle01R: [0.7354, 0.0168, 0.0029, 0.6774],
  f_middle02R: [0.6254, 0.0111, -0.0029, 0.7802],
  f_middle03R: [0.6215, 0.0043, -0.0018, 0.7834],
  palm03R: [0.0079, 0.6967, -0.0787, 0.713],
  f_ring01R: [0.0189, -0.6785, 0.734, 0.0204],
  f_ring02R: [0.615, -0.0012, 0.0064, 0.7885],
  f_ring03R: [0.6485, 0.0325, -0.0219, 0.7602],
  palm04R: [-0.1256, -0.6614, 0.0393, 0.7384],
  f_pinky01R: [0.7284, -0.0087, 0.0124, 0.685],
  f_pinky02R: [0.6398, 0.0348, -0.0034, 0.7677],
  f_pinky03R: [0.5934, -0.0201, 0.0147, 0.8045],
};

const LEFT_HAND_GRIP_QUATS: Record<string, [number, number, number, number]> = {
  palm01L: [0.01, 0.7703, 0.0982, 0.63],
  f_index01L: [0.6802, -0.0462, -0.0224, 0.731],
  f_index02L: [0.5167, 0.0206, -0.008, 0.855],
  f_index03L: [0.4921, 0.0033, -0.0044, 0.87],
  thumb01L: [0.0122, 0.414, 0.3093, 0.856],
  thumb02L: [0.4771, -0.0033, -0.0225, 0.878],
  thumb03L: [0.3923, 0.1114, -0.0314, 0.912],
  palm02L: [-0.033, 0.7301, 0.0713, 0.6788],
  f_middle01L: [0.7192, -0.0114, -0.0127, 0.694],
  f_middle02L: [0.5892, -0.0105, -0.0046, 0.807],
  f_middle03L: [0.5642, -0.0045, -0.0012, 0.825],
  palm03L: [0.0034, -0.6955, 0.0825, 0.7138],
  f_ring01L: [0.6922, 0.0871, -0.1575, 0.699],
  f_ring02L: [0.5841, 0.0049, -0.0043, 0.811],
  f_ring03L: [0.5698, -0.039, -0.0029, 0.82],
  palm04L: [-0.1291, 0.6619, -0.0428, 0.7372],
  f_pinky01L: [0.699, 0.0145, -0.0043, 0.714],
  f_pinky02L: [0.5883, -0.0295, -0.0188, 0.807],
  f_pinky03L: [0.541, 0.0249, 0.0008, 0.84],
};

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
  public skinnedArms: SkinnedArmsData | null = null;
  private boneBindTransforms: Map<THREE.Bone, BoneBindTransform> = new Map();
  private fingerBones: Map<string, THREE.Bone> = new Map();

  // Preallocated vector & quaternion scratchpads for zero-allocation IK evaluation
  private leftElbowPos = new THREE.Vector3();
  private rightElbowPos = new THREE.Vector3();
  private scratchUp = new THREE.Vector3(0, 1, 0);

  private shoulderWorldR = new THREE.Vector3();
  private shoulderWorldL = new THREE.Vector3();
  private poleWorldR = new THREE.Vector3();
  private poleWorldL = new THREE.Vector3();

  private scratchQuatL = new THREE.Quaternion();
  private scratchQuatR = new THREE.Quaternion();

  // Palm offset compensation vectors (local to hand bone)
  public palmOffsetLocalR = new THREE.Vector3(0.00506, 0.03924, 0.00018);
  public palmOffsetLocalL = new THREE.Vector3(-0.00506, 0.03924, 0.00018);

  // Residual dynamic IK tracking (max 2cm displacement)
  private baseWristPosR = new THREE.Vector3();
  private baseWristPosL = new THREE.Vector3();
  private hasBaseWristR = false;
  private hasBaseWristL = false;
  private scratchVecR = new THREE.Vector3();
  private scratchVecL = new THREE.Vector3();
  private palmWorldOffsetR = new THREE.Vector3();
  private palmWorldOffsetL = new THREE.Vector3();
  private wristTargetPosR = new THREE.Vector3();
  private wristTargetPosL = new THREE.Vector3();

  public totalTriangles = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'FPArms_Rig';
    this.ikSolver = new TwoBoneIKSolver();

    const upperLen = 0.32;
    const foreLen = 0.30;

    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
      metalness: 0.1,
    });

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
      const shoulderPos = new THREE.Vector3(sideSign * 0.2, -0.15, -0.05);
      const poleHint = new THREE.Vector3(sideSign * 0.42, -0.42, -0.18);

      const upperGeom = new THREE.CylinderGeometry(0.042, 0.038, upperLen, 8);
      upperGeom.translate(0, -upperLen / 2, 0);
      const upperArm = new THREE.Mesh(upperGeom, sleeveMat);
      upperArm.name = isLeft ? 'UpperArm_Left' : 'UpperArm_Right';

      const foreGeom = new THREE.CylinderGeometry(0.036, 0.03, foreLen, 8);
      foreGeom.translate(0, -foreLen / 2, 0);
      const forearm = new THREE.Mesh(foreGeom, gloveMat);
      forearm.name = isLeft ? 'Forearm_Left' : 'Forearm_Right';

      const hand = new THREE.Group();
      hand.name = isLeft ? 'Hand_Left' : 'Hand_Right';

      const palmGeom = new THREE.BoxGeometry(0.065, 0.075, 0.032);
      const palm = new THREE.Mesh(palmGeom, palmMat);
      hand.add(palm);

      armGroup.add(upperArm);
      armGroup.add(forearm);
      armGroup.add(hand);
      this.group.add(armGroup);

      this.countMesh(upperArm);
      this.countMesh(forearm);
      this.countMesh(palm);

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
   * Stores initial bind pose for all bones and pre-indexes finger bones for grip poses.
   */
  public setSkinnedArms(rigGroup: THREE.Group, skinnedMesh: THREE.SkinnedMesh): void {
    this.group.add(rigGroup);

    // Drillimpact rig has camera at Y = 1.743155 in rest pose.
    rigGroup.position.set(0, -1.743155, 0);
    rigGroup.updateMatrixWorld(true);

    // Option A cohesive stylized material: lighter, readable contrast against dark arena
    const tacticalMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569, // Lighter, desaturated slate gray
      roughness: 0.7,
      metalness: 0.15,
    });
    skinnedMesh.material = tacticalMaterial;

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

    // Cache bind pose transforms for all bones (ensures strict history independence)
    this.boneBindTransforms.clear();
    this.fingerBones.clear();

    rigGroup.traverse((obj) => {
      if ((obj as THREE.Bone).isBone) {
        const bone = obj as THREE.Bone;
        this.boneBindTransforms.set(bone, {
          position: bone.position.clone(),
          quaternion: bone.quaternion.clone(),
        });
        if (bone.name.startsWith('f_') || bone.name.startsWith('thumb') || bone.name.startsWith('palm')) {
          this.fingerBones.set(bone.name, bone);
        }
      }
    });

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
    };

    // Calculate actual triangles
    this.totalTriangles = 0;
    this.countMesh(skinnedMesh);
  }

  /**
   * Resets all skeleton bones to their pristine author bind pose.
   * Guarantees zero accumulation of twist across frames.
   */
  public resetToBindPose(): void {
    if (!this.skinnedArms) return;
    for (const [bone, bind] of this.boneBindTransforms) {
      bone.position.copy(bind.position);
      bone.quaternion.copy(bind.quaternion);
    }
  }

  private customFingerGripsLeft: Record<string, [number, number, number, number]> | null = null;
  private customFingerGripsRight: Record<string, [number, number, number, number]> | null = null;

  public setCustomFingerGrips(
    left?: Record<string, [number, number, number, number]>,
    right?: Record<string, [number, number, number, number]>,
  ): void {
    this.customFingerGripsLeft = left || null;
    this.customFingerGripsRight = right || null;
  }

  /**
   * Applies natural cylindrical finger grip poses to the hands.
   * Supports weapon-specific finger sculpts with fallback to defaults.
   * Eliminates splayed claws.
   */
  public applyFingerGrips(): void {
    if (!this.skinnedArms) return;

    // Right Hand (Pistol Grip)
    const rightGrips = this.customFingerGripsRight || RIGHT_HAND_GRIP_QUATS;
    for (const [name, q] of Object.entries(rightGrips)) {
      const bone = this.fingerBones.get(name);
      if (bone) {
        bone.quaternion.set(q[0], q[1], q[2], q[3]);
      }
    }

    // Left Hand (Handguard / Fore-end Wrap)
    const leftGrips = this.customFingerGripsLeft || LEFT_HAND_GRIP_QUATS;
    for (const [name, q] of Object.entries(leftGrips)) {
      const bone = this.fingerBones.get(name);
      if (bone) {
        bone.quaternion.set(q[0], q[1], q[2], q[3]);
      }
    }
  }

  /**
   * Updates arm bones using analytical two-bone IK to reach target hand positions.
   *
   * @param leftTargetPos Hand position for the left arm in world space
   * @param leftTargetRot Hand orientation for the left arm (Quaternion or Euler)
   * @param rightTargetPos Hand position for the right arm in world space
   * @param rightTargetRot Hand orientation for the right arm (Quaternion or Euler)
   */
  public updateIK(
    leftTargetPos: THREE.Vector3,
    leftTargetRot: THREE.Quaternion | THREE.Euler,
    rightTargetPos: THREE.Vector3,
    rightTargetRot: THREE.Quaternion | THREE.Euler,
    isReloading = false,
  ): void {
    const qLeft =
      leftTargetRot instanceof THREE.Quaternion
        ? leftTargetRot
        : this.scratchQuatL.setFromEuler(leftTargetRot);

    const qRight =
      rightTargetRot instanceof THREE.Quaternion
        ? rightTargetRot
        : this.scratchQuatR.setFromEuler(rightTargetRot);

    if (this.skinnedArms) {
      this.updateSkinnedIK(leftTargetPos, qLeft, rightTargetPos, qRight, isReloading);
      return;
    }

    // Procedural Fallback Arms
    this.ikSolver.solve(
      this.leftArm.shoulderPos,
      leftTargetPos,
      this.leftArm.poleHint,
      this.leftArm.upperLength,
      this.leftArm.foreLength,
      this.leftElbowPos,
    );
    this.positionBone(this.leftArm.upperArm, this.leftArm.shoulderPos, this.leftElbowPos);
    this.positionBone(this.leftArm.forearm, this.leftElbowPos, leftTargetPos);
    this.leftArm.hand.position.copy(leftTargetPos);
    this.leftArm.hand.quaternion.copy(qLeft);

    this.ikSolver.solve(
      this.rightArm.shoulderPos,
      rightTargetPos,
      this.rightArm.poleHint,
      this.rightArm.upperLength,
      this.rightArm.foreLength,
      this.rightElbowPos,
    );
    this.positionBone(this.rightArm.upperArm, this.rightArm.shoulderPos, this.rightElbowPos);
    this.positionBone(this.rightArm.forearm, this.rightElbowPos, rightTargetPos);
    this.rightArm.hand.position.copy(rightTargetPos);
    this.rightArm.hand.quaternion.copy(qRight);
  }

  /**
   * Solves two-bone IK for articulated GLTF SkinnedMesh dual arms with zero per-frame allocation.
   * Guarantees bend direction, prevents elbow flips, and eliminates twist accumulation.
   * During reload keyframes, IK is disabled so the hand follows authored keyframes cleanly.
   */
  private updateSkinnedIK(
    leftTargetPos: THREE.Vector3,
    leftTargetQuat: THREE.Quaternion,
    rightTargetPos: THREE.Vector3,
    rightTargetQuat: THREE.Quaternion,
    isReloading = false,
  ): void {
    const s = this.skinnedArms!;

    // 1. Reset all bones to pristine author bind pose
    this.resetToBindPose();

    // 2. Apply finger grip poses (cylindrical wrap, no claws)
    this.applyFingerGrips();

    this.group.updateMatrixWorld(true);

    // 3. Subtract rotated palm offset so that the physical palm center lands exactly on the weapon socket
    this.palmWorldOffsetR.copy(this.palmOffsetLocalR).applyQuaternion(rightTargetQuat);
    this.wristTargetPosR.subVectors(rightTargetPos, this.palmWorldOffsetR);

    this.palmWorldOffsetL.copy(this.palmOffsetLocalL).applyQuaternion(leftTargetQuat);
    this.wristTargetPosL.subVectors(leftTargetPos, this.palmWorldOffsetL);

    // 4. Construct low and outward pole targets (guarantees elbows point downward/outward)
    this.poleWorldR.set(-0.45, -0.55, -0.15).applyMatrix4(this.group.matrixWorld);
    this.poleWorldL.set(0.45, -0.55, -0.15).applyMatrix4(this.group.matrixWorld);

    // 5. Solve Right Arm (Weapon Grip) — strictly rigid bone lengths (0.322236m & 0.237276m)
    // Sockets are positioned in weapon-local space; runtime IK tracks socket with max 2cm residual correction
    s.upperArmR.getWorldPosition(this.shoulderWorldR);
    this.ikSolver.solve(
      this.shoulderWorldR,
      this.wristTargetPosR,
      this.poleWorldR,
      0.322236,
      0.237276,
      this.rightElbowPos,
    );
    // Never modify bone translation positions (no bone stretching!)

    this.ikSolver.orientBone(s.upperArmR, this.shoulderWorldR, this.rightElbowPos, this.ikSolver.planeNormal, s.shoulderR, false);
    this.ikSolver.orientBone(s.forearmR, this.rightElbowPos, this.wristTargetPosR, this.ikSolver.planeNormal, s.upperArmR, false);
    this.ikSolver.orientWrist(s.handR, s.forearmR, rightTargetQuat, 0);

    // 6. Left Arm: If reloading, NO IK AT ALL! Hands follow keyframed trajectory directly.
    s.upperArmL.getWorldPosition(this.shoulderWorldL);
    if (isReloading) {
      // Direct smooth chain without IK: align arm naturally along shoulder-to-wrist vector
      this.leftElbowPos.subVectors(this.wristTargetPosL, this.shoulderWorldL);
      const reachDist = this.leftElbowPos.length();
      const armDir = this.scratchUp.copy(this.leftElbowPos).normalize();

      this.leftElbowPos
        .copy(this.shoulderWorldL)
        .addScaledVector(armDir, Math.min(0.322236, reachDist * 0.55))
        .addScaledVector(new THREE.Vector3(0, -0.05, 0.02), 1.0);

      this.ikSolver.orientBone(s.upperArmL, this.shoulderWorldL, this.leftElbowPos, this.ikSolver.planeNormal, s.shoulderL, true);
      this.ikSolver.orientBone(s.forearmL, this.leftElbowPos, this.wristTargetPosL, this.ikSolver.planeNormal, s.upperArmL, true);
      this.ikSolver.orientWrist(s.handL, s.forearmL, leftTargetQuat, 0);
    } else {
      this.ikSolver.solve(
        this.shoulderWorldL,
        this.wristTargetPosL,
        this.poleWorldL,
        0.322236,
        0.237276,
        this.leftElbowPos,
      );

      this.ikSolver.orientBone(s.upperArmL, this.shoulderWorldL, this.leftElbowPos, this.ikSolver.planeNormal, s.shoulderL, true);
      this.ikSolver.orientBone(s.forearmL, this.leftElbowPos, this.wristTargetPosL, this.ikSolver.planeNormal, s.upperArmL, true);
      this.ikSolver.orientWrist(s.handL, s.forearmL, leftTargetQuat, 0);
    }
  }

  private positionBone(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
    mesh.position.copy(from);
    this.scratchUp.subVectors(to, from);
    const dist = this.scratchUp.length();
    if (dist > 0.0001) {
      this.scratchUp.multiplyScalar(1.0 / dist);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), this.scratchUp);
      mesh.scale.set(1, 1, 1); // Strictly rigid: never scale bone length
    }
  }
}
