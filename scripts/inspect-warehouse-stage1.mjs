import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = 'artifacts/warehouse-review';
fs.mkdirSync(outDir, { recursive: true });

async function inspect() {
  console.log('Connecting to running game on http://localhost:5173/?map=warehouse&quality=high&time=overcast ...');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 1440 } });
  
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });

  await page.goto('http://localhost:5173/?map=warehouse&quality=high&time=overcast', { waitUntil: 'domcontentloaded' });

  // Wait for map loading to complete
  await page.waitForFunction(() => {
    const app = window.__fpsApp || window.game || window.__game;
    return app?.mapLoader?.currentMapId === 'warehouse' &&
      Array.isArray(app?.controls?.colliders) &&
      app.controls.colliders.length >= 60;
  }, null, { timeout: 25000 });

  console.log('Warehouse map loaded in Three.js renderer.');

  // Dismiss intro overlay if present
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-engage');
    if (btn) btn.click();
    const intro = document.querySelector('#instructions-overlay');
    if (intro) intro.style.display = 'none';
  });
  await page.waitForTimeout(500);

  // 1. Collect Comprehensive Geometric and Scene Telemetry
  const telemetry = await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    const colliders = controls.colliders;
    const bounds = controls.bounds;

    // Outer wall footprint
    const minX = Math.min(...colliders.map(c => c.minX));
    const maxX = Math.max(...colliders.map(c => c.maxX));
    const minY = Math.min(...colliders.map(c => c.minY));
    const maxY = Math.max(...colliders.map(c => c.maxY));
    const minZ = Math.min(...colliders.map(c => c.minZ));
    const maxZ = Math.max(...colliders.map(c => c.maxZ));

    const outerFootprint = {
      width: maxX - minX,
      depth: maxZ - minZ,
      minX, maxX, minZ, maxZ,
      wallHeight: maxY - minY
    };

    const playableBounds = {
      width: bounds.maxX - bounds.minX,
      depth: bounds.maxZ - bounds.minZ,
      minX: bounds.minX, maxX: bounds.maxX,
      minZ: bounds.minZ, maxZ: bounds.maxZ
    };

    // Lights
    const pointLights = [];
    const fixtureMeshes = [];
    app.scene.traverse((obj) => {
      if (obj.isPointLight && obj.name?.startsWith('warehouse-light-')) {
        pointLights.push({
          name: obj.name,
          x: obj.position.x,
          y: obj.position.y,
          z: obj.position.z,
          color: obj.color.getHexString(),
          intensity: obj.intensity,
          range: obj.range
        });
      }
      if (obj.name?.startsWith('warehouse-fixture-')) {
        fixtureMeshes.push({
          name: obj.name,
          x: obj.position.x,
          y: obj.position.y,
          z: obj.position.z
        });
      }
    });

    // Props, buildings, nature check
    const buildings = app.mapLoader.loadedBuildings || [];
    let natureMeshes = 0;
    let propMeshes = 0;
    app.scene.traverse((obj) => {
      if (obj.name?.includes('tree') || obj.name?.includes('rock') || obj.name?.includes('bird')) {
        natureMeshes++;
      }
      if (obj.name?.includes('crate') || obj.name?.includes('rack') || obj.name?.includes('vehicle')) {
        propMeshes++;
      }
    });

    // Corridor Clear Width Measurements
    // A. Main central cross-corridors:
    // Along Z axis (North-South main spine at X = 0):
    // Find the closest wall edges to X = 0 for X < 0 and X > 0
    const westOfSpine = colliders.filter(c => c.maxX <= 0.001);
    const eastOfSpine = colliders.filter(c => c.minX >= -0.001);
    const maxWestWallX = Math.max(...westOfSpine.map(c => c.maxX));
    const minEastWallX = Math.min(...eastOfSpine.map(c => c.minX));
    const mainCorridorWidthNS = minEastWallX - maxWestWallX;

    // Along X axis (East-West main cross corridor at Z = 0):
    const southOfEquator = colliders.filter(c => c.maxZ <= 0.001);
    const northOfEquator = colliders.filter(c => c.minZ >= -0.001);
    const maxSouthWallZ = Math.max(...southOfEquator.map(c => c.maxZ));
    const minNorthWallZ = Math.min(...northOfEquator.map(c => c.minZ));
    const mainCorridorWidthEW = minNorthWallZ - maxSouthWallZ;

    // B. Perimeter Service Corridors:
    // Distance between outer perimeter wall inner face and outermost section wall outer face
    // North perimeter inner face is at Z = 46.5
    // Outermost North section walls:
    const northSectionWalls = colliders.filter(c => c.maxZ < 46.0 && c.minZ > 30.0);
    const maxNorthSectionZ = Math.max(...northSectionWalls.map(c => c.maxZ));
    const northServiceCorridor = 46.5 - maxNorthSectionZ;

    // South perimeter inner face is at Z = -46.5
    const southSectionWalls = colliders.filter(c => c.minZ > -46.0 && c.maxZ < -30.0);
    const minSouthSectionZ = Math.min(...southSectionWalls.map(c => c.minZ));
    const southServiceCorridor = minSouthSectionZ - (-46.5);

    // West perimeter inner face is at X = -46.5
    const westSectionWalls = colliders.filter(c => c.minX > -46.0 && c.maxX < -30.0);
    const minWestSectionX = Math.min(...westSectionWalls.map(c => c.minX));
    const westServiceCorridor = minWestSectionX - (-46.5);

    // East perimeter inner face is at X = 46.5
    const eastSectionWalls = colliders.filter(c => c.maxX < 46.0 && c.minX > 30.0);
    const maxEastSectionX = Math.max(...eastSectionWalls.map(c => c.maxX));
    const eastServiceCorridor = 46.5 - maxEastSectionX;

    // C. Central Combat Hall Clear Size:
    // Walls bounding the central hall:
    const centralWalls = colliders.filter(c => 
      Math.abs(c.minX) < 15 && Math.abs(c.maxX) < 15 &&
      Math.abs(c.minZ) < 15 && Math.abs(c.maxZ) < 15
    );
    // Find inner faces surrounding (0,0)
    const hallWestFace = Math.max(...centralWalls.filter(c => c.maxX < -1).map(c => c.maxX));
    const hallEastFace = Math.min(...centralWalls.filter(c => c.minX > 1).map(c => c.minX));
    const hallSouthFace = Math.max(...centralWalls.filter(c => c.maxZ < -1).map(c => c.maxZ));
    const hallNorthFace = Math.min(...centralWalls.filter(c => c.minZ > 1).map(c => c.minZ));

    const centralHallClear = {
      width: hallEastFace - hallWestFace,
      depth: hallNorthFace - hallSouthFace,
      westFace: hallWestFace,
      eastFace: hallEastFace,
      southFace: hallSouthFace,
      northFace: hallNorthFace
    };

    // D. Loading Bay Openings:
    // Outer west wall gap around Z = 0
    const outerWestWalls = colliders.filter(c => c.minX < -46.5);
    const outerWestNorthZ = Math.min(...outerWestWalls.filter(c => c.minZ > 0).map(c => c.minZ));
    const outerWestSouthZ = Math.max(...outerWestWalls.filter(c => c.maxZ < 0).map(c => c.maxZ));
    const westDockOpening = outerWestNorthZ - outerWestSouthZ;

    // Outer east wall gap around Z = 0
    const outerEastWalls = colliders.filter(c => c.maxX > 46.5);
    const outerEastNorthZ = Math.min(...outerEastWalls.filter(c => c.minZ > 0).map(c => c.minZ));
    const outerEastSouthZ = Math.max(...outerEastWalls.filter(c => c.maxZ < 0).map(c => c.maxZ));
    const eastDockOpening = outerEastNorthZ - outerEastSouthZ;

    // E. Symmetry verification:
    // Check if for every collider there is a horizontally and vertically mirrored collider
    const round = n => Math.round(n * 100) / 100;
    const colliderKeys = new Set(colliders.map(c => 
      `${round(c.minX)}|${round(c.maxX)}|${round(c.minZ)}|${round(c.maxZ)}`
    ));
    let symmetryViolations = 0;
    for (const c of colliders) {
      // Flip X: [minX, maxX] -> [-maxX, -minX]
      const flipXKey = `${round(-c.maxX)}|${round(-c.minX)}|${round(c.minZ)}|${round(c.maxZ)}`;
      // Flip Z: [minZ, maxZ] -> [-maxZ, -minZ]
      const flipZKey = `${round(c.minX)}|${round(c.maxX)}|${round(-c.maxZ)}|${round(-c.minZ)}`;
      // Flip both:
      const flipBothKey = `${round(-c.maxX)}|${round(-c.minX)}|${round(-c.maxZ)}|${round(-c.minZ)}`;
      if (!colliderKeys.has(flipXKey) || !colliderKeys.has(flipZKey) || !colliderKeys.has(flipBothKey)) {
        symmetryViolations++;
      }
    }

    return {
      mapId: app.mapLoader.currentMapId,
      colliderCount: colliders.length,
      outerFootprint,
      playableBounds,
      corridors: {
        mainCorridorWidthNS,
        mainCorridorWidthEW,
        serviceCorridors: {
          north: northServiceCorridor,
          south: southServiceCorridor,
          west: westServiceCorridor,
          east: eastServiceCorridor
        },
        centralHallClear,
        loadingDocks: {
          west: { openingWidth: westDockOpening, southZ: outerWestSouthZ, northZ: outerWestNorthZ },
          east: { openingWidth: eastDockOpening, southZ: outerEastSouthZ, northZ: outerEastNorthZ }
        }
      },
      lighting: {
        pointLightCount: pointLights.length,
        fixtureCount: fixtureMeshes.length,
        uniqueX: [...new Set(pointLights.map(l => l.x))].sort((a,b)=>a-b),
        uniqueZ: [...new Set(pointLights.map(l => l.z))].sort((a,b)=>a-b),
        heightY: pointLights[0]?.y
      },
      purity: {
        buildingsCount: buildings.length,
        natureMeshes,
        propMeshes
      },
      symmetry: {
        isSymmetric: symmetryViolations === 0,
        violations: symmetryViolations
      }
    };
  });

  console.log('Telemetry summary:');
  console.log(JSON.stringify(telemetry, null, 2));
  fs.writeFileSync(path.join(outDir, 'telemetry.json'), JSON.stringify(telemetry, null, 2));

  // 2. Capture Top-Down Screenshot (Complete Warehouse Visible, Weapon and HUD hidden)
  console.log('Capturing top-down screenshot...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const camera = app.camera;
    const controls = app.controls;
    controls.forceReleaseKeys();
    controls.__warehouseSavedUpdate = controls.update.bind(controls);
    
    // Position camera high above center looking straight down
    // With up vector set to (0, 0, 1) so North (+Z) is oriented top/up
    controls.update = () => {
      camera.position.set(0, 88, 0);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);
      camera.fov = 45;
      camera.updateProjectionMatrix();
    };

    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = false;
    const hud = document.querySelector('#fps-hud');
    if (hud) hud.style.display = 'none';
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'warehouse-topdown.png'), fullPage: true });

  // 3. Capture Player Perspective: Team B Spawn (South looking North into the warehouse)
  console.log('Capturing Team B spawn screenshot...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.update = controls.__warehouseSavedUpdate;
    delete controls.__warehouseSavedUpdate;
    controls.forceReleaseKeys();
    
    // Restore weapon model and HUD
    if (app.weaponManager?.rootGroup) app.weaponManager.rootGroup.visible = true;
    const hud = document.querySelector('#fps-hud');
    if (hud) hud.style.display = 'block';

    // Set position at Team B spawn looking North (yaw = PI in this engine faces North / +Z)
    controls.pitch = 0;
    controls.setPosition(0, 1.7, -39.5, Math.PI);
    controls.update(1 / 60);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'warehouse-team-b-spawn.png'), fullPage: true });

  // 4. Capture Player Perspective: Team A Spawn (North looking South into the warehouse)
  console.log('Capturing Team A spawn screenshot...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.pitch = 0;
    controls.setPosition(0, 1.7, 39.5, 0); // facing South
    controls.update(1 / 60);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'warehouse-team-a-spawn.png'), fullPage: true });

  // 5. Capture Player Perspective: Central Combat Hall
  console.log('Capturing Central Combat Hall screenshot...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.pitch = -0.05;
    controls.setPosition(0, 1.7, 0, Math.PI * 0.75); // inside central hall looking towards section 1 / corridor
    controls.update(1 / 60);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'warehouse-central-hall.png'), fullPage: true });

  // 6. Capture Player Perspective: Section 1 Quadrant Numeral close-up
  console.log('Capturing Section 1 Quadrant view...');
  await page.evaluate(() => {
    const app = window.__fpsApp || window.game || window.__game;
    const controls = app.controls;
    controls.pitch = -0.35; // looking slightly down at floor
    controls.setPosition(-22, 1.7, 18, Math.PI); // near section 1 marker
    controls.update(1 / 60);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'warehouse-section-1.png'), fullPage: true });

  await browser.close();
  console.log('Inspection script completed successfully. All artifacts captured.');
}

inspect().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
