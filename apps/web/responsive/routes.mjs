// Builds the route list from the Next.js App Router folders (every page.tsx), never by hand.
// Usage: node responsive/routes.mjs   -> artifacts/routes.json
import fs from 'node:fs';
import path from 'node:path';
import { appDir, artifacts, ensureDir } from './lib/config.mjs';

const appRoot = path.join(appDir, 'src', 'app');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'page.tsx') out.push(p);
  }
  return out;
}

export function buildRoutes() {
  return walk(appRoot).map((file) => {
    const rel = path.relative(appRoot, path.dirname(file)).split(path.sep).filter(Boolean);
    const segments = rel.filter((s) => !/^\(.*\)$/.test(s)); // route groups do not appear in URLs
    const template = '/' + segments.join('/');
    const params = segments.filter((s) => /^\[.+\]$/.test(s)).map((s) => s.slice(1, -1));
    const area = segments[0] === 'dashboard' ? 'app' : 'public';
    return { template, params, area, file: path.relative(appDir, file).split(path.sep).join('/') };
  }).sort((a, b) => a.template.localeCompare(b.template));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\//, ''))) {
  ensureDir(artifacts);
  const routes = buildRoutes();
  fs.writeFileSync(path.join(artifacts, 'routes.json'), JSON.stringify(routes, null, 2));
  console.log(`${routes.length} routes (${routes.filter((r) => r.params.length).length} dynamic, ${routes.filter((r) => r.area === 'app').length} in the signed-in app)`);
}
