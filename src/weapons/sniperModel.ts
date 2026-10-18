// src/weapons/sniperModel.ts
// Heavy Bolt-Action Sniper Rifle (AW-50 / .50 BMG) with cycling bolt handle,
// high-magnification telescopic scope, dual-port muzzle brake, 5-round magazine, and anatomical arms.

import * as THREE from 'three';

export interface SniperComponents {
  root: THREE.Group;
  gunMeshGroup: THREE.Group;
  boltCarrierGroup: THREE.Group;
  magazineGroup: THREE.Group;
  muzzleFlashGroup: THREE.Group;
  muzzleLight: THREE.PointLight;
  ejectionPoint: THREE.Vector3;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
}

export function createSniperModel(): SniperComponents {
  const root = new THREE.Group();
  root.name = 'Sniper_Root';

  const gunMeshGroup = new THREE.Group();
  root.add(gunMeshGroup);

  // --- PBR Materials ---
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x283038, // Tactical sniper tungsten slate gray
    roughness: 0.4,
    metalness: 0.8,
  });

  const blackSteelMat = new THREE.MeshStandardMaterial({
    color: 0x14181c,
    roughness: 0.25,
    metalness: 0.95,
  });

  const scopeBodyMat = new THREE.MeshStandardMaterial({
    color: 0x181c22,
    roughness: 0.35,
    metalness: 0.85,
  });

  const opticGlassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.1,
    metalness: 0.9,
  });

  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x101317,
    roughness: 0.8,
    metalness: 0.15,
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

  // --- 1. RECEIVER & CHASSIS ---
  const receiverGeom = new THREE.BoxGeometry(0.048, 0.058, 0.30);
  const receiver = new THREE.Mesh(receiverGeom, chassisMat);
  receiver.position.set(0, 0.02, -0.05);
  gunMeshGroup.add(receiver);

  const forendGeom = new THREE.BoxGeometry(0.044, 0.046, 0.28);
  const forend = new THREE.Mesh(forendGeom, chassisMat);
  forend.position.set(0, 0.015, -0.30);
  gunMeshGroup.add(forend);

  // --- 2. HEAVY FLUTED BARREL & DUAL-PORT BRAKE ---
  const barrelGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.48, 12);
  barrelGeom.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeom, blackSteelMat);
  barrel.position.set(0, 0.025, -0.62);
  gunMeshGroup.add(barrel);

  const muzzleBrakeGeom = new THREE.BoxGeometry(0.034, 0.032, 0.065);
  const muzzleBrake = new THREE.Mesh(muzzleBrakeGeom, blackSteelMat);
  muzzleBrake.position.set(0, 0.025, -0.89);
  gunMeshGroup.add(muzzleBrake);

  // --- 3. GRIP & SKELETONIZED STOCK ---
  const gripGeom = new THREE.BoxGeometry(0.034, 0.10, 0.044);
  const grip = new THREE.Mesh(gripGeom, chassisMat);
  grip.position.set(0, -0.075, 0.06);
  grip.rotation.x = -0.32;
  gunMeshGroup.add(grip);

  const triggerGuardGeom = new THREE.BoxGeometry(0.018, 0.03, 0.048);
  const triggerGuard = new THREE.Mesh(triggerGuardGeom, blackSteelMat);
  triggerGuard.position.set(0, -0.045, 0.02);
  gunMeshGroup.add(triggerGuard);

  const stockStrutGeom = new THREE.BoxGeometry(0.026, 0.038, 0.24);
  const stockStrut = new THREE.Mesh(stockStrutGeom, chassisMat);
  stockStrut.position.set(0, 0.01, 0.20);
  gunMeshGroup.add(stockStrut);

  const cheekRestGeom = new THREE.BoxGeometry(0.036, 0.035, 0.12);
  const cheekRest = new THREE.Mesh(cheekRestGeom, polymerMat);
  cheekRest.position.set(0, 0.045, 0.18);
  gunMeshGroup.add(cheekRest);

  const buttPlateGeom = new THREE.BoxGeometry(0.038, 0.12, 0.03);
  const buttPlate = new THREE.Mesh(buttPlateGeom, blackSteelMat);
  buttPlate.position.set(0, 0.0, 0.32);
  gunMeshGroup.add(buttPlate);

  // --- 4. HIGH-MAGNIFICATION TELESCOPIC SCOPE ---
  const scopeGroup = new THREE.Group();
  scopeGroup.name = 'Sniper_Scope';
  scopeGroup.position.set(0, 0.092, -0.08);

  // Main Tube
  const tubeGeom = new THREE.CylinderGeometry(0.016, 0.016, 0.24, 12);
  tubeGeom.rotateX(Math.PI / 2);
  const tube = new THREE.Mesh(tubeGeom, scopeBodyMat);
  scopeGroup.add(tube);

  // Objective Bell (Front large flare)
  const objBellGeom = new THREE.CylinderGeometry(0.025, 0.017, 0.08, 12);
  objBellGeom.rotateX(Math.PI / 2);
  const objBell = new THREE.Mesh(objBellGeom, scopeBodyMat);
  objBell.position.set(0, 0, -0.15);
  scopeGroup.add(objBell);

  // Ocular Bell (Rear eyepiece eye cup)
  const ocularBellGeom = new THREE.CylinderGeometry(0.017, 0.024, 0.065, 12);
  ocularBellGeom.rotateX(Math.PI / 2);
  const ocularBell = new THREE.Mesh(ocularBellGeom, scopeBodyMat);
  ocularBell.position.set(0, 0, 0.14);
  scopeGroup.add(ocularBell);

  // Turrets (Elevation top & Windage side)
  const turretTop = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.018, 10), blackSteelMat);
  turretTop.position.set(0, 0.022, 0);
  scopeGroup.add(turretTop);

  const turretSide = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.018, 10), blackSteelMat);
  turretSide.rotation.z = Math.PI / 2;
  turretSide.position.set(0.022, 0, 0);
  scopeGroup.add(turretSide);

  // Optical Glass Lens
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), opticGlassMat);
  lens.position.set(0, 0, 0.173);
  scopeGroup.add(lens);

  // Scope Mount Rings to Picatinny
  const ring1 = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.036, 0.02), blackSteelMat);
  ring1.position.set(0, -0.018, -0.06);
  scopeGroup.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.036, 0.02), blackSteelMat);
  ring2.position.set(0, -0.018, 0.06);
  scopeGroup.add(ring2);

  gunMeshGroup.add(scopeGroup);

  // --- 5. SEPARATED 5-ROUND BOX MAGAZINE ---
  const magazineGroup = new THREE.Group();
  magazineGroup.name = 'Sniper_Magazine';
  magazineGroup.position.set(0, -0.08, -0.06);

  const magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.12, 0.065), blackSteelMat);
  magazineGroup.add(magMesh);
  root.add(magazineGroup);

  // --- 6. CYCLING BOLT CARRIER & LEVER HANDLE ---
  const boltCarrierGroup = new THREE.Group();
  boltCarrierGroup.name = 'Sniper_Bolt_Group';
  boltCarrierGroup.position.set(0.028, 0.032, 0.01);

  const boltStem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.045, 8), blackSteelMat);
  boltStem.rotation.z = Math.PI / 2;
  boltStem.position.set(0.022, 0, 0);
  boltCarrierGroup.add(boltStem);

  const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), blackSteelMat);
  boltKnob.position.set(0.046, -0.012, 0);
  boltCarrierGroup.add(boltKnob);
  root.add(boltCarrierGroup);

  // --- 7. ANATOMICAL ARMS & GLOVES ---
  // Right Arm (Pistol Grip)
  const rightArmGroup = new THREE.Group();
  const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.28, 12), armSkinMat);
  rForearm.position.set(0.12, -0.19, 0.17);
  rForearm.rotation.set(0.42, 0.1, -0.35);
  rightArmGroup.add(rForearm);

  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.08, 0.055), gloveMat);
  rHand.position.set(0, -0.075, 0.06);
  rHand.rotation.x = -0.32;
  rightArmGroup.add(rHand);
  root.add(rightArmGroup);

  // Left Arm (Supports Forend)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.name = 'Sniper_LeftArm';
  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.30, 12), armSkinMat);
  lForearm.position.set(-0.10, -0.16, -0.18);
  lForearm.rotation.set(0.45, -0.2, 0.42);
  leftArmGroup.add(lForearm);

  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.054, 0.065), gloveMat);
  lHand.position.set(0, 0.01, -0.28); // Supports bottom of forend
  leftArmGroup.add(lHand);
  root.add(leftArmGroup);

  // --- 8. MUZZLE FLASH & TELEMETRY ---
  const muzzleFlashGroup = new THREE.Group();
  muzzleFlashGroup.position.set(0, 0.025, -0.92);

  const flashConeMat = new THREE.MeshBasicMaterial({
    color: 0xffcc44,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const flashMesh = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 8), flashConeMat);
  flashMesh.rotation.x = -Math.PI / 2;
  flashMesh.position.z = -0.11;
  muzzleFlashGroup.add(flashMesh);

  const muzzleLight = new THREE.PointLight(0xffaa22, 0, 14);
  muzzleFlashGroup.add(muzzleLight);
  gunMeshGroup.add(muzzleFlashGroup);

  const ejectionPoint = new THREE.Vector3(0.03, 0.03, -0.04);

  return {
    root,
    gunMeshGroup,
    boltCarrierGroup,
    magazineGroup,
    muzzleFlashGroup,
    muzzleLight,
    ejectionPoint,
    leftArmGroup,
    rightArmGroup,
  };
}
