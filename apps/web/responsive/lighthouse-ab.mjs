// Side-by-side Lighthouse: the original build vs the current build, alternating runs in a fresh browser each time (so cache state cannot
// favour either), mobile and desktop, public pages only. Prints medians. Local runs are noisy; medians of several runs are not.
//   LH_DIR=<folder with lighthouse> A_URL=http://localhost:3102 B_URL=http://localhost:3100 RUNS=5 node responsive/lighthouse-ab.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { artifacts, loadPlaywright, ensureDir } from './lib/config.mjs';

const lhDir = process.env.LH_DIR;
const A = process.env.A_URL ?? 'http://localhost:3102';
const B = process.env.B_URL ?? 'http://localhost:3100';
const runs = Number(process.env.RUNS ?? 5);
const pages = (process.env.PAGES ?? '/,/pricing,/auth/login').split(',');
const modes = (process.env.MODES ?? 'mobile,desktop').split(',');
const lhUrl = (rel) => pathToFileURL(path.join(lhDir, 'node_modules', 'lighthouse', rel)).href;
const { default: lighthouse } = await import(lhUrl('core/index.js'));
const { default: desktopConfig } = await import(lhUrl('core/config/desktop-config.js'));
const { chromium } = loadPlaywright();
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

const results = {};
let port = 9400;
for (const p of pages) for (const mode of modes) for (let i = 0; i < runs; i++) {
  for (const [label, base] of [['original', A], ['current', B]]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lhab-'));
    const thisPort = port++;
    const ctx = await chromium.launchPersistentContext(dir, { headless: true, args: [`--remote-debugging-port=${thisPort}`] });
    try {
      const r = await lighthouse(base + p, { port: thisPort, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility'] }, mode === 'desktop' ? desktopConfig : undefined);
      if (r.lhr.runtimeError) continue;
      const a = r.lhr.audits;
      const k = `${p} ${mode} ${label}`;
      (results[k] ??= []).push({ perf: Math.round(r.lhr.categories.performance.score * 100), a11y: Math.round(r.lhr.categories.accessibility.score * 100), lcp: a['largest-contentful-paint'].numericValue, cls: a['cumulative-layout-shift'].numericValue, tbt: a['total-blocking-time'].numericValue });
    } catch (e) { console.log('run failed', p, mode, label, String(e.message).slice(0, 80)); }
    await ctx.close();
  }
}
const out = [];
for (const p of pages) for (const mode of modes) {
  const row = (label) => {
    const l = results[`${p} ${mode} ${label}`] ?? [];
    return { n: l.length, perf: median(l.map((x) => x.perf)), a11y: median(l.map((x) => x.a11y)), lcp: Math.round(median(l.map((x) => x.lcp))), cls: Number(median(l.map((x) => x.cls)).toFixed(3)), tbt: Math.round(median(l.map((x) => x.tbt))) };
  };
  const o = row('original'), c = row('current');
  out.push({ page: p, mode, original: o, current: c });
  console.log(`${p.padEnd(12)} ${mode.padEnd(8)} perf ${o.perf} -> ${c.perf} | a11y ${o.a11y} -> ${c.a11y} | LCP ${o.lcp} -> ${c.lcp} ms | CLS ${o.cls} -> ${c.cls} | TBT ${o.tbt} -> ${c.tbt} ms  (n=${o.n}/${c.n})`);
}
fs.writeFileSync(path.join(ensureDir(path.join(artifacts, 'after')), 'lighthouse-ab.json'), JSON.stringify(out, null, 2));
