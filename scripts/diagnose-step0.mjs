// scripts/diagnose-step0.mjs
// Step 0 Diagnosis: Collects raw stats & captures eye-level and top-down screenshots for all 5 maps.

import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/5618d13b-17a0-4ad6-8787-4ecd7ffd8f73';

async function diagnoseStep0() {
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const target = list.find(x => x.url.includes('localhost:5173') && !x.url.includes('soundtest'));
  if (!target) throw new Error('Vite dev tab not found');

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

  const maps = ['range', 'foundry', 'culdesac', 'dustline', 'overpass'];
  const mapData = {};

  for (const mapId of maps) {
    console.log(`\nGathering Step 0 Diagnostics for: ${mapId}...`);
    // 1. Switch map
    await send('Runtime.evaluate', {
      expression: `window.__fpsApp.switchMap('${mapId}')`,
      awaitPromise: true
    });
    await new Promise(r => setTimeout(r, 800));

    // 2. Query rendering & scene stats
    const statsResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const app = window.__fpsApp;
          const renderer = app.renderer;
          const scene = app.scene;
          const controls = app.controls;
          const bounds = controls.bounds;

          let meshCount = 0;
          let boxCount = 0;
          scene.traverse(obj => {
            if (obj.isMesh) {
              meshCount++;
              if (obj.geometry && obj.geometry.type === 'BoxGeometry') boxCount++;
            }
          });

          // Measure 60 frames for FPS
          return {
            mapId: '${mapId}',
            bounds,
            collidersCount: controls.colliders ? controls.colliders.length : 0,
            walkableCount: controls.colliders ? controls.colliders.filter(c => c.isWalkable).length : 0,
            solidCollidersCount: controls.colliders ? controls.colliders.filter(c => !c.isWalkable).length : 0,
            meshCount,
            boxMeshCount: boxCount,
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            geometries: renderer.info.memory.geometries,
            textures: renderer.info.memory.textures,
            fog: scene.fog ? { color: scene.fog.color.getHexString(), density: scene.fog.density } : null,
            background: scene.background ? (scene.background.isColor ? scene.background.getHexString() : 'skybox') : null,
            lights: scene.children.filter(c => c.isLight).length + (app.mapLoader.currentLightsGroup ? app.mapLoader.currentLightsGroup.children.length : 0)
          };
        })()
      `,
      returnByValue: true
    });

    const stats = statsResult.result.value;

    // Measure FPS over 0.5s
    const fpsResult = await send('Runtime.evaluate', {
      expression: `
        new Promise(resolve => {
          let frames = 0;
          const start = performance.now();
          function tick() {
            frames++;
            if (performance.now() - start >= 500) {
              resolve({ fps: Math.round((frames * 1000) / (performance.now() - start)) });
            } else {
              requestAnimationFrame(tick);
            }
          }
          requestAnimationFrame(tick);
        })
      `,
      awaitPromise: true,
      returnByValue: true
    });
    stats.fps = fpsResult.result.value.fps;
    mapData[mapId] = stats;

    // 3. Capture Eye-Level Screenshot
    const eyeShot = await send('Page.captureScreenshot', { format: 'png' });
    const eyePath = path.join(ARTIFACT_DIR, `step0_eye_${mapId}.png`);
    fs.writeFileSync(eyePath, Buffer.from(eyeShot.data, 'base64'));

    // 4. Position camera high above looking down for Top-Down Screenshot
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const controls = window.__fpsApp.controls;
          window.__savedPos = { ...controls.position };
          window.__savedPitch = controls.pitch;
          window.__savedYaw = controls.yaw;
          
          controls.position.set(0, 50, 0);
          controls.pitch = -Math.PI / 2 + 0.01; // looking straight down
          controls.yaw = 0;
          controls.update(1/60);
        })()
      `
    });
    await new Promise(r => setTimeout(r, 300));

    const topShot = await send('Page.captureScreenshot', { format: 'png' });
    const topPath = path.join(ARTIFACT_DIR, `step0_topdown_${mapId}.png`);
    fs.writeFileSync(topPath, Buffer.from(topShot.data, 'base64'));

    // Restore camera
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const controls = window.__fpsApp.controls;
          controls.position.copy(window.__savedPos);
          controls.pitch = window.__savedPitch;
          controls.yaw = window.__savedYaw;
          controls.update(1/60);
        })()
      `
    });
    await new Promise(r => setTimeout(r, 200));

    console.log(`  Map: ${mapId}`);
    console.log(`  Colliders: ${stats.collidersCount} (Solid: ${stats.solidCollidersCount}, Walkable: ${stats.walkableCount})`);
    console.log(`  Meshes: ${stats.meshCount} (BoxGeom: ${stats.boxMeshCount})`);
    console.log(`  Draw Calls: ${stats.drawCalls}, Triangles: ${stats.triangles}, FPS: ${stats.fps}`);
    console.log(`  Eye-level shot: step0_eye_${mapId}.png`);
    console.log(`  Top-down shot: step0_topdown_${mapId}.png`);
  }

  ws.close();
  console.log('\n=== STEP 0 DIAGNOSTICS COMPLETE ===');
  console.log(JSON.stringify(mapData, null, 2));
}

diagnoseStep0().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
