import * as THREE from 'three';
import { Vec3 } from '@mini-arena/shared';
import { SurfaceType } from './types';

const MAX_BULLET_HOLES = 128;
const MAX_BLAST_SCORCHES = 32;

// Preallocated scratch variables for zero-allocation placement
const _scratchPos = new THREE.Vector3();
const _scratchNormal = new THREE.Vector3();
const _scratchUp = new THREE.Vector3();
const _scratchRight = new THREE.Vector3();
const _scratchForward = new THREE.Vector3();
const _scratchRotMat = new THREE.Matrix4();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();
const _scratchMatrix = new THREE.Matrix4();

function createDecalTexture(isBlast: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = isBlast ? 256 : 64;
  canvas.height = isBlast ? 256 : 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    if (isBlast) {
      // Blast scorch: jagged dark center with fiery ring and soot falloff
      const grad = ctx.createRadialGradient(cx, cy, cx * 0.05, cx, cy, cx);
      grad.addColorStop(0.0, 'rgba(10, 10, 12, 0.95)');
      grad.addColorStop(0.3, 'rgba(25, 20, 18, 0.85)');
      grad.addColorStop(0.65, 'rgba(40, 35, 30, 0.45)');
      grad.addColorStop(0.85, 'rgba(60, 50, 40, 0.15)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, cx, 0, Math.PI * 2);
      ctx.fill();

      // Jagged perimeter shrapnel marks
      ctx.fillStyle = 'rgba(15, 12, 10, 0.7)';
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 + (Math.sin(i * 9) * 0.2);
        const rad = cx * (0.4 + (Math.cos(i * 13) + 1) * 0.25);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad, cx * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Bullet hole: dark puncture core with powdered gray/black lead ring
      const grad = ctx.createRadialGradient(cx, cy, cx * 0.15, cx, cy, cx);
      grad.addColorStop(0.0, 'rgba(5, 5, 5, 1.0)');
      grad.addColorStop(0.35, 'rgba(20, 20, 20, 0.9)');
      grad.addColorStop(0.7, 'rgba(50, 50, 50, 0.4)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, cx, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

export class DecalManager {
  public group: THREE.Group;

  private bulletMesh: THREE.InstancedMesh;
  private blastMesh: THREE.InstancedMesh;

  private bulletTexture: THREE.CanvasTexture;
  private blastTexture: THREE.CanvasTexture;

  private bulletGeom: THREE.PlaneGeometry;
  private blastGeom: THREE.PlaneGeometry;

  private bulletMat: THREE.MeshBasicMaterial;
  private blastMat: THREE.MeshBasicMaterial;

  private bulletIndex = 0;
  private blastIndex = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'DecalManager_Group';

    this.bulletTexture = createDecalTexture(false);
    this.blastTexture = createDecalTexture(true);

    this.bulletGeom = new THREE.PlaneGeometry(0.08, 0.08);
    this.blastGeom = new THREE.PlaneGeometry(3.2, 3.2);

    this.bulletMat = new THREE.MeshBasicMaterial({
      map: this.bulletTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -2.0,
    });

    this.blastMat = new THREE.MeshBasicMaterial({
      map: this.blastTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.5,
      polygonOffsetUnits: -1.5,
    });

    this.bulletMesh = new THREE.InstancedMesh(this.bulletGeom, this.bulletMat, MAX_BULLET_HOLES);
    this.bulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bulletMesh.frustumCulled = false;

    this.blastMesh = new THREE.InstancedMesh(this.blastGeom, this.blastMat, MAX_BLAST_SCORCHES);
    this.blastMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blastMesh.frustumCulled = false;

    // Initialize all instances off-screen (scale = 0)
    _scratchMatrix.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_BULLET_HOLES; i++) {
      this.bulletMesh.setMatrixAt(i, _scratchMatrix);
    }
    for (let i = 0; i < MAX_BLAST_SCORCHES; i++) {
      this.blastMesh.setMatrixAt(i, _scratchMatrix);
    }
    this.bulletMesh.instanceMatrix.needsUpdate = true;
    this.blastMesh.instanceMatrix.needsUpdate = true;

    this.group.add(this.bulletMesh);
    this.group.add(this.blastMesh);
    scene.add(this.group);
  }

  /**
   * Adds a bullet hole decal at contact point oriented along surface normal.
   * Zero heap allocations: recycles FIFO ring buffer.
   */
  public addBulletHole(
    pos: Vec3,
    normal: Vec3,
    surface: SurfaceType = 'concrete',
  ): void {
    _scratchPos.set(
      pos.x + normal.x * 0.002,
      pos.y + normal.y * 0.002,
      pos.z + normal.z * 0.002,
    );

    _scratchNormal.set(normal.x, normal.y, normal.z).normalize();

    // Construct orthonormal basis facing away from surface along normal
    if (Math.abs(_scratchNormal.y) > 0.92) {
      _scratchUp.set(0, 0, 1);
    } else {
      _scratchUp.set(0, 1, 0);
    }
    _scratchRight.crossVectors(_scratchUp, _scratchNormal).normalize();
    _scratchForward.crossVectors(_scratchNormal, _scratchRight).normalize();

    _scratchRotMat.makeBasis(_scratchRight, _scratchForward, _scratchNormal);
    _scratchQuat.setFromRotationMatrix(_scratchRotMat);

    // Subtle scale variance per surface
    let scale = 1.0;
    if (surface === 'wood') scale = 1.25;
    else if (surface === 'metal') scale = 0.85;

    _scratchScale.set(scale, scale, scale);
    _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);

    this.bulletMesh.setMatrixAt(this.bulletIndex, _scratchMatrix);
    this.bulletIndex = (this.bulletIndex + 1) % MAX_BULLET_HOLES;
    this.bulletMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Adds a blast scorch decal on ground or wall after an explosion.
   * Zero heap allocations: recycles FIFO ring buffer.
   */
  public addBlastScorch(pos: Vec3, normal: Vec3, radius = 2.4): void {
    _scratchPos.set(
      pos.x + normal.x * 0.003,
      pos.y + normal.y * 0.003,
      pos.z + normal.z * 0.003,
    );

    _scratchNormal.set(normal.x, normal.y, normal.z).normalize();

    if (Math.abs(_scratchNormal.y) > 0.92) {
      _scratchUp.set(0, 0, 1);
    } else {
      _scratchUp.set(0, 1, 0);
    }
    _scratchRight.crossVectors(_scratchUp, _scratchNormal).normalize();
    _scratchForward.crossVectors(_scratchNormal, _scratchRight).normalize();

    _scratchRotMat.makeBasis(_scratchRight, _scratchForward, _scratchNormal);
    _scratchQuat.setFromRotationMatrix(_scratchRotMat);

    const s = radius / 1.6;
    _scratchScale.set(s, s, s);
    _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);

    this.blastMesh.setMatrixAt(this.blastIndex, _scratchMatrix);
    this.blastIndex = (this.blastIndex + 1) % MAX_BLAST_SCORCHES;
    this.blastMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Disposes all textures, materials, and geometries to prevent memory leaks.
   */
  public dispose(): void {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    this.bulletGeom.dispose();
    this.blastGeom.dispose();
    this.bulletMat.dispose();
    this.blastMat.dispose();
    this.bulletTexture.dispose();
    this.blastTexture.dispose();
  }
}
