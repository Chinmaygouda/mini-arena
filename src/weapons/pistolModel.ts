// src/weapons/pistolModel.ts
// Tactical Combat Pistol (M9 / Cyber 9mm) with blowback slide and articulated two-handed grip

import * as THREE from 'three';

export interface PistolComponents {
  root: THREE.Group;
  gunMeshGroup: THREE.Group;
  slideGroup: THREE.Group;
  magazineGroup: THREE.Group;
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

  // Materials
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x32383e,
    metalness: 0.7,
    roughness: 0.35,
  });

  const slideMat = new THREE.MeshStandardMaterial({
    color: 0x22272d,
    metalness: 0.95,
    roughness: 0.22,
  });

  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x485058,
    metalness: 0.96,
    roughness: 0.18,
  });

  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x111315,
    roughness: 0.85,
    metalness: 0.1,
  });

  const tritiumGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x1e242b,
    roughness: 0.85,
    metalness: 0.1,
  });

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x11161d,
    roughness: 0.9,
    metalness: 0.05,
  });

  // 1. Lower Polymer Frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.045, 0.22), frameMat);
  frame.position.set(0, 0, 0);
  frame.castShadow = true;
  gunMeshGroup.add(frame);

  // Ergonomic Pistol Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.135, 0.058), gripMat);
  grip.position.set(0, -0.075, 0.06);
  grip.rotation.x = 0.38;
  grip.castShadow = true;
  gunMeshGroup.add(grip);

  // Trigger Guard
  const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.04, 0.065), frameMat);
  triggerGuard.position.set(0, -0.04, 0.02);
  gunMeshGroup.add(triggerGuard);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.022, 0.012), frameMat);
  trigger.position.set(0, -0.036, 0.018);
  trigger.rotation.x = 0.25;
  gunMeshGroup.add(trigger);

  // Fixed Internal Barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 12), barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.032, -0.08);
  gunMeshGroup.add(barrel);

  // 2. Reciprocating Blowback Slide
  const slideGroup = new THREE.Group();
  slideGroup.position.set(0, 0.035, 0);

  const slideBody = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.042, 0.23), slideMat);
  slideBody.position.set(0, 0, 0);
  slideBody.castShadow = true;
  slideGroup.add(slideBody);

  // Rear Slide Serrations
  const serrationL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.03, 0.055), barrelMat);
  serrationL.position.set(-0.022, 0, 0.06);
  const serrationR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.03, 0.055), barrelMat);
  serrationR.position.set(0.022, 0, 0.06);
  slideGroup.add(serrationL);
  slideGroup.add(serrationR);

  // Front Sight with Green Tritium Dot
  const frontSightPost = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.014, 0.012), slideMat);
  frontSightPost.position.set(0, 0.026, -0.1);
  const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.002, 8, 8), tritiumGlowMat);
  frontDot.position.set(0, 0.027, -0.093);
  slideGroup.add(frontSightPost);
  slideGroup.add(frontDot);

  // Rear Notched Sight with 2 Green Tritium Dots
  const rearSightPost = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.012), slideMat);
  rearSightPost.position.set(0, 0.026, 0.095);
  const rearDotL = new THREE.Mesh(new THREE.SphereGeometry(0.002, 8, 8), tritiumGlowMat);
  rearDotL.position.set(-0.008, 0.027, 0.09);
  const rearDotR = new THREE.Mesh(new THREE.SphereGeometry(0.002, 8, 8), tritiumGlowMat);
  rearDotR.position.set(0.008, 0.027, 0.09);
  slideGroup.add(rearSightPost);
  slideGroup.add(rearDotL);
  slideGroup.add(rearDotR);

  gunMeshGroup.add(slideGroup);

  // 3. Drop Magazine
  const magazineGroup = new THREE.Group();
  magazineGroup.position.set(0, -0.075, 0.06);

  const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.12, 0.045), barrelMat);
  magBody.position.set(0, -0.03, 0);
  magBody.rotation.x = 0.38;
  magazineGroup.add(magBody);

  const magBaseplate = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.012, 0.054), frameMat);
  magBaseplate.position.set(0, -0.088, -0.024);
  magBaseplate.rotation.x = 0.38;
  magazineGroup.add(magBaseplate);

  gunMeshGroup.add(magazineGroup);

  // 4. Two-Handed Tactical Grip Arms
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.08, -0.14, 0.15);
  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.07, 0.08), gloveMat);
  rightHand.position.set(-0.08, 0.065, -0.08);
  rightHand.rotation.set(0.35, -0.1, 0.1);
  rightArmGroup.add(rightHand);

  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.3, 8), sleeveMat);
  rightForearm.position.set(-0.01, -0.05, 0.08);
  rightForearm.rotation.set(-0.7, 0.2, -0.3);
  rightArmGroup.add(rightForearm);
  gunMeshGroup.add(rightArmGroup);

  // Left Hand (Supporting Cup Grip)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.08, -0.16, 0.12);
  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.065, 0.08), gloveMat);
  leftHand.position.set(0.06, 0.085, -0.06);
  leftHand.rotation.set(0.2, 0.3, -0.2);
  leftArmGroup.add(leftHand);

  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.32, 8), sleeveMat);
  leftForearm.position.set(-0.01, -0.06, 0.08);
  leftForearm.rotation.set(-0.7, -0.2, 0.3);
  leftArmGroup.add(leftForearm);
  gunMeshGroup.add(leftArmGroup);

  // 5. Muzzle Flash & Light
  const muzzleFlashGroup = new THREE.Group();
  muzzleFlashGroup.position.set(0, 0.035, -0.19);
  muzzleFlashGroup.visible = false;

  const flash = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.045, 0),
    new THREE.MeshBasicMaterial({ color: 0xfff0bb, transparent: true, opacity: 0.95 })
  );
  muzzleFlashGroup.add(flash);

  const muzzleLight = new THREE.PointLight(0xffcc44, 0, 10, 2);
  muzzleFlashGroup.add(muzzleLight);
  gunMeshGroup.add(muzzleFlashGroup);

  const ejectionPoint = new THREE.Vector3(0.02, 0.04, 0.02);

  return {
    root,
    gunMeshGroup,
    slideGroup,
    magazineGroup,
    muzzleFlashGroup,
    muzzleLight,
    ejectionPoint,
    leftArmGroup,
    rightArmGroup,
  };
}
