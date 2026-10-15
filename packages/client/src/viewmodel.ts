import * as THREE from 'three';
import { HitboxPart, Vec3, WeaponActionState, WeaponDef, WeaponId } from '@mini-arena/shared';
import { FirstPersonArmsRig } from './animation/armsRig';
import { createAssaultRifleVisualDef } from './animation/assaultRifleDef';
import { createPistolVisualDef } from './animation/pistolDef';
import { createSmgVisualDef } from './animation/smgDef';
import { createShotgunVisualDef } from './animation/shotgunDef';
import { createSniperVisualDef } from './animation/sniperDef';
import { WeaponVisualDef } from './animation/types';
import { WeaponAnimator } from './animation/weaponAnimator';
import { loadRealAK47Slice } from './models/realWeaponSlice';
import { loadRealPistolSlice } from './models/pistolSlice';
import { loadRealSmgSlice } from './models/smgSlice';
import { loadRealShotgunSlice } from './models/shotgunSlice';
import { loadRealSniperSlice } from './models/sniperSlice';

export interface Tracer {
  mesh: THREE.Line;
  lifetime: number;
  maxLifetime: number;
}

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
      hip: new THREE.Vector3(0.11, -0.14, -0.26),
      ads: new THREE.Vector3(0.0, -0.045, -0.20), // Centers iron sights
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

  // Tracers
  private tracers: Tracer[] = [];

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

    // 4. Cache scope overlay DOM element
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
    clipName:
      | 'idle'
      | 'draw'
      | 'inspect'
      | 'reloadTactical'
      | 'reloadEmpty'
      | 'fire'
      | 'reloadShellStart'
      | 'reloadShellInsert'
      | 'reloadShellEnd'
      | 'boltCycle',
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

  public update(dt: number, isAds: boolean, actionState?: WeaponActionState): void {
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
      } else if (actionState === 'swapping_in') {
        this.animator.playClip('draw');
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

    // 6. Update bullet tracers
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
      maxLifetime: 0.08, // 80ms duration capped
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
