import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFile, listPackage, statFile } from '@electron/asar';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function filesIn(directory, relative = '') {
  return readdirSync(path.join(directory, relative), { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(relative, entry.name);
    if (entry.isDirectory()) return filesIn(directory, filename);
    if (!entry.isFile()) throw new Error(`Unsupported candidate entry: ${filename}`);
    return [filename.replaceAll('\\', '/')];
  }).sort();
}

export function checkD03Candidate({ webDirectory = path.join(root, 'apps/web/dist'), archivePath = path.join(root, 'apps/desktop/out/NuanbanDemo-win32-x64/resources/app.asar') } = {}) {
  const generatedAt = new Date().toISOString();
  const report = {
    schemaVersion: 'd03-candidate-check/v1',
    generatedAt,
    generatedTimeZone: 'Asia/Shanghai',
    scope: 'D03 current Web build versus packaged desktop ASAR UI byte comparison',
    success: false,
    status: 'mismatch',
    acceptance: 'preparatory_not_accepted',
    webDirectory: path.resolve(webDirectory),
    archivePath: path.resolve(archivePath),
    archiveSha256: null,
    files: [],
    extraPackagedFiles: [],
    errors: [],
    limitations: [
      '只核对当前 Web 构建与桌面 ASAR 的 UI 文件集合和原始字节；不证明源代码可重建或设备运行。',
      '不验证 Android 包、系统权限、后台能力、人工读屏或负责人签收；不批准 D 或启动 E/F。',
    ],
  };
  try {
    if (!existsSync(webDirectory)) throw new Error('Web build directory is missing');
    if (!existsSync(archivePath)) throw new Error('Desktop ASAR is missing');
    const webFiles = filesIn(webDirectory);
    if (!webFiles.includes('index.html')) throw new Error('Web build index.html is missing');
    report.archiveSha256 = sha256(readFileSync(archivePath));
    const packagedFiles = listPackage(archivePath).map(entry => entry.replaceAll('\\', '/').replace(/^\/+/, '')).filter(entry => entry.startsWith('ui/') && !statFile(archivePath, path.normalize(entry), false).files);
    report.extraPackagedFiles = packagedFiles.filter(entry => !webFiles.includes(entry.slice(3))).sort();
    report.files = webFiles.map(relativePath => {
      const source = readFileSync(path.join(webDirectory, relativePath));
      const sourceSha256 = sha256(source);
      const packagedPath = `ui/${relativePath}`;
      const entry = { path: relativePath, bytes: source.byteLength, sourceSha256, packagedSha256: null, matches: false };
      if (packagedFiles.includes(packagedPath)) {
        const metadata = statFile(archivePath, path.normalize(packagedPath), false);
        if (!metadata.link && !metadata.unpacked) {
          entry.packagedSha256 = sha256(extractFile(archivePath, path.normalize(packagedPath), false));
          entry.matches = sourceSha256 === entry.packagedSha256;
        }
      }
      return entry;
    });
    report.success = report.files.every(entry => entry.matches) && report.extraPackagedFiles.length === 0;
    report.status = report.success ? 'matched' : 'mismatch';
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = name => {
    const index = process.argv.indexOf(name);
    if (index < 0) return undefined;
    if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw new Error(`${name} requires a path`);
    return path.resolve(process.argv[index + 1]);
  };
  const report = checkD03Candidate({ webDirectory: argument('--web-dir'), archivePath: argument('--asar') });
  const evidencePath = argument('--evidence');
  if (evidencePath) {
    mkdirSync(path.dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.success ? 0 : 1;
}
