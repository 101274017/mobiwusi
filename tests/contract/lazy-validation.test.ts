import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

it('本机绘画未调用远端契约时，不在严格 CSP 环境提前编译校验器', () => {
  const result = spawnSync(process.execPath, [
    '--disallow-code-generation-from-strings',
    '--input-type=module',
    '--eval',
    "await import('./packages/contracts/src/validation.ts');",
  ], { encoding: 'utf8', cwd: process.cwd(), timeout: 10000 });
  expect(result.status, result.stderr || result.error?.message).toBe(0);
});
