import * as THREE from 'three';
import {
  createHumanoidHitbox,
  HitboxPart,
  TargetHitboxDef,
  testRayHitbox,
  Vec3,
} from '@mini-arena/shared';

export interface DummyTarget {
  id: string;
  name: string;
  hitbox: TargetHitboxDef;
  group: THREE.Group;
  headMesh: THREE.Mesh;
  bodyMesh: THREE.Mesh;
  health: number;
  maxHealth: number;
  flashTimer: number;
  hitCount: number;
  lastHitPart: HitboxPart | null;
}

export interface HitResultInfo {
  hit: boolean;
  dummyId: string | null;
  part: HitboxPart | null;
  distance: number;
  hitPoint: Vec3 | null;
}

export class TargetDummyManager {
  public dummies: DummyTarget[] = [];
  public group: THREE.Group;

  private headMat = new THREE.MeshStandardMaterial({
    color: 0xef4444, // Red head
    roughness: 0.4,
    metalness: 0.3,
  });

  private bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6, // Blue body
    roughness: 0.5,
    metalness: 0.2,
  });

  private flashMatHead = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private flashMatBody = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.spawnDummies();
  }

  private spawnDummies(): void {
    // 3 tactical target dummies
    const dummyConfigs = [
      { id: 'dummy-close', name: 'Alpha (Close 8m)', x: 0, y: 0, z: -8 },
      { id: 'dummy-mid', name: 'Bravo (Mid Platform 15m)', x: 6, y: 1.5, z: -2 },
      { id: 'dummy-far', name: 'Charlie (Far 26m)', x: -10, y: 0, z: -18 },
    ];

    for (const cfg of dummyConfigs) {
      const hitbox = createHumanoidHitbox(cfg.id, cfg.x, cfg.y, cfg.z);
      const dummyGroup = new THREE.Group();
      dummyGroup.position.set(cfg.x, cfg.y, cfg.z);

      // Body mesh: Cylinder at y = 0.75m, radius 0.36m, height 1.1m
      const bodyGeom = new THREE.CylinderGeometry(
        hitbox.bodyRadius,
        hitbox.bodyRadius,
        hitbox.bodyHalfHeight * 2,
        16,
      );
      const bodyMesh = new THREE.Mesh(bodyGeom, this.bodyMat.clone());
      bodyMesh.position.set(hitbox.bodyCenter.x, hitbox.bodyCenter.y, hitbox.bodyCenter.z);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      dummyGroup.add(bodyMesh);

      // Head mesh: Sphere at y = 1.55m, radius 0.22m
      const headGeom = new THREE.SphereGeometry(hitbox.headRadius, 16, 16);
      const headMesh = new THREE.Mesh(headGeom, this.headMat.clone());
      headMesh.position.set(hitbox.headOffset.x, hitbox.headOffset.y, hitbox.headOffset.z);
      headMesh.castShadow = true;
      headMesh.receiveShadow = true;
      dummyGroup.add(headMesh);

      // Base ring
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

      this.dummies.push({
        id: cfg.id,
        name: cfg.name,
        hitbox,
        group: dummyGroup,
        headMesh,
        bodyMesh,
        health: 100,
        maxHealth: 100,
        flashTimer: 0,
        hitCount: 0,
        lastHitPart: null,
      });
    }
  }

  /**
   * Performs hitscan ray test against all active dummies.
   * Returns closest hit if any.
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
    if (!dummy) return;

    dummy.hitCount++;
    dummy.lastHitPart = part;
    dummy.flashTimer = 0.12; // Flash for 120ms
    if (part === 'head') {
      dummy.headMesh.material = this.flashMatHead;
    } else {
      dummy.bodyMesh.material = this.flashMatBody;
    }
  }

  public update(dt: number): void {
    for (const dummy of this.dummies) {
      if (dummy.flashTimer > 0) {
        dummy.flashTimer -= dt;
        if (dummy.flashTimer <= 0) {
          dummy.headMesh.material = this.headMat;
          dummy.bodyMesh.material = this.bodyMat;
        }
      }
    }
  }
}
