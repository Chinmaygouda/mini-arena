// src/weapons/sniperModel.ts
// Heavy Bolt-Action Sniper Rifle (AW-50 / .50 BMG)
// High-fidelity implementation matching aw50_sniper_design_v2.html & character turnaround sheet:
// - Olive green tactical polymer chassis with ergonomic thumbhole grip
// - Adjustable comb cheek riser & contoured rubber recoil buttpad
// - Heavy fluted match-grade .50 BMG barrel with multi-port slotted muzzle brake
// - M-LOK slotted forend with under-barrel folded bipod legs tucked flush
// - Full-length toothed Picatinny top rail
// - High-magnification telescopic sniper scope with dual rings, turrets, sunshade & sapphire glass
// - Right-hand cylindrical cycling bolt with shroud & ball knob
// - Detachable 5-round .50 BMG box magazine with baseplate & visible brass cartridge
// - First-person operator arms with tactical gloves and field watch

import * as THREE from 'three';
import {
  applyPBRTexture,
  getBrushedSteelTextures,
  getCarbonFiberTextures,
  getTacticalFabricTextures,
} from './weaponTextures.ts';

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

/**
 * Helper to construct extruded polygon geometry from 2D profile points in the design plane
 * and rotate it into game space:
 * design x (forward/back) -> game -z
 * design y (up/down)      -> game +y
 * thickness (width)       -> game +x (centered at x = 0)
 */
function createExtrudedProfile(
  points: [number, number][],
  holePoints?: [number, number][],
  thickness: number = 0.05,
  bevel: number = 0.002
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();

  if (holePoints && holePoints.length > 0) {
    const hole = new THREE.Path();
    hole.moveTo(holePoints[0][0], holePoints[0][1]);
    for (let i = 1; i < holePoints.length; i++) {
      hole.lineTo(holePoints[i][0], holePoints[i][1]);
    }
    hole.closePath();
    shape.holes.push(hole);
  }

  const depth = Math.max(0.002, thickness - bevel * 2);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });

  geom.translate(0, 0, -depth / 2);

  // Transform coordinates: local X -> game -Z, local Y -> game Y, local Z -> game X
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);
    pos.setXYZ(i, lz, ly, -lx);
  }
  geom.computeVertexNormals();
  return geom;
}

export function createSniperModel(): SniperComponents {
  const root = new THREE.Group();
  root.name = 'Sniper_Root';

  const gunMeshGroup = new THREE.Group();
  gunMeshGroup.name = 'Sniper_GunMesh';
  root.add(gunMeshGroup);

  // Procedural PBR Textures
  const steelTex = getBrushedSteelTextures();
  const carbonTex = getCarbonFiberTextures();
  const fabricTex = getTacticalFabricTextures();

  // --- Tactical PBR Materials (Matching AW-50 Design Sheet v2 Palette) ---
  const stockMat = new THREE.MeshStandardMaterial({
    color: 0x566544, // Olive green tactical polymer chassis
    roughness: 0.65,
    metalness: 0.15,
  });
  applyPBRTexture(stockMat, carbonTex, 0.002);

  const stockDarkMat = new THREE.MeshStandardMaterial({
    color: 0x3f4b32, // Darker olive green for cheek riser comb
    roughness: 0.58,
    metalness: 0.18,
  });
  applyPBRTexture(stockDarkMat, carbonTex, 0.002);

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x2b2f35, // Tactical gunmetal steel (barrel, guard, mounts)
    roughness: 0.30,
    metalness: 0.88,
  });
  applyPBRTexture(steelMat, steelTex, 0.002);

  const midSteelMat = new THREE.MeshStandardMaterial({
    color: 0x3d434b, // Ordnance mid-tone steel (receiver, brake body, turrets)
    roughness: 0.35,
    metalness: 0.82,
  });
  applyPBRTexture(midSteelMat, steelTex, 0.0018);

  const lightMetalMat = new THREE.MeshStandardMaterial({
    color: 0x9099a3, // Silver/aluminum (bolt body, trigger, bipod pivots, mag floorplate)
    roughness: 0.22,
    metalness: 0.94,
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x16171b, // Matte dark rubber (buttpad, eyecup, brake ribs, bolt knob)
    roughness: 0.92,
    metalness: 0.08,
  });

  const railMat = new THREE.MeshStandardMaterial({
    color: 0x454b54, // Hard-anodized Picatinny rail
    roughness: 0.40,
    metalness: 0.75,
  });
  applyPBRTexture(railMat, steelTex, 0.0015);

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc9a24a, // Polished brass .50 BMG cartridges
    roughness: 0.24,
    metalness: 0.92,
  });

  const opticGlassMat = new THREE.MeshStandardMaterial({
    color: 0x2a86c8, // Multi-coated sapphire blue optical lens
    roughness: 0.08,
    metalness: 0.95,
    emissive: 0x0b3a5c,
    emissiveIntensity: 0.35,
  });

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x242b26, // Operator combat sleeve
    roughness: 0.88,
    metalness: 0.05,
  });
  applyPBRTexture(sleeveMat, fabricTex, 0.002);

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x1b2024, // Dark tactical glove fabric
    roughness: 0.75,
    metalness: 0.12,
  });
  applyPBRTexture(gloveMat, fabricTex, 0.002);

  const knuckleArmorMat = new THREE.MeshStandardMaterial({
    color: 0x111417, // Polycarbonate knuckle guard
    roughness: 0.40,
    metalness: 0.35,
  });

  const gripPadMat = new THREE.MeshStandardMaterial({
    color: 0x2d3436, // Reinforced rubber palm grip
    roughness: 0.95,
    metalness: 0.05,
  });

  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x18181b, // Tactical watch strap
    roughness: 0.82,
    metalness: 0.10,
  });

  const watchMat = new THREE.MeshStandardMaterial({
    color: 0x27272a, // Watch bezel
    roughness: 0.28,
    metalness: 0.82,
  });

  const watchGlassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8, // Cyan display
    roughness: 0.10,
    metalness: 0.92,
    emissive: 0x0369a1,
    emissiveIntensity: 0.40,
  });

  // =========================================================================
  // 1. CHASSIS & STOCK WITH ERGONOMIC THUMBHOLE GRIP
  // =========================================================================
  // Profile points directly from aw50_sniper_design_v2.html:
  const stockOutline: [number, number][] = [
    [-0.555, 0.07],
    [-0.44, 0.074],
    [-0.32, 0.076],
    [-0.21, 0.058],
    [-0.15, 0.05],
    [-0.15, -0.045],
    [-0.162, -0.145],
    [-0.205, -0.165],
    [-0.222, -0.12],
    [-0.255, -0.105],
    [-0.36, -0.1],
    [-0.5, -0.088],
    [-0.555, -0.095],
  ];

  const thumbholeCutout: [number, number][] = [
    [-0.3, -0.05],
    [-0.285, -0.07],
    [-0.24, -0.07],
    [-0.222, -0.02],
    [-0.245, 0.02],
    [-0.295, 0.02],
  ];

  const stockGeom = createExtrudedProfile(stockOutline, thumbholeCutout, 0.055, 0.003);
  const stockMesh = new THREE.Mesh(stockGeom, stockMat);
  gunMeshGroup.add(stockMesh);

  // Adjustable comb cheek riser (darker olive green #3f4b32)
  const cheekOutline: [number, number][] = [
    [-0.49, 0.074],
    [-0.47, 0.098],
    [-0.37, 0.098],
    [-0.33, 0.076],
  ];
  const cheekGeom = createExtrudedProfile(cheekOutline, undefined, 0.068, 0.003);
  const cheekMesh = new THREE.Mesh(cheekGeom, stockDarkMat);
  gunMeshGroup.add(cheekMesh);

  // Twin cheek riser adjustment knobs on right side
  for (const knobZ of [0.38, 0.44]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.012, 10), steelMat);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(0.038, 0.082, knobZ);
    gunMeshGroup.add(knob);
  }

  // Contoured shock-absorbing rubber buttpad
  const buttpadOutline: [number, number][] = [
    [-0.59, -0.105],
    [-0.555, -0.095],
    [-0.555, 0.07],
    [-0.58, 0.075],
  ];
  const buttpadGeom = createExtrudedProfile(buttpadOutline, undefined, 0.062, 0.003);
  const buttpadMesh = new THREE.Mesh(buttpadGeom, rubberMat);
  gunMeshGroup.add(buttpadMesh);

  // Buttpad horizontal recoil cushioning ribs
  for (let r = -0.07; r <= 0.05; r += 0.025) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.063, 0.006, 0.008), rubberMat);
    rib.position.set(0, r, 0.575);
    gunMeshGroup.add(rib);
  }

  // Rear sling swivel mount loop
  const rearSling = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12), steelMat);
  rearSling.rotation.y = Math.PI / 2;
  rearSling.position.set(0, -0.075, 0.52);
  gunMeshGroup.add(rearSling);

  // =========================================================================
  // 2. TRIGGER GUARD & MATCH TRIGGER
  // =========================================================================
  const guardOutline: [number, number][] = [
    [-0.15, -0.06],
    [-0.145, -0.115],
    [-0.035, -0.115],
    [-0.02, -0.06],
  ];
  const guardHole: [number, number][] = [
    [-0.138, -0.062],
    [-0.134, -0.105],
    [-0.045, -0.105],
    [-0.033, -0.062],
  ];
  const guardGeom = createExtrudedProfile(guardOutline, guardHole, 0.024, 0.002);
  const guardMesh = new THREE.Mesh(guardGeom, steelMat);
  gunMeshGroup.add(guardMesh);

  // Silver match-grade shoe trigger
  const triggerOutline: [number, number][] = [
    [-0.085, -0.06],
    [-0.079, -0.095],
    [-0.071, -0.095],
    [-0.074, -0.06],
  ];
  const triggerGeom = createExtrudedProfile(triggerOutline, undefined, 0.008, 0.001);
  const triggerMesh = new THREE.Mesh(triggerGeom, lightMetalMat);
  gunMeshGroup.add(triggerMesh);

  // =========================================================================
  // 3. RECEIVER, PICATINNY RAIL & EJECTION PORT
  // =========================================================================
  // Main receiver body
  const receiverGeom = new THREE.BoxGeometry(0.070, 0.090, 0.300);
  const receiverMesh = new THREE.Mesh(receiverGeom, midSteelMat);
  receiverMesh.position.set(0, 0.005, 0.00);
  gunMeshGroup.add(receiverMesh);

  // Ejection Port cutout on right side (+X)
  const portMesh = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.032, 0.075), rubberMat);
  portMesh.position.set(0.0355, 0.020, -0.020);
  gunMeshGroup.add(portMesh);

  // Full-length Picatinny scope rail on top of receiver
  const railBase = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.010, 0.360), railMat);
  railBase.position.set(0, 0.055, 0.00);
  gunMeshGroup.add(railBase);

  // 12 Realistic Machined Rail Teeth / Cross-slots (pitch = 0.03m)
  for (let i = 0; i < 12; i++) {
    const toothZ = -(-0.165 + i * 0.030); // Convert design x -> game -z
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.007, 0.014), steelMat);
    tooth.position.set(0, 0.061, toothZ);
    gunMeshGroup.add(tooth);
  }

  // =========================================================================
  // 4. M-LOK FOREND & UNDER-BARREL FOLDED BIPOD
  // =========================================================================
  const forendOutline: [number, number][] = [
    [0.15, 0.045],
    [0.45, 0.034],
    [0.45, -0.052],
    [0.38, -0.066],
    [0.15, -0.066],
  ];
  const forendGeom = createExtrudedProfile(forendOutline, undefined, 0.064, 0.003);
  const forendMesh = new THREE.Mesh(forendGeom, stockMat);
  gunMeshGroup.add(forendMesh);

  // 3 M-LOK Slots along left (-X) and right (+X) forend flanks
  for (const slotX of [-0.0325, 0.0325]) {
    for (const designX of [0.22, 0.29, 0.36]) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.045), rubberMat);
      slot.position.set(slotX, -0.010, -designX);
      gunMeshGroup.add(slot);
    }
  }

  // Bipod mounting lug underneath forend
  const bipodMount = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.016, 0.045), steelMat);
  bipodMount.position.set(0, -0.074, -0.400);
  gunMeshGroup.add(bipodMount);

  // Dual under-barrel folded bipod legs tucked flush against forend
  for (const side of [-1, 1]) {
    const bipodLegGroup = new THREE.Group();
    bipodLegGroup.position.set(side * 0.024, -0.076, -0.400);

    // Pivot knuckle
    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.010, 8), steelMat);
    knuckle.rotation.z = Math.PI / 2;
    bipodLegGroup.add(knuckle);

    // Upper folded leg tucked rearward/flush along bottom
    const legUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 8), lightMetalMat);
    legUpper.rotation.x = Math.PI / 2;
    legUpper.position.set(0, -0.006, 0.07);
    bipodLegGroup.add(legUpper);

    // Telescoping extension collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.016, 8), steelMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, -0.006, 0.13);
    bipodLegGroup.add(collar);

    // Flared rubber footpad
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.007, 0.020, 8), rubberMat);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(0, -0.006, 0.148);
    bipodLegGroup.add(foot);

    gunMeshGroup.add(bipodLegGroup);
  }

  // =========================================================================
  // 5. MATCH-GRADE FLUTED .50 BMG BARREL & MULTI-PORT MUZZLE BRAKE
  // =========================================================================
  // Tapered match-grade barrel (from forend z=-0.45 forward to muzzle brake z=-0.84)
  // Length = 0.40m, radius tapering from 0.024m to 0.019m
  const barrelLen = 0.40;
  const barrelGeom = new THREE.CylinderGeometry(0.019, 0.024, barrelLen, 16);
  barrelGeom.rotateX(Math.PI / 2);
  const barrelMesh = new THREE.Mesh(barrelGeom, steelMat);
  barrelMesh.position.set(0, 0.025, -0.645);
  gunMeshGroup.add(barrelMesh);

  // Longitudinal cooling flutes around the barrel
  for (let a = 0; a < 6; a++) {
    const angle = (a * Math.PI) / 3;
    const flute = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, barrelLen * 0.75, 6), midSteelMat);
    flute.rotateX(Math.PI / 2);
    flute.position.set(
      Math.sin(angle) * 0.021,
      0.025 + Math.cos(angle) * 0.021,
      -0.645
    );
    gunMeshGroup.add(flute);
  }

  // Slotted multi-port muzzle brake with heavy recoil-mitigation baffles
  // Centered at Z = -0.880, Y = 0.025, extends to -0.923 (exact muzzle point!)
  const brakeGeom = new THREE.CylinderGeometry(0.028, 0.028, 0.082, 16);
  brakeGeom.rotateX(Math.PI / 2);
  const brakeMesh = new THREE.Mesh(brakeGeom, midSteelMat);
  brakeMesh.position.set(0, 0.025, -0.880);
  gunMeshGroup.add(brakeMesh);

  // 3 Multi-port expansion baffle ribs cutting across the brake
  for (const bz of [-0.855, -0.880, -0.905]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.046, 0.010), rubberMat);
    rib.position.set(0, 0.025, bz);
    gunMeshGroup.add(rib);
  }

  // Front muzzle bore opening ring
  const crownGeom = new THREE.CylinderGeometry(0.012, 0.014, 0.006, 16);
  crownGeom.rotateX(Math.PI / 2);
  const crownMesh = new THREE.Mesh(crownGeom, rubberMat);
  crownMesh.position.set(0, 0.025, -0.922);
  gunMeshGroup.add(crownMesh);

  // =========================================================================
  // 6. HIGH-MAGNIFICATION TELESCOPIC SCOPE SYSTEM
  // =========================================================================
  // Optical centerline sits at Y = 0.092, aligning perfectly with adsPosition (0, -0.092, -0.22)
  const scopeGroup = new THREE.Group();
  scopeGroup.name = 'Sniper_Scope';
  scopeGroup.position.set(0, 0.092, 0.00);

  // Dual heavy-duty mounting clamps clamped to Picatinny rail
  for (const ringZ of [-0.08, 0.06]) {
    const mountBase = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.028, 0.032), steelMat);
    mountBase.position.set(0, -0.022, ringZ);
    scopeGroup.add(mountBase);

    // Clamp hex cross-bolt on right side
    const boltNut = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.042, 6), lightMetalMat);
    boltNut.rotation.z = Math.PI / 2;
    boltNut.position.set(0.002, -0.022, ringZ);
    scopeGroup.add(boltNut);

    const ringLoop = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.028, 16), steelMat);
    ringLoop.rotateX(Math.PI / 2);
    ringLoop.position.set(0, 0, ringZ);
    scopeGroup.add(ringLoop);
  }

  // Main 34mm central scope tube
  const tubeGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.24, 16);
  tubeGeom.rotateX(Math.PI / 2);
  const tube = new THREE.Mesh(tubeGeom, steelMat);
  scopeGroup.add(tube);

  // Large forward objective bell flaring outward to 56mm
  const objBellGeom = new THREE.CylinderGeometry(0.032, 0.019, 0.075, 16);
  objBellGeom.rotateX(Math.PI / 2);
  const objBell = new THREE.Mesh(objBellGeom, steelMat);
  objBell.position.set(0, 0, -0.155);
  scopeGroup.add(objBell);

  // Cylindrical anti-glare sunshade hood
  const hoodGeom = new THREE.CylinderGeometry(0.033, 0.033, 0.055, 16);
  hoodGeom.rotateX(Math.PI / 2);
  const hood = new THREE.Mesh(hoodGeom, rubberMat);
  hood.position.set(0, 0, -0.218);
  scopeGroup.add(hood);

  // Coated front sapphire blue optical lens
  const frontLensGeom = new THREE.CircleGeometry(0.028, 16);
  const frontLens = new THREE.Mesh(frontLensGeom, opticGlassMat);
  frontLens.position.set(0, 0, -0.245);
  frontLens.rotation.y = Math.PI;
  scopeGroup.add(frontLens);

  // Rear ocular bell / eyepiece
  const ocuBellGeom = new THREE.CylinderGeometry(0.019, 0.026, 0.065, 16);
  ocuBellGeom.rotateX(Math.PI / 2);
  const ocuBell = new THREE.Mesh(ocuBellGeom, steelMat);
  ocuBell.position.set(0, 0, 0.145);
  scopeGroup.add(ocuBell);

  // Contoured soft rubber eyecup
  const eyecupGeom = new THREE.CylinderGeometry(0.026, 0.028, 0.024, 16);
  eyecupGeom.rotateX(Math.PI / 2);
  const eyecup = new THREE.Mesh(eyecupGeom, rubberMat);
  eyecup.position.set(0, 0, 0.188);
  scopeGroup.add(eyecup);

  // Rear ocular optical lens
  const rearLensGeom = new THREE.CircleGeometry(0.024, 16);
  const rearLens = new THREE.Mesh(rearLensGeom, opticGlassMat);
  rearLens.position.set(0, 0, 0.198);
  scopeGroup.add(rearLens);

  // Top elevation turret & graduated drum
  const elevTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.022, 14), midSteelMat);
  elevTurret.position.set(0, 0.026, -0.010);
  scopeGroup.add(elevTurret);

  const elevCap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 14), lightMetalMat);
  elevCap.position.set(0, 0.040, -0.010);
  scopeGroup.add(elevCap);

  // Right-side windage turret
  const windTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.022, 14), midSteelMat);
  windTurret.rotation.z = Math.PI / 2;
  windTurret.position.set(0.026, 0, -0.010);
  scopeGroup.add(windTurret);

  const windCap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 14), lightMetalMat);
  windCap.rotation.z = Math.PI / 2;
  windCap.position.set(0.040, 0, -0.010);
  scopeGroup.add(windCap);

  // Left-side parallax adjustment dial
  const paraDial = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.018, 14), midSteelMat);
  paraDial.rotation.z = -Math.PI / 2;
  paraDial.position.set(-0.026, 0, -0.055);
  scopeGroup.add(paraDial);

  gunMeshGroup.add(scopeGroup);

  // =========================================================================
  // 7. CYCLING BOLT CARRIER & LEVER HANDLE
  // =========================================================================
  // Rest position at (0.028, 0.032, 0.01) required for kinematic compatibility
  const boltCarrierGroup = new THREE.Group();
  boltCarrierGroup.name = 'Sniper_Bolt_Group';
  boltCarrierGroup.position.set(0.028, 0.032, 0.01);

  // Cylindrical bolt body inside receiver raceway
  const boltBodyGeom = new THREE.CylinderGeometry(0.013, 0.013, 0.150, 14);
  boltBodyGeom.rotateX(Math.PI / 2);
  const boltBody = new THREE.Mesh(boltBodyGeom, lightMetalMat);
  boltBody.position.set(-0.028, 0, 0.08);
  boltCarrierGroup.add(boltBody);

  // Rear faceted bolt shroud cap
  const boltCap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.024, 8), rubberMat);
  boltCap.rotateX(Math.PI / 2);
  boltCap.position.set(-0.028, 0, 0.165);
  boltCarrierGroup.add(boltCap);

  // Angled steel bolt handle arm extending outward to shooter's right (+X)
  const boltStem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.052, 8), lightMetalMat);
  boltStem.rotation.z = Math.PI / 2.3;
  boltStem.position.set(0.024, -0.006, 0.095);
  boltCarrierGroup.add(boltStem);

  // Spherical bolt ball knob
  const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), rubberMat);
  boltKnob.position.set(0.050, -0.020, 0.095);
  boltCarrierGroup.add(boltKnob);

  root.add(boltCarrierGroup);

  // =========================================================================
  // 8. DEDICATED 5-ROUND .50 BMG DETACHABLE BOX MAGAZINE
  // =========================================================================
  // Chassis magazine well and bottom release lever
  const magwellMesh = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.036, 0.085), steelMat);
  magwellMesh.position.set(0, -0.046, -0.055);
  gunMeshGroup.add(magwellMesh);

  // Magazine release lever paddle behind magwell
  const magRelease = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.026, 0.014), lightMetalMat);
  magRelease.position.set(0, -0.052, -0.008);
  gunMeshGroup.add(magRelease);

  // MagazineGroup: rest position at (0, -0.08, -0.06)
  const magazineGroup = new THREE.Group();
  magazineGroup.name = 'Sniper_Magazine';
  magazineGroup.position.set(0, -0.08, -0.06);

  // Stamped dark steel 5-round box magazine casing with side reinforcement grooves
  const magBox = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.125, 0.075), steelMat);
  magBox.position.set(0, -0.045, 0);
  magazineGroup.add(magBox);

  // Baseplate with retaining floorplate
  const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.010, 0.082), lightMetalMat);
  magBase.position.set(0, -0.110, 0);
  magazineGroup.add(magBase);

  // Visible brass .50 BMG cartridge rim & primer at feed lips
  const roundRim = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.055, 12), brassMat);
  roundRim.rotateX(Math.PI / 2);
  roundRim.position.set(0, 0.014, -0.005);
  magazineGroup.add(roundRim);

  root.add(magazineGroup);

  // =========================================================================
  // 9. OPERATOR HANDS & ARMS
  // =========================================================================
  // A. Right Arm (Gripping through the thumbhole ergonomic grip)
  const rightArmGroup = new THREE.Group();
  rightArmGroup.name = 'Sniper_RightArm';

  // Firing Hand (Tactical glove wrapped securely around sniper thumbhole grip)
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.082, 0.064), gloveMat);
  rHand.position.set(0, -0.085, 0.19);
  rHand.rotation.x = -0.28;
  rightArmGroup.add(rHand);

  // Index trigger finger extending forward through trigger guard toward shoe
  const rTriggerFinger = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.044), gloveMat);
  rTriggerFinger.position.set(-0.018, -0.060, 0.12);
  rTriggerFinger.rotation.set(-0.10, 0.08, 0);
  rightArmGroup.add(rTriggerFinger);

  // Right Forearm (Combat sleeved arm extending seamlessly off-screen)
  const rArmOrigin = new THREE.Vector3(0.18, -0.38, 0.35);
  const rWristPos = new THREE.Vector3(0.015, -0.10, 0.20);
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

  // B. Left Hand & Arm (Supporting the underside of the olive green chassis forend)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.name = 'Sniper_LeftArm';

  const leftHandGroup = new THREE.Group();
  leftHandGroup.name = 'Sniper_LeftHand';

  // Palm supporting underside of forend (forend bottom is at Y = -0.066)
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.026, 0.084), gloveMat);
  palm.position.set(-0.008, -0.078, -0.28);
  palm.rotation.set(0.08, 0.18, -0.15);
  leftHandGroup.add(palm);

  // Reinforced non-slip rubber grip pad facing chassis bottom
  const gripPad = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.008, 0.078), gripPadMat);
  gripPad.position.set(-0.006, -0.067, -0.28);
  gripPad.rotation.set(0.08, 0.18, -0.15);
  leftHandGroup.add(gripPad);

  // Curled fingers wrapping up along right side of forend
  const fingersLower = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.052, 0.078), gloveMat);
  fingersLower.position.set(0.028, -0.050, -0.28);
  fingersLower.rotation.set(0.08, 0.14, -0.10);
  leftHandGroup.add(fingersLower);

  const fingerTips = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.074), gloveMat);
  fingerTips.position.set(0.024, -0.018, -0.28);
  fingerTips.rotation.set(0.08, 0.14, 0.22);
  leftHandGroup.add(fingerTips);

  // Polycarbonate Knuckle Armor
  const knuckleArmor = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.034, 0.076), knuckleArmorMat);
  knuckleArmor.position.set(0.032, -0.052, -0.28);
  knuckleArmor.rotation.set(0.08, 0.14, -0.10);
  leftHandGroup.add(knuckleArmor);

  // Thumb resting along left flank of chassis forend
  const thumbBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.026, 0.040), gloveMat);
  thumbBase.position.set(-0.028, -0.066, -0.255);
  thumbBase.rotation.set(-0.12, 0.25, -0.25);
  leftHandGroup.add(thumbBase);

  const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.020, 0.048), gloveMat);
  thumbTip.position.set(-0.028, -0.046, -0.290);
  thumbTip.rotation.set(0.10, 0.18, -0.15);
  leftHandGroup.add(thumbTip);

  leftArmGroup.add(leftHandGroup);

  // Left Forearm Assembly - Sleeved arm spanning from off-screen origin to wrist anchor
  const armOrigin = new THREE.Vector3(-0.25, -0.38, 0.12);
  const wristPos = new THREE.Vector3(-0.040, -0.095, -0.24);
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

  // Wrist Cuff Collar
  const gloveCuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.052, 0.042, 12),
    gloveMat
  );
  gloveCuff.position.copy(wristPos);
  gloveCuff.quaternion.copy(lArmQuat);
  leftArmGroup.add(gloveCuff);

  // Tactical Watch on Left Wrist
  const watchStrap = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.058, 0.022), strapMat);
  watchStrap.position.set(-0.042, -0.098, -0.236);
  watchStrap.quaternion.copy(lArmQuat);
  leftArmGroup.add(watchStrap);

  const watchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.008, 12), watchMat);
  watchBody.rotation.z = Math.PI / 2;
  watchBody.position.set(-0.066, -0.096, -0.236);
  leftArmGroup.add(watchBody);

  const watchFace = new THREE.Mesh(new THREE.CircleGeometry(0.009, 12), watchGlassMat);
  watchFace.position.set(-0.071, -0.096, -0.236);
  watchFace.rotation.y = -Math.PI / 2;
  leftArmGroup.add(watchFace);

  root.add(leftArmGroup);

  // =========================================================================
  // 10. EXPLICIT MUZZLE POINT & MUZZLE FLASH
  // =========================================================================
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

  const ejectionPoint = new THREE.Vector3(0.035, 0.026, -0.02);

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
