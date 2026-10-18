import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];

function fixture() {
  const directory = mkdtempSync(path.join(realpathSync(tmpdir()), 'nuanban-d03-'));
  temporaryDirectories.push(directory);
  const webDirectory = path.join(directory, 'web');
  const packageDirectory = path.join(directory, 'package');
  const uiDirectory = path.join(packageDirectory, 'ui');
  const archivePath = path.join(directory, 'app.asar');
  mkdirSync(webDirectory, { recursive: true });
  mkdirSync(uiDirectory, { recursive: true });
  writeFileSync(path.join(webDirectory, 'index.html'), '<main>synthetic candidate</main>');
  writeFileSync(path.join(uiDirectory, 'index.html'), '<main>synthetic candidate</main>');
  return { directory, webDirectory, packageDirectory, uiDirectory, archivePath };
}

function runCheck(current: ReturnType<typeof fixture>, evidencePath?: string) {
  const archive = spawnSync(process.execPath, ['--input-type=module', '-e', 'import { createPackage } from "@electron/asar"; await createPackage(process.argv[1], process.argv[2]);', current.packageDirectory, current.archivePath], { encoding: 'utf8' });
  expect(archive.status, archive.stderr).toBe(0);
  const args = ['scripts/check-d03-candidate.mjs', '--web-dir', current.webDirectory, '--asar', current.archivePath];
  if (evidencePath) args.push('--evidence', evidencePath);
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  return { exitCode: result.status, report: JSON.parse(result.stdout) };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    const resolved = realpathSync(directory);
    if (path.dirname(resolved) !== realpathSync(tmpdir()) || !path.basename(resolved).startsWith('nuanban-d03-')) throw new Error('Unsafe test cleanup path');
    rmSync(resolved, { recursive: true, force: true });
  }
});

describe('D03 候选包一致性', () => {
  it('同一套 UI 字节通过检查，并保存可复核结果但不代表验收', () => {
    const current = fixture();
    const evidencePath = path.join(current.directory, 'evidence.json');
    const { exitCode, report } = runCheck(current, evidencePath);

    expect(exitCode).toBe(0);
    expect(report.success).toBe(true);
    expect(report.files).toHaveLength(1);
    expect(report.files[0].matches).toBe(true);
    expect(report.acceptance).toBe('preparatory_not_accepted');
    expect(JSON.parse(readFileSync(evidencePath, 'utf8'))).toEqual(report);
  });

  it('包中缺少当前 UI 文件时拒绝通过', () => {
    const current = fixture();
    writeFileSync(path.join(current.webDirectory, 'new.js'), 'synthetic new script');
    const { exitCode, report } = runCheck(current);

    expect(exitCode).toBe(1);
    expect(report.success).toBe(false);
    expect(report.files.find((entry: { path: string }) => entry.path === 'new.js').packagedSha256).toBeNull();
  });

  it('当前文件内容不同时拒绝通过', () => {
    const current = fixture();
    writeFileSync(path.join(current.uiDirectory, 'index.html'), '<main>synthetic old build</main>');
    const { exitCode, report } = runCheck(current);

    expect(exitCode).toBe(1);
    expect(report.files[0].matches).toBe(false);
  });

  it('包中残留额外旧 UI 文件时拒绝通过', () => {
    const current = fixture();
    writeFileSync(path.join(current.uiDirectory, 'stale.js'), 'synthetic obsolete script');
    const { exitCode, report } = runCheck(current);

    expect(exitCode).toBe(1);
    expect(report.extraPackagedFiles).toEqual(['ui/stale.js']);
  });
});
