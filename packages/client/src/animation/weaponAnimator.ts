import * as THREE from 'three';
import { FirstPersonArmsRig } from './armsRig';
import { KeyframeClip, TimedAnimationEvent, WeaponClipName, WeaponKeyframe, WeaponVisualDef } from './types';
import { MAGAZINE_GRASP_LEFT, BOLT_HOOK_RIGHT } from './fingerGripPoses';

export const MAX_COSMETIC_PHYSICS_DT = 1 / 30; // Max dt ~33.3ms to prevent objects launching after background tab

/**
 * Steps cosmetic physics (dropped magazines/shells) with dt clamping to prevent launching objects
 * into space if the browser tab is backgrounded.
 */
export function stepCosmeticPhysics(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  rot: THREE.Euler,
  rotVel: THREE.Vector3,
  dt: number,
  gravity = -9.8,
  maxDt = MAX_COSMETIC_PHYSICS_DT,
): number {
  const clampedDt = Math.min(Math.max(0, dt), maxDt);
  vel.y += gravity * clampedDt;
  pos.addScaledVector(vel, clampedDt);
  rot.x += rotVel.x * clampedDt;
  rot.y += rotVel.y * clampedDt;
  rot.z += rotVel.z * clampedDt;
  return clampedDt;
}

export class WeaponAnimator {
  public visualDef: WeaponVisualDef;
  public armsRig: FirstPersonArmsRig;
  public weaponGroup: THREE.Group;

  // Sockets parented directly to the weapon root so they inherit all sway, bob, recoil, and ADS transforms
  public socketR: THREE.Object3D;
  public socketL: THREE.Object3D;

  // Active clip state
  private currentClip: KeyframeClip;
  private clipTime = 0;
  private isLooping = true;
  private firedEvents = new Set<TimedAnimationEvent>();

  // Dropped magazines in the world
  private droppedMags: Array<{
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotVel: THREE.Vector3;
    life: number;
  }> = [];

  // Reusable scratchpads to eliminate allocations in update loop
  private scratchLeftPos = new THREE.Vector3();
  private scratchRightPos = new THREE.Vector3();
  private scratchLeftQuat = new THREE.Quaternion();
  private scratchRightQuat = new THREE.Quaternion();
  private scratchMagPos = new THREE.Vector3();
  private scratchBoltPos = new THREE.Vector3();

  // Dropped magazine shared material and geometry
  private magGeomCache: THREE.BufferGeometry;
  private magMatCache: THREE.Material;

  // Zero-allocation pooled spent cartridge casing ejection
  private casingPool: Array<{
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotVel: THREE.Vector3;
    life: number;
    active: boolean;
  }> = [];
  private scratchEjectPos = new THREE.Vector3();
  private weaponRight = new THREE.Vector3();
  private weaponUp = new THREE.Vector3();
  private weaponBack = new THREE.Vector3();

  constructor(visualDef: WeaponVisualDef, armsRig: FirstPersonArmsRig) {
    this.visualDef = visualDef;
    this.armsRig = armsRig;

    this.weaponGroup = new THREE.Group();
    this.weaponGroup.name = 'Animated_Weapon_Group';

    // Add weapon body, mag, bolt
    this.weaponGroup.add(this.visualDef.bodyMesh);
    this.weaponGroup.add(this.visualDef.magMesh);
    this.weaponGroup.add(this.visualDef.boltMesh);

    // Create weapon sockets as child Object3Ds of weaponGroup
    this.socketR = new THREE.Object3D();
    this.socketR.name = 'Socket_Grip_R';
    this.socketL = new THREE.Object3D();
    this.socketL.name = 'Socket_Grip_L';

    this.weaponGroup.add(this.socketR);
    this.weaponGroup.add(this.socketL);

    this.currentClip = this.visualDef.clips.draw;
    this.isLooping = false;

    // Cache mag clone primitives
    this.magGeomCache = this.visualDef.magMesh.geometry;
    this.magMatCache = this.visualDef.magMesh.material as THREE.Material;
    this.armsRig.setCustomFingerGrips(this.visualDef.fingerGrips?.left, this.visualDef.fingerGrips?.right);

    // Pre-allocate 16 pooled spent cartridge casings (zero per-frame allocation)
    const casingGeom = new THREE.CylinderGeometry(0.0035, 0.004, 0.024, 6);
    casingGeom.rotateZ(Math.PI / 2);
    const casingMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.95,
    });
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(casingGeom, casingMat);
      mesh.name = `Spent_Casing_${i}`;
      mesh.visible = false;
      this.casingPool.push({
        mesh,
        velocity: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
        active: false,
      });
    }
  }

  public setVisualDef(newDef: WeaponVisualDef): void {
    this.weaponGroup.remove(this.visualDef.bodyMesh);
    this.weaponGroup.remove(this.visualDef.magMesh);
    this.weaponGroup.remove(this.visualDef.boltMesh);

    this.visualDef = newDef;
    this.weaponGroup.add(this.visualDef.bodyMesh);
    this.weaponGroup.add(this.visualDef.magMesh);
    this.weaponGroup.add(this.visualDef.boltMesh);

    this.magGeomCache = this.visualDef.magMesh.geometry;
    this.magMatCache = this.visualDef.magMesh.material as THREE.Material;
    this.armsRig.setCustomFingerGrips(this.visualDef.fingerGrips?.left, this.visualDef.fingerGrips?.right);

    this.playClip('draw', true);
  }

  public playClip(
    clipName: WeaponClipName,
    forceRestart = false,
  ): void {
    const nextClip = this.visualDef.clips[clipName];
    if (!nextClip) return;

    if (this.currentClip === nextClip && !forceRestart) return;

    this.currentClip = nextClip;
    this.clipTime = 0;
    this.isLooping = clipName === 'idle';
    this.firedEvents.clear();
  }

  public getClipName(): string {
    return this.currentClip.name;
  }

  public getCurrentClipName(): string {
    return this.getClipName();
  }

  public isFinished(): boolean {
    if (this.isLooping) return false;
    return this.clipTime >= this.currentClip.duration;
  }

  public update(dt: number, scene?: THREE.Scene): void {
    // 1. Advance clip progress
    this.clipTime += dt;
    const duration = Math.max(0.001, this.currentClip.duration);
    let normalizedTime = this.clipTime / duration;

    if (normalizedTime >= 1.0) {
      if (this.isLooping) {
        this.clipTime = this.clipTime % duration;
        normalizedTime = this.clipTime / duration;
        this.firedEvents.clear();
      } else {
        // Non-looping clip finished -> return to idle
        this.playClip('idle');
        normalizedTime = 0;
      }
    }

    // 2. Process animation events
    for (const ev of this.currentClip.events) {
      if (normalizedTime >= ev.timeFraction && !this.firedEvents.has(ev)) {
        this.firedEvents.add(ev);
        this.handleAnimationEvent(ev, scene);
      }
    }

    // 3. Interpolate keyframes
    this.sampleKeyframes(this.currentClip.keyframes, normalizedTime);

    // 4. Update magazine transform & visibility
    this.scratchMagPos.copy(this.visualDef.magRestPos);
    this.scratchMagPos.add(this.interpolatedMagOffset);
    this.visualDef.magMesh.position.copy(this.scratchMagPos);
    this.visualDef.magMesh.visible = this.interpolatedMagAttached;

    // 5. Update bolt carrier transform
    this.scratchBoltPos.copy(this.visualDef.boltRestPos);
    this.scratchBoltPos.add(this.interpolatedBoltOffset);
    this.visualDef.boltMesh.position.copy(this.scratchBoltPos);

    // 6. Apply weapon root positional & rotational offsets
    this.weaponGroup.position.copy(this.interpolatedWeaponPos);
    this.weaponGroup.rotation.copy(this.interpolatedWeaponRot);

    // 7. Update sockets in WEAPON-LOCAL space
    this.socketR.position.copy(this.interpolatedRightHandPos);
    this.socketR.rotation.copy(this.interpolatedRightHandRot);

    this.socketL.position.copy(this.interpolatedLeftHandPos);
    this.socketL.rotation.copy(this.interpolatedLeftHandRot);

    // Force weapon hierarchy matrix update so sockets receive new world matrices
    this.weaponGroup.updateMatrixWorld(true);

    // 8. Read world transforms directly from sockets (inherits sway, bob, recoil, ADS)
    this.socketL.getWorldPosition(this.scratchLeftPos);
    this.socketL.getWorldQuaternion(this.scratchLeftQuat);

    this.socketR.getWorldPosition(this.scratchRightPos);
    this.socketR.getWorldQuaternion(this.scratchRightQuat);

    // 9. Solve analytical two-bone IK (bypassed on reload keyframes to follow authored trajectory)
    const isReloading = this.currentClip.name.startsWith('reload');
    const isCyclingBolt = this.currentClip.name === 'boltCycle';

    if (isReloading) {
      this.armsRig.setCustomFingerGrips(MAGAZINE_GRASP_LEFT, this.visualDef.fingerGrips?.right);
    } else if (isCyclingBolt) {
      this.armsRig.setCustomFingerGrips(this.visualDef.fingerGrips?.left, BOLT_HOOK_RIGHT);
    } else {
      this.armsRig.setCustomFingerGrips(this.visualDef.fingerGrips?.left, this.visualDef.fingerGrips?.right);
    }

    this.armsRig.updateIK(
      this.scratchLeftPos,
      this.scratchLeftQuat,
      this.scratchRightPos,
      this.scratchRightQuat,
      isReloading,
    );

    // 10. Update dropped physics magazines
    if (scene && this.droppedMags.length > 0) {
      for (let i = this.droppedMags.length - 1; i >= 0; i--) {
        const item = this.droppedMags[i]!;
        item.life += dt;
        stepCosmeticPhysics(item.mesh.position, item.velocity, item.mesh.rotation, item.rotVel, dt);

        if (item.life > 2.5) {
          scene.remove(item.mesh);
          this.droppedMags.splice(i, 1);
        }
      }
    }

    // 11. Update spent cartridge casings
    if (scene) {
      for (let i = 0; i < this.casingPool.length; i++) {
        const c = this.casingPool[i]!;
        if (!c.active) continue;
        c.life += dt;
        c.velocity.y += -9.81 * dt;
        c.mesh.position.addScaledVector(c.velocity, dt);
        c.mesh.rotation.x += c.rotVel.x * dt;
        c.mesh.rotation.y += c.rotVel.y * dt;
        c.mesh.rotation.z += c.rotVel.z * dt;

        if (c.life > 1.2) {
          c.active = false;
          c.mesh.visible = false;
        }
      }
    }
  }

  private handleAnimationEvent(ev: TimedAnimationEvent, scene?: THREE.Scene): void {
    if (ev.type === 'mag_drop' && scene) {
      const droppedMesh = new THREE.Mesh(this.magGeomCache, this.magMatCache);
      const worldPos = new THREE.Vector3();
      this.visualDef.magMesh.getWorldPosition(worldPos);
      droppedMesh.position.copy(worldPos);
      droppedMesh.rotation.copy(this.weaponGroup.rotation);
      scene.add(droppedMesh);

      this.droppedMags.push({
        mesh: droppedMesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.4,
          -1.5,
          (Math.random() - 0.5) * 0.4,
        ),
        rotVel: new THREE.Vector3(
          Math.random() * 4 - 2,
          Math.random() * 3 - 1.5,
          Math.random() * 4 - 2,
        ),
        life: 0,
      });
    } else if (ev.type === 'fire_recoil' && scene) {
      // Auto rifles, pistols, and SMGs eject casing immediately upon slide/bolt blowback
      if (this.visualDef.weaponId !== 'shotgun' && this.visualDef.weaponId !== 'sniper') {
        this.spawnSpentCasing(scene);
      }
    } else if (ev.type === 'bolt_pull' && scene) {
      // Pump shotguns and bolt-action snipers eject spent casing when the action is manually cycled
      if (this.visualDef.weaponId === 'shotgun' || this.visualDef.weaponId === 'sniper') {
        this.spawnSpentCasing(scene);
      }
    }
  }

  private spawnSpentCasing(scene: THREE.Scene): void {
    let casing = this.casingPool.find(c => !c.active);
    if (!casing) {
      casing = this.casingPool.reduce((oldest, c) => (c.life > oldest.life ? c : oldest), this.casingPool[0]!);
    }

    this.scratchEjectPos.copy(this.visualDef.ejectionPortOffset).applyMatrix4(this.weaponGroup.matrixWorld);
    casing.mesh.position.copy(this.scratchEjectPos);

    this.weaponRight.set(1, 0, 0).applyQuaternion(this.weaponGroup.quaternion);
    this.weaponUp.set(0, 1, 0).applyQuaternion(this.weaponGroup.quaternion);
    this.weaponBack.set(0, 0, 1).applyQuaternion(this.weaponGroup.quaternion);

    casing.velocity
      .copy(this.weaponRight).multiplyScalar(2.4 + (Math.random() - 0.5) * 0.4)
      .addScaledVector(this.weaponUp, 1.4 + (Math.random() - 0.5) * 0.3)
      .addScaledVector(this.weaponBack, 0.6 + (Math.random() - 0.5) * 0.3);

    casing.rotVel.set(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 30,
    );

    casing.life = 0;
    casing.active = true;
    casing.mesh.visible = true;

    if (casing.mesh.parent !== scene) {
      scene.add(casing.mesh);
    }
  }

  // Pre-allocated interpolation results
  private interpolatedLeftHandPos = new THREE.Vector3();
  private interpolatedLeftHandRot = new THREE.Euler();
  private interpolatedRightHandPos = new THREE.Vector3();
  private interpolatedRightHandRot = new THREE.Euler();
  private interpolatedMagOffset = new THREE.Vector3();
  private interpolatedMagAttached = true;
  private interpolatedBoltOffset = new THREE.Vector3();
  private interpolatedWeaponPos = new THREE.Vector3();
  private interpolatedWeaponRot = new THREE.Euler();

  private sampleKeyframes(keyframes: WeaponKeyframe[], t: number): void {
    if (keyframes.length === 0) return;
    if (keyframes.length === 1 || t <= keyframes[0]!.time) {
      this.copyKeyframe(keyframes[0]!);
      return;
    }
    const last = keyframes[keyframes.length - 1]!;
    if (t >= last.time) {
      this.copyKeyframe(last);
      return;
    }

    let k0 = keyframes[0]!;
    let k1 = keyframes[1]!;
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (t >= keyframes[i]!.time && t <= keyframes[i + 1]!.time) {
        k0 = keyframes[i]!;
        k1 = keyframes[i + 1]!;
        break;
      }
    }

    const span = Math.max(0.0001, k1.time - k0.time);
    const alpha = (t - k0.time) / span;

    // Position interpolation
    this.interpolatedLeftHandPos.lerpVectors(k0.leftHand.pos, k1.leftHand.pos, alpha);
    this.interpolatedRightHandPos.lerpVectors(k0.rightHand.pos, k1.rightHand.pos, alpha);
    this.interpolatedMagOffset.lerpVectors(k0.magOffset, k1.magOffset, alpha);
    this.interpolatedBoltOffset.lerpVectors(k0.boltOffset, k1.boltOffset, alpha);
    this.interpolatedWeaponPos.lerpVectors(k0.weaponPosOffset, k1.weaponPosOffset, alpha);

    // Rotation interpolation
    this.interpolatedLeftHandRot.set(
      k0.leftHand.rot.x + (k1.leftHand.rot.x - k0.leftHand.rot.x) * alpha,
      k0.leftHand.rot.y + (k1.leftHand.rot.y - k0.leftHand.rot.y) * alpha,
      k0.leftHand.rot.z + (k1.leftHand.rot.z - k0.leftHand.rot.z) * alpha,
    );
    this.interpolatedRightHandRot.set(
      k0.rightHand.rot.x + (k1.rightHand.rot.x - k0.rightHand.rot.x) * alpha,
      k0.rightHand.rot.y + (k1.rightHand.rot.y - k0.rightHand.rot.y) * alpha,
      k0.rightHand.rot.z + (k1.rightHand.rot.z - k0.rightHand.rot.z) * alpha,
    );
    this.interpolatedWeaponRot.set(
      k0.weaponRotOffset.x + (k1.weaponRotOffset.x - k0.weaponRotOffset.x) * alpha,
      k0.weaponRotOffset.y + (k1.weaponRotOffset.y - k0.weaponRotOffset.y) * alpha,
      k0.weaponRotOffset.z + (k1.weaponRotOffset.z - k0.weaponRotOffset.z) * alpha,
    );

    this.interpolatedMagAttached = k0.magAttached && k1.magAttached;
  }

  private copyKeyframe(k: WeaponKeyframe): void {
    this.interpolatedLeftHandPos.copy(k.leftHand.pos);
    this.interpolatedLeftHandRot.copy(k.leftHand.rot);
    this.interpolatedRightHandPos.copy(k.rightHand.pos);
    this.interpolatedRightHandRot.copy(k.rightHand.rot);
    this.interpolatedMagOffset.copy(k.magOffset);
    this.interpolatedBoltOffset.copy(k.boltOffset);
    this.interpolatedWeaponPos.copy(k.weaponPosOffset);
    this.interpolatedWeaponRot.copy(k.weaponRotOffset);
    this.interpolatedMagAttached = k.magAttached;
  }
}
