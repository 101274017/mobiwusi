// Build the Windows deployment payload (web build + backend sources + deploy scripts) and
// write it as a single ZIP that infra/windows/tools/deploy-windows.mjs pushes to the host
// through ECS SendFile chunks.
//
// Usage: node infra/windows/tools/package-payload.mjs [--out <zip>] [--json]

import fs from 'node:fs';
import path from 'node:path';
import { createZip } from './zip-writer.mjs';

const root = path.resolve(import.meta.dirname, '..', '..', '..');

function readGitCommit() {
  try {
    const head = fs.readFileSync(path.join(root, '.git', 'HEAD'), 'utf8').trim();
    if (head.startsWith('ref: ')) {
      const refPath = path.join(root, '.git', head.slice(5).trim());
      if (fs.existsSync(refPath)) return fs.readFileSync(refPath, 'utf8').trim();
      const packed = path.join(root, '.git', 'packed-refs');
      if (fs.existsSync(packed)) {
        for (const line of fs.readFileSync(packed, 'utf8').split(/\r?\n/)) {
          const [sha, name] = line.split(' ');
          if (name === head.slice(5).trim()) return sha;
        }
      }
      return 'unknown';
    }
    return head;
  } catch {
    return 'unknown';
  }
}

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else if (entry.isFile()) out.push({ full, relative: path.relative(base, full).replace(/\\/g, '/') });
  }
  return out;
}

function requireDir(p, label) {
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
    throw new Error(`${label} missing: ${p}`);
  }
}

export function buildPayload({ out } = {}) {
  const distDir = path.join(root, 'apps', 'web', 'dist');
  requireDir(distDir, 'web build output (run pnpm --filter @nuanban/web build)');
  for (const required of ['index.html', 'assets', 'models']) {
    if (!fs.existsSync(path.join(distDir, required))) {
      throw new Error(`web build output is incomplete, missing ${required} in ${distDir}`);
    }
  }

  const entries = [];
  const addTree = (sourceDir, prefix) => {
    for (const file of walk(sourceDir)) {
      entries.push({ name: `${prefix}/${file.relative}`, data: fs.readFileSync(file.full) });
    }
  };
  const addFile = (sourcePath, name) => {
    if (!fs.existsSync(sourcePath)) throw new Error(`missing file: ${sourcePath}`);
    entries.push({ name, data: fs.readFileSync(sourcePath) });
  };

  // 1. static site
  addTree(distDir, 'web');
  // dist/web.config is a manual copy and may be stale; the deploy script owns that file.
  for (const entry of entries) {
    if (entry.name === 'web/web.config') entry.data = Buffer.from('<!-- replaced by deploy-server.ps1 -->\n');
  }

  // 2. backend sources (server imports packages through relative paths, so keep the layout)
  addTree(path.join(root, 'apps', 'server', 'src'), 'app/apps/server/src');
  addFile(path.join(root, 'apps', 'server', 'package.json'), 'app/apps/server/package.json');
  const packagesDir = path.join(root, 'packages');
  for (const pkg of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const srcDir = path.join(packagesDir, pkg.name, 'src');
    if (!fs.existsSync(srcDir)) continue;
    addTree(srcDir, `app/packages/${pkg.name}/src`);
  }

  // 3. IIS configuration variants (the deploy script picks one)
  addFile(path.join(root, 'infra', 'iis', 'web.config'), 'config/web.config.base');
  addFile(path.join(root, 'infra', 'iis', 'web.config.proxy'), 'config/web.config.proxy');

  // 4. on-host scripts
  addFile(path.join(root, 'infra', 'windows', 'deploy-server.ps1'), 'scripts/deploy-server.ps1');
  addFile(path.join(root, 'infra', 'windows', 'start-server.ps1'), 'scripts/start-server.ps1');

  // 5. manifest
  const manifest = {
    product: '微光指引 (nuanban)',
    gitCommit: readGitCommit(),
    builtAt: new Date().toISOString(),
    node: process.version,
    entries: entries.length,
    webAssets: walk(distDir).map((f) => f.relative),
  };
  entries.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') });

  const zip = createZip(entries);
  const target = out
    ? path.resolve(out)
    : path.join(root, '.cache', 'windows-release', 'nuanban-payload.zip');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, zip);

  return {
    zipPath: target,
    bytes: zip.length,
    files: entries.length,
    manifest,
    webBytes: entries
      .filter((e) => e.name.startsWith('web/'))
      .reduce((total, e) => total + e.data.length, 0),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const outIndex = process.argv.indexOf('--out');
  const result = buildPayload({ out: outIndex > 0 ? process.argv[outIndex + 1] : undefined });
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ zipPath: result.zipPath, bytes: result.bytes, files: result.files, manifest: result.manifest }, null, 2));
  } else {
    console.log(`payload: ${result.zipPath}`);
    console.log(`files: ${result.files}, zip bytes: ${result.bytes}, web bytes: ${result.webBytes}`);
    console.log(`commit: ${result.manifest.gitCommit}, built: ${result.manifest.builtAt}`);
  }
}
