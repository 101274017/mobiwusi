import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

assert.equal(process.platform, 'win32', 'This regression requires real Windows local OCR');
const workspace = path.resolve(import.meta.dirname, '..');
const electron = createRequire(import.meta.url)('../apps/desktop/node_modules/electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [path.join(workspace, 'tests/helpers/desktop-wechat-guidance-smoke.cjs')],
  { env, windowsHide: true, stdio: 'inherit' });
const deadline = setTimeout(() => {
  console.error('Synthetic desktop guidance regression exceeded 75 seconds');
  child.kill();
  process.exitCode = 1;
}, 75000);
child.on('error', error => { clearTimeout(deadline); console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { clearTimeout(deadline); process.exitCode = code ?? 1; });
