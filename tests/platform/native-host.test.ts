import { describe, expect, it, vi } from 'vitest';
import { createPlatform, NativeHostPlatform, type NativeHostBridge } from '@nuanban/platform-ports';

function host(overrides: Partial<NativeHostBridge> = {}): NativeHostBridge {
  return { platform: 'android', capabilities: vi.fn(async () => ({ platform: 'android', externalCapture: true, nativeOverlay: true, remoteMedia: true, granted: true })), stopAll: vi.fn(async () => ({ stopped: true, captureActive: false })), ...overrides };
}

describe('C 阶段受限原生宿主适配层', () => {
  it('只识别受支持宿主，并保持尚未验证的高风险能力关闭', async () => {
    const bridge = host();
    const platform = createPlatform(bridge);
    expect(platform).toBeInstanceOf(NativeHostPlatform);
    expect(platform.capabilities).toEqual({ platform: 'android', externalCapture: false, remoteMedia: false, nativeOverlay: false, notifications: false });
    await expect(platform.requestNotification()).resolves.toBe('unsupported');
    await expect(platform.scheduleReminder({ todoId: 'todo', instanceId: 'instance', plannedAt: '2026-10-20T01:00:00.000Z', scheduleRevision: 1 })).resolves.toMatchObject({ status: 'unsupported' });
    await expect(platform.cancelReminder({ instanceId: 'instance', scheduleRevision: 1 })).resolves.toMatchObject({ status: 'unsupported' });
    expect(bridge.capabilities).toHaveBeenCalledTimes(1);
  });
  it('仅在显式暴露本地仓储时接线排程、取消和到期派发，并保留系统能力未验证状态', async () => {
    const store = {
      schedule: vi.fn(async () => ({ outcome: 'created' })),
      cancel: vi.fn(async () => ({ status: 'cancelled' })),
      notifyDue: vi.fn(async () => ({ status: 'unsupported', reason: 'permission_unknown' })),
    };
    const bridge = host({ platform: 'windows', reminderStore: store });
    const platform = new NativeHostPlatform(bridge);
    const request = {
      accountId: 'demo-owner',
      todoId: 'todo-1',
      instanceId: '00000000-0000-4000-8000-000000000001',
      plannedAt: '2026-10-20T01:00:00.000Z',
      timezone: 'Asia/Shanghai',
      scheduleRevision: 1,
      deepLink: '/todos/edit/todo-1',
      repeat: 'none' as const,
      channel: 'local' as const,
    };
    await expect(platform.scheduleReminder(request)).resolves.toMatchObject({ status: 'unsupported', persisted: true, nativeStatus: 'created' });
    expect(store.schedule).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'demo-owner', reminderId: 'todo-1', deepLink: 'nuanban://todo/todo-1' }));
    await expect(platform.notifyReminderDue(request, new Date('2026-10-20T01:01:00.000Z'))).resolves.toMatchObject({ status: 'unsupported', persisted: false, nativeStatus: 'unsupported' });
    expect(store.notifyDue).toHaveBeenCalledWith({ accountId: 'demo-owner', reminderId: 'todo-1', now: '2026-10-20T01:01:00.000Z' });
    await expect(platform.cancelReminder({ instanceId: request.instanceId, scheduleRevision: 1 })).resolves.toMatchObject({ status: 'unsupported', persisted: true, nativeStatus: 'cancelled' });
    expect(store.cancel).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'demo-owner', reminderId: 'todo-1', scheduleVersion: 1 }));
  });
  it('未知平台、缺失宿主或不可信能力字段回退安全浏览器边界', () => {
    expect(createPlatform({ ...host(), platform: 'ios' as never }).capabilities.platform).toBe('browser');
    expect(createPlatform(undefined).capabilities.externalCapture).toBe(false);
    expect(createPlatform({ platform: 'android' } as never).capabilities.platform).toBe('browser');
    expect(createPlatform({ ...host(), capabilities: vi.fn(async () => ({ granted: true })), stopAll: vi.fn(async () => ({ stopped: true })) }).capabilities.nativeOverlay).toBe(false);
  });
  it('停止路径只调用白名单 stopAll，宿主异常也清理本机语音', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { cancel });
    const bridge = host({ stopAll: vi.fn(async () => { throw new Error('synthetic host failure'); }) });
    await expect(createPlatform(bridge).stopAll()).rejects.toThrow('synthetic host failure');
    expect(bridge.stopAll).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
  it('宿主返回未确认停止结果时拒绝把生命周期标记为已清理', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { cancel });
    const bridge = host({ stopAll: vi.fn(async () => ({ stopped: false, captureActive: true })) });
    await expect(createPlatform(bridge).stopAll()).rejects.toThrow('未确认捕获和媒体均已停止');
    expect(bridge.stopAll).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
  it('浏览器提醒端口明确是页面级，不冒充系统后台调度', async () => {
    const platform = createPlatform();
    await expect(platform.scheduleReminder({ todoId: 'todo', instanceId: 'instance', plannedAt: '2026-10-20T01:00:00.000Z', scheduleRevision: 1 })).resolves.toMatchObject({ status: 'page_only' });
    await expect(platform.cancelReminder({ instanceId: 'instance', scheduleRevision: 1 })).resolves.toMatchObject({ status: 'page_only' });
  });
});
