// src/weapons/shotgunModel.ts
// Tactical Combat Shotgun (SPAS-12 / 12-Gauge Combat) with movable grooved pump,
// ribbed barrel, front bead sight, shell loading port, and anatomical arms.

import * as THREE from 'three';

export interface ShotgunComponents {
  root: THREE.Group;
  gunMeshGroup: THREE.Group;
  pumpGroup: THREE.Group;
  shellGroup: THREE.Group;
  muzzlePoint: THREE.Group;
  muzzleFlashGroup: THREE.Group;
  muzzleLight: THREE.PointLight;
  ejectionPoint: THREE.Vector3;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftHandGroup?: THREE.Group;
  updateSupportArm?: (pumpZ?: number) => void;
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

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x181f26,
    roughness: 0.85,
    metalness: 0.05,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x1a211e,
    roughness: 0.85,
    metalness: 0.15,
  });

  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x14181c,
    roughness: 0.85,
  });

  const watchMat = new THREE.MeshStandardMaterial({
    color: 0x2e3640,
    metalness: 0.8,
    roughness: 0.2,
  });

  const watchGlassMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
  });

  const knuckleArmorMat = new THREE.MeshStandardMaterial({
    color: 0x222830,
    roughness: 0.35,
    metalness: 0.4,
  });

  const gripPadMat = new THREE.MeshStandardMaterial({
    color: 0x121518,
    roughness: 0.9,
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
  // A. Right Arm (Holding Pistol Grip)
  const rightArmGroup = new THREE.Group();
  rightArmGroup.name = 'Shotgun_RightArm';

  // Firing Hand (Tactical glove wrapped securely around the combat pistol grip)
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.078, 0.062), gloveMat);
  rHand.position.set(0, -0.075, 0.05);
  rHand.rotation.x = -0.32;
  rightArmGroup.add(rHand);

  // Trigger finger extending along receiver toward trigger guard
  const rTriggerFinger = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.042), gloveMat);
  rTriggerFinger.position.set(-0.020, -0.052, 0.024);
  rTriggerFinger.rotation.set(-0.10, 0.08, 0);
  rightArmGroup.add(rTriggerFinger);

  // Right Forearm (Extending seamlessly from wrist down-back off-screen)
  const rArmOrigin = new THREE.Vector3(0.20, -0.38, 0.30); // Off-screen bottom right
  const rWristPos = new THREE.Vector3(0.015, -0.09, 0.06);
  const rArmVec = rWristPos.clone().sub(rArmOrigin);
  const rArmLen = rArmVec.length();
  const rArmMid = rArmOrigin.clone().addScaledVector(rArmVec, 0.5);

  const rForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.040, 0.052, rArmLen, 12),
    armSkinMat
  );
  rForearm.position.copy(rArmMid);
  rForearm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rArmVec.clone().normalize());
  rightArmGroup.add(rForearm);

  // Rolled sleeve collar at right arm entry
  const rSleeveCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.058, 0.08, 12),
    sleeveMat
  );
  rSleeveCollar.position.copy(rArmOrigin.clone().addScaledVector(rArmVec, 0.08));
  rSleeveCollar.quaternion.copy(rForearm.quaternion);
  rightArmGroup.add(rSleeveCollar);

  root.add(rightArmGroup);

  // B. Left Hand & Tactical Glove (Directly grips and rides on the movable pump slide)
  const leftHandGroup = new THREE.Group();
  leftHandGroup.name = 'Shotgun_LeftHand';

  // 1. Palm supporting the underside of the grooved pump slide
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.026, 0.084), gloveMat);
  palm.position.set(-0.006, -0.036, 0.005);
  palm.rotation.set(0.08, 0.18, -0.15);
  leftHandGroup.add(palm);

  // Reinforced non-slip rubber grip pad facing pump grooves
  const gripPad = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.008, 0.078), gripPadMat);
  gripPad.position.set(-0.004, -0.025, 0.005);
  gripPad.rotation.set(0.08, 0.18, -0.15);
  leftHandGroup.add(gripPad);

  // 2. Curled fingers wrapping up along the right side of the pump slide
  const fingersLower = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.052, 0.078), gloveMat);
  fingersLower.position.set(0.026, -0.012, 0.005);
  fingersLower.rotation.set(0.08, 0.14, -0.10);
  leftHandGroup.add(fingersLower);

  // Finger tips curling over the top-right shoulder of the pump handle
  const fingerTips = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.074), gloveMat);
  fingerTips.position.set(0.022, 0.022, 0.005);
  fingerTips.rotation.set(0.08, 0.14, 0.22);
  leftHandGroup.add(fingerTips);

  // Molded Tactical Knuckle Armor
  const knuckleArmor = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.034, 0.076), knuckleArmorMat);
  knuckleArmor.position.set(0.030, -0.014, 0.005);
  knuckleArmor.rotation.set(0.08, 0.14, -0.10);
  leftHandGroup.add(knuckleArmor);

  // 3. Thumb resting along the left side of the pump slide
  const thumbBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.026, 0.040), gloveMat);
  thumbBase.position.set(-0.026, -0.020, 0.025);
  thumbBase.rotation.set(-0.12, 0.25, -0.25);
  leftHandGroup.add(thumbBase);

  const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.020, 0.048), gloveMat);
  thumbTip.position.set(-0.026, 0.002, -0.010);
  thumbTip.rotation.set(0.10, 0.18, -0.15);
  leftHandGroup.add(thumbTip);

  // 4. Glove Wrist Cuff Collar (Smooth connection transition)
  const wristLocal = new THREE.Vector3(-0.032, -0.050, 0.046);

  const gloveCuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.052, 0.042, 12),
    gloveMat
  );
  gloveCuff.position.copy(wristLocal);
  leftHandGroup.add(gloveCuff);

  // 5. Tactical Watch on Left Wrist
  const watchStrap = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.058, 0.022), strapMat);
  watchStrap.position.set(-0.034, -0.054, 0.050);
  leftHandGroup.add(watchStrap);

  const watchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.008, 12), watchMat);
  watchBody.rotation.z = Math.PI / 2;
  watchBody.position.set(-0.058, -0.052, 0.050);
  leftHandGroup.add(watchBody);

  const watchFace = new THREE.Mesh(new THREE.CircleGeometry(0.009, 12), watchGlassMat);
  watchFace.position.set(-0.063, -0.052, 0.050);
  watchFace.rotation.y = -Math.PI / 2;
  leftHandGroup.add(watchFace);

  pumpGroup.add(leftHandGroup);

  // C. Left Forearm Assembly (Anchored to off-screen origin, dynamically spans to pump slide)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.name = 'Shotgun_LeftArm';

  const armOrigin = new THREE.Vector3(-0.35, -0.42, 0.26);
  const upVec = new THREE.Vector3(0, 1, 0);

  // Reusable scratch vectors for zero-allocation dynamic updates
  const scratchWrist = new THREE.Vector3();
  const scratchArmVec = new THREE.Vector3();
  const scratchArmDir = new THREE.Vector3();

  // Compute rest-pose forearm span (when pumpGroup is at (0, 0.018, -0.26))
  const restWrist = new THREE.Vector3(
    wristLocal.x,
    0.018 + wristLocal.y,
    -0.26 + wristLocal.z
  );
  const restArmVec = restWrist.clone().sub(armOrigin);
  const baseArmLength = restArmVec.length();

  const leftForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.050, baseArmLength, 12),
    armSkinMat
  );
  leftArmGroup.add(leftForearm);

  // Rolled sleeve collar at base of left arm (where it enters from off-screen)
  const sleeveCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.058, 0.08, 12),
    sleeveMat
  );
  leftArmGroup.add(sleeveCollar);

  // Dynamic follow function: seamlessly spans between off-screen shoulder origin and movable pump slide
  const updateSupportArm = (pumpZ?: number) => {
    const currentPumpZ = pumpZ !== undefined ? pumpZ : pumpGroup.position.z;
    scratchWrist.set(
      wristLocal.x + leftHandGroup.position.x,
      pumpGroup.position.y + wristLocal.y + leftHandGroup.position.y,
      currentPumpZ + wristLocal.z + leftHandGroup.position.z
    );
    scratchArmVec.copy(scratchWrist).sub(armOrigin);
    const len = scratchArmVec.length();
    scratchArmDir.copy(scratchArmVec).normalize();

    leftForearm.position.copy(armOrigin).addScaledVector(scratchArmVec, 0.5);
    leftForearm.quaternion.setFromUnitVectors(upVec, scratchArmDir);
    leftForearm.scale.set(1, len / baseArmLength, 1);

    sleeveCollar.position.copy(armOrigin).addScaledVector(scratchArmVec, 0.08);
    sleeveCollar.quaternion.copy(leftForearm.quaternion);

    gloveCuff.quaternion.copy(leftForearm.quaternion);
    watchStrap.quaternion.copy(leftForearm.quaternion);
  };

  // Initialize forearm for rest pose
  updateSupportArm(-0.26);

  root.add(leftArmGroup);

  // --- 7. EXPLICIT MUZZLE POINT & MUZZLE FLASH ---
  const muzzlePoint = new THREE.Group();
  muzzlePoint.name = 'Shotgun_MuzzlePoint';
  muzzlePoint.position.set(0, 0.038, -0.560);
  gunMeshGroup.add(muzzlePoint);

  const muzzleFlashGroup = new THREE.Group();
  muzzleFlashGroup.position.set(0, 0.038, -0.560);

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
    muzzlePoint,
    muzzleFlashGroup,
    muzzleLight,
    ejectionPoint,
    leftArmGroup,
    rightArmGroup,
    leftHandGroup,
    updateSupportArm,
  };
}
