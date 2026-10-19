import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const fileSystem = require('node:fs');
const { createLocalArtworkStore, registerLocalArtworkBridge } = require('../../apps/desktop/local-artwork.cjs');
const temporaryDirectories: string[] = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64');
const drawing = { dataUrl: 'data:image/png;base64,' + png.toString('base64'), width: 1, height: 1 };
const decoder = (transparent = false) => ({ createFromBuffer: vi.fn((input: Buffer) => ({
  getSize: () => ({ width: input.readUInt32BE(16), height: input.readUInt32BE(20) }),
  isEmpty: () => false,
  toBitmap: () => Buffer.from([0, 0, 255, transparent ? 0 : 255]),
  toPNG: () => input,
})) });

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'nuanban-local-artwork-'));
  temporaryDirectories.push(directory);
  const filePath = join(directory, 'original-pet.png');
  const nativeImage = decoder();
  return { filePath, nativeImage, store: createLocalArtworkStore({ filePath, nativeImage }) };
}

afterEach(() => { for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe('本地原画桌宠仓储（合成 PNG 与解码器契约）', () => {
  it('仅显式应用时持久化，重建仓储可恢复，恢复内置只清除桌宠图片', () => {
    const { store, filePath, nativeImage } = fixture();
    expect(store.read()).toEqual({ kind: 'builtin' });
    expect(existsSync(filePath)).toBe(false);
    expect(store.apply(drawing)).toMatchObject({ kind: 'drawing', ...drawing });
    expect(createLocalArtworkStore({ filePath, nativeImage }).read()).toMatchObject({ kind: 'drawing', ...drawing });
    expect(readFileSync(filePath)).toEqual(png);
    expect(store.clear()).toEqual({ kind: 'builtin' });
    expect(store.read()).toEqual({ kind: 'builtin' });
  });

  it('拒绝外部地址、SVG、损坏编码和预览尺寸不符，保留上一张原画', () => {
    const { store, filePath } = fixture();
    store.apply(drawing);
    for (const invalid of [
      { ...drawing, dataUrl: 'https://example.invalid/art.png' },
      { ...drawing, dataUrl: 'file:///C:/secret.png' },
      { ...drawing, dataUrl: 'data:image/svg+xml,<svg onload="alert(1)"/>' },
      { ...drawing, dataUrl: 'data:image/png;base64,AAAA' },
      { ...drawing, width: 2 },
    ]) expect(() => store.apply(invalid)).toThrow();
    expect(readFileSync(filePath)).toEqual(png);
  });

  it('在解码前拒绝超大 PNG 尺寸和超大输入', () => {
    const { store, nativeImage } = fixture();
    const oversized = Buffer.from(png);
    oversized.writeUInt32BE(100000, 16);
    expect(() => store.apply({ ...drawing, dataUrl: 'data:image/png;base64,' + oversized.toString('base64') })).toThrow('尺寸');
    expect(() => store.apply({ ...drawing, dataUrl: 'data:image/png;base64,' + 'A'.repeat(3_000_000) })).toThrow();
    expect(nativeImage.createFromBuffer).not.toHaveBeenCalled();
  });

  it('全透明图片和损坏持久化文件不冒充已应用，可以重新应用恢复', () => {
    const { filePath, nativeImage } = fixture();
    const transparentStore = createLocalArtworkStore({ filePath, nativeImage: decoder(true) });
    expect(() => transparentStore.apply(drawing)).toThrow('没有可见笔画');
    writeFileSync(filePath, 'broken image');
    const store = createLocalArtworkStore({ filePath, nativeImage });
    expect(() => store.read()).toThrow();
    expect(store.apply(drawing)).toMatchObject({ kind: 'drawing' });
  });
});

describe('原画 EXDEV 兼容与恢复（合成文件系统故障）', () => {
  const crossDevice = (overrides: Record<string, unknown> = {}) => ({ ...fileSystem,
    renameSync: vi.fn(() => { throw Object.assign(new Error('synthetic cross-device rename'), { code: 'EXDEV' }); }),
    ...overrides,
  });

  it('真正的权限错误不会走复制兜底，不改写旧图', () => {
    const { filePath, nativeImage, store: original } = fixture();
    original.apply(drawing);
    const copyFileSync = vi.fn();
    const storage = crossDevice({ copyFileSync, renameSync: () => {
      throw Object.assign(new Error('synthetic rename denied'), { code: 'EACCES' });
    } });
    const store = createLocalArtworkStore({ filePath, nativeImage, fileSystem: storage });
    expect(() => store.apply(drawing)).toThrow('本机资料目录无法写入');
    expect(copyFileSync).not.toHaveBeenCalled();
    expect(readFileSync(filePath)).toEqual(png);
    expect(existsSync(filePath + '.previous')).toBe(false);
  });

  it('复制后落盘失败不提交，并且关闭文件句柄', () => {
    const { filePath, nativeImage, store: original } = fixture();
    original.apply(drawing);
    const closeSync = vi.fn(fileSystem.closeSync);
    const storage = crossDevice({ closeSync, fsyncSync: () => {
      throw Object.assign(new Error('synthetic sync failure'), { code: 'EIO' });
    } });
    const store = createLocalArtworkStore({ filePath, nativeImage, fileSystem: storage });
    expect(() => store.apply(drawing)).toThrow('原画保存失败');
    expect(closeSync).toHaveBeenCalledTimes(1);
    expect(readFileSync(filePath + '.previous')).toEqual(png);
    expect(store.read()).toMatchObject({ kind: 'drawing', ...drawing });
  });

  it('不支持重命名时，首次应用与再次替换都可提交，重启后读取一致', () => {
    const { filePath, nativeImage } = fixture();
    const storage = crossDevice();
    const store = createLocalArtworkStore({ filePath, nativeImage, fileSystem: storage });
    expect(store.apply(drawing)).toMatchObject({ kind: 'drawing', ...drawing });
    expect(store.apply(drawing)).toMatchObject({ kind: 'drawing', ...drawing });
    expect(readFileSync(filePath)).toEqual(png);
    expect(existsSync(filePath + '.previous')).toBe(false);
    expect(createLocalArtworkStore({ filePath, nativeImage }).read()).toMatchObject({ kind: 'drawing', ...drawing });
    expect(storage.renameSync).toHaveBeenCalledTimes(2);
  });

  it('复制中途空间不足时，读取和重启仍使用旧图，重试后才提交', () => {
    const { filePath, nativeImage, store: original } = fixture();
    original.apply(drawing);
    let failing = true;
    const storage = crossDevice({ copyFileSync: (source: string, destination: string) => {
      if (failing) {
        fileSystem.writeFileSync(destination, 'synthetic partial copy');
        throw Object.assign(new Error('synthetic full disk'), { code: 'ENOSPC' });
      }
      return fileSystem.copyFileSync(source, destination);
    } });
    const store = createLocalArtworkStore({ filePath, nativeImage, fileSystem: storage });
    expect(() => store.apply(drawing)).toThrow('磁盘空间不足');
    expect(readFileSync(filePath, 'utf8')).toBe('synthetic partial copy');
    expect(readFileSync(filePath + '.previous')).toEqual(png);
    expect(store.read()).toMatchObject({ kind: 'drawing', ...drawing });
    expect(createLocalArtworkStore({ filePath, nativeImage }).read()).toMatchObject({ kind: 'drawing', ...drawing });
    failing = false;
    expect(store.apply(drawing)).toMatchObject({ kind: 'drawing', ...drawing });
    expect(readFileSync(filePath)).toEqual(png);
    expect(existsSync(filePath + '.previous')).toBe(false);
  });

  it('首次复制失败仍保持内置形象，恢复内置同时清除未提交图片', () => {
    const { filePath, nativeImage } = fixture();
    const storage = crossDevice({ copyFileSync: (_source: string, destination: string) => {
      fileSystem.writeFileSync(destination, 'synthetic partial copy');
      throw Object.assign(new Error('synthetic copy failure'), { code: 'EIO' });
    } });
    const store = createLocalArtworkStore({ filePath, nativeImage, fileSystem: storage });
    expect(() => store.apply(drawing)).toThrow('原画保存失败');
    expect(store.read()).toEqual({ kind: 'builtin' });
    expect(createLocalArtworkStore({ filePath, nativeImage }).read()).toEqual({ kind: 'builtin' });
    expect(store.clear()).toEqual({ kind: 'builtin' });
    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(filePath + '.previous')).toBe(false);
  });

  it('恢复副本写入失败不覆盖旧图，也不留下部分副本抢占读取', () => {
    const { filePath, nativeImage, store: original } = fixture();
    original.apply(drawing);
    const storage = crossDevice({ writeFileSync: (destination: string, content: unknown, options: unknown) => {
      if (destination === filePath + '.previous') {
        fileSystem.writeFileSync(destination, 'synthetic partial backup');
        throw Object.assign(new Error('synthetic backup denied'), { code: 'EPERM' });
      }
      return fileSystem.writeFileSync(destination, content, options);
    } });
    const store = createLocalArtworkStore({ filePath, nativeImage, fileSystem: storage });
    expect(() => store.apply(drawing)).toThrow('本机资料目录无法写入');
    expect(readFileSync(filePath)).toEqual(png);
    expect(existsSync(filePath + '.previous')).toBe(false);
    expect(store.read()).toMatchObject({ kind: 'drawing', ...drawing });
  });

  it('提交前无法清除恢复副本时保留旧状态，不谎报成功，允许重试', () => {
    const { filePath, nativeImage, store: original } = fixture();
    original.apply(drawing);
    const replacementPng = Buffer.from(png);
    replacementPng[replacementPng.length - 1] ^= 1;
    const replacement = { ...drawing, dataUrl: 'data:image/png;base64,' + replacementPng.toString('base64') };
    let failing = true;
    const storage = crossDevice({ unlinkSync: (destination: string) => {
      if (failing && destination === filePath + '.previous') throw Object.assign(new Error('synthetic commit denied'), { code: 'EPERM' });
      return fileSystem.unlinkSync(destination);
    } });
    const store = createLocalArtworkStore({ filePath, nativeImage, fileSystem: storage });
    expect(() => store.apply(replacement)).toThrow('原画保存失败');
    expect(readFileSync(filePath)).toEqual(replacementPng);
    expect(store.read()).toMatchObject({ kind: 'drawing', ...drawing });
    failing = false;
    expect(store.apply(replacement)).toMatchObject({ kind: 'drawing', ...replacement });
    expect(store.read()).toMatchObject({ kind: 'drawing', ...replacement });
    expect(existsSync(filePath + '.previous')).toBe(false);
  });
});

describe('原画 IPC 最小权限', () => {
  it('只允许受信主管理窗口写入，桌宠主框架只读，子框架与外部窗口不可读取', () => {
    const handlers = new Map<string, (...argumentsList: unknown[]) => unknown>();
    const ipcMain = { handle: vi.fn((channel: string, handler: (...argumentsList: unknown[]) => unknown) => handlers.set(channel, handler)), removeHandler: vi.fn() };
    const mainFrame = { url: 'file:///management.html' };
    const petFrame = { url: pathToFileURL(join(import.meta.dirname, '../../apps/desktop/pet.html')).href };
    const managementContents = { mainFrame, isDestroyed: () => false, send: vi.fn() };
    const toolContents = { mainFrame: {}, isDestroyed: () => false, send: vi.fn() };
    const petContents = { mainFrame: petFrame, isDestroyed: () => false, send: vi.fn() };
    const managementEvent = { sender: managementContents, senderFrame: mainFrame };
    const petEvent = { sender: petContents, senderFrame: petFrame };
    const store = { read: vi.fn(() => ({ kind: 'builtin' })), apply: vi.fn(() => ({ kind: 'drawing', ...drawing })), clear: vi.fn(() => ({ kind: 'builtin' })) };
    const bridge = registerLocalArtworkBridge({ ipcMain, store,
      isManagementTrusted: (event: unknown) => event === managementEvent,
      getManagementWindow: () => ({ isDestroyed: () => false, webContents: managementContents }),
      getToolWindow: () => ({ isDestroyed: () => false, webContents: toolContents }),
      getPetWindow: () => ({ isDestroyed: () => false, webContents: petContents }),
    });
    expect(handlers.get('nuanban:artwork:read')!(petEvent)).toEqual({ kind: 'builtin' });
    expect(() => handlers.get('nuanban:artwork:apply')!(petEvent, drawing)).toThrow();
    expect(() => handlers.get('nuanban:artwork:clear')!(petEvent)).toThrow();
    expect(() => handlers.get('nuanban:artwork:read')!({ ...petEvent, senderFrame: { ...petFrame } })).toThrow();
    expect(() => handlers.get('nuanban:artwork:read')!({ ...petEvent, sender: {} })).toThrow();
    handlers.get('nuanban:artwork:apply')!(managementEvent, drawing);
    expect(store.apply).toHaveBeenCalledExactlyOnceWith(drawing);
    expect(managementContents.send).toHaveBeenCalledWith('nuanban:artwork:changed', expect.objectContaining({ kind: 'drawing' }));
    expect(toolContents.send).toHaveBeenCalledWith('nuanban:artwork:changed', expect.objectContaining({ kind: 'drawing' }));
    expect(petContents.send).toHaveBeenCalledWith('nuanban:artwork:changed', expect.objectContaining({ kind: 'drawing' }));
    handlers.get('nuanban:artwork:clear')!(managementEvent);
    expect(toolContents.send).toHaveBeenLastCalledWith('nuanban:artwork:changed', { kind: 'builtin' });
    expect(petContents.send).toHaveBeenLastCalledWith('nuanban:artwork:changed', { kind: 'builtin' });
    bridge.dispose();
    expect(ipcMain.removeHandler).toHaveBeenCalledTimes(3);
  });
});

describe('原画 preload 错误提示', () => {
  it('去掉 Electron 远端调用前缀，仍只向主进程传递 PNG 与尺寸', async () => {
    const exposed = new Map<string, { apply: (artwork: unknown) => Promise<unknown> }>();
    const invoke = vi.fn(async () => { throw new Error("Error invoking remote method 'nuanban:artwork:apply': Error: 原画保存失败（磁盘空间不足），原稿仍保留，请重试"); });
    runInNewContext(readFileSync(join(import.meta.dirname, '../../apps/desktop/preload.cjs'), 'utf8'), {
      require: (name: string) => {
        if (name !== 'electron') throw new Error('unexpected preload import');
        return { contextBridge: { exposeInMainWorld: (key: string, value: { apply: (artwork: unknown) => Promise<unknown> }) => exposed.set(key, value) }, ipcRenderer: { invoke, on: vi.fn() } };
      },
    });
    const operation = exposed.get('nuanbanArtwork')!.apply({ ...drawing, path: 'file:///not-permitted.png' });
    await expect(operation).rejects.toThrow(/^原画保存失败（磁盘空间不足），原稿仍保留，请重试$/);
    expect(invoke).toHaveBeenCalledExactlyOnceWith('nuanban:artwork:apply', drawing);
  });
});

describe('桌宠原画热切换（隔离 DOM）', () => {
  it('不让迟到读取或旧图片加载复活已撤回的原画，并保持桌宠按钮不变', async () => {
    const attributes = new Map<string, Set<string>>();
    const elements = Object.fromEntries(['builtin-pet', 'custom-pet', 'artwork-status'].map(name => {
      const elementAttributes = new Set<string>();
      attributes.set(name, elementAttributes);
      return [name, { hidden: name !== 'builtin-pet', textContent: '', src: '', removeAttribute: vi.fn(),
        toggleAttribute: (attribute: string, force: boolean) => { if (force) elementAttributes.add(attribute); else elementAttributes.delete(attribute); },
      }];
    }));
    let listener: (artwork: unknown) => void = () => undefined;
    let resolveRead: (artwork: unknown) => void = () => undefined;
    const images: Array<{ onload: () => void; naturalWidth: number; naturalHeight: number }> = [];
    const unsubscribe = vi.fn();
    const window = Object.assign(new EventTarget(), { nuanbanArtwork: {
      read: () => new Promise(resolve => { resolveRead = resolve; }),
      onChanged: (callback: typeof listener) => { listener = callback; return unsubscribe; },
    } });
    runInNewContext(readFileSync(join(import.meta.dirname, '../../apps/desktop/pet-artwork.js'), 'utf8'), {
      window, document: { getElementById: (name: string) => elements[name] },
      Image: class { naturalWidth = 1; naturalHeight = 1; onload = () => undefined; constructor() { images.push(this); } },
    });
    listener({ kind: 'drawing', ...drawing });
    images[0].onload();
    expect(elements['custom-pet'].hidden).toBe(false);
    expect(attributes.get('builtin-pet')!.has('hidden')).toBe(true);
    listener({ kind: 'drawing', ...drawing });
    listener({ kind: 'builtin' });
    resolveRead({ kind: 'drawing', ...drawing });
    images[1].onload();
    await Promise.resolve();
    await Promise.resolve();
    expect(elements['custom-pet'].hidden).toBe(true);
    expect(attributes.get('builtin-pet')!.has('hidden')).toBe(false);
    listener({ kind: 'drawing', ...drawing, dataUrl: 'https://example.invalid/art.png' });
    expect(images).toHaveLength(2);
    expect(elements['artwork-status'].hidden).toBe(false);
    window.dispatchEvent(new Event('pagehide'));
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
