import * as THREE from 'three';
import {
  ActiveGrenade,
  ActiveSmokeVolume,
  calculateFlashBlindness,
  calculateFragBlast,
  createGrenadeProjectile,
  cycleGrenadeType,
  GRENADE_DEFS,
  GrenadeInventory,
  GrenadeType,
  HitTarget,
  IGrenadeCollisionWorld,
  INITIAL_GRENADE_INVENTORY,
  startGrenadeWindUp,
  stepGrenadePhysics,
  stepGrenadeWindUp,
  ThrowActionState,
  Vec3,
} from '@mini-arena/shared';
import { CombatVfxManager } from './combatVfxManager';
import { DecalManager } from './decalManager';

const MAX_ACTIVE_GRENADES = 16;
const MAX_ACTIVE_SMOKES = 8;
const MAX_SMOKE_PUFFS_PER_VOLUME = 48;

interface VisualGrenade {
  activeGrenade: ActiveGrenade | null;
  mesh: THREE.Group;
  bodyMesh: THREE.Mesh;
  type: GrenadeType;
}

interface VisualBlastEffect {
  pos: THREE.Vector3;
  fireballMesh: THREE.Mesh;
  shockwaveMesh: THREE.Mesh;
  light: THREE.PointLight;
  lifetime: number;
  maxLifetime: number;
  active: boolean;
}

interface VisualSmokeCloud {
  volume: ActiveSmokeVolume;
  instancedMesh: THREE.InstancedMesh;
  puffPositions: THREE.Vector3[];
  puffVelocities: THREE.Vector3[];
  puffScales: number[];
  puffBaseScales: number[];
  active: boolean;
}

const _scratchMat4 = new THREE.Matrix4();
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();

export class GrenadeClientManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public collisionWorld: IGrenadeCollisionWorld;
  public decalManager: DecalManager;
  public combatVfx: CombatVfxManager;

  public inventory: GrenadeInventory;
  public windUpState: ThrowActionState | null = null;
  public activeGrenades: ActiveGrenade[] = [];
  public activeSmokeVolumes: ActiveSmokeVolume[] = [];

  public onAudioEvent?: (eventName: string, pos?: Vec3) => void;

  private grenadeMeshes: VisualGrenade[] = [];
  private blastPool: VisualBlastEffect[] = [];
  private smokeClouds: VisualSmokeCloud[] = [];

  // Geometries and materials for disposal
  private fragGeom: THREE.SphereGeometry;
  private flashGeom: THREE.CylinderGeometry;
  private smokeGeom: THREE.CylinderGeometry;
  private fragMat: THREE.MeshStandardMaterial;
  private flashMat: THREE.MeshStandardMaterial;
  private smokeMat: THREE.MeshStandardMaterial;

  private fireballGeom: THREE.SphereGeometry;
  private fireballMat: THREE.MeshBasicMaterial;
  private shockwaveGeom: THREE.RingGeometry;
  private shockwaveMat: THREE.MeshBasicMaterial;

  private smokePuffGeom: THREE.PlaneGeometry;
  private smokePuffMat: THREE.MeshBasicMaterial;

  // Flashbang screen effect
  private flashOverlayEl: HTMLElement | null = null;
  private flashIntensity = 0.0;
  private nextGrenadeId = 1;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    collisionWorld: IGrenadeCollisionWorld,
    decalManager: DecalManager,
    combatVfx: CombatVfxManager,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.collisionWorld = collisionWorld;
    this.decalManager = decalManager;
    this.combatVfx = combatVfx;
    this.inventory = {
      counts: { ...INITIAL_GRENADE_INVENTORY.counts },
      selectedType: INITIAL_GRENADE_INVENTORY.selectedType,
      cooldownRemaining: 0,
    };

    this.flashOverlayEl = document.getElementById('flashbang-overlay');
    if (!this.flashOverlayEl) {
      const el = document.createElement('div');
      el.id = 'flashbang-overlay';
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.width = '100vw';
      el.style.height = '100vh';
      el.style.pointerEvents = 'none';
      el.style.backgroundColor = '#ffffff';
      el.style.opacity = '0';
      el.style.zIndex = '9999';
      el.style.transition = 'opacity 0.05s linear';
      document.body.appendChild(el);
      this.flashOverlayEl = el;
    }

    // 1. Shared Geometries and Materials for Grenades
    this.fragGeom = new THREE.SphereGeometry(0.045, 12, 10);
    this.flashGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10);
    this.smokeGeom = new THREE.CylinderGeometry(0.040, 0.040, 0.14, 10);

    this.fragMat = new THREE.MeshStandardMaterial({
      color: 0x3f4a3c, // Tactical olive drab
      metalness: 0.75,
      roughness: 0.45,
    });

    this.flashMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Silver/chrome cylinder with blue band
      metalness: 0.9,
      roughness: 0.2,
    });

    this.smokeMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // Dark slate with white stripe
      metalness: 0.6,
      roughness: 0.5,
    });

    // 2. Preallocate pooled visual grenade meshes
    for (let i = 0; i < MAX_ACTIVE_GRENADES; i++) {
      const group = new THREE.Group();
      group.name = `VisualGrenade_${i}`;

      const bodyMesh = new THREE.Mesh(this.fragGeom, this.fragMat);
      bodyMesh.castShadow = true;
      group.add(bodyMesh);

      // Pin and spoon detail
      const spoonGeom = new THREE.BoxGeometry(0.015, 0.05, 0.005);
      const spoonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
      const spoon = new THREE.Mesh(spoonGeom, spoonMat);
      spoon.position.set(0.02, 0.03, 0);
      group.add(spoon);

      group.visible = false;
      this.scene.add(group);

      this.grenadeMeshes.push({
        activeGrenade: null,
        mesh: group,
        bodyMesh,
        type: 'frag',
      });
    }

    // 3. Preallocate Blast Effects (Fireball, Shockwave, PointLight)
    this.fireballGeom = new THREE.SphereGeometry(1.0, 16, 12);
    this.fireballMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });

    this.shockwaveGeom = new THREE.RingGeometry(0.1, 1.0, 24);
    this.shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (let i = 0; i < 4; i++) {
      const fb = new THREE.Mesh(this.fireballGeom, this.fireballMat);
      const sw = new THREE.Mesh(this.shockwaveGeom, this.shockwaveMat);
      sw.rotation.x = -Math.PI / 2; // Lie flat on ground

      const light = new THREE.PointLight(0xffaa22, 0, 16, 1.5);

      fb.visible = false;
      sw.visible = false;
      this.scene.add(fb);
      this.scene.add(sw);
      this.scene.add(light);

      this.blastPool.push({
        pos: new THREE.Vector3(),
        fireballMesh: fb,
        shockwaveMesh: sw,
        light,
        lifetime: 0,
        maxLifetime: 0.6,
        active: false,
      });
    }

    // 4. Preallocate Smoke Cloud Volumes (Instanced Puffs)
    this.smokePuffGeom = new THREE.PlaneGeometry(1.6, 1.6);
    this.smokePuffMat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < MAX_ACTIVE_SMOKES; i++) {
      const instMesh = new THREE.InstancedMesh(
        this.smokePuffGeom,
        this.smokePuffMat,
        MAX_SMOKE_PUFFS_PER_VOLUME,
      );
      instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instMesh.frustumCulled = false;
      instMesh.visible = false;
      this.scene.add(instMesh);

      const puffPositions: THREE.Vector3[] = [];
      const puffVelocities: THREE.Vector3[] = [];
      const puffScales: number[] = [];
      const puffBaseScales: number[] = [];

      for (let p = 0; p < MAX_SMOKE_PUFFS_PER_VOLUME; p++) {
        puffPositions.push(new THREE.Vector3());
        puffVelocities.push(new THREE.Vector3());
        puffScales.push(0);
        puffBaseScales.push(1.0 + Math.random() * 0.8);
      }

      this.smokeClouds.push({
        volume: { id: 0, center: { x: 0, y: 0, z: 0 }, radius: 5.5, durationRemaining: 0 },
        instancedMesh: instMesh,
        puffPositions,
        puffVelocities,
        puffScales,
        puffBaseScales,
        active: false,
      });
    }
  }

  /**
   * Cycles currently selected grenade type (T key).
   */
  public cycleType(): GrenadeType {
    const next = cycleGrenadeType(this.inventory);
    this.onAudioEvent?.('grenade_cycle');
    return next;
  }

  /**
   * Starts grenade throw wind-up (G key).
   */
  public requestThrow(): boolean {
    if (this.windUpState && this.windUpState.isWindingUp) {
      return false;
    }
    const windUp = startGrenadeWindUp(this.inventory);
    if (!windUp) {
      return false;
    }
    this.windUpState = windUp;
    this.onAudioEvent?.('grenade_pin_pull');
    return true;
  }

  /**
   * Advances the fixed simulation tick at 60 Hz.
   * Steps grenade physics, blast detonations, flashblindness, and smoke volume lifetimes.
   */
  public stepTick(
    eyePos: Vec3,
    lookYaw: number,
    lookPitch: number,
    isSprinting: boolean,
    isSwapping: boolean,
    targets: HitTarget[] = [],
  ): void {
    // 1. Step Inventory Cooldown
    if (this.inventory.cooldownRemaining > 0) {
      this.inventory.cooldownRemaining--;
    }

    // 2. Step Throw Wind-up State
    if (this.windUpState && this.windUpState.isWindingUp) {
      const res = stepGrenadeWindUp(this.windUpState, isSprinting, isSwapping);
      if (res.cancelled) {
        this.windUpState = null;
      } else if (res.released) {
        // Release grenade into the world!
        const type = this.windUpState.type;
        this.inventory.counts[type]--;
        this.inventory.cooldownRemaining = GRENADE_DEFS[type].cooldownTicks;

        const grenade = createGrenadeProjectile(
          this.nextGrenadeId++,
          type,
          'local_player',
          eyePos,
          lookYaw,
          lookPitch,
        );

        this.activeGrenades.push(grenade);
        this.windUpState = null;
        this.onAudioEvent?.('grenade_throw');
      }
    }

    // 3. Step Active Grenades Physics
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const grenade = this.activeGrenades[i]!;
      const simRes = stepGrenadePhysics(grenade, this.collisionWorld, 1 / 60);

      if (simRes.bounced) {
        this.onAudioEvent?.('grenade_bounce', grenade.pos);
      }

      if (simRes.detonated) {
        this.detonateGrenade(grenade, targets);
        this.activeGrenades.splice(i, 1);
      }
    }

    // 4. Step Active Smoke Volumes
    for (let i = this.activeSmokeVolumes.length - 1; i >= 0; i--) {
      const smoke = this.activeSmokeVolumes[i]!;
      smoke.durationRemaining--;
      if (smoke.durationRemaining <= 0) {
        this.activeSmokeVolumes.splice(i, 1);
      }
    }
  }

  /**
   * Triggers the appropriate explosion effect and shared damage/flash rules upon detonation.
   */
  private detonateGrenade(grenade: ActiveGrenade, targets: HitTarget[]): void {
    const pos = grenade.pos;

    if (grenade.type === 'frag') {
      // 1. Shrapnel Blast Damage via shared rules
      const blastResults = calculateFragBlast(pos, grenade.throwerId, targets, this.collisionWorld);
      for (const res of blastResults) {
        if (res.hasLineOfSight && res.damage > 0) {
          // Hit feedback
          this.onAudioEvent?.('hit_confirm', res.hitPoint);
        }
      }

      // 2. Visual Fireball & Shockwave
      this.triggerVisualBlast(pos);

      // 3. Ground Scorch Decal
      this.decalManager.addBlastScorch(pos, { x: 0, y: 1, z: 0 }, 2.4);

      // 4. Camera Trauma Screen Shake
      const dx = pos.x - this.camera.position.x;
      const dy = pos.y - this.camera.position.y;
      const dz = pos.z - this.camera.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 18.0) {
        const falloff = Math.max(0, 1.0 - dist / 18.0);
        this.combatVfx.addTrauma(falloff * 0.95);
      }

      this.onAudioEvent?.('grenade_frag_detonate', pos);
    } else if (grenade.type === 'flash') {
      // 1. Calculate local player flashblindness
      const lookDir = new THREE.Vector3();
      this.camera.getWorldDirection(lookDir);

      const flashRes = calculateFlashBlindness(
        pos,
        {
          id: 'local_player',
          eyePos: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
          lookDir: { x: lookDir.x, y: lookDir.y, z: lookDir.z },
        },
        this.collisionWorld,
      );

      if (flashRes.blindFraction > 0) {
        this.triggerFlashWhiteout(flashRes.blindFraction);
      }

      this.onAudioEvent?.('grenade_flash_detonate', pos);
    } else if (grenade.type === 'smoke') {
      // 1. Add shared smoke volume for LOS obstruction
      const smokeVol: ActiveSmokeVolume = {
        id: grenade.id,
        center: { x: pos.x, y: pos.y + 1.2, z: pos.z },
        radius: GRENADE_DEFS.smoke.smokeRadius,
        durationRemaining: GRENADE_DEFS.smoke.smokeDurationTicks,
      };
      this.activeSmokeVolumes.push(smokeVol);

      // 2. Start instanced billowing smoke cloud
      this.spawnSmokeCloud(smokeVol);
      this.onAudioEvent?.('grenade_smoke_detonate', pos);
    }
  }

  private triggerVisualBlast(pos: Vec3): void {
    let blast = this.blastPool.find((b) => !b.active);
    if (!blast) {
      blast = this.blastPool.reduce((oldest, b) => (b.lifetime > oldest.lifetime ? b : oldest), this.blastPool[0]!);
    }

    blast.pos.set(pos.x, pos.y, pos.z);
    blast.fireballMesh.position.copy(blast.pos);
    blast.shockwaveMesh.position.set(pos.x, pos.y + 0.02, pos.z);
    blast.light.position.set(pos.x, pos.y + 0.5, pos.z);

    blast.fireballMesh.scale.set(0.1, 0.1, 0.1);
    blast.shockwaveMesh.scale.set(0.1, 0.1, 0.1);
    blast.light.intensity = 18.0;

    blast.fireballMesh.visible = true;
    blast.shockwaveMesh.visible = true;
    blast.lifetime = 0;
    blast.active = true;
  }

  private triggerFlashWhiteout(intensity: number): void {
    this.flashIntensity = Math.min(1.0, this.flashIntensity + intensity);
    if (this.flashOverlayEl) {
      this.flashOverlayEl.style.opacity = `${this.flashIntensity}`;
    }
  }

  private spawnSmokeCloud(volume: ActiveSmokeVolume): void {
    let cloud = this.smokeClouds.find((c) => !c.active);
    if (!cloud) {
      cloud = this.smokeClouds[0]!;
    }

    cloud.volume = volume;
    cloud.active = true;
    cloud.instancedMesh.visible = true;

    // Distribute 48 billowing smoke puffs within a spherical cloud
    for (let p = 0; p < MAX_SMOKE_PUFFS_PER_VOLUME; p++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * (volume.radius * 0.85);

      const sinPhi = Math.sin(phi);
      cloud.puffPositions[p]!.set(
        volume.center.x + r * sinPhi * Math.cos(theta),
        volume.center.y + (r * sinPhi * Math.sin(theta)) * 0.65,
        volume.center.z + r * Math.cos(phi),
      );

      cloud.puffVelocities[p]!.set(
        (Math.random() - 0.5) * 0.25,
        0.15 + Math.random() * 0.2,
        (Math.random() - 0.5) * 0.25,
      );

      cloud.puffScales[p] = 0.2; // Start small and expand
    }
  }

  /**
   * Per-frame render update for visual animations and interpolation (zero allocations).
   */
  public update(dt: number): void {
    // 1. Update In-Flight Grenade Visual Meshes
    for (let i = 0; i < this.grenadeMeshes.length; i++) {
      const visual = this.grenadeMeshes[i]!;
      const grenade = this.activeGrenades[i];

      if (grenade) {
        visual.activeGrenade = grenade;
        visual.mesh.position.set(grenade.pos.x, grenade.pos.y, grenade.pos.z);

        // Spin along velocity vector
        if (!grenade.isAtRest) {
          visual.mesh.rotation.x += dt * (grenade.vel.z * 2.5);
          visual.mesh.rotation.z -= dt * (grenade.vel.x * 2.5);
        }

        // Configure geometry/material per type
        if (visual.type !== grenade.type) {
          visual.type = grenade.type;
          if (grenade.type === 'frag') {
            visual.bodyMesh.geometry = this.fragGeom;
            visual.bodyMesh.material = this.fragMat;
          } else if (grenade.type === 'flash') {
            visual.bodyMesh.geometry = this.flashGeom;
            visual.bodyMesh.material = this.flashMat;
          } else {
            visual.bodyMesh.geometry = this.smokeGeom;
            visual.bodyMesh.material = this.smokeMat;
          }
        }
        visual.mesh.visible = true;
      } else {
        visual.activeGrenade = null;
        visual.mesh.visible = false;
      }
    }

    // 2. Update Blast Fireballs & Shockwaves
    for (let i = 0; i < this.blastPool.length; i++) {
      const blast = this.blastPool[i]!;
      if (!blast.active) continue;

      blast.lifetime += dt;
      const progress = blast.lifetime / blast.maxLifetime;

      if (progress >= 1.0) {
        blast.active = false;
        blast.fireballMesh.visible = false;
        blast.shockwaveMesh.visible = false;
        blast.light.intensity = 0;
        continue;
      }

      // Fireball expands from 0.5m to 3.8m and fades
      const fbScale = 0.5 + progress * 3.3;
      blast.fireballMesh.scale.set(fbScale, fbScale, fbScale);
      (blast.fireballMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 * (1.0 - progress));

      // Shockwave expands along floor to 6.5m
      const swScale = 0.2 + progress * 6.3;
      blast.shockwaveMesh.scale.set(swScale, swScale, swScale);
      (blast.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1.0 - progress));

      // Light flash decays exponentially
      blast.light.intensity = Math.max(0, 18.0 * (1.0 - progress * 2.0));
    }

    // 3. Update Instanced Smoke Cloud Puffs
    for (let c = 0; c < this.smokeClouds.length; c++) {
      const cloud = this.smokeClouds[c]!;
      if (!cloud.active) continue;

      if (cloud.volume.durationRemaining <= 0) {
        cloud.active = false;
        cloud.instancedMesh.visible = false;
        continue;
      }

      const durTotal = GRENADE_DEFS.smoke.smokeDurationTicks;
      const durRem = cloud.volume.durationRemaining;
      const isFading = durRem < 120; // Fade out during last 2s
      const alpha = isFading ? durRem / 120 : 1.0;

      for (let p = 0; p < MAX_SMOKE_PUFFS_PER_VOLUME; p++) {
        const pos = cloud.puffPositions[p]!;
        const vel = cloud.puffVelocities[p]!;

        // Gently drift and billow upward
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
        pos.z += vel.z * dt;

        // Expand to full base scale over first 2 seconds
        if (cloud.puffScales[p]! < cloud.puffBaseScales[p]!) {
          cloud.puffScales[p] = Math.min(cloud.puffBaseScales[p]!, cloud.puffScales[p]! + dt * 1.8);
        }

        const scale = cloud.puffScales[p]! * alpha;

        // Billboard facing the camera
        _scratchPos.copy(pos);
        _scratchQuat.copy(this.camera.quaternion);
        _scratchScale.set(scale, scale, scale);
        _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);

        cloud.instancedMesh.setMatrixAt(p, _scratchMat4);
      }
      cloud.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    // 4. Update Flashbang Screen Whiteout Decay
    if (this.flashIntensity > 0) {
      this.flashIntensity = Math.max(0, this.flashIntensity - dt * 0.45);
      if (this.flashOverlayEl) {
        this.flashOverlayEl.style.opacity = `${this.flashIntensity}`;
      }
    }
  }

  /**
   * Disposes all Three.js geometries, materials, and meshes to prevent memory leaks.
   */
  public dispose(): void {
    for (const visual of this.grenadeMeshes) {
      if (visual.mesh.parent) visual.mesh.parent.remove(visual.mesh);
    }
    for (const blast of this.blastPool) {
      if (blast.fireballMesh.parent) blast.fireballMesh.parent.remove(blast.fireballMesh);
      if (blast.shockwaveMesh.parent) blast.shockwaveMesh.parent.remove(blast.shockwaveMesh);
      if (blast.light.parent) blast.light.parent.remove(blast.light);
    }
    for (const cloud of this.smokeClouds) {
      if (cloud.instancedMesh.parent) cloud.instancedMesh.parent.remove(cloud.instancedMesh);
    }

    this.fragGeom.dispose();
    this.flashGeom.dispose();
    this.smokeGeom.dispose();
    this.fragMat.dispose();
    this.flashMat.dispose();
    this.smokeMat.dispose();
    this.fireballGeom.dispose();
    this.fireballMat.dispose();
    this.shockwaveGeom.dispose();
    this.shockwaveMat.dispose();
    this.smokePuffGeom.dispose();
    this.smokePuffMat.dispose();

    if (this.flashOverlayEl && this.flashOverlayEl.parentNode) {
      this.flashOverlayEl.parentNode.removeChild(this.flashOverlayEl);
      this.flashOverlayEl = null;
    }
  }
}
