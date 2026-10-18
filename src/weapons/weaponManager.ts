// src/weapons/weaponManager.ts
// Weapon Manager: Handles viewmodel lifecycle, recoil physics, shell ejections,
// procedural reload choreography, ADS, audio sync, and ballistics for all 5 weapons.

import * as THREE from 'three';
import type { WeaponId, WeaponDef } from './weaponTypes';
import { WEAPON_REGISTRY } from './weaponTypes';
import { createAK47Model } from './ak47Model';
import type { AK47Components } from './ak47Model';
import { createPistolModel } from './pistolModel';
import type { PistolComponents } from './pistolModel';
import { createSMGModel } from './smgModel';
import type { SMGComponents } from './smgModel';
import { createShotgunModel } from './shotgunModel';
import type { ShotgunComponents } from './shotgunModel';
import { createSniperModel } from './sniperModel';
import type { SniperComponents } from './sniperModel';
import { sound } from '../audio/soundManager';
import {
  type FireSchedulerState,
  stepFireScheduler,
  onTriggerPress,
  onTriggerRelease,
  onWeaponEquip,
} from './fireScheduler';

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
  private sprintWeight = 0;
  private switchWeight = 0; // 0 = ready, 1 = lowered during switch
  private inspectTimer = 0; // > 0 when inspecting weapon (V key)

  private lastFireTime = 0;
  private schedulerState: FireSchedulerState;
  private lastDelta = 0;
  private reloadTimer = 0;
  private reloadDuration = 0;
  private reloadStage = 0;

  private shells: ShellCasing[] = [];
  private shellMaterial: THREE.MeshStandardMaterial;

  public onCameraRecoil?: (pitch: number, yaw: number) => void;
  public onFireRaycast?: (origin: THREE.Vector3, direction: THREE.Vector3, weaponDef: WeaponDef) => void;
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

  public switchWeapon(id: WeaponId) {
    if (this.state.currentWeaponId === id || this.state.isReloading) return;

    sound.playWeaponSwitch();
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

    this.state.isReloading = false;
    this.reloadTimer = 0;
    this.reloadStage = 0;

    // Reset sub-groups to rest positions
    this.ak47.magazineGroup.position.set(0, -0.04, -0.06);
    this.ak47.magazineGroup.rotation.set(0, 0, 0);
    this.ak47.boltCarrierGroup.position.set(0.025, 0.02, 0.02);
    this.ak47.leftArmGroup.position.set(0, 0, 0);
    this.ak47.leftArmGroup.rotation.set(0, 0, 0);

    this.pistol.magazineGroup.position.set(0, -0.075, 0.015);
    this.pistol.slideGroup.position.set(0, 0.022, 0);

    this.smg.magazineGroup.position.set(0, -0.06, -0.06);
    this.smg.magazineGroup.rotation.set(0, 0, 0);
    this.smg.boltCarrierGroup.position.set(0.022, 0.028, -0.02);
    this.smg.leftArmGroup.position.set(0, 0, 0);
    this.smg.leftArmGroup.rotation.set(0, 0, 0);

    this.shotgun.pumpGroup.position.set(0, 0.018, -0.26);
    this.shotgun.shellGroup.position.set(0, -0.016, -0.02);

    this.sniper.boltCarrierGroup.position.set(0.028, 0.032, 0.01);
    this.sniper.boltCarrierGroup.rotation.set(0, 0, 0);
    this.sniper.magazineGroup.position.set(0, -0.08, -0.06);

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
    this.inspectTimer = 0;
    // Reset all sub-group positions to resting state
    this.ak47.magazineGroup.position.set(0, -0.04, -0.06);
    this.ak47.magazineGroup.rotation.set(0, 0, 0);
    this.ak47.boltCarrierGroup.position.set(0.025, 0.02, 0.02);
    this.pistol.magazineGroup.position.set(0, -0.075, 0.015);
    this.pistol.slideGroup.position.set(0, 0.022, 0);
    this.smg.magazineGroup.position.set(0, -0.06, -0.06);
    this.smg.magazineGroup.rotation.set(0, 0, 0);
    this.smg.boltCarrierGroup.position.set(0.022, 0.028, -0.02);
    this.shotgun.pumpGroup.position.set(0, 0.018, -0.26);
    this.shotgun.shellGroup.position.set(0, -0.016, -0.02);
    this.sniper.boltCarrierGroup.position.set(0.028, 0.032, 0.01);
    this.sniper.boltCarrierGroup.rotation.set(0, 0, 0);
    this.sniper.magazineGroup.position.set(0, -0.08, -0.06);
    this.notifyState();
  }

  public setTrigger(isPressed: boolean) {
    if (isPressed) {
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
      ammo.reserve = 999;
      this.state.reserveAmmo = 999;
    }

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
      sound.playDryFire();
      this.startReload();
      return;
    }

    this.lastFireTime = this.schedulerState.simTime;
    ammo.clip -= 1;
    this.state.ammoInClip = ammo.clip;
    this.schedulerState.ammoInClip = ammo.clip;
    this.state.isFiring = true;

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

    // Camera Recoil
    if (this.onCameraRecoil) {
      const camPitch = cur.cameraRecoilKick * adsDamp * (1 + Math.random() * 0.2);
      const camYaw = (Math.random() - 0.5) * 0.008 * adsDamp;
      this.onCameraRecoil(camPitch, camYaw);
    }

    // Spread Bloom
    this.state.spreadRadius = Math.min(cur.spreadMax, this.state.spreadRadius + cur.spreadBloomPerShot);

    // Audio & Muzzle Flash & Animation
    if (this.state.currentWeaponId === 'ak47') {
      sound.playAK47Shot();
      this.ak47.muzzleFlashGroup.visible = true;
      this.ak47.muzzleLight.intensity = 14;
      this.ak47.muzzleFlashGroup.rotation.z = Math.random() * Math.PI * 2;
      this.ak47.boltCarrierGroup.position.z = 0.07;
      this.ejectShell(this.ak47.ejectionPoint, true);
    } else if (this.state.currentWeaponId === 'pistol') {
      sound.playPistolShot();
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
      this.shotgun.muzzleFlashGroup.visible = true;
      this.shotgun.muzzleLight.intensity = 16;
      this.ejectShell(this.shotgun.ejectionPoint, true);

      // Procedural pump-action cycle
      setTimeout(() => {
        if (this.state.currentWeaponId === 'shotgun') {
          sound.playShotgunPump();
          this.shotgun.pumpGroup.position.z = -0.19; // Pump back
          setTimeout(() => {
            if (this.state.currentWeaponId === 'shotgun') {
              this.shotgun.pumpGroup.position.z = -0.26; // Pump forward
            }
          }, 140);
        }
      }, 220);
    } else if (this.state.currentWeaponId === 'sniper') {
      sound.playSniperShot();
      this.sniper.muzzleFlashGroup.visible = true;
      this.sniper.muzzleLight.intensity = 20;
      this.ejectShell(this.sniper.ejectionPoint, true);

      // Procedural bolt cycle
      setTimeout(() => {
        if (this.state.currentWeaponId === 'sniper') {
          sound.playSniperBolt();
          this.sniper.boltCarrierGroup.rotation.z = -0.45; // Unlock bolt
          this.sniper.boltCarrierGroup.position.z = 0.08; // Draw back
          setTimeout(() => {
            if (this.state.currentWeaponId === 'sniper') {
              this.sniper.boltCarrierGroup.position.z = 0.01; // Push forward
              this.sniper.boltCarrierGroup.rotation.z = 0; // Lock into battery
            }
          }, 240);
        }
      }, 320);
    }

    // Raycast Callout: Handles single projectile or multi-pellet shotgun buckshot
    if (this.onFireRaycast) {
      const pelletCount = cur.pellets || 1;
      const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

      for (let p = 0; p < pelletCount; p++) {
        const spread = this.state.isScoped ? this.state.spreadRadius * 0.4 : this.state.spreadRadius;
        const spreadX = (Math.random() - 0.5) * spread;
        const spreadY = (Math.random() - 0.5) * spread;

        const shotDir = camDir.clone()
          .add(right.multiplyScalar(spreadX))
          .add(up.multiplyScalar(spreadY))
          .normalize();

        this.onFireRaycast(this.camera.position.clone(), shotDir, cur);
      }
    }

    this.notifyState();
  }

  public update(delta: number, mouseDelta: { x: number; y: number }, isMoving: boolean, isSprinting: boolean) {
    this.lastDelta = delta;
    this.state.isMoving = isMoving;
    this.state.isSprinting = isSprinting;

    const cur = this.currentDef;
    // 1. Firing Cadence via Single Simple Fire Scheduler
    this.schedulerState.ammoInClip = this.ammoCounts[this.state.currentWeaponId].clip;
    this.schedulerState.isReloading = this.state.isReloading;
    this.schedulerState.isSwapping = this.switchWeight > 0.05;
    this.schedulerState.isSprinting = isSprinting;
    this.schedulerState.fireMode = cur.fireMode;
    this.schedulerState.fireInterval = cur.fireRate;
    this.schedulerState.cycleTime = cur.fireRate;

    stepFireScheduler(this.schedulerState, delta, () => {
      this.executeShot();
    });

    // 2. Physics Decay (Recoil, Sway, Muzzle Flash)
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

    // 4. Locomotion Bobbing
    const bobFreq = isSprinting ? 13 : isMoving ? 8 : 2;
    const bobAmpX = (isSprinting ? 0.025 : isMoving ? 0.014 : 0.004) * (1 - this.adsWeight * 0.85);
    const bobAmpY = (isSprinting ? 0.035 : isMoving ? 0.018 : 0.006) * (1 - this.adsWeight * 0.85);

    const bobTime = performance.now() * 0.001;
    const bobX = Math.sin(bobTime * bobFreq) * bobAmpX;
    const bobY = Math.abs(Math.cos(bobTime * bobFreq)) * bobAmpY;

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

    // 6. Sprint Lowering Weight
    const targetSprint = isSprinting && !this.state.isScoped ? 1.0 : 0.0;
    this.sprintWeight = THREE.MathUtils.lerp(this.sprintWeight, targetSprint, delta * 10);

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
        if (progress < 0.22) {
          const p = progress / 0.22;
          const ease = p * p * (3 - 2 * p);
          reloadPosY = -0.09 * ease;
          reloadRotX = 0.24 * ease;
          reloadRotZ = -0.48 * ease;
        } else if (progress < 0.44) {
          if (this.reloadStage === 0) {
            this.reloadStage = 1;
            sound.playMagOut();
          }
          const p = (progress - 0.22) / 0.22;
          reloadPosY = -0.09;
          reloadRotX = 0.24;
          reloadRotZ = -0.48;
          this.ak47.magazineGroup.position.y = -0.04 - p * 0.48;
        } else if (progress < 0.68) {
          const p = (progress - 0.44) / 0.24;
          const ease = p * p * (3 - 2 * p);
          reloadPosY = -0.09;
          reloadRotX = 0.24;
          reloadRotZ = -0.48;
          this.ak47.magazineGroup.position.y = THREE.MathUtils.lerp(-0.42, -0.04, ease);
          if (progress >= 0.62 && this.reloadStage === 1) {
            this.reloadStage = 2;
            sound.playMagIn();
            this.recoil.kickZ += 0.02;
          }
        } else if (progress < 0.85) {
          if (progress >= 0.74 && this.reloadStage === 2) {
            this.reloadStage = 3;
            sound.playBoltRack();
          }
        }
      } else if (this.state.currentWeaponId === 'shotgun') {
        // Shotgun Shell Feed Reload
        if (progress < 0.3) {
          reloadPosY = -0.08 * (progress / 0.3);
          reloadRotX = 0.22 * (progress / 0.3);
          if (this.reloadStage === 0) {
            this.reloadStage = 1;
            sound.playMagOut();
          }
          this.shotgun.shellGroup.position.y = -0.016 - (progress / 0.3) * 0.2;
        } else if (progress < 0.75) {
          reloadPosY = -0.08;
          reloadRotX = 0.22;
          const p = (progress - 0.3) / 0.45;
          this.shotgun.shellGroup.position.y = THREE.MathUtils.lerp(-0.2, -0.016, p);
          if (progress > 0.65 && this.reloadStage === 1) {
            this.reloadStage = 2;
            sound.playMagIn();
          }
        } else {
          reloadPosY = -0.08 * (1 - (progress - 0.75) / 0.25);
          if (this.reloadStage === 2) {
            this.reloadStage = 3;
            sound.playShotgunPump();
          }
        }
      } else if (this.state.currentWeaponId === 'sniper') {
        // Sniper Box Magazine Reload
        if (progress < 0.35) {
          const p = progress / 0.35;
          reloadPosY = -0.10 * p;
          reloadRotX = 0.20 * p;
          if (this.reloadStage === 0) {
            this.reloadStage = 1;
            sound.playMagOut();
          }
          this.sniper.magazineGroup.position.y = -0.08 - p * 0.35;
        } else if (progress < 0.75) {
          reloadPosY = -0.10;
          reloadRotX = 0.20;
          const p = (progress - 0.35) / 0.4;
          this.sniper.magazineGroup.position.y = THREE.MathUtils.lerp(-0.43, -0.08, p);
          if (progress > 0.68 && this.reloadStage === 1) {
            this.reloadStage = 2;
            sound.playMagIn();
          }
        } else {
          reloadPosY = -0.10 * (1 - (progress - 0.75) / 0.25);
          if (this.reloadStage === 2) {
            this.reloadStage = 3;
            sound.playSniperBolt();
          }
        }
      } else if (this.state.currentWeaponId === 'pistol') {
        if (progress < 0.3) {
          if (this.reloadStage === 0) {
            this.reloadStage = 1;
            sound.playMagOut();
          }
          this.pistol.magazineGroup.position.y = -0.075 - (progress / 0.3) * 0.35;
        } else if (progress < 0.7) {
          const p = (progress - 0.3) / 0.4;
          this.pistol.magazineGroup.position.y = -0.075 - (1 - p) * 0.35;
          if (progress > 0.62 && this.reloadStage === 1) {
            this.reloadStage = 2;
            sound.playMagIn();
          }
        } else if (this.reloadStage === 2) {
          this.reloadStage = 3;
          sound.playBoltRack();
        }
      } else if (this.state.currentWeaponId === 'smg') {
        if (progress < 0.3) {
          if (this.reloadStage === 0) {
            this.reloadStage = 1;
            sound.playMagOut();
          }
          this.smg.magazineGroup.position.y = -0.06 - (progress / 0.3) * 0.38;
        } else if (progress < 0.7) {
          const p = (progress - 0.3) / 0.4;
          this.smg.magazineGroup.position.y = -0.06 - (1 - p) * 0.38;
          if (progress > 0.62 && this.reloadStage === 1) {
            this.reloadStage = 2;
            sound.playMagIn();
          }
        } else if (this.reloadStage === 2) {
          this.reloadStage = 3;
          sound.playBoltRack();
        }
      }

      if (progress >= 1) {
        this.state.isReloading = false;
        const curAmmo = this.ammoCounts[this.state.currentWeaponId];
        curAmmo.clip = cur.magCapacity;
        this.state.ammoInClip = cur.magCapacity;
        this.schedulerState.ammoInClip = cur.magCapacity;
        this.schedulerState.isReloading = false;
        this.schedulerState.nextShotTime = this.schedulerState.simTime;

        // Reset positions
        this.ak47.magazineGroup.position.set(0, -0.04, -0.06);
        this.pistol.magazineGroup.position.set(0, -0.075, 0.015);
        this.smg.magazineGroup.position.set(0, -0.06, -0.06);
        this.shotgun.shellGroup.position.set(0, -0.016, -0.02);
        this.shotgun.pumpGroup.position.set(0, 0.018, -0.26);
        this.sniper.magazineGroup.position.set(0, -0.08, -0.06);
        this.sniper.boltCarrierGroup.position.set(0.028, 0.032, 0.01);
      }
    }

    // 10. Transform Blending & Assembly
    const hipPos = new THREE.Vector3(...cur.hipPosition);
    const adsPos = new THREE.Vector3(...cur.adsPosition);
    const currentRestPos = hipPos.clone().lerp(adsPos, this.adsWeight);

    const hipRot = new THREE.Euler(...cur.hipRotation);
    const adsRot = new THREE.Euler(...cur.adsRotation);
    const restRotX = THREE.MathUtils.lerp(hipRot.x, adsRot.x, this.adsWeight);
    const restRotY = THREE.MathUtils.lerp(hipRot.y, adsRot.y, this.adsWeight);
    const restRotZ = THREE.MathUtils.lerp(hipRot.z, adsRot.z, this.adsWeight);

    const localPos = currentRestPos.clone();
    localPos.x += this.sway.x + bobX;
    localPos.y += this.sway.y + bobY + reloadPosY - this.sprintWeight * 0.12 - this.switchWeight * 0.22;
    localPos.z += this.recoil.kickZ - this.sprintWeight * 0.08;

    this.rootGroup.position.copy(this.camera.position);
    this.rootGroup.quaternion.copy(this.camera.quaternion);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

    this.rootGroup.position
      .addScaledVector(right, localPos.x)
      .addScaledVector(up, localPos.y)
      .addScaledVector(forward, -localPos.z);

    const totalPitch = this.recoil.pitchX + restRotX + this.sprintWeight * 0.45 + reloadRotX;
    const totalYaw = this.recoil.yawY + restRotY + this.sway.x * 0.8 - this.sprintWeight * 0.35 + inspectRotY;
    const totalRoll = this.recoil.rollZ + restRotZ + bobX * 1.8 + reloadRotZ + inspectRotZ;

    this.rootGroup.rotateX(totalPitch);
    this.rootGroup.rotateY(totalYaw);
    this.rootGroup.rotateZ(totalRoll);

    // 11. Update Flying Shell Casings
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
