import * as THREE from 'three';
import { HitboxPart, Vec3, WeaponActionState, WeaponDef, WeaponId } from '@mini-arena/shared';
import { FirstPersonArmsRig } from './animation/armsRig';
import { createAssaultRifleVisualDef } from './animation/assaultRifleDef';
import { createPistolVisualDef } from './animation/pistolDef';
import { createSmgVisualDef } from './animation/smgDef';
import { createShotgunVisualDef } from './animation/shotgunDef';
import { createSniperVisualDef } from './animation/sniperDef';
import { WeaponClipName, WeaponVisualDef } from './animation/types';
import { WeaponAnimator } from './animation/weaponAnimator';
import { loadRealAK47Slice } from './models/realWeaponSlice';
import { loadRealPistolSlice } from './models/pistolSlice';
import { loadRealSmgSlice } from './models/smgSlice';
import { loadRealShotgunSlice } from './models/shotgunSlice';
import { loadRealSniperSlice } from './models/sniperSlice';

export interface PooledTracer {
  mesh: THREE.Line;
  geometry: THREE.BufferGeometry;
  positionAttr: THREE.BufferAttribute;
  lifetime: number;
  maxLifetime: number;
  active: boolean;
}

export interface PooledImpact {
  mesh: THREE.Mesh;
  lifetime: number;
  maxLifetime: number;
  active: boolean;
}

export const TRACER_CONFIGS: Record<WeaponId, { color: number; maxLifetime: number }> = {
  pistol: { color: 0xfbbf24, maxLifetime: 0.06 },
  smg: { color: 0xfde047, maxLifetime: 0.05 },
  assault_rifle: { color: 0xfacc15, maxLifetime: 0.07 },
  shotgun: { color: 0xf97316, maxLifetime: 0.06 },
  sniper: { color: 0x67e8f9, maxLifetime: 0.14 },
};

export const MUZZLE_FLASH_CONFIGS: Record<WeaponId, { color: number; scale: number; duration: number }> = {
  pistol: { color: 0xfde047, scale: 0.045, duration: 0.035 },
  smg: { color: 0xfacc15, scale: 0.055, duration: 0.030 },
  assault_rifle: { color: 0xf59e0b, scale: 0.090, duration: 0.045 },
  shotgun: { color: 0xf97316, scale: 0.125, duration: 0.050 },
  sniper: { color: 0xffffff, scale: 0.150, duration: 0.055 },
};

export class WeaponViewmodel {
  public group: THREE.Group;
  public armsRig: FirstPersonArmsRig;
  public animator: WeaponAnimator;
  public currentVisualDef: WeaponVisualDef;

  private camera: THREE.Camera;
  private scene: THREE.Scene;

  // Visual definitions registry for all 5 weapons
  private visualDefs: Record<WeaponId, WeaponVisualDef>;

  // Per-weapon tailored hip and ADS eye-alignment offsets
  private weaponOffsets: Record<WeaponId, { hip: THREE.Vector3; ads: THREE.Vector3 }> = {
    assault_rifle: {
      hip: new THREE.Vector3(0.13, -0.16, -0.32),
      ads: new THREE.Vector3(0.0, -0.085, -0.22), // Centers holographic optic
    },
    pistol: {
      hip: new THREE.Vector3(0.12, -0.14, -0.32),
      ads: new THREE.Vector3(0.0, -0.0206, -0.34), // Dead-center iron sights alignment with optical bore axis
    },
    smg: {
      hip: new THREE.Vector3(0.12, -0.15, -0.28),
      ads: new THREE.Vector3(0.0, -0.072, -0.22), // Centers reflex red dot
    },
    shotgun: {
      hip: new THREE.Vector3(0.14, -0.16, -0.32),
      ads: new THREE.Vector3(0.0, -0.062, -0.24), // Centers front brass bead
    },
    sniper: {
      hip: new THREE.Vector3(0.13, -0.16, -0.34),
      ads: new THREE.Vector3(0.0, -0.09, -0.26), // Optical scope
    },
  };

  private hipPos = new THREE.Vector3();
  private adsPos = new THREE.Vector3();
  private currentPos = new THREE.Vector3();

  // Procedural recoil kick spring
  private recoilOffsetZ = 0;
  private recoilPitch = 0;
  public kickCount = 0;

  public getRecoilOffsetZ(): number {
    return this.recoilOffsetZ;
  }

  public getRecoilPitch(): number {
    return this.recoilPitch;
  }

  // Zero-allocation pooled tracers
  private tracerPool: PooledTracer[] = [];

  // Zero-allocation pooled impact sparks
  private impactPool: PooledImpact[] = [];

  // Zero-allocation muzzle flash
  private muzzleFlashGroup: THREE.Group;
  private muzzleFlashMat: THREE.MeshBasicMaterial;
  private muzzleFlashTimer = 0;

  // Triangle counts for performance budgeting
  public gunTriangles = 0;
  public armsTriangles = 0;
  public totalTriangles = 0;

  // Promise signaling that all 5 real weapon GLBs have fully loaded and replaced procedurals
  public readonly modelsLoaded: Promise<void> = Promise.resolve();

  // Socket debug markers
  private debugSocketGroup: THREE.Group | null = null;

  // DOM 2D Scope Overlay
  private sniperScopeElement: HTMLElement | null = null;

  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;

    this.group = new THREE.Group();
    this.group.name = 'Viewmodel_Root';
    this.camera.add(this.group);

    // 1. First-Person Rigged Arms
    this.armsRig = new FirstPersonArmsRig();
    this.camera.add(this.armsRig.group);
    this.armsTriangles = this.armsRig.totalTriangles;

    // 2. Pre-instantiate all 5 modular weapon visual definitions
    this.visualDefs = {
      assault_rifle: createAssaultRifleVisualDef(),
      pistol: createPistolVisualDef(),
      smg: createSmgVisualDef(),
      shotgun: createShotgunVisualDef(),
      sniper: createSniperVisualDef(),
    };

    // Default to Assault Rifle
    this.currentVisualDef = this.visualDefs.assault_rifle;
    this.hipPos.copy(this.weaponOffsets.assault_rifle.hip);
    this.adsPos.copy(this.weaponOffsets.assault_rifle.ads);
    this.currentPos.copy(this.hipPos);

    // 3. Animator
    this.animator = new WeaponAnimator(this.currentVisualDef, this.armsRig);
    this.group.add(this.animator.weaponGroup);
    this.refreshTriangleCounts();

    // 4. Pre-allocate 32 pooled bullet tracers (zero heap allocations during combat)
    for (let i = 0; i < 32; i++) {
      const geom = new THREE.BufferGeometry();
      const posArray = new Float32Array(6);
      const posAttr = new THREE.BufferAttribute(posArray, 3);
      geom.setAttribute('position', posAttr);
      const mat = new THREE.LineBasicMaterial({
        color: 0xfacc15,
        linewidth: 2,
      });
      const line = new THREE.Line(geom, mat);
      line.visible = false;
      this.scene.add(line);
      this.tracerPool.push({
        mesh: line,
        geometry: geom,
        positionAttr: posAttr,
        lifetime: 0,
        maxLifetime: 0.08,
        active: false,
      });
    }

    // 5. Pre-allocate 16 pooled impact spark flashes
    const sparkGeom = new THREE.SphereGeometry(0.02, 4, 4);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(sparkGeom, sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.impactPool.push({
        mesh,
        lifetime: 0,
        maxLifetime: 0.08,
        active: false,
      });
    }

    // 6. Pre-allocate cross-quad muzzle flash billboard attached to weaponGroup
    this.muzzleFlashGroup = new THREE.Group();
    this.muzzleFlashGroup.name = 'Muzzle_Flash_Group';
    this.muzzleFlashMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const flashPlane1 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.muzzleFlashMat);
    const flashPlane2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.muzzleFlashMat);
    flashPlane2.rotation.y = Math.PI / 2;
    this.muzzleFlashGroup.add(flashPlane1);
    this.muzzleFlashGroup.add(flashPlane2);
    this.muzzleFlashGroup.visible = false;
    this.animator.weaponGroup.add(this.muzzleFlashGroup);

    // 7. Cache scope overlay DOM element
    this.sniperScopeElement = document.getElementById('sniper-scope');

    // 5. Asynchronously load the real 5 weapon model slices & PSX arms
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      const pAR = loadRealAK47Slice('/models')
        .then((slice) => {
          this.visualDefs.assault_rifle = slice.visualDef;
          if (this.currentVisualDef.weaponId === 'assault_rifle') {
            this.currentVisualDef = slice.visualDef;
            this.animator.setVisualDef(slice.visualDef);
          }
          if (slice.armsRigGroup && slice.armsMesh) {
            this.armsRig.setSkinnedArms(slice.armsRigGroup, slice.armsMesh);
          }
          this.refreshTriangleCounts();
        })
        .catch((err) => {
          console.warn('Real AK-47 model slice fallback to procedural:', err);
        });

      const pPistol = loadRealPistolSlice('/models')
        .then((slice) => {
          this.visualDefs.pistol = slice.visualDef;
          if (this.currentVisualDef.weaponId === 'pistol') {
            this.currentVisualDef = slice.visualDef;
            this.animator.setVisualDef(slice.visualDef);
            this.refreshTriangleCounts();
          }
        })
        .catch((err) => {
          console.warn('Real Pistol model slice fallback to procedural:', err);
        });

      const pSmg = loadRealSmgSlice('/models')
        .then((slice) => {
          this.visualDefs.smg = slice.visualDef;
          if (this.currentVisualDef.weaponId === 'smg') {
            this.currentVisualDef = slice.visualDef;
            this.animator.setVisualDef(slice.visualDef);
            this.refreshTriangleCounts();
          }
        })
        .catch((err) => {
          console.warn('Real SMG model slice fallback to procedural:', err);
        });

      const pShotgun = loadRealShotgunSlice('/models')
        .then((slice) => {
          this.visualDefs.shotgun = slice.visualDef;
          if (this.currentVisualDef.weaponId === 'shotgun') {
            this.currentVisualDef = slice.visualDef;
            this.animator.setVisualDef(slice.visualDef);
            this.refreshTriangleCounts();
          }
        })
        .catch((err) => {
          console.warn('Real Shotgun model slice fallback to procedural:', err);
        });

      const pSniper = loadRealSniperSlice('/models')
        .then((slice) => {
          this.visualDefs.sniper = slice.visualDef;
          if (this.currentVisualDef.weaponId === 'sniper') {
            this.currentVisualDef = slice.visualDef;
            this.animator.setVisualDef(slice.visualDef);
            this.refreshTriangleCounts();
          }
        })
        .catch((err) => {
          console.warn('Real Sniper model slice fallback to procedural:', err);
        });

      this.modelsLoaded = Promise.all([pAR, pPistol, pSmg, pShotgun, pSniper]).then(() => {});
    }
  }

  public refreshTriangleCounts(): void {
    let gun = 0;
    this.animator.weaponGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry.index) {
          gun += mesh.geometry.index.count / 3;
        } else if (mesh.geometry.attributes.position) {
          gun += mesh.geometry.attributes.position.count / 3;
        }
      }
    });
    this.gunTriangles = gun;
    this.armsTriangles = this.armsRig.totalTriangles;
    this.totalTriangles = this.gunTriangles + this.armsTriangles;
  }

  public setSocketDebugMarkers(visible: boolean): void {
    if (!visible) {
      if (this.debugSocketGroup) {
        this.debugSocketGroup.visible = false;
      }
      return;
    }
    if (!this.debugSocketGroup) {
      this.debugSocketGroup = new THREE.Group();
      this.debugSocketGroup.name = 'Socket_Debug_Markers';

      // Left grip: cyan sphere (radius 0.015m)
      const geomL = new THREE.SphereGeometry(0.015, 16, 16);
      const matL = new THREE.MeshBasicMaterial({ color: 0x00ffff, depthTest: false });
      const sphereL = new THREE.Mesh(geomL, matL);
      sphereL.name = 'DebugMarker_gripL';
      sphereL.renderOrder = 999;
      this.debugSocketGroup.add(sphereL);

      // Right grip: bright green sphere (radius 0.015m)
      const geomR = new THREE.SphereGeometry(0.015, 16, 16);
      const matR = new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false });
      const sphereR = new THREE.Mesh(geomR, matR);
      sphereR.name = 'DebugMarker_gripR';
      sphereR.renderOrder = 999;
      this.debugSocketGroup.add(sphereR);

      this.group.add(this.debugSocketGroup);
    }
    this.debugSocketGroup.visible = true;
    this.updateSocketDebugMarkers();
  }

  public updateSocketDebugMarkers(): void {
    if (!this.debugSocketGroup || !this.debugSocketGroup.visible) return;
    const socketL = this.currentVisualDef.sockets?.gripL;
    const socketR = this.currentVisualDef.sockets?.gripR;
    const markerL = this.debugSocketGroup.getObjectByName('DebugMarker_gripL');
    const markerR = this.debugSocketGroup.getObjectByName('DebugMarker_gripR');
    if (markerL && socketL) {
      markerL.position.copy(socketL);
    }
    if (markerR && socketR) {
      markerR.position.copy(socketR);
    }
  }

  public updateWeaponVisual(weapon: WeaponDef): void {
    const nextDef = this.visualDefs[weapon.id];
    if (!nextDef || nextDef === this.currentVisualDef) return;

    this.currentVisualDef = nextDef;
    const offsets = this.weaponOffsets[weapon.id];
    if (offsets) {
      this.hipPos.copy(offsets.hip);
      this.adsPos.copy(offsets.ads);
    }

    // Hot-swap modular mesh parts on animator
    this.animator.setVisualDef(this.currentVisualDef);
    this.refreshTriangleCounts();
    this.updateSocketDebugMarkers();
  }

  public playClip(
    clipName: WeaponClipName,
    forceRestart = false,
  ): void {
    this.animator.playClip(clipName, forceRestart);
  }

  public applyRecoilKick(pitchKick: number): void {
    // Kick viewmodel back and tilt nose up
    this.recoilOffsetZ += 0.04;
    this.recoilPitch += pitchKick * 0.7;
    this.kickCount++;

    // Trigger weapon animator fire recoil clip
    this.animator.playClip('fire', true);
  }

  public update(dt: number, isAds: boolean, actionState?: WeaponActionState, isSprinting = false): void {
    // 1. Sync animator with shared weapon action state
    if (actionState) {
      if (actionState === 'reloading_tactical') {
        this.animator.playClip('reloadTactical');
      } else if (actionState === 'reloading_empty') {
        this.animator.playClip('reloadEmpty');
      } else if (actionState === 'reloading_shell_start') {
        this.animator.playClip('reloadShellStart');
      } else if (actionState === 'reloading_shell_insert') {
        this.animator.playClip('reloadShellInsert');
      } else if (actionState === 'reloading_shell_end') {
        this.animator.playClip('reloadShellEnd');
      } else if (actionState === 'cycling_bolt') {
        this.animator.playClip('boltCycle');
      } else if (actionState === 'swapping_out') {
        this.animator.playClip('holster');
      } else if (actionState === 'swapping_in') {
        this.animator.playClip('draw');
      } else if (actionState === 'idle') {
        if (isSprinting && !isAds) {
          this.animator.playClip('sprint');
        } else if (!isAds && this.animator.getClipName() === 'sprint') {
          this.animator.playClip('idle');
        }
      }
    }

    // 2. Handle Sniper 2D Scope Overlay when aiming down sights
    const isSniperScoping = this.currentVisualDef.weaponId === 'sniper' && isAds;
    if (this.sniperScopeElement) {
      if (isSniperScoping) {
        this.sniperScopeElement.classList.add('active');
        this.sniperScopeElement.style.display = 'block';
        this.sniperScopeElement.style.opacity = '1';
        this.group.visible = false; // Hide 3D viewmodel arms in high-magnification scope
        this.armsRig.group.visible = false;
      } else {
        this.sniperScopeElement.classList.remove('active');
        this.sniperScopeElement.style.opacity = '0';
        this.sniperScopeElement.style.display = 'none';
        this.group.visible = true;
        this.armsRig.group.visible = true;
      }
    }

    // 3. Lerp between hip and ADS position
    const targetPos = isAds ? this.adsPos : this.hipPos;
    const lerpSpeed = isAds ? 16.0 : 12.0;
    this.currentPos.lerp(targetPos, Math.min(1.0, dt * lerpSpeed));

    // 4. Recover procedural recoil springs smoothly
    this.recoilOffsetZ = Math.max(0, this.recoilOffsetZ - dt * 0.35);
    this.recoilPitch = Math.max(0, this.recoilPitch - dt * 2.2);

    // Apply combined positioning to viewmodel group BEFORE solving arms IK
    this.group.position.copy(this.currentPos);
    this.group.position.z += this.recoilOffsetZ;
    this.group.rotation.x = this.recoilPitch;
    this.group.updateMatrixWorld(true);

    // 5. Step the weapon animator, arms IK, and dropping magazine physics with fresh matrixWorld
    this.animator.update(dt, this.scene);

    // 6. Update bullet tracers (zero heap allocations)
    for (let i = 0; i < this.tracerPool.length; i++) {
      const tracer = this.tracerPool[i]!;
      if (!tracer.active) continue;
      tracer.lifetime += dt;
      if (tracer.lifetime >= tracer.maxLifetime) {
        tracer.active = false;
        tracer.mesh.visible = false;
      }
    }

    // 7. Update impact spark flashes (zero heap allocations)
    for (let i = 0; i < this.impactPool.length; i++) {
      const impact = this.impactPool[i]!;
      if (!impact.active) continue;
      impact.lifetime += dt;
      if (impact.lifetime >= impact.maxLifetime) {
        impact.active = false;
        impact.mesh.visible = false;
      }
    }

    // 8. Update muzzle flash timer
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashGroup.visible = false;
      }
    }
  }

  /**
   * Spawns a weapon-specific tracer from the pre-allocated pool with zero heap allocations.
   */
  public spawnTracer(fromPos: Vec3, toPos: Vec3, weaponId: WeaponId = 'assault_rifle'): void {
    let tracer = this.tracerPool.find((t) => !t.active);
    if (!tracer) {
      tracer = this.tracerPool.reduce((oldest, t) => (t.lifetime > oldest.lifetime ? t : oldest), this.tracerPool[0]!);
    }

    const attr = tracer.positionAttr;
    attr.setXYZ(0, fromPos.x, fromPos.y, fromPos.z);
    attr.setXYZ(1, toPos.x, toPos.y, toPos.z);
    attr.needsUpdate = true;

    const cfg = TRACER_CONFIGS[weaponId] ?? TRACER_CONFIGS.assault_rifle;
    (tracer.mesh.material as THREE.LineBasicMaterial).color.setHex(cfg.color);
    tracer.lifetime = 0;
    tracer.maxLifetime = cfg.maxLifetime;
    tracer.active = true;
    tracer.mesh.visible = true;
  }

  /**
   * Triggers a weapon-specific muzzle flash billboard at the muzzle socket.
   */
  public triggerMuzzleFlash(weaponId: WeaponId = 'assault_rifle'): void {
    const muzzle = this.currentVisualDef.muzzleOffset;
    this.muzzleFlashGroup.position.copy(muzzle);
    const cfg = MUZZLE_FLASH_CONFIGS[weaponId] ?? MUZZLE_FLASH_CONFIGS.assault_rifle;
    this.muzzleFlashGroup.scale.setScalar(cfg.scale);
    this.muzzleFlashMat.color.setHex(cfg.color);
    this.muzzleFlashTimer = cfg.duration;
    this.muzzleFlashGroup.visible = true;
  }

  /**
   * Triggers an impact spark flash at a world-space hit position.
   */
  public triggerImpact(hitPoint: Vec3): void {
    let impact = this.impactPool.find((ip) => !ip.active);
    if (!impact) {
      impact = this.impactPool.reduce((oldest, ip) => (ip.lifetime > oldest.lifetime ? ip : oldest), this.impactPool[0]!);
    }
    impact.mesh.position.set(hitPoint.x, hitPoint.y, hitPoint.z);
    impact.lifetime = 0;
    impact.active = true;
    impact.mesh.visible = true;
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
