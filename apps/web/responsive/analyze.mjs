// Summarises a capture run's metrics into numbers for the audit report.
//   node responsive/analyze.mjs baseline  -> artifacts/baseline/summary.md
import fs from 'node:fs';
import path from 'node:path';
import { artifacts } from './lib/config.mjs';

const run = process.argv[2] ?? 'baseline';
const dir = path.join(artifacts, run);
const rawRows = fs.readdirSync(dir).filter((f) => f.startsWith('metrics-')).flatMap((f) =>
  fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => ({ pass: f.slice(8, -6), ...JSON.parse(l) })));

const seen = new Set(); const rows = rawRows.filter((r) => !seen.has(r.key) && seen.add(r.key));
const phone = (r) => parseInt(r.viewport, 10) < 700;
const by = (arr, fn) => arr.reduce((m, x) => ((m[fn(x)] ??= []).push(x), m), {});
const out = [];
const h = (t) => out.push(`\n## ${t}\n`);

out.push(`# Capture summary: ${run}\n\n${rows.length} captures.`);

const errors = rows.filter((r) => r.error);
const missing = rows.filter((r) => !r.error && r.status >= 400);
const redirected = rows.filter((r) => !r.error && r.redirected);
out.push(`\nCapture errors: ${errors.length}. HTTP >= 400: ${missing.length}. Redirected: ${redirected.length}.`);

h('Horizontal page overflow (document wider than the viewport)');
const ovf = rows.filter((r) => r.overflowX);
out.push(`${ovf.length} of ${rows.length} captures overflow.\n`);
out.push('| Viewport | Overflowing pages | Worst (px) |\n|---|---|---|');
for (const [vp, list] of Object.entries(by(ovf, (r) => r.viewport))) out.push(`| ${vp} | ${new Set(list.map((r) => r.template)).size} | ${Math.max(...list.map((r) => r.overflowPx))} |`);
out.push('\nPages overflowing at the most viewports:\n');
for (const [t, list] of Object.entries(by(ovf, (r) => r.template)).sort((a, b) => b[1].length - a[1].length).slice(0, 40)) {
  const w = list.reduce((a, b) => (b.overflowPx > a.overflowPx ? b : a));
  out.push(`- ${t}: ${list.length} viewports (narrowest ${list.map((r) => parseInt(r.viewport, 10)).sort((a, b) => a - b)[0]}px); worst +${w.overflowPx}px at ${w.viewport}; culprit ${w.offenders[0]?.el ?? '?'} "${w.offenders[0]?.text ?? ''}"`);
}

h('Most common overflow culprits');
const culprit = {};
for (const r of ovf) for (const o of r.offenders.slice(0, 2)) culprit[o.el] = (culprit[o.el] ?? 0) + 1;
for (const [k, n] of Object.entries(culprit).sort((a, b) => b[1] - a[1]).slice(0, 20)) out.push(`- ${k}: ${n}`);

h('Phones: inputs under 16px (iOS zooms on focus)');
const phones = rows.filter((r) => !r.error && phone(r) && r.inputs);
const si = phones.filter((r) => r.smallInputs);
out.push(`${si.length} of ${phones.length} phone captures with inputs have at least one input under 16px.`);
for (const [t, list] of Object.entries(by(si, (r) => r.template)).sort((a, b) => b[1].length - a[1].length).slice(0, 15)) out.push(`- ${t}: ${list[0].smallInputs} of ${list[0].inputs} inputs`);

h('Phones: tap targets under 44x44');
const st = rows.filter((r) => !r.error && phone(r) && r.smallTargets);
out.push(`${st.length} phone captures have undersized targets. Median share: ${Math.round(100 * (st.map((r) => r.smallTargets / r.interactive).sort()[Math.floor(st.length / 2)] ?? 0))}%.`);
const sample = {};
for (const r of st) for (const s of r.smallTargetSamples) { const k = s.replace(/ \d+x\d+.*/, ''); sample[k] = (sample[k] ?? 0) + 1; }
for (const [k, n] of Object.entries(sample).sort((a, b) => b[1] - a[1]).slice(0, 20)) out.push(`- ${k}: ${n}`);

h('Tables on phones');
const tbl = rows.filter((r) => !r.error && phone(r) && r.tables?.length);
const wide = tbl.filter((r) => r.tables.some((t) => t.cols >= 5));
out.push(`${tbl.length} phone captures contain a table; ${wide.length} have a table with 5 or more columns.`);
for (const [t, list] of Object.entries(by(wide, (r) => r.template)).slice(0, 40)) out.push(`- ${t}: ${list[0].tables.map((x) => `${x.cols} cols${x.scrolls ? ' (scrolls)' : ' (NOT in a scroll container)'}`).join(', ')}`);

h('Dialogs taller or wider than the viewport');
for (const r of rows.filter((x) => x.dialogOverflowsViewport)) out.push(`- ${r.template} ${r.viewport}`);

h('Images without width and height (layout shift risk)');
const img = rows.filter((r) => r.imagesNoSize && r.viewport === '390x844');
for (const r of img.slice(0, 20)) out.push(`- ${r.template}: ${r.imagesNoSize} of ${r.images}`);

h('Console errors and failed requests (excluding expected)');
const ce = rows.filter((r) => r.consoleErrors && r.viewport === '1440x900');
for (const r of ce.slice(0, 25)) out.push(`- ${r.template}: ${r.consoleErrors} (${(r.consoleSamples ?? [])[0] ?? ''})`);

h('Pages that redirected or returned errors (not reachable as this role)');
for (const [t, list] of Object.entries(by(redirected.concat(missing), (r) => r.role + ' ' + r.template)).slice(0, 80)) out.push(`- ${t} -> ${list[0].finalPath} (${list[0].status})`);

fs.writeFileSync(path.join(dir, 'summary.md'), out.join('\n'));
console.log(out.join('\n').slice(0, 6000));
