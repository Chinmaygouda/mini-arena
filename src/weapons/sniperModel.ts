// src/weapons/sniperModel.ts
// Heavy Bolt-Action Sniper Rifle (AW-50 / .50 BMG) with cycling bolt handle,
// high-magnification telescopic scope, dual-port muzzle brake, 5-round magazine, and anatomical arms.

import * as THREE from 'three';

export interface SniperComponents {
  root: THREE.Group;
  gunMeshGroup: THREE.Group;
  boltCarrierGroup: THREE.Group;
  magazineGroup: THREE.Group;
  muzzlePoint: THREE.Group;
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

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x222a25, // Tactical operator combat rolled sleeve
    roughness: 0.9,
    metalness: 0.05,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x1b2024, // Dark tactical glove fabric
    roughness: 0.85,
    metalness: 0.12,
  });

  const knuckleArmorMat = new THREE.MeshStandardMaterial({
    color: 0x111417, // Molded polycarbonate knuckle guard
    roughness: 0.4,
    metalness: 0.35,
  });

  const gripPadMat = new THREE.MeshStandardMaterial({
    color: 0x2d3436, // Reinforced rubber palm grip
    roughness: 0.95,
    metalness: 0.05,
  });

  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x18181b, // Tactical watch strap
    roughness: 0.8,
    metalness: 0.1,
  });

  const watchMat = new THREE.MeshStandardMaterial({
    color: 0x27272a, // Watch bezel
    roughness: 0.3,
    metalness: 0.8,
  });

  const watchGlassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8, // Sapphire watch glass / cyan tactical display
    roughness: 0.1,
    metalness: 0.9,
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
  // A. Right Arm (Holding Pistol Grip)
  const rightArmGroup = new THREE.Group();
  rightArmGroup.name = 'Sniper_RightArm';

  // Firing Hand (Tactical glove wrapped securely around sniper combat pistol grip)
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.078, 0.062), gloveMat);
  rHand.position.set(0, -0.075, 0.05);
  rHand.rotation.x = -0.32;
  rightArmGroup.add(rHand);

  // Trigger finger extending along receiver toward trigger guard
  const rTriggerFinger = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.042), gloveMat);
  rTriggerFinger.position.set(-0.020, -0.052, 0.024);
  rTriggerFinger.rotation.set(-0.10, 0.08, 0);
  rightArmGroup.add(rTriggerFinger);

  // Right Forearm (Sleeved arm extending seamlessly from wrist down-back off-screen)
  const rArmOrigin = new THREE.Vector3(0.18, -0.36, 0.22); // Off-screen bottom right
  const rWristPos = new THREE.Vector3(0.015, -0.09, 0.06);
  const rArmVec = rWristPos.clone().sub(rArmOrigin);
  const rArmLen = rArmVec.length();
  const rArmMid = rArmOrigin.clone().addScaledVector(rArmVec, 0.5);

  const rForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.056, rArmLen, 12),
    sleeveMat
  );
  rForearm.position.copy(rArmMid);
  rForearm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rArmVec.clone().normalize());
  rightArmGroup.add(rForearm);

  root.add(rightArmGroup);

  // B. Left Hand & Tactical Glove (Seamlessly supporting underside of chassis forend)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.name = 'Sniper_LeftArm';

  const leftHandGroup = new THREE.Group();
  leftHandGroup.name = 'Sniper_LeftHand';

  // 1. Palm supporting the underside of the heavy chassis forend (forend bottom is at Y = -0.008)
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.026, 0.084), gloveMat);
  palm.position.set(-0.008, -0.025, -0.27);
  palm.rotation.set(0.08, 0.18, -0.15);
  leftHandGroup.add(palm);

  // Reinforced non-slip rubber grip pad facing chassis bottom
  const gripPad = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.008, 0.078), gripPadMat);
  gripPad.position.set(-0.006, -0.014, -0.27);
  gripPad.rotation.set(0.08, 0.18, -0.15);
  leftHandGroup.add(gripPad);

  // 2. Curled fingers wrapping up along the right side of the forend (X = +0.022)
  const fingersLower = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.052, 0.078), gloveMat);
  fingersLower.position.set(0.025, 0.004, -0.27);
  fingersLower.rotation.set(0.08, 0.14, -0.10);
  leftHandGroup.add(fingersLower);

  // Finger tips curling over the top-right shoulder of the forend chassis
  const fingerTips = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.074), gloveMat);
  fingerTips.position.set(0.021, 0.034, -0.27);
  fingerTips.rotation.set(0.08, 0.14, 0.22);
  leftHandGroup.add(fingerTips);

  // Molded Tactical Knuckle Armor
  const knuckleArmor = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.034, 0.076), knuckleArmorMat);
  knuckleArmor.position.set(0.029, 0.002, -0.27);
  knuckleArmor.rotation.set(0.08, 0.14, -0.10);
  leftHandGroup.add(knuckleArmor);

  // 3. Thumb resting along the left side of the chassis forend (X = -0.022)
  const thumbBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.026, 0.040), gloveMat);
  thumbBase.position.set(-0.026, -0.014, -0.245);
  thumbBase.rotation.set(-0.12, 0.25, -0.25);
  leftHandGroup.add(thumbBase);

  const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.020, 0.048), gloveMat);
  thumbTip.position.set(-0.026, 0.006, -0.280);
  thumbTip.rotation.set(0.10, 0.18, -0.15);
  leftHandGroup.add(thumbTip);

  leftArmGroup.add(leftHandGroup);

  // 4. Left Forearm Assembly - Sleeved arm spanning continuously from off-screen origin to wrist anchor
  const armOrigin = new THREE.Vector3(-0.25, -0.38, 0.12); // Off-screen bottom left matching operator stance
  const wristPos = new THREE.Vector3(-0.040, -0.052, -0.23); // Seamless junction with glove palm
  const lArmVec = wristPos.clone().sub(armOrigin);
  const lArmLen = lArmVec.length();
  const lArmMid = armOrigin.clone().addScaledVector(lArmVec, 0.5);
  const lArmDir = lArmVec.clone().normalize();
  const lArmQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lArmDir);

  const lForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.060, lArmLen, 12),
    sleeveMat
  );
  lForearm.position.copy(lArmMid);
  lForearm.quaternion.copy(lArmQuat);
  leftArmGroup.add(lForearm);

  // Glove Wrist Cuff Collar (Smooth connection transition)
  const gloveCuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.052, 0.042, 12),
    gloveMat
  );
  gloveCuff.position.copy(wristPos);
  gloveCuff.quaternion.copy(lArmQuat);
  leftArmGroup.add(gloveCuff);

  // 5. Tactical Watch on Left Wrist
  const watchStrap = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.058, 0.022), strapMat);
  watchStrap.position.set(-0.042, -0.056, -0.226);
  watchStrap.quaternion.copy(lArmQuat);
  leftArmGroup.add(watchStrap);

  const watchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.008, 12), watchMat);
  watchBody.rotation.z = Math.PI / 2;
  watchBody.position.set(-0.066, -0.054, -0.226);
  leftArmGroup.add(watchBody);

  const watchFace = new THREE.Mesh(new THREE.CircleGeometry(0.009, 12), watchGlassMat);
  watchFace.position.set(-0.071, -0.054, -0.226);
  watchFace.rotation.y = -Math.PI / 2;
  leftArmGroup.add(watchFace);

  root.add(leftArmGroup);

  // --- 8. EXPLICIT MUZZLE POINT & MUZZLE FLASH ---
  const muzzlePoint = new THREE.Group();
  muzzlePoint.name = 'Sniper_MuzzlePoint';
  muzzlePoint.position.set(0, 0.025, -0.923);
  gunMeshGroup.add(muzzlePoint);

  const muzzleFlashGroup = new THREE.Group();
  muzzleFlashGroup.position.set(0, 0.025, -0.923);

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
    muzzlePoint,
    muzzleFlashGroup,
    muzzleLight,
    ejectionPoint,
    leftArmGroup,
    rightArmGroup,
  };
}
