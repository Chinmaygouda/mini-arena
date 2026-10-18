// scripts/test-walker-diagnostic.mjs
import fs from 'fs';
import path from 'path';

const maps = ['range', 'foundry', 'culdesac', 'dustline', 'overpass'];

for (const m of maps) {
  if (m === 'range') {
    console.log('=== MAP: range ===');
    console.log('Visual boxes in shootingRange.ts: 3 benches (w:2.2, h:0.9, d:0.8 at z=-2.5), 3 sandbag walls, 1 container, 3 berms.');
    console.log('Colliders assigned in main.ts: 0 colliders ([]).');
    continue;
  }

  const mapFile = m === 'culdesac' ? 'Cul-de-Sac.json'
    : m === 'dustline' ? 'Dustline Village.json'
    : m === 'overpass' ? 'Overpass.json'
    : 'foundry_yard.json';

  const data = JSON.parse(fs.readFileSync(path.join('public/maps', mapFile), 'utf8'));
  const totalBoxes = data.boxes ? data.boxes.length : 0;
  const nonRoof = data.boxes ? data.boxes.filter(b => b.kind !== 'roof').length : 0;
  const roof = data.boxes ? data.boxes.filter(b => b.kind === 'roof').length : 0;
  const stairs = data.boxes ? data.boxes.filter(b => b.kind === 'stair' || b.kind === 'stairs').length : 0;
  const platforms = data.boxes ? data.boxes.filter(b => b.kind === 'platform').length : 0;
  const cover = data.boxes ? data.boxes.filter(b => b.kind === 'cover').length : 0;
  const walls = data.boxes ? data.boxes.filter(b => b.kind === 'wall').length : 0;

  console.log(`=== MAP: ${m} (${mapFile}) ===`);
  console.log(`Visual boxes: ${totalBoxes} (Roof: ${roof}, Colliders generated: ${nonRoof})`);
  console.log(`Breakdown -> Stairs: ${stairs}, Platforms: ${platforms}, Cover: ${cover}, Walls: ${walls}`);
}
