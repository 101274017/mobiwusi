import { describe, expect, it, vi } from 'vitest';
import { ReminderRuntime, type PermissionState, type PlatformPort, type ReminderPlatformResult, type ReminderRuntimeTodo } from '@nuanban/platform-ports';

const todoId = '00000000-0000-4000-8000-000000000201';

function todo(overrides: Partial<ReminderRuntimeTodo> = {}): ReminderRuntimeTodo {
  return {
    id: todoId,
    title: '复习字体',
    dueAt: '2026-10-20T01:00:00.000Z',
    timezone: 'Asia/Shanghai',
    noteId: '00000000-0000-4000-8000-000000000202',
    repeat: 'none',
    version: 1,
    completedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function platform(log: string[], failCancel = false): PlatformPort {
  return {
    capabilities: { platform: 'browser', externalCapture: false, remoteMedia: false, nativeOverlay: false, notifications: false },
    stopAll: vi.fn(async () => undefined),
    requestNotification: vi.fn(async (): Promise<PermissionState> => 'unsupported'),
    scheduleReminder: vi.fn(async (request: Parameters<PlatformPort['scheduleReminder']>[0]): Promise<ReminderPlatformResult> => { log.push(`schedule:${request.scheduleRevision}:${request.instanceId}`); return { status: 'page_only', reason: 'page_only' }; }),
    cancelReminder: vi.fn(async (request: Parameters<PlatformPort['cancelReminder']>[0]): Promise<ReminderPlatformResult> => { log.push(`cancel:${request.scheduleRevision}:${request.instanceId}`); if (failCancel) throw new Error('cancel failed'); return { status: 'page_only', reason: 'page_only' }; }),
  };
}

describe('C07/C08 共享提醒运行时装配', () => {
  it('使用稳定实例排程，重复同步不重复调用，并只触发一次页面到期事件', async () => {
    const log: string[] = [];
    const due: string[] = [];
    const runtime = new ReminderRuntime('demo-owner', platform(log), { onDue: event => due.push(event.request.instanceId) });
    const item = todo({ dueAt: '2026-10-20T00:00:00.000Z' });

    const first = await runtime.sync([item], new Date('2026-10-20T01:00:00.000Z'));
    const second = await runtime.sync([item], new Date('2026-10-20T01:01:00.000Z'));

    expect(first).toMatchObject({ scheduled: 1, due: 1, failures: 0 });
    expect(second).toMatchObject({ unchanged: 1, due: 0, failures: 0 });
    expect(log).toHaveLength(1);
    expect(due).toHaveLength(1);
    expect(runtime.snapshot()).toEqual({ registered: 1, stopped: false });
  });

  it('排程版本变化先取消旧实例，再安排新实例；删除和完成会取消注册', async () => {
    const log: string[] = [];
    const runtime = new ReminderRuntime('demo-owner', platform(log));
    const first = todo();
    await runtime.sync([first], new Date('2026-10-19T00:00:00.000Z'));
    await runtime.sync([todo({ version: 2, dueAt: '2026-10-21T01:00:00.000Z' })], new Date('2026-10-19T00:00:00.000Z'));
    await runtime.sync([todo({ version: 2, dueAt: '2026-10-21T01:00:00.000Z', completedAt: '2026-10-19T01:00:00.000Z' })], new Date('2026-10-19T00:00:00.000Z'));

    expect(log[0]).toMatch(/^schedule:1:/);
    expect(log[1]).toMatch(/^cancel:1:/);
    expect(log[2]).toMatch(/^schedule:2:/);
    expect(log[3]).toMatch(/^cancel:2:/);
    expect(runtime.snapshot()).toEqual({ registered: 0, stopped: false });
  });

  it('停止会取消当前注册，之后同步不会自动恢复', async () => {
    const log: string[] = [];
    const runtime = new ReminderRuntime('demo-owner', platform(log));
    await runtime.sync([todo()], new Date('2026-10-19T00:00:00.000Z'));
    await expect(runtime.stop()).resolves.toEqual({ cancelled: 1, failures: 0, stopped: true });
    await expect(runtime.sync([todo()], new Date('2026-10-19T00:00:00.000Z'))).resolves.toEqual({ scheduled: 0, unchanged: 0, cancelled: 0, due: 0, failures: 0 });
    expect(log).toHaveLength(2);
  });

  it('旧实例取消失败时阻止新版本排程，避免重复提醒', async () => {
    const log: string[] = [];
    const failures: string[] = [];
    const runtime = new ReminderRuntime('demo-owner', platform(log, true), { onError: failure => failures.push(failure.phase) });
    await runtime.sync([todo()], new Date('2026-10-19T00:00:00.000Z'));
    const report = await runtime.sync([todo({ version: 2 })], new Date('2026-10-19T00:00:00.000Z'));

    expect(report).toMatchObject({ scheduled: 0, cancelled: 0, failures: 1 });
    expect(log).toHaveLength(2);
    expect(log[1]).toMatch(/^cancel:1:/);
    expect(failures).toEqual(['cancel']);
    expect(runtime.snapshot()).toEqual({ registered: 1, stopped: false });
  });
});
