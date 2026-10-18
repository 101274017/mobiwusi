import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const lab = path.join(root, 'apps/desktop/native-lab');
const evidence = path.join(root, 'docs/implementation/evidence');
const desktop = JSON.parse(readFileSync(path.join(root, 'apps/desktop/package.json'), 'utf8'));
const version = desktop.devDependencies.electron;
if (process.platform !== 'win32' || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('This C02 sample requires Windows and a locked Electron version.');
const executable = [path.join(root, 'apps/desktop/node_modules/electron/dist/electron.exe'), path.join(root, `node_modules/.pnpm/electron@${version}/node_modules/electron/dist/electron.exe`)].find(existsSync);
if (!executable) throw new Error('The locked local Electron runtime is unavailable. No download was attempted.');
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const versionResult = spawnSync(executable, ['--version'], { windowsHide: true, env: environment, encoding: 'utf8', timeout: 15_000 });
if (versionResult.status !== 0 || versionResult.stdout.trim() !== `v${version}`) throw new Error('Local Electron version differs from the lock.');
mkdirSync(evidence, { recursive: true });
mkdirSync(path.join(evidence, 'screenshots'), { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = readdirSync(lab, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name).sort();
const sourceHashes = Object.fromEntries(sourceFiles.map(name => [name, sha(readFileSync(path.join(lab, name)))]));

if (process.argv.includes('--package')) {
  const archive = path.join(root, `.cache/electron/electron-v${version}-win32-x64.zip`);
  if (!existsSync(archive)) throw new Error('Pinned offline ZIP missing. Run the existing desktop:package preparation first.');
  const output = path.resolve(lab, 'out');
  if (path.dirname(output) !== lab || !output.startsWith(root + path.sep)) throw new Error('Package output must remain within this workspace.');
  const { packager } = await import('@electron/packager');
  const directories = await packager({ dir: lab, out: output, name: 'NuanbanC02Lab', executableName: 'nuanban-c02-lab', electronVersion: version, electronZipDir: path.dirname(archive), platform: 'win32', arch: 'x64', overwrite: true, asar: true, prune: false, ignore: [/^\/out(?:\/|$)/, /^\/node_modules(?:\/|$)/] });
  if (directories.length !== 1) throw new Error('Expected exactly one Windows x64 lab package.');
  const require = createRequire(import.meta.url);
  const asar = require('@electron/asar');
  const asarPath = path.join(directories[0], 'resources/app.asar');
  const packagedFiles = asar.listPackage(asarPath).map(file => file.replace(/^[/\\]+/, '').replaceAll('\\', '/')).filter(file => !asar.statFile(asarPath, file).files).sort();
  if (JSON.stringify(packagedFiles) !== JSON.stringify(sourceFiles)) throw new Error('Packaged lab file set differs from current source.');
  const packagedManifest = JSON.parse(asar.extractFile(asarPath, 'package.json').toString('utf8'));
  const expectedManifest = JSON.parse(readFileSync(path.join(lab, 'package.json'), 'utf8'));
  for (const key of ['name', 'version', 'description', 'main']) if (packagedManifest[key] !== expectedManifest[key]) throw new Error(`Packaged manifest differs: ${key}`);
  for (const file of packagedFiles.filter(file => file !== 'package.json')) if (sha(asar.extractFile(asarPath, file)) !== sourceHashes[file]) throw new Error(`Packaged lab source differs: ${file}`);
  const binary = path.join(directories[0], 'nuanban-c02-lab.exe');
  const report = { generatedAt: new Date().toISOString(), generatedTimeZone: 'Asia/Shanghai', scope: 'C02 independent Windows native-lab package preflight', platform: 'win32-x64', electron: version, signedProductionRelease: false, sourceSha256: sourceHashes, filesCompared: packagedFiles.length, packageJsonSanitizedByPackager: true, packagedManifestSha256: sha(asar.extractFile(asarPath, 'package.json')), artifact: { directory: path.relative(root, directories[0]).replaceAll('\\', '/'), asarSha256: sha(readFileSync(asarPath)), asarBytes: readFileSync(asarPath).length, executableSha256: sha(readFileSync(binary)), executableBytes: readFileSync(binary).length }, actualDisplayCaptureVerified: false, independentAcceptance: false, limitations: ['仅覆盖独立 Windows native-lab 的未签名包、ASAR 文件集和哈希比较。', '没有真实桌面捕获、跨屏、穿透、混合 DPI、系统权限或独立人工复核记录。'] };
  writeFileSync(path.join(evidence, 'desktop-lab-package.json'), JSON.stringify(report, null, 2));
  console.log(`Packaged independent C02 lab: ${directories[0]}`);
} else if (process.argv.includes('--open')) {
  const child = spawn(executable, [lab], { detached: true, windowsHide: false, stdio: 'ignore', env: environment });
  child.unref();
  console.log('Opened the independent C02 lab. Capture still requires manual purpose consent and Start.');
} else {
  const userData = path.join(root, '.cache/desktop-lab/user-data');
  mkdirSync(userData, { recursive: true });
  writeFileSync(path.join(evidence, 'desktop-lab-smoke.json'), JSON.stringify({ passed: false, stage: 'running', actualDisplayCaptureVerified: false }));
  const result = spawnSync(executable, [lab, '--nuanban-c02-self-test'], { windowsHide: true, env: { ...environment, NUANBAN_C02_EVIDENCE_DIR: evidence, NUANBAN_C02_USER_DATA: userData }, encoding: 'utf8', timeout: 90_000, maxBuffer: 4 * 1024 * 1024 });
  writeFileSync(path.join(evidence, 'desktop-lab-smoke.txt'), `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  if (result.error || result.status !== 0) throw result.error ?? new Error(`Hidden Electron smoke failed: ${result.stderr || result.stdout}`);
  const reportPath = path.join(evidence, 'desktop-lab-smoke.json');
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  if (!report.passed || report.counters.displayRequestCount !== 0) throw new Error('Unexpected desktop capture request in self-test.');
  for (const [file, expected] of Object.entries(sourceHashes)) if (sha(readFileSync(path.join(lab, file))) !== expected) throw new Error('Sources changed during smoke test.');
  report.sourceSha256 = sourceHashes;
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(result.stdout.trim());
}
