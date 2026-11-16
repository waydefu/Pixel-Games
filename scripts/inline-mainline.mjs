import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve('dist');
let html = readFileSync(resolve(dir, 'index.html'), 'utf8');
const refs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
if (refs.length !== 1) throw new Error(`Expected one bundled script, got ${refs.length}`);
const script = resolve(dir, refs[0][1]);
if (!script.startsWith(dir + '/') && !script.startsWith(dir + '\\')) throw new Error('Script outside dist');
let js = readFileSync(script, 'utf8');
// A literal closing tag inside JS must not terminate the enclosing HTML script.
js = js.replace(/<\/script/gi, '<\\/script');
html = html.replace(refs[0][0], () => `<script type="module">${js}</script>`);
for (const m of [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]) {
  const href = m[0].match(/href="([^"]+)"/)?.[1];
  if (!href || /^(?:https?:)?\/\//.test(href)) throw new Error('External stylesheet');
  const css = readFileSync(resolve(dir, href), 'utf8');
  html = html.replace(m[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
}
if (/<script\b[^>]*\bsrc=|<link\b[^>]*href=|<img\b[^>]*src=/.test(html)) throw new Error('Unbundled asset');
writeFileSync(resolve(dir, 'index.html'), html);
for (const name of readdirSync(dir)) if (name !== 'index.html') rmSync(resolve(dir, name), { recursive: true });
console.log(`Standalone dist/index.html: ${Buffer.byteLength(html)} bytes`);
