import * as THREE from 'three';
import { SplitWeaponMesh } from './assaultRifle';

/**
 * Builds a modern Tactical Pistol with modular separated Body (Frame), Slide (Blowback), and Magazine.
 * Features realistic PBR materials, ergonomic grip, and iron sights.
 * Modeled strictly within browser budget (~500 - 800 triangles).
 * Zero external license cost ($0 CC0 compatible).
 */
export function buildPistolModel(): SplitWeaponMesh {
  const root = new THREE.Group();
  root.name = 'Pistol_Root';

  const body = new THREE.Group();
  body.name = 'Pistol_Frame';
  root.add(body);

  let totalTriangles = 0;

  // PBR Materials
  const polymerFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1f242d,
    roughness: 0.7,
    metalness: 0.1,
  });

  const steelSlideMat = new THREE.MeshStandardMaterial({
    color: 0x181c22,
    roughness: 0.3,
    metalness: 0.9,
  });

  const sightsMat = new THREE.MeshStandardMaterial({
    color: 0x0f1115,
    roughness: 0.4,
    metalness: 0.8,
  });

  const tritiumDotMat = new THREE.MeshBasicMaterial({
    color: 0x4ade80, // High-visibility green tritium dots
  });

  function countMesh(mesh: THREE.Mesh) {
    if (mesh.geometry.index) {
      totalTriangles += mesh.geometry.index.count / 3;
    } else if (mesh.geometry.attributes.position) {
      totalTriangles += mesh.geometry.attributes.position.count / 3;
    }
  }

  // --- 1. POLYMER FRAME ---
  // Dust cover / lower receiver
  const dustCoverGeom = new THREE.BoxGeometry(0.032, 0.034, 0.15);
  const dustCover = new THREE.Mesh(dustCoverGeom, polymerFrameMat);
  dustCover.position.set(0, -0.015, -0.04);
  body.add(dustCover);
  countMesh(dustCover);

  // Under-barrel accessory rail
  const railGeom = new THREE.BoxGeometry(0.024, 0.008, 0.06);
  const rail = new THREE.Mesh(railGeom, polymerFrameMat);
  rail.position.set(0, -0.034, -0.06);
  body.add(rail);
  countMesh(rail);

  // Ergonomic Grip Handle
  const gripGeom = new THREE.BoxGeometry(0.032, 0.11, 0.045);
  const grip = new THREE.Mesh(gripGeom, polymerFrameMat);
  grip.position.set(0, -0.075, 0.025);
  grip.rotation.x = -0.26; // Rake angle
  body.add(grip);
  countMesh(grip);

  // Trigger Guard
  const triggerGuardGeom = new THREE.BoxGeometry(0.018, 0.035, 0.045);
  const triggerGuard = new THREE.Mesh(triggerGuardGeom, polymerFrameMat);
  triggerGuard.position.set(0, -0.045, -0.005);
  body.add(triggerGuard);
  countMesh(triggerGuard);

  // Trigger
  const triggerGeom = new THREE.BoxGeometry(0.008, 0.022, 0.014);
  const trigger = new THREE.Mesh(triggerGeom, steelSlideMat);
  trigger.position.set(0, -0.042, 0.0);
  trigger.rotation.x = -0.15;
  body.add(trigger);
  countMesh(trigger);

  // --- 2. MOVABLE STEEL SLIDE (Blowback recoil action) ---
  const slideRestPos = new THREE.Vector3(0, 0.018, -0.035);
  const slideGroup = new THREE.Group();
  slideGroup.name = 'Pistol_Slide_Group';
  slideGroup.position.copy(slideRestPos);

  // Slide Body
  const slideMainGeom = new THREE.BoxGeometry(0.032, 0.032, 0.17);
  const slideMain = new THREE.Mesh(slideMainGeom, steelSlideMat);
  slideGroup.add(slideMain);
  countMesh(slideMain);

  // Front Sight Post + Tritium Dot
  const frontSightGeom = new THREE.BoxGeometry(0.008, 0.012, 0.014);
  const frontSight = new THREE.Mesh(frontSightGeom, sightsMat);
  frontSight.position.set(0, 0.021, -0.075);
  slideGroup.add(frontSight);
  countMesh(frontSight);

  const frontDotGeom = new THREE.SphereGeometry(0.002, 6, 6);
  const frontDot = new THREE.Mesh(frontDotGeom, tritiumDotMat);
  frontDot.position.set(0, 0.022, -0.068);
  slideGroup.add(frontDot);
  countMesh(frontDot);

  // Rear Notch Sight + Dual Tritium Dots
  const rearSightLeftGeom = new THREE.BoxGeometry(0.009, 0.012, 0.014);
  const rearSightLeft = new THREE.Mesh(rearSightLeftGeom, sightsMat);
  rearSightLeft.position.set(-0.01, 0.021, 0.075);
  slideGroup.add(rearSightLeft);
  countMesh(rearSightLeft);

  const rearDotLeftGeom = new THREE.SphereGeometry(0.002, 6, 6);
  const rearDotLeft = new THREE.Mesh(rearDotLeftGeom, tritiumDotMat);
  rearDotLeft.position.set(-0.01, 0.022, 0.082);
  slideGroup.add(rearDotLeft);
  countMesh(rearDotLeft);

  const rearSightRightGeom = new THREE.BoxGeometry(0.009, 0.012, 0.014);
  const rearSightRight = new THREE.Mesh(rearSightRightGeom, sightsMat);
  rearSightRight.position.set(0.01, 0.021, 0.075);
  slideGroup.add(rearSightRight);
  countMesh(rearSightRight);

  const rearDotRightGeom = new THREE.SphereGeometry(0.002, 6, 6);
  const rearDotRight = new THREE.Mesh(rearDotRightGeom, tritiumDotMat);
  rearDotRight.position.set(0.01, 0.022, 0.082);
  slideGroup.add(rearDotRight);
  countMesh(rearDotRight);

  root.add(slideGroup);

  // --- 3. SEPARATED MAGAZINE (Detachable) ---
  const magRestPos = new THREE.Vector3(0, -0.075, 0.025);
  const magGeom = new THREE.BoxGeometry(0.026, 0.12, 0.038);
  const mag = new THREE.Mesh(magGeom, steelSlideMat);
  mag.name = 'Pistol_Mag';
  mag.position.copy(magRestPos);
  mag.rotation.x = -0.26;
  root.add(mag);
  countMesh(mag);

  // Mag Baseplate
  const baseplateGeom = new THREE.BoxGeometry(0.032, 0.012, 0.046);
  const baseplate = new THREE.Mesh(baseplateGeom, polymerFrameMat);
  baseplate.position.set(0, -0.06, 0.0);
  mag.add(baseplate);
  countMesh(baseplate);

  const muzzle = new THREE.Vector3(0, 0.018, -0.13);
  const ejectionPort = new THREE.Vector3(0.02, 0.025, -0.02);

  return {
    root,
    body,
    mag,
    bolt: slideMain,
    muzzle,
    ejectionPort,
    magRestPos,
    boltRestPos: slideRestPos,
    triangleCount: totalTriangles,
  };
}
