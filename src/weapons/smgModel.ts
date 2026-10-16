// src/weapons/smgModel.ts
// High-fidelity procedural 3D model of the CYCLONE-9 Submachine Gun (SMG)
// Features: compact tactical receiver, straight stick mag, reciprocating bolt,
// ported muzzle brake, tritium glow sights, and seamless anatomical arms/gloves.

import * as THREE from 'three';

export interface SMGComponents {
  root: THREE.Group;
  gunMeshGroup: THREE.Group;
  magazineGroup: THREE.Group;
  boltCarrierGroup: THREE.Group;
  muzzleFlashGroup: THREE.Group;
  muzzleLight: THREE.PointLight;
  ejectionPoint: THREE.Vector3;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftHandGroup: THREE.Group;
}

export function createSMGModel(): SMGComponents {
  const root = new THREE.Group();
  root.name = 'SMG_Root';

  const gunMeshGroup = new THREE.Group();
  root.add(gunMeshGroup);

  // Materials: Tactical Anodized Matte Gunmetal and Ergonomic Carbon-Polymer
  const receiverMat = new THREE.MeshStandardMaterial({
    color: 0x464c54,
    metalness: 0.75,
    roughness: 0.35,
  });

  const upperReceiverMat = new THREE.MeshStandardMaterial({
    color: 0x58606a,
    metalness: 0.82,
    roughness: 0.28,
  });

  const polymerGripMat = new THREE.MeshStandardMaterial({
    color: 0x24282e,
    roughness: 0.82,
    metalness: 0.12,
  });

  const chromeBoltMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf4,
    metalness: 0.98,
    roughness: 0.10,
  });

  const magazineMat = new THREE.MeshStandardMaterial({
    color: 0x343a42,
    metalness: 0.78,
    roughness: 0.30,
  });

  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x5c6570,
    metalness: 0.92,
    roughness: 0.20,
  });

  const tritiumGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x1a2026,
    roughness: 0.85,
    metalness: 0.10,
  });

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x242a30,
    roughness: 0.88,
    metalness: 0.05,
  });

  // 1. Lower Receiver & Magazine Well
  const lowerReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.065, 0.24), receiverMat);
  lowerReceiver.position.set(0, -0.015, -0.02);
  lowerReceiver.castShadow = true;
  gunMeshGroup.add(lowerReceiver);

  // Magwell shroud (angled flared well)
  const magwell = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.055, 0.055), receiverMat);
  magwell.position.set(0, -0.055, -0.06);
  magwell.rotation.x = 0.08;
  magwell.castShadow = true;
  gunMeshGroup.add(magwell);

  // 2. Upper Receiver & Cylindrical Shroud
  const upperReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.048, 0.28), upperReceiverMat);
  upperReceiver.position.set(0, 0.028, -0.04);
  upperReceiver.castShadow = true;
  gunMeshGroup.add(upperReceiver);

  // Top Picatinny Rail
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.010, 0.26), receiverMat);
  topRail.position.set(0, 0.056, -0.04);
  gunMeshGroup.add(topRail);

  // Rail Serrations
  for (let z = -0.15; z <= 0.07; z += 0.022) {
    const notch = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.004, 0.009),
      new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.5 })
    );
    notch.position.set(0, 0.060, z);
    gunMeshGroup.add(notch);
  }

  // 3. Compact Barrel & Ported Compensator
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.16, 12), barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.025, -0.25);
  barrel.castShadow = true;
  gunMeshGroup.add(barrel);

  // Muzzle Compensator (Dual side gas ports)
  const comp = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.045, 12), upperReceiverMat);
  comp.rotation.x = Math.PI / 2;
  comp.position.set(0, 0.025, -0.34);
  gunMeshGroup.add(comp);

  const compHole = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.01, 8), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  compHole.rotation.x = Math.PI / 2;
  compHole.position.set(0, 0.025, -0.363);
  gunMeshGroup.add(compHole);

  // 4. Pistol Grip & Trigger Guard
  const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.11, 0.048), polymerGripMat);
  pistolGrip.position.set(0, -0.08, 0.07);
  pistolGrip.rotation.x = 0.32;
  pistolGrip.castShadow = true;
  gunMeshGroup.add(pistolGrip);

  // Grip texture ridges
  for (let i = 0; i < 4; i++) {
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.006, 0.038),
      new THREE.MeshStandardMaterial({ color: 0x0e1012, roughness: 0.95 })
    );
    ridge.position.set(0, -0.06 - i * 0.018, 0.076 + i * 0.006);
    ridge.rotation.x = 0.32;
    gunMeshGroup.add(ridge);
  }

  // Trigger Guard & Trigger
  const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.035, 0.05), receiverMat);
  triggerGuard.position.set(0, -0.055, 0.035);
  gunMeshGroup.add(triggerGuard);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.020, 0.012), chromeBoltMat);
  trigger.position.set(0, -0.052, 0.035);
  trigger.rotation.x = -0.25;
  gunMeshGroup.add(trigger);

  // 5. Tactical Foregrip (Vertical/Angled Grip for Left Hand)
  const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.085, 0.040), polymerGripMat);
  foregrip.position.set(0, -0.065, -0.155);
  foregrip.rotation.x = -0.12; // Slight ergonomic backward rake
  foregrip.castShadow = true;
  gunMeshGroup.add(foregrip);

  const foregripCap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.012, 0.042), receiverMat);
  foregripCap.position.set(0, -0.108, -0.150);
  gunMeshGroup.add(foregripCap);

  // 6. Tactical Open U-Notch & Tritium Sights
  // Rear Sight (Open U-Notch with Dual Tritium Dots)
  const rearSightLeftWing = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.024, 0.018), receiverMat);
  rearSightLeftWing.position.set(-0.013, 0.068, 0.07);
  gunMeshGroup.add(rearSightLeftWing);

  const rearSightRightWing = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.024, 0.018), receiverMat);
  rearSightRightWing.position.set(0.013, 0.068, 0.07);
  gunMeshGroup.add(rearSightRightWing);

  const rearSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.006, 0.018), receiverMat);
  rearSightBase.position.set(0, 0.058, 0.07);
  gunMeshGroup.add(rearSightBase);

  // Rear Glowing Tritium Guide Dots (Left & Right)
  const rearDotLeft = new THREE.Mesh(new THREE.SphereGeometry(0.002, 6, 6), tritiumGlowMat);
  rearDotLeft.position.set(-0.013, 0.074, 0.062);
  gunMeshGroup.add(rearDotLeft);

  const rearDotRight = new THREE.Mesh(new THREE.SphereGeometry(0.002, 6, 6), tritiumGlowMat);
  rearDotRight.position.set(0.013, 0.074, 0.062);
  gunMeshGroup.add(rearDotRight);

  // Front Sight Post (Centered Tritium Dot)
  const frontSightPost = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.022, 0.008), receiverMat);
  frontSightPost.position.set(0, 0.066, -0.28);
  gunMeshGroup.add(frontSightPost);

  const frontSightLeftWing = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.018, 0.010), receiverMat);
  frontSightLeftWing.position.set(-0.012, 0.064, -0.28);
  gunMeshGroup.add(frontSightLeftWing);

  const frontSightRightWing = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.018, 0.010), receiverMat);
  frontSightRightWing.position.set(0.012, 0.064, -0.28);
  gunMeshGroup.add(frontSightRightWing);

  const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 6, 6), tritiumGlowMat);
  frontDot.position.set(0, 0.074, -0.28);
  gunMeshGroup.add(frontDot);

  // 7. Bolt Carrier Group (Reciprocating on Fire)
  const boltCarrierGroup = new THREE.Group();
  boltCarrierGroup.position.set(0.022, 0.028, -0.02);

  const boltBlock = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.026, 0.06), chromeBoltMat);
  boltCarrierGroup.add(boltBlock);

  // Ambidextrous charging handle knob
  const chargingHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.032, 8), receiverMat);
  chargingHandle.rotation.z = Math.PI / 2;
  chargingHandle.position.set(-0.044, 0.015, -0.04);
  boltCarrierGroup.add(chargingHandle);

  gunMeshGroup.add(boltCarrierGroup);

  // 8. Straight Stick Magazine (Articulated for Reload Animation)
  const magazineGroup = new THREE.Group();
  // Rest position inside magwell
  magazineGroup.position.set(0, -0.06, -0.06);

  // 9mm 30-round straight stick body
  const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.175, 0.038), magazineMat);
  magBody.position.set(0, -0.07, 0);
  magBody.rotation.x = 0.08;
  magBody.castShadow = true;
  magazineGroup.add(magBody);

  // Magazine Baseplate
  const magBaseplate = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.014, 0.042), receiverMat);
  magBaseplate.position.set(0, -0.158, 0.007);
  magBaseplate.rotation.x = 0.08;
  magazineGroup.add(magBaseplate);

  // Witness holes / Capacity window on spine
  const magSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.14, 0.006),
    new THREE.MeshStandardMaterial({ color: 0xc89828, metalness: 0.9, roughness: 0.25 })
  );
  magSpine.position.set(0, -0.065, 0.019);
  magSpine.rotation.x = 0.08;
  magazineGroup.add(magSpine);

  gunMeshGroup.add(magazineGroup);

  // 9. Articulated Anatomical Tactical Arms and Hands
  // Right Arm (Firing Hand gripping pistol grip)
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0, 0, 0);

  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.068, 0.070), gloveMat);
  rightHand.position.set(0, -0.085, 0.075);
  rightHand.rotation.set(0.35, 0, 0);
  rightArmGroup.add(rightHand);

  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.054, 0.35, 10), sleeveMat);
  rightForearm.position.set(0.085, -0.23, 0.24);
  rightForearm.rotation.set(-0.80, 0.20, -0.38);
  rightArmGroup.add(rightForearm);
  gunMeshGroup.add(rightArmGroup);

  // Left Arm (Seamless Continuous Tactical Support Arm gripping Foregrip)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(0, 0, 0);

  const leftHandGroup = new THREE.Group();
  leftArmGroup.add(leftHandGroup);

  // Wrist anchor firmly wrapping around the front vertical foregrip
  const wristPos = new THREE.Vector3(-0.038, -0.075, -0.155);
  const armOrigin = new THREE.Vector3(-0.25, -0.38, 0.08); // Seamless off-screen origin

  // Continuous forearm cylinder spanned directly from off-screen to wrist
  const armVec = wristPos.clone().sub(armOrigin);
  const armLen = armVec.length();
  const armMid = armOrigin.clone().add(armVec.clone().multiplyScalar(0.5));

  const leftForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.060, armLen, 12),
    sleeveMat
  );
  leftForearm.position.copy(armMid);
  leftForearm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armVec.clone().normalize());
  leftArmGroup.add(leftForearm);

  // Wrist Sleeve Cuff Collar
  const sleeveCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.050, 0.04, 12), sleeveMat);
  sleeveCuff.position.copy(wristPos);
  sleeveCuff.quaternion.copy(leftForearm.quaternion);
  leftArmGroup.add(sleeveCuff);

  // Tactical Watch on Left Wrist
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.85 });
  const watchMat = new THREE.MeshStandardMaterial({ color: 0x2e3640, metalness: 0.8, roughness: 0.2 });
  const watchGlassMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

  const watchStrap = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.058, 0.022), strapMat);
  watchStrap.position.set(-0.042, -0.078, -0.150);
  watchStrap.quaternion.copy(leftForearm.quaternion);
  leftArmGroup.add(watchStrap);

  const watchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.007, 12), watchMat);
  watchBody.rotation.z = Math.PI / 2;
  watchBody.position.set(-0.063, -0.068, -0.150);
  leftArmGroup.add(watchBody);

  const watchFace = new THREE.Mesh(new THREE.CircleGeometry(0.009, 12), watchGlassMat);
  watchFace.position.set(-0.067, -0.068, -0.150);
  watchFace.rotation.y = -Math.PI / 2;
  leftArmGroup.add(watchFace);

  // Tactical Glove Hand Wrapped on Vertical Foregrip
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.048, 0.055), gloveMat);
  palm.position.set(-0.020, -0.068, -0.155);
  palm.rotation.set(0.15, 0.28, -0.18);
  leftHandGroup.add(palm);

  // Molded Knuckle Shield
  const knuckleArmor = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.042, 0.052),
    new THREE.MeshStandardMaterial({ color: 0x222830, roughness: 0.35, metalness: 0.4 })
  );
  knuckleArmor.position.set(-0.028, -0.068, -0.155);
  knuckleArmor.rotation.set(0.15, 0.28, -0.18);
  leftHandGroup.add(knuckleArmor);

  // Fingers wrapped firmly around foregrip
  const curledFingers = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.055, 0.042), gloveMat);
  curledFingers.position.set(0.012, -0.068, -0.155);
  curledFingers.rotation.set(0.15, 0.28, -0.18);
  leftHandGroup.add(curledFingers);

  // Thumb Resting on Left Shroud
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.020, 0.038), gloveMat);
  thumb.position.set(-0.022, -0.038, -0.160);
  thumb.rotation.set(-0.25, 0.22, -0.35);
  leftHandGroup.add(thumb);

  gunMeshGroup.add(leftArmGroup);

  // 10. Muzzle Flash FX Group
  const muzzleFlashGroup = new THREE.Group();
  muzzleFlashGroup.position.set(0, 0.025, -0.38);
  muzzleFlashGroup.visible = false;

  const flashCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.055, 0),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
  );
  muzzleFlashGroup.add(flashCore);

  const flashSpike = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.16, 5),
    new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.9 })
  );
  flashSpike.rotation.x = Math.PI / 2;
  flashSpike.position.z = -0.08;
  muzzleFlashGroup.add(flashSpike);

  const muzzleLight = new THREE.PointLight(0xffaa22, 0, 14, 2);
  muzzleFlashGroup.add(muzzleLight);
  gunMeshGroup.add(muzzleFlashGroup);

  const ejectionPoint = new THREE.Vector3(0.024, 0.032, -0.02);

  return {
    root,
    gunMeshGroup,
    magazineGroup,
    boltCarrierGroup,
    muzzleFlashGroup,
    muzzleLight,
    ejectionPoint,
    leftArmGroup,
    rightArmGroup,
    leftHandGroup,
  };
}
