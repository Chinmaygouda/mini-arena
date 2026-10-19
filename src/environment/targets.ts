// src/environment/targets.ts
// Interactive Shooting Range Targets: Steel Reactive Poppers, Precision Bullseyes, Explosive Barrels, and Impact Sparks

import * as THREE from 'three';
import { sound } from '../audio/soundManager.ts';
import { type WeaponDef, type WeaponRangeConfig, calculateDamageFalloff } from '../weapons/weaponTypes.ts';

export interface HitResult {
  hit: boolean;
  point: THREE.Vector3;
  damage: number;
  multiplier?: number;
  distance?: number;
  isCrit: boolean;
  targetType: 'steel' | 'bullseye' | 'barrel' | 'bird' | 'world';
  shotOrigin?: THREE.Vector3;
  normal?: THREE.Vector3;
  targetObjectId?: number;
}

interface ReactiveTarget {
  group: THREE.Group;
  mesh: THREE.Mesh;
  baseY: number;
  pitch: number;
  recovering: boolean;
  hp: number;
  isCritZone: boolean;
}

interface ExplosiveBarrel {
  group: THREE.Group;
  mesh: THREE.Mesh;
  hp: number;
  exploded: boolean;
  respawnTimer: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

interface FloatingText {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
}

export const BULLET_RAYCAST_LAYER = 0;
export const FX_NON_RAYCAST_LAYER = 2;

export class TargetManager {
  private scene: THREE.Scene;
  private reactiveTargets: ReactiveTarget[] = [];
  private barrels: ExplosiveBarrel[] = [];
  private sparks: SparkParticle[] = [];
  private floatingTexts: FloatingText[] = [];
  private raycaster = new THREE.Raycaster();
  private rangeTargetsGroup = new THREE.Group();
  private dynamicTargetsGroup = new THREE.Group();
  private dynamicReactiveTargets: ReactiveTarget[] = [];

  public onHitRegistered?: (damage: number, isCrit: boolean, targetName: string) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.raycaster.layers.set(BULLET_RAYCAST_LAYER);
    this.rangeTargetsGroup.name = 'range-targets-group';
    this.dynamicTargetsGroup.name = 'dynamic-targets-group';
    this.scene.add(this.rangeTargetsGroup);
    this.scene.add(this.dynamicTargetsGroup);
    this.buildRangeTargets();
  }

  public setRangeTargetsVisible(visible: boolean) {
    this.rangeTargetsGroup.visible = visible;
  }

  public clearDynamicTargets() {
    while (this.dynamicTargetsGroup.children.length > 0) {
      const child = this.dynamicTargetsGroup.children[0];
      this.dynamicTargetsGroup.remove(child);
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
    const dynamicSet = new Set(this.dynamicReactiveTargets);
    this.reactiveTargets = this.reactiveTargets.filter((t) => !dynamicSet.has(t));
    this.dynamicReactiveTargets = [];
  }

  private buildRangeTargets() {
    // 1. Steel Reactive Silhouette Targets at varying distances
    const distances = [8, 15, 25, 40, 60];
    const xOffsets = [-3.5, 0, 3.5, -2, 2.5];

    distances.forEach((dist, idx) => {
      const x = xOffsets[idx % xOffsets.length];
      const z = -dist;

      const targetGroup = new THREE.Group();
      targetGroup.position.set(x, 0, z);

      // Stand Base & Post
      const standBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.4, 0.1, 16),
        new THREE.MeshStandardMaterial({ color: 0x222629, roughness: 0.8 })
      );
      standBase.position.y = 0.05;
      targetGroup.add(standBase);

      const standPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x33383d, metalness: 0.8, roughness: 0.3 })
      );
      standPost.position.y = 0.75;
      targetGroup.add(standPost);

      // Distance Marker Sign
      if (typeof document !== 'undefined') {
        const markerCanvas = document.createElement('canvas');
        markerCanvas.width = 128;
        markerCanvas.height = 64;
        const ctx = markerCanvas.getContext('2d')!;
        ctx.fillStyle = '#0a0d10';
        ctx.fillRect(0, 0, 128, 64);
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 120, 56);
        ctx.fillStyle = '#00ff66';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${dist}m`, 64, 32);

        const markerTexture = new THREE.CanvasTexture(markerCanvas);
        const markerSign = new THREE.Mesh(
          new THREE.PlaneGeometry(0.4, 0.2),
          new THREE.MeshBasicMaterial({ map: markerTexture })
        );
        markerSign.position.set(0, 0.35, 0.05);
        targetGroup.add(markerSign);
      }

      // Hinged Reactive Plate (Upper Silhouette)
      const plateHinge = new THREE.Group();
      plateHinge.position.set(0, 1.45, 0);

      // Torso Plate
      const steelMat = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.85,
        roughness: 0.35,
      });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.035), steelMat);
      torso.position.set(0, 0.32, 0);
      torso.castShadow = true;
      (torso as unknown as { isTarget: boolean; isHead: boolean }).isTarget = true;
      (torso as unknown as { isTarget: boolean; isHead: boolean }).isHead = false;
      plateHinge.add(torso);

      // Head Plate (Critical Hit Zone)
      const headMat = new THREE.MeshStandardMaterial({
        color: 0xff3b30,
        metalness: 0.7,
        roughness: 0.4,
      });
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.04), headMat);
      head.position.set(0, 0.76, 0);
      head.castShadow = true;
      (head as unknown as { isTarget: boolean; isHead: boolean }).isTarget = true;
      (head as unknown as { isTarget: boolean; isHead: boolean }).isHead = true;
      plateHinge.add(head);

      targetGroup.add(plateHinge);
      this.rangeTargetsGroup.add(targetGroup);

      this.reactiveTargets.push({
        group: plateHinge,
        mesh: torso,
        baseY: 1.45,
        pitch: 0,
        recovering: false,
        hp: 100,
        isCritZone: false,
      });
    });

    // 2. Explosive Hazard Fuel Drums
    const barrelLocations = [
      [-6, 0.55, -18],
      [6, 0.55, -22],
      [-8, 0.55, -35],
    ];

    barrelLocations.forEach(([bx, by, bz]) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(bx, by, bz);

      const barrelMat = new THREE.MeshStandardMaterial({
        color: 0xd92222,
        metalness: 0.5,
        roughness: 0.4,
      });

      const barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.1, 16), barrelMat);
      barrelMesh.castShadow = true;
      (barrelMesh as unknown as { isBarrel: boolean }).isBarrel = true;
      bGroup.add(barrelMesh);

      // Hazard Stripes Band
      const stripeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.385, 0.385, 0.25, 16),
        new THREE.MeshStandardMaterial({ color: 0xffee00, roughness: 0.5 })
      );
      bGroup.add(stripeMesh);

      this.rangeTargetsGroup.add(bGroup);
      this.barrels.push({
        group: bGroup,
        mesh: barrelMesh,
        hp: 50,
        exploded: false,
        respawnTimer: 0,
      });
    });
  }

  private scratchAimPoint = new THREE.Vector3();
  private scratchMuzzleToAim = new THREE.Vector3();
  private scratchShotDir = new THREE.Vector3();

  public isValidHit(hit: THREE.Intersection): boolean {
    if (hit.distance < 0.05) return false;
    const obj = hit.object;
    if (
      obj.userData?.ignoreRaycast ||
      obj.userData?.collision === false ||
      obj.userData?.isPenetrable ||
      obj.userData?.isViewmodel ||
      obj.userData?.isTracer ||
      obj.userData?.isDecal ||
      obj.userData?.isParticle ||
      obj.userData?.isSpark ||
      (obj as unknown as { isSprite?: boolean }).isSprite ||
      obj.type === 'Sprite' ||
      obj.name === 'bullet-tracer' ||
      obj.name.startsWith('tracer') ||
      obj.name.startsWith('spark') ||
      obj.name.startsWith('decal')
    ) {
      return false;
    }

    // Transparent mediums (glass, holograms, see-through screens) allow bullets to pass through
    if (obj instanceof THREE.Mesh) {
      const mat = obj.material;
      if (Array.isArray(mat)) {
        if (mat.some((m) => m && m.transparent && m.opacity < 0.8)) return false;
      } else if (mat && mat.transparent && mat.opacity < 0.8) {
        return false;
      }
    }

    return true;
  }

  public applyHitImpact(result: HitResult) {
    if (!result.hit) return;
    const normal = result.normal || new THREE.Vector3(0, 1, 0);

    if (result.targetType === 'bird') {
      let node = result.targetObjectId ? this.scene.getObjectById(result.targetObjectId) : undefined;
      while (node && !node.userData.isPerchedBird) node = node.parent ?? undefined;
      if (node) node.visible = false;
      sound.playTargetHit(false);
      if (this.onHitRegistered) this.onHitRegistered(0, false, 'BIRD HIT');
      return;
    }

    if (result.targetType === 'steel') {
      sound.playTargetHit(result.isCrit);

      // Find associated target and trigger physical hinged swing
      const allTargets = [...this.reactiveTargets, ...this.dynamicReactiveTargets];
      for (const target of allTargets) {
        if (result.targetObjectId && target.group.getObjectById(result.targetObjectId)) {
          target.pitch = Math.PI * 0.45; // Knock back
          target.recovering = false;
          break;
        }
      }

      this.spawnSparks(result.point, normal, result.isCrit ? 0xff3b30 : 0xffdd44);
      this.spawnFloatingText(result.point, `${result.damage}${result.isCrit ? ' CRIT!' : ''}`, result.isCrit ? '#ff3b30' : '#ffcc00');

      if (this.onHitRegistered) {
        this.onHitRegistered(result.damage, result.isCrit, result.isCrit ? 'HEADSHOT' : 'BODY HIT');
      }
    } else if (result.targetType === 'barrel') {
      const barrel = this.barrels.find((b) => b.mesh.id === result.targetObjectId);
      if (barrel && !barrel.exploded) {
        barrel.hp -= result.damage;
        this.spawnSparks(result.point, normal, 0xff8800);

        if (barrel.hp <= 0) {
          this.explodeBarrel(barrel);
        } else {
          sound.playTargetHit(false);
        }

        this.spawnFloatingText(result.point, `${result.damage}`, '#ff6600');
      }
    } else if (result.targetType === 'world') {
      this.spawnSparks(result.point, normal, 0xddccaa);
    }
  }

  private processHitObject(
    hit: THREE.Intersection,
    weaponDefOrDamage: WeaponDef | number,
    fallbackNormal: THREE.Vector3,
    shotOrigin: THREE.Vector3,
    legacyCritMultiplier?: number,
    deferImpact: boolean = false
  ): HitResult {
    const normal = hit.face?.normal || fallbackNormal;
    const obj = hit.object as unknown as { isTarget?: boolean; isHead?: boolean; isBarrel?: boolean };
    const hitDistance = shotOrigin ? shotOrigin.distanceTo(hit.point) : hit.distance;

    // Static low-poly neighbourhood birds are shootable world entities.
    if (hit.object.userData?.isBird) {
      const result: HitResult = {
        hit: true,
        point: hit.point.clone(),
        normal: normal.clone(),
        damage: 0,
        multiplier: 1,
        distance: hitDistance,
        isCrit: false,
        targetType: 'bird',
        shotOrigin,
        targetObjectId: hit.object.id,
      };
      if (!deferImpact) this.applyHitImpact(result);
      return result;
    }

    let baseDamage = 30;
    let critMultiplier = 2.0;
    let rangeConfig: WeaponRangeConfig = {
      fullDamageRange: 150,
      falloffEndRange: 150,
      minDamageMultiplier: 1.0,
      maxRange: 150,
    };

    if (typeof weaponDefOrDamage === 'number') {
      baseDamage = weaponDefOrDamage;
      critMultiplier = legacyCritMultiplier ?? 2.0;
    } else {
      baseDamage = weaponDefOrDamage.damage;
      critMultiplier = weaponDefOrDamage.critMultiplier;
      rangeConfig = weaponDefOrDamage;
    }

    // Check Reactive Target Hit
    if (obj.isTarget) {
      const isCrit = !!obj.isHead;
      const falloff = calculateDamageFalloff(hitDistance, baseDamage, rangeConfig, isCrit, critMultiplier);

      if (!falloff.inRange) {
        return {
          hit: false,
          point: hit.point.clone(),
          damage: 0,
          multiplier: 0,
          distance: hitDistance,
          isCrit: false,
          targetType: 'steel',
          shotOrigin,
        };
      }

      const dmg = falloff.damage;
      const result: HitResult = {
        hit: true,
        point: hit.point.clone(),
        normal: normal.clone(),
        damage: dmg,
        multiplier: falloff.multiplier,
        distance: hitDistance,
        isCrit,
        targetType: 'steel',
        shotOrigin,
        targetObjectId: hit.object.id,
      };

      if (!deferImpact) {
        this.applyHitImpact(result);
      }

      return result;
    }

    // Check Explosive Barrel Hit
    if (obj.isBarrel) {
      const barrel = this.barrels.find((b) => b.mesh.id === hit.object.id);
      if (barrel && !barrel.exploded) {
        const falloff = calculateDamageFalloff(hitDistance, baseDamage, rangeConfig, false, 1.0);
        if (!falloff.inRange) {
          return {
            hit: false,
            point: hit.point.clone(),
            damage: 0,
            multiplier: 0,
            distance: hitDistance,
            isCrit: false,
            targetType: 'barrel',
            shotOrigin,
          };
        }

        const result: HitResult = {
          hit: true,
          point: hit.point.clone(),
          normal: normal.clone(),
          damage: falloff.damage,
          multiplier: falloff.multiplier,
          distance: hitDistance,
          isCrit: false,
          targetType: 'barrel',
          shotOrigin,
          targetObjectId: hit.object.id,
        };

        if (!deferImpact) {
          this.applyHitImpact(result);
        }

        return result;
      }
    }

    // Hit general world (ground/walls/berms/props)
    if (hit.point) {
      if (hitDistance > rangeConfig.maxRange) {
        return {
          hit: false,
          point: hit.point.clone(),
          damage: 0,
          multiplier: 0,
          distance: hitDistance,
          isCrit: false,
          targetType: 'world',
          shotOrigin,
        };
      }

      const result: HitResult = {
        hit: true,
        point: hit.point.clone(),
        normal: normal.clone(),
        damage: 0,
        multiplier: 1.0,
        distance: hitDistance,
        isCrit: false,
        targetType: 'world',
        shotOrigin,
      };

      if (!deferImpact) {
        this.applyHitImpact(result);
      }

      return result;
    }

    return {
      hit: false,
      point: new THREE.Vector3(),
      damage: 0,
      multiplier: 0,
      distance: hitDistance,
      isCrit: false,
      targetType: 'world',
      shotOrigin,
    };
  }

  public checkBallisticHit(
    muzzleOrigin: THREE.Vector3,
    aimOrigin: THREE.Vector3,
    aimDirection: THREE.Vector3,
    weaponDefOrDamage: WeaponDef | number,
    legacyCritMultiplier?: number,
    deferImpact: boolean = false
  ): HitResult {
    const maxRange = typeof weaponDefOrDamage === 'object' ? weaponDefOrDamage.maxRange : 150;

    // 1. Aim Raycast from camera/crosshair to find intended target point
    this.raycaster.set(aimOrigin, aimDirection);
    this.raycaster.far = maxRange;
    const aimIntersects = this.raycaster.intersectObjects(this.scene.children, true);

    let aimHit: THREE.Intersection | null = null;
    for (const h of aimIntersects) {
      if (this.isValidHit(h)) {
        aimHit = h;
        break;
      }
    }

    if (aimHit) {
      this.scratchAimPoint.copy(aimHit.point);
    } else {
      this.scratchAimPoint.copy(aimOrigin).addScaledVector(aimDirection, maxRange);
    }

    // 2. Muzzle Raycast toward Aim Point & Obstruction Check
    this.scratchMuzzleToAim.copy(this.scratchAimPoint).sub(muzzleOrigin);
    const distToAim = this.scratchMuzzleToAim.length();
    this.scratchShotDir.copy(this.scratchMuzzleToAim).normalize();

    this.raycaster.set(muzzleOrigin, this.scratchShotDir);
    this.raycaster.far = Math.min(distToAim + 0.1, maxRange);
    const muzzleIntersects = this.raycaster.intersectObjects(this.scene.children, true);

    let muzzleHit: THREE.Intersection | null = null;
    for (const h of muzzleIntersects) {
      if (this.isValidHit(h)) {
        muzzleHit = h;
        break;
      }
    }

    const fallbackNormal = this.scratchShotDir.clone().negate();

    // If muzzle ray hit an obstruction closer than aim point (distToAim - 0.08m)
    if (muzzleHit && muzzleHit.distance < distToAim - 0.08) {
      return this.processHitObject(muzzleHit, weaponDefOrDamage, fallbackNormal, muzzleOrigin, legacyCritMultiplier, deferImpact);
    }

    // Line of sight clear from muzzle to aim target
    if (aimHit) {
      return this.processHitObject(aimHit, weaponDefOrDamage, fallbackNormal, muzzleOrigin, legacyCritMultiplier, deferImpact);
    }

    // No hit (sky / infinite distance / out of maxRange)
    return {
      hit: false,
      point: this.scratchAimPoint.clone(),
      damage: 0,
      multiplier: 0,
      distance: maxRange,
      isCrit: false,
      targetType: 'world',
      shotOrigin: muzzleOrigin,
    };
  }

  public checkBulletHit(origin: THREE.Vector3, direction: THREE.Vector3, weaponDefOrDamage: WeaponDef | number, legacyCritMultiplier?: number): HitResult {
    return this.checkBallisticHit(origin, origin, direction, weaponDefOrDamage, legacyCritMultiplier);
  }

  private explodeBarrel(barrel: ExplosiveBarrel) {
    barrel.exploded = true;
    barrel.group.visible = false;
    barrel.respawnTimer = 4.0;
    sound.playExplosion();

    const center = barrel.group.position.clone();

    // Spawn massive fiery debris burst
    for (let i = 0; i < 35; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xff4400 : 0xffcc00,
      });
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat);
      p.position.copy(center);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        Math.random() * 9 + 3,
        (Math.random() - 0.5) * 12
      );

      p.layers.set(FX_NON_RAYCAST_LAYER);
      p.userData.ignoreRaycast = true;
      p.userData.isSpark = true;
      this.scene.add(p);
      this.sparks.push({ mesh: p, velocity: vel, life: 1.2 });
    }

    this.spawnFloatingText(center.clone().add(new THREE.Vector3(0, 1.5, 0)), 'EXPLOSION! 200', '#ff2200');
    if (this.onHitRegistered) {
      this.onHitRegistered(200, true, 'BARREL EXPLODED');
    }
  }

  private spawnSparks(pos: THREE.Vector3, normal: THREE.Vector3, colorHex: number) {
    const sparkMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const count = 8;

    for (let i = 0; i < count; i++) {
      const spark = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), sparkMat);
      spark.position.copy(pos);
      spark.layers.set(FX_NON_RAYCAST_LAYER);
      spark.userData.ignoreRaycast = true;
      spark.userData.isSpark = true;

      const randomSpread = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );
      const velocity = normal.clone().multiplyScalar(4 + Math.random() * 4).add(randomSpread);

      this.scene.add(spark);
      this.sparks.push({ mesh: spark, velocity, life: 0.35 });
    }
  }

  private spawnFloatingText(pos: THREE.Vector3, text: string, color: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = color;
    ctx.font = '900 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.fillText(text, 128, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.layers.set(FX_NON_RAYCAST_LAYER);
    sprite.userData.ignoreRaycast = true;
    sprite.scale.set(0.9, 0.35, 1);
    sprite.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.2, 0));

    this.scene.add(sprite);
    this.floatingTexts.push({
      sprite,
      velocity: new THREE.Vector3(0, 0.8, 0),
      life: 0.75,
    });
  }

  public update(delta: number) {
    // 1. Reactive Targets Physics Spring Recovery
    for (const target of this.reactiveTargets) {
      if (target.pitch > 0.01) {
        // Slowly spring back upright
        target.pitch = THREE.MathUtils.lerp(target.pitch, 0, delta * 3.5);
        target.group.rotation.x = -target.pitch;
      } else {
        target.group.rotation.x = 0;
      }
    }

    // 2. Barrels Respawn Timer
    for (const barrel of this.barrels) {
      if (barrel.exploded) {
        barrel.respawnTimer -= delta;
        if (barrel.respawnTimer <= 0) {
          barrel.exploded = false;
          barrel.hp = 50;
          barrel.group.visible = true;
        }
      }
    }

    // 3. Update Sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      spark.life -= delta;
      if (spark.life <= 0) {
        this.scene.remove(spark.mesh);
        this.sparks.splice(i, 1);
        continue;
      }
      spark.velocity.y -= 12 * delta; // Gravity
      spark.mesh.position.addScaledVector(spark.velocity, delta);
    }

    // 4. Update Floating Text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const text = this.floatingTexts[i];
      text.life -= delta;
      if (text.life <= 0) {
        this.scene.remove(text.sprite);
        this.floatingTexts.splice(i, 1);
        continue;
      }
      text.sprite.position.addScaledVector(text.velocity, delta);
      text.sprite.material.opacity = text.life / 0.75;
    }
  }

  public addDynamicTarget(x: number, y: number, z: number, isEnemy: boolean = false) {
    const targetGroup = new THREE.Group();
    targetGroup.position.set(x, y, z);

    // Stand Base & Post
    const standPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x33383d, metalness: 0.8, roughness: 0.3 })
    );
    standPost.position.y = 0.6;
    targetGroup.add(standPost);

    // Hinged Silhouette Plate
    const plateHinge = new THREE.Group();
    plateHinge.position.set(0, 1.2, 0);

    const steelMat = new THREE.MeshStandardMaterial({
      color: isEnemy ? 0xcc4444 : 0xcccccc,
      metalness: 0.85,
      roughness: 0.35,
    });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.035), steelMat);
    torso.position.set(0, 0.32, 0);
    torso.castShadow = true;
    (torso as unknown as { isTarget: boolean; isHead: boolean }).isTarget = true;
    (torso as unknown as { isTarget: boolean; isHead: boolean }).isHead = false;
    plateHinge.add(torso);

    const headMat = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      metalness: 0.7,
      roughness: 0.4,
    });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.04), headMat);
    head.position.set(0, 0.76, 0);
    head.castShadow = true;
    (head as unknown as { isTarget: boolean; isHead: boolean }).isTarget = true;
    (head as unknown as { isTarget: boolean; isHead: boolean }).isHead = true;
    plateHinge.add(head);

    targetGroup.add(plateHinge);
    this.dynamicTargetsGroup.add(targetGroup);

    const targetObj: ReactiveTarget = {
      group: plateHinge,
      mesh: torso,
      baseY: y + 1.2,
      pitch: 0,
      recovering: false,
      hp: 100,
      isCritZone: false,
    };

    this.dynamicReactiveTargets.push(targetObj);
    this.reactiveTargets.push(targetObj);
  }
}
