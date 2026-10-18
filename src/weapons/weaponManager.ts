// src/weapons/weaponManager.ts
// Weapon Manager: Handles viewmodel lifecycle, recoil physics, shell ejections,
// procedural reload choreography, ADS, audio sync, and ballistics for all 5 weapons.

import * as THREE from 'three';
import type { WeaponId, WeaponDef } from './weaponTypes.ts';
import { WEAPON_REGISTRY } from './weaponTypes.ts';
import { createAK47Model } from './ak47Model.ts';
import type { AK47Components } from './ak47Model.ts';
import { createPistolModel } from './pistolModel.ts';
import type { PistolComponents } from './pistolModel.ts';
import { createSMGModel } from './smgModel.ts';
import type { SMGComponents } from './smgModel.ts';
import { createShotgunModel } from './shotgunModel.ts';
import type { ShotgunComponents } from './shotgunModel.ts';
import { createSniperModel } from './sniperModel.ts';
import type { SniperComponents } from './sniperModel.ts';
import { sound } from '../audio/soundManager.ts';
import {
  type FireSchedulerState,
  stepFireScheduler,
  onTriggerPress,
  onTriggerRelease,
  onWeaponEquip,
} from './fireScheduler.ts';
import { FX_NON_RAYCAST_LAYER } from '../environment/targets.ts';

interface ShellCasing {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  life: number;
}

export interface WeaponState {
  currentWeaponId: WeaponId;
  ammoInClip: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  isScoped: boolean;
  spreadRadius: number;
  isFiring: boolean;
  isSprinting: boolean;
  isMoving: boolean;
}

export class WeaponManager {
  public rootGroup: THREE.Group;
  public state: WeaponState;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private ak47: AK47Components;
  private pistol: PistolComponents;
  private smg: SMGComponents;
  private shotgun: ShotgunComponents;
  private sniper: SniperComponents;

  private ammoCounts: Record<WeaponId, { clip: number; reserve: number }>;

  // Physics & Animation Trajectories
  private recoil = { kickZ: 0, pitchX: 0, yawY: 0, rollZ: 0 };
  private sway = { x: 0, y: 0 };
  private adsWeight = 0; // 0 = Hipfire, 1 = Full ADS
  private switchWeight = 0; // 0 = ready, 1 = lowered during switch
  private inspectTimer = 0; // > 0 when inspecting weapon (V key)

  // Critically-damped sprint spring (ζ = 1, no overshoot).
  // sprintWeight: 0 = idle/rest, 1 = full sprint carry pose.
  // sprintVel: spring derivative — reused each frame (zero per-frame alloc).
  // sprintOutTimer: seconds remaining before fire is unblocked after sprinting ends.
  private sprintWeight = 0;
  private sprintVel = 0;      // spring velocity for weight scalar
  private sprintOutTimer = 0; // > 0 → scheduler stays blocked after sprint ends
  private lastWasSprinting = false; // previous frame real sprint input (for edge detection)

  // Locomotion bobbing & breathing accumulators (distance / velocity integrated, no per-frame alloc)
  private walkBobCycle = 0;       // accumulates walk stride phase (radians)
  private sprintBobCycle = 0;     // accumulates sprint stride phase (radians)
  private idleBreathTimer = 0;    // calm idle breathing timer (seconds)
  private moveWeight = 0;         // smooth blend between idle (0) and walk/run (1)

  // Scratch math objects (zero per-frame allocations)
  private scratchHipPos = new THREE.Vector3();
  private scratchAdsPos = new THREE.Vector3();
  private scratchLocalPos = new THREE.Vector3();
  private scratchForward = new THREE.Vector3();
  private scratchRight = new THREE.Vector3();
  private scratchUp = new THREE.Vector3();
  private scratchMuzzlePos = new THREE.Vector3();
  private scratchShotDir = new THREE.Vector3();

  private lastFireTime = 0;
  private schedulerState: FireSchedulerState;
  private lastDelta = 0;
  private reloadTimer = 0;
  private reloadDuration = 0;
  private reloadStage = 0;

  private shells: ShellCasing[] = [];
  private shellMaterial: THREE.MeshStandardMaterial;

  // Viewmodel transform caching for mid-frame firing assembly
  private currentBobX = 0;
  private currentBobY = 0;
  private currentReloadPosY = 0;
  private currentReloadRotX = 0;
  private currentReloadRotZ = 0;
  private currentInspectRotY = 0;
  private currentInspectRotZ = 0;

  private debugMuzzleMarkerEnabled = false;
  private debugMuzzleMarkers: Record<WeaponId, THREE.Mesh | null> = {
    ak47: null,
    pistol: null,
    smg: null,
    shotgun: null,
    sniper: null,
  };

  public onCameraRecoil?: (pitch: number, yaw: number) => void;
  public onFireRaycast?: (
    muzzleOrigin: THREE.Vector3,
    aimOrigin: THREE.Vector3,
    aimDirection: THREE.Vector3,
    weaponDef: WeaponDef
  ) => void;
  public onStateChange?: (state: WeaponState) => void;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.rootGroup = new THREE.Group();
    this.rootGroup.userData.isViewmodel = true;
    this.rootGroup.userData.ignoreRaycast = true;
    this.scene.add(this.rootGroup);

    this.ak47 = createAK47Model();
    this.pistol = createPistolModel();
    this.smg = createSMGModel();
    this.shotgun = createShotgunModel();
    this.sniper = createSniperModel();

    const markViewmodel = (root: THREE.Group) => {
      root.traverse((child) => {
        child.userData.isViewmodel = true;
        child.userData.ignoreRaycast = true;
        child.layers.set(FX_NON_RAYCAST_LAYER);
      });
    };

    markViewmodel(this.ak47.root);
    markViewmodel(this.pistol.root);
    markViewmodel(this.smg.root);
    markViewmodel(this.shotgun.root);
    markViewmodel(this.sniper.root);

    this.rootGroup.add(this.ak47.root);
    this.rootGroup.add(this.pistol.root);
    this.rootGroup.add(this.smg.root);
    this.rootGroup.add(this.shotgun.root);
    this.rootGroup.add(this.sniper.root);

    this.pistol.root.visible = false;
    this.smg.root.visible = false;
    this.shotgun.root.visible = false;
    this.sniper.root.visible = false;

    this.ammoCounts = {
      ak47: { clip: 30, reserve: 999 },
      pistol: { clip: 15, reserve: 999 },
      smg: { clip: 30, reserve: 999 },
      shotgun: { clip: 8, reserve: 999 },
      sniper: { clip: 5, reserve: 999 },
    };

    this.state = {
      currentWeaponId: 'ak47',
      ammoInClip: 30,
      reserveAmmo: 999,
      isReloading: false,
      reloadProgress: 0,
      isScoped: false,
      spreadRadius: WEAPON_REGISTRY.ak47.spreadBase,
      isFiring: false,
      isSprinting: false,
      isMoving: false,
    };

    this.shellMaterial = new THREE.MeshStandardMaterial({
      color: 0xcca033,
      metalness: 0.95,
      roughness: 0.2,
    });

    this.schedulerState = {
      simTime: 0,
      nextShotTime: 0,
      triggerHeld: false,
      triggerJustPressed: false,
      ammoInClip: this.ammoCounts.ak47.clip,
      isReloading: false,
      isSwapping: false,
      isSprinting: false,
      fireMode: WEAPON_REGISTRY.ak47.fireMode,
      fireInterval: WEAPON_REGISTRY.ak47.fireRate,
      cycleTime: WEAPON_REGISTRY.ak47.fireRate,
    };

    if (typeof window !== 'undefined') {
      (window as any).__weaponManager = this;
    }
  }

  public get currentDef(): WeaponDef {
    return WEAPON_REGISTRY[this.state.currentWeaponId];
  }

  public get weaponState(): WeaponState {
    return this.state;
  }

  public getActiveMuzzleWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    let node: THREE.Object3D | null = null;
    switch (this.state.currentWeaponId) {
      case 'ak47': node = this.ak47.muzzlePoint; break;
      case 'pistol': node = this.pistol.muzzlePoint; break;
      case 'smg': node = this.smg.muzzlePoint; break;
      case 'shotgun': node = this.shotgun.muzzlePoint; break;
      case 'sniper': node = this.sniper.muzzlePoint; break;
    }
    if (node) {
      this.applyViewmodelTransform();
      return node.getWorldPosition(target);
    }
    return target.copy(this.camera.position);
  }

  public applyViewmodelTransform(): void {
    const cur = this.currentDef;
    const sp = cur.sprintPose;
    const sw = this.sprintWeight;

    this.scratchHipPos.set(cur.hipPosition[0], cur.hipPosition[1], cur.hipPosition[2]);
    this.scratchAdsPos.set(cur.adsPosition[0], cur.adsPosition[1], cur.adsPosition[2]);
    this.scratchLocalPos.copy(this.scratchHipPos).lerp(this.scratchAdsPos, this.adsWeight);

    const restRotX = THREE.MathUtils.lerp(cur.hipRotation[0], cur.adsRotation[0], this.adsWeight);
    const restRotY = THREE.MathUtils.lerp(cur.hipRotation[1], cur.adsRotation[1], this.adsWeight);
    const restRotZ = THREE.MathUtils.lerp(cur.hipRotation[2], cur.adsRotation[2], this.adsWeight);

    this.scratchLocalPos.x += this.sway.x + this.currentBobX + sp.dx * sw;
    this.scratchLocalPos.y += this.sway.y + this.currentBobY + this.currentReloadPosY + sp.dy * sw - this.switchWeight * 0.22;
    this.scratchLocalPos.z += this.recoil.kickZ + sp.dz * sw;

    this.camera.updateMatrixWorld(true);
    this.rootGroup.position.copy(this.camera.position);
    this.rootGroup.quaternion.copy(this.camera.quaternion);

    this.scratchForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.scratchRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.scratchUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);

    this.rootGroup.position
      .addScaledVector(this.scratchRight, this.scratchLocalPos.x)
      .addScaledVector(this.scratchUp, this.scratchLocalPos.y)
      .addScaledVector(this.scratchForward, -this.scratchLocalPos.z);

    const totalPitch = this.recoil.pitchX + restRotX + sp.dpitch * sw + this.currentReloadRotX;
    const totalYaw   = this.recoil.yawY + restRotY + this.sway.x * 0.8 + sp.dyaw * sw + this.currentInspectRotY;
    const totalRoll  = this.recoil.rollZ + restRotZ + this.currentBobX * 1.8 + sp.droll * sw + this.currentReloadRotZ + this.currentInspectRotZ;

    this.rootGroup.rotateX(totalPitch);
    this.rootGroup.rotateY(totalYaw);
    this.rootGroup.rotateZ(totalRoll);

    this.rootGroup.updateMatrixWorld(true);
  }

  public setDebugMuzzleMarker(enabled: boolean): void {
    this.debugMuzzleMarkerEnabled = enabled;
    const weapons: { id: WeaponId; muzzle: THREE.Object3D }[] = [
      { id: 'ak47', muzzle: this.ak47.muzzlePoint },
      { id: 'pistol', muzzle: this.pistol.muzzlePoint },
      { id: 'smg', muzzle: this.smg.muzzlePoint },
      { id: 'shotgun', muzzle: this.shotgun.muzzlePoint },
      { id: 'sniper', muzzle: this.sniper.muzzlePoint },
    ];

    for (const w of weapons) {
      if (enabled) {
        if (!this.debugMuzzleMarkers[w.id]) {
          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.012, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xff0055, depthTest: false })
          );
          marker.name = `debug-muzzle-marker-${w.id}`;
          marker.renderOrder = 9999;
          marker.layers.set(FX_NON_RAYCAST_LAYER);
          marker.userData.ignoreRaycast = true;
          marker.userData.isViewmodel = true;
          w.muzzle.add(marker);
          this.debugMuzzleMarkers[w.id] = marker;
        } else {
          this.debugMuzzleMarkers[w.id]!.visible = true;
        }
      } else {
        if (this.debugMuzzleMarkers[w.id]) {
          this.debugMuzzleMarkers[w.id]!.visible = false;
        }
      }
    }
  }

  public isDebugMuzzleMarkerEnabled(): boolean {
    return this.debugMuzzleMarkerEnabled;
  }

  private reloadWasEmpty = false;
  private shotgunCycleTimer = 0;
  private shotgunCycleStage = 0;
  private sniperCycleTimer = 0;
  private sniperCycleStage = 0;

  private resetSubgroupsToRest() {
    this.ak47.magazineGroup.position.set(0, -0.04, -0.06);
    this.ak47.magazineGroup.rotation.set(0, 0, 0);
    this.ak47.boltCarrierGroup.position.set(0.025, 0.02, 0.02);
    this.ak47.leftArmGroup.position.set(0, 0, 0);
    this.ak47.leftArmGroup.rotation.set(0, 0, 0);

    this.pistol.magazineGroup.position.set(0, -0.075, 0.015);
    this.pistol.magazineGroup.rotation.set(0, 0, 0);
    this.pistol.slideGroup.position.set(0, 0.022, 0);
    this.pistol.leftArmGroup.position.set(0, 0, 0);
    this.pistol.leftArmGroup.rotation.set(0, 0, 0);

    this.smg.magazineGroup.position.set(0, -0.06, -0.06);
    this.smg.magazineGroup.rotation.set(0, 0, 0);
    this.smg.boltCarrierGroup.position.set(0.022, 0.028, -0.02);
    this.smg.leftArmGroup.position.set(0, 0, 0);
    this.smg.leftArmGroup.rotation.set(0, 0, 0);

    this.shotgun.pumpGroup.position.set(0, 0.018, -0.26);
    this.shotgun.shellGroup.position.set(0, -0.016, -0.02);
    this.shotgun.shellGroup.visible = false;
    if (this.shotgun.leftHandGroup) {
      this.shotgun.leftHandGroup.position.set(0, 0, 0);
    }
    this.shotgun.updateSupportArm?.(-0.26);

    this.sniper.boltCarrierGroup.position.set(0.028, 0.032, 0.01);
    this.sniper.boltCarrierGroup.rotation.set(0, 0, 0);
    this.sniper.magazineGroup.position.set(0, -0.08, -0.06);
    this.sniper.leftArmGroup.position.set(0, 0, 0);
    this.sniper.leftArmGroup.rotation.set(0, 0, 0);
  }

  public cancelReload() {
    if (this.state.isReloading) {
      this.state.isReloading = false;
      this.state.reloadProgress = 0;
      this.reloadTimer = 0;
      this.reloadStage = 0;
      this.schedulerState.isReloading = false;
      this.resetSubgroupsToRest();
      this.notifyState();
    }
    this.shotgunCycleTimer = 0;
    this.shotgunCycleStage = 0;
    this.sniperCycleTimer = 0;
    this.sniperCycleStage = 0;
    sound.stopAllHandlingSounds();
  }

  public switchWeapon(id: WeaponId) {
    if (this.state.currentWeaponId === id) return;

    this.cancelReload();
    sound.stopAllHandlingSounds();
    sound.playEquip(id);

    this.state.currentWeaponId = id;
    this.state.ammoInClip = this.ammoCounts[id].clip;
    this.state.reserveAmmo = this.ammoCounts[id].reserve;
    this.state.isScoped = false;
    this.switchWeight = 1.0;
    onWeaponEquip(this.schedulerState);
    const def = WEAPON_REGISTRY[id];
    this.schedulerState.fireMode = def.fireMode;
    this.schedulerState.fireInterval = def.fireRate;
    this.schedulerState.cycleTime = def.fireRate;
    this.schedulerState.ammoInClip = this.ammoCounts[id].clip;

    this.resetSubgroupsToRest();

    this.ak47.root.visible = id === 'ak47';
    this.pistol.root.visible = id === 'pistol';
    this.smg.root.visible = id === 'smg';
    this.shotgun.root.visible = id === 'shotgun';
    this.sniper.root.visible = id === 'sniper';

    this.notifyState();
  }

  public triggerInspect() {
    if (this.state.isReloading || this.state.isScoped) return;
    this.inspectTimer = 2.4;
  }

  /**
   * Hard-reset all fire/reload state after a map load.
   * Does NOT change weapon type or ammo counts.
   * Prevents accumulated fireAccumulator / stuck trigger from carrying over.
   */
  public resetForMapLoad() {
    this.cancelReload();
    sound.stopAllHandlingSounds();
    this.lastFireTime = 0;
    this.schedulerState.simTime = 0;
    this.schedulerState.nextShotTime = 0;
    this.schedulerState.triggerHeld = false;
    this.schedulerState.triggerJustPressed = false;
    this.schedulerState.isReloading = false;
    this.schedulerState.isSwapping = false;
    this.schedulerState.isSprinting = false;
    this.state.isFiring = false;
    this.state.isReloading = false;
    this.state.isScoped = false;
    this.state.reloadProgress = 0;
    this.reloadTimer = 0;
    this.reloadDuration = 0;
    this.reloadStage = 0;
    this.adsWeight = 0;
    this.sprintWeight = 0;
    this.sprintVel = 0;
    this.sprintOutTimer = 0;
    this.lastWasSprinting = false;
    this.inspectTimer = 0;
    this.walkBobCycle = 0;
    this.sprintBobCycle = 0;
    this.idleBreathTimer = 0;
    this.moveWeight = 0;
    this.shotgunCycleTimer = 0;
    this.shotgunCycleStage = 0;
    this.sniperCycleTimer = 0;
    this.sniperCycleStage = 0;
    this.resetSubgroupsToRest();
    this.notifyState();
  }

  public setAmmo(clip: number, reserve?: number) {
    const id = this.state.currentWeaponId;
    this.ammoCounts[id].clip = clip;
    if (reserve !== undefined) {
      this.ammoCounts[id].reserve = reserve;
      this.state.reserveAmmo = reserve;
    }
    this.state.ammoInClip = clip;
    this.schedulerState.ammoInClip = clip;
    this.notifyState();
  }

  public setTrigger(isPressed: boolean) {
    if (isPressed) {
      if (this.inspectTimer > 0) {
        this.inspectTimer = 0;
      }
      if (this.state.isReloading && this.state.currentWeaponId === 'shotgun') {
        const ammo = this.ammoCounts.shotgun;
        if (ammo.clip > 0 && this.reloadStage >= 1) {
          this.state.isReloading = false;
          this.schedulerState.isReloading = false;
          this.schedulerState.nextShotTime = this.schedulerState.simTime;
          this.resetSubgroupsToRest();
          this.notifyState();
        }
      }
      onTriggerPress(this.schedulerState);
    } else {
      onTriggerRelease(this.schedulerState);
      this.state.isFiring = false;
    }
  }

  public toggleADS(enabled?: boolean) {
    if (this.state.isReloading || this.state.isSprinting) {
      this.state.isScoped = false;
    } else {
      this.state.isScoped = enabled !== undefined ? enabled : !this.state.isScoped;
    }
    this.notifyState();
  }

  public startReload() {
    const cur = this.currentDef;
    const ammo = this.ammoCounts[this.state.currentWeaponId];
    if (this.state.isReloading || ammo.clip >= cur.magCapacity) {
      return;
    }

    if (ammo.reserve <= 0) {
      return;
    }

    this.reloadWasEmpty = (ammo.clip === 0);
    this.state.isReloading = true;
    this.state.isScoped = false;
    this.state.isFiring = false;
    this.adsWeight = 0;
    this.reloadDuration = cur.reloadDuration;
    this.reloadTimer = 0;
    this.reloadStage = 0;

    this.notifyState();
  }

  private ejectShell(origin: THREE.Vector3, isHeavy: boolean) {
    const casingGeo = new THREE.CylinderGeometry(
      isHeavy ? 0.008 : 0.005,
      isHeavy ? 0.008 : 0.005,
      isHeavy ? 0.042 : 0.022,
      8
    );
    const casing = new THREE.Mesh(casingGeo, this.shellMaterial);

    const worldOrigin = origin.clone().applyQuaternion(this.camera.quaternion).add(this.camera.position);
    casing.position.copy(worldOrigin);

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

    const velocity = right.multiplyScalar(2.4 + Math.random() * 0.8)
      .add(up.multiplyScalar(1.2 + Math.random() * 0.6))
      .add(forward.multiplyScalar(-0.4 + Math.random() * 0.4));

    const rotVelocity = new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20
    );

    this.scene.add(casing);
    this.shells.push({ mesh: casing, velocity, rotVelocity, life: 2.5 });
  }

  private executeShot() {
    const cur = this.currentDef;
    const ammo = this.ammoCounts[this.state.currentWeaponId];

    if (ammo.clip <= 0) {
      sound.playDryFire(this.state.currentWeaponId);
      this.startReload();
      return;
    }

    this.lastFireTime = this.schedulerState.simTime;
    ammo.clip -= 1;
    this.state.ammoInClip = ammo.clip;
    this.schedulerState.ammoInClip = ammo.clip;
    this.state.isFiring = true;

    try {
      // Diagnostic telemetry hook
      if (typeof window !== 'undefined') {
        const g = window as any;
        g.__shotTelemetry = g.__shotTelemetry || [];
        g.__shotTelemetry.push({
          t: performance.now(),
          simTime: this.schedulerState.simTime,
          ammo: ammo.clip,
          weapon: this.state.currentWeaponId,
          delta: this.lastDelta || 0
        });
      }

      // Recoil Impulses
      const adsDamp = this.state.isScoped ? 0.5 : 1.0;
      this.recoil.kickZ = cur.recoilKickZ * adsDamp;
      this.recoil.pitchX = cur.recoilPitchX * adsDamp;
      this.recoil.yawY = (Math.random() - 0.5) * cur.recoilYawY * adsDamp;
      this.recoil.rollZ = (Math.random() - 0.5) * 0.02 * adsDamp;

      // Immediately synchronize viewmodel transform so world matrices and muzzle position reflect firing recoil
      this.applyViewmodelTransform();

      // Camera Recoil
      if (this.onCameraRecoil) {
        const camPitch = cur.cameraRecoilKick * adsDamp * (1 + Math.random() * 0.2);
        const camYaw = (Math.random() - 0.5) * 0.008 * adsDamp;
        this.onCameraRecoil(camPitch, camYaw);
      }

      // Spread Bloom
      this.state.spreadRadius = Math.min(cur.spreadMax, this.state.spreadRadius + cur.spreadBloomPerShot);

      // Audio & Muzzle Flash & Animation (Never play handling sounds during fire trigger)
      if (this.state.currentWeaponId === 'ak47') {
        sound.playAK47Shot();
        if (ammo.clip <= 3 && ammo.clip > 0) {
          sound.playLowAmmoCue('ak47');
        }
        this.ak47.muzzleFlashGroup.visible = true;
        this.ak47.muzzleLight.intensity = 14;
        this.ak47.muzzleFlashGroup.rotation.z = Math.random() * Math.PI * 2;
        this.ak47.boltCarrierGroup.position.z = 0.07;
        this.ejectShell(this.ak47.ejectionPoint, true);
      } else if (this.state.currentWeaponId === 'pistol') {
        sound.playPistolShot();
        if (ammo.clip <= 3 && ammo.clip > 0) {
          sound.playLowAmmoCue('pistol');
        }
        this.pistol.muzzleFlashGroup.visible = true;
        this.pistol.muzzleLight.intensity = 10;
        this.pistol.slideGroup.position.z = 0.045;
        this.ejectShell(this.pistol.ejectionPoint, false);
      } else if (this.state.currentWeaponId === 'smg') {
        sound.playSMGShot(ammo.clip);
        this.smg.muzzleFlashGroup.visible = true;
        this.smg.muzzleLight.intensity = 12;
        this.smg.muzzleFlashGroup.rotation.z = Math.random() * Math.PI * 2;
        this.smg.boltCarrierGroup.position.z = 0.035;
        this.ejectShell(this.smg.ejectionPoint, false);
      } else if (this.state.currentWeaponId === 'shotgun') {
        sound.playShotgunShot();
        if (ammo.clip <= 2 && ammo.clip > 0) {
          sound.playLowAmmoCue('shotgun');
        }
        this.shotgun.muzzleFlashGroup.visible = true;
        this.shotgun.muzzleLight.intensity = 16;
        this.ejectShell(this.shotgun.ejectionPoint, true);

        // Procedural pump-action cycle: driven by state timers in update() (NO setTimeout)
        this.shotgunCycleStage = 1;
        this.shotgunCycleTimer = 0.22;
      } else if (this.state.currentWeaponId === 'sniper') {
        sound.playSniperShot();
        if (ammo.clip <= 1 && ammo.clip > 0) {
          sound.playLowAmmoCue('sniper');
        }
        this.sniper.muzzleFlashGroup.visible = true;
        this.sniper.muzzleLight.intensity = 20;
        this.ejectShell(this.sniper.ejectionPoint, true);

        // Procedural bolt cycle: driven by state timers in update() (NO setTimeout)
        this.sniperCycleStage = 1;
        this.sniperCycleTimer = 0.32;
      }

      // Raycast Callout: Handles single projectile or multi-pellet shotgun buckshot
      if (this.onFireRaycast) {
        const pelletCount = cur.pellets || 1;
        this.scratchForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
        this.scratchRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
        this.scratchUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);

        this.getActiveMuzzleWorldPosition(this.scratchMuzzlePos);

        for (let p = 0; p < pelletCount; p++) {
          const spread = this.state.isScoped ? this.state.spreadRadius * 0.4 : this.state.spreadRadius;
          const spreadX = (Math.random() - 0.5) * spread;
          const spreadY = (Math.random() - 0.5) * spread;

          this.scratchShotDir.copy(this.scratchForward)
            .addScaledVector(this.scratchRight, spreadX)
            .addScaledVector(this.scratchUp, spreadY)
            .normalize();

          this.onFireRaycast(
            this.scratchMuzzlePos.clone(),
            this.camera.position.clone(),
            this.scratchShotDir.clone(),
            cur
          );
        }
      }
    } finally {
      this.notifyState();
    }
  }

  public update(
    delta: number,
    mouseDelta: { x: number; y: number },
    isMoving: boolean,
    isSprinting: boolean,
    horizontalSpeed: number = 0
  ) {
    this.lastDelta = delta;
    this.state.isMoving = isMoving;
    this.state.isSprinting = isSprinting;

    const cur = this.currentDef;

    // 1. Physics Decay (Recoil, Sway, Muzzle Flash)
    const recSpeed = cur.recoilRecoverySpeed;
    this.recoil.kickZ = THREE.MathUtils.lerp(this.recoil.kickZ, 0, delta * recSpeed);
    this.recoil.pitchX = THREE.MathUtils.lerp(this.recoil.pitchX, 0, delta * recSpeed);
    this.recoil.yawY = THREE.MathUtils.lerp(this.recoil.yawY, 0, delta * recSpeed);
    this.recoil.rollZ = THREE.MathUtils.lerp(this.recoil.rollZ, 0, delta * recSpeed);

    // Muzzle Flash Decay
    if (this.schedulerState.simTime - this.lastFireTime > 0.045) {
      this.ak47.muzzleFlashGroup.visible = false;
      this.ak47.muzzleLight.intensity = 0;
      this.pistol.muzzleFlashGroup.visible = false;
      this.pistol.muzzleLight.intensity = 0;
      this.smg.muzzleFlashGroup.visible = false;
      this.smg.muzzleLight.intensity = 0;
      this.shotgun.muzzleFlashGroup.visible = false;
      this.shotgun.muzzleLight.intensity = 0;
      this.sniper.muzzleFlashGroup.visible = false;
      this.sniper.muzzleLight.intensity = 0;
    }

    // Post-fire Action Cycles (driven by frame delta, zero setTimeout)
    if (this.shotgunCycleTimer > 0) {
      this.shotgunCycleTimer -= delta;
      if (this.shotgunCycleTimer <= 0) {
        if (this.shotgunCycleStage === 1) {
          this.shotgunCycleStage = 2;
          this.shotgunCycleTimer = 0.14;
          this.shotgun.pumpGroup.position.z = -0.19;
          this.shotgun.updateSupportArm?.(-0.19);
          sound.playShotgunPumpBack();
        } else if (this.shotgunCycleStage === 2) {
          this.shotgunCycleStage = 0;
          this.shotgun.pumpGroup.position.z = -0.26;
          this.shotgun.updateSupportArm?.(-0.26);
          sound.playShotgunPumpForward();
        }
      }
    }

    if (this.state.currentWeaponId === 'shotgun') {
      this.shotgun.updateSupportArm?.();
    }

    if (this.sniperCycleTimer > 0) {
      this.sniperCycleTimer -= delta;
      if (this.sniperCycleTimer <= 0) {
        if (this.sniperCycleStage === 1) {
          this.sniperCycleStage = 2;
          this.sniperCycleTimer = 0.24;
          this.sniper.boltCarrierGroup.rotation.z = -0.45;
          this.sniper.boltCarrierGroup.position.z = 0.08;
          sound.playSniperBoltUnlock();
          sound.playSniperBoltPull();
        } else if (this.sniperCycleStage === 2) {
          this.sniperCycleStage = 0;
          this.sniper.boltCarrierGroup.position.z = 0.01;
          this.sniper.boltCarrierGroup.rotation.z = 0;
          sound.playSniperBoltPush();
          sound.playSniperBoltLock();
        }
      }
    }

    // Bolt Carrier / Slide Return
    this.ak47.boltCarrierGroup.position.z = THREE.MathUtils.lerp(this.ak47.boltCarrierGroup.position.z, 0.02, delta * 30);
    this.pistol.slideGroup.position.z = THREE.MathUtils.lerp(this.pistol.slideGroup.position.z, 0, delta * 30);
    this.smg.boltCarrierGroup.position.z = THREE.MathUtils.lerp(this.smg.boltCarrierGroup.position.z, -0.02, delta * 40);

    // Spread Decay
    const minSpread = this.state.isScoped ? cur.spreadBase * 0.35 : cur.spreadBase;
    this.state.spreadRadius = THREE.MathUtils.lerp(this.state.spreadRadius, minSpread, delta * cur.spreadDecayRate * 25);

    // 3. Mouse Look Inertia Sway
    const targetSwayX = -mouseDelta.x * 0.00045;
    const targetSwayY = -mouseDelta.y * 0.00045;
    this.sway.x = THREE.MathUtils.lerp(this.sway.x, targetSwayX, delta * 12);
    this.sway.y = THREE.MathUtils.lerp(this.sway.y, targetSwayY, delta * 12);

    // 4. Locomotion Bobbing & Calm Idle Breathing
    // Natural human cadence: walk ~1.85 Hz (111 steps/min), sprint 2.8–3.4 Hz (~180 steps/min).
    // Driven by actual displacement / velocity integration with zero per-frame alloc.
    this.idleBreathTimer += delta;
    if (this.idleBreathTimer > 100000) this.idleBreathTimer %= (2 * Math.PI);

    const adsScale = 1 - this.adsWeight * 0.85;

    // Smoothly blend movement weight based on actual horizontal motion
    const isActuallyMoving = isMoving && horizontalSpeed > 0.15;
    const targetMoveWeight = isActuallyMoving ? Math.min(1.0, horizontalSpeed / 2.2) : 0.0;
    this.moveWeight = THREE.MathUtils.lerp(this.moveWeight, targetMoveWeight, delta * 12);

    if (isActuallyMoving) {
      // Advance walk phase proportional to physical movement speed
      const walkRate = 1.85 * (2 * Math.PI); // 1.85 Hz
      const walkSpeedScale = Math.min(1.25, horizontalSpeed / 4.8);
      this.walkBobCycle += delta * walkRate * Math.max(0.2, walkSpeedScale);
      if (this.walkBobCycle > 100000) this.walkBobCycle %= (2 * Math.PI);

      if (isSprinting && this.sprintWeight > 0.05) {
        const spFreq = cur.sprintPose.bobFreq * (2 * Math.PI);
        const sprintSpeedScale = Math.min(1.2, horizontalSpeed / 8.5);
        this.sprintBobCycle += delta * spFreq * Math.max(0.3, sprintSpeedScale);
        if (this.sprintBobCycle > 100000) this.sprintBobCycle %= (2 * Math.PI);
      }
    }

    // Walk stride bob: natural side-to-side sway at half cadence, vertical bounce at stride cadence
    const walkX = Math.sin(this.walkBobCycle * 0.5) * 0.011 * adsScale;
    const walkY = Math.abs(Math.sin(this.walkBobCycle)) * 0.012 * adsScale;

    // Sprint stride bob: per-weapon shape from SprintPose
    const sp = cur.sprintPose;
    const sprintAmpX = sp.bobAmpX * adsScale;
    const sprintAmpY = sp.bobAmpY * adsScale;
    let sprintX = 0;
    let sprintY = 0;
    if (sp.bobShape === 'lissajous') {
      const fxRatio = sp.phaseRatio || 0.5;
      sprintX = Math.sin(this.sprintBobCycle * fxRatio + Math.PI * 0.5) * sprintAmpX;
      sprintY = Math.abs(Math.cos(this.sprintBobCycle)) * sprintAmpY;
    } else {
      sprintX = Math.sin(this.sprintBobCycle * 0.5) * sprintAmpX;
      sprintY = Math.abs(Math.cos(this.sprintBobCycle)) * sprintAmpY;
    }

    // Blend between walk and sprint strides
    const strideX = THREE.MathUtils.lerp(walkX, sprintX, this.sprintWeight);
    const strideY = THREE.MathUtils.lerp(walkY, sprintY, this.sprintWeight);

    // Calm idle breathing: subtle sinusoidal chest movement at 0.35 Hz (21 breaths/min)
    // NEVER a footstep bounce when standing still!
    const idleX = Math.sin(this.idleBreathTimer * 1.8) * 0.0008 * adsScale;
    const idleY = Math.sin(this.idleBreathTimer * 2.2) * 0.0012 * adsScale;

    // Final bob: smooth transition between calm idle breathing and locomotion stride
    const bobX = THREE.MathUtils.lerp(idleX, strideX, this.moveWeight);
    const bobY = THREE.MathUtils.lerp(idleY, strideY, this.moveWeight);

    // 5. ADS Transition Weight
    const targetAds = this.state.isScoped ? 1.0 : 0.0;
    this.adsWeight = THREE.MathUtils.lerp(this.adsWeight, targetAds, delta * 16);

    // Camera FOV Zoom
    const targetFov = THREE.MathUtils.lerp(75, cur.adsFov, this.adsWeight);
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // Hide weapon model during full Sniper Scope ADS for clear reticle view
    if (cur.isSniperScope) {
      this.sniper.root.visible = this.adsWeight < 0.85;
    }

    // 6. Sprint Carry Weight — Critically-Damped Spring (ζ = 1)
    // Uses the per-weapon ωₙ so each category snaps in/out at its own rate.
    const wasSprinting = this.lastWasSprinting;
    const targetSprint = isSprinting && !this.state.isScoped ? 1.0 : 0.0;
    {
      const omega = isSprinting ? sp.omegaIn : sp.omegaOut;
      // Critically-damped spring step: x'' + 2ωx' + ω²x = ω²·target
      // Stable closed-form integration for fixed dt (avoids instability at large dt).
      const clamped = Math.min(delta, 0.05); // cap spike to 50 ms
      const exp = Math.exp(-omega * clamped);
      const diff = this.sprintWeight - targetSprint;
      const vel = this.sprintVel;
      // New state
      this.sprintWeight = targetSprint + (diff + (diff * omega + vel) * clamped) * exp;
      this.sprintVel    = ((vel - (diff * omega + vel) * (1 + omega * clamped)) * exp);
      // Clamp to [0,1] to avoid tiny float overshoot due to numerical precision
      this.sprintWeight = Math.max(0, Math.min(1, this.sprintWeight));
    }

    // Sprint-out fire delay: block the scheduler for fireDelayOut seconds after sprint ends.
    if (!isSprinting && wasSprinting) {
      this.sprintOutTimer = sp.fireDelayOut;
    }
    if (this.sprintOutTimer > 0) {
      this.sprintOutTimer = Math.max(0, this.sprintOutTimer - delta);
      if (this.sprintOutTimer <= 1e-4) {
        this.sprintOutTimer = 0;
      }
    }
    this.lastWasSprinting = isSprinting; // update after timer logic for next frame's edge detection

    // 7. Weapon Switch Readying Weight
    if (this.switchWeight > 0) {
      this.switchWeight = Math.max(0, this.switchWeight - delta * 3.5);
    }

    // 8. Inspect Animation (V key)
    let inspectRotY = 0;
    let inspectRotZ = 0;
    if (this.inspectTimer > 0) {
      this.inspectTimer -= delta;
      const t = 1 - this.inspectTimer / 2.4;
      if (t < 0.4) {
        const p = t / 0.4;
        inspectRotY = -0.45 * Math.sin(p * Math.PI);
        inspectRotZ = 0.35 * Math.sin(p * Math.PI);
      } else if (t < 0.8) {
        const p = (t - 0.4) / 0.4;
        inspectRotY = 0.5 * Math.sin(p * Math.PI);
        inspectRotZ = -0.4 * Math.sin(p * Math.PI);
      }
    }

    // 9. Multi-Stage Reload Choreography
    let reloadPosY = 0;
    let reloadRotX = 0;
    let reloadRotZ = 0;

    if (this.state.isReloading) {
      this.reloadTimer += delta;
      const progress = Math.min(1, this.reloadTimer / this.reloadDuration);
      this.state.reloadProgress = progress;

      if (this.state.currentWeaponId === 'ak47') {
        // AK-47 Vanguard: Workspace tilt right, support hand release to magwell,
        // rock-and-lock 30-round curved banana mag swap, charging handle rack if empty, return to foregrip.
        if (progress < 0.20) {
          const p = progress / 0.20;
          const ease = p * p * (3 - 2 * p);
          reloadPosY = -0.09 * ease;
          reloadRotX = 0.24 * ease;
          reloadRotZ = -0.48 * ease;
          // Support hand leaves front wooden handguard toward mag release latch
          this.ak47.leftArmGroup.position.set(0.015 * ease, -0.025 * ease, 0.16 * ease);
          this.ak47.leftArmGroup.rotation.set(0.12 * ease, -0.15 * ease, 0.20 * ease);
        } else if (progress < 0.44) {
          if (this.reloadStage === 0) {
            this.reloadStage = 1;
            sound.playAKMagOut();
          }
          const p = (progress - 0.20) / 0.24;
          reloadPosY = -0.09;
          reloadRotX = 0.24;
          reloadRotZ = -0.48;
          // Empty magazine rocks forward and drops out of magwell
          const d = Math.pow(p, 1.5) * 0.48;
          this.ak47.magazineGroup.position.y = -0.04 - d * Math.cos(0.25);
          this.ak47.magazineGroup.position.z = -0.06 - d * Math.sin(0.25);
          this.ak47.magazineGroup.rotation.x = -p * 0.35;
          this.ak47.leftArmGroup.position.set(0.015, -0.025 - d * 0.55, 0.16);
        } else if (progress < 0.68) {
          // Fresh magazine rises from tactical rig and rocks into receiver
          const p = (progress - 0.44) / 0.24;
          const ease = p * p * (3 - 2 * p);
          const d = (1 - ease) * 0.42;
          reloadPosY = -0.09;
          reloadRotX = 0.24;
          reloadRotZ = -0.48;
          this.ak47.magazineGroup.position.y = -0.04 - d * Math.cos(0.25);
          this.ak47.magazineGroup.position.z = -0.06 - d * Math.sin(0.25);
          this.ak47.magazineGroup.rotation.x = -(1 - ease) * 0.35;

          this.ak47.leftArmGroup.position.set(
            0.015,
            THREE.MathUtils.lerp(-0.26, -0.03, ease),
            THREE.MathUtils.lerp(0.05, 0.15, ease)
          );
          this.ak47.leftArmGroup.rotation.set(
            THREE.MathUtils.lerp(-0.15, 0.10, ease),
            -0.15 * (1 - ease),
            0.20 * ease
          );

          if (progress >= 0.62 && this.reloadStage === 1) {
            this.reloadStage = 2;
            sound.playAKMagIn();
            this.recoil.kickZ += 0.024;
            reloadPosY += 0.012;
            this.ak47.magazineGroup.rotation.set(0, 0, 0);
          }
        } else if (progress < 0.85) {
          this.ak47.magazineGroup.position.set(0, -0.04, -0.06);
          this.ak47.magazineGroup.rotation.set(0, 0, 0);
          if (this.reloadWasEmpty) {
            // Charging handle rack on empty reload
            const p = (progress - 0.68) / 0.17;
            if (p < 0.55) {
              const u = p / 0.55;
              this.ak47.boltCarrierGroup.position.z = 0.02 + u * 0.055;
              this.ak47.leftArmGroup.position.set(0.035 * u, 0.04 * u, 0.22 * (1 - u));
            } else {
              if (progress >= 0.76 && this.reloadStage === 2) {
                this.reloadStage = 3;
                sound.playAKBoltRack();
                this.ak47.boltCarrierGroup.position.z = 0.02;
                this.recoil.kickZ += 0.018;
              }
            }
          } else {
            const p = (progress - 0.68) / 0.17;
            this.ak47.leftArmGroup.position.set(0.015 * (1 - p), -0.03 * (1 - p), 0.15 * (1 - p));
          }
        } else {
          // Return to lower wooden handguard
          const p = (progress - 0.85) / 0.15;
          const ease = p * p * (3 - 2 * p);
          reloadPosY = -0.09 * (1 - ease);
          reloadRotX = 0.24 * (1 - ease);
          reloadRotZ = -0.48 * (1 - ease);
          this.ak47.magazineGroup.position.set(0, -0.04, -0.06);
          this.ak47.boltCarrierGroup.position.z = 0.02;
          this.ak47.leftArmGroup.position.set(0.015 * (1 - ease), -0.03 * (1 - ease), 0.15 * (1 - ease));
          this.ak47.leftArmGroup.rotation.set(0.10 * (1 - ease), 0, 0.20 * (1 - ease));
        }
      } else if (this.state.currentWeaponId === 'shotgun') {
        // Authentic Shotgun Shell-by-Shell Feed and Racking with Mid-Reload Interrupt
        if (progress < 0.16) {
          const p = progress / 0.16;
          const e = p * p * (3 - 2 * p);
          reloadPosY = -0.075 * e;
          reloadRotX = 0.28 * e;
          reloadRotZ = -0.34 * e;
        } else if (progress < 0.82) {
          reloadPosY = -0.075;
          reloadRotX = 0.28;
          reloadRotZ = -0.34;
        } else {
          const p = (progress - 0.82) / 0.18;
          const e = p * p * (3 - 2 * p);
          reloadPosY = -0.075 * (1 - e);
          reloadRotX = 0.28 * (1 - e);
          reloadRotZ = -0.34 * (1 - e);
        }

        const curAmmo = this.ammoCounts.shotgun;

        // 4 Sequential shell insertion stages: [0.16, 0.32], [0.32, 0.48], [0.48, 0.64], [0.64, 0.80]
        const stages = [
          { start: 0.16, end: 0.32, commit: 0.24, stageIdx: 0, nextStage: 1 },
          { start: 0.32, end: 0.48, commit: 0.40, stageIdx: 1, nextStage: 2 },
          { start: 0.48, end: 0.64, commit: 0.56, stageIdx: 2, nextStage: 3 },
          { start: 0.64, end: 0.80, commit: 0.72, stageIdx: 3, nextStage: 4 },
        ];

        let inInsertPhase = false;
        for (const st of stages) {
          if (progress >= st.start && progress < st.end) {
            inInsertPhase = true;
            const s = (progress - st.start) / (st.end - st.start);
            this.shotgun.shellGroup.visible = true;

            if (s < 0.45) {
              // Bring shell from pouch up toward gate
              const u = s / 0.45;
              const e = u * u * (3 - 2 * u);
              this.shotgun.shellGroup.position.set(
                THREE.MathUtils.lerp(-0.04, 0.0, e),
                THREE.MathUtils.lerp(-0.14, -0.025, e),
                THREE.MathUtils.lerp(0.06, 0.02, e)
              );
              this.shotgun.shellGroup.rotation.set(
                THREE.MathUtils.lerp(-0.35, 0.0, e),
                THREE.MathUtils.lerp(0.20, 0.0, e),
                0
              );
              if (this.shotgun.leftHandGroup) {
                this.shotgun.leftHandGroup.position.set(
                  THREE.MathUtils.lerp(0.0, -0.02, e),
                  THREE.MathUtils.lerp(0.0, -0.035, e),
                  THREE.MathUtils.lerp(0.0, 0.18, e)
                );
              }
            } else {
              // Push shell forward into tube
              const u = (s - 0.45) / 0.55;
              const e = u * u * (3 - 2 * u);
              this.shotgun.shellGroup.position.set(0, -0.016, THREE.MathUtils.lerp(0.02, -0.065, e));
              this.shotgun.shellGroup.rotation.set(0, 0, 0);
              if (this.shotgun.leftHandGroup) {
                this.shotgun.leftHandGroup.position.set(
                  -0.02,
                  -0.035,
                  THREE.MathUtils.lerp(0.18, 0.14, e)
                );
              }
            }
            this.shotgun.updateSupportArm?.();

            if (progress >= st.commit && this.reloadStage === st.stageIdx) {
              this.reloadStage = st.nextStage;
              sound.playShotgunShellInsert();
              const toAdd = Math.min(2, cur.magCapacity - curAmmo.clip, curAmmo.reserve);
              curAmmo.clip += toAdd;
              curAmmo.reserve -= toAdd;
              this.state.ammoInClip = curAmmo.clip;
              this.state.reserveAmmo = curAmmo.reserve;
              this.schedulerState.ammoInClip = curAmmo.clip;
              this.notifyState();
              this.recoil.kickZ += 0.014;
            }

            if (progress >= st.commit + 0.05 && (curAmmo.clip >= cur.magCapacity || curAmmo.reserve <= 0)) {
              if (this.reloadTimer < this.reloadDuration * 0.80) {
                this.reloadTimer = this.reloadDuration * 0.80;
                this.reloadStage = 4;
              }
            }
            break;
          }
        }

        if (!inInsertPhase) {
          this.shotgun.shellGroup.visible = false;
        }

        if (progress >= 0.80 && progress < 0.86) {
          // Hand smoothly slides back onto grooved pump handle
          const p = (progress - 0.80) / 0.06;
          const e = p * p * (3 - 2 * p);
          if (this.shotgun.leftHandGroup) {
            this.shotgun.leftHandGroup.position.set(
              -0.02 * (1 - e),
              -0.035 * (1 - e),
              0.14 * (1 - e)
            );
          }
          this.shotgun.updateSupportArm?.();
        } else if (progress >= 0.86) {
          if (this.shotgun.leftHandGroup) {
            this.shotgun.leftHandGroup.position.set(0, 0, 0);
          }

          if (this.reloadWasEmpty) {
            // Chamber first shell on empty reload
            if (progress < 0.93) {
              const p = (progress - 0.86) / 0.07;
              const e = p * p * (3 - 2 * p);
              this.shotgun.pumpGroup.position.z = THREE.MathUtils.lerp(-0.26, -0.19, e);
              this.shotgun.updateSupportArm?.(this.shotgun.pumpGroup.position.z);
              if (progress >= 0.88 && this.reloadStage === 4) {
                this.reloadStage = 5;
                sound.playShotgunPumpBack();
              }
            } else {
              const p = (progress - 0.93) / 0.07;
              const e = p * p * (3 - 2 * p);
              this.shotgun.pumpGroup.position.z = THREE.MathUtils.lerp(-0.19, -0.26, e);
              this.shotgun.updateSupportArm?.(this.shotgun.pumpGroup.position.z);
              if (progress >= 0.95 && this.reloadStage === 5) {
                this.reloadStage = 6;
                sound.playShotgunPumpForward();
              }
            }
          } else {
            this.shotgun.pumpGroup.position.z = -0.26;
            this.shotgun.updateSupportArm?.(-0.26);
          }
        }
      } else if (this.state.currentWeaponId === 'sniper') {
        // AW-50 Heavy Sniper: Deliberate workspace tilt, bolt cycle (if empty),
        // support hand magazine strip and insert, and smooth return to forend.
        if (progress < 0.18) {
          const p = progress / 0.18;
          const ease = p * p * (3 - 2 * p);
          reloadPosY = -0.08 * ease;
          reloadRotX = 0.18 * ease;
          reloadRotZ = 0.10 * ease;
          // Left hand slides back from forend toward heavy box magazine
          this.sniper.leftArmGroup.position.set(0.012 * ease, -0.035 * ease, 0.18 * ease);
          this.sniper.leftArmGroup.rotation.set(0.08 * ease, 0.10 * ease, -0.12 * ease);
        } else if (progress < 0.82) {
          reloadPosY = -0.08;
          reloadRotX = 0.18;
          reloadRotZ = 0.10;
        } else {
          const p = (progress - 0.82) / 0.18;
          const ease = p * p * (3 - 2 * p);
          reloadPosY = -0.08 * (1 - ease);
          reloadRotX = 0.18 * (1 - ease);
          reloadRotZ = 0.10 * (1 - ease);
          this.sniper.leftArmGroup.position.set(0.012 * (1 - ease), -0.035 * (1 - ease), 0.18 * (1 - ease));
          this.sniper.leftArmGroup.rotation.set(0.08 * (1 - ease), 0.10 * (1 - ease), -0.12 * (1 - ease));
        }

        // Bolt handling (if empty reload)
        if (this.reloadWasEmpty) {
          if (progress < 0.10) {
            const p = progress / 0.10;
            const ease = p * p * (3 - 2 * p);
            this.sniper.boltCarrierGroup.rotation.z = -0.45 * ease;
          } else if (progress < 0.20) {
            this.sniper.boltCarrierGroup.rotation.z = -0.45;
            const p = (progress - 0.10) / 0.10;
            const ease = p * p * (3 - 2 * p);
            this.sniper.boltCarrierGroup.position.z = 0.01 + 0.07 * ease;
          } else if (progress < 0.76) {
            this.sniper.boltCarrierGroup.rotation.z = -0.45;
            this.sniper.boltCarrierGroup.position.z = 0.08;
          } else if (progress < 0.85) {
            const p = (progress - 0.76) / 0.09;
            const ease = p * p * (3 - 2 * p);
            this.sniper.boltCarrierGroup.position.z = 0.08 - 0.07 * ease;
            this.sniper.boltCarrierGroup.rotation.z = -0.45;
          } else if (progress < 0.94) {
            this.sniper.boltCarrierGroup.position.z = 0.01;
            const p = (progress - 0.85) / 0.09;
            const ease = p * p * (3 - 2 * p);
            this.sniper.boltCarrierGroup.rotation.z = -0.45 * (1 - ease);
          } else {
            this.sniper.boltCarrierGroup.position.z = 0.01;
            this.sniper.boltCarrierGroup.rotation.z = 0;
          }

          if (progress >= 0.08 && this.reloadStage === 0) {
            this.reloadStage = 1;
            sound.playSniperBoltUnlock();
          } else if (progress >= 0.16 && this.reloadStage === 1) {
            this.reloadStage = 2;
            sound.playSniperBoltPull();
          }
        } else {
          this.sniper.boltCarrierGroup.position.set(0.028, 0.032, 0.01);
          this.sniper.boltCarrierGroup.rotation.set(0, 0, 0);
          if (this.reloadStage === 0) {
            this.reloadStage = 2; // skip bolt unlock/pull for tactical
          }
        }

        // Magazine extract & insert (progress 0.20 to 0.72)
        if (progress >= 0.20 && progress < 0.44) {
          const p = (progress - 0.20) / 0.24;
          const d = Math.pow(p, 1.4) * 0.38;
          this.sniper.magazineGroup.position.y = -0.08 - d;
          this.sniper.leftArmGroup.position.set(0.012, -0.035 - d * 0.70, 0.18);
          if (progress >= 0.32 && this.reloadStage === 2) {
            this.reloadStage = 3;
            sound.playSniperMagOut();
          }
        } else if (progress >= 0.44 && progress < 0.72) {
          const p = (progress - 0.44) / 0.28;
          const ease = p * p * (3 - 2 * p);
          const d = (1 - ease) * 0.38;
          this.sniper.magazineGroup.position.y = -0.08 - d;
          this.sniper.leftArmGroup.position.set(
            0.012,
            -0.035 - d * 0.70,
            0.18
          );
          if (progress >= 0.65 && this.reloadStage === 3) {
            this.reloadStage = 4;
            sound.playSniperMagIn();
            this.recoil.kickZ += 0.018;
          }
        } else if (progress >= 0.72) {
          this.sniper.magazineGroup.position.set(0, -0.08, -0.06);
          if (this.reloadWasEmpty) {
            if (progress >= 0.80 && this.reloadStage === 4) {
              this.reloadStage = 5;
              sound.playSniperBoltPush();
            } else if (progress >= 0.90 && this.reloadStage === 5) {
              this.reloadStage = 6;
              sound.playSniperBoltLock();
              this.recoil.kickZ += 0.012;
            }
          }
        }
      } else if (this.state.currentWeaponId === 'pistol') {
        // M9 Combat Pistol: Deliberate workspace tilt, natural grip slant ejection,
        // support hand magazine retrieve/seat slap, and tactile slide release.
        if (progress < 0.18) {
          const p = progress / 0.18;
          const e = p * p * (3 - 2 * p);
          reloadPosY = -0.045 * e;
          reloadRotX = 0.16 * e;
          reloadRotZ = -0.18 * e;
        } else if (progress < 0.82) {
          reloadPosY = -0.045;
          reloadRotX = 0.16;
          reloadRotZ = -0.18;
        } else {
          const p = (progress - 0.82) / 0.18;
          const e = p * p * (3 - 2 * p);
          reloadPosY = -0.045 * (1 - e);
          reloadRotX = 0.16 * (1 - e);
          reloadRotZ = -0.18 * (1 - e);
        }

        // Slide locked back if empty
        if (this.reloadWasEmpty && progress < 0.74) {
          this.pistol.slideGroup.position.z = 0.042;
        }

        if (progress >= 0.10 && this.reloadStage === 0) {
          this.reloadStage = 1;
          sound.playPistolMagOut();
        }

        if (progress < 0.22) {
          // Support hand drops toward pouch
          const p = progress / 0.22;
          const e = p * p * (3 - 2 * p);
          this.pistol.leftArmGroup.position.set(-0.02 * e, -0.22 * e, -0.04 * e);
          this.pistol.leftArmGroup.rotation.set(-0.25 * e, 0.15 * e, -0.18 * e);
          this.pistol.magazineGroup.position.set(0, -0.075, 0.015);
        } else if (progress < 0.44) {
          // Empty magazine drops along grip slant (0.36 rad)
          const p = (progress - 0.22) / 0.22;
          const d = Math.pow(p, 1.6) * 0.45;
          this.pistol.magazineGroup.position.y = -0.075 - d * Math.cos(0.36);
          this.pistol.magazineGroup.position.z = 0.015 - d * Math.sin(0.36);
          this.pistol.leftArmGroup.position.set(-0.025, -0.24, -0.04);
        } else if (progress < 0.68) {
          // Fresh magazine rises and slides smoothly into magwell
          const p = (progress - 0.44) / 0.24;
          const e = p * p * (3 - 2 * p);
          const d = (1 - e) * 0.35;
          this.pistol.magazineGroup.position.y = -0.075 - d * Math.cos(0.36);
          this.pistol.magazineGroup.position.z = 0.015 - d * Math.sin(0.36);

          this.pistol.leftArmGroup.position.set(
            THREE.MathUtils.lerp(-0.025, -0.005, e),
            THREE.MathUtils.lerp(-0.24, -0.065, e),
            THREE.MathUtils.lerp(-0.04, 0.015, e)
          );
          this.pistol.leftArmGroup.rotation.set(
            THREE.MathUtils.lerp(-0.25, 0.08, e),
            THREE.MathUtils.lerp(0.15, 0.05, e),
            THREE.MathUtils.lerp(-0.18, 0.0, e)
          );

          if (progress >= 0.63 && this.reloadStage === 1) {
            this.reloadStage = 2;
            sound.playPistolMagIn();
            this.recoil.kickZ += 0.022;
            reloadPosY += 0.012;
          }
        } else if (progress < 0.80) {
          this.pistol.magazineGroup.position.set(0, -0.075, 0.015);
          if (this.reloadWasEmpty) {
            if (progress >= 0.74 && this.reloadStage === 2) {
              this.reloadStage = 3;
              sound.playPistolSlideRelease();
              this.pistol.slideGroup.position.z = 0;
              this.recoil.kickZ += 0.018;
            }
          }
        } else {
          // Return to two-handed combat grip
          const p = (progress - 0.80) / 0.20;
          const e = p * p * (3 - 2 * p);
          this.pistol.magazineGroup.position.set(0, -0.075, 0.015);
          this.pistol.leftArmGroup.position.set(
            -0.005 * (1 - e),
            -0.065 * (1 - e),
            0.015 * (1 - e)
          );
          this.pistol.leftArmGroup.rotation.set(
            0.08 * (1 - e),
            0.05 * (1 - e),
            0
          );
        }
      } else if (this.state.currentWeaponId === 'smg') {
        // Cyclone-9 SMG: Shoulder-tucked posture, straight stick mag strip & slap,
        // and left-side reciprocating charging handle action.
        if (progress < 0.18) {
          const p = progress / 0.18;
          const e = p * p * (3 - 2 * p);
          reloadPosY = -0.055 * e;
          reloadRotX = 0.20 * e;
          reloadRotZ = -0.28 * e;
        } else if (progress < 0.82) {
          reloadPosY = -0.055;
          reloadRotX = 0.20;
          reloadRotZ = -0.28;
        } else {
          const p = (progress - 0.82) / 0.18;
          const e = p * p * (3 - 2 * p);
          reloadPosY = -0.055 * (1 - e);
          reloadRotX = 0.20 * (1 - e);
          reloadRotZ = -0.28 * (1 - e);
        }

        if (progress >= 0.10 && this.reloadStage === 0) {
          this.reloadStage = 1;
          sound.playSMGMagOut();
        }

        if (progress < 0.18) {
          // Support hand moves back from front vertical grip to magwell
          const p = progress / 0.18;
          const e = p * p * (3 - 2 * p);
          this.smg.leftArmGroup.position.set(0.012 * e, -0.035 * e, 0.095 * e);
          this.smg.magazineGroup.position.set(0, -0.06, -0.06);
        } else if (progress < 0.42) {
          // Pull empty stick magazine downward along magwell rake (0.08 rad)
          const p = (progress - 0.18) / 0.24;
          const d = Math.pow(p, 1.5) * 0.45;
          this.smg.magazineGroup.position.y = -0.06 - d * Math.cos(0.08);
          this.smg.magazineGroup.position.z = -0.06 - d * Math.sin(0.08);
          this.smg.leftArmGroup.position.set(0.012, -0.035 - d * 0.65, 0.095);
        } else if (progress < 0.66) {
          // Fresh stick magazine rises into flared magwell
          const p = (progress - 0.42) / 0.24;
          const e = p * p * (3 - 2 * p);
          const d = (1 - e) * 0.40;
          this.smg.magazineGroup.position.y = -0.06 - d * Math.cos(0.08);
          this.smg.magazineGroup.position.z = -0.06 - d * Math.sin(0.08);

          this.smg.leftArmGroup.position.set(
            0.012,
            THREE.MathUtils.lerp(-0.28, -0.05, e),
            THREE.MathUtils.lerp(0.02, 0.085, e)
          );

          if (progress >= 0.63 && this.reloadStage === 1) {
            this.reloadStage = 2;
            sound.playSMGMagIn();
            this.recoil.kickZ += 0.024;
            reloadPosY += 0.014;
          }
        } else if (progress < 0.82) {
          this.smg.magazineGroup.position.set(0, -0.06, -0.06);
          if (this.reloadWasEmpty) {
            // Left hand racks charging handle on left side
            const p = (progress - 0.66) / 0.16;
            if (p < 0.55) {
              const u = p / 0.55;
              this.smg.boltCarrierGroup.position.z = -0.02 + u * 0.055;
              this.smg.leftArmGroup.position.set(-0.035 * u, 0.05 * u, 0.085 * (1 - u));
            } else {
              if (progress >= 0.75 && this.reloadStage === 2) {
                this.reloadStage = 3;
                sound.playSMGBolt();
                this.smg.boltCarrierGroup.position.z = -0.02;
                this.recoil.kickZ += 0.016;
              }
            }
          } else {
            const p = (progress - 0.66) / 0.16;
            this.smg.leftArmGroup.position.set(0.012 * (1 - p), -0.05 * (1 - p), 0.085 * (1 - p));
          }
        } else {
          // Re-grasp front vertical foregrip
          const p = (progress - 0.82) / 0.18;
          const e = p * p * (3 - 2 * p);
          this.smg.magazineGroup.position.set(0, -0.06, -0.06);
          this.smg.boltCarrierGroup.position.z = -0.02;
          this.smg.leftArmGroup.position.set(
            0.012 * (1 - e),
            -0.035 * (1 - e),
            0.085 * (1 - e)
          );
        }
      }

      if (progress >= 1) {
        this.state.isReloading = false;
        if (this.state.currentWeaponId !== 'shotgun') {
          const curAmmo = this.ammoCounts[this.state.currentWeaponId];
          const needed = cur.magCapacity - curAmmo.clip;
          const toLoad = Math.min(needed, curAmmo.reserve);
          curAmmo.clip += toLoad;
          curAmmo.reserve -= toLoad;
          this.state.ammoInClip = curAmmo.clip;
          this.state.reserveAmmo = curAmmo.reserve;
          this.schedulerState.ammoInClip = curAmmo.clip;
        }
        this.schedulerState.isReloading = false;
        this.schedulerState.nextShotTime = this.schedulerState.simTime;

        this.resetSubgroupsToRest();
        this.notifyState();
      }
    }

    // 10. Transform Blending & Assembly (zero per-frame alloc)
    this.currentBobX = bobX;
    this.currentBobY = bobY;
    this.currentReloadPosY = reloadPosY;
    this.currentReloadRotX = reloadRotX;
    this.currentReloadRotZ = reloadRotZ;
    this.currentInspectRotY = inspectRotY;
    this.currentInspectRotZ = inspectRotZ;

    this.applyViewmodelTransform();

    // 11. Firing Cadence via Single Simple Fire Scheduler (evaluated with fully-assembled viewmodel)
    this.schedulerState.ammoInClip = this.ammoCounts[this.state.currentWeaponId].clip;
    this.schedulerState.isReloading = this.state.isReloading;
    this.schedulerState.isSwapping = this.switchWeight > 0.05;
    this.schedulerState.isSprinting = isSprinting || this.sprintOutTimer > 0 || this.sprintWeight > 0.05;
    this.schedulerState.fireMode = cur.fireMode;
    this.schedulerState.fireInterval = cur.fireRate;
    this.schedulerState.cycleTime = cur.fireRate;

    stepFireScheduler(this.schedulerState, delta, () => {
      this.executeShot();
    });

    // 12. Update Flying Shell Casings
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const shell = this.shells[i];
      shell.life -= delta;
      if (shell.life <= 0) {
        this.scene.remove(shell.mesh);
        this.shells.splice(i, 1);
        continue;
      }

      shell.velocity.y -= 9.8 * delta;
      shell.mesh.position.addScaledVector(shell.velocity, delta);
      shell.mesh.rotation.x += shell.rotVelocity.x * delta;
      shell.mesh.rotation.y += shell.rotVelocity.y * delta;

      if (shell.mesh.position.y < 0.05) {
        shell.mesh.position.y = 0.05;
        shell.velocity.y = -shell.velocity.y * 0.45;
        shell.velocity.x *= 0.65;
        shell.velocity.z *= 0.65;
      }
    }
  }

  private notifyState() {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }
}
