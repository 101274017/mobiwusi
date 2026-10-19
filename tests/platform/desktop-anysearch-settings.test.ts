import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createAnySearchKeyStore } = require('../../apps/desktop/anysearch-settings.cjs');
const directories: string[] = [];
const syntheticKey = 'key_synthetic_1234567890_not_real';

function fixture() {
  const userDataPath = mkdtempSync(join(tmpdir(), 'nuanban-search-key-'));
  directories.push(userDataPath);
  const safeStorage = { isEncryptionAvailable: () => true,
    encryptString: vi.fn((value: string) => Buffer.from(value).map(byte => byte ^ 0x5a)),
    decryptString: vi.fn((value: Buffer) => Buffer.from(value).map(byte => byte ^ 0x5a).toString()) };
  return { userDataPath, safeStorage, filePath: join(userDataPath, 'nuanban-anysearch-key.bin'),
    store: createAnySearchKeyStore({ userDataPath, safeStorage }) };
}

afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe('AnySearch 本机加密配置（合成加密，不代表系统加密验收）', () => {
  it('缺少配置时关闭，成功保存只写加密二进制并可恢复', () => {
    const current = fixture();
    expect(current.store.read()).toBeUndefined();
    expect(current.store.save(syntheticKey)).toEqual({ saved: true });
    expect(current.safeStorage.encryptString).toHaveBeenCalledWith(syntheticKey);
    expect(readFileSync(current.filePath).includes(Buffer.from(syntheticKey))).toBe(false);
    expect(current.store.read()).toBe(syntheticKey);
  });

  it('安全替换旧密钥，不将密钥返回给保存调用方', () => {
    const current = fixture();
    current.store.save(syntheticKey);
    const replacement = 'key_synthetic_replacement_12345678';
    expect(JSON.stringify(current.store.save(replacement))).not.toContain(replacement);
    expect(current.store.read()).toBe(replacement);
  });

  it('系统加密不可用或回退 basic_text 时不读取也不写入', () => {
    const current = fixture();
    for (const safeStorage of [undefined, { ...current.safeStorage, isEncryptionAvailable: () => false },
      { ...current.safeStorage, getSelectedStorageBackend: () => 'basic_text' }]) {
      const store = createAnySearchKeyStore({ userDataPath: current.userDataPath, safeStorage });
      expect(store.read()).toBeUndefined();
      expect(() => store.save(syntheticKey)).toThrow('系统加密不可用');
    }
    expect(current.safeStorage.encryptString).not.toHaveBeenCalled();
  });

  it.each(['', 'invalid\r\nheader', ' key_with_space', '字', 'x'.repeat(4097)])('拒绝无效或不安全的密钥格式 %#', key => {
    const current = fixture();
    expect(() => current.store.save(key)).toThrow('密钥格式无效');
    expect(current.safeStorage.encryptString).not.toHaveBeenCalled();
  });

  it('损坏、超额或解密失败的配置保守关闭', () => {
    const current = fixture();
    writeFileSync(current.filePath, Buffer.alloc(17 * 1024));
    expect(current.store.read()).toBeUndefined();
    expect(current.safeStorage.decryptString).not.toHaveBeenCalled();
    writeFileSync(current.filePath, Buffer.from('invalid'));
    current.safeStorage.decryptString.mockImplementation(() => { throw new Error('synthetic-private-key'); });
    expect(current.store.read()).toBeUndefined();
  });

  it('加密失败时不给出原始异常，也不覆盖已保存配置', () => {
    const current = fixture();
    current.store.save(syntheticKey);
    const previous = readFileSync(current.filePath);
    current.safeStorage.encryptString.mockImplementation(() => { throw new Error('synthetic-private-key'); });
    expect(() => current.store.save('synthetic-replacement')).toThrow('搜索密钥加密失败，未保存。');
    expect(readFileSync(current.filePath)).toEqual(previous);
  });

  it('要求明确的绝对本机目录', () => {
    expect(() => createAnySearchKeyStore({ userDataPath: 'relative/path' })).toThrow('配置目录无效');
  });
});
