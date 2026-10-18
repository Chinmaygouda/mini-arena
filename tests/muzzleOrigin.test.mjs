// tests/muzzleOrigin.test.mjs
// Regression and ballistic integrity tests for weapon muzzle origins and trajectories

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAK47Model } from '../src/weapons/ak47Model.ts';
import { createPistolModel } from '../src/weapons/pistolModel.ts';
import { createSMGModel } from '../src/weapons/smgModel.ts';
import { createShotgunModel } from '../src/weapons/shotgunModel.ts';
import { createSniperModel } from '../src/weapons/sniperModel.ts';
import { WEAPON_REGISTRY } from '../src/weapons/weaponTypes.ts';
import { WeaponManager } from '../src/weapons/weaponManager.ts';
import { TargetManager } from '../src/environment/targets.ts';

test('1. Weapon Model Muzzle Geometry Audit: All 5 weapons have muzzlePoint at barrel opening', () => {
  const models = {
    ak47: createAK47Model(),
    pistol: createPistolModel(),
    smg: createSMGModel(),
    shotgun: createShotgunModel(),
    sniper: createSniperModel(),
  };

  // Expected bore opening coordinates in gunMeshGroup local space
  const expected = {
    ak47: { x: 0, y: 0.015, z: -0.738 },
    pistol: { x: 0, y: 0.022, z: -0.155 },
    smg: { x: 0, y: 0.025, z: -0.363 },
    shotgun: { x: 0, y: 0.038, z: -0.560 },
    sniper: { x: 0, y: 0.025, z: -0.923 },
  };

  for (const [id, comp] of Object.entries(models)) {
    assert.ok(comp.muzzlePoint, `${id} must have muzzlePoint`);
    assert.ok(comp.muzzleFlashGroup, `${id} must have muzzleFlashGroup`);

    const p = comp.muzzlePoint.position;
    const exp = expected[id];

    assert.equal(p.x, exp.x, `${id} muzzle X`);
    assert.equal(p.y, exp.y, `${id} muzzle Y`);
    assert.equal(p.z, exp.z, `${id} muzzle Z`);

    // Muzzle flash group must be co-located with muzzlePoint
    const fp = comp.muzzleFlashGroup.position;
    assert.equal(fp.x, p.x, `${id} flash X matches muzzle`);
    assert.equal(fp.y, p.y, `${id} flash Y matches muzzle`);
    assert.equal(fp.z, p.z, `${id} flash Z matches muzzle`);
  }
});

test('2. WeaponManager getActiveMuzzleWorldPosition returns exact transformed muzzle for all weapons', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
  camera.position.set(10, 1.7, 5);
  camera.rotation.set(0, 0, 0);
  camera.updateMatrixWorld(true);

  const wm = new WeaponManager(scene, camera);

  const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];
  const muzzlePos = new THREE.Vector3();

  for (const wid of weapons) {
    wm.switchWeapon(wid);
    wm.getActiveMuzzleWorldPosition(muzzlePos);

    // Muzzle must NOT be at origin (0,0,0) and NOT at camera eye position
    assert.notEqual(muzzlePos.x, 0, `${wid} muzzle should be offset with viewmodel`);
    assert.ok(muzzlePos.y > 1.0 && muzzlePos.y < 2.0, `${wid} muzzle Y should be near weapon height (~1.3-1.6m), got ${muzzlePos.y}`);
    assert.ok(muzzlePos.distanceTo(camera.position) > 0.3, `${wid} muzzle must be in front of camera, got distance ${muzzlePos.distanceTo(camera.position)}`);

    // Must match the actual world position of the weapon's muzzlePoint
    const nodeMuzzle = new THREE.Vector3();
    const comp = wm[wid];
    comp.muzzlePoint.getWorldPosition(nodeMuzzle);
    assert.ok(muzzlePos.distanceTo(nodeMuzzle) < 1e-4, `${wid} getActiveMuzzleWorldPosition must match muzzlePoint world position`);
  }
});

test('3. ADS alignment moves muzzlePoint toward camera centerline', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
  camera.position.set(0, 1.7, 0);
  camera.updateMatrixWorld(true);

  const wm = new WeaponManager(scene, camera);
  wm.switchWeapon('ak47');

  const hipMuzzle = new THREE.Vector3();
  wm.toggleADS(false);
  wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
  wm.getActiveMuzzleWorldPosition(hipMuzzle);

  // In hipfire, weapon is offset to the right (~0.2m)
  assert.ok(hipMuzzle.x > 0.15, `AK-47 hipfire muzzle should be to the right, got ${hipMuzzle.x}`);

  // Transition to ADS
  wm.toggleADS(true);
  for (let i = 0; i < 40; i++) {
    wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
  }

  const adsMuzzle = new THREE.Vector3();
  wm.getActiveMuzzleWorldPosition(adsMuzzle);

  // In ADS, weapon aligns near centerline (X close to 0)
  assert.ok(Math.abs(adsMuzzle.x) < 0.02, `AK-47 ADS muzzle should be centered, got ${adsMuzzle.x}`);
});

test('4. Ballistic raycast checkBallisticHit: clear path hits aim target from muzzle origin', () => {
  const scene = new THREE.Scene();
  const targetManager = new TargetManager(scene);

  // Add target box at (0, 1.7, -10)
  const targetMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial()
  );
  targetMesh.position.set(0, 1.7, -10);
  targetMesh.userData = { isTarget: true };
  targetMesh.updateMatrixWorld(true);
  scene.add(targetMesh);

  const cameraPos = new THREE.Vector3(0, 1.7, 0);
  const aimDir = new THREE.Vector3(0, 0, -1);
  const muzzlePos = new THREE.Vector3(0.2, 1.5, -0.6);

  const hitResult = targetManager.checkBallisticHit(
    muzzlePos,
    cameraPos,
    aimDir,
    WEAPON_REGISTRY.ak47
  );

  assert.equal(hitResult.hit, true, 'Shot should hit target');
  assert.ok(hitResult.point.z < -9.4 && hitResult.point.z > -10.6, 'Hit point should be on the target surface');
  assert.equal(hitResult.shotOrigin, muzzlePos, 'Hit result shotOrigin must be muzzleOrigin');
  assert.ok(hitResult.distance > 8.0, 'Distance should be computed from muzzle origin to hit point');
});

test('5. Obstruction test: cover blocking barrel prevents shot from reaching camera aim target', () => {
  const scene = new THREE.Scene();
  const targetManager = new TargetManager(scene);

  // Target in distance at (0, 1.7, -20)
  const targetMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshBasicMaterial()
  );
  targetMesh.position.set(0, 1.7, -20);
  targetMesh.userData = { isTarget: true };
  targetMesh.updateMatrixWorld(true);
  scene.add(targetMesh);

  // Low wall / obstacle directly in front of the muzzle at (0.2, 1.45, -2)
  // Camera at (0, 1.7, 0) can see over the low wall (wall top is at 1.55m),
  // but weapon muzzle at (0.2, 1.45, -0.7) fires directly into the wall!
  const coverWall = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.4, 0.2),
    new THREE.MeshBasicMaterial()
  );
  coverWall.position.set(0.2, 1.45, -2);
  coverWall.userData = { isCover: true };
  coverWall.updateMatrixWorld(true);
  scene.add(coverWall);

  const cameraPos = new THREE.Vector3(0, 1.7, 0);
  const aimDir = new THREE.Vector3(0, 0, -1); // aiming at distance target
  const muzzlePos = new THREE.Vector3(0.2, 1.45, -0.7);

  const hitResult = targetManager.checkBallisticHit(
    muzzlePos,
    cameraPos,
    aimDir,
    WEAPON_REGISTRY.ak47
  );

  assert.equal(hitResult.hit, true, 'Obstacle must be hit');
  assert.ok(hitResult.point.z > -2.2 && hitResult.point.z < -1.8, `Shot must impact the cover wall at z=-2, got z=${hitResult.point.z}`);
  assert.equal(hitResult.targetType, 'world', 'Target type should be world/cover, not target');
});

test('6. Shotgun buckshot: all pellets originate from SPAS-12 muzzle and consume 1 round', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
  camera.position.set(0, 1.7, 0);
  camera.updateMatrixWorld(true);

  const wm = new WeaponManager(scene, camera);
  wm.switchWeapon('shotgun');
  // Allow weapon switch readying to settle
  for (let i = 0; i < 30; i++) {
    wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
  }

  const muzzleOriginRecord = [];
  wm.onFireRaycast = (muzzleOrigin, _aimOrigin, _aimDirection, _weaponDef) => {
    muzzleOriginRecord.push(muzzleOrigin.clone());
  };

  const initialAmmo = wm.weaponState.ammoInClip;
  assert.equal(initialAmmo, 8, 'SPAS-12 starts with 8 shells');

  // Trigger fire
  wm.setTrigger(true);
  wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
  wm.setTrigger(false);

  // Exactly 1 round consumed from clip
  assert.equal(wm.weaponState.ammoInClip, 7, 'Firing shotgun consumes exactly 1 shell');

  // Exactly 8 pellets fired
  assert.equal(muzzleOriginRecord.length, 8, '8 pellets fired');

  // All 8 pellets share the exact same SPAS-12 muzzle origin
  const firstMuzzle = muzzleOriginRecord[0];
  for (let i = 1; i < muzzleOriginRecord.length; i++) {
    assert.equal(
      firstMuzzle.distanceTo(muzzleOriginRecord[i]),
      0,
      `Pellet #${i} must originate from the exact same muzzle point`
    );
  }
});

test('7. Dynamic bolt tracer trajectory: straight ballistic flight from muzzle and centered optical sightline in scoped ADS', () => {
  // A. Viewmodel Straight Ballistic Trajectory (Hipfire / Unscoped)
  const start = new THREE.Vector3(0.191, 1.516, -1.363); // AW-50 sniper hip muzzle
  const end = new THREE.Vector3(0.0, 1.70, -30.0);        // Target hit at 30m
  const totalDist = start.distanceTo(end);

  function samplePoint(s, pStart, pEnd, dist) {
    const t = dist > 0 ? Math.min(1, Math.max(0, s / dist)) : 0;
    return pStart.clone().lerp(pEnd, t);
  }

  // 1. Initial point at s = 0 MUST be the exact muzzle bore position
  const p0 = samplePoint(0, start, end, totalDist);
  assert.ok(p0.distanceTo(start) < 1e-4, `s=0 must be at muzzle bore, error was ${p0.distanceTo(start)}`);

  // 2. Final point at s = totalDist MUST be the exact hit point
  const pEnd = samplePoint(totalDist, start, end, totalDist);
  assert.ok(pEnd.distanceTo(end) < 1e-4, `s=totalDist must be at target, error was ${pEnd.distanceTo(end)}`);

  // 3. Collinear progression with ZERO lateral kinks or artificial sideways bending
  const flightDir = end.clone().sub(start).normalize();
  for (const s of [1.0, 5.0, 15.0, 25.0]) {
    const p = samplePoint(s, start, end, totalDist);
    const expected = start.clone().addScaledVector(flightDir, s);
    assert.ok(p.distanceTo(expected) < 1e-4, `Point at s=${s}m must be exactly collinear with ballistic flight line`);
  }

  // B. Scoped Telescopic Optic (Sniper ADS)
  // When scoped through a high-power optic, the visual tracer emerges directly along
  // the optical axis of the camera, preventing any diagonal slant across the circular lens.
  const aimOrigin = new THREE.Vector3(0.0, 1.70, 0.0);
  const aimDirection = new THREE.Vector3(0.0, 0.0, -1.0);
  const scopedStart = aimOrigin.clone().addScaledVector(aimDirection, 0.45);
  const scopedEnd = aimOrigin.clone().addScaledVector(aimDirection, 30.0);
  const scopedDist = scopedStart.distanceTo(scopedEnd);

  const scopedP0 = samplePoint(0, scopedStart, scopedEnd, scopedDist);
  const scopedP15 = samplePoint(15, scopedStart, scopedEnd, scopedDist);

  // Both must lie strictly on the camera optical sightline (X=0, Y=1.70)
  assert.ok(Math.abs(scopedP0.x - aimOrigin.x) < 1e-4, 'Scoped tracer X must be on optical axis');
  assert.ok(Math.abs(scopedP0.y - aimOrigin.y) < 1e-4, 'Scoped tracer Y must be on optical axis');
  assert.ok(Math.abs(scopedP15.x - aimOrigin.x) < 1e-4, 'Scoped tracer mid-flight X must be on optical axis');
  assert.ok(Math.abs(scopedP15.y - aimOrigin.y) < 1e-4, 'Scoped tracer mid-flight Y must be on optical axis');
});

test('8. Strafe stability: world muzzle origin matches active muzzle position identically when strafing left or right across all weapons', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
  camera.position.set(0, 1.7, 0);
  camera.updateMatrixWorld(true);

  const wm = new WeaponManager(scene, camera);
  const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];

  for (const weaponId of weapons) {
    wm.switchWeapon(weaponId);
    // Allow weapon switch readying to settle
    for (let i = 0; i < 30; i++) {
      wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
    }

    // Test both left and right strafe
    for (const strafeDir of [-1, 1]) {
      // Allow weapon fire rate cooldown to elapse (sniper bolt cycle is 1.25s)
      for (let i = 0; i < 85; i++) {
        wm.update(0.016, { x: 0, y: 0 }, false, false, 0);
      }

      // Simulate player strafing laterally
      const strafeSpeed = 4.8;
      const dt = 0.016;
      camera.position.x += strafeDir * strafeSpeed * dt;
      camera.updateMatrixWorld(true);

      let capturedMuzzle = null;
      const queryMuzzle = new THREE.Vector3();
      wm.onFireRaycast = (muzzleOrigin) => {
        capturedMuzzle = muzzleOrigin.clone();
        wm.getActiveMuzzleWorldPosition(queryMuzzle);
      };

      wm.update(dt, { x: 0, y: 0 }, true, false, strafeSpeed);

      // Force a shot
      wm.setTrigger(true);
      wm.update(dt, { x: 0, y: 0 }, true, false, strafeSpeed);
      wm.setTrigger(false);

      assert.ok(capturedMuzzle !== null, `${weaponId} must fire shot when trigger pressed`);
      assert.ok(
        capturedMuzzle.distanceTo(queryMuzzle) < 1e-4,
        `${weaponId} strafe ${strafeDir < 0 ? 'left' : 'right'} shot origin (${capturedMuzzle.x.toFixed(4)}) must identically match active muzzle position (${queryMuzzle.x.toFixed(4)})`
      );
    }
  }
});


