// src/weapons/weaponManager.ts
// Weapon Manager: Handles viewmodel lifecycle, recoil physics, shell ejections, procedural reload choreography, ADS, and audio sync

import * as THREE from 'three';
import type { WeaponId, WeaponDef } from './weaponTypes';
import { WEAPON_REGISTRY } from './weaponTypes';
import { createAK47Model } from './ak47Model';
import type { AK47Components } from './ak47Model';
import { createPistolModel } from './pistolModel';
import type { PistolComponents } from './pistolModel';
import { sound } from '../audio/soundManager';

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

  private ammoCounts: Record<WeaponId, { clip: number; reserve: number }>;

  // Physics & Animation Trajectories
  private recoil = { kickZ: 0, pitchX: 0, yawY: 0, rollZ: 0 };
  private sway = { x: 0, y: 0 };
  private adsWeight = 0; // 0 = Hipfire, 1 = Full ADS
  private sprintWeight = 0;
  private switchWeight = 0; // 0 = ready, 1 = lowered during switch
  private inspectTimer = 0; // > 0 when inspecting weapon (V key)

  private lastFireTime = 0;
  private isTriggerPulled = false;
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

    this.ak47.root.traverse((child) => {
      child.userData.isViewmodel = true;
      child.userData.ignoreRaycast = true;
    });
    this.pistol.root.traverse((child) => {
      child.userData.isViewmodel = true;
      child.userData.ignoreRaycast = true;
    });

    this.rootGroup.add(this.ak47.root);
    this.rootGroup.add(this.pistol.root);
    this.pistol.root.visible = false;

    this.ammoCounts = {
      ak47: { clip: 30, reserve: 999 },
      pistol: { clip: 15, reserve: 999 },
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
    this.adsWeight = 0;
    this.switchWeight = 1.0;

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
    this.pistol.slideGroup.position.set(0, 0.038, 0);

    if (id === 'ak47') {
      this.ak47.root.visible = true;
      this.pistol.root.visible = false;
    } else {
      this.ak47.root.visible = false;
      this.pistol.root.visible = true;
    }

    this.notifyState();
  }

  public triggerInspect() {
    if (this.state.isReloading || this.state.isScoped) return;
    this.inspectTimer = 2.4;
  }

  public setTrigger(isPressed: boolean) {
    this.isTriggerPulled = isPressed;
    if (!isPressed) {
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

  private ejectShell(origin: THREE.Vector3, isAK: boolean) {
    const casingGeo = new THREE.CylinderGeometry(isAK ? 0.007 : 0.005, isAK ? 0.007 : 0.005, isAK ? 0.038 : 0.022, 8);
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
    const now = performance.now() / 1000;
    const ammo = this.ammoCounts[this.state.currentWeaponId];

    if (ammo.clip <= 0) {
      sound.playDryFire();
      this.startReload();
      return;
    }

    this.lastFireTime = now;
    ammo.clip -= 1;
    this.state.ammoInClip = ammo.clip;
    this.state.isFiring = true;

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

    // Audio & Muzzle Flash
    if (this.state.currentWeaponId === 'ak47') {
      sound.playAK47Shot();
      this.ak47.muzzleFlashGroup.visible = true;
      this.ak47.muzzleLight.intensity = 14;
      this.ak47.muzzleFlashGroup.rotation.z = Math.random() * Math.PI * 2;
      this.ak47.boltCarrierGroup.position.z = 0.07; // Bolt blowback
      this.ejectShell(this.ak47.ejectionPoint, true);
    } else {
      sound.playPistolShot();
      this.pistol.muzzleFlashGroup.visible = true;
      this.pistol.muzzleLight.intensity = 10;
      this.pistol.slideGroup.position.z = 0.045; // Slide blowback
      this.ejectShell(this.pistol.ejectionPoint, false);
    }

    // Raycast Callout
    if (this.onFireRaycast) {
      const spread = this.state.isScoped ? this.state.spreadRadius * 0.35 : this.state.spreadRadius;
      const spreadX = (Math.random() - 0.5) * spread;
      const spreadY = (Math.random() - 0.5) * spread;

      const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

      const shotDir = camDir.clone()
        .add(right.multiplyScalar(spreadX))
        .add(up.multiplyScalar(spreadY))
        .normalize();

      this.onFireRaycast(this.camera.position.clone(), shotDir, cur);
    }

    this.notifyState();
  }

  public update(delta: number, mouseDelta: { x: number; y: number }, isMoving: boolean, isSprinting: boolean) {
    this.state.isMoving = isMoving;
    this.state.isSprinting = isSprinting;
    const now = performance.now() / 1000;
    const cur = this.currentDef;

    // 1. Automatic Firing Loop
    if (this.isTriggerPulled && !this.state.isReloading && !this.state.isSprinting && this.switchWeight < 0.1) {
      if (cur.fireMode === 'auto') {
        if (now - this.lastFireTime >= cur.fireRate) {
          this.executeShot();
        }
      } else if (now - this.lastFireTime >= cur.fireRate && this.state.ammoInClip > 0) {
        if (!this.state.isFiring) {
          this.executeShot();
        }
      }
    }

    // 2. Recover Recoil
    const recSpeed = cur.recoilRecoverySpeed;
    this.recoil.kickZ = THREE.MathUtils.lerp(this.recoil.kickZ, 0, delta * recSpeed);
    this.recoil.pitchX = THREE.MathUtils.lerp(this.recoil.pitchX, 0, delta * recSpeed);
    this.recoil.yawY = THREE.MathUtils.lerp(this.recoil.yawY, 0, delta * recSpeed);
    this.recoil.rollZ = THREE.MathUtils.lerp(this.recoil.rollZ, 0, delta * recSpeed);

    // Muzzle Flash Decay
    if (now - this.lastFireTime > 0.055) {
      this.ak47.muzzleFlashGroup.visible = false;
      this.ak47.muzzleLight.intensity = 0;
      this.pistol.muzzleFlashGroup.visible = false;
      this.pistol.muzzleLight.intensity = 0;
    }

    // Bolt Carrier / Slide Return
    this.ak47.boltCarrierGroup.position.z = THREE.MathUtils.lerp(this.ak47.boltCarrierGroup.position.z, 0.02, delta * 30);
    this.pistol.slideGroup.position.z = THREE.MathUtils.lerp(this.pistol.slideGroup.position.z, 0, delta * 30);

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

    // 6. Sprint Lowering Weight
    const targetSprint = isSprinting && !this.state.isScoped ? 1.0 : 0.0;
    this.sprintWeight = THREE.MathUtils.lerp(this.sprintWeight, targetSprint, delta * 10);

    // 7. Weapon Switch Weight
    this.switchWeight = THREE.MathUtils.lerp(this.switchWeight, 0, delta * 8);

    // 8. Reload Choreography
    let reloadPosY = 0;
    let reloadRotX = 0;
    let reloadRotZ = 0;

    if (this.state.isReloading) {
      this.reloadTimer += delta;
      const progress = Math.min(1, this.reloadTimer / this.reloadDuration);
      this.state.reloadProgress = progress;

      if (this.state.currentWeaponId === 'ak47') {
        // High-Fidelity AK-47 Vanguard Reload Choreography
        if (progress < 0.22) {
          // Stage 1: Weapon Cant & Left Hand Release (0.00 -> 0.22)
          const p = progress / 0.22;
          const ease = p * p * (3 - 2 * p);
          reloadPosY = -0.09 * ease;
          reloadRotX = 0.24 * ease;
          reloadRotZ = -0.48 * ease; // 28-degree left cant showing magwell

          // Left arm moves from wooden handguard to magazine release lever
          this.ak47.leftArmGroup.position.set(
            THREE.MathUtils.lerp(0, 0.04, ease),
            THREE.MathUtils.lerp(0, -0.06, ease),
            THREE.MathUtils.lerp(0, 0.18, ease)
          );
          this.ak47.leftArmGroup.rotation.set(
            THREE.MathUtils.lerp(0, -0.25, ease),
            THREE.MathUtils.lerp(0, 0.15, ease),
            0
          );
        } else if (progress < 0.44) {
          // Stage 2: Rock-out Empty Banana Mag & Drop (0.22 -> 0.44)
          const p = (progress - 0.22) / 0.22;
          reloadPosY = -0.09;
          reloadRotX = 0.24;
          reloadRotZ = -0.48;

          if (this.reloadStage === 0) {
            this.reloadStage = 1;
            sound.playMagOut();
          }

          // Magazine rocks forward and drops out of receiver
          this.ak47.magazineGroup.rotation.x = -p * 0.35;
          this.ak47.magazineGroup.position.y = -0.04 - p * 0.48;
          this.ak47.magazineGroup.position.z = -0.06 - p * 0.06;

          // Left hand tracks magazine downward
          this.ak47.leftArmGroup.position.set(0.04, -0.06 - p * 0.35, 0.18 - p * 0.06);
          this.ak47.leftArmGroup.rotation.set(-0.25 - p * 0.2, 0.15, 0);
        } else if (progress < 0.68) {
          // Stage 3: Fetch Fresh Curved Mag & Rock-in Lock (0.44 -> 0.68)
          const p = (progress - 0.44) / 0.24;
          const ease = p * p * (3 - 2 * p);
          reloadPosY = -0.09;
          reloadRotX = 0.24;
          reloadRotZ = -0.48;

          // Fresh magazine brought smoothly up from lower left
          const magEnterY = THREE.MathUtils.lerp(-0.42, -0.04, ease);
          const magEnterZ = THREE.MathUtils.lerp(-0.12, -0.06, ease);
          const magRotX = THREE.MathUtils.lerp(0.32, 0.0, ease);

          this.ak47.magazineGroup.position.set(0, magEnterY, magEnterZ);
          this.ak47.magazineGroup.rotation.set(magRotX, 0, 0);

          // Left hand guides the magazine into the well
          this.ak47.leftArmGroup.position.set(
            THREE.MathUtils.lerp(-0.02, 0.04, ease),
            THREE.MathUtils.lerp(-0.35, -0.06, ease),
            THREE.MathUtils.lerp(0.12, 0.18, ease)
          );
          this.ak47.leftArmGroup.rotation.set(THREE.MathUtils.lerp(-0.35, -0.15, ease), 0.15, 0);

          if (progress >= 0.64 && this.reloadStage === 1) {
            this.reloadStage = 2;
            sound.playMagIn();
            // Tactile physical weapon slap impulse
            this.recoil.kickZ += 0.018;
            this.recoil.pitchX += 0.012;
            this.ak47.magazineGroup.position.set(0, -0.04, -0.06);
            this.ak47.magazineGroup.rotation.set(0, 0, 0);
          }
        } else if (progress < 0.85) {
          // Stage 4: Overhand/Underhand Charging Handle Rack (0.68 -> 0.85)
          const p = (progress - 0.68) / 0.17;
          reloadPosY = -0.07;
          reloadRotX = 0.18;
          reloadRotZ = -0.32;

          this.ak47.magazineGroup.position.set(0, -0.04, -0.06);
          this.ak47.magazineGroup.rotation.set(0, 0, 0);

          // Left hand reaches over the receiver to grab the bolt handle
          this.ak47.leftArmGroup.position.set(
            THREE.MathUtils.lerp(0.04, 0.065, Math.min(1, p * 2)),
            THREE.MathUtils.lerp(-0.06, 0.04, Math.min(1, p * 2)),
            THREE.MathUtils.lerp(0.18, 0.26, Math.min(1, p * 2))
          );

          if (p < 0.5) {
            // Pull charging handle back
            const pull = p / 0.5;
            this.ak47.boltCarrierGroup.position.z = THREE.MathUtils.lerp(0.02, 0.085, pull);
          } else {
            // Snap forward into battery
            const snap = (p - 0.5) / 0.5;
            this.ak47.boltCarrierGroup.position.z = THREE.MathUtils.lerp(0.085, 0.02, snap * snap);
          }

          if (progress >= 0.74 && this.reloadStage === 2) {
            this.reloadStage = 3;
            sound.playBoltRack();
          }
        } else {
          // Stage 5: Return to Handguard & Settle (0.85 -> 1.00)
          const p = (progress - 0.85) / 0.15;
          const ease = p * p * (3 - 2 * p);
          reloadPosY = -0.07 * (1 - ease);
          reloadRotX = 0.18 * (1 - ease);
          reloadRotZ = -0.32 * (1 - ease);

          this.ak47.magazineGroup.position.set(0, -0.04, -0.06);
          this.ak47.magazineGroup.rotation.set(0, 0, 0);
          this.ak47.boltCarrierGroup.position.set(0.025, 0.02, 0.02);

          // Left hand moves back to wooden handguard
          this.ak47.leftArmGroup.position.set(
            THREE.MathUtils.lerp(0.065, 0, ease),
            THREE.MathUtils.lerp(0.04, 0, ease),
            THREE.MathUtils.lerp(0.26, 0, ease)
          );
          this.ak47.leftArmGroup.rotation.set(
            THREE.MathUtils.lerp(-0.15, 0, ease),
            THREE.MathUtils.lerp(0.15, 0, ease),
            0
          );
        }
      } else {
        // High-Fidelity Tactical M9 Pistol Reload Choreography
        if (progress < 0.28) {
          const p = progress / 0.28;
          reloadPosY = -0.12 * p;
          reloadRotX = 0.25 * p;
          reloadRotZ = -0.28 * p;
          if (this.reloadStage === 0) {
            this.reloadStage = 1;
            sound.playMagOut();
          }
          this.pistol.magazineGroup.position.y = -0.075 - p * 0.38;
        } else if (progress < 0.65) {
          const p = (progress - 0.28) / 0.37;
          reloadPosY = -0.12;
          reloadRotX = 0.25;
          reloadRotZ = -0.28;

          this.pistol.magazineGroup.position.y = -0.075 - (1 - p) * 0.38;
          if (progress > 0.58 && this.reloadStage === 1) {
            this.reloadStage = 2;
            sound.playMagIn();
            this.recoil.kickZ += 0.015;
            this.pistol.magazineGroup.position.y = -0.075;
          }
        } else if (progress < 0.85) {
          const p = (progress - 0.65) / 0.2;
          reloadPosY = -0.10;
          reloadRotX = 0.18;
          reloadRotZ = -0.20;
          this.pistol.magazineGroup.position.y = -0.075;

          if (this.reloadStage === 2) {
            this.reloadStage = 3;
            sound.playBoltRack();
          }
          this.pistol.slideGroup.position.z = p < 0.5 ? 0.038 : 0;
        } else {
          const p = (progress - 0.85) / 0.15;
          reloadPosY = -0.10 * (1 - p);
          reloadRotX = 0.18 * (1 - p);
          reloadRotZ = -0.20 * (1 - p);
          this.pistol.slideGroup.position.z = 0;
          this.pistol.magazineGroup.position.y = -0.075;
        }
      }

      if (progress >= 1) {
        this.state.isReloading = false;
        // Clean reset of all viewmodel component offsets
        this.ak47.magazineGroup.position.set(0, -0.04, -0.06);
        this.ak47.magazineGroup.rotation.set(0, 0, 0);
        this.ak47.boltCarrierGroup.position.set(0.025, 0.02, 0.02);
        this.ak47.leftArmGroup.position.set(0, 0, 0);
        this.ak47.leftArmGroup.rotation.set(0, 0, 0);
        this.pistol.magazineGroup.position.set(0, -0.075, 0.015);
        this.pistol.slideGroup.position.set(0, 0.038, 0);

        const ammo = this.ammoCounts[this.state.currentWeaponId];
        const needed = cur.magCapacity - ammo.clip;
        const taken = Math.min(needed, ammo.reserve);
        ammo.clip += taken;
        ammo.reserve -= taken;
        this.state.ammoInClip = ammo.clip;
        this.state.reserveAmmo = ammo.reserve;
        this.notifyState();
      }
    }

    // 9. Inspect Animation
    let inspectRotY = 0;
    let inspectRotZ = 0;
    if (this.inspectTimer > 0) {
      this.inspectTimer -= delta;
      const inspP = Math.sin((2.4 - this.inspectTimer) * 1.5);
      inspectRotY = inspP * 0.4;
      inspectRotZ = inspP * 0.5;
    }

    // 10. Combine Viewmodel World Transform
    const hipPos = cur.hipPosition;
    const adsPos = cur.adsPosition;

    const basePosX = THREE.MathUtils.lerp(hipPos[0], adsPos[0], this.adsWeight) + this.sway.x + bobX;
    const basePosY = THREE.MathUtils.lerp(hipPos[1], adsPos[1], this.adsWeight) + this.sway.y - bobY - this.sprintWeight * 0.16 - this.switchWeight * 0.25 + reloadPosY;
    const basePosZ = THREE.MathUtils.lerp(hipPos[2], adsPos[2], this.adsWeight) + this.recoil.kickZ;

    const localOffset = new THREE.Vector3(basePosX, basePosY, basePosZ);
    localOffset.applyQuaternion(this.camera.quaternion);

    this.rootGroup.position.copy(this.camera.position).add(localOffset);
    this.rootGroup.quaternion.copy(this.camera.quaternion);

    // Rotational offsets (Recoil pitch, sway roll, sprint rotation, reload cant)
    const totalPitch = this.recoil.pitchX + this.sprintWeight * 0.45 + reloadRotX;
    const totalYaw = this.recoil.yawY + this.sway.x * 0.8 - this.sprintWeight * 0.35 + inspectRotY;
    const totalRoll = this.recoil.rollZ + bobX * 1.8 + reloadRotZ + inspectRotZ;

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

      shell.velocity.y -= 9.8 * delta; // Gravity
      shell.mesh.position.addScaledVector(shell.velocity, delta);
      shell.mesh.rotation.x += shell.rotVelocity.x * delta;
      shell.mesh.rotation.y += shell.rotVelocity.y * delta;

      // Floor bounce
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
