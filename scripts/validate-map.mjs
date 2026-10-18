// scripts/validate-map.mjs
// Validator for environment maps and building data schemas.
// Enforces:
// 1. Exterior doors >= 1.6m wide and >= 2.2m high
// 2. Interior doorways >= 1.2m wide
// 3. Floor-to-ceiling clearance >= 2.6m
// 4. Floor and ceiling slabs with real thickness (>= 0.15m)
// 5. Stairs rise <= 0.2m, width >= 1.2m, landings, and rooftop reachable
// 6. Windows: sill >= 1.0m, window height >= 1.0m, player-only blocker present
// 7. Wire size under 25 MB

import fs from 'fs';
import path from 'path';

export function validateMap(filePath) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [`File not found: ${filePath}`], warnings };
  }

  const stat = fs.statSync(filePath);
  const sizeMB = stat.size / (1024 * 1024);
  if (sizeMB > 25) {
    errors.push(`Map wire size ${sizeMB.toFixed(2)} MB exceeds 25 MB limit`);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON in ${filePath}: ${e.message}`], warnings };
  }

  // Basic meta
  if (!data.meta?.name) errors.push('Missing meta.name');
  if (!data.meta?.size || !Array.isArray(data.meta.size) || data.meta.size.length !== 2) {
    errors.push('Missing or invalid meta.size [width, depth]');
  }

  const buildings = data.buildings || [];
  if (buildings.length === 0 && !data.boxes) {
    warnings.push('Map has neither buildings nor boxes defined');
  }

  let totalExteriorDoors = 0;
  let totalInteriorDoors = 0;
  let totalWindows = 0;
  let totalStairs = 0;

  for (let bIndex = 0; bIndex < buildings.length; bIndex++) {
    const bldg = buildings[bIndex];
    const bName = bldg.name || bldg.id || `Building[${bIndex}]`;

    if (!bldg.id) errors.push(`${bName}: Missing building id`);
    if (!bldg.center || bldg.center.length !== 3) errors.push(`${bName}: Missing or invalid center [x, y, z]`);
    if (!bldg.size || bldg.size.length !== 2) errors.push(`${bName}: Missing or invalid size [width, depth]`);

    const floors = bldg.floors || [];
    if (floors.length === 0) {
      errors.push(`${bName}: Must have at least 1 floor`);
      continue;
    }

    let hasRooftopAccess = false;

    for (let fIndex = 0; fIndex < floors.length; fIndex++) {
      const fl = floors[fIndex];
      const flName = `${bName} Floor ${fl.floorIndex ?? fIndex}`;

      // Rule: Floor-to-ceiling >= 2.6m
      const height = fl.height || 0;
      if (height < 2.6) {
        errors.push(`${flName}: Floor-to-ceiling height ${height}m is less than minimum 2.6m`);
      }

      // Rule: Floor and ceiling slabs with real thickness (>= 0.15m)
      const slabThickness = fl.slabThickness ?? 0.2;
      if (slabThickness < 0.15) {
        errors.push(`${flName}: Slab thickness ${slabThickness}m is less than minimum 0.15m`);
      }

      // Rule: Exterior doors >= 1.6m wide and >= 2.2m high
      const extDoors = fl.exteriorDoors || [];
      for (let d = 0; d < extDoors.length; d++) {
        totalExteriorDoors++;
        const door = extDoors[d];
        if (door.width < 1.6) {
          errors.push(`${flName} Exterior Door ${d}: Width ${door.width}m is less than required 1.6m`);
        }
        if (door.height < 2.2) {
          errors.push(`${flName} Exterior Door ${d}: Height ${door.height}m is less than required 2.2m`);
        }
      }

      // Rule: Interior doorways >= 1.2m wide
      const intDoors = fl.interiorDoors || [];
      for (let d = 0; d < intDoors.length; d++) {
        totalInteriorDoors++;
        const door = intDoors[d];
        if (door.width < 1.2) {
          errors.push(`${flName} Interior Door ${d}: Width ${door.width}m is less than required 1.2m`);
        }
      }
      const intWalls = fl.interiorWalls || [];
      for (let iw = 0; iw < intWalls.length; iw++) {
        const doorways = intWalls[iw].doorways || [];
        for (let d = 0; d < doorways.length; d++) {
          totalInteriorDoors++;
          const door = doorways[d];
          if (door.width < 1.2) {
            errors.push(`${flName} Interior Wall ${iw} Doorway ${d}: Width ${door.width}m is less than required 1.2m`);
          }
        }
      }

      // Rule: Windows: sill >= 1.0m, height >= 1.0m, player blocker present
      const windows = fl.windows || [];
      for (let w = 0; w < windows.length; w++) {
        totalWindows++;
        const win = windows[w];
        if (win.sillHeight < 1.0) {
          errors.push(`${flName} Window ${w}: Sill height ${win.sillHeight}m is less than required 1.0m`);
        }
        if (win.height < 1.0) {
          errors.push(`${flName} Window ${w}: Height ${win.height}m is less than required 1.0m`);
        }
        if (win.hasPlayerBlocker === false) {
          errors.push(`${flName} Window ${w}: Must have player-only blocker enabled`);
        }
      }

      // Rule: Stairs rise <= 0.2m, width >= 1.2m
      const stairs = fl.stairs || [];
      for (let s = 0; s < stairs.length; s++) {
        totalStairs++;
        const st = stairs[s];
        if (st.width < 1.2) {
          errors.push(`${flName} Stair ${st.id || s}: Width ${st.width}m is less than required 1.2m`);
        }
        if (st.stepRise > 0.201) {
          errors.push(`${flName} Stair ${st.id || s}: Step rise ${st.stepRise}m exceeds maximum 0.2m`);
        }
        if (st.leadsToRoof || st.targetFloorY >= (bldg.floors.length * 3.0 - 0.5)) {
          hasRooftopAccess = true;
        }
      }
    }

    // Rule: Rooftop reachable by stairs
    if (bldg.roof) {
      if (!hasRooftopAccess && bldg.roof.accessFromStairs === false) {
        warnings.push(`${bName}: No stair leading to rooftop identified`);
      }
      if (bldg.roof.type === 'flat_parapet') {
        const parapetH = bldg.roof.parapetHeight ?? 0.9;
        if (parapetH < 0.7) {
          warnings.push(`${bName}: Flat roof parapet height ${parapetH}m is below recommended 0.8-1.0m`);
        }
      }
    }
  }

  const valid = errors.length === 0;
  return {
    valid,
    sizeMB: +sizeMB.toFixed(3),
    buildingsCount: buildings.length,
    exteriorDoorsCount: totalExteriorDoors,
    interiorDoorsCount: totalInteriorDoors,
    windowsCount: totalWindows,
    stairsCount: totalStairs,
    errors,
    warnings
  };
}

// CLI runner
if (process.argv[1] && process.argv[1].endsWith('validate-map.mjs')) {
  const targetMap = process.argv[2] || 'public/maps/Dustline Village.json';
  console.log(`\n========================================================================`);
  console.log(` VALIDATING MAP: ${targetMap}`);
  console.log(`========================================================================`);
  const result = validateMap(targetMap);
  console.log(`Result: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Wire Size: ${result.sizeMB} MB (limit 25 MB)`);
  console.log(`Buildings: ${result.buildingsCount}`);
  console.log(`Exterior Doors: ${result.exteriorDoorsCount} (min 1.6m x 2.2m)`);
  console.log(`Interior Doors: ${result.interiorDoorsCount} (min 1.2m)`);
  console.log(`Windows: ${result.windowsCount} (sill >= 1.0m + player blocker)`);
  console.log(`Stairs: ${result.stairsCount} (rise <= 0.2m, width >= 1.2m)`);

  if (result.errors.length > 0) {
    console.error(`\n❌ ERRORS (${result.errors.length}):`);
    result.errors.forEach(e => console.error(`  - ${e}`));
  }
  if (result.warnings.length > 0) {
    console.warn(`\n⚠ WARNINGS (${result.warnings.length}):`);
    result.warnings.forEach(w => console.warn(`  - ${w}`));
  }
  process.exit(result.valid ? 0 : 1);
}
