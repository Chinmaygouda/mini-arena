import * as THREE from 'three';

export interface SplitWeaponMesh {
  root: THREE.Group;
  body: THREE.Group;
  mag: THREE.Mesh;
  bolt: THREE.Mesh;
  muzzle: THREE.Vector3;
  ejectionPort: THREE.Vector3;
  magRestPos: THREE.Vector3;
  boltRestPos: THREE.Vector3;
  triangleCount: number;
}

/**
 * Builds a stylized-realistic Assault Rifle with modular separated Body, Mag, and Bolt.
 * Modeled strictly within browser budget (approx. 1,000 - 1,500 triangles total).
 * Zero license cost ($0 CC0 compatible).
 */
export function buildAssaultRifleModel(): SplitWeaponMesh {
  const root = new THREE.Group();
  root.name = 'AssaultRifle_Root';

  const body = new THREE.Group();
  body.name = 'AR_Body';
  root.add(body);

  let totalTriangles = 0;

  // Reusable PBR Materials
  const metalReceiverMat = new THREE.MeshStandardMaterial({
    color: 0x22272e,
    roughness: 0.35,
    metalness: 0.85,
  });

  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x1c2128,
    roughness: 0.75,
    metalness: 0.15,
  });

  const steelBarrelMat = new THREE.MeshStandardMaterial({
    color: 0x14181d,
    roughness: 0.25,
    metalness: 0.95,
  });

  const sightMat = new THREE.MeshStandardMaterial({
    color: 0x1f242c,
    roughness: 0.4,
    metalness: 0.7,
  });

  const reticleDotMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });

  function countMesh(mesh: THREE.Mesh) {
    if (mesh.geometry.index) {
      totalTriangles += mesh.geometry.index.count / 3;
    } else if (mesh.geometry.attributes.position) {
      totalTriangles += mesh.geometry.attributes.position.count / 3;
    }
  }

  // --- 1. RECEIVER (Lower & Upper) ---
  const upperReceiverGeom = new THREE.BoxGeometry(0.046, 0.052, 0.24);
  const upperReceiver = new THREE.Mesh(upperReceiverGeom, metalReceiverMat);
  upperReceiver.position.set(0, 0.02, -0.06);
  body.add(upperReceiver);
  countMesh(upperReceiver);

  const lowerReceiverGeom = new THREE.BoxGeometry(0.042, 0.045, 0.16);
  const lowerReceiver = new THREE.Mesh(lowerReceiverGeom, metalReceiverMat);
  lowerReceiver.position.set(0, -0.02, -0.03);
  body.add(lowerReceiver);
  countMesh(lowerReceiver);

  // Top Picatinny Rail
  const railGeom = new THREE.BoxGeometry(0.026, 0.012, 0.22);
  const rail = new THREE.Mesh(railGeom, polymerMat);
  rail.position.set(0, 0.05, -0.06);
  body.add(rail);
  countMesh(rail);

  // --- 2. HANDGUARD & BARREL ---
  const handguardGeom = new THREE.BoxGeometry(0.048, 0.05, 0.20);
  const handguard = new THREE.Mesh(handguardGeom, polymerMat);
  handguard.position.set(0, 0.02, -0.26);
  body.add(handguard);
  countMesh(handguard);

  const barrelGeom = new THREE.CylinderGeometry(0.011, 0.011, 0.26, 10);
  barrelGeom.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeom, steelBarrelMat);
  barrel.position.set(0, 0.02, -0.42);
  body.add(barrel);
  countMesh(barrel);

  const muzzleBrakeGeom = new THREE.CylinderGeometry(0.016, 0.015, 0.045, 10);
  muzzleBrakeGeom.rotateX(Math.PI / 2);
  const muzzleBrake = new THREE.Mesh(muzzleBrakeGeom, steelBarrelMat);
  muzzleBrake.position.set(0, 0.02, -0.56);
  body.add(muzzleBrake);
  countMesh(muzzleBrake);

  // --- 3. PISTOL GRIP & TRIGGER GUARD ---
  const gripGeom = new THREE.BoxGeometry(0.034, 0.10, 0.045);
  const grip = new THREE.Mesh(gripGeom, polymerMat);
  grip.position.set(0, -0.08, 0.04);
  grip.rotation.x = -0.32; // Ergonomic rearward sweep
  body.add(grip);
  countMesh(grip);

  const triggerGuardGeom = new THREE.BoxGeometry(0.02, 0.028, 0.05);
  const triggerGuard = new THREE.Mesh(triggerGuardGeom, metalReceiverMat);
  triggerGuard.position.set(0, -0.05, 0.0);
  body.add(triggerGuard);
  countMesh(triggerGuard);

  // --- 4. TACTICAL STOCK ---
  const stockTubeGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8);
  stockTubeGeom.rotateX(Math.PI / 2);
  const stockTube = new THREE.Mesh(stockTubeGeom, metalReceiverMat);
  stockTube.position.set(0, 0.02, 0.14);
  body.add(stockTube);
  countMesh(stockTube);

  const stockButtGeom = new THREE.BoxGeometry(0.038, 0.12, 0.08);
  const stockButt = new THREE.Mesh(stockButtGeom, polymerMat);
  stockButt.position.set(0, -0.01, 0.24);
  body.add(stockButt);
  countMesh(stockButt);

  // --- 5. HOLOGRAPHIC OPTICAL SIGHT ---
  const sightHoodGeom = new THREE.BoxGeometry(0.038, 0.042, 0.065);
  const sightHood = new THREE.Mesh(sightHoodGeom, sightMat);
  sightHood.position.set(0, 0.08, -0.07);
  body.add(sightHood);
  countMesh(sightHood);

  const reticleDotGeom = new THREE.SphereGeometry(0.0035, 6, 6);
  const reticleDot = new THREE.Mesh(reticleDotGeom, reticleDotMat);
  reticleDot.position.set(0, 0.085, -0.07);
  body.add(reticleDot);
  countMesh(reticleDot);

  // --- 6. SEPARATED MAGAZINE (Detachable) ---
  const magRestPos = new THREE.Vector3(0, -0.085, -0.08);
  const magGeom = new THREE.BoxGeometry(0.032, 0.16, 0.055);
  // Curve magazine slightly forward
  const mag = new THREE.Mesh(magGeom, metalReceiverMat);
  mag.name = 'AR_Mag';
  mag.position.copy(magRestPos);
  mag.rotation.x = 0.18; // Curved STANAG angle
  root.add(mag);
  countMesh(mag);

  // --- 7. SEPARATED BOLT CARRIER & CHARGING HANDLE ---
  const boltRestPos = new THREE.Vector3(0.026, 0.028, -0.05);
  const boltGeom = new THREE.BoxGeometry(0.012, 0.018, 0.04);
  const bolt = new THREE.Mesh(boltGeom, steelBarrelMat);
  bolt.name = 'AR_Bolt';
  bolt.position.copy(boltRestPos);
  root.add(bolt);
  countMesh(bolt);

  const muzzle = new THREE.Vector3(0, 0.02, -0.58);
  const ejectionPort = new THREE.Vector3(0.03, 0.03, -0.05);

  return {
    root,
    body,
    mag,
    bolt,
    muzzle,
    ejectionPort,
    magRestPos,
    boltRestPos,
    triangleCount: totalTriangles,
  };
}
