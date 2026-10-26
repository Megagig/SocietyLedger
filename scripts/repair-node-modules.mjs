// Repairs the "Cannot find module 'graceful-fs'" / "next/dist/pages/_app" family of errors.
//
// On this machine, package folders inside node_modules/.pnpm sometimes end up EMPTY (the folder is there, its files are gone), which
// breaks Metro (expo start) and Next (next dev). This removes every empty package folder and reinstalls from the lockfile, which puts
// exactly the locked versions back. It changes no source files and no versions.
//
//   pnpm repair:deps          fix it
//   pnpm repair:deps --check  only report (exit code 1 if anything is empty)
//
// Stop any running dev servers first (expo start, next dev): they hold files open.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = path.join(root, 'node_modules', '.pnpm');
const checkOnly = process.argv.includes('--check');

const isEmptyRealDir = (dir) => {
  try {
    return !fs.lstatSync(dir).isSymbolicLink() && fs.readdirSync(dir).length === 0;
  } catch {
    return false;
  }
};

function findEmpty() {
  const found = [];
  if (!fs.existsSync(store)) return found;
  for (const entry of fs.readdirSync(store)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const modules = path.join(store, entry, 'node_modules');
    let packages = [];
    try {
      packages = fs.readdirSync(modules);
    } catch {
      continue;
    }
    for (const name of packages) {
      const dir = path.join(modules, name);
      let stat;
      try {
        stat = fs.lstatSync(dir);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) continue;
      const candidates = name.startsWith('@') ? fs.readdirSync(dir).map((s) => path.join(dir, s)) : [dir];
      for (const candidate of candidates) if (isEmptyRealDir(candidate)) found.push(candidate);
    }
  }
  return found;
}

const empty = findEmpty();
console.log(`${empty.length} empty package folder(s) found.`);
for (const dir of empty.slice(0, 40)) console.log('  ' + path.relative(store, dir));

if (checkOnly) process.exit(empty.length === 0 ? 0 : 1);
if (empty.length === 0) {
  console.log('Nothing to repair.');
  process.exit(0);
}

for (const dir of empty) fs.rmdirSync(dir);
console.log('Removed them. Reinstalling from the lockfile...');
const result = spawnSync('pnpm', ['install', '--frozen-lockfile'], { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, CI: 'true' } });
if (result.status !== 0) process.exit(result.status ?? 1);

const left = findEmpty();
console.log(left.length === 0 ? 'Repaired.' : `${left.length} folder(s) are still empty. Stop dev servers and run this again.`);
process.exit(left.length === 0 ? 0 : 1);
