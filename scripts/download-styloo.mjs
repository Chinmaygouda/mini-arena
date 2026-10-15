import { chromium } from '@playwright/test';
import path from 'node:path';

async function downloadPack() {
  console.log('Launching Playwright Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  console.log('Navigating to Styloo pack page...');
  await page.goto('https://styloo.itch.io/guns-asset-pack', { waitUntil: 'domcontentloaded' });

  console.log('Clicking Download Now...');
  // The "Download Now" button or purchase link
  const buyBtn = page.locator('a.buy_btn, a[href*="purchase"]').first();
  await buyBtn.click();

  // Wait for the popup / direct download link
  console.log('Waiting for direct download link...');
  const directLink = page.locator('a.direct_download_btn');
  await directLink.waitFor({ timeout: 10000 });
  await directLink.click();

  console.log('Waiting for download button...');
  const dlBtn = page.locator('a.download_btn[data-upload_id]').first();
  await dlBtn.waitFor({ timeout: 10000 });

  console.log('Listening for download event...');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    dlBtn.click(),
  ]);

  const savePath = path.resolve('packages/client/public/models/Styloo_pack.zip');
  console.log('Saving download to:', savePath);
  await download.saveAs(savePath);
  console.log('Download complete!');
  await browser.close();
}

downloadPack().catch((err) => {
  console.error('Download error:', err);
  process.exit(1);
});
