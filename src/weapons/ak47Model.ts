// src/weapons/ak47Model.ts
// High-fidelity procedural 3D model of the AK-47 Vanguard Assault Rifle with articulated components

import * as THREE from 'three';

export interface AK47Components {
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
  sightReticleGroup: THREE.Group;
}

export function createAK47Model(): AK47Components {
  const root = new THREE.Group();
  root.name = 'AK47_Root';

  // Master group for the weapon body (allows independent sway/recoil)
  const gunMeshGroup = new THREE.Group();
  root.add(gunMeshGroup);

  // Materials
  const metalReceiverMat = new THREE.MeshStandardMaterial({
    color: 0x363c42,
    metalness: 0.85,
    roughness: 0.28,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x22262a,
    metalness: 0.92,
    roughness: 0.22,
  });

  const polishedBoltMat = new THREE.MeshStandardMaterial({
    color: 0xe0e6ed,
    metalness: 0.98,
    roughness: 0.12,
  });

  const woodStockMat = new THREE.MeshStandardMaterial({
    color: 0x933b19,
    roughness: 0.45,
    metalness: 0.08,
  });

  const woodHandguardMat = new THREE.MeshStandardMaterial({
    color: 0xa8481e,
    roughness: 0.42,
    metalness: 0.08,
  });

  const magazineSteelMat = new THREE.MeshStandardMaterial({
    color: 0x2b3035,
    metalness: 0.88,
    roughness: 0.3,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x2a333d,
    roughness: 0.75,
    metalness: 0.15,
  });

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x181f26,
    roughness: 0.85,
    metalness: 0.05,
  });

  // 1. Receiver (Main Lower & Stamped Top Cover)
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.082, 0.34), metalReceiverMat);
  receiver.position.set(0, 0, 0);
  receiver.castShadow = true;
  gunMeshGroup.add(receiver);

  // Top Dust Cover (Curved)
  const dustCover = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.26, 12, 1, false, 0, Math.PI), metalReceiverMat);
  dustCover.rotation.x = Math.PI / 2;
  dustCover.position.set(0, 0.041, -0.01);
  gunMeshGroup.add(dustCover);

  // 2. Wooden Stock
  const stockGroup = new THREE.Group();
  stockGroup.position.set(0, -0.01, 0.17);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.11, 0.26), woodStockMat);
  stock.position.set(0, -0.025, 0.13);
  stock.rotation.x = -0.08;
  stock.castShadow = true;
  stockGroup.add(stock);

  // Metal Buttplate
  const buttplate = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.115, 0.012), darkSteelMat);
  buttplate.position.set(0, -0.035, 0.26);
  buttplate.rotation.x = -0.08;
  stockGroup.add(buttplate);
  gunMeshGroup.add(stockGroup);

  // 3. Pistol Grip
  const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.13, 0.055), woodHandguardMat);
  pistolGrip.position.set(0, -0.09, 0.12);
  pistolGrip.rotation.x = 0.42;
  pistolGrip.castShadow = true;
  gunMeshGroup.add(pistolGrip);

  // Trigger Guard & Trigger
  const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.045, 0.07), darkSteelMat);
  triggerGuard.position.set(0, -0.052, 0.08);
  gunMeshGroup.add(triggerGuard);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.025, 0.015), darkSteelMat);
  trigger.position.set(0, -0.048, 0.075);
  trigger.rotation.x = 0.3;
  gunMeshGroup.add(trigger);

  // 4. Wooden Lower Handguard & Upper Gas Tube
  const lowerHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.065, 0.22), woodHandguardMat);
  lowerHandguard.position.set(0, 0.002, -0.27);
  lowerHandguard.castShadow = true;
  gunMeshGroup.add(lowerHandguard);

  const upperGasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 10), woodStockMat);
  upperGasTube.rotation.x = Math.PI / 2;
  upperGasTube.position.set(0, 0.042, -0.26);
  gunMeshGroup.add(upperGasTube);

  // Gas Block (Connecting barrel & gas tube)
  const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.06, 0.038), darkSteelMat);
  gasBlock.position.set(0, 0.035, -0.38);
  gunMeshGroup.add(gasBlock);

  // 5. Steel Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 12), darkSteelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.015, -0.47);
  barrel.castShadow = true;
  gunMeshGroup.add(barrel);

  // Muzzle Slant Brake Compensator
  const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.017, 0.055, 8), darkSteelMat);
  muzzleBrake.rotation.x = Math.PI / 2;
  muzzleBrake.position.set(0, 0.015, -0.71);
  gunMeshGroup.add(muzzleBrake);

  // Front Sight Post with Protective Wings
  const frontSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.065, 0.028), darkSteelMat);
  frontSightBase.position.set(0, 0.05, -0.66);
  const frontSightPin = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.022, 6), metalReceiverMat);
  frontSightPin.position.set(0, 0.065, -0.66);
  gunMeshGroup.add(frontSightBase);
  gunMeshGroup.add(frontSightPin);

  // Rear Tangent Sight Base
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.022, 0.06), darkSteelMat);
  rearSight.position.set(0, 0.052, -0.16);
  gunMeshGroup.add(rearSight);

  // 6. Tactical Side Dovetail Optic Rail & Hollow Holographic Reflex Optic
  const opticGroup = new THREE.Group();
  opticGroup.position.set(0, 0.075, -0.06);

  // Side Dovetail Bracket & Picatinny Riser
  const railBracket = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.12), darkSteelMat);
  railBracket.position.set(-0.026, -0.015, 0);
  opticGroup.add(railBracket);

  const riser = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.014, 0.13), darkSteelMat);
  riser.position.set(0, 0.007, 0);
  opticGroup.add(riser);

  // Sight Hood - HOLLOW FRAME (allows crystal clear sightline through the optical window)
  const hoodMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e22,
    metalness: 0.9,
    roughness: 0.25,
  });

  // Base Deck
  const hoodDeck = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.008, 0.08), hoodMat);
  hoodDeck.position.set(0, 0.015, 0);
  opticGroup.add(hoodDeck);

  // Left Protective Pillar
  const hoodLeft = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.052, 0.08), hoodMat);
  hoodLeft.position.set(-0.024, 0.041, 0);
  opticGroup.add(hoodLeft);

  // Right Protective Pillar
  const hoodRight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.052, 0.08), hoodMat);
  hoodRight.position.set(0.024, 0.041, 0);
  opticGroup.add(hoodRight);

  // Top Sunshield Arch
  const hoodRoof = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.006, 0.08), hoodMat);
  hoodRoof.position.set(0, 0.067, 0);
  opticGroup.add(hoodRoof);

  // Tactical Turrets & Battery Compartment
  const elevationTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 10), darkSteelMat);
  elevationTurret.position.set(0, 0.073, 0);
  opticGroup.add(elevationTurret);

  const windageTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 10), darkSteelMat);
  windageTurret.rotation.z = Math.PI / 2;
  windageTurret.position.set(0.030, 0.041, 0);
  opticGroup.add(windageTurret);

  const batteryCompartment = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 12), darkSteelMat);
  batteryCompartment.rotation.x = Math.PI / 2;
  batteryCompartment.position.set(-0.028, 0.026, 0);
  opticGroup.add(batteryCompartment);

  // Optical Glass Lens - Ultra-clean anti-reflective coated lens
  const lens = new THREE.Mesh(
    new THREE.PlaneGeometry(0.042, 0.046),
    new THREE.MeshStandardMaterial({
      color: 0x66ccff,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    })
  );
  lens.position.set(0, 0.041, -0.015);
  opticGroup.add(lens);

  // Holographic Reticle Group (Center Dot + Speed Ring + 4 Cardinal Crosshair Ticks)
  // Window optical center is at local y = 0.041
  const sightReticleGroup = new THREE.Group();
  sightReticleGroup.position.set(0, 0.041, -0.02);

  // Center Precision Dot (2 MOA)
  const reticleDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.0016, 16),
    new THREE.MeshBasicMaterial({ color: 0xff1632, side: THREE.DoubleSide, depthTest: false })
  );
  sightReticleGroup.add(reticleDot);

  // Tactical Speed Ring (65 MOA outer circle)
  const reticleRing = new THREE.Mesh(
    new THREE.RingGeometry(0.009, 0.0105, 36),
    new THREE.MeshBasicMaterial({ color: 0xff2038, side: THREE.DoubleSide, depthTest: false })
  );
  sightReticleGroup.add(reticleRing);

  // Outer glow halo
  const reticleGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.008, 0.0115, 36),
    new THREE.MeshBasicMaterial({ color: 0xff4466, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthTest: false })
  );
  sightReticleGroup.add(reticleGlow);

  // Cardinal Crosshair Hash Ticks
  const tickMat = new THREE.MeshBasicMaterial({ color: 0xff1632, side: THREE.DoubleSide, depthTest: false });
  const tickTop = new THREE.Mesh(new THREE.PlaneGeometry(0.0012, 0.004), tickMat);
  tickTop.position.set(0, 0.013, 0);
  sightReticleGroup.add(tickTop);

  const tickBottom = new THREE.Mesh(new THREE.PlaneGeometry(0.0012, 0.004), tickMat);
  tickBottom.position.set(0, -0.013, 0);
  sightReticleGroup.add(tickBottom);

  const tickLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.0012), tickMat);
  tickLeft.position.set(-0.013, 0, 0);
  sightReticleGroup.add(tickLeft);

  const tickRight = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.0012), tickMat);
  tickRight.position.set(0.013, 0, 0);
  sightReticleGroup.add(tickRight);

  opticGroup.add(sightReticleGroup);
  gunMeshGroup.add(opticGroup);

  // 7. Bolt Carrier with Charging Handle (Moves during recoil & reload)
  const boltCarrierGroup = new THREE.Group();
  boltCarrierGroup.position.set(0.025, 0.02, 0.02);
  const boltBody = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.028, 0.09), polishedBoltMat);
  boltCarrierGroup.add(boltBody);

  const chargingHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.035, 8), darkSteelMat);
  chargingHandle.rotation.z = Math.PI / 2;
  chargingHandle.position.set(0.02, 0.006, 0);
  boltCarrierGroup.add(chargingHandle);
  gunMeshGroup.add(boltCarrierGroup);

  // 8. Iconic Banana Curved 30-Round Magazine
  const magazineGroup = new THREE.Group();
  magazineGroup.position.set(0, -0.04, -0.06);

  // Build curved magazine using 3 angled segments
  const magSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.09, 0.08), magazineSteelMat);
  magSeg1.position.set(0, -0.04, 0);
  magSeg1.rotation.x = -0.15;
  magSeg1.castShadow = true;
  magazineGroup.add(magSeg1);

  const magSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.09, 0.075), magazineSteelMat);
  magSeg2.position.set(0, -0.115, -0.02);
  magSeg2.rotation.x = -0.32;
  magSeg2.castShadow = true;
  magazineGroup.add(magSeg2);

  const magSeg3 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.07), magazineSteelMat);
  magSeg3.position.set(0, -0.185, -0.055);
  magSeg3.rotation.x = -0.48;
  magSeg3.castShadow = true;
  magazineGroup.add(magSeg3);

  // Magazine Baseplate
  const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.015, 0.075), darkSteelMat);
  magBase.position.set(0, -0.22, -0.08);
  magBase.rotation.x = -0.48;
  magazineGroup.add(magBase);

  gunMeshGroup.add(magazineGroup);

  // 9. Articulated Tactical Arms and Hands (parented to gunMeshGroup for rock-solid viewmodel tracking)
  // Right Arm (Firing Hand on Pistol Grip)
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0, 0, 0);

  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.07, 0.075), gloveMat);
  rightHand.position.set(0, -0.09, 0.12);
  rightHand.rotation.set(0.42, 0, 0);
  rightArmGroup.add(rightHand);

  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.054, 0.36, 10), sleeveMat);
  rightForearm.position.set(0.09, -0.24, 0.26);
  rightForearm.rotation.set(-0.8, 0.2, -0.4);
  rightArmGroup.add(rightForearm);
  gunMeshGroup.add(rightArmGroup);

  // Left Arm (Complete, Seamless Anatomical Support Arm & Tactical Glove)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(0, 0, 0);

  const leftHandGroup = new THREE.Group();
  leftArmGroup.add(leftHandGroup);

  // Wrist Anchor point (where forearm seamlessly joins the hand)
  const wristPos = new THREE.Vector3(-0.045, -0.065, -0.22);
  const armOrigin = new THREE.Vector3(-0.24, -0.36, 0.10); // Extends completely off-screen

  // A. Continuous Forearm Sleeve - Mathematically spanned from armOrigin directly to wristPos (ZERO GAP!)
  const armVector = wristPos.clone().sub(armOrigin);
  const armLength = armVector.length();
  const armMidpoint = armOrigin.clone().add(armVector.clone().multiplyScalar(0.5));

  const leftForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.062, armLength, 12),
    sleeveMat
  );
  leftForearm.position.copy(armMidpoint);
  leftForearm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armVector.clone().normalize());
  leftArmGroup.add(leftForearm);

  // Forearm Fold / Wrist transition collar
  const sleeveCuffGeo = new THREE.CylinderGeometry(0.050, 0.052, 0.045, 12);
  const sleeveCuff = new THREE.Mesh(sleeveCuffGeo, sleeveMat);
  sleeveCuff.position.copy(wristPos);
  sleeveCuff.quaternion.copy(leftForearm.quaternion);
  leftArmGroup.add(sleeveCuff);

  // B. Tactical Watch & Glove Cuff
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.85 });
  const watchMat = new THREE.MeshStandardMaterial({ color: 0x2e3640, metalness: 0.8, roughness: 0.2 });
  const watchGlassMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

  const watchStrap = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.060, 0.022), strapMat);
  watchStrap.position.set(-0.046, -0.068, -0.218);
  watchStrap.quaternion.copy(leftForearm.quaternion);
  leftArmGroup.add(watchStrap);

  const watchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12), watchMat);
  watchBody.rotation.x = Math.PI / 2;
  watchBody.position.set(-0.066, -0.058, -0.218);
  leftArmGroup.add(watchBody);

  const watchFace = new THREE.Mesh(new THREE.CircleGeometry(0.009, 12), watchGlassMat);
  watchFace.position.set(-0.066, -0.058, -0.223);
  leftArmGroup.add(watchFace);

  // C. Tactical Glove Palm (Seamless connection to wrist and lower wooden handguard)
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.038, 0.088), gloveMat);
  palm.position.set(-0.015, -0.034, -0.265);
  palm.rotation.set(0.12, 0.32, -0.24);
  leftHandGroup.add(palm);

  // Reinforced Grip Pad under the palm
  const gripPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.010, 0.080),
    new THREE.MeshStandardMaterial({ color: 0x181c20, roughness: 0.9 })
  );
  gripPad.position.set(-0.012, -0.022, -0.265);
  gripPad.rotation.set(0.12, 0.32, -0.24);
  leftHandGroup.add(gripPad);

  // D. Fingers Wrapping Up Around the Wooden Handguard
  // Lower finger segments (wrapping along the right side of the wood)
  const fingersLower = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.060, 0.082), gloveMat);
  fingersLower.position.set(0.024, -0.008, -0.265);
  fingersLower.rotation.set(0.08, 0.15, -0.10);
  leftHandGroup.add(fingersLower);

  // Upper finger tips (curling comfortably over the top/side)
  const fingerTips = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.018, 0.078), gloveMat);
  fingerTips.position.set(0.018, 0.026, -0.265);
  fingerTips.rotation.set(0.08, 0.15, 0.25);
  leftHandGroup.add(fingerTips);

  // Molded Tactical Knuckle Armor
  const knuckleArmor = new THREE.Mesh(
    new THREE.BoxGeometry(0.024, 0.032, 0.080),
    new THREE.MeshStandardMaterial({ color: 0x1f242a, roughness: 0.35, metalness: 0.4 })
  );
  knuckleArmor.position.set(0.028, -0.010, -0.265);
  knuckleArmor.rotation.set(0.08, 0.15, -0.10);
  leftHandGroup.add(knuckleArmor);

  // E. Thumb Rest (Resting comfortably along the left side of the handguard)
  const thumbBase = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.026, 0.042), gloveMat);
  thumbBase.position.set(-0.028, -0.018, -0.24);
  thumbBase.rotation.set(-0.15, 0.28, -0.30);
  leftHandGroup.add(thumbBase);

  const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.020, 0.052), gloveMat);
  thumbTip.position.set(-0.028, 0.006, -0.27);
  thumbTip.rotation.set(0.12, 0.20, -0.18);
  leftHandGroup.add(thumbTip);

  gunMeshGroup.add(leftArmGroup);

  // 10. Muzzle Flash FX Group
  const muzzleFlashGroup = new THREE.Group();
  muzzleFlashGroup.position.set(0, 0.015, -0.74);
  muzzleFlashGroup.visible = false;

  const flashCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.075, 0),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
  );
  muzzleFlashGroup.add(flashCore);

  const flashSpike1 = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.22, 5),
    new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.9 })
  );
  flashSpike1.rotation.x = Math.PI / 2;
  flashSpike1.position.z = -0.11;
  muzzleFlashGroup.add(flashSpike1);

  const flashSpike2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.035, 0.16, 5),
    new THREE.MeshBasicMaterial({ color: 0xff5511, transparent: true, opacity: 0.85 })
  );
  flashSpike2.rotation.y = Math.PI / 2;
  muzzleFlashGroup.add(flashSpike2);

  const muzzleLight = new THREE.PointLight(0xff9922, 0, 16, 2);
  muzzleFlashGroup.add(muzzleLight);
  gunMeshGroup.add(muzzleFlashGroup);

  const ejectionPoint = new THREE.Vector3(0.03, 0.025, 0.03);

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
    sightReticleGroup,
  };
}
