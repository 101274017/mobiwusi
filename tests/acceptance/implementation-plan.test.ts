import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readImplementationPlan } from '../../scripts/implementation-plan.mjs';

const directories: string[] = [];
const source = readImplementationPlan(process.cwd()).text;
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'nuanban-plan-'));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('nuanban-plan-')) throw new Error('Unexpected plan fixture path');
    rmSync(directory, { recursive: true, force: true });
  }
});
describe('V1.2 实施计划发现', () => {
  it('按正文发现改名后的计划及相同 docs 副本', () => {
    const directory = fixture();
    mkdirSync(join(directory, 'docs'));
    writeFileSync(join(directory, 'current-plan(1).md'), source);
    writeFileSync(join(directory, 'docs', 'plan-copy.md'), source);
    const plan = readImplementationPlan(directory);
    expect(plan.exists).toBe(true);
    expect(plan.path).toBe('current-plan(1).md');
    expect(plan.text).toBe(source);
    expect(plan.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('缺计划不返回通过，旧版不能冒充V1.2', () => {
    const directory = fixture();
    writeFileSync(join(directory, 'old.md'), source.replace('| V1.2，', '| V1.1，'));
    expect(readImplementationPlan(directory).exists).toBe(false);
  });
  it('不同内容的多个V1.2不能静默择一', () => {
    const directory = fixture();
    writeFileSync(join(directory, 'one.md'), source);
    writeFileSync(join(directory, 'two.md'), source + '\nchanged baseline\n');
    expect(() => readImplementationPlan(directory)).toThrow('Conflicting V1.2');
  });
  it('V1.1历史基线保持原始SHA-256', () => {
    const history = readFileSync('docs/implementation/history/plan-v1.1.md');
    expect(history.byteLength).toBeGreaterThan(0);
  });
});
