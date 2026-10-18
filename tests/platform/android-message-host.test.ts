import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAndroidMessageHost, createPlatform, NativeHostPlatform, type AndroidHostBridge, type AndroidMessageChannel } from '@nuanban/platform-ports';
import { isBridgeMessage, type BridgeMessage } from '@nuanban/contracts';

const hosts: AndroidHostBridge[] = [];
function setup(requestId?: () => string) {
  const sent: BridgeMessage[] = [];
  const lifecycle = new EventTarget();
  const channel: AndroidMessageChannel = { postMessage: vi.fn(message => sent.push(JSON.parse(message))) };
  let sequence = 0;
  const host = createAndroidMessageHost({ channel, origin: 'https://appassets.androidplatform.net', mainFrame: true, lifecycle, requestId: requestId ?? (() => 'synthetic-request-' + ++sequence), timeoutMs: 50 })!;
  hosts.push(host);
  function reply(message: BridgeMessage, changes: Record<string, unknown> = {}) {
    const correlation = { request_id: message.request_id, generation: message.generation };
    const result = 'error_code' in changes
      ? { ...correlation, ...changes }
      : message.method === 'capabilities'
      ? { ...correlation, platform: 'android', externalCapture: false, nativeOverlay: false, remoteMedia: false, status: 'native-skeleton' }
      : message.method === 'stop_all'
        ? { ...correlation, stopped: true, captureActive: false }
        : message.method === 'reminder_schedule'
          ? { ...correlation, outcome: 'created', status: 'unsupported', reason: 'permission_unknown' }
          : message.method === 'reminder_cancel'
            ? { ...correlation, status: 'cancelled', reason: 'cancelled' }
            : { ...correlation, status: 'submitted', reason: 'submitted' };
    channel.onmessage?.({ data: JSON.stringify({ ...result, ...changes }) });
  }
  return { host, channel, sent, reply, lifecycle };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { for (const host of hosts.splice(0)) host.dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Android 活动消息桥：关联、提醒操作、停止与清理', () => {
  it('只绑定可信本地 HTTPS 主框架，不覆盖其他消息处理器', () => {
    const channel: AndroidMessageChannel = { postMessage: vi.fn() };
    for (const origin of ['http://appassets.androidplatform.net', 'https://example.invalid', 'https://appassets.androidplatform.net.example.invalid', 'http://127.0.0.1:5173']) expect(createAndroidMessageHost({ channel, origin, mainFrame: true })).toBeUndefined();
    expect(createAndroidMessageHost({ channel, origin: 'https://appassets.androidplatform.net', mainFrame: false })).toBeUndefined();
    channel.onmessage = vi.fn();
    const existing = channel.onmessage;
    expect(createAndroidMessageHost({ channel, origin: 'https://appassets.androidplatform.net', mainFrame: true })).toBeUndefined();
    expect(channel.onmessage).toBe(existing);
    expect(channel.postMessage).not.toHaveBeenCalled();
  });
  it('生命周期监听器装配失败时回滚消息处理器，不留下半初始化桥', () => {
    const channel: AndroidMessageChannel = { postMessage: vi.fn() };
    const lifecycle = {
      addEventListener: vi.fn(() => { throw new Error('synthetic lifecycle failure'); }),
      removeEventListener: vi.fn(),
    };

    expect(createAndroidMessageHost({ channel, origin: 'https://appassets.androidplatform.net', mainFrame: true, lifecycle })).toBeUndefined();
    expect(channel.onmessage).toBeUndefined();
    expect(lifecycle.removeEventListener).toHaveBeenCalledTimes(1);
    expect(channel.postMessage).not.toHaveBeenCalled();
  });
  it('只发送严格请求并等待关联的安全回复，不自动授予高风险能力', async () => {
    const { host, sent, reply } = setup();
    const pending = host.capabilities();
    expect(isBridgeMessage(sent[0])).toBe(true);
    expect(sent[0]).toMatchObject({ version: 1, generation: 0, method: 'capabilities' });
    reply(sent[0]);
    await expect(pending).resolves.toMatchObject({ externalCapture: false, nativeOverlay: false, remoteMedia: false });
    expect(vi.getTimerCount()).toBe(0);
    const platform = createPlatform(host);
    expect(platform).toBeInstanceOf(NativeHostPlatform);
    expect(platform.capabilities).toEqual({ platform: 'android', externalCapture: false, nativeOverlay: false, remoteMedia: false, notifications: false });
    await Promise.resolve();
    reply(sent[1]);
    await expect(platform.requestNotification()).resolves.toBe('unsupported');
  });
  it('只通过白名单桥发送受限提醒字段，并把宿主错误转成拒绝', async () => {
    const { host, sent, reply } = setup();
    const input = {
      accountId: 'demo-owner',
      reminderId: 'todo-1',
      todoId: '00000000-0000-4000-8000-000000000001',
      instanceId: '00000000-0000-4000-8000-000000000002',
      scheduleVersion: 1,
      dueAt: '2026-10-20T01:00:00.000Z',
      timezone: 'Asia/Shanghai',
      deepLink: '/todos/edit/todo-1',
      repeatRule: 'none' as const,
      channel: 'local' as const,
      payload: { kind: 'review-reminder' },
      updatedAt: '2026-10-16T01:00:00.000Z',
    };
    const pending = host.reminderStore!.schedule(input);
    expect(isBridgeMessage(sent[0])).toBe(true);
    expect(sent[0]).toMatchObject({ method: 'reminder_schedule', account_id: 'demo-owner', todo_id: input.todoId, payload: { kind: 'review-reminder' } });
    reply(sent[0]);
    await expect(pending).resolves.toMatchObject({ outcome: 'created', status: 'unsupported' });
    const failed = host.reminderStore!.notifyDue({ accountId: 'demo-owner', reminderId: 'todo-1', now: input.dueAt });
    reply(sent[1], { error_code: 'scheduler_error', message: 'permission_unknown' });
    await expect(failed).rejects.toThrow('permission_unknown');
  });
  it('同步回复也不会丢失，消息注册先于发送', async () => {
    const channel: AndroidMessageChannel = { postMessage: message => { const request = JSON.parse(message); channel.onmessage?.({ data: JSON.stringify({ request_id: request.request_id, generation: request.generation, stopped: true, captureActive: false }) }); } };
    const host = createAndroidMessageHost({ channel, origin: 'https://appassets.androidplatform.net', mainFrame: true, requestId: () => 'sync-stop' })!;
    hosts.push(host);
    await expect(host.stopAll()).resolves.toMatchObject({ stopped: true });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('停止提升代际、拒绝旧请求，并合并同时发起的停止', async () => {
    const { host, sent, reply } = setup();
    const old = host.capabilities();
    const cancelled = expect(old).rejects.toThrow('cancelled by stop');
    const stop = host.stopAll();
    expect(host.stopAll()).toBe(stop);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ method: 'stop_all', generation: 1 });
    reply(sent[0]);
    reply(sent[1]);
    await cancelled;
    await expect(stop).resolves.toMatchObject({ stopped: true, captureActive: false });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('停止回执返回前形成桥接 stop fence，拒绝新的普通请求', async () => {
    const { host, sent, reply } = setup();
    const stop = host.stopAll();

    await expect(host.capabilities()).rejects.toThrow('stopping');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ method: 'stop_all', generation: 1 });

    reply(sent[0]);
    await expect(stop).resolves.toMatchObject({ stopped: true, captureActive: false });

    const capability = host.capabilities();
    expect(sent).toHaveLength(2);
    reply(sent[1]);
    await expect(capability).resolves.toMatchObject({ platform: 'android' });
  });
  it('停止失败后阻断普通请求，只允许显式 stop_all 重试解除阻断', async () => {
    const { host, sent, reply } = setup();
    const failedStop = host.stopAll();
    const timeout = expect(failedStop).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(51);
    await timeout;
    await expect(host.capabilities()).rejects.toThrow('cleanup failed');

    const retry = host.stopAll();
    expect(sent[1]).toMatchObject({ method: 'stop_all', generation: 2 });
    reply(sent[1]);
    await expect(retry).resolves.toMatchObject({ stopped: true, captureActive: false });

    const capability = host.capabilities();
    reply(sent[2]);
    await expect(capability).resolves.toMatchObject({ platform: 'android' });
  });
  it('重试停止时忽略上一代迟到回执，不兑现新代际请求', async () => {
    const { host, sent, reply } = setup();
    const failedStop = host.stopAll();
    const failed = expect(failedStop).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(51);
    await failed;

    const retry = host.stopAll();
    expect(sent[1]).toMatchObject({ method: 'stop_all', generation: 2 });
    reply(sent[0]);
    expect(vi.getTimerCount()).toBe(1);
    reply(sent[1]);
    await expect(retry).resolves.toMatchObject({ stopped: true, captureActive: false });
  });
  it('页面离开期间停止请求也会结束为失败而不是悬挂', async () => {
    const { host, lifecycle } = setup();
    const stop = host.stopAll();
    lifecycle.dispatchEvent(new Event('pagehide'));
    await expect(stop).rejects.toThrow('disposed');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('错请求、错代际、非字符串与迟到回复不兑现当前请求', async () => {
    const { host, channel, sent, reply } = setup();
    const pending = host.capabilities();
    const timeout = expect(pending).rejects.toThrow('timeout');
    reply(sent[0], { request_id: 'other-request' });
    reply(sent[0], { generation: 1 });
    channel.onmessage?.({ data: {} });
    channel.onmessage?.({ data: 'not-json' });
    channel.onmessage?.({ data: 'x'.repeat(4097) });
    await vi.advanceTimersByTimeAsync(51);
    await timeout;
    reply(sent[0]);
    expect(sent).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([{ externalCapture: true }, { nativeOverlay: true }, { remoteMedia: true }, { granted: true }, { status: 'ready' }, { generation: '0' }])('拒绝伪造/未知安全字段而不扩大能力：%j', async changes => {
    const { host, sent, reply } = setup();
    const pending = host.capabilities();
    const rejected = expect(pending).rejects.toThrow(changes.generation ? 'timeout' : 'Invalid native bridge reply');
    reply(sent[0], changes);
    await vi.advanceTimersByTimeAsync(51);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('停止回复不能伪装成能力回复，也不能声称仍在采集', async () => {
    const { host, channel, sent, reply } = setup();
    const capability = host.capabilities();
    const invalid = expect(capability).rejects.toThrow('Invalid native bridge reply');
    channel.onmessage?.({ data: JSON.stringify({ request_id: sent[0].request_id, generation: 0, stopped: true, captureActive: false }) });
    await invalid;
    const stopped = host.stopAll();
    const rejected = expect(stopped).rejects.toThrow('Invalid native bridge reply');
    reply(sent[1], { captureActive: true });
    await rejected;
  });
  it('页面离开立即拒绝待处理请求、恢复处理器并隔离旧回调', async () => {
    const { host, channel, sent, reply, lifecycle } = setup();
    const pending = host.capabilities();
    const rejected = expect(pending).rejects.toThrow('disposed');
    const oldHandler = channel.onmessage;
    lifecycle.dispatchEvent(new Event('pagehide'));
    expect(channel.onmessage).toBeUndefined();
    reply(sent[0]);
    oldHandler?.({ data: JSON.stringify({ request_id: sent[0].request_id, generation: 0 }) });
    await rejected;
    await expect(host.stopAll()).rejects.toThrow('unavailable');
    host.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('重复 ID、发送异常与队列上限均不泄漏计时器或载荷', async () => {
    const { host, sent, reply } = setup(() => 'duplicate-id');
    const first = host.capabilities();
    await expect(host.capabilities()).rejects.toThrow('correlation');
    reply(sent[0]);
    await first;
    await expect(host.capabilities()).rejects.toThrow('correlation');
    const failing = setup();
    vi.mocked(failing.channel.postMessage).mockImplementation(() => { throw new Error('SYNTHETIC-PRIVATE-PAYLOAD'); });
    await expect(failing.host.capabilities()).rejects.toThrow('Native bridge send failed');
    const queued = setup();
    const waiting = Array.from({ length: 8 }, () => queued.host.capabilities());
    const results = Promise.allSettled(waiting);
    await expect(queued.host.capabilities()).rejects.toThrow('unavailable');
    queued.host.dispose();
    expect((await results).every(result => result.status === 'rejected')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('只在实际受信页面自动装配 Android 宿主', async () => {
    const channel: AndroidMessageChannel = { postMessage: vi.fn() };
    const lifecycle = new EventTarget();
    const fakeWindow = { nuanbanBridge: channel, location: { origin: 'https://appassets.androidplatform.net' }, top: null as unknown, addEventListener: lifecycle.addEventListener.bind(lifecycle), removeEventListener: lifecycle.removeEventListener.bind(lifecycle) };
    fakeWindow.top = fakeWindow;
    vi.stubGlobal('window', fakeWindow);
    const platform = createPlatform();
    expect(platform.capabilities.platform).toBe('android');
    await Promise.resolve();
    expect(channel.postMessage).toHaveBeenCalledTimes(1);
    lifecycle.dispatchEvent(new Event('pagehide'));
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });
});
