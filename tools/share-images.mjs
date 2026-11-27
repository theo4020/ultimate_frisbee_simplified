// images d'aperçu des liens partagés du défi du jour : une par suite de 4 notes (🟩 g, 🟨 y, 🟥 r), soit 81 images
// usage : node tools/share-images.mjs  (écrit icons/share/<gyrr>.jpg ; le worker les choisit d'après ?r=)
import { createRequire } from 'module'; import { readFileSync } from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const bg = 'data:image/jpeg;base64,' + readFileSync(new URL('../icons/share.jpg', import.meta.url)).toString('base64');
const COL = { g: '#22c55e', y: '#facc15', r: '#ef4444' };
const page = code => `<html><body style="margin:0;width:1200px;height:630px;font-family:'DejaVu Sans',sans-serif;color:#fff;overflow:hidden;
  background:#0f1c24"><div style="position:absolute;inset:-20px;background:url(${bg}) 0 0/1240px 670px;filter:blur(10px) brightness(.5) saturate(1.2)"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(rgba(10,20,30,0),rgba(10,20,30,.55))"></div>
  <div style="position:absolute;left:64px;top:50px;font-size:44px;font-weight:800;letter-spacing:1px;text-shadow:0 3px 8px #000">ULTIMATE FRISBEE</div>
  <div style="position:absolute;left:64px;top:110px;font-size:36px;font-weight:700;color:#facc15;text-shadow:0 3px 8px #000">Le défi du jour</div>
  <div style="position:absolute;left:64px;top:210px;display:flex;gap:30px">${[...code].map(c => `<div style="width:190px;height:190px;border-radius:30px;background:${COL[c]};box-shadow:0 10px 30px rgba(0,0,0,.55),inset 0 -10px 0 rgba(0,0,0,.18)"></div>`).join('')}</div>
  <div style="position:absolute;left:64px;top:470px;font-size:46px;font-weight:800;text-shadow:0 3px 8px #000">À toi : fais-tu mieux ?</div>
  <div style="position:absolute;left:64px;top:540px;font-size:28px;text-shadow:0 2px 6px #000;opacity:.92">Le même défi pour tout le monde · un essai par jour</div></body></html>`;
const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
const all = []; for (const a of 'gyr') for (const c of 'gyr') for (const d of 'gyr') for (const e of 'gyr') all.push(a + c + d + e);
for (const code of all) { await pg.setContent(page(code)); await pg.screenshot({ path: new URL(`../icons/share/${code}.jpg`, import.meta.url).pathname, type: 'jpeg', quality: 72 }); }
await b.close(); console.log(all.length, 'images');
