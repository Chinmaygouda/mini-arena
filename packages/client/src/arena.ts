import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface ArenaBuild {
  visualGroup: THREE.Group;
  colliders: RAPIER.Collider[];
}

/**
 * Builds the Phase 1 greybox test arena with perimeter walls,
 * elevated platform, slopes, stairs, cover pillars, and low clearance tunnel.
 */
export function buildGreyboxArena(scene: THREE.Scene, world: RAPIER.World): ArenaBuild {
  const visualGroup = new THREE.Group();
  const colliders: RAPIER.Collider[] = [];

  // PBR Materials for clean greybox look
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    roughness: 0.8,
    metalness: 0.1,
  });

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.6,
    metalness: 0.2,
  });

  const platformMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a5f,
    roughness: 0.5,
    metalness: 0.3,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.4,
    metalness: 0.5,
  });

  const tunnelMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.5,
    metalness: 0.2,
  });

  // Helper to create a static box in both Three.js and Rapier
  function addStaticBox(
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    rotationY = 0,
    rotationX = 0,
    rotationZ = 0,
  ): void {
    // Visual Mesh
    const geom = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.set(x, y, z);
    if (rotationY) mesh.rotation.y = rotationY;
    if (rotationX) mesh.rotation.x = rotationX;
    if (rotationZ) mesh.rotation.z = rotationZ;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    visualGroup.add(mesh);

    // Physics Collider
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    if (rotationY !== 0 || rotationX !== 0 || rotationZ !== 0) {
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotationX, rotationY, rotationZ, 'XYZ'),
      );
      bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
    const body = world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2);
    const collider = world.createCollider(colliderDesc, body);
    colliders.push(collider);
  }

  // 1. Ground floor (40m x 40m, thickness 1m)
  addStaticBox(40, 1, 40, 0, -0.5, 0, floorMat);

  // 2. Perimeter Boundary Walls (4m high, thickness 1m)
  // North (+Z)
  addStaticBox(42, 4, 1, 0, 2, 20.5, wallMat);
  // South (-Z)
  addStaticBox(42, 4, 1, 0, 2, -20.5, wallMat);
  // East (+X)
  addStaticBox(1, 4, 40, 20.5, 2, 0, wallMat);
  // West (-X)
  addStaticBox(1, 4, 40, -20.5, 2, 0, wallMat);

  // 3. Central Elevated Platform (8m x 8m at height y = 1.5m)
  // Platform top is at y = 1.5m, thickness = 0.5m -> center y = 1.25m
  addStaticBox(8, 0.5, 8, 0, 1.25, 0, platformMat);

  // 4. Ramps & Slopes leading to central platform
  // (a) Walkable Shallow Ramp (North +Z): 20° slope, height 1.5m, width 3m
  // Base run = 1.5 / tan(20°) = 4.121m, hypotenuse = 4.385m, angle = 0.3491 rad
  const shallowAngle = (20 * Math.PI) / 180;
  const shallowBaseRun = 1.5 / Math.tan(shallowAngle);
  const shallowLength = Math.hypot(shallowBaseRun, 1.5);
  addStaticBox(
    3,
    0.2,
    shallowLength,
    0,
    0.75,
    4 + shallowBaseRun / 2,
    accentMat,
    0,
    shallowAngle,
    0,
  );

  // (b) Walkable Medium Ramp (South -Z): 35° slope, height 1.5m, width 3m
  // Base run = 1.5 / tan(35°) = 2.142m, hypotenuse = 2.615m, angle = 0.6109 rad
  const mediumAngle = (35 * Math.PI) / 180;
  const mediumBaseRun = 1.5 / Math.tan(mediumAngle);
  const mediumLength = Math.hypot(mediumBaseRun, 1.5);
  addStaticBox(
    3,
    0.2,
    mediumLength,
    0,
    0.75,
    -(4 + mediumBaseRun / 2),
    accentMat,
    0,
    -mediumAngle,
    0,
  );

  // (c) Steep Blocker Slope (West side of platform, centered at Z = 2.0):
  // 55° slope (> 45° climb limit), height 1.5m, width 3m
  // Base run = 1.5 / tan(55°) = 1.050m, hypotenuse = 1.831m, angle = 0.9599 rad
  const steepAngle = (55 * Math.PI) / 180;
  const steepBaseRun = 1.5 / Math.tan(steepAngle);
  const steepLength = Math.hypot(steepBaseRun, 1.5);
  addStaticBox(
    steepLength,
    0.2,
    3,
    -(4 + steepBaseRun / 2),
    0.75,
    2.0,
    wallMat,
    0,
    0,
    -steepAngle,
  );

  // 5. Stairs on East (+X) side of platform: 8 steps to 1.5m (0.1875m riser, 0.4m tread)
  // Strictly matches plan's ~0.2m riser autostep requirement
  const numSteps = 8;
  const stepHeight = 1.5 / numSteps; // 0.1875m
  const stepDepth = 0.4;
  const stairStartX = 4;
  for (let i = 0; i < numSteps; i++) {
    const x = stairStartX + (i + 0.5) * stepDepth;
    const y = ((i + 1) * stepHeight) / 2;
    const h = (i + 1) * stepHeight;
    addStaticBox(stepDepth, h, 3, x, y, 0, accentMat);
  }

  // 6. Cover Blocks & Tactical Pillars
  addStaticBox(1.5, 3, 1.5, -8, 1.5, -8, wallMat);
  addStaticBox(1.5, 3, 1.5, 8, 1.5, -8, wallMat);
  addStaticBox(1.5, 3, 1.5, -8, 1.5, 8, wallMat);

  // Waist-height barriers (1.1m high) to test wall sliding & cover
  addStaticBox(4, 1.1, 0.5, -5, 0.55, -4, wallMat);
  addStaticBox(0.5, 1.1, 4, 5, 0.55, -4, wallMat);

  // 7. Low Clearance Tunnel (Ceiling clearance = 1.4m)
  // Left wall pillar
  addStaticBox(0.6, 2.5, 4, -12, 1.25, 0, tunnelMat);
  // Right wall pillar
  addStaticBox(0.6, 2.5, 4, -8, 1.25, 0, tunnelMat);
  // Overhead lintel: bottom at y = 1.4m, top at y = 2.4m (thickness 1.0m, center y = 1.9m)
  addStaticBox(4.6, 1.0, 4, -10, 1.9, 0, tunnelMat);

  // Ground grid helper for visual distance reference
  const gridHelper = new THREE.GridHelper(40, 40, 0x0284c7, 0x1e293b);
  gridHelper.position.y = 0.01;
  visualGroup.add(gridHelper);

  scene.add(visualGroup);

  return { visualGroup, colliders };
}
