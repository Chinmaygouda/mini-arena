// src/environment/shootingRange.ts
// Military Tactical Proving Grounds: Firing deck, ballistic sand range, canopy, sandbags, and lighting

import * as THREE from 'three';

export function createShootingRange(scene: THREE.Scene) {
  // 1. Lighting Setup
  const ambientLight = new THREE.HemisphereLight(0xddeeff, 0x444433, 0.95);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfffaed, 1.3);
  sunLight.position.set(15, 35, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 150;
  sunLight.shadow.camera.left = -30;
  sunLight.shadow.camera.right = 30;
  sunLight.shadow.camera.top = 30;
  sunLight.shadow.camera.bottom = -30;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  // Soft Fill Light
  const fillLight = new THREE.DirectionalLight(0x99bbdd, 0.5);
  fillLight.position.set(-15, 15, -10);
  scene.add(fillLight);

  // 2. Terrain & Ground
  // Range Sandy Soil / Ballistic Earth (downrange)
  const earthMat = new THREE.MeshStandardMaterial({
    color: 0x4a4437,
    roughness: 0.95,
    metalness: 0.05,
  });
  const earthGround = new THREE.Mesh(new THREE.PlaneGeometry(120, 150), earthMat);
  earthGround.rotation.x = -Math.PI / 2;
  earthGround.position.set(0, -0.01, -40);
  earthGround.receiveShadow = true;
  scene.add(earthGround);

  // Polished Concrete Firing Platform
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x2e3238,
    roughness: 0.75,
    metalness: 0.15,
  });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(24, 0.4, 14), concreteMat);
  platform.position.set(0, -0.2, 2);
  platform.receiveShadow = true;
  scene.add(platform);

  // Yellow Safety Hazard Line
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xeecc00 });
  const safetyLine = new THREE.Mesh(new THREE.PlaneGeometry(24, 0.15), lineMat);
  safetyLine.rotation.x = -Math.PI / 2;
  safetyLine.position.set(0, 0.005, -3.5);
  scene.add(safetyLine);

  // 3. Firing Stalls & Overhead Tactical Canopy
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.8 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1f2326, metalness: 0.8, roughness: 0.3 });

  // Rear Support Pillars
  [-8, -3, 3, 8].forEach((x) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 8), darkMetalMat);
    pillar.position.set(x, 2.1, 7);
    pillar.castShadow = true;
    scene.add(pillar);

    const frontPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.8, 8), darkMetalMat);
    frontPillar.position.set(x, 1.9, -3.2);
    frontPillar.castShadow = true;
    scene.add(frontPillar);
  });

  // Canopy Roof
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(20, 0.15, 12), darkMetalMat);
  canopy.position.set(0, 4.0, 1.8);
  canopy.rotation.x = 0.04;
  canopy.castShadow = false;
  scene.add(canopy);

  // Shooting Benches / Tables in Stalls
  [-5, 0, 5].forEach((bx) => {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.8), woodMat);
    bench.position.set(bx, 0.45, -2.5);
    bench.castShadow = true;
    bench.receiveShadow = true;
    scene.add(bench);

    // Ammo Box on Table
    const ammoBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.16, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x3d5228, roughness: 0.5, metalness: 0.4 })
    );
    ammoBox.position.set(bx - 0.4, 0.98, -2.4);
    ammoBox.rotation.y = 0.3;
    ammoBox.castShadow = true;
    scene.add(ammoBox);
  });

  // 4. Sandbag Defensive Bunkers & Tactical Barriers Downrange
  const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x82775c, roughness: 0.9 });
  const buildSandbagWall = (x: number, z: number, rotY: number) => {
    const wall = new THREE.Group();
    wall.position.set(x, 0, z);
    wall.rotation.y = rotY;

    for (let r = 0; r < 3; r++) {
      for (let c = -2; c <= 2; c++) {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.32), sandbagMat);
        bag.position.set(c * 0.52 + (r % 2) * 0.15, r * 0.2 + 0.11, 0);
        bag.castShadow = true;
        bag.receiveShadow = true;
        wall.add(bag);
      }
    }
    scene.add(wall);
  };

  buildSandbagWall(-8, -12, 0.3);
  buildSandbagWall(8, -14, -0.25);
  buildSandbagWall(0, -32, 0);

  // 5. Tactical Shipping Container (Cover Element)
  const container = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.6, 6.0),
    new THREE.MeshStandardMaterial({ color: 0x1d4d73, metalness: 0.6, roughness: 0.4 })
  );
  container.position.set(10.5, 1.3, -24);
  container.rotation.y = -0.35;
  container.castShadow = true;
  container.receiveShadow = true;
  scene.add(container);

  // 6. Perimeter Berm Earth Walls (Surrounding the range)
  const bermMat = new THREE.MeshStandardMaterial({ color: 0x332e26, roughness: 1.0 });
  const leftBerm = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 120), bermMat);
  leftBerm.position.set(-18, 2, -45);
  leftBerm.castShadow = true;
  scene.add(leftBerm);

  const rightBerm = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 120), bermMat);
  rightBerm.position.set(18, 2, -45);
  rightBerm.castShadow = true;
  scene.add(rightBerm);

  const backstopBerm = new THREE.Mesh(new THREE.BoxGeometry(45, 14, 12), bermMat);
  backstopBerm.position.set(0, 5, -85);
  backstopBerm.castShadow = true;
  scene.add(backstopBerm);

  // 7. Atmospheric Sky Background Color
  scene.background = new THREE.Color(0x8cb8d6);
  scene.fog = new THREE.FogExp2(0x8cb8d6, 0.012);
}
