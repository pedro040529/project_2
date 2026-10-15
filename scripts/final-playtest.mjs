import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out = new URL('../docs/playtest/final/', import.meta.url);
fs.mkdirSync(out, {recursive:true});
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors=[]; page.on('pageerror', e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
const shot=async name=>page.screenshot({path:new URL(name+'.png',out).pathname});
const results={};
try {
await page.goto('http://127.0.0.1:5193/');
await page.locator('.lobby-card').waitFor();
await page.waitForTimeout(800); await shot('01-inicio');
assert.equal(await page.locator('.toggle-chip').count(),0);
results.testRoundDurations=[75,80,80];
await page.fill('.nickname-input','Pedro');
await page.getByRole('button',{name:'▶ Jugar'}).click();
await page.getByRole('button',{name:'Confirmar',exact:true}).click();
await page.getByRole('button',{name:'Empezar la partida'}).click();
for (let round=0;round<3;round++) {
 await page.getByRole('button',{name:'Listo',exact:true}).click();
 await page.locator('.hud-timer').waitFor({timeout:15000});
 assert.notEqual(await page.locator('.hud-timer').textContent(),'0:00');
 console.log('Round',round+1,'HUD visible');
 await page.waitForTimeout(1800);
 await shot('0'+(round+2)+'-juego');
 if(round===0){
  const before=await page.evaluate(()=>window.__nexoraDebug.getCameraYaw());
  await page.mouse.move(600,400); await page.mouse.move(850,440,{steps:10});
  await page.waitForTimeout(200);
  const after=await page.evaluate(()=>window.__nexoraDebug.getCameraYaw());
  assert.equal(before,after,'Apuntar no debe mover la cámara');
  await page.mouse.down({button:'right'}); await page.mouse.move(1050,460,{steps:10}); await page.mouse.up({button:'right'});
  await page.waitForTimeout(100);
  const dragged=await page.evaluate(()=>window.__nexoraDebug.getCameraYaw());
  assert.notEqual(after,dragged,'Arrastrar con botón derecho gira');
  results.camera={before,after,dragged};
  await page.keyboard.down('w'); await page.waitForTimeout(1200); await page.keyboard.up('w');
 }
 if(round===1){
  const first=await page.locator('.world-label').evaluateAll(es=>es.map(e=>e.dataset.instanceId));
  await page.waitForTimeout(3000);
  const second=await page.locator('.world-label').evaluateAll(es=>es.map(e=>e.dataset.instanceId));
  assert(first.every(id=>second.includes(id)),'Los NPCs deben dar tiempo para leer');
  results.initialMessageCount=first.length;
  const rects=await page.locator('.world-label').evaluateAll(es=>es.filter(e=>getComputedStyle(e).visibility==='visible'&&getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++) assert(!(rects[i].left<rects[j].right&&rects[i].right>rects[j].left&&rects[i].top<rects[j].bottom&&rects[i].bottom>rects[j].top),'Etiquetas superpuestas');
  results.visibleMessages=rects.length;
  assert(rects.length > 0, "Debe haber mensajes legibles desde el inicio");
  if(rects.length){const r=rects[0];await page.mouse.click((r.left+r.right)/2,(r.top+r.bottom)/2);await page.waitForTimeout(80);await shot('05-disparo');}
 }
 if(round===2){
   await page.locator('.decision-panel').waitFor();
   await page.keyboard.press('1'); await page.waitForTimeout(300); await page.keyboard.press('e');
 }
 await page.locator('.results-card .btn').waitFor({state:'visible',timeout:130000});
 results['round'+round]=await page.locator('.results-card').innerText();
 await page.locator('.results-card .btn').click();
}
await shot('06-ranking');
await page.getByRole('button',{name:'Ver tu resumen'}).click();
results.summary=await page.locator('.summary-card').innerText();await shot('07-resumen');
await page.getByRole('button',{name:'Jugar otra partida'}).click();
await page.locator('.roster-grid').waitFor();results.replay=true;
assert.deepEqual(errors,[]);
console.log('PASS',JSON.stringify(results));
} finally { fs.writeFileSync(new URL('report.json',out),JSON.stringify({...results,errors},null,2));await browser.close(); }
