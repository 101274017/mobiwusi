import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configuration } from '@nuanban/config';
import { emptyLocalSnapshot } from '../../apps/web/src/local-snapshot';

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? sources(file) : /\.(?:ts|tsx)$/.test(file) ? [file] : [];
  });
}
describe('产品运行时不加载演示业务', () => {
  it('所有部署默认真实空白本机资料，拒绝Mock业务与场景注入', () => {
    for (const production of [true, false]) {
      expect(configuration({}, production)).toEqual({ apiMode: 'local', platformMode: 'browser' });
      expect(() => configuration({ VITE_API_MODE: 'mock' }, production)).toThrow('Mock 已停用');
      expect(() => configuration({ VITE_MOCK_SCENARIO: 'success' }, production)).toThrow('演示场景已移除');
    }
    const initial = emptyLocalSnapshot();
    expect(initial).toMatchObject({ initialized: true, notes: [], todos: [], family: [], conflicts: [], outbox: [] });
    initial.preferences.muted = true;
    expect(emptyLocalSnapshot().preferences.muted).toBe(false);
  });
  it('产品源代码不导入任何测试夹具、旧Mock适配器或虚构业务状态机', () => {
    const root = join(import.meta.dirname, '../..');
    for (const file of [...sources(join(root, 'apps/web/src')), ...sources(join(root, 'packages'))]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/from\s+['"][^'"]*(?:@nuanban\/mocks|tests\/fixtures|\/assist-fixture)/);
      expect(source, file).not.toMatch(/\b(?:DemoConversation|ScenarioRepository|DemoAccountFlow|accountDemoReducer|createDrawingJob|transitionDrawingJob)\b/);
    }
    expect(readFileSync(join(root, 'apps/web/vite.config.ts'), 'utf8')).not.toContain("'mocks'");
  });
});
