// src/weapons/pistolModel.ts
// Tactical Combat Pistol (M9 / 9mm Tactical) with blowback slide,
// open U-notch tritium sights, ergonomic grip, and articulated arms.

import * as THREE from 'three';

export interface PistolComponents {
  root: THREE.Group;
  gunMeshGroup: THREE.Group;
  slideGroup: THREE.Group;
  magazineGroup: THREE.Group;
  muzzlePoint: THREE.Group;
  muzzleFlashGroup: THREE.Group;
  muzzleLight: THREE.PointLight;
  ejectionPoint: THREE.Vector3;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
}

export function createPistolModel(): PistolComponents {
  const root = new THREE.Group();
  root.name = 'Pistol_Root';

  const gunMeshGroup = new THREE.Group();
  root.add(gunMeshGroup);

  // Materials: Tactical Graphite, Anodized Titanium, and Textured Polymer
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x3e454d,
    metalness: 0.72,
    roughness: 0.38,
  });

  const slideMat = new THREE.MeshStandardMaterial({
    color: 0x4a525b,
    metalness: 0.82,
    roughness: 0.28,
  });

  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x5e6874,
    metalness: 0.92,
    roughness: 0.20,
  });

  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x22272d,
    roughness: 0.85,
    metalness: 0.12,
  });

  const tritiumGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x1e242b,
    roughness: 0.85,
    metalness: 0.10,
  });

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x272d35,
    roughness: 0.88,
    metalness: 0.05,
  });

  // 1. Lower Tactical Polymer Frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.030, 0.20), frameMat);
  frame.position.set(0, -0.005, 0);
  frame.castShadow = true;
  gunMeshGroup.add(frame);

  // Accessory Under-barrel Rail
  const underRail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.006, 0.08), frameMat);
  underRail.position.set(0, -0.022, -0.05);
  gunMeshGroup.add(underRail);

  // Ergonomic Pistol Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.125, 0.052), gripMat);
  grip.position.set(0, -0.075, 0.055);
  grip.rotation.x = 0.36;
  grip.castShadow = true;
  gunMeshGroup.add(grip);

  // Grip Texture Ribs
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.005, 0.036),
      new THREE.MeshStandardMaterial({ color: 0x161a1e, roughness: 0.95 })
    );
    rib.position.set(0, -0.055 - i * 0.016, 0.062 + i * 0.006);
    rib.rotation.x = 0.36;
    gunMeshGroup.add(rib);
  }

  // Trigger Guard
  const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.032, 0.055), frameMat);
  triggerGuard.position.set(0, -0.035, 0.015);
  gunMeshGroup.add(triggerGuard);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, 0.010), slideMat);
  trigger.position.set(0, -0.032, 0.014);
  trigger.rotation.x = 0.25;
  gunMeshGroup.add(trigger);

  // Fixed Internal Match Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.19, 12), barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.022, -0.06);
  gunMeshGroup.add(barrel);

  // 2. Reciprocating Blowback Slide
  const slideGroup = new THREE.Group();
  slideGroup.position.set(0, 0.022, 0);

  // Sleek M9 Combat Slide
  const slideBody = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.025, 0.21), slideMat);
  slideBody.position.set(0, 0, 0);
  slideBody.castShadow = true;
  slideGroup.add(slideBody);

  // Slide Chamfers / Angled Top Shoulders
  const chamferL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.20), frameMat);
  chamferL.position.set(-0.013, 0.011, 0);
  chamferL.rotation.z = Math.PI / 4;
  slideGroup.add(chamferL);

  const chamferR = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.20), frameMat);
  chamferR.position.set(0.013, 0.011, 0);
  chamferR.rotation.z = -Math.PI / 4;
  slideGroup.add(chamferR);

  // Rear Slide Cocking Serrations
  for (let z = 0.045; z <= 0.085; z += 0.010) {
    const serL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.018, 0.004), barrelMat);
    serL.position.set(-0.015, 0, z);
    slideGroup.add(serL);

    const serR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.018, 0.004), barrelMat);
    serR.position.set(0.015, 0, z);
    slideGroup.add(serR);
  }

  // Ejection Port Cutout on Right
  const ejectCutout = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, 0.012, 0.042),
    new THREE.MeshStandardMaterial({ color: 0x181c20, roughness: 0.9 })
  );
  ejectCutout.position.set(0.013, 0.006, -0.01);
  slideGroup.add(ejectCutout);

  // -------------------------------------------------------------
  // 3. Low-Profile Open U-Notch & Tritium Sights
  // -------------------------------------------------------------
  // Rear Sight: Dual Wing Blades with Wide Center Notch
  const rearSightLeftWing = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.008), slideMat);
  rearSightLeftWing.position.set(-0.010, 0.0185, 0.092);
  slideGroup.add(rearSightLeftWing);

  const rearSightRightWing = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.008), slideMat);
  rearSightRightWing.position.set(0.010, 0.0185, 0.092);
  slideGroup.add(rearSightRightWing);

  const rearSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.003, 0.008), slideMat);
  rearSightBase.position.set(0, 0.0135, 0.092);
  slideGroup.add(rearSightBase);

  // Rear Glowing Tritium Guide Dots (Left & Right)
  const rearDotL = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 8, 8), tritiumGlowMat);
  rearDotL.position.set(-0.010, 0.020, 0.086);
  slideGroup.add(rearDotL);

  const rearDotR = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 8, 8), tritiumGlowMat);
  rearDotR.position.set(0.010, 0.020, 0.086);
  slideGroup.add(rearDotR);

  // Front Sight Post (Narrow centered blade with green dot)
  const frontSightPost = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.012, 0.008), slideMat);
  frontSightPost.position.set(0, 0.0185, -0.092);
  slideGroup.add(frontSightPost);

  const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 8), tritiumGlowMat);
  frontDot.position.set(0, 0.020, -0.086);
  slideGroup.add(frontDot);

  gunMeshGroup.add(slideGroup);

  // 4. Drop Magazine
  const magazineGroup = new THREE.Group();
  magazineGroup.position.set(0, -0.075, 0.015);

  const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.11, 0.040), barrelMat);
  magBody.position.set(0, -0.02, 0);
  magBody.rotation.x = 0.36;
  magazineGroup.add(magBody);

  const magBaseplate = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.010, 0.046), frameMat);
  magBaseplate.position.set(0, -0.076, -0.018);
  magBaseplate.rotation.x = 0.36;
  magazineGroup.add(magBaseplate);

  gunMeshGroup.add(magazineGroup);

  // 5. Two-Handed Tactical Grip Arms (Extended Combat Posture)
  // Right Arm (Primary Firing Hand)
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0, 0, 0);

  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.065, 0.072), gloveMat);
  rightHand.position.set(0, -0.075, 0.065);
  rightHand.rotation.set(0.36, 0, 0);
  rightArmGroup.add(rightHand);

  // Forearm extending smoothly off-screen
  const rightForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.056, 0.36, 10),
    sleeveMat
  );
  rightForearm.position.set(0.08, -0.22, 0.22);
  rightForearm.rotation.set(-0.85, 0.18, -0.35);
  rightArmGroup.add(rightForearm);
  gunMeshGroup.add(rightArmGroup);

  // Left Arm (Tactical Supporting Cup Grip)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(0, 0, 0);

  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.060, 0.068), gloveMat);
  leftHand.position.set(-0.025, -0.082, 0.065);
  leftHand.rotation.set(0.28, 0.22, -0.20);
  leftArmGroup.add(leftHand);

  const leftForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.056, 0.36, 10),
    sleeveMat
  );
  leftForearm.position.set(-0.10, -0.23, 0.22);
  leftForearm.rotation.set(-0.85, -0.18, 0.35);
  leftArmGroup.add(leftForearm);
  gunMeshGroup.add(leftArmGroup);

  // 6. Explicit Muzzle Point (Exact barrel bore tip opening)
  const muzzlePoint = new THREE.Group();
  muzzlePoint.name = 'Pistol_MuzzlePoint';
  muzzlePoint.position.set(0, 0.022, -0.155);
  gunMeshGroup.add(muzzlePoint);

  // 7. Muzzle Flash & Light
  const muzzleFlashGroup = new THREE.Group();
  muzzleFlashGroup.position.set(0, 0.022, -0.155);
  muzzleFlashGroup.visible = false;

  const flash = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.040, 0),
    new THREE.MeshBasicMaterial({ color: 0xfff0bb, transparent: true, opacity: 0.95 })
  );
  muzzleFlashGroup.add(flash);

  const muzzleLight = new THREE.PointLight(0xffcc44, 0, 10, 2);
  muzzleFlashGroup.add(muzzleLight);
  gunMeshGroup.add(muzzleFlashGroup);

  const ejectionPoint = new THREE.Vector3(0.016, 0.025, 0.01);

  return {
    root,
    gunMeshGroup,
    slideGroup,
    magazineGroup,
    muzzlePoint,
    muzzleFlashGroup,
    muzzleLight,
    ejectionPoint,
    leftArmGroup,
    rightArmGroup,
  };
}
