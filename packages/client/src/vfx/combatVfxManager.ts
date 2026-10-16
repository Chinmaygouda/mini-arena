import * as THREE from 'three';
import { Vec3, WeaponId } from '@mini-arena/shared';
import { SurfaceType } from './types';

const MAX_SHELLS = 32;
const MAX_PARTICLES = 256;

interface PooledShell {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  rotVel: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
  active: boolean;
  bounces: number;
}

interface ParticleState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  baseScale: number;
  lifetime: number;
  maxLifetime: number;
  active: boolean;
  color: THREE.Color;
}

const _scratchMat4 = new THREE.Matrix4();
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();

export class CombatVfxManager {
  public group: THREE.Group;

  // 1. Shell Ejection Pool
  private shellPool: PooledShell[] = [];
  private shellGeomRifle: THREE.CylinderGeometry;
  private shellGeomShotgun: THREE.CylinderGeometry;
  private shellMatBrass: THREE.MeshStandardMaterial;
  private shellMatShotgun: THREE.MeshStandardMaterial;

  // 2. Instanced Surface Impact Particles
  private particleMesh: THREE.InstancedMesh;
  private particleGeom: THREE.BoxGeometry;
  private particleMat: THREE.MeshBasicMaterial;
  private particles: ParticleState[] = [];
  private nextParticleIndex = 0;

  // 3. Camera Trauma Shake
  private trauma = 0.0;
  private traumaDecay = 1.8; // decays in ~0.55s
  private shakeTime = 0.0;
  public shakePitch = 0.0;
  public shakeYaw = 0.0;
  public shakeRoll = 0.0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'CombatVfxManager_Group';

    // Shell geometries & materials
    this.shellGeomRifle = new THREE.CylinderGeometry(0.005, 0.005, 0.024, 6);
    this.shellGeomShotgun = new THREE.CylinderGeometry(0.010, 0.010, 0.040, 8);

    this.shellMatBrass = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Polished brass
      metalness: 0.85,
      roughness: 0.25,
    });

    this.shellMatShotgun = new THREE.MeshStandardMaterial({
      color: 0xcc2222, // Red plastic shell casing with brass rim
      metalness: 0.2,
      roughness: 0.6,
    });

    // Initialize 32 pooled shell meshes
    for (let i = 0; i < MAX_SHELLS; i++) {
      const isShotgun = i >= 24;
      const mesh = new THREE.Mesh(
        isShotgun ? this.shellGeomShotgun : this.shellGeomRifle,
        isShotgun ? this.shellMatShotgun : this.shellMatBrass,
      );
      mesh.visible = false;
      this.group.add(mesh);

      this.shellPool.push({
        mesh,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        rotVel: new THREE.Vector3(),
        lifetime: 0,
        maxLifetime: 3.5,
        active: false,
        bounces: 0,
      });
    }

    // Instanced impact particle system
    this.particleGeom = new THREE.BoxGeometry(0.03, 0.03, 0.03);
    this.particleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });

    this.particleMesh = new THREE.InstancedMesh(this.particleGeom, this.particleMat, MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;

    _scratchMat4.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particleMesh.setMatrixAt(i, _scratchMat4);
      this.particles.push({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        scale: 0,
        baseScale: 1.0,
        lifetime: 0,
        maxLifetime: 0.4,
        active: false,
        color: new THREE.Color(),
      });
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.particleMesh);

    scene.add(this.group);
  }

  /**
   * Spawns an ejected cartridge casing with authentic ballistic motion and spin.
   */
  public spawnShell(ejectionPos: Vec3, weaponId: WeaponId, lookYaw: number, lookPitch: number): void {
    let shell = this.shellPool.find((s) => !s.active);
    if (!shell) {
      shell = this.shellPool.reduce((oldest, s) => (s.lifetime > oldest.lifetime ? s : oldest), this.shellPool[0]!);
    }

    const isShotgun = weaponId === 'shotgun';
    shell.mesh.geometry = isShotgun ? this.shellGeomShotgun : this.shellGeomRifle;
    shell.mesh.material = isShotgun ? this.shellMatShotgun : this.shellMatBrass;

    shell.pos.set(ejectionPos.x, ejectionPos.y, ejectionPos.z);
    shell.mesh.position.copy(shell.pos);

    // Eject to the right and slightly upward/backward relative to player yaw
    const rightX = Math.cos(lookYaw);
    const rightZ = -Math.sin(lookYaw);
    const forwardX = -Math.sin(lookYaw);
    const forwardZ = -Math.cos(lookYaw);

    const ejectSpeed = isShotgun ? 2.2 : 3.0;
    shell.vel.set(
      rightX * ejectSpeed + forwardX * (Math.random() * 0.4 - 0.2),
      1.8 + Math.random() * 0.8,
      rightZ * ejectSpeed + forwardZ * (Math.random() * 0.4 - 0.2),
    );

    shell.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    shell.rotVel.set(
      (Math.random() - 0.5) * 35,
      (Math.random() - 0.5) * 35,
      (Math.random() - 0.5) * 35,
    );

    shell.lifetime = 0;
    shell.maxLifetime = 3.5;
    shell.active = true;
    shell.bounces = 0;
    shell.mesh.visible = true;
  }

  /**
   * Spawns surface-specific impact particles (sparks, dust puffs, splinters).
   */
  public spawnImpactParticles(hitPos: Vec3, normal: Vec3, surface: SurfaceType = 'concrete'): void {
    const count = surface === 'metal' ? 8 : surface === 'wood' ? 6 : 5;

    for (let c = 0; c < count; c++) {
      const p = this.particles[this.nextParticleIndex]!;
      this.nextParticleIndex = (this.nextParticleIndex + 1) % MAX_PARTICLES;

      p.pos.set(
        hitPos.x + normal.x * 0.02 + (Math.random() - 0.5) * 0.04,
        hitPos.y + normal.y * 0.02 + (Math.random() - 0.5) * 0.04,
        hitPos.z + normal.z * 0.02 + (Math.random() - 0.5) * 0.04,
      );

      // Reflect outwards with conical spread
      const spreadX = (Math.random() - 0.5) * 2.5;
      const spreadY = (Math.random() - 0.5) * 2.5;
      const spreadZ = (Math.random() - 0.5) * 2.5;

      const speed = surface === 'metal' ? 4.5 + Math.random() * 3.0 : 1.8 + Math.random() * 1.5;

      p.vel.set(
        normal.x * speed + spreadX,
        normal.y * speed + spreadY + (surface === 'concrete' ? 0.8 : 0),
        normal.z * speed + spreadZ,
      );

      p.baseScale = surface === 'concrete' ? 1.5 : surface === 'wood' ? 0.9 : 0.6;
      p.scale = p.baseScale;
      p.lifetime = 0;
      p.maxLifetime = surface === 'concrete' ? 0.45 : 0.25;
      p.active = true;

      // Surface coloring
      if (surface === 'metal') {
        p.color.setHex(0xfef08a); // Bright yellow spark
      } else if (surface === 'wood') {
        p.color.setHex(0xb45309); // Wood brown splinter
      } else {
        p.color.setHex(0xd4d4d8); // Concrete gray dust
      }
    }
  }

  /**
   * Adds camera trauma for screenshake (e.g. 0.25 for rifle fire, 0.75 for close frag blast).
   */
  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  /**
   * Updates all cosmetic physical simulations (zero heap allocations).
   */
  public update(dt: number): void {
    // 1. Update shell physics
    for (let i = 0; i < this.shellPool.length; i++) {
      const shell = this.shellPool[i]!;
      if (!shell.active) continue;

      shell.lifetime += dt;
      if (shell.lifetime >= shell.maxLifetime) {
        shell.active = false;
        shell.mesh.visible = false;
        continue;
      }

      // Gravity
      shell.vel.y -= 9.8 * dt;

      shell.pos.x += shell.vel.x * dt;
      shell.pos.y += shell.vel.y * dt;
      shell.pos.z += shell.vel.z * dt;

      shell.rot.x += shell.rotVel.x * dt;
      shell.rot.y += shell.rotVel.y * dt;
      shell.rot.z += shell.rotVel.z * dt;

      // Floor collision at ground plane y = 0.015
      if (shell.pos.y <= 0.015) {
        shell.pos.y = 0.015;
        shell.bounces++;
        if (shell.bounces < 3) {
          shell.vel.y = -shell.vel.y * 0.38; // Rebound
          shell.vel.x *= 0.72; // Tangential friction
          shell.vel.z *= 0.72;
          shell.rotVel.multiplyScalar(0.6);
        } else {
          // Rest on floor
          shell.vel.set(0, 0, 0);
          shell.rotVel.set(0, 0, 0);
        }
      }

      shell.mesh.position.copy(shell.pos);
      shell.mesh.rotation.copy(shell.rot);
    }

    // 2. Update instanced impact particles
    let particlesUpdated = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i]!;
      if (!p.active) continue;

      p.lifetime += dt;
      if (p.lifetime >= p.maxLifetime) {
        p.active = false;
        _scratchMat4.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _scratchMat4);
        particlesUpdated = true;
        continue;
      }

      // Air drag & gravity
      p.vel.y -= 5.0 * dt;
      p.vel.multiplyScalar(Math.max(0, 1.0 - 4.0 * dt));

      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;

      const progress = p.lifetime / p.maxLifetime;
      p.scale = p.baseScale * (1.0 - progress);

      _scratchPos.copy(p.pos);
      _scratchQuat.identity();
      _scratchScale.set(p.scale, p.scale, p.scale);
      _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);

      this.particleMesh.setMatrixAt(i, _scratchMat4);
      particlesUpdated = true;
    }

    if (particlesUpdated) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }

    // 3. Update trauma shake
    if (this.trauma > 0) {
      this.shakeTime += dt * 45;
      const shake = this.trauma * this.trauma; // Quadratic shake response

      // Deterministic smooth multi-frequency harmonic noise
      this.shakePitch = (Math.sin(this.shakeTime * 1.1) + Math.sin(this.shakeTime * 2.3) * 0.5) * 0.045 * shake;
      this.shakeYaw = (Math.cos(this.shakeTime * 0.9) + Math.cos(this.shakeTime * 1.9) * 0.5) * 0.035 * shake;
      this.shakeRoll = (Math.sin(this.shakeTime * 1.5) * 0.03) * shake;

      this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
    } else {
      this.shakePitch = 0;
      this.shakeYaw = 0;
      this.shakeRoll = 0;
    }
  }

  /**
   * Clean disposal of all geometries and materials.
   */
  public dispose(): void {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    this.shellGeomRifle.dispose();
    this.shellGeomShotgun.dispose();
    this.shellMatBrass.dispose();
    this.shellMatShotgun.dispose();
    this.particleGeom.dispose();
    this.particleMat.dispose();
  }
}
