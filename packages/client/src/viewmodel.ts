import * as THREE from 'three';
import { HitboxPart, Vec3, WeaponDef } from '@mini-arena/shared';

export interface Tracer {
  mesh: THREE.Line;
  lifetime: number;
  maxLifetime: number;
}

export class WeaponViewmodel {
  public group: THREE.Group;
  public gunMesh: THREE.Mesh;
  private camera: THREE.Camera;

  // Viewmodel position offsets
  private hipPos = new THREE.Vector3(0.18, -0.2, -0.38);
  private adsPos = new THREE.Vector3(0.0, -0.14, -0.3);
  private currentPos = new THREE.Vector3().copy(this.hipPos);

  // Procedural recoil kick spring
  private recoilOffsetZ = 0;
  private recoilPitch = 0;

  // Tracers
  private tracers: Tracer[] = [];
  private scene: THREE.Scene;

  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;

    this.group = new THREE.Group();
    this.camera.add(this.group);

    // Placeholder box viewmodel (Phase 2 placeholder; full rig is Phase 3)
    const gunGeom = new THREE.BoxGeometry(0.07, 0.1, 0.45);
    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.3,
      metalness: 0.8,
    });
    this.gunMesh = new THREE.Mesh(gunGeom, gunMat);
    // Align receiver forward along -Z
    this.gunMesh.position.set(0, 0, -0.15);
    this.group.add(this.gunMesh);

    // Front sight post
    const sightGeom = new THREE.BoxGeometry(0.015, 0.03, 0.02);
    const sightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const sightMesh = new THREE.Mesh(sightGeom, sightMat);
    sightMesh.position.set(0, 0.065, -0.32);
    this.group.add(sightMesh);
  }

  public updateWeaponVisual(weapon: WeaponDef): void {
    // Scale or tint placeholder box to represent weapon category
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
      case 'assault_rifle':
      default:
        this.gunMesh.scale.set(1.0, 1.0, 1.0);
        (this.gunMesh.material as THREE.MeshStandardMaterial).color.setHex(0x1e293b);
        break;
    }
  }

  public applyRecoilKick(pitchKick: number): void {
    // Kick viewmodel back and tilt nose up
    this.recoilOffsetZ += 0.05;
    this.recoilPitch += pitchKick * 0.8;
  }

  public update(dt: number, isAds: boolean): void {
    // 1. Lerp between hip and ADS position
    const targetPos = isAds ? this.adsPos : this.hipPos;
    const lerpSpeed = isAds ? 16.0 : 12.0;
    this.currentPos.lerp(targetPos, Math.min(1.0, dt * lerpSpeed));

    // 2. Recover recoil springs smoothly
    this.recoilOffsetZ = Math.max(0, this.recoilOffsetZ - dt * 0.4);
    this.recoilPitch = Math.max(0, this.recoilPitch - dt * 2.5);

    // Apply to viewmodel group
    this.group.position.copy(this.currentPos);
    this.group.position.z += this.recoilOffsetZ;
    this.group.rotation.x = this.recoilPitch;

    // 3. Update bullet tracers
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
    const muzzle = new THREE.Vector3(0, 0, -0.4);
    this.group.localToWorld(muzzle);
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
