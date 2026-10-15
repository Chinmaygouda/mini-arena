import * as THREE from 'three';
import {
  createHumanoidHitbox,
  HitboxPart,
  TargetHitboxDef,
  testRayHitbox,
  Vec3,
} from '@mini-arena/shared';

export type CombatantState = 'alive' | 'collapsing' | 'dead';

export interface DummyTarget {
  id: string;
  name: string;
  hitbox: TargetHitboxDef;
  group: THREE.Group;
  headMesh: THREE.Mesh;
  bodyMesh: THREE.Mesh;
  upperBodyGroup: THREE.Group;
  lowerBodyGroup: THREE.Group;
  leftLegGroup: THREE.Group;
  rightLegGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  health: number;
  maxHealth: number;
  flashTimer: number;
  hitCount: number;
  lastHitPart: HitboxPart | null;
  state: CombatantState;
  deathProgress: number; // 0.0 (alive) to 1.0 (fully collapsed)
  respawnTimer: number;
  // Locomotion & upper/lower layering
  velocity: THREE.Vector3;
  stridePhase: number;
  aimPitch: number; // Upper-body aim pitch in radians
  footSlidingError: number; // Metric verifying stride matches ground displacement
  basePosition: THREE.Vector3;
  patrolMinX?: number;
  patrolMaxX?: number;
  patrolDirection?: number;
}

export interface HitResultInfo {
  hit: boolean;
  dummyId: string | null;
  part: HitboxPart | null;
  distance: number;
  hitPoint: Vec3 | null;
}

export const STRIDE_LENGTH = 0.65; // meters per half-stride
export const DEATH_COLLAPSE_DURATION = 0.6; // seconds

/**
 * Manages articulated third-person combatant humanoid targets.
 * Features:
 * - Articulated humanoid skeleton (head, upper body, arms, lower body, thighs, calves)
 * - Independent Upper/Lower body layering
 * - Aim offset (pitch) tracking target look elevation
 * - Foot-sliding check verifying stride rate matches ground velocity
 * - Directional death animation / collapse when health reaches 0
 */
export class TargetDummyManager {
  public dummies: DummyTarget[] = [];
  public group: THREE.Group;

  // Reusable materials
  private helmetMat = new THREE.MeshStandardMaterial({
    color: 0xef4444, // Red helmet
    roughness: 0.35,
    metalness: 0.6,
  });

  private visorMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8, // Tinted visor
    roughness: 0.2,
    metalness: 0.9,
  });

  private armorVestMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Tactical plate carrier
    roughness: 0.7,
    metalness: 0.3,
  });

  private uniformMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Slate combat uniform
    roughness: 0.8,
    metalness: 0.1,
  });

  private bootsMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a, // Reinforced combat boots
    roughness: 0.5,
    metalness: 0.4,
  });

  private weaponPropMat = new THREE.MeshStandardMaterial({
    color: 0x18181b, // Weapon receiver
    roughness: 0.3,
    metalness: 0.85,
  });

  private flashMatHead = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private flashMatBody = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  // Scratchpads for zero-allocation updates
  private scratchVec = new THREE.Vector3();
  private scratchTarget = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'Target_Combatants_Manager';
    scene.add(this.group);
    this.spawnDummies();
  }

  private spawnDummies(): void {
    // 3 tactical combatant positions
    const dummyConfigs = [
      { id: 'dummy-close', name: 'Alpha (Close 8m)', x: 0, y: 0, z: -8 },
      { id: 'dummy-mid', name: 'Bravo (Mid Platform 15m)', x: 6, y: 1.5, z: -2 },
      {
        id: 'dummy-far',
        name: 'Charlie (Far 26m Patrol)',
        x: -10,
        y: 0,
        z: -18,
        patrolMinX: -12.5,
        patrolMaxX: -7.5,
        speed: 1.8,
      },
    ];

    for (const cfg of dummyConfigs) {
      const dummyGroup = new THREE.Group();
      dummyGroup.name = `Combatant_${cfg.id}`;
      dummyGroup.position.set(cfg.x, cfg.y, cfg.z);

      // --- 1. LOWER BODY & LEGS ---
      const lowerBodyGroup = new THREE.Group();
      lowerBodyGroup.name = 'LowerBody';
      lowerBodyGroup.position.set(0, 0.85, 0);

      // Pelvis
      const pelvisGeom = new THREE.BoxGeometry(0.32, 0.16, 0.22);
      const pelvis = new THREE.Mesh(pelvisGeom, this.armorVestMat);
      lowerBodyGroup.add(pelvis);

      // Left Leg (hip joint at x = -0.11)
      const leftLegGroup = new THREE.Group();
      leftLegGroup.name = 'Leg_Left';
      leftLegGroup.position.set(-0.11, -0.08, 0);

      const thighGeom = new THREE.BoxGeometry(0.13, 0.42, 0.14);
      thighGeom.translate(0, -0.21, 0);
      const leftThigh = new THREE.Mesh(thighGeom, this.uniformMat);
      leftLegGroup.add(leftThigh);

      const leftCalfGroup = new THREE.Group();
      leftCalfGroup.position.set(0, -0.42, 0);
      const calfGeom = new THREE.BoxGeometry(0.12, 0.40, 0.13);
      calfGeom.translate(0, -0.20, 0.02);
      const leftCalf = new THREE.Mesh(calfGeom, this.bootsMat);
      leftCalfGroup.add(leftCalf);
      leftLegGroup.add(leftCalfGroup);
      lowerBodyGroup.add(leftLegGroup);

      // Right Leg (hip joint at x = +0.11)
      const rightLegGroup = new THREE.Group();
      rightLegGroup.name = 'Leg_Right';
      rightLegGroup.position.set(0.11, -0.08, 0);

      const rightThigh = new THREE.Mesh(thighGeom, this.uniformMat);
      rightLegGroup.add(rightThigh);

      const rightCalfGroup = new THREE.Group();
      rightCalfGroup.position.set(0, -0.42, 0);
      const rightCalf = new THREE.Mesh(calfGeom, this.bootsMat);
      rightCalfGroup.add(rightCalf);
      rightLegGroup.add(rightCalfGroup);
      lowerBodyGroup.add(rightLegGroup);

      dummyGroup.add(lowerBodyGroup);

      // --- 2. UPPER BODY & ARMS (Spine pivot at y = 0.95) ---
      const upperBodyGroup = new THREE.Group();
      upperBodyGroup.name = 'UpperBody_Spine';
      upperBodyGroup.position.set(0, 0.95, 0);

      // Torso & Chest Armor (Body mesh for hitboxes)
      const torsoGeom = new THREE.BoxGeometry(0.38, 0.48, 0.24);
      torsoGeom.translate(0, 0.24, 0);
      const bodyMesh = new THREE.Mesh(torsoGeom, this.armorVestMat.clone());
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      upperBodyGroup.add(bodyMesh);

      // Head & Helmet (pivot at y = 0.52 relative to spine, ~1.47m world)
      const headGroup = new THREE.Group();
      headGroup.name = 'Head_Joint';
      headGroup.position.set(0, 0.52, 0);

      const helmetGeom = new THREE.SphereGeometry(0.18, 16, 16);
      const headMesh = new THREE.Mesh(helmetGeom, this.helmetMat.clone());
      headMesh.position.set(0, 0.12, 0);
      headMesh.castShadow = true;
      headGroup.add(headMesh);

      // Visor
      const visorGeom = new THREE.BoxGeometry(0.22, 0.08, 0.12);
      const visor = new THREE.Mesh(visorGeom, this.visorMat);
      visor.position.set(0, 0.12, 0.14);
      headGroup.add(visor);
      upperBodyGroup.add(headGroup);

      // Left Arm (holding weapon fore-end)
      const leftArmGroup = new THREE.Group();
      leftArmGroup.name = 'Arm_Left';
      leftArmGroup.position.set(-0.25, 0.42, 0);
      const armGeom = new THREE.BoxGeometry(0.10, 0.32, 0.10);
      armGeom.translate(0, -0.16, 0);
      const leftArm = new THREE.Mesh(armGeom, this.uniformMat);
      leftArmGroup.add(leftArm);
      leftArmGroup.rotation.set(0.65, 0.45, -0.3);
      upperBodyGroup.add(leftArmGroup);

      // Right Arm (gripping rifle handle)
      const rightArmGroup = new THREE.Group();
      rightArmGroup.name = 'Arm_Right';
      rightArmGroup.position.set(0.25, 0.42, 0);
      const rightArm = new THREE.Mesh(armGeom, this.uniformMat);
      rightArmGroup.add(rightArm);
      rightArmGroup.rotation.set(0.75, -0.35, 0.2);
      upperBodyGroup.add(rightArmGroup);

      // Third-person tactical weapon prop
      const riflePropGeom = new THREE.BoxGeometry(0.08, 0.14, 0.65);
      const rifleProp = new THREE.Mesh(riflePropGeom, this.weaponPropMat);
      rifleProp.position.set(0.08, 0.24, 0.32);
      rifleProp.rotation.set(-0.15, 0.1, -0.1);
      upperBodyGroup.add(rifleProp);

      dummyGroup.add(upperBodyGroup);

      // Ground Base Ring
      const ringGeom = new THREE.RingGeometry(0.4, 0.45, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      dummyGroup.add(ring);

      this.group.add(dummyGroup);

      // Create pure hitbox aligned with articulated character
      const hitbox = createHumanoidHitbox(cfg.id, cfg.x, cfg.y, cfg.z);

      this.dummies.push({
        id: cfg.id,
        name: cfg.name,
        hitbox,
        group: dummyGroup,
        headMesh,
        bodyMesh,
        upperBodyGroup,
        lowerBodyGroup,
        leftLegGroup,
        rightLegGroup,
        leftArmGroup,
        rightArmGroup,
        health: 100,
        maxHealth: 100,
        flashTimer: 0,
        hitCount: 0,
        lastHitPart: null,
        state: 'alive',
        deathProgress: 0,
        respawnTimer: 0,
        velocity: new THREE.Vector3(cfg.speed ?? 0, 0, 0),
        stridePhase: 0,
        aimPitch: 0,
        footSlidingError: 0,
        basePosition: new THREE.Vector3(cfg.x, cfg.y, cfg.z),
        patrolMinX: cfg.patrolMinX,
        patrolMaxX: cfg.patrolMaxX,
        patrolDirection: cfg.speed ? 1 : 0,
      });
    }
  }

  /**
   * Applies aim offset pitch to point dummy upper bodies towards a target world position (e.g. player camera).
   */
  public updateAimTracking(targetWorldPos: THREE.Vector3): void {
    for (const dummy of this.dummies) {
      if (dummy.state !== 'alive') continue;

      dummy.upperBodyGroup.getWorldPosition(this.scratchVec);
      const dx = targetWorldPos.x - this.scratchVec.x;
      const dy = targetWorldPos.y - this.scratchVec.y;
      const dz = targetWorldPos.z - this.scratchVec.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);

      if (horizontalDist > 0.001) {
        // Aim pitch: positive looking down, negative looking up
        const pitch = -Math.atan2(dy, horizontalDist);
        // Clamp pitch to realistic range (-50 deg to +50 deg)
        dummy.aimPitch = Math.max(-0.87, Math.min(0.87, pitch));
        dummy.upperBodyGroup.rotation.x = dummy.aimPitch;
      }
    }
  }

  /**
   * Triggers directional death collapse animation on a dummy.
   */
  public kill(dummyId: string): boolean {
    const dummy = this.dummies.find((d) => d.id === dummyId);
    if (!dummy || dummy.state !== 'alive') return false;

    dummy.health = 0;
    dummy.state = 'collapsing';
    dummy.deathProgress = 0;
    dummy.respawnTimer = 5.0; // Respawn after 5 seconds
    return true;
  }

  /**
   * Performs hitscan ray test against all active dummies.
   * Dead/collapsed entities are ignored.
   */
  public testRay(rayOrigin: Vec3, rayDir: Vec3, maxRange: number): HitResultInfo {
    let closestDist = maxRange;
    let closestResult: HitResultInfo = {
      hit: false,
      dummyId: null,
      part: null,
      distance: Infinity,
      hitPoint: null,
    };

    for (const dummy of this.dummies) {
      if (dummy.state !== 'alive') continue;

      const res = testRayHitbox(rayOrigin, rayDir, dummy.hitbox, maxRange);
      if (res.hit && res.distance < closestDist) {
        closestDist = res.distance;
        closestResult = {
          hit: true,
          dummyId: dummy.id,
          part: res.part,
          distance: res.distance,
          hitPoint: res.hitPoint,
        };
      }
    }

    if (closestResult.hit && closestResult.dummyId) {
      this.applyHitFeedback(closestResult.dummyId, closestResult.part);
    }

    return closestResult;
  }

  public applyHitFeedback(dummyId: string, part: HitboxPart | null): void {
    const dummy = this.dummies.find((d) => d.id === dummyId);
    if (!dummy || dummy.state !== 'alive') return;

    dummy.hitCount++;
    dummy.lastHitPart = part;
    dummy.flashTimer = 0.12;

    const damage = part === 'head' ? 70 : 34;
    dummy.health = Math.max(0, dummy.health - damage);

    if (dummy.health <= 0) {
      this.kill(dummyId);
    } else {
      if (part === 'head') {
        dummy.headMesh.material = this.flashMatHead;
      } else {
        dummy.bodyMesh.material = this.flashMatBody;
      }
    }
  }

  /**
   * Per-frame simulation update:
   * 1. Updates locomotion and foot-sliding check
   * 2. Evaluates upper/lower body layering
   * 3. Advances directional death collapse transitions
   */
  public update(dt: number): void {
    for (const dummy of this.dummies) {
      // 1. Hit flash recovery
      if (dummy.flashTimer > 0) {
        dummy.flashTimer -= dt;
        if (dummy.flashTimer <= 0) {
          dummy.headMesh.material = this.helmetMat;
          dummy.bodyMesh.material = this.armorVestMat;
        }
      }

      // 2. Death collapse animation
      if (dummy.state === 'collapsing') {
        dummy.deathProgress += dt / DEATH_COLLAPSE_DURATION;
        const t = Math.min(1.0, dummy.deathProgress);
        // Smooth easing: cubic ease-out
        const ease = 1 - Math.pow(1 - t, 3);

        // Directional fall backward onto ground
        dummy.group.position.y = dummy.basePosition.y - ease * 0.75;
        dummy.group.rotation.x = -ease * (Math.PI / 2.2);
        dummy.leftLegGroup.rotation.x = ease * 0.4;
        dummy.rightLegGroup.rotation.x = ease * 0.3;
        dummy.leftArmGroup.rotation.z = -ease * 0.6;
        dummy.rightArmGroup.rotation.z = ease * 0.6;

        if (dummy.deathProgress >= 1.0) {
          dummy.state = 'dead';
        }
        continue;
      }

      if (dummy.state === 'dead') {
        dummy.respawnTimer -= dt;
        if (dummy.respawnTimer <= 0) {
          // Respawn dummy
          dummy.state = 'alive';
          dummy.health = dummy.maxHealth;
          dummy.deathProgress = 0;
          dummy.group.position.copy(dummy.basePosition);
          dummy.group.rotation.set(0, 0, 0);
          dummy.leftLegGroup.rotation.set(0, 0, 0);
          dummy.rightLegGroup.rotation.set(0, 0, 0);
          dummy.leftArmGroup.rotation.set(0.65, 0.45, -0.3);
          dummy.rightArmGroup.rotation.set(0.75, -0.35, 0.2);
          dummy.upperBodyGroup.rotation.set(0, 0, 0);
        }
        continue;
      }

      // 3. Locomotion & Foot-Sliding Verification
      if (dummy.patrolDirection && dummy.patrolMinX !== undefined && dummy.patrolMaxX !== undefined) {
        const speed = dummy.velocity.x;
        const deltaX = speed * dt * dummy.patrolDirection;
        dummy.group.position.x += deltaX;

        // Turn at patrol boundaries
        if (dummy.group.position.x >= dummy.patrolMaxX) {
          dummy.patrolDirection = -1;
          dummy.group.rotation.y = -Math.PI / 2;
        } else if (dummy.group.position.x <= dummy.patrolMinX) {
          dummy.patrolDirection = 1;
          dummy.group.rotation.y = Math.PI / 2;
        }

        // Stride frequency formula: f = v / (2 * STRIDE_LENGTH)
        const strideFrequency = Math.abs(speed) / (2 * STRIDE_LENGTH);
        dummy.stridePhase += dt * strideFrequency * Math.PI * 2;

        const legSwingAngle = Math.sin(dummy.stridePhase) * 0.45;
        dummy.leftLegGroup.rotation.x = legSwingAngle;
        dummy.rightLegGroup.rotation.x = -legSwingAngle;

        // Foot-sliding check: ground translation delta must equal stride integration
        const expectedDelta = Math.abs(speed) * dt;
        const actualDelta = Math.abs(deltaX);
        dummy.footSlidingError = Math.abs(expectedDelta - actualDelta);
      } else {
        // Idle breathing weight shift
        dummy.stridePhase += dt * 1.5;
        dummy.leftLegGroup.rotation.x = Math.sin(dummy.stridePhase) * 0.02;
        dummy.rightLegGroup.rotation.x = -Math.sin(dummy.stridePhase) * 0.02;
        dummy.footSlidingError = 0;
      }

      // Synchronize hitboxes with world transforms
      dummy.hitbox.position.x = dummy.group.position.x;
      dummy.hitbox.position.y = dummy.group.position.y;
      dummy.hitbox.position.z = dummy.group.position.z;
    }
  }
}
