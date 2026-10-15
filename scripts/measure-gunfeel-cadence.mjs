import { chromium } from '@playwright/test';
import { createServer } from '../packages/client/node_modules/vite/dist/node/index.js';
import path from 'node:path';
import fs from 'node:fs';

async function main() {
  console.log('================================================================');
  console.log(' MINI ARENA — MEASURE REAL FIRING CADENCE & PELLET SPREAD');
  console.log(' Held fire for 10 seconds per weapon in real Chrome');
  console.log('================================================================\n');

  // Start Vite dev server on port 5174
  const server = await createServer({
    root: 'packages/client',
    server: { port: 5174 },
  });
  await server.listen();
  console.log('Vite server running on http://localhost:5174\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-angle=default',
      '--enable-dawn-features=allow_unsafe_apis',
    ],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5174/?debug=1', { waitUntil: 'networkidle' });

  // Dismiss overlay
  const enterBtn = page.locator('#enter-btn, button:has-text("ENTER")');
  if (await enterBtn.isVisible()) {
    await enterBtn.click({ force: true });
  } else {
    await page.mouse.click(640, 360);
  }
  await page.waitForTimeout(500);

  const weapons = [
    { slot: 0, id: 'assault_rifle', name: 'Assault Rifle (AK-47)', specRpm: 600, specIntervalMs: 100, specFireMode: 'auto', specIntervalTicks: 6 },
    { slot: 1, id: 'pistol', name: 'Tactical Pistol', specRpm: 400, specIntervalMs: 150, specFireMode: 'semi', specIntervalTicks: 9 },
    { slot: 2, id: 'smg', name: 'Rapid SMG', specRpm: 800, specIntervalMs: 75, specFireMode: 'auto', specIntervalTicks: 4.5 },
    { slot: 3, id: 'shotgun', name: 'Combat Shotgun', specRpm: 80, specIntervalMs: 750, specFireMode: 'semi', specIntervalTicks: 45 },
    { slot: 4, id: 'sniper', name: 'Precision Sniper', specRpm: 45, specIntervalMs: 1333.3, specFireMode: 'semi', specIntervalTicks: 80 },
  ];

  const cadenceResults = {};

  for (const w of weapons) {
    console.log(`\n>>> Testing ${w.name} (Slot ${w.slot}) <<<`);

    // Switch to slot
    await page.evaluate((slot) => {
      window.__inputManager.testHooks.setWeaponSlot(slot);
    }, w.slot);
    await page.waitForTimeout(800);

    // Install shot telemetry interceptor inside browser
    await page.evaluate(() => {
      window.__shotLogs = [];
      window.__pelletLogs = [];

      // Hook viewmodel.spawnTracer to record exact shots and pellet impact points
      const origSpawnTracer = window.__viewmodel.spawnTracer.bind(window.__viewmodel);
      let currentShotId = 0;
      let lastShotTime = 0;

      window.__viewmodel.spawnTracer = function (from, to) {
        const now = performance.now();
        // If this tracer is close in time (< 5ms) to last shot, it's a shotgun pellet
        if (now - lastShotTime > 5) {
          currentShotId++;
          lastShotTime = now;
          window.__shotLogs.push({
            shotId: currentShotId,
            timeMs: now,
            ammoInMag: window.__weaponState.slots[window.__weaponState.currentSlot].ammoInMag,
            actionState: window.__weaponState.actionState,
            simTick: window.__weaponState.currentSimTick,
          });
        }

        window.__pelletLogs.push({
          shotId: currentShotId,
          timeMs: now,
          from: { x: +from.x.toFixed(3), y: +from.y.toFixed(3), z: +from.z.toFixed(3) },
          to: { x: +to.x.toFixed(3), y: +to.y.toFixed(3), z: +to.z.toFixed(3) },
        });

        return origSpawnTracer(from, to);
      };
    });

    // Hold fire continuously for 10.0 seconds
    console.log(`  Holding fire for 10.0 seconds...`);
    await page.evaluate(() => {
      window.__inputManager.testHooks.setFire(true);
    });

    await page.waitForTimeout(10000);

    // Release fire
    await page.evaluate(() => {
      window.__inputManager.testHooks.setFire(false);
    });
    await page.waitForTimeout(500);

    // Retrieve shot logs
    const shotData = await page.evaluate(() => {
      return {
        shots: window.__shotLogs,
        pellets: window.__pelletLogs,
      };
    });

    // Compute intervals within continuous bursts (filtering out reload gaps > 300ms)
    const allIntervals = [];
    const burstIntervals = [];
    for (let i = 1; i < shotData.shots.length; i++) {
      const delta = shotData.shots[i].timeMs - shotData.shots[i - 1].timeMs;
      allIntervals.push(delta);
      // If delta is less than 1.5s (meaning not interrupted by a long tactical/empty reload)
      if (delta < (w.specIntervalMs * 2.5 + 50)) {
        burstIntervals.push(delta);
      }
    }

    const meanBurst = burstIntervals.length > 0
      ? burstIntervals.reduce((a, b) => a + b, 0) / burstIntervals.length
      : 0;
    const minBurst = burstIntervals.length > 0 ? Math.min(...burstIntervals) : 0;
    const maxBurst = burstIntervals.length > 0 ? Math.max(...burstIntervals) : 0;

    cadenceResults[w.id] = {
      name: w.name,
      specRpm: w.specRpm,
      specIntervalMs: w.specIntervalMs,
      specFireMode: w.specFireMode,
      totalShotsFiredIn10s: shotData.shots.length,
      burstIntervalsCount: burstIntervals.length,
      meanIntervalMs: +meanBurst.toFixed(2),
      minIntervalMs: +minBurst.toFixed(2),
      maxIntervalMs: +maxBurst.toFixed(2),
      autofiresOnHold: shotData.shots.length > 1, // Proof of whether held fire continues shooting
      first5Shots: shotData.shots.slice(0, 5),
      pelletsLogged: shotData.pellets.length,
      samplePelletsForShotgun: w.id === 'shotgun' ? shotData.pellets.slice(0, 8) : [],
    };

    console.log(`  Total shots fired in 10s: ${shotData.shots.length}`);
    console.log(`  Autofires on hold: ${shotData.shots.length > 1 ? 'YES (bug on semi weapons!)' : 'NO'}`);
    console.log(`  Measured burst interval: mean = ${meanBurst.toFixed(2)} ms (spec: ${w.specIntervalMs} ms), min = ${minBurst.toFixed(2)} ms, max = ${maxBurst.toFixed(2)} ms`);
    if (w.id === 'shotgun') {
      console.log(`  Shotgun pellets logged: ${shotData.pellets.length} (expected 8 pellets per shot)`);
    }
  }

  // Save full cadence report to docs
  const outPath = path.resolve('docs/gunfeel_cadence_audit.json');
  fs.writeFileSync(outPath, JSON.stringify(cadenceResults, null, 2));
  console.log(`\nSaved raw cadence telemetry to: ${outPath}`);

  await browser.close();
  await server.close();
}

main().catch(console.error);
