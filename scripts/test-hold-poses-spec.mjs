import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';

const targetSpec = JSON.parse(fs.readFileSync('hold_poses.json', 'utf8'));

// Measured from arms_rig.glb
const l1 = 0.322236;
const l2 = 0.237276;
const maxReach = l1 + l2; // 0.559512 m

// Shoulders measured from arms_rig.glb in camera space
// Note: right arm shoulder is on player's right (+X in screen space if looking down -Z),
// let's check both conventions:
// Convention 1: S_R on +X (standard camera/viewmodel space)
// S_R = [+0.1970, -0.1491, -0.0267]
// S_L = [-0.1970, -0.1491, -0.0267]
// Convention 2: S_R on -X (raw Drillimpact rig coordinates)
// S_R = [-0.1970, -0.1491, -0.0267]
// S_L = [+0.1970, -0.1491, -0.0267]

function testConvention(sR_x, sL_x, label) {
  console.log(`\n======================================================`);
  console.log(`EVALUATING ${label}: S_R.x = ${sR_x}, S_L.x = ${sL_x}`);
  console.log(`======================================================`);

  const S_R = new THREE.Vector3(sR_x, -0.1491, -0.0267);
  const S_L = new THREE.Vector3(sL_x, -0.1491, -0.0267);

  // Scaled reach ratio
  const ratio = maxReach / (targetSpec.l1 + targetSpec.l2); // 0.559512 / 0.620000 = 0.902439

  for (const [id, w] of Object.entries(targetSpec.weapons)) {
    // Original proposed target
    const targetR_orig = new THREE.Vector3(...w.grip_R_cam);
    const targetL_orig = new THREE.Vector3(...w.grip_L_cam);

    // Scaled target: scale displacement from shoulder along each axis by ratio
    const targetR_scaled = new THREE.Vector3()
      .subVectors(targetR_orig, S_R)
      .multiplyScalar(ratio)
      .add(S_R);

    const targetL_scaled = new THREE.Vector3()
      .subVectors(targetL_orig, S_L)
      .multiplyScalar(ratio)
      .add(S_L);

    // Test both original and scaled
    for (const [variant, tR, tL] of [
      ['Original Target', targetR_orig, targetL_orig],
      ['Ratio-Scaled Target', targetR_scaled, targetL_scaled],
    ]) {
      const dR = tR.distanceTo(S_R);
      const dL = tL.distanceTo(S_L);

      const reachR = (dR / maxReach) * 100;
      const reachL = (dL / maxReach) * 100;

      const cosElbowR = (l1 * l1 + l2 * l2 - dR * dR) / (2 * l1 * l2);
      const elbowAngleR = (Math.acos(Math.max(-1, Math.min(1, cosElbowR))) * 180) / Math.PI;

      const cosElbowL = (l1 * l1 + l2 * l2 - dL * dL) / (2 * l1 * l2);
      const elbowAngleL = (Math.acos(Math.max(-1, Math.min(1, cosElbowL))) * 180) / Math.PI;

      // Acceptance: reach 55-95%, elbow 60-150 deg
      const passR = reachR >= 55 && reachR <= 95 && elbowAngleR >= 60 && elbowAngleR <= 150;
      const passL = reachL >= 55 && reachL <= 95 && elbowAngleL >= 60 && elbowAngleL <= 150;

      console.log(`[${id}] ${variant}:`);
      console.log(`   R: dist=${dR.toFixed(3)}m, reach=${reachR.toFixed(1)}%, elbow=${elbowAngleR.toFixed(1)}° | PASS=${passR}`);
      console.log(`   L: dist=${dL.toFixed(3)}m, reach=${reachL.toFixed(1)}%, elbow=${elbowAngleL.toFixed(1)}° | PASS=${passL}`);
    }
  }
}

// In HOLD_POSES.md:
// Shoulders: S_R=[0.16, -0.24, 0.14] S_L=[-0.16, -0.24, 0.14]
// Right is +X, Left is -X!
testConvention(0.197, -0.197, 'Player Perspective (Right = +X, Left = -X)');
testConvention(-0.197, 0.197, 'Blender Front Perspective (Right = -X, Left = +X)');
