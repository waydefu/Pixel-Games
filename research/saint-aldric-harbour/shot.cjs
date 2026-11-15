// usage (needs playwright + Chromium; SwiftShader): node shot.cjs <html> <out.png> [query] [w] [h] [timeoutSec]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [html, out, query = '', w = 1280, h = 720, to = 240, ev = '', waitMs = 3000] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const logs = [];
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /^\[/.test(t)) logs.push(m.type() + ': ' + t.slice(0, /ERROR/.test(t) ? 2500 : 400)); });
  p.on('pageerror', e => logs.push('PAGEERR ' + e.message.slice(0, 400)));
  const t0 = Date.now();
  await p.goto('file://' + path.resolve(html) + (query ? '?' + query : ''));
  try { await p.waitForFunction(() => window.__ready === true || window.__failed, null, { timeout: +to * 1000 }); } catch (e) { logs.push('TIMEOUT waiting for __ready'); }
  if (ev) { const r = await p.evaluate(ev); if (r !== undefined) logs.push('eval: ' + JSON.stringify(r).slice(0, 4000)); await p.waitForTimeout(+waitMs); }
  const info = await p.evaluate(() => window.__info || null);
  const cdp = await p.context().newCDPSession(p);
  const cap = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(out, Buffer.from(cap.data, 'base64'));
  console.log('ready in', ((Date.now() - t0) / 1000).toFixed(1) + 's', info ? JSON.stringify(info) : '');
  for (const l of [...new Set(logs)].slice(0, 25)) console.log(l);
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
