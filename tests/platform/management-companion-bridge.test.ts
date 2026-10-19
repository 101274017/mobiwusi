import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { localCompanionBridge, showLiliCompanion } from '../../apps/web/src/local-companion';

const { registerManagementCompanionBridge } = createRequire(import.meta.url)('../../apps/desktop/management-companion-bridge.cjs');

function fixture() {
  const handlers = new Map<string, (event: unknown, ...argumentsList: unknown[]) => Promise<unknown>>();
  const trustedEvent = {};
  const current = { enabled: true, version: '1.0.0', failure: '', privatePath: 'synthetic-private-path' };
  const host = {
    hasPetWindow: vi.fn(() => true),
    selectLili: vi.fn(async (_enabled: boolean): Promise<{ ok: boolean; code?: string }> => ({ ok: true })),
    showPetPanel: vi.fn(async (_options: unknown): Promise<void> => undefined),
    lili: { command: vi.fn((_command: unknown) => ({ ok: true })), snapshot: () => current },
  };
  const bridge = registerManagementCompanionBridge({
    ipcMain: { handle: (name: string, handler: (event: unknown, ...argumentsList: unknown[]) => Promise<unknown>) => handlers.set(name, handler), removeHandler: (name: string) => handlers.delete(name) },
    isTrusted: (event: unknown) => event === trustedEvent, getHost: () => host,
  });
  const invoke = (...argumentsList: unknown[]) => handlers.get('nuanban:companion:show-lili')!(trustedEvent, ...argumentsList);
  return { handlers, current, host, bridge, invoke };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('我的小伙伴调用栗栗桌宠', () => {
  it('选择实际角色、恢复显示和鼠标交互，只返回角色标识与版本', async () => {
    const current = fixture();
    await expect(current.invoke()).resolves.toEqual({ id: 'lili', version: '1.0.0' });
    expect(current.host.selectLili).toHaveBeenCalledWith(true);
    expect(current.host.lili.command).toHaveBeenCalledWith({ type: 'display.set', options: { visible: true, clickThrough: false } });
    expect(current.host.showPetPanel).toHaveBeenCalledWith({ focusInput: false });
    current.bridge.dispose();
    expect(current.handlers.size).toBe(0);
  });

  it('拒绝其他来源和多余参数，不让页面传文件路径或任意桌宠命令', async () => {
    const current = fixture();
    await expect(current.handlers.get('nuanban:companion:show-lili')!({})).rejects.toThrow('不可信');
    await expect(current.invoke({ path: 'unexpected.blend' })).rejects.toThrow('额外参数');
    expect(current.host.selectLili).not.toHaveBeenCalled();
  });

  it('窗口不存在、资源加载失败或原角色停止未确认时不报告成功', async () => {
    const current = fixture();
    current.host.hasPetWindow.mockReturnValueOnce(false);
    await expect(current.invoke()).rejects.toThrow('尚未就绪');
    current.host.selectLili.mockResolvedValueOnce({ ok: false, code: 'resource_load_failed' });
    await expect(current.invoke()).rejects.toThrow('资源未能加载');
    current.host.selectLili.mockResolvedValueOnce({ ok: false, code: 'avatar_stop_unconfirmed' });
    await expect(current.invoke()).rejects.toThrow('原角色尚未停止');
    expect(current.host.showPetPanel).not.toHaveBeenCalled();
  });

  it('等待窗口实际恢复，显示失败或资源状态未确认时保留错误', async () => {
    const current = fixture();
    let finish!: () => void;
    current.host.showPetPanel.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    let completed = false;
    const pending = current.invoke().then(() => { completed = true; });
    await vi.waitFor(() => expect(current.host.showPetPanel).toHaveBeenCalledOnce());
    expect(completed).toBe(false);
    finish();
    await pending;
    current.host.lili.command.mockReturnValueOnce({ ok: false });
    await expect(current.invoke()).rejects.toThrow('窗口未能显示');
    current.host.showPetPanel.mockRejectedValueOnce(new Error('模拟窗口恢复失败'));
    await expect(current.invoke()).rejects.toThrow('模拟窗口恢复失败');
    current.current.enabled = false;
    await expect(current.invoke()).rejects.toThrow('状态未确认');
  });

  it('浏览器缺少桌面桥时明确降级；不接受未确认的返回值', async () => {
    vi.stubGlobal('window', {});
    expect(localCompanionBridge()).toBeUndefined();
    await expect(showLiliCompanion()).rejects.toThrow('桌面客户端');
    const showLili = vi.fn(async () => ({ id: 'lili', version: '', privatePath: 'not-for-web' }));
    vi.stubGlobal('window', { nuanbanCompanion: { showLili } });
    await expect(showLiliCompanion()).rejects.toThrow('状态未确认');
    showLili.mockResolvedValueOnce({ id: 'lili', version: '1.0.0', privatePath: 'not-for-web' });
    await expect(showLiliCompanion()).resolves.toEqual({ id: 'lili', version: '1.0.0' });
  });

  it('preload 只暴露固定调用，不转发 renderer 参数，并清理 IPC 错误前缀', async () => {
    const exposed: Record<string, { showLili(...argumentsList: unknown[]): Promise<unknown> }> = {};
    const invoke = vi.fn(async (..._argumentsList: unknown[]) => ({ id: 'lili', version: '1.0.0' }));
    runInNewContext(readFileSync('apps/desktop/preload.cjs', 'utf8'), {
      require: () => ({ contextBridge: { exposeInMainWorld: (name: string, value: typeof exposed[string]) => { exposed[name] = value; } }, ipcRenderer: { invoke, on: vi.fn() } }),
    });
    expect(Object.keys(exposed.nuanbanCompanion)).toEqual(['showLili']);
    expect(Object.isFrozen(exposed.nuanbanCompanion)).toBe(true);
    await exposed.nuanbanCompanion.showLili({ path: 'unexpected.blend' });
    expect(invoke).toHaveBeenCalledWith('nuanban:companion:show-lili');
    invoke.mockRejectedValueOnce(new Error("Error invoking remote method 'nuanban:companion:show-lili': Error: 栗栗资源未能加载"));
    await expect(exposed.nuanbanCompanion.showLili()).rejects.toThrow(/^栗栗资源未能加载$/);
  });
});
