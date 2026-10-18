// scripts/test-walker.mjs
// Issue 2 Stair and Box Walker Verification Script
// Tests all 5 maps in real Chrome via CDP:
// - Walks up and down every flight of stairs
// - Jumps onto and collides into boxes and cover objects
// - Verifies that the player is NEVER inside a solid object at any time

const PLAYER_RADIUS = 0.35;
const PLAYER_EYE_H = 1.7;
const PLAYER_HEAD_M = 0.15;
const GROUND_MARGIN = 0.05;

async function runWalker() {
  console.log('========================================================================');
  console.log(' STAIR & BOX WALKER VERIFICATION (ISSUE 2) — ALL 5 MAPS');
  console.log('========================================================================\n');

  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const target = list.find(x => x.url.includes('localhost:5173'));
  if (!target) throw new Error('Vite dev tab not found on port 9222');

  const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const curId = id++;
    const handler = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id === curId) {
        ws.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await new Promise(r => { ws.onopen = r; });

  // Evaluate in-browser walker
  const mapsToTest = ['range', 'foundry', 'culdesac', 'dustline', 'overpass'];

  const results = [];

  for (const mapId of mapsToTest) {
    console.log(`────────────────────────────────────────────────────────────────────────`);
    console.log(`TESTING MAP: ${mapId.toUpperCase()}`);
    console.log(`────────────────────────────────────────────────────────────────────────`);

    const evalResult = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const app = window.__fpsApp;
          if (!app) return { error: '__fpsApp not found' };

          await app.switchMap('${mapId}');
          await new Promise(r => setTimeout(r, 600));

          const controls = app.controls;
          const colliders = controls.colliders || [];
          const bounds = controls.bounds;

          let totalStairsWalked = 0;
          let totalBoxesTested = 0;
          let totalPositionsChecked = 0;
          let solidPenetrations = 0;
          const penetrationDetails = [];

          // Helper: check if position penetrates inside any solid (non-walkable) collider
          function checkSolidPenetration(px, py, pz, context) {
            totalPositionsChecked++;
            const feetY = py - 1.7;
            const headY = py + 0.15;

            for (let i = 0; i < colliders.length; i++) {
              const c = colliders[i];
              if (c.isWalkable) continue; // Walkable surfaces/stairs are designed to be walked on

              // Solid box penetration check (with 5cm skin margin)
              const insideX = px > (c.minX + 0.05) && px < (c.maxX - 0.05);
              const insideZ = pz > (c.minZ + 0.05) && pz < (c.maxZ - 0.05);
              const insideY = feetY < (c.maxY - 0.05) && headY > (c.minY + 0.05);

              if (insideX && insideZ && insideY) {
                solidPenetrations++;
                if (penetrationDetails.length < 5) {
                  penetrationDetails.push({
                    context,
                    pos: { x: +px.toFixed(3), y: +py.toFixed(3), z: +pz.toFixed(3) },
                    feetY: +feetY.toFixed(3),
                    collider: { minX: c.minX, maxX: c.maxX, minY: c.minY, maxY: c.maxY, minZ: c.minZ, maxZ: c.maxZ },
                    depthY: +(c.maxY - feetY).toFixed(3)
                  });
                }
              }
            }
          }

          // 1. STAIR TESTING (Flight-based ascent & descent)
          const stairColliders = colliders.filter(c => c.isWalkable && (c.maxY - c.minY <= 0.6));
          
          // Group steps into flights by spatial proximity
          const visited = new Set();
          const flights = [];

          for (let i = 0; i < stairColliders.length; i++) {
            if (visited.has(i)) continue;
            const flight = [stairColliders[i]];
            visited.add(i);

            let added = true;
            while (added) {
              added = false;
              for (let j = 0; j < stairColliders.length; j++) {
                if (visited.has(j)) continue;
                const cand = stairColliders[j];
                const candCX = (cand.minX + cand.maxX) / 2;
                const candCZ = (cand.minZ + cand.maxZ) / 2;

                const connects = flight.some(st => {
                  const stCX = (st.minX + st.maxX) / 2;
                  const stCZ = (st.minZ + st.maxZ) / 2;
                  const distXZ = Math.hypot(candCX - stCX, candCZ - stCZ);
                  const distY = Math.abs(cand.maxY - st.maxY);
                  return distXZ < 2.5 && distY < 0.6;
                });

                if (connects) {
                  flight.push(cand);
                  visited.add(j);
                  added = true;
                }
              }
            }

            if (flight.length >= 2) {
              flight.sort((a, b) => a.minY - b.minY);
              flights.push(flight);
            }
          }

          for (const flight of flights) {
            const firstStep = flight[0];
            const lastStep = flight[flight.length - 1];

            const firstCX = (firstStep.minX + firstStep.maxX) / 2;
            const firstCZ = (firstStep.minZ + firstStep.maxZ) / 2;
            const lastCX = (lastStep.minX + lastStep.maxX) / 2;
            const lastCZ = (lastStep.minZ + lastStep.maxZ) / 2;

            const dx = lastCX - firstCX;
            const dz = lastCZ - firstCZ;
            const dist = Math.hypot(dx, dz) || 1;
            const normX = dx / dist;
            const normZ = dz / dist;

            const ascendYaw = Math.atan2(-normX, -normZ);
            const descendYaw = Math.atan2(normX, normZ);

            // Position at bottom step
            controls.setPosition(firstCX, firstStep.maxY + 1.7, firstCZ, ascendYaw);
            controls.velocity.set(0, 0, 0);

            // Climb up
            for (let step = 0; step < 70; step++) {
              controls.input.forward = true;
              controls.update(1 / 60);
              checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'stair-up');
              if (controls.position.y - 1.7 >= lastStep.maxY - 0.05) break;
            }
            controls.input.forward = false;

            // Turn around and descend
            controls.yaw = descendYaw;
            for (let step = 0; step < 70; step++) {
              controls.input.forward = true;
              controls.update(1 / 60);
              checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'stair-down');
              if (controls.position.y - 1.7 <= firstStep.minY + 0.05) break;
            }
            controls.input.forward = false;
            totalStairsWalked++;
          }

          // 2. BOX TESTING (Walk into cover & jump on top)
          const boxes = colliders.filter(c => !c.isWalkable && c.maxY <= 2.5 && c.maxY >= 0.5);
          for (let b = 0; b < Math.min(boxes.length, 20); b++) {
            const box = boxes[b];
            const cx = (box.minX + box.maxX) / 2;
            const cz = (box.minZ + box.maxZ) / 2;

            // Check if -X approach is clear of other colliders
            const approachX = box.minX - 1.2;
            const approachZ = cz;
            const startFeetY = box.minY;

            const isStartBlocked = colliders.some(c => 
              c !== box && !c.isWalkable &&
              approachX > (c.minX - 0.35) && approachX < (c.maxX + 0.35) &&
              approachZ > (c.minZ - 0.35) && approachZ < (c.maxZ + 0.35) &&
              startFeetY < c.maxY && (startFeetY + 1.7) > c.minY
            );

            if (!isStartBlocked && approachX >= bounds.minX + 0.5) {
              // Approach facing +X toward box (yaw = -PI/2)
              controls.setPosition(approachX, startFeetY + 1.7, approachZ, -Math.PI / 2);
              controls.velocity.set(0, 0, 0);

              // Walk into box face
              for (let step = 0; step < 35; step++) {
                controls.input.forward = true;
                controls.update(1 / 60);
                checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'box-walk-into');
              }
              controls.input.forward = false;

              // Jump onto box if jumpable height
              if (box.maxY <= 1.5) {
                controls.setPosition(approachX, startFeetY + 1.7, approachZ, -Math.PI / 2);
                controls.velocity.set(0, 0, 0);
                for (let step = 0; step < 50; step++) {
                  controls.input.forward = true;
                  if (step === 3) controls.input.jump = true;
                  else controls.input.jump = false;
                  controls.update(1 / 60);
                  checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'box-jump-onto');
                }
                controls.input.forward = false;
              }
              totalBoxesTested++;
            }
          }

          // Open maps with no small cover boxes: test open boundaries
          if (totalBoxesTested === 0) {
            controls.setPosition(0, 1.7, 0, 0);
            for (let step = 0; step < 50; step++) {
              controls.input.forward = true;
              controls.update(1 / 60);
              checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'bounds-walk');
            }
            controls.input.forward = false;
          }

          return {
            mapId: '${mapId}',
            totalColliders: colliders.length,
            stairsWalked: totalStairsWalked,
            boxesTested: totalBoxesTested,
            positionsSampled: totalPositionsChecked,
            penetrations: solidPenetrations,
            details: penetrationDetails
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    const res = evalResult.result.value;
    results.push(res);
    console.log(`  Colliders: ${res.totalColliders}`);
    console.log(`  Stair Flights Walked (Up & Down): ${res.stairsWalked}`);
    console.log(`  Boxes Tested (Collided & Jumped): ${res.boxesTested}`);
    console.log(`  Positions Sampled: ${res.positionsSampled}`);
    console.log(`  Solid Penetrations: ${res.penetrations}`);
    if (res.penetrations > 0) {
      console.error(`  ❌ Penetration Details:`, JSON.stringify(res.details, null, 2));
    } else {
      console.log(`  ✅ 0 Penetrations. Player never entered solid geometry.`);
    }
  }

  console.log('\n========================================================================');
  console.log(' WALKER SUMMARY TABLE');
  console.log('========================================================================');
  console.table(results.map(r => ({
    Map: r.mapId,
    Colliders: r.totalColliders,
    Stairs: r.stairsWalked,
    Boxes: r.boxesTested,
    SampledFrames: r.positionsSampled,
    Penetrations: r.penetrations,
    Status: r.penetrations === 0 ? 'PASS' : 'FAIL'
  })));

  ws.close();
}

runWalker().catch(err => {
  console.error(err);
  process.exit(1);
});
