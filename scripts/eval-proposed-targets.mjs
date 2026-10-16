import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';

const targetSpec = JSON.parse(fs.readFileSync('hold_poses.json', 'utf8'));
const actual_l1 = 0.322236;
const actual_l2 = 0.237276;
const actual_max_reach = actual_l1 + actual_l2; // 0.559512

// Actual measured shoulders in camera space (Three.js camera coordinates: +X right, +Y up, -Z forward)
// Note: In Drillimpact rig, upperArmR is on the right of the person, but let's check whether X is positive or negative:
// If looking from camera down -Z:
// Player's right side is +X!
// Let's check which side is player's right arm:
// In armsRig.ts: upperArmR has x = -0.00865, shoulderR has x = -0.0183 relative to parent.
// When rigGroup is attached, does upperArmR end up on negative X or positive X?
// Earlier output:
// Shoulder R (Cam Space): [ -0.1970, -0.1491, -0.0267 ]
// Shoulder L (Cam Space): [ 0.1970, -0.1491, -0.0267 ]
// Wait! Let's check: target grip_R is at X = +0.10!
// If target grip_R is at X = +0.10 and Shoulder R was at X = -0.197, then the arm would have to cross the body!
// But wait! Is Shoulder R really at -0.197, or is the bone named 'upper_armR' on the left side of the screen?
console.log('Testing geometry...');
