// scripts/test-soundtest-page.mjs
async function main() {
  const cdpRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await cdpRes.json();
  const pageTarget = targets.find(t => t.type === 'page' && !t.url.startsWith('chrome-error://'));
  if (!pageTarget) {
    console.error('No page target found');
    process.exit(1);
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  await new Promise(r => ws.addEventListener('open', r));

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send('Runtime.enable');
  await send('Page.enable');

  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('BROWSER CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('BROWSER EXCEPTION:', JSON.stringify(msg.params.exceptionDetails));
    }
  });

  console.log('Navigating to http://localhost:5173/?soundtest=1...');
  await send('Page.navigate', { url: 'http://localhost:5173/?soundtest=1' });
  await new Promise(r => setTimeout(r, 3000));

  // Check if sound test modal exists in DOM
  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.getElementById('soundtest-overlay');
        const buttons = modal ? modal.querySelectorAll('button').length : 0;
        const audios = modal ? modal.querySelectorAll('audio').length : 0;
        return {
          hasModal: !!modal,
          display: modal ? window.getComputedStyle(modal).display : null,
          title: modal ? modal.querySelector('h1')?.innerText : null,
          buttonsCount: buttons,
          audioElementsCount: audios
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Sound test modal status:', JSON.stringify(evalRes.result.value, null, 2));

  // Take a screenshot
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('fs');
  fs.writeFileSync('C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/5618d13b-17a0-4ad6-8787-4ecd7ffd8f73/soundtest_page.png', Buffer.from(screenshotRes.data, 'base64'));
  console.log('Screenshot saved to soundtest_page.png');

  ws.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
