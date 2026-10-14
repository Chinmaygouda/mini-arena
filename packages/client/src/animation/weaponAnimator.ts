import * as THREE from 'three';
import { FirstPersonArmsRig } from './armsRig';
import { KeyframeClip, TimedAnimationEvent, WeaponKeyframe, WeaponVisualDef } from './types';

export class WeaponAnimator {
  public visualDef: WeaponVisualDef;
  public armsRig: FirstPersonArmsRig;
  public weaponGroup: THREE.Group;

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
  private scratchLeftRot = new THREE.Euler();
  private scratchRightRot = new THREE.Euler();
  private scratchMagPos = new THREE.Vector3();
  private scratchBoltPos = new THREE.Vector3();
  private scratchWeaponPos = new THREE.Vector3();
  private scratchWeaponRot = new THREE.Euler();

  // Dropped magazine shared material and geometry
  private magGeomCache: THREE.BufferGeometry;
  private magMatCache: THREE.Material;

  constructor(visualDef: WeaponVisualDef, armsRig: FirstPersonArmsRig) {
    this.visualDef = visualDef;
    this.armsRig = armsRig;

    this.weaponGroup = new THREE.Group();
    this.weaponGroup.name = 'Animated_Weapon_Group';

    // Add weapon body, mag, bolt
    this.weaponGroup.add(this.visualDef.bodyMesh);
    this.weaponGroup.add(this.visualDef.magMesh);
    this.weaponGroup.add(this.visualDef.boltMesh);

    this.currentClip = this.visualDef.clips.draw;
    this.isLooping = false;

    // Cache mag clone primitives
    this.magGeomCache = this.visualDef.magMesh.geometry;
    this.magMatCache = this.visualDef.magMesh.material as THREE.Material;
  }

  public playClip(
    clipName: 'idle' | 'draw' | 'inspect' | 'reloadTactical' | 'reloadEmpty' | 'fire',
    forceRestart = false,
  ): void {
    const nextClip = this.visualDef.clips[clipName];
    if (!nextClip) return;

    if (this.currentClip.name === clipName && !forceRestart && this.isLooping) {
      return;
    }

    this.currentClip = nextClip;
    this.clipTime = 0;
    this.isLooping = clipName === 'idle';
    this.firedEvents.clear();
  }

  public getCurrentClipName(): string {
    return this.currentClip.name;
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
    this.weaponGroup.updateMatrix();

    // 7. Update arms rig IK in viewmodel space (transformed by weapon group matrix)
    this.scratchLeftPos.copy(this.interpolatedLeftHandPos).applyMatrix4(this.weaponGroup.matrix);
    this.scratchRightPos.copy(this.interpolatedRightHandPos).applyMatrix4(this.weaponGroup.matrix);

    this.armsRig.updateIK(
      this.scratchLeftPos,
      this.interpolatedLeftHandRot,
      this.scratchRightPos,
      this.interpolatedRightHandRot,
    );

    // 8. Update dropped physics magazines
    if (scene && this.droppedMags.length > 0) {
      const gravity = -9.8;
      for (let i = this.droppedMags.length - 1; i >= 0; i--) {
        const item = this.droppedMags[i]!;
        item.life += dt;
        item.velocity.y += gravity * dt;
        item.mesh.position.addScaledVector(item.velocity, dt);
        item.mesh.rotation.x += item.rotVel.x * dt;
        item.mesh.rotation.y += item.rotVel.y * dt;
        item.mesh.rotation.z += item.rotVel.z * dt;

        // Clean up after 2.5 seconds
        if (item.life > 2.5) {
          scene.remove(item.mesh);
          this.droppedMags.splice(i, 1);
        }
      }
    }
  }

  private handleAnimationEvent(ev: TimedAnimationEvent, scene?: THREE.Scene): void {
    if (ev.type === 'mag_drop' && scene) {
      // Spawn physically falling empty magazine
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

    // Find bounding keyframes
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
    // Smooth cosine blending
    const smoothAlpha = 0.5 - 0.5 * Math.cos(alpha * Math.PI);

    this.interpolatedLeftHandPos.lerpVectors(k0.leftHand.pos, k1.leftHand.pos, smoothAlpha);
    this.lerpEuler(this.interpolatedLeftHandRot, k0.leftHand.rot, k1.leftHand.rot, smoothAlpha);

    this.interpolatedRightHandPos.lerpVectors(k0.rightHand.pos, k1.rightHand.pos, smoothAlpha);
    this.lerpEuler(this.interpolatedRightHandRot, k0.rightHand.rot, k1.rightHand.rot, smoothAlpha);

    this.interpolatedMagOffset.lerpVectors(k0.magOffset, k1.magOffset, smoothAlpha);
    this.interpolatedMagAttached = k1.magAttached;

    this.interpolatedBoltOffset.lerpVectors(k0.boltOffset, k1.boltOffset, smoothAlpha);

    this.interpolatedWeaponPos.lerpVectors(k0.weaponPosOffset, k1.weaponPosOffset, smoothAlpha);
    this.lerpEuler(this.interpolatedWeaponRot, k0.weaponRotOffset, k1.weaponRotOffset, smoothAlpha);
  }

  private copyKeyframe(kf: WeaponKeyframe): void {
    this.interpolatedLeftHandPos.copy(kf.leftHand.pos);
    this.interpolatedLeftHandRot.copy(kf.leftHand.rot);
    this.interpolatedRightHandPos.copy(kf.rightHand.pos);
    this.interpolatedRightHandRot.copy(kf.rightHand.rot);
    this.interpolatedMagOffset.copy(kf.magOffset);
    this.interpolatedMagAttached = kf.magAttached;
    this.interpolatedBoltOffset.copy(kf.boltOffset);
    this.interpolatedWeaponPos.copy(kf.weaponPosOffset);
    this.interpolatedWeaponRot.copy(kf.weaponRotOffset);
  }

  private lerpEuler(out: THREE.Euler, a: THREE.Euler, b: THREE.Euler, t: number): void {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
  }
}
