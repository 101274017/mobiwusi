import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createDesktopReminderStore } = require('../../apps/desktop/reminder-store.cjs') as {
  createDesktopReminderStore: (options: { databasePath: string }) => {
    schedule(input: Record<string, unknown>): Record<string, unknown>;
    read(accountId: string, reminderId: string): Record<string, unknown> | null;
    cancel(input: Record<string, unknown>): Record<string, unknown>;
    close(): void;
  };
};
const { createDesktopReminderNotificationBridge } = require('../../apps/desktop/reminder-notification-bridge.cjs') as {
  createDesktopReminderNotificationBridge: (options: Record<string, unknown>) => {
    capability(): Record<string, unknown>;
    notifyDue(input: Record<string, unknown>): Record<string, unknown>;
    dispose(): void;
  };
};

class FakeNotification extends EventEmitter {
  static supported = true;
  static instances: FakeNotification[] = [];
  static isSupported(): boolean { return FakeNotification.supported; }

  constructor(readonly options: Record<string, unknown>) {
    super();
    FakeNotification.instances.push(this);
  }

  show(): void { this.emit('show'); }
  close(): void { this.emit('close'); }
}

const fixture = (overrides: Record<string, unknown> = {}) => ({
  accountId: 'account-a',
  reminderId: 'review-1',
  instanceId: 'instance-1',
  scheduleVersion: 1,
  dueAt: '2026-10-16T00:00:00.000Z',
  deepLink: 'nuanban://review/review-1',
  payload: { title: '本地提醒' },
  updatedAt: '2026-10-15T00:00:00.000Z',
  ...overrides,
});

function withStore(run: (store: ReturnType<typeof createDesktopReminderStore>) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'nuanban-desktop-reminder-bridge-'));
  const store = createDesktopReminderStore({ databasePath: join(root, 'reminders.sqlite') });
  try { run(store); } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
}

beforeEach(() => {
  FakeNotification.supported = true;
  FakeNotification.instances = [];
});

describe('C08 桌面提醒通知主进程桥预备层', () => {
  it('能力或权限未确认时不提交提醒，也不改变仓储状态', () => withStore(store => {
    store.schedule(fixture());
    const bridge = createDesktopReminderNotificationBridge({
      store,
      Notification: FakeNotification,
      getPermission: () => 'unknown',
    });
    expect(bridge.notifyDue({ accountId: 'account-a', reminderId: 'review-1', now: '2026-10-16T00:01:00.000Z' })).toMatchObject({ status: 'unsupported' });
    expect(store.read('account-a', 'review-1')?.status).toBe('scheduled');
    expect(FakeNotification.instances).toHaveLength(0);
    bridge.dispose();
  }));

  it('到期提醒持久化 submitted/delivered/opened，并把受限深链交给渲染器', () => withStore(store => {
    store.schedule(fixture());
    const opened: Array<Record<string, unknown>> = [];
    const bridge = createDesktopReminderNotificationBridge({
      store,
      Notification: FakeNotification,
      getPermission: () => 'granted',
      clock: () => new Date('2026-10-16T00:01:00.000Z'),
      sendOpen: (event: Record<string, unknown>) => opened.push(event),
    });
    expect(bridge.notifyDue({ accountId: 'account-a', reminderId: 'review-1' })).toMatchObject({ status: 'submitted', instanceId: 'instance-1' });
    expect(store.read('account-a', 'review-1')).toMatchObject({ status: 'delivered', submittedAt: '2026-10-16T00:01:00.000Z' });
    FakeNotification.instances[0].emit('click');
    expect(store.read('account-a', 'review-1')?.status).toBe('opened');
    expect(opened).toEqual([{ accountId: 'account-a', reminderId: 'review-1', instanceId: 'instance-1', deepLink: 'nuanban://review/review-1' }]);
    bridge.dispose();
  }));

  it('未到期提醒不提前提交，取消或已终态提醒不创建通知', () => withStore(store => {
    store.schedule(fixture());
    const bridge = createDesktopReminderNotificationBridge({ store, Notification: FakeNotification, getPermission: () => 'granted' });
    expect(bridge.notifyDue({ accountId: 'account-a', reminderId: 'review-1', now: '2026-10-15T23:59:00.000Z' })).toMatchObject({ status: 'not_due' });
    expect(store.read('account-a', 'review-1')?.status).toBe('scheduled');
    store.cancel({ accountId: 'account-a', reminderId: 'review-1', scheduleVersion: 1, updatedAt: '2026-10-15T23:59:30.000Z' });
    expect(bridge.notifyDue({ accountId: 'account-a', reminderId: 'review-1', now: '2026-10-16T00:01:00.000Z' })).toMatchObject({ status: 'not_scheduled', reason: 'cancelled' });
    expect(FakeNotification.instances).toHaveLength(0);
    bridge.dispose();
  }));

  it('系统通知失败时保存 failed 回执并释放活动对象', () => withStore(store => {
    store.schedule(fixture());
    const bridge = createDesktopReminderNotificationBridge({
      store,
      Notification: FakeNotification,
      getPermission: () => 'granted',
      clock: () => new Date('2026-10-16T00:01:00.000Z'),
    });
    bridge.notifyDue({ accountId: 'account-a', reminderId: 'review-1' });
    FakeNotification.instances[0].emit('failed', new Error('synthetic system failure'));
    expect(store.read('account-a', 'review-1')).toMatchObject({ status: 'failed', failedAt: '2026-10-16T00:01:00.000Z' });
    bridge.dispose();
  }));

  it('旧排程通知点击不能写入新排程或发送路由', () => withStore(store => {
    store.schedule(fixture());
    const opened: Array<Record<string, unknown>> = [];
    const bridge = createDesktopReminderNotificationBridge({
      store,
      Notification: FakeNotification,
      getPermission: () => 'granted',
      clock: () => new Date('2026-10-16T00:01:00.000Z'),
      sendOpen: (event: Record<string, unknown>) => opened.push(event),
    });

    expect(bridge.notifyDue({ accountId: 'account-a', reminderId: 'review-1' })).toMatchObject({ status: 'submitted', instanceId: 'instance-1' });
    store.schedule(fixture({ instanceId: 'instance-2', scheduleVersion: 2, dueAt: '2026-10-17T00:00:00.000Z', updatedAt: '2026-10-16T00:02:00.000Z' }));
    FakeNotification.instances[0].emit('click');

    expect(opened).toEqual([]);
    expect(store.read('account-a', 'review-1')).toMatchObject({ instanceId: 'instance-2', scheduleVersion: 2, status: 'scheduled' });
    bridge.dispose();
  }));
});
