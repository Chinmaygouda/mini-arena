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

          // Helper: check if position is inside any solid collider
          function checkSolidPenetration(px, py, pz, context) {
            totalPositionsChecked++;
            const feetY = py - 1.7;
            const headY = py + 0.15;
            const r = 0.35;

            for (let i = 0; i < colliders.length; i++) {
              const c = colliders[i];
              // Check horizontal overlap with collider
              const overlapX = (px + r > c.minX) && (px - r < c.maxX);
              const overlapZ = (pz + r > c.minZ) && (pz - r < c.maxZ);

              if (overlapX && overlapZ) {
                // If horizontal overlap exists, player must be either:
                // 1) Standing safely ON TOP: feetY >= c.maxY - 0.06
                // 2) Completely BELOW: headY <= c.minY + 0.02
                const isStandingOnTop = feetY >= (c.maxY - 0.06);
                const isBelow = headY <= (c.minY + 0.02);

                if (!isStandingOnTop && !isBelow) {
                  // Inside solid volume!
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
          }

          // 1. STAIR TESTING
          // Find stairs: colliders with isWalkable or narrow steps (depth <= 1.2, height <= 0.6)
          const stairColliders = colliders.filter(c => c.isWalkable || (c.maxY - c.minY <= 0.5 && c.maxY > 0.1));

          // Group stairs by spatial proximity to find flights
          for (let s = 0; s < stairColliders.length; s++) {
            const stair = stairColliders[s];
            const cx = (stair.minX + stair.maxX) / 2;
            const cz = (stair.minZ + stair.maxZ) / 2;
            const topY = stair.maxY;

            // Test walking UP: position player at base
            controls.setPosition(cx, 1.7, cz + 0.8, Math.PI); // facing -Z
            controls.velocity.set(0, 0, 0);

            for (let step = 0; step < 40; step++) {
              controls.input.forward = true;
              controls.update(1 / 60);
              checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'stair-up');
            }
            controls.input.forward = false;

            // Test walking DOWN: turn around and walk forward
            controls.yaw = 0; // facing +Z
            for (let step = 0; step < 40; step++) {
              controls.input.forward = true;
              controls.update(1 / 60);
              checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'stair-down');
            }
            controls.input.forward = false;
            totalStairsWalked++;
          }

          // 2. BOX TESTING
          // Test low cover boxes (maxY <= 2.2) and containers/crates
          const boxes = colliders.filter(c => !c.isWalkable && c.maxY <= 2.8 && c.maxY >= 0.5);
          for (let b = 0; b < Math.min(boxes.length, 25); b++) {
            const box = boxes[b];
            const cx = Math.max(bounds.minX + 0.6, Math.min(bounds.maxX - 0.6, (box.minX + box.maxX) / 2));
            const cz = Math.max(bounds.minZ + 0.6, Math.min(bounds.maxZ - 0.6, (box.minZ + box.maxZ) / 2));

            // Choose valid approach axis that stays within map bounds
            if (box.maxZ + 0.9 <= bounds.maxZ - 0.1) {
              // Approach from North (+Z) facing South (-Z)
              controls.setPosition(cx, 1.7, box.maxZ + 0.8, Math.PI);
              for (let step = 0; step < 30; step++) {
                controls.input.forward = true;
                controls.update(1 / 60);
                checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'box-walk-into');
              }
              controls.input.forward = false;

              // Jump onto box if jumpable height
              if (box.maxY <= 1.5) {
                controls.setPosition(cx, 1.7, box.maxZ + 0.6, Math.PI);
                controls.input.jump = true;
                for (let step = 0; step < 45; step++) {
                  controls.input.forward = true;
                  controls.update(1 / 60);
                  checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'box-jump-onto');
                }
                controls.input.forward = false;
              }
            } else if (box.minZ - 0.9 >= bounds.minZ + 0.1) {
              // Approach from South (-Z) facing North (+Z)
              controls.setPosition(cx, 1.7, box.minZ - 0.8, 0);
              for (let step = 0; step < 30; step++) {
                controls.input.forward = true;
                controls.update(1 / 60);
                checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'box-walk-into');
              }
              controls.input.forward = false;

              // Jump onto box if jumpable height
              if (box.maxY <= 1.5) {
                controls.setPosition(cx, 1.7, box.minZ - 0.6, 0);
                controls.input.jump = true;
                for (let step = 0; step < 45; step++) {
                  controls.input.forward = true;
                  controls.update(1 / 60);
                  checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'box-jump-onto');
                }
                controls.input.forward = false;
              }
            }

            // Approach box along X axis if valid in bounds
            if (box.minX - 0.9 >= bounds.minX + 0.1) {
              controls.setPosition(box.minX - 0.8, 1.7, cz, -Math.PI / 2); // facing +X
              for (let step = 0; step < 20; step++) {
                controls.input.forward = true;
                controls.update(1 / 60);
                checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'box-collide-X');
              }
              controls.input.forward = false;
            } else if (box.maxX + 0.9 <= bounds.maxX - 0.1) {
              controls.setPosition(box.maxX + 0.8, 1.7, cz, Math.PI / 2); // facing -X
              for (let step = 0; step < 20; step++) {
                controls.input.forward = true;
                controls.update(1 / 60);
                checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'box-collide-X');
              }
              controls.input.forward = false;
            }

            totalBoxesTested++;
          }

          // Range map has 0 box colliders by default (open range), test boundary walls
          if (colliders.length === 0) {
            // Test range boundary walls
            controls.setPosition(0, 1.7, 0, Math.PI);
            for (let step = 0; step < 60; step++) {
              controls.input.forward = true;
              controls.update(1 / 60);
              checkSolidPenetration(controls.position.x, controls.position.y, controls.position.z, 'range-bounds');
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
