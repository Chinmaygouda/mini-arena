import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const COMMITS = [
  { hash: 'deacc68', label: 'deacc68: modular weapons & proc kinematics' },
  { hash: 'b3a6113', label: 'b3a6113: first Styloo AK-47 & PSX arms slice' },
  { hash: 'a83c513', label: 'a83c513: pre-IK attachment review baseline' },
  { hash: 'daae153', label: 'daae153: hand attachment & pistol slice' },
  { hash: '1bccdec', label: '1bccdec: all 5 weapons verified' },
  { hash: 'e9053c5', label: 'e9053c5: master HEAD (before uncommitted curl)' },
];

const WEAPONS = [
  { key: 'ak', name: 'AK-47', slot: 0, keyName: 'Digit1' },
  { key: 'smg', name: 'SMG', slot: 2, keyName: 'Digit3' },
  { key: 'shotgun', name: 'Shotgun', slot: 3, keyName: 'Digit4' },
];

const OUT_DIR = path.resolve('docs/screenshots/audit');
fs.mkdirSync(OUT_DIR, { recursive: true });

function serveDir(dir, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const filePath = path.join(dir, reqPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.glb': 'model/gltf-binary',
        '.ogg': 'audio/ogg',
        '.wasm': 'application/wasm',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(port, () => resolve(server));
    server.on('error', reject);
  });
}

function cleanupWorktree() {
  try {
    if (fs.existsSync('scratch_worktree')) {
      execSync('powershell -Command "Remove-Item -Recurse -Force scratch_worktree"', { stdio: 'ignore' });
      execSync('git worktree prune', { stdio: 'ignore' });
    }
  } catch (e) {
    console.warn('Cleanup warning:', e.message);
  }
}

async function captureCommit(commit) {
  console.log(`\n======================================================`);
  console.log(`Processing commit: ${commit.hash} (${commit.label})`);
  console.log(`======================================================`);

  cleanupWorktree();

  console.log('-> Creating worktree...');
  execSync(`git worktree add scratch_worktree ${commit.hash} --detach`, { stdio: 'inherit' });

  console.log('-> Building client in worktree...');
  // Check if dependencies exist, if not install frozen
  execSync('cd scratch_worktree && pnpm install --frozen-lockfile && pnpm --filter @mini-arena/client build', {
    stdio: 'inherit',
  });

  const distDir = path.resolve('scratch_worktree/packages/client/dist');
  console.log(`-> Serving ${distDir} on port 5199...`);
  const server = await serveDir(distDir, 5199);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-angle=default',
      '--enable-dawn-features=allow_unsafe_apis',
    ],
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  console.log('-> Navigating to http://localhost:5199/?debug=1...');
  await page.goto('http://localhost:5199/?debug=1', { waitUntil: 'networkidle', timeout: 30000 });

  // Dismiss lock prompt if present
  try {
    const btn = page.locator('#enter-btn, #btn-enter-arena, button:has-text("ENTER")');
    if (await btn.isVisible({ timeout: 2000 })) {
      await btn.click({ force: true });
    } else {
      await page.mouse.click(640, 360);
    }
  } catch {
    // Ignore overlay click if already closed
  }
  await page.waitForTimeout(500);

  for (const w of WEAPONS) {
    console.log(`-> Capturing ${w.name} (slot ${w.slot})...`);
    // Press keyboard number
    await page.keyboard.press(w.keyName);

    // Also call testHook if available
    await page.evaluate((slot) => {
      if (window.__inputManager?.testHooks?.setWeaponSlot) {
        window.__inputManager.testHooks.setWeaponSlot(slot);
      }
    }, w.slot).catch(() => {});

    // Settle
    await page.waitForTimeout(1000);

    const outPath = path.join(OUT_DIR, `baseline_${commit.hash}_${w.key}.png`);
    await page.screenshot({ path: outPath });
    console.log(`   Saved: ${outPath}`);
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  cleanupWorktree();
}

async function composeContactSheet() {
  console.log('\n======================================================');
  console.log('Composing baseline contact sheet...');
  console.log('======================================================');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Prepare base64 images
  const gridData = [];
  for (const commit of COMMITS) {
    const row = { commit, weapons: [] };
    for (const w of WEAPONS) {
      const imgPath = path.join(OUT_DIR, `baseline_${commit.hash}_${w.key}.png`);
      let base64 = '';
      if (fs.existsSync(imgPath)) {
        base64 = 'data:image/png;base64,' + fs.readFileSync(imgPath).toString('base64');
      }
      row.weapons.push({ weapon: w, base64 });
    }
    gridData.push(row);
  }

  // HTML canvas renderer
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; background: #0f1117; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; color: #fff; }
        #container { display: flex; flex-direction: column; width: 1920px; }
      </style>
    </head>
    <body>
      <canvas id="c"></canvas>
      <script>
        window.gridData = ${JSON.stringify(gridData)};
      </script>
    </body>
    </html>
  `);

  await page.evaluate(async () => {
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');

    const numRows = window.gridData.length;
    const numCols = 3;

    const cellWidth = 600;
    const cellHeight = 338; // 16:9
    const labelHeight = 44;
    const headerHeight = 70;
    const padding = 20;

    const totalWidth = padding * 2 + numCols * cellWidth + (numCols - 1) * padding;
    const totalHeight = headerHeight + padding + numRows * (cellHeight + labelHeight + padding);

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    // Background
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Title Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('MINI ARENA — BASELINE CONTACT SHEET: HAND & WEAPON HIP POSES ACROSS COMMITS', padding, 40);

    ctx.fillStyle = '#8b949e';
    ctx.font = '16px monospace';
    ctx.fillText('Resolution: 1280x720 scaled to 600x338 | Captured in Chrome with WebGPU/WebGL2 at neutral hip rest pose', padding, 64);

    const loadImage = (src) => new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

    let yOffset = headerHeight + padding;

    for (let r = 0; r < numRows; r++) {
      const row = window.gridData[r];

      // Commit row banner
      ctx.fillStyle = '#161b22';
      ctx.fillRect(padding, yOffset, totalWidth - padding * 2, labelHeight);
      ctx.strokeStyle = '#30363d';
      ctx.strokeRect(padding, yOffset, totalWidth - padding * 2, labelHeight);

      ctx.fillStyle = '#58a6ff';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(row.commit.label, padding + 15, yOffset + 28);

      yOffset += labelHeight + 10;

      for (let c = 0; c < numCols; c++) {
        const item = row.weapons[c];
        const xOffset = padding + c * (cellWidth + padding);

        ctx.fillStyle = '#11141d';
        ctx.fillRect(xOffset, yOffset, cellWidth, cellHeight);
        ctx.strokeStyle = '#30363d';
        ctx.strokeRect(xOffset, yOffset, cellWidth, cellHeight);

        const img = await loadImage(item.base64);
        if (img) {
          ctx.drawImage(img, xOffset, yOffset, cellWidth, cellHeight);
        } else {
          ctx.fillStyle = '#ff7b72';
          ctx.font = '16px sans-serif';
          ctx.fillText('Image not available', xOffset + 20, yOffset + cellHeight / 2);
        }

        // Weapon label tag
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(xOffset + 10, yOffset + 10, 140, 26);
        ctx.fillStyle = '#f0f6fc';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(item.weapon.name, xOffset + 18, yOffset + 28);
      }

      yOffset += cellHeight + padding;
    }
  });

  const canvasHandle = await page.$('#c');
  const buffer = await canvasHandle.screenshot({ type: 'png' });
  const finalPath = path.join(OUT_DIR, 'baseline_contact_sheet.png');
  fs.writeFileSync(finalPath, buffer);
  console.log(`\nSuccessfully created contact sheet: ${finalPath}`);

  // Copy to artifacts dir
  const artifactDir = 'C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/76041f60-e72f-4e8d-a6ae-d518c8ee191a';
  fs.copyFileSync(finalPath, path.join(artifactDir, 'baseline_contact_sheet.png'));

  await browser.close();
}

async function main() {
  cleanupWorktree();
  for (const commit of COMMITS) {
    try {
      await captureCommit(commit);
    } catch (e) {
      console.error(`Error capturing ${commit.hash}:`, e);
      cleanupWorktree();
    }
  }
  await composeContactSheet();
  console.log('ALL DONE!');
}

main().catch(console.error);
