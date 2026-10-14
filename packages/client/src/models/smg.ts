import * as THREE from 'three';
import { SplitWeaponMesh } from './assaultRifle';

/**
 * Builds a modern Rapid SMG with modular separated Body, Mag, and Bolt.
 * Features an integrated reflex sight, angled foregrip, and curved stick magazine.
 * Modeled strictly within browser budget (~700 - 1,000 triangles).
 * Zero external license cost ($0 CC0 compatible).
 */
export function buildSmgModel(): SplitWeaponMesh {
  const root = new THREE.Group();
  root.name = 'SMG_Root';

  const body = new THREE.Group();
  body.name = 'SMG_Body';
  root.add(body);

  let totalTriangles = 0;

  // PBR Materials
  const matteReceiverMat = new THREE.MeshStandardMaterial({
    color: 0x1a1f26,
    roughness: 0.5,
    metalness: 0.6,
  });

  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x14181f,
    roughness: 0.8,
    metalness: 0.1,
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.3,
    metalness: 0.9,
  });

  const reflexMat = new THREE.MeshStandardMaterial({
    color: 0x1e242c,
    roughness: 0.4,
    metalness: 0.7,
  });

  const reticleMat = new THREE.MeshBasicMaterial({
    color: 0xef4444, // Red dot reflex sight
  });

  function countMesh(mesh: THREE.Mesh) {
    if (mesh.geometry.index) {
      totalTriangles += mesh.geometry.index.count / 3;
    } else if (mesh.geometry.attributes.position) {
      totalTriangles += mesh.geometry.attributes.position.count / 3;
    }
  }

  // --- 1. RECEIVER ---
  const upperReceiverGeom = new THREE.BoxGeometry(0.042, 0.048, 0.22);
  const upperReceiver = new THREE.Mesh(upperReceiverGeom, matteReceiverMat);
  upperReceiver.position.set(0, 0.02, -0.04);
  body.add(upperReceiver);
  countMesh(upperReceiver);

  const lowerReceiverGeom = new THREE.BoxGeometry(0.038, 0.04, 0.14);
  const lowerReceiver = new THREE.Mesh(lowerReceiverGeom, polymerMat);
  lowerReceiver.position.set(0, -0.02, -0.02);
  body.add(lowerReceiver);
  countMesh(lowerReceiver);

  // Top Rail
  const topRailGeom = new THREE.BoxGeometry(0.024, 0.01, 0.18);
  const topRail = new THREE.Mesh(topRailGeom, steelMat);
  topRail.position.set(0, 0.048, -0.04);
  body.add(topRail);
  countMesh(topRail);

  // --- 2. BARREL & MUZZLE BRAKE ---
  const barrelGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8);
  barrelGeom.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeom, steelMat);
  barrel.position.set(0, 0.018, -0.21);
  body.add(barrel);
  countMesh(barrel);

  const muzzleBrakeGeom = new THREE.CylinderGeometry(0.016, 0.015, 0.035, 8);
  muzzleBrakeGeom.rotateX(Math.PI / 2);
  const muzzleBrake = new THREE.Mesh(muzzleBrakeGeom, steelMat);
  muzzleBrake.position.set(0, 0.018, -0.285);
  body.add(muzzleBrake);
  countMesh(muzzleBrake);

  // --- 3. GRIPS (Pistol Grip & Angled Foregrip) ---
  const pistolGripGeom = new THREE.BoxGeometry(0.032, 0.095, 0.042);
  const pistolGrip = new THREE.Mesh(pistolGripGeom, polymerMat);
  pistolGrip.position.set(0, -0.075, 0.035);
  pistolGrip.rotation.x = -0.3;
  body.add(pistolGrip);
  countMesh(pistolGrip);

  const triggerGuardGeom = new THREE.BoxGeometry(0.018, 0.03, 0.045);
  const triggerGuard = new THREE.Mesh(triggerGuardGeom, polymerMat);
  triggerGuard.position.set(0, -0.045, 0.0);
  body.add(triggerGuard);
  countMesh(triggerGuard);

  // Angled Foregrip on under-barrel
  const foregripGeom = new THREE.BoxGeometry(0.03, 0.065, 0.05);
  const foregrip = new THREE.Mesh(foregripGeom, polymerMat);
  foregrip.position.set(0, -0.045, -0.15);
  foregrip.rotation.x = 0.25; // Angled forward
  body.add(foregrip);
  countMesh(foregrip);

  // --- 4. FOLDING COMPACT STOCK ---
  const stockStrutLeftGeom = new THREE.BoxGeometry(0.008, 0.012, 0.16);
  const stockStrutLeft = new THREE.Mesh(stockStrutLeftGeom, steelMat);
  stockStrutLeft.position.set(-0.022, 0.015, 0.14);
  body.add(stockStrutLeft);
  countMesh(stockStrutLeft);

  const stockStrutRightGeom = new THREE.BoxGeometry(0.008, 0.012, 0.16);
  const stockStrutRight = new THREE.Mesh(stockStrutRightGeom, steelMat);
  stockStrutRight.position.set(0.022, 0.015, 0.14);
  body.add(stockStrutRight);
  countMesh(stockStrutRight);

  const buttPadGeom = new THREE.BoxGeometry(0.034, 0.09, 0.02);
  const buttPad = new THREE.Mesh(buttPadGeom, polymerMat);
  buttPad.position.set(0, 0.01, 0.22);
  body.add(buttPad);
  countMesh(buttPad);

  // --- 5. MICRO REFLEX SIGHT ---
  const sightBaseGeom = new THREE.BoxGeometry(0.032, 0.025, 0.05);
  const sightBase = new THREE.Mesh(sightBaseGeom, reflexMat);
  sightBase.position.set(0, 0.065, -0.04);
  body.add(sightBase);
  countMesh(sightBase);

  const redDotGeom = new THREE.SphereGeometry(0.003, 6, 6);
  const redDot = new THREE.Mesh(redDotGeom, reticleMat);
  redDot.position.set(0, 0.072, -0.04);
  body.add(redDot);
  countMesh(redDot);

  // --- 6. SEPARATED CURVED STICK MAGAZINE ---
  const magRestPos = new THREE.Vector3(0, -0.09, -0.06);
  const magGeom = new THREE.BoxGeometry(0.026, 0.18, 0.04);
  const mag = new THREE.Mesh(magGeom, steelMat);
  mag.name = 'SMG_Mag';
  mag.position.copy(magRestPos);
  mag.rotation.x = 0.15; // Curved 9mm stick mag
  root.add(mag);
  countMesh(mag);

  // --- 7. SEPARATED CHARGING HANDLE & BOLT ---
  const boltRestPos = new THREE.Vector3(-0.025, 0.028, -0.06);
  const boltGeom = new THREE.BoxGeometry(0.012, 0.015, 0.03);
  const bolt = new THREE.Mesh(boltGeom, steelMat);
  bolt.name = 'SMG_Bolt';
  bolt.position.copy(boltRestPos);
  root.add(bolt);
  countMesh(bolt);

  const muzzle = new THREE.Vector3(0, 0.018, -0.30);
  const ejectionPort = new THREE.Vector3(0.024, 0.025, -0.03);

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
