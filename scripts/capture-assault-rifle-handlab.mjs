import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('docs/hand_system/captures/assault_rifle');await mkdir(out,{recursive:true});
const url=process.env.HANDLAB_URL??'http://127.0.0.1:5173/?handlab=1&forceWebGL=1';
const browser=await chromium.launch({headless:process.env.HEADLESS!=='0'});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(url,{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>Boolean(window.__viewmodel?.currentVisualDef?.weaponId==='assault_rifle'),{timeout:60000});
 await page.waitForTimeout(1000);await page.screenshot({path:path.join(out,'01_hip.png')});
 await page.getByRole('button',{name:'ADS'}).click();await page.waitForTimeout(250);await page.screenshot({path:path.join(out,'02_ads.png')});
 await page.getByRole('button',{name:'Side'}).click();await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'03_side.png')});
 await page.getByRole('button',{name:'FPS'}).click();await page.getByRole('button',{name:'Tactical reload'}).click();await page.waitForTimeout(700);await page.screenshot({path:path.join(out,'04_reload_mid.png')});
 await page.waitForTimeout(1500);await page.screenshot({path:path.join(out,'05_reload_end.png')});
 if(errors.length)throw new Error('Browser errors: '+errors.join('; '));
 console.log('Screenshots captured in '+out);
} finally {
 const video=page.video();await context.close();if(video)await video.saveAs(path.join(out,'assault_rifle_handlab.webm'));await browser.close();
}
