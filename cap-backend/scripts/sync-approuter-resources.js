'use strict';

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const frontendDistDir = path.join(rootDir, 'app', 'dist');
const approuterResourcesDir = path.join(rootDir, 'app', 'approuter', 'resources');

if (!fs.existsSync(frontendDistDir)) {
  throw new Error(`Frontend build output not found: ${frontendDistDir}`);
}

fs.rmSync(approuterResourcesDir, { recursive: true, force: true });
fs.mkdirSync(approuterResourcesDir, { recursive: true });
fs.cpSync(frontendDistDir, approuterResourcesDir, { recursive: true });
fs.writeFileSync(path.join(approuterResourcesDir, '.gitkeep'), '');

const assetsDir = path.join(approuterResourcesDir, 'assets');
if (fs.existsSync(assetsDir)) {
  fs.writeFileSync(path.join(assetsDir, '.gitkeep'), '');
}

console.log(`Synced frontend dist to ${path.relative(rootDir, approuterResourcesDir)}`);
