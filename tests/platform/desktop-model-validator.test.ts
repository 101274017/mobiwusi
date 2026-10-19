import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { pathToFileURL } from 'node:url';
const { createLocalModelValidator } = createRequire(import.meta.url)('../../apps/desktop/model-validator.cjs');
const summary = { triangles: 1, meshes: 1, bones: 0, animations: 0, decodedBytes: 200, textures: [] };
const validators: { dispose(): void }[] = [];
afterEach(() => { validators.splice(0).forEach(validator => validator.dispose()); vi.useRealTimers(); });

function fixture(timeoutMs = 20000) {
  const handlers = new Map<string, (...argumentsList: any[]) => any>();
  const windows: FakeWindow[] = [];
  const memory = { private: 1024 };
  class FakeWindow extends EventEmitter {
    options: any;
    destroyed = false;
    webContents = Object.assign(new EventEmitter(), {
      mainFrame: { url: '' },
      isDestroyed: () => this.destroyed,
      getProcessMemoryInfo: vi.fn(async () => memory),
      setAudioMuted: vi.fn(), setWindowOpenHandler: vi.fn(),
      session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn<(handler: unknown) => void>(), webRequest: { onBeforeRequest: vi.fn<(handler: unknown) => void>() } },
    });
    constructor(options: any) { super(); this.options = options; windows.push(this); }
    setContentProtection = vi.fn();
    isDestroyed = () => this.destroyed;
    destroy() { this.destroyed = true; this.emit('closed'); }
    async loadFile(page: string) { this.webContents.mainFrame.url = pathToFileURL(page).href; }
  }
  const validator = createLocalModelValidator({ BrowserWindow: FakeWindow, ipcMain: {
    handle: (channel: string, handler: (...argumentsList: any[]) => any) => handlers.set(channel, handler),
    removeHandler: (channel: string) => handlers.delete(channel),
  }, timeoutMs });
  validators.push(validator);
  const event = () => ({ sender: windows[0].webContents, senderFrame: windows[0].webContents.mainFrame });
  return { validator, handlers, windows, memory, event };
}

describe('3D 隔离解析进程的权限与生命周期', () => {
  it('只允许检查窗口主框架取模型和提交检查结果，使用独立沙箱 session', async () => {
    const current = fixture(); const payload = { bytes: new Uint8Array([1, 2]), format: 'glb' };
    const pending = current.validator.validate(payload);
    const window = current.windows[0];
    expect(window.options).toMatchObject({ show: false, webPreferences: { partition: 'nuanban-model-validation', sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
    expect(current.handlers.get('nuanban:model-validator:read')!(current.event())).toBe(payload);
    expect(() => current.handlers.get('nuanban:model-validator:read')!({ sender: window.webContents, senderFrame: { ...window.webContents.mainFrame } })).toThrow('不可信');
    expect(() => current.handlers.get('nuanban:model-validator:complete')!({}, { summary })).toThrow('不可信');
    const permissionCheck = window.webContents.session.setPermissionCheckHandler.mock.calls[0][0] as () => boolean;
    expect(permissionCheck()).toBe(false);
    const networkCheck = window.webContents.session.webRequest.onBeforeRequest.mock.calls[0][0] as (input: { url: string }, callback: (result: { cancel: boolean }) => void) => void;
    const callback = vi.fn(); networkCheck({ url: 'https://example.invalid/model.png' }, callback); expect(callback).toHaveBeenLastCalledWith({ cancel: true });
    networkCheck({ url: 'file:///C:/secret.txt' }, callback); expect(callback).toHaveBeenLastCalledWith({ cancel: true });
    networkCheck({ url: window.webContents.mainFrame.url }, callback); expect(callback).toHaveBeenLastCalledWith({ cancel: false });
    current.handlers.get('nuanban:model-validator:complete')!(current.event(), { summary });
    await expect(pending).resolves.toEqual(summary); expect(window.destroyed).toBe(true); expect(current.handlers.size).toBe(0);
  });
  it('超时结束进程并清理 IPC，不重复启动检查', async () => {
    vi.useFakeTimers(); const current = fixture(50);
    const pending = current.validator.validate({ bytes: [], format: 'glb' });
    const rejection = expect(pending).rejects.toThrow('超过 20 秒');
    await expect(current.validator.validate({ bytes: [], format: 'glb' })).rejects.toThrow('未就绪');
    await vi.advanceTimersByTimeAsync(51); await rejection;
    expect(current.windows[0].destroyed).toBe(true); expect(current.handlers.size).toBe(0);
  });
  it('内存超限停止解析而不是拖垮主客户端', async () => {
    vi.useFakeTimers(); const current = fixture(); current.memory.private = 512 * 1024 + 1;
    const pending = current.validator.validate({ bytes: [], format: 'glb' }); const rejection = expect(pending).rejects.toThrow('512 MiB');
    await vi.advanceTimersByTimeAsync(401); await rejection;
    expect(current.windows[0].destroyed).toBe(true); expect(current.handlers.size).toBe(0);
  });
  it('解析进程退出、坏摘要和主动销毁均不假报成功', async () => {
    for (const mode of ['crash', 'invalid-summary', 'dispose']) {
      const current = fixture(); const pending = current.validator.validate({ bytes: [], format: 'glb' });
      const rejection = expect(pending).rejects.toThrow();
      if (mode === 'crash') current.windows[0].webContents.emit('render-process-gone');
      if (mode === 'invalid-summary') current.handlers.get('nuanban:model-validator:complete')!(current.event(), { summary: { ...summary, triangles: 100001 } });
      if (mode === 'dispose') current.validator.dispose();
      await rejection; expect(current.windows[0].destroyed).toBe(true); expect(current.handlers.size).toBe(0);
    }
  });
});
