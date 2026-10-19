import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkedObservationStatus, localObservationBridge } from '../../apps/web/src/local-observation';

const { registerManagementObservationBridge } = createRequire(import.meta.url)('../../apps/desktop/management-observation-bridge.cjs');

function fixture() {
  const handlers = new Map<string, (event: unknown, ...argumentsList: unknown[]) => unknown>();
  const trustedEvent = {};
  const snapshot = { observation: { state: 'off', captureActive: false, sourceName: '', generation: 3 },
    capabilities: { cloudAnalysis: false }, task: { question: 'synthetic-private-question' }, rawFrame: 'synthetic-private-frame' };
  const host = { hasPetWindow: () => true, snapshot: () => snapshot, showPetPanel: vi.fn(), requestObservation: vi.fn(async (_resume: boolean) => undefined),
    stop: vi.fn(async (_reason: string) => { snapshot.observation.state = 'stopped'; return { stopped: true }; }) };
  const bridge = registerManagementObservationBridge({ ipcMain: { handle: (name: string, handler: (event: unknown, ...argumentsList: unknown[]) => unknown) => handlers.set(name, handler),
    removeHandler: (name: string) => handlers.delete(name) }, isTrusted: (event: unknown) => event === trustedEvent, getHost: () => host });
  const invoke = (action: string, ...argumentsList: unknown[]) => handlers.get(`nuanban:observation:${action}`)!(trustedEvent, ...argumentsList);
  return { handlers, host, snapshot, bridge, invoke };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('管理窗口连接真实桌宠观察（合成桥接测试，不捕获用户屏幕）', () => {
  it('读取状态与打开桌宠均不开始采集，也不返回帧、教学文本或秘密', async () => {
    const current = fixture();
    expect(current.invoke('status')).toEqual({ state: 'off', captureActive: false, sourceName: '', cloudConfigured: false });
    await current.invoke('show-pet');
    expect(current.host.showPetPanel).toHaveBeenCalledOnce();
    expect(current.host.requestObservation).not.toHaveBeenCalled();
    expect(JSON.stringify(current.invoke('status'))).not.toContain('synthetic-private');
  });

  it('打开桌宠等待窗口恢复完成，失败时不返回打开成功', async () => {
    const current = fixture();
    let finish!: () => void;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    current.host.showPetPanel.mockImplementationOnce(() => waiting);
    let opened = false;
    const opening = Promise.resolve(current.invoke('show-pet')).then(() => { opened = true; });
    await Promise.resolve();
    expect(opened).toBe(false);
    finish();
    await opening;
    expect(opened).toBe(true);
    current.host.showPetPanel.mockImplementationOnce(() => { throw new Error('窗口恢复失败'); });
    await expect(current.invoke('show-pet')).rejects.toThrow('窗口恢复失败');
    expect(current.host.requestObservation).not.toHaveBeenCalled();
  });

  it('开启和隐私恢复都委托原生本人选屏与用途确认，管理 renderer 不能代选', async () => {
    const current = fixture();
    await current.invoke('start');
    await current.invoke('resume');
    expect(current.host.requestObservation.mock.calls).toEqual([[false], [true]]);
    expect(current.host.showPetPanel).toHaveBeenCalledTimes(2);
    expect(() => current.invoke('start', { sourceId: 'screen:1', confirmed: true, cloudConsent: true })).toThrow('本人');
    expect(current.host.requestObservation).toHaveBeenCalledTimes(2);
  });

  it('拒绝其他窗口与 iframe，连只读状态也不能绕过来源检查', () => {
    const current = fixture();
    for (const handler of current.handlers.values()) expect(() => handler({})).toThrow('不可信');
    expect(current.host.requestObservation).not.toHaveBeenCalled();
    expect(current.host.stop).not.toHaveBeenCalled();
  });

  it('用户取消原生确认后保持关闭，不能把 IPC 成功当作采集开启', async () => {
    const current = fixture();
    await expect(current.invoke('start')).resolves.toMatchObject({ state: 'off', captureActive: false });
  });

  it('停止等待实际核心清理结果；清理未确认时不能返回已停止', async () => {
    const current = fixture();
    current.snapshot.observation.state = 'observing';
    current.snapshot.observation.captureActive = true;
    let complete!: () => void;
    const waiting = new Promise<void>(resolve => { complete = resolve; });
    current.host.stop.mockImplementationOnce(async () => {
      await waiting;
      current.snapshot.observation.state = 'cleanup_failed';
      return { stopped: false };
    });
    let settled = false;
    const stopping = Promise.resolve(current.invoke('stop')).then(value => { settled = true; return value; });
    await Promise.resolve();
    expect(settled).toBe(false);
    complete();
    await expect(stopping).resolves.toMatchObject({ state: 'cleanup_failed', captureActive: true });
    expect(current.host.stop).toHaveBeenCalledWith('user');
  });

  it('尚无桌宠窗口或核心状态异常时失败，不回退成模拟观察', () => {
    const current = fixture();
    current.host.hasPetWindow = () => false;
    expect(() => current.invoke('status')).toThrow('尚未就绪');
    current.host.hasPetWindow = () => true;
    current.snapshot.observation.state = 'synthetic-unknown';
    expect(() => current.invoke('status')).toThrow('未确认');
  });

  it('独立桥接可完整注销', () => {
    const current = fixture();
    expect(current.handlers.size).toBe(5);
    current.bridge.dispose();
    expect(current.handlers.size).toBe(0);
  });

  it('停止过程仍占用采集时不显示已停止', () => {
    const current = fixture();
    current.snapshot.observation.state = 'stopped';
    current.snapshot.observation.captureActive = true;
    expect(current.invoke('status')).toMatchObject({ state: 'cleanup_failed', captureActive: true });
  });

  it('preload 只提供固定无参数命令，不把 renderer 权限声明透传给原生', async () => {
    const exposed = new Map<string, Record<string, (...argumentsList: unknown[]) => unknown>>();
    const invoke = vi.fn(async () => undefined);
    runInNewContext(readFileSync(new URL('../../apps/desktop/preload.cjs', import.meta.url), 'utf8'), {
      require: () => ({ contextBridge: { exposeInMainWorld: (name: string, value: Record<string, (...argumentsList: unknown[]) => unknown>) => exposed.set(name, value) },
        ipcRenderer: { invoke, on: vi.fn(), removeListener: vi.fn() } }),
    });
    const api = exposed.get('nuanbanObservation')!;
    for (const method of ['status', 'start', 'resume', 'stop', 'showPet']) await api[method]({ actor: 'owner', confirmed: true });
    expect(invoke.mock.calls.map(call => call.length)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe('管理页观察状态适配', () => {
  it('无原生接口或接口残缺时不声称支持真实采集', () => {
    vi.stubGlobal('window', {});
    expect(localObservationBridge()).toBeUndefined();
    vi.stubGlobal('window', { nuanbanObservation: { status: vi.fn() } });
    expect(localObservationBridge()).toBeUndefined();
  });

  it('只接收可核对状态，额外原始数据不进入 UI', () => {
    const value = { state: 'observing', captureActive: true, sourceName: '合成屏幕', cloudConfigured: false, rawFrame: 'not-exposed' };
    expect(checkedObservationStatus(value)).not.toHaveProperty('rawFrame');
    expect(() => checkedObservationStatus({ ...value, captureActive: 'true' })).toThrow('未确认');
    expect(() => checkedObservationStatus({ ...value, state: 'success' })).toThrow('未确认');
    expect(() => checkedObservationStatus(null)).toThrow('未确认');
  });
});
