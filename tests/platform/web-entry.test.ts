import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const key = 'nuanban.entry.v1';
let values: Map<string, string>;
let storage: Pick<Storage, 'getItem' | 'setItem'>;

beforeEach(() => {
  vi.resetModules();
  values = new Map();
  storage = { getItem: vi.fn(name => values.get(name) ?? null), setItem: vi.fn((name, value) => { values.set(name, value); }) };
  vi.stubGlobal('window', { localStorage: storage });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('欢迎页只记录本机游客入口', () => {
  it('第一次进入时没有记录', async () => {
    const { readEntry } = await import('../../apps/web/src/entry');
    expect(readEntry()).toBeNull();
  });

  it('只保存游客选择与时间，不生成登录凭证', async () => {
    const { readEntry, writeEntry } = await import('../../apps/web/src/entry');
    writeEntry('guest');
    expect(readEntry()).toEqual({ mode: 'guest', at: expect.any(String) });
    expect([...values.keys()]).toEqual([key]);
    expect(JSON.parse(values.get(key)!)).toEqual(readEntry());
  });

  it.each(['not-json', '{}', '{"mode":"authenticated","at":"2026-10-21"}', 'null'])('拒绝损坏或伪造记录 %s', async raw => {
    values.set(key, raw);
    const { readEntry } = await import('../../apps/web/src/entry');
    expect(readEntry()).toBeNull();
  });

  it('浏览器禁止访问 localStorage 时，本次仍能以游客进入', async () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('storage blocked'); } });
    const { readEntry, writeEntry } = await import('../../apps/web/src/entry');
    expect(readEntry()).toBeNull();
    writeEntry('guest');
    expect(readEntry()?.mode).toBe('guest');
    expect(values.size).toBe(0);
  });

  it('存储配额不足时不陷入首页与欢迎页的重定向循环', async () => {
    vi.mocked(storage.setItem).mockImplementation(() => { throw new Error('quota exceeded'); });
    const { readEntry, writeEntry } = await import('../../apps/web/src/entry');
    writeEntry('guest');
    expect(readEntry()?.mode).toBe('guest');
    expect(values.size).toBe(0);
    vi.resetModules();
    const reloaded = await import('../../apps/web/src/entry');
    expect(reloaded.readEntry()).toBeNull();
  });
});
