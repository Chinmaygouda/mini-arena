// scripts/test-map-switch.mjs
// Map-switch regression test (A -> B -> C -> A, then hold fire)
// Runs in real Chrome via CDP.

async function main() {
  console.log('========================================================================');
  console.log(' MAP-SWITCH TEST: A (range) -> B (foundry) -> C (culdesac) -> A (range)');
  console.log('========================================================================\n');

  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const target = list.find(x => x.url.includes('localhost:5173'));
  if (!target) throw new Error('Tab not found');

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

  // 1. Initial Page Load (Map A: Range)
  console.log('[STEP 1] Loading Map A (Range)...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 1200));

  // Dismiss prompt
  const dismissRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#btn-engage');
      if (btn) {
        btn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Dismiss initial prompt:', dismissRes.result.value);
  await new Promise(r => setTimeout(r, 500));

  const mapSequence = [
    { name: 'Foundry Yard (Map B)', id: 'foundry' },
    { name: 'Cul-de-Sac (Map C)', id: 'culdesac' },
    { name: 'Shooting Range (Map A)', id: 'range' }
  ];

  for (const m of mapSequence) {
    console.log(`[STEP] Switching to ${m.name}...`);
    const switchRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          // Open map modal via toggleMapModal
          if (window.__fpsApp && !window.__fpsApp.hud.isMapModalOpen) {
            window.__fpsApp.hud.toggleMapModal();
          }
          await new Promise(r => setTimeout(r, 200));

          // Click map button
          const btn = document.querySelector('button[data-map-id="${m.id}"]');
          if (btn) {
            btn.click();
            return { found: true };
          }
          return { found: false };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log(`  Map modal button click (${m.id}):`, switchRes.result.value);
    await new Promise(r => setTimeout(r, 1500)); // allow map loading and reset
  }

  // Check state after map switches
  const stateCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('#btn-engage');
        let reDismissed = false;
        if (btn && btn.offsetParent !== null) {
          btn.click();
          reDismissed = true;
        }
        const hud = document.querySelector('#fps-hud');
        return {
          title: document.title,
          listeners: window.__listenerCounts,
          mapName: document.querySelector('#map-badge-name')?.textContent,
          reDismissed,
          inputBlocked: window.__fpsApp ? window.__fpsApp.inputBlocked : 'n/a'
        };
      })()
    `,
    returnByValue: true
  });
  console.log('\n[POST-SWITCH STATE CHECK]:', JSON.stringify(stateCheck.result.value, null, 2));

  // Equip AK-47 and reload
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'Digit1', key: '1' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Digit1', key: '1' });
  await new Promise(r => setTimeout(r, 300));

  // Reset telemetry log
  await send('Runtime.evaluate', {
    expression: `(() => { window.__shotTelemetry = []; })()`
  });

  // Hold LMB for 2 seconds
  console.log('\n[FIRING TEST] Holding left click on AK-47 for 2.0s post-switch...');
  const t0 = Date.now();
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 600,
    y: 400,
    button: 'left',
    buttons: 1,
    clickCount: 1
  });

  const postDownCheck = await send('Runtime.evaluate', {
    expression: `({
      counts: window.__listenerCounts,
      sched: window.__weaponManager?.schedulerState,
      appBlocked: window.__fpsApp?.inputBlocked,
      hudDismissed: window.__fpsApp?.hud?.isDismissed,
      isLocked: window.__fpsApp?.controls?.isLocked
    })`,
    returnByValue: true
  });
  console.log('Post-down state:', postDownCheck.result.value);

  await new Promise(r => setTimeout(r, 2000));

  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 600,
    y: 400,
    button: 'left',
    buttons: 0
  });
  const holdDur = (Date.now() - t0) / 1000;
  await new Promise(r => setTimeout(r, 200));

  // Fetch telemetry
  const teleRes = await send('Runtime.evaluate', {
    expression: `window.__shotTelemetry || []`,
    returnByValue: true
  });
  const shots = teleRes.result.value || [];

  console.log(`\n[RESULTS]:`);
  console.log(`Hold Duration: ${holdDur.toFixed(2)}s`);
  console.log(`Total Shots Fired: ${shots.length}`);
  if (shots.length > 0) {
    const firstT = shots[0].t;
    const lastT = shots[shots.length - 1].t;
    const dur = (lastT - firstT) / 1000;
    const sps = shots.length / dur;
    console.log(`Telemetry duration: ${dur.toFixed(3)}s`);
    console.log(`Cadence: ${sps.toFixed(2)} shots/sec (Target: 10 ± 1)`);
    console.log(`First 3 shots:\n`, JSON.stringify(shots.slice(0, 3), null, 2));
    console.log(`Last 3 shots:\n`, JSON.stringify(shots.slice(-3), null, 2));

    if (Math.abs(sps - 10) <= 1.0) {
      console.log('✅ PASS: Cadence remained stable at 10 shots/sec post-switch with no burst!');
    } else {
      console.error(`❌ FAIL: Cadence was ${sps.toFixed(2)} shots/sec (expected 10 ± 1)`);
      process.exitCode = 1;
    }
  } else {
    console.error('❌ FAIL: No shots were fired!');
    process.exitCode = 1;
  }

  ws.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
