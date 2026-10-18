// src/weapons/shotgunModel.ts
// Tactical Combat Shotgun (SPAS-12 / 12-Gauge Combat) with movable grooved pump,
// ribbed barrel, front bead sight, shell loading port, and anatomical arms.

import * as THREE from 'three';

export interface ShotgunComponents {
  root: THREE.Group;
  gunMeshGroup: THREE.Group;
  pumpGroup: THREE.Group;
  shellGroup: THREE.Group;
  muzzleFlashGroup: THREE.Group;
  muzzleLight: THREE.PointLight;
  ejectionPoint: THREE.Vector3;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
}

export function createShotgunModel(): ShotgunComponents {
  const root = new THREE.Group();
  root.name = 'Shotgun_Root';

  const gunMeshGroup = new THREE.Group();
  root.add(gunMeshGroup);

  // --- PBR Materials ---
  const parkerizedSteelMat = new THREE.MeshStandardMaterial({
    color: 0x22262c,
    roughness: 0.35,
    metalness: 0.85,
  });

  const polymerStockMat = new THREE.MeshStandardMaterial({
    color: 0x14171b,
    roughness: 0.75,
    metalness: 0.2,
  });

  const groovedPumpMat = new THREE.MeshStandardMaterial({
    color: 0x101317,
    roughness: 0.8,
    metalness: 0.2,
  });

  const shellHullMat = new THREE.MeshStandardMaterial({
    color: 0xd32f2f, // Vibrant 12-gauge red plastic hull
    roughness: 0.35,
    metalness: 0.1,
  });

  const brassHeadMat = new THREE.MeshStandardMaterial({
    color: 0xe6a117, // Polished brass head
    roughness: 0.25,
    metalness: 0.95,
  });

  const beadSightMat = new THREE.MeshBasicMaterial({
    color: 0xffe066, // Brass/gold front bead sight
  });

  const armSkinMat = new THREE.MeshStandardMaterial({
    color: 0xc8987b,
    roughness: 0.7,
    metalness: 0.05,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x1a211e,
    roughness: 0.85,
    metalness: 0.15,
  });

  // --- 1. RECEIVER ---
  const receiverGeom = new THREE.BoxGeometry(0.046, 0.068, 0.24);
  const receiver = new THREE.Mesh(receiverGeom, parkerizedSteelMat);
  receiver.position.set(0, 0.02, -0.02);
  gunMeshGroup.add(receiver);

  // Ejection Port Cutout (Right Side)
  const portBevelGeom = new THREE.BoxGeometry(0.015, 0.024, 0.07);
  const portBevel = new THREE.Mesh(portBevelGeom, parkerizedSteelMat);
  portBevel.position.set(0.022, 0.028, -0.02);
  gunMeshGroup.add(portBevel);

  // Underside Loading Gate
  const gateGeom = new THREE.BoxGeometry(0.028, 0.016, 0.09);
  const gate = new THREE.Mesh(gateGeom, parkerizedSteelMat);
  gate.position.set(0, -0.016, -0.02);
  gunMeshGroup.add(gate);

  // --- 2. BARREL & TUBULAR MAGAZINE ---
  const barrelGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.44, 12);
  barrelGeom.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeom, parkerizedSteelMat);
  barrel.position.set(0, 0.038, -0.34);
  gunMeshGroup.add(barrel);

  const magTubeGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.40, 12);
  magTubeGeom.rotateX(Math.PI / 2);
  const magTube = new THREE.Mesh(magTubeGeom, parkerizedSteelMat);
  magTube.position.set(0, 0.01, -0.32);
  gunMeshGroup.add(magTube);

  // Heat Shield / Ventilated Rib over barrel
  const ribGeom = new THREE.BoxGeometry(0.016, 0.008, 0.38);
  const rib = new THREE.Mesh(ribGeom, parkerizedSteelMat);
  rib.position.set(0, 0.054, -0.32);
  gunMeshGroup.add(rib);

  // Front Bead Sight
  const beadSight = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 8), beadSightMat);
  beadSight.position.set(0, 0.06, -0.52);
  gunMeshGroup.add(beadSight);

  // Ghost Ring Rear Sight (Aperture)
  const ringGeom = new THREE.TorusGeometry(0.009, 0.002, 8, 16);
  const rearRing = new THREE.Mesh(ringGeom, parkerizedSteelMat);
  rearRing.position.set(0, 0.06, 0.08);
  gunMeshGroup.add(rearRing);

  // --- 3. COMBAT STOCK & PISTOL GRIP ---
  const gripGeom = new THREE.BoxGeometry(0.034, 0.10, 0.046);
  const grip = new THREE.Mesh(gripGeom, polymerStockMat);
  grip.position.set(0, -0.075, 0.05);
  grip.rotation.x = -0.32;
  gunMeshGroup.add(grip);

  const triggerGuardGeom = new THREE.BoxGeometry(0.018, 0.032, 0.05);
  const triggerGuard = new THREE.Mesh(triggerGuardGeom, parkerizedSteelMat);
  triggerGuard.position.set(0, -0.045, 0.01);
  gunMeshGroup.add(triggerGuard);

  const stockGeom = new THREE.BoxGeometry(0.04, 0.11, 0.24);
  const stock = new THREE.Mesh(stockGeom, polymerStockMat);
  stock.position.set(0, 0.01, 0.21);
  gunMeshGroup.add(stock);

  // --- 4. MOVABLE GROOVED PUMP SLIDE ---
  const pumpGroup = new THREE.Group();
  pumpGroup.name = 'Shotgun_PumpGroup';
  pumpGroup.position.set(0, 0.018, -0.26);

  const pumpGeom = new THREE.BoxGeometry(0.05, 0.052, 0.17);
  const pumpMesh = new THREE.Mesh(pumpGeom, groovedPumpMat);
  pumpGroup.add(pumpMesh);

  // Texture grooves on pump handle
  for (let gz = -0.06; gz <= 0.06; gz += 0.02) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.005, 0.008), parkerizedSteelMat);
    groove.position.set(0, -0.026, gz);
    pumpGroup.add(groove);
  }
  root.add(pumpGroup);

  // --- 5. RED 12-GAUGE SHELL (For Reload Choreography) ---
  const shellGroup = new THREE.Group();
  shellGroup.name = 'Shotgun_ShellGroup';
  shellGroup.position.set(0, -0.016, -0.02);

  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.055, 10), shellHullMat);
  hull.rotation.x = Math.PI / 2;
  hull.position.set(0, 0, -0.01);
  shellGroup.add(hull);

  const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.018, 10), brassHeadMat);
  brass.rotation.x = Math.PI / 2;
  brass.position.set(0, 0, 0.022);
  shellGroup.add(brass);
  root.add(shellGroup);

  // --- 6. ANATOMICAL ARMS & GLOVES ---
  // Right Arm (Holding Grip)
  const rightArmGroup = new THREE.Group();
  const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.28, 12), armSkinMat);
  rForearm.position.set(0.12, -0.19, 0.16);
  rForearm.rotation.set(0.42, 0.1, -0.35);
  rightArmGroup.add(rForearm);

  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.08, 0.055), gloveMat);
  rHand.position.set(0, -0.075, 0.05);
  rHand.rotation.x = -0.32;
  rightArmGroup.add(rHand);
  root.add(rightArmGroup);

  // Left Arm (Rests on movable pump slide)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.name = 'Shotgun_LeftArm';
  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.29, 12), armSkinMat);
  lForearm.position.set(-0.11, -0.14, -0.12);
  lForearm.rotation.set(0.55, -0.22, 0.45);
  leftArmGroup.add(lForearm);

  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.058, 0.07), gloveMat);
  lHand.position.set(0, 0.01, 0); // Attaches to pump
  leftArmGroup.add(lHand);
  pumpGroup.add(leftArmGroup);

  // --- 7. MUZZLE FLASH & TELEMETRY ---
  const muzzleFlashGroup = new THREE.Group();
  muzzleFlashGroup.position.set(0, 0.038, -0.56);

  const flashConeMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const flashMesh = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.18, 8), flashConeMat);
  flashMesh.rotation.x = -Math.PI / 2;
  flashMesh.position.z = -0.09;
  muzzleFlashGroup.add(flashMesh);

  const muzzleLight = new THREE.PointLight(0xff7700, 0, 10);
  muzzleFlashGroup.add(muzzleLight);
  gunMeshGroup.add(muzzleFlashGroup);

  const ejectionPoint = new THREE.Vector3(0.03, 0.028, -0.02);

  return {
    root,
    gunMeshGroup,
    pumpGroup,
    shellGroup,
    muzzleFlashGroup,
    muzzleLight,
    ejectionPoint,
    leftArmGroup,
    rightArmGroup,
  };
}
