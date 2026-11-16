import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { TIERS } from '../src/harbour/settings.js';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const source = readFileSync('index.html', 'utf8');
const featureStatus = JSON.parse(readFileSync('docs/FEATURE-STATUS.json','utf8'));
assert.equal(featureStatus.mainline,'saint-aldric-harbour');
const ids = new Set();
for (const f of featureStatus.features) {
  assert.ok(f.id && !ids.has(f.id),`Duplicate or absent feature id ${f.id}`); ids.add(f.id);
  assert.ok(['implemented','partial','planned'].includes(f.status),f.id);
  assert.ok(f.verification && Array.isArray(f.paths) && Array.isArray(f.pr),f.id);
  if (f.status==='implemented') assert.ok(f.paths.length && f.pr.length, f.id);
  for (const p of f.paths) assert.ok(existsSync(p),`${f.id}: missing ${p}`);
}
assert.match(source, /src="\/src\/harbour\/main\.js"/);
assert.doesNotMatch(source, /\/src\/game\/|HALOFLUX|fonts\.googleapis/);
const js = readdirSync('src/harbour').filter(p => p.endsWith('.js'));
assert.equal(js.length, 30, 'Update the reviewed module manifest when adding/removing modules');
for (const p of js) execFileSync(process.execPath, ['--check', `src/harbour/${p}`], { stdio: 'pipe' });
const settings = readFileSync('src/harbour/settings.js', 'utf8');
for (const tier of ['low', 'med', 'high', 'ultra']) assert.match(settings, new RegExp(`${tier}:`));
assert.deepEqual([TIERS.low.minSide, TIERS.low.maxSide], [720,1080]);
for (const tier of ['med','high','ultra']) assert.deepEqual([TIERS[tier].minSide,TIERS[tier].maxSide], [1080,1440]);
if (process.argv.includes('--artifact')) {
  assert.deepEqual(readdirSync('dist'), ['index.html'], 'Deployment contains only the standalone game');
  const html = readFileSync('dist/index.html', 'utf8');
  assert.match(html, /name="pixel-games-mainline" content="saint-aldric"/);
  const commit = html.match(/name="pixel-games-build" content="([a-f0-9]{40})"/)?.[1];
  assert.ok(commit, 'Build must contain an immutable source commit');
  if (process.env.GITHUB_SHA) assert.equal(commit, process.env.GITHUB_SHA);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=|<link\b[^>]*href=|<img\b[^>]*src=/);
  assert.doesNotMatch(html, /@import\s|url\(\s*["']?https?:|import\s*\(\s*["']https?:/);
  const size = statSync('dist/index.html').size;
  assert.ok(size < 3 * 1024 * 1024, `Standalone HTML exceeds 3 MiB budget: ${size}`);
  console.log(JSON.stringify({ mainline: 'saint-aldric', commit, htmlBytes: size, externalAssets: 0 }));
}
console.log(`Saint Aldric source contract: ${js.length} JavaScript modules checked (syntax, not TypeScript coverage)`);
