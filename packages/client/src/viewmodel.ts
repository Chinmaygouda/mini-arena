import * as THREE from 'three';
import { HitboxPart, Vec3, WeaponActionState, WeaponDef } from '@mini-arena/shared';
import { FirstPersonArmsRig } from './animation/armsRig';
import { createAssaultRifleVisualDef } from './animation/assaultRifleDef';
import { WeaponVisualDef } from './animation/types';
import { WeaponAnimator } from './animation/weaponAnimator';

export interface Tracer {
  mesh: THREE.Line;
  lifetime: number;
  maxLifetime: number;
}

export class WeaponViewmodel {
  public group: THREE.Group;
  public gunMesh: THREE.Mesh; // Placeholder fallback for other weapons
  public armsRig: FirstPersonArmsRig;
  public animator: WeaponAnimator;
  public currentVisualDef: WeaponVisualDef;

  private camera: THREE.Camera;
  private scene: THREE.Scene;

  // Viewmodel position offsets
  private hipPos = new THREE.Vector3(0.13, -0.16, -0.32);
  private adsPos = new THREE.Vector3(0.0, -0.085, -0.22); // Perfectly centers optical holographic reticle
  private currentPos = new THREE.Vector3().copy(this.hipPos);

  // Procedural recoil kick spring
  private recoilOffsetZ = 0;
  private recoilPitch = 0;

  // Tracers
  private tracers: Tracer[] = [];

  // Triangle count for performance budgeting
  public totalTriangles = 0;

  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;

    this.group = new THREE.Group();
    this.group.name = 'Viewmodel_Root';
    this.camera.add(this.group);

    // 1. First-Person Rigged Arms
    this.armsRig = new FirstPersonArmsRig();
    this.group.add(this.armsRig.group);
    this.totalTriangles += this.armsRig.totalTriangles;

    // 2. Assault Rifle Vertical Slice Visual Def & Animator
    this.currentVisualDef = createAssaultRifleVisualDef();
    this.animator = new WeaponAnimator(this.currentVisualDef, this.armsRig);
    this.group.add(this.animator.weaponGroup);

    // Count AR triangles
    this.countTriangles(this.animator.weaponGroup);

    // 3. Placeholder box viewmodel for weapons not yet in Phase 3 vertical slice
    const gunGeom = new THREE.BoxGeometry(0.07, 0.1, 0.45);
    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.3,
      metalness: 0.8,
    });
    this.gunMesh = new THREE.Mesh(gunGeom, gunMat);
    this.gunMesh.position.set(0, 0, -0.15);
    this.group.add(this.gunMesh);
    this.gunMesh.visible = false; // AR is active by default
  }

  private countTriangles(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry.index) {
          this.totalTriangles += mesh.geometry.index.count / 3;
        } else if (mesh.geometry.attributes.position) {
          this.totalTriangles += mesh.geometry.attributes.position.count / 3;
        }
      }
    });
  }

  public updateWeaponVisual(weapon: WeaponDef): void {
    if (weapon.id === 'assault_rifle') {
      this.gunMesh.visible = false;
      this.animator.weaponGroup.visible = true;
      this.armsRig.group.visible = true;
    } else {
      // Fallback for non-vertical slice weapons until Phase 3 asset review
      this.gunMesh.visible = true;
      this.animator.weaponGroup.visible = false;
      this.armsRig.group.visible = false;

      switch (weapon.id) {
        case 'pistol':
          this.gunMesh.scale.set(0.8, 0.9, 0.6);
          (this.gunMesh.material as THREE.MeshStandardMaterial).color.setHex(0x334155);
          break;
        case 'smg':
          this.gunMesh.scale.set(0.9, 1.0, 0.8);
          (this.gunMesh.material as THREE.MeshStandardMaterial).color.setHex(0x0f766e);
          break;
        case 'shotgun':
          this.gunMesh.scale.set(1.3, 1.2, 1.1);
          (this.gunMesh.material as THREE.MeshStandardMaterial).color.setHex(0xb45309);
          break;
        case 'sniper':
          this.gunMesh.scale.set(0.8, 1.1, 1.6);
          (this.gunMesh.material as THREE.MeshStandardMaterial).color.setHex(0x1e1b4b);
          break;
      }
    }
  }

  public playClip(
    clipName: 'idle' | 'draw' | 'inspect' | 'reloadTactical' | 'reloadEmpty' | 'fire',
    forceRestart = false,
  ): void {
    this.animator.playClip(clipName, forceRestart);
  }

  public applyRecoilKick(pitchKick: number): void {
    // Kick viewmodel back and tilt nose up
    this.recoilOffsetZ += 0.04;
    this.recoilPitch += pitchKick * 0.7;

    // Trigger weapon animator fire recoil clip
    this.animator.playClip('fire', true);
  }

  public update(dt: number, isAds: boolean, actionState?: WeaponActionState): void {
    // 1. Sync animator with shared weapon action state
    if (actionState) {
      if (actionState === 'reloading_tactical') {
        this.animator.playClip('reloadTactical');
      } else if (actionState === 'reloading_empty') {
        this.animator.playClip('reloadEmpty');
      } else if (actionState === 'swapping_in') {
        this.animator.playClip('draw');
      }
    }

    // 2. Step the weapon animator, arms IK, and dropping magazine physics
    this.animator.update(dt, this.scene);

    // 3. Lerp between hip and ADS position
    const targetPos = isAds ? this.adsPos : this.hipPos;
    const lerpSpeed = isAds ? 16.0 : 12.0;
    this.currentPos.lerp(targetPos, Math.min(1.0, dt * lerpSpeed));

    // 4. Recover procedural recoil springs smoothly
    this.recoilOffsetZ = Math.max(0, this.recoilOffsetZ - dt * 0.35);
    this.recoilPitch = Math.max(0, this.recoilPitch - dt * 2.2);

    // Apply combined positioning to viewmodel group
    this.group.position.copy(this.currentPos);
    this.group.position.z += this.recoilOffsetZ;
    this.group.rotation.x = this.recoilPitch;

    // 5. Update bullet tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i]!;
      tracer.lifetime += dt;
      if (tracer.lifetime >= tracer.maxLifetime) {
        this.scene.remove(tracer.mesh);
        tracer.mesh.geometry.dispose();
        (tracer.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  public spawnTracer(fromPos: Vec3, toPos: Vec3): void {
    const points = [
      new THREE.Vector3(fromPos.x, fromPos.y, fromPos.z),
      new THREE.Vector3(toPos.x, toPos.y, toPos.z),
    ];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      linewidth: 2,
    });
    const line = new THREE.Line(geom, mat);
    this.scene.add(line);

    this.tracers.push({
      mesh: line,
      lifetime: 0,
      maxLifetime: 0.08, // 80ms duration
    });
  }

  public getMuzzleWorldPosition(): Vec3 {
    const muzzle = this.currentVisualDef.muzzleOffset.clone();
    this.animator.weaponGroup.localToWorld(muzzle);
    return { x: muzzle.x, y: muzzle.y, z: muzzle.z };
  }
}

/**
 * Triggers visual hit marker on the HUD crosshair.
 */
export function triggerHitMarker(part: HitboxPart | null, damage: number): void {
  const crosshair = document.getElementById('crosshair');
  const hitLog = document.getElementById('hud-hitlog');
  if (!crosshair) return;

  const isHeadshot = part === 'head';
  crosshair.style.boxShadow = isHeadshot ? '0 0 16px #ef4444' : '0 0 10px #ffffff';
  crosshair.style.background = isHeadshot ? '#ef4444' : '#ffffff';
  crosshair.style.transform = isHeadshot
    ? 'translate(-50%, -50%) scale(2.2)'
    : 'translate(-50%, -50%) scale(1.6)';

  if (hitLog) {
    hitLog.textContent = isHeadshot
      ? `HEADSHOT! -${damage}`
      : `HIT -${damage}`;
    hitLog.style.color = isHeadshot ? '#ef4444' : '#fef08a';
    hitLog.style.opacity = '1';
  }

  setTimeout(() => {
    crosshair.style.boxShadow = '0 0 6px #38bdf8';
    crosshair.style.background = '#38bdf8';
    crosshair.style.transform = 'translate(-50%, -50%) scale(1.0)';
    if (hitLog) {
      hitLog.style.opacity = '0';
    }
  }, 120);
}
