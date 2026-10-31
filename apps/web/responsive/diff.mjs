// Visual diff: every "after" screenshot against its baseline twin.
//   node responsive/diff.mjs [--limit-compare 60]
// Writes artifacts/after/diff-report.md and side-by-side images (before | after) for the pages that changed most.
import fs from 'node:fs';
import path from 'node:path';
import { artifacts, loadPng, ensureDir } from './lib/config.mjs';

const { PNG } = loadPng();
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const compareLimit = Number(arg('limit-compare', 60));
const runName = arg('run', 'after');
const after = path.join(artifacts, runName);
const rows = fs.readdirSync(after).filter((f) => /^metrics-(admin|public)\.jsonl$/.test(f)).flatMap((f) =>
  fs.readFileSync(path.join(after, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse));
const seen = new Set();
const unique = rows.filter((r) => r.shot && !r.error && !seen.has(r.key) && seen.add(r.key));

const read = (p) => PNG.sync.read(fs.readFileSync(p));
const results = [];
for (const r of unique) {
  const a = path.join(artifacts, r.shot.replace(runName + '/', 'baseline/'));
  const b = path.join(artifacts, r.shot);
  if (a === b || !fs.existsSync(a) || !fs.existsSync(b)) { results.push({ ...r, status: 'no-baseline' }); continue; }
  const A = read(a), B = read(b);
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
  // From 1024px the sidebar is a fixed 288px column whose header changed on purpose; measure the page content beside it.
  const x0 = parseInt(r.viewport, 10) >= 1024 && r.template.startsWith('/dashboard') ? 288 : 0;
  let diff = 0;
  for (let y = 0; y < h; y++) {
    for (let x = x0; x < w; x++) {
      const i = (y * A.width + x) * 4, j = (y * B.width + x) * 4;
      const d = Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2]);
      if (d > 48) diff++;
    }
  }
  results.push({ ...r, status: 'compared', pct: (100 * diff) / ((w - x0) * h), baseH: A.height, afterH: B.height, baseW: A.width, afterW: B.width, a, b });
}

const compared = results.filter((r) => r.status === 'compared');
const width = (r) => parseInt(r.viewport, 10);
const klass = (r) => (r.pct < 0.1 && r.baseH === r.afterH ? 'identical' : r.pct < 2 && Math.abs(r.baseH - r.afterH) < 40 ? 'minor' : 'changed');
for (const r of compared) r.klass = klass(r);

const out = [];
out.push('# Visual diff: baseline vs ' + runName + '\n');
out.push('From 1024px the 288px sidebar is excluded from the percentage (its header changed on purpose), so the numbers describe the page content.\n');
out.push(`${compared.length} screenshot pairs compared (${results.length - compared.length} without a baseline twin).`);
out.push('"identical" = under 0.1% of pixels differ and same page height; "minor" = under 2% and height within 40px; otherwise "changed".\n');
out.push('| Viewport | Pairs | Identical | Minor | Changed |\n|---|---|---|---|---|');
for (const vp of [...new Set(compared.map((r) => r.viewport))].sort((x, y) => parseInt(x) - parseInt(y))) {
  const l = compared.filter((r) => r.viewport === vp);
  out.push(`| ${vp} | ${l.length} | ${l.filter((r) => r.klass === 'identical').length} | ${l.filter((r) => r.klass === 'minor').length} | ${l.filter((r) => r.klass === 'changed').length} |`);
}
const section = (title, list) => {
  out.push(`\n## ${title}\n`);
  if (!list.length) return out.push('None.');
  out.push('| Role | Route | Viewport | % pixels | Height before > after |\n|---|---|---|---|---|');
  for (const r of list) out.push(`| ${r.role} | ${r.template} | ${r.viewport} | ${r.pct.toFixed(1)} | ${r.baseH} > ${r.afterH} |`);
};
section('Desktop (1440px) pages that changed', compared.filter((r) => width(r) >= 1280 && r.klass === 'changed').sort((x, y) => y.pct - x.pct));
section('Desktop (1440px) pages with minor differences', compared.filter((r) => width(r) >= 1280 && r.klass === 'minor').sort((x, y) => y.pct - x.pct).slice(0, 40));
section('Phone and tablet pages that changed most (top 60)', compared.filter((r) => width(r) < 1280 && r.klass === 'changed').sort((x, y) => y.pct - x.pct).slice(0, 60));
fs.writeFileSync(path.join(after, 'diff-report.md'), out.join('\n'));

// Side-by-side images for the biggest changes.
const sideDir = ensureDir(path.join(after, 'compare'));
const pick = [...compared.filter((r) => width(r) < 1280 && r.klass === 'changed').sort((x, y) => y.pct - x.pct).slice(0, compareLimit), ...compared.filter((r) => width(r) >= 1280 && r.klass === 'changed')];
// --pick "/dashboard@390x844,/pricing@320x568": also write these pages' side-by-side images, changed or not.
for (const spec of arg('pick', '').split(',').filter(Boolean)) {
  const [template, viewport] = spec.split('@');
  const hit = compared.find((r) => r.template === template && r.viewport === viewport);
  if (hit && !pick.includes(hit)) pick.push(hit);
}
for (const r of pick) {
  const A = read(r.a), B = read(r.b);
  const gap = 24, H = Math.min(Math.max(A.height, B.height), 2600);
  const out2 = new PNG({ width: A.width + gap + B.width, height: H });
  out2.data.fill(128);
  PNG.bitblt(A, out2, 0, 0, A.width, Math.min(A.height, H), 0, 0);
  PNG.bitblt(B, out2, 0, 0, B.width, Math.min(B.height, H), A.width + gap, 0);
  fs.writeFileSync(path.join(sideDir, `${r.viewport}-${r.template.replace(/[\/\[\]]+/g, '_')}.png`), PNG.sync.write(out2));
}
console.log(out.slice(0, 12).join('\n'));
console.log(`\nreport: ${path.join(after, 'diff-report.md')}  |  ${pick.length} side-by-side images in ${sideDir}`);
