import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { MapSpec, MapBox, MapRamp, MapStairs } from '@mini-arena/shared';
import { buildMapMaterials } from './materials';

export interface LoadedMapSession {
  spec: MapSpec;
  visualGroup: THREE.Group;
  lightsGroup: THREE.Group;
  colliders: RAPIER.Collider[];
  rigidBodies: RAPIER.RigidBody[];
  materials: Record<string, THREE.MeshStandardMaterial>;
  dispose: () => void;
}

export class MapLoader {
  private scene: THREE.Scene;
  private world: RAPIER.World;
  private currentSession: LoadedMapSession | null = null;

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.scene = scene;
    this.world = world;
  }

  public get activeSession(): LoadedMapSession | null {
    return this.currentSession;
  }

  /**
   * Loads a map specification, assembling visual meshes, PBR lighting, and Rapier collision bodies.
   */
  public loadMap(spec: MapSpec, qualityTier: 'low' | 'medium' | 'high' = 'high'): LoadedMapSession {
    if (this.currentSession) {
      this.unloadCurrentMap();
    }

    const visualGroup = new THREE.Group();
    visualGroup.name = `map-${spec.id}-visuals`;

    const lightsGroup = new THREE.Group();
    lightsGroup.name = `map-${spec.id}-lights`;

    const colliders: RAPIER.Collider[] = [];
    const rigidBodies: RAPIER.RigidBody[] = [];
    const materials = buildMapMaterials();

    // 1. Setup Environment Lighting & Fog
    const l = spec.lighting;
    const hemiLight = new THREE.HemisphereLight(l.skyColor, l.groundColor, l.ambientIntensity);
    lightsGroup.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(l.sunColor, l.sunIntensity);
    dirLight.position.set(l.sunPosition.x, l.sunPosition.y, l.sunPosition.z);
    dirLight.castShadow = qualityTier !== 'low';

    if (dirLight.castShadow) {
      const shadowRes = qualityTier === 'high' ? 2048 : 1024;
      dirLight.shadow.mapSize.width = shadowRes;
      dirLight.shadow.mapSize.height = shadowRes;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 100;

      const d = Math.max(spec.dimensions.width, spec.dimensions.depth) * 0.75;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
      dirLight.shadow.bias = -0.0005;
    }
    lightsGroup.add(dirLight);

    // Set Scene Fog
    this.scene.fog = new THREE.Fog(l.fogColor, l.fogNear, l.fogFar);

    // 2. Build Boxes
    for (const b of spec.boxes) {
      this.createBox(b, visualGroup, materials, colliders, rigidBodies, qualityTier);
    }

    // 3. Build Ramps
    for (const r of spec.ramps) {
      this.createRamp(r, visualGroup, materials, colliders, rigidBodies, qualityTier);
    }

    // 4. Build Stairs
    if (spec.stairs) {
      for (const s of spec.stairs) {
        this.createStairs(s, visualGroup, materials, colliders, rigidBodies, qualityTier);
      }
    }

    // Add Groups to Scene
    this.scene.add(visualGroup);
    this.scene.add(lightsGroup);

    // Create Session
    const session: LoadedMapSession = {
      spec,
      visualGroup,
      lightsGroup,
      colliders,
      rigidBodies,
      materials,
      dispose: () => {
        this.unloadCurrentMap();
      },
    };

    this.currentSession = session;
    return session;
  }

  /**
   * Safely unloads and disposes current map geometry, textures, colliders, and bodies without leaks.
   */
  public unloadCurrentMap(): void {
    if (!this.currentSession) return;

    const { visualGroup, lightsGroup, colliders, rigidBodies, materials } = this.currentSession;

    // 1. Remove and dispose Three.js meshes
    visualGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
      }
    });

    // Dispose Materials & procedural textures
    for (const key of Object.keys(materials)) {
      const mat = materials[key];
      if (mat) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
    }

    this.scene.remove(visualGroup);
    this.scene.remove(lightsGroup);
    this.scene.fog = null;

    // 2. Remove Rapier Physics Colliders & RigidBodies
    for (const collider of colliders) {
      try {
        this.world.removeCollider(collider, false);
      } catch {
        // ignore already removed
      }
    }

    for (const body of rigidBodies) {
      try {
        this.world.removeRigidBody(body);
      } catch {
        // ignore already removed
      }
    }

    this.currentSession = null;
  }

  private createBox(
    box: MapBox,
    group: THREE.Group,
    materials: Record<string, THREE.MeshStandardMaterial>,
    colliders: RAPIER.Collider[],
    rigidBodies: RAPIER.RigidBody[],
    qualityTier: string,
  ): void {
    const mat = materials[box.materialKey] || materials.floor_concrete;
    const geom = new THREE.BoxGeometry(box.size.x, box.size.y, box.size.z);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(box.pos.x, box.pos.y, box.pos.z);
    if (box.rotY) mesh.rotation.y = box.rotY;
    if (box.rotX) mesh.rotation.x = box.rotX;
    if (box.rotZ) mesh.rotation.z = box.rotZ;

    mesh.receiveShadow = true;
    mesh.castShadow = qualityTier !== 'low';
    group.add(mesh);

    // Physics
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(box.pos.x, box.pos.y, box.pos.z);
    if (box.rotY || box.rotX || box.rotZ) {
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(box.rotX ?? 0, box.rotY ?? 0, box.rotZ ?? 0, 'XYZ'),
      );
      bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }

    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      box.size.x / 2,
      box.size.y / 2,
      box.size.z / 2,
    );
    const collider = this.world.createCollider(colliderDesc, body);
    colliders.push(collider);
    rigidBodies.push(body);
  }

  private createRamp(
    ramp: MapRamp,
    group: THREE.Group,
    materials: Record<string, THREE.MeshStandardMaterial>,
    colliders: RAPIER.Collider[],
    rigidBodies: RAPIER.RigidBody[],
    qualityTier: string,
  ): void {
    const mat = materials[ramp.materialKey] || materials.metal_grate;
    const geom = new THREE.BoxGeometry(ramp.width, 0.2, ramp.length);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(ramp.pos.x, ramp.pos.y, ramp.pos.z);

    const pitch = (ramp.angleDeg * Math.PI) / 180;
    mesh.rotation.y = ramp.rotY;
    mesh.rotation.x = pitch;

    mesh.receiveShadow = true;
    mesh.castShadow = qualityTier !== 'low';
    group.add(mesh);

    // Physics
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(ramp.pos.x, ramp.pos.y, ramp.pos.z);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, ramp.rotY, 0, 'XYZ'));
    bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(ramp.width / 2, 0.1, ramp.length / 2);
    const collider = this.world.createCollider(colliderDesc, body);
    colliders.push(collider);
    rigidBodies.push(body);
  }

  private createStairs(
    stairs: MapStairs,
    group: THREE.Group,
    materials: Record<string, THREE.MeshStandardMaterial>,
    colliders: RAPIER.Collider[],
    rigidBodies: RAPIER.RigidBody[],
    qualityTier: string,
  ): void {
    const mat = materials[stairs.materialKey] || materials.metal_grate;
    const stepHeight = stairs.totalHeight / stairs.numSteps;

    // 1. Visual Individual Steps
    for (let i = 0; i < stairs.numSteps; i++) {
      let x = stairs.startPos.x;
      let z = stairs.startPos.z;
      const h = (i + 1) * stepHeight;
      const y = h / 2;

      if (stairs.direction === 'posX') x += (i + 0.5) * stairs.stepDepth;
      else if (stairs.direction === 'negX') x -= (i + 0.5) * stairs.stepDepth;
      else if (stairs.direction === 'posZ') z += (i + 0.5) * stairs.stepDepth;
      else if (stairs.direction === 'negZ') z -= (i + 0.5) * stairs.stepDepth;

      const sizeX = stairs.direction === 'posX' || stairs.direction === 'negX' ? stairs.stepDepth : stairs.stepWidth;
      const sizeZ = stairs.direction === 'posZ' || stairs.direction === 'negZ' ? stairs.stepDepth : stairs.stepWidth;

      const geom = new THREE.BoxGeometry(sizeX, h, sizeZ);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      mesh.castShadow = qualityTier !== 'low';
      group.add(mesh);
    }

    // 2. Physics Ramp Proxy for Smooth Kinematic Step Climbing (prevents jerky capsule collision on micro-risers)
    const totalDepth = stairs.numSteps * stairs.stepDepth;
    const hypotenuse = Math.hypot(totalDepth, stairs.totalHeight);
    const slopeAngle = Math.atan2(stairs.totalHeight, totalDepth);

    let centerX = stairs.startPos.x;
    let centerZ = stairs.startPos.z;
    let rotY = 0;

    if (stairs.direction === 'posX') {
      centerX += totalDepth / 2;
      rotY = 0;
    } else if (stairs.direction === 'negX') {
      centerX -= totalDepth / 2;
      rotY = Math.PI;
    } else if (stairs.direction === 'posZ') {
      centerZ += totalDepth / 2;
      rotY = -Math.PI / 2;
    } else if (stairs.direction === 'negZ') {
      centerZ -= totalDepth / 2;
      rotY = Math.PI / 2;
    }

    const centerY = stairs.totalHeight / 2;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(centerX, centerY, centerZ);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(slopeAngle, rotY, 0, 'XYZ'));
    bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

    const body = this.world.createRigidBody(bodyDesc);
    const colSizeX = stairs.direction === 'posX' || stairs.direction === 'negX' ? hypotenuse / 2 : stairs.stepWidth / 2;
    const colSizeZ = stairs.direction === 'posZ' || stairs.direction === 'negZ' ? hypotenuse / 2 : stairs.stepWidth / 2;

    const colliderDesc = RAPIER.ColliderDesc.cuboid(colSizeX, 0.1, colSizeZ);
    const collider = this.world.createCollider(colliderDesc, body);
    colliders.push(collider);
    rigidBodies.push(body);
  }
}
