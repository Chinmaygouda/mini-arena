// scripts/compare-frame-strips.mjs
import fs from 'fs';
import path from 'path';

const ARTIFACTS = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/5618d13b-17a0-4ad6-8787-4ecd7ffd8f73';
const weapons = ['ak47', 'pistol', 'smg', 'shotgun', 'sniper'];
const phases = [
  ['1_idle', 'Idle'],
  ['2_start', 'Sprint Start (80ms)'],
  ['3_steady', 'Steady Sprint (600ms)'],
  ['4_stop', 'Sprint Stop (+100ms)']
];

console.log('--- FRAME STRIP VERIFICATION ---');
for (const w of weapons) {
  console.log(`\nWeapon: ${w.toUpperCase()}`);
  for (const [p, label] of phases) {
    const fA0 = path.join(ARTIFACTS, `sprint_${w}_${p}.png`);
    const fA2 = path.join(ARTIFACTS, `sprint_${w}_after_${p}.png`);
    const exA0 = fs.existsSync(fA0);
    const exA2 = fs.existsSync(fA2);
    const sizeA0 = exA0 ? fs.statSync(fA0).size : 0;
    const sizeA2 = exA2 ? fs.statSync(fA2).size : 0;
    console.log(`  Phase [${label}]:`);
    console.log(`    A0 (before): ${exA0 ? 'OK (' + sizeA0 + ' bytes)' : 'MISSING'}`);
    console.log(`    A2 (after):  ${exA2 ? 'OK (' + sizeA2 + ' bytes)' : 'MISSING'}`);
  }
}
