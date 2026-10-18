// scripts/reproduce-real-chrome.mjs
// Reproduce real mouse hold in Chrome with and without CPU throttling
// Logs every shot with timestamps, ammo count, and calculates shots per second.

async function testHold(throttleRate = 1) {
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

  console.log(`\n========================================================================`);
  console.log(` TEST REAL MOUSE HOLD IN CHROME (CPU Throttling: ${throttleRate}x)`);
  console.log(`========================================================================`);

  await send('Page.bringToFront');
  // Navigate to fresh page
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise(r => setTimeout(r, 1500));

  // Set CPU throttling if requested
  if (throttleRate > 1) {
    await send('Emulation.setCPUThrottlingRate', { rate: throttleRate });
    console.log(`Enabled CPU throttling rate: ${throttleRate}x`);
  } else {
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }

  // Dismiss overlay by clicking #btn-engage
  const dismissResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('#btn-engage');
        if (btn) {
          btn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Dismiss overlay result:', dismissResult.result.value);
  await new Promise(r => setTimeout(r, 500));

  // Install real-time shot logger in page
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        window.__shots = [];
        let prevAmmo = null;
        let frameCount = 0;

        function record() {
          frameCount++;
          const hud = document.querySelector('#fps-hud');
          if (hud) {
            const big = hud.querySelector('[style*="font-size: 44px"]');
            if (big) {
              const ammo = parseInt(big.textContent.trim(), 10);
              if (!isNaN(ammo) && ammo !== prevAmmo) {
                window.__shots.push({
                  t: performance.now(),
                  ammo,
                  prevAmmo,
                  frame: frameCount
                });
                prevAmmo = ammo;
              }
            }
          }
          window.__rafId = requestAnimationFrame(record);
        }
        window.__rafId = requestAnimationFrame(record);
      })()
    `
  });

  console.log('Dispatching mousePressed (LMB) at center...');
  const holdStart = Date.now();
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 600,
    y: 400,
    button: 'left',
    buttons: 1,
    clickCount: 1
  });

  // Hold for 3 seconds
  await new Promise(r => setTimeout(r, 3000));

  console.log('Dispatching mouseReleased (LMB)...');
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 600,
    y: 400,
    button: 'left',
    buttons: 0
  });
  const holdDuration = (Date.now() - holdStart) / 1000;

  await new Promise(r => setTimeout(r, 300));

  // Fetch shot log
  const shotData = await send('Runtime.evaluate', {
    expression: `
      (() => {
        cancelAnimationFrame(window.__rafId);
        return {
          domShots: window.__shots,
          telemetry: window.__shotTelemetry || [],
          lastError: window.__lastShotError || null
        };
      })()
    `,
    returnByValue: true
  });

  // Reset throttling
  if (throttleRate > 1) {
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }

  ws.close();

  const res = shotData.result.value || { domShots: [], telemetry: [], lastError: null };
  const { domShots, telemetry, lastError } = res;
  if (lastError) {
    console.error(`CAUGHT ERROR IN EXECUTE SHOT:\n`, JSON.stringify(lastError, null, 2));
  }
  console.log(`Hold Duration: ${holdDuration.toFixed(2)}s`);
  console.log(`DOM Ammo Transitions Count: ${domShots.length}`);
  console.log(`WeaponManager Telemetry Shots Fired: ${telemetry.length}`);
  console.log(`First 5 Telemetry Shots:\n`, JSON.stringify(telemetry.slice(0, 5), null, 2));
  console.log(`Last 5 Telemetry Shots:\n`, JSON.stringify(telemetry.slice(-5), null, 2));

  if (telemetry.length > 1) {
    const firstT = telemetry[0].t;
    const lastT = telemetry[telemetry.length - 1].t;
    const dur = (lastT - firstT) / 1000;
    console.log(`Telemetry duration: ${dur.toFixed(3)}s`);
    console.log(`Telemetry fire rate: ${(telemetry.length / dur).toFixed(2)} shots/sec`);
    // Check intervals between consecutive telemetry shots
    const intervals = [];
    for (let i = 1; i < telemetry.length; i++) {
      intervals.push(telemetry[i].t - telemetry[i - 1].t);
    }
    console.log(`Shot intervals (ms): min=${Math.min(...intervals).toFixed(1)}, max=${Math.max(...intervals).toFixed(1)}, avg=${(intervals.reduce((a,b)=>a+b,0)/intervals.length).toFixed(1)}`);
  }
}

async function main() {
  // 1. Without CPU throttling (rate = 1)
  await testHold(1);

  // 2. With CPU throttling (rate = 4)
  await testHold(4);
}

main().catch(console.error);
