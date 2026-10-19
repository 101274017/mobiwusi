import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createPackageWithOptions, statFile } from '@electron/asar';

const require = createRequire(import.meta.url);
const { externalScriptPath } = require('../../apps/desktop/external-script-path.cjs');
const { packagerConfig } = require('../../apps/desktop/forge.config.cjs');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    if (!path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error('Temporary package directory escaped its root');
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('外部 PowerShell 脚本的 ASAR 打包边界', () => {
  it('开发目录不变，正式路径指向真实 app.asar.unpacked 文件', () => {
    const developer = path.resolve('apps/desktop/wake/windows-local-wake.ps1');
    const packaged = path.resolve('resources/app.asar/wake/windows-local-wake.ps1');
    expect(externalScriptPath(developer)).toBe(developer);
    expect(externalScriptPath(packaged)).toBe(path.resolve('resources/app.asar.unpacked/wake/windows-local-wake.ps1'));
    expect(externalScriptPath(externalScriptPath(packaged))).toBe(externalScriptPath(packaged));
    for (const invalid of ['relative.ps1', path.resolve('wrong.js'), null]) expect(() => externalScriptPath(invalid)).toThrow('external_script_path_invalid');
  });

  it('按实际 Forge 配置生成 ASAR，两个辅助脚本都有相同字节的外部文件', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'nuanban-script-package-'));
    temporaryDirectories.push(directory);
    const input = path.join(directory, 'input');
    const archive = path.join(directory, 'app.asar');
    mkdirSync(input);
    const scripts = ['wake/windows-local-wake.ps1', 'observation/windows-local-analysis.ps1', 'voice/windows-local-speech.ps1'];
    for (const script of scripts) {
      const target = path.join(input, script);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(new URL(`../../apps/desktop/${script}`, import.meta.url)));
    }
    writeFileSync(path.join(input, 'inside.cjs'), 'module.exports = true;');
    await createPackageWithOptions(input, archive, packagerConfig.asar);
    expect(statFile(archive, 'inside.cjs').unpacked).not.toBe(true);
    for (const script of scripts) {
      expect(statFile(archive, script).unpacked).toBe(true);
      expect(readFileSync(externalScriptPath(path.join(archive, script)))).toEqual(readFileSync(path.join(input, script)));
    }
  });
});
