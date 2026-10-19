import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TargetManager } from '../src/environment/targets.ts';

test('TargetManager: isValidHit ignores transparent mediums, non-colliding objects, and ignoreRaycast', () => {
  const scene = new THREE.Scene();
  const tm = new TargetManager(scene);

  // 1. Solid opaque mesh
  const solid = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x333333, opacity: 1.0, transparent: false })
  );
  assert.equal(tm.isValidHit({ distance: 1.0, object: solid, point: new THREE.Vector3() }), true);

  // 2. Transparent medium (glass/hologram/screen)
  const transparentMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x88ccff, opacity: 0.35, transparent: true })
  );
  assert.equal(
    tm.isValidHit({ distance: 1.0, object: transparentMesh, point: new THREE.Vector3() }),
    false,
    'transparent medium must let bullets pass through'
  );

  // 3. Non-colliding visual object (userData.collision = false)
  const nonColliding = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
  );
  nonColliding.userData.collision = false;
  assert.equal(
    tm.isValidHit({ distance: 1.0, object: nonColliding, point: new THREE.Vector3() }),
    false,
    'non-colliding object must let bullets pass through'
  );

  // 4. Object explicitly marked ignoreRaycast
  const ignored = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x00ff00 })
  );
  ignored.userData.ignoreRaycast = true;
  assert.equal(
    tm.isValidHit({ distance: 1.0, object: ignored, point: new THREE.Vector3() }),
    false,
    'ignoreRaycast object must let bullets pass through'
  );
});

test('TargetManager: Bullets cleanly pass through gaps between server racks', () => {
  const scene = new THREE.Scene();
  const tm = new TargetManager(scene);

  // Server rack 1 at X = -2.0, Z = -5.0 (width 1.0, depth 1.0) -> spans X in [-2.5, -1.5]
  const rack1 = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 2.2, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  rack1.position.set(-2.0, 1.1, -5.0);
  scene.add(rack1);

  // Server rack 2 at X = 0.0, Z = -5.0 (width 1.0, depth 1.0) -> spans X in [-0.5, 0.5]
  const rack2 = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 2.2, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  rack2.position.set(0.0, 1.1, -5.0);
  scene.add(rack2);

  // Target wall behind the server racks at Z = -15.0
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(20, 5, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x555555 })
  );
  backWall.position.set(-1.0, 2.5, -15.0);
  scene.add(backWall);

  scene.updateMatrixWorld(true);

  // Shoot directly through the gap between Rack 1 and Rack 2:
  // Gap center is at X = -1.0, between -1.5 (rack1 max) and -0.5 (rack2 min).
  // Player is at (x: -1.0, y: 1.5, z: 0.0), aiming straight forward down -Z (direction: [0, 0, -1])
  const aimOrigin = new THREE.Vector3(-1.0, 1.5, 0.0);
  const aimDirection = new THREE.Vector3(0, 0, -1);
  const muzzleOrigin = new THREE.Vector3(-0.8, 1.3, 0.2); // slight muzzle offset

  const hitResult = tm.checkBallisticHit(muzzleOrigin, aimOrigin, aimDirection, 50);

  assert.equal(hitResult.hit, true, 'bullet should hit something');
  assert.equal(
    hitResult.point.z < -10,
    true,
    `bullet must pass through the gap between racks and hit the back wall (hit Z was ${hitResult.point.z})`
  );
});
