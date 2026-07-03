'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');

const targets = [
  'app/dist',
  'app/approuter/resources',
  'gen',
  '.temp_mtar',
  'mta_archives',
  '.mta',
  'coverage',
  '.nyc_output',
  '.cds-build',
  '.build',
  'db/performance.db',
  'db/performance.db-journal',
  'db/performance.db-wal',
  'db/performance.db-shm',
  'approuter-logs.txt',
  'logs.txt',
  'recent_logs.txt',
  'recent_logs2.txt',
  'router_logs.txt',
  'default-env.json',
  'Makefile_*.mta',
];

const repoTargets = [
  'db.sqlite',
  'db.sqlite-journal',
  'db.sqlite-wal',
  'db.sqlite-shm',
];

function removePattern(base, pattern) {
  if (!pattern.includes('*')) {
    removePath(path.join(base, pattern));
    return;
  }

  const dir = path.dirname(pattern);
  const filePattern = path.basename(pattern)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${filePattern}$`);
  const absoluteDir = path.join(base, dir);
  if (!fs.existsSync(absoluteDir)) return;

  for (const entry of fs.readdirSync(absoluteDir)) {
    if (regex.test(entry)) removePath(path.join(absoluteDir, entry));
  }
}

function removePath(target) {
  const absolute = path.resolve(target);
  if (!absolute.startsWith(repoRoot + path.sep) && absolute !== repoRoot) {
    throw new Error(`Refusing to remove path outside repository: ${absolute}`);
  }
  if (!fs.existsSync(absolute)) return;
  fs.rmSync(absolute, { recursive: true, force: true });
  console.log(`removed ${path.relative(repoRoot, absolute)}`);
}

for (const target of targets) removePattern(root, target);
for (const target of repoTargets) removePattern(repoRoot, target);

const resourcesDir = path.join(root, 'app', 'approuter', 'resources');
const assetsDir = path.join(resourcesDir, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(resourcesDir, '.gitkeep'), '');
fs.writeFileSync(path.join(assetsDir, '.gitkeep'), '');
