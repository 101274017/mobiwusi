import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createDesktopNotificationAdapter } = require('../../apps/desktop/notification-adapter.cjs') as {
  createDesktopNotificationAdapter: (options: Record<string, unknown>) => {
    capability(): Record<string, unknown>;
    submit(input: Record<string, unknown>): Record<string, unknown>;
    dispose(): void;
    activeCount(): number;
  };
};

class FakeNotification extends EventEmitter {
  static supported = true;
  static instances: FakeNotification[] = [];
  static isSupported(): boolean { return FakeNotification.supported; }

  readonly options: Record<string, unknown>;
  closed = false;

  constructor(options: Record<string, unknown>) {
    super();
    this.options = options;
    FakeNotification.instances.push(this);
  }

  show(): void {
    this.emit('show');
  }

  close(): void {
    this.closed = true;
    this.emit('close');
  }
}

const fixture = (overrides: Record<string, unknown> = {}) => ({
  accountId: 'account-a',
  reminderId: 'review-1',
  instanceId: 'instance-1',
  scheduleVersion: 1,
  deepLink: 'nuanban://review/review-1',
  payloadJson: JSON.stringify({ title: '不应进入系统通知正文' }),
  ...overrides,
});

beforeEach(() => {
  FakeNotification.supported = true;
  FakeNotification.instances = [];
});

describe('C08 桌面通知适配器预备层', () => {
  it('未确认系统能力或权限时不创建通知对象', () => {
    const adapter = createDesktopNotificationAdapter({ Notification: FakeNotification, permission: 'unknown' });
    expect(adapter.capability()).toEqual({ capability: 'unsupported', permission: 'unknown', reason: 'notification_permission_unknown' });
    expect(adapter.submit(fixture())).toEqual({ status: 'unsupported', instanceId: 'instance-1', reason: 'notification_permission_unknown' });
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it('显式提交后记录 submitted/show/click 回执并只打开受限内部深链', () => {
    const receipts: Array<Record<string, unknown>> = [];
    const opened: Array<Record<string, unknown>> = [];
    const adapter = createDesktopNotificationAdapter({
      Notification: FakeNotification,
      permission: 'granted',
      clock: () => new Date('2026-10-16T08:00:00.000Z'),
      onReceipt: (event: Record<string, unknown>) => receipts.push(event),
      onOpen: (event: Record<string, unknown>) => opened.push(event),
    });

    expect(adapter.submit(fixture())).toEqual({ status: 'submitted', instanceId: 'instance-1' });
    expect(receipts.map(item => item.state)).toEqual(['submitted', 'delivered']);
    expect(FakeNotification.instances[0].options.body).toBe('有一项提醒到期，请打开微光指引查看。');
    expect(FakeNotification.instances[0].options.body).not.toContain('不应进入系统通知正文');

    FakeNotification.instances[0].emit('click');
    FakeNotification.instances[0].emit('click');
    expect(receipts.map(item => item.state)).toEqual(['submitted', 'delivered', 'opened']);
    expect(opened).toEqual([expect.objectContaining({ instanceId: 'instance-1', deepLink: 'nuanban://review/review-1' })]);
  });

  it('failed 回执不会抛出供应商错误，并释放活动通知实例', () => {
    const receipts: string[] = [];
    const adapter = createDesktopNotificationAdapter({
      Notification: FakeNotification,
      permission: 'granted',
      onReceipt: (event: { state: string }) => receipts.push(event.state),
    });

    expect(adapter.submit(fixture())).toEqual({ status: 'submitted', instanceId: 'instance-1' });
    FakeNotification.instances[0].emit('failed', new Error('system failure'));
    expect(receipts).toEqual(['submitted', 'delivered', 'failed']);
    expect(adapter.activeCount()).toBe(0);
  });

  it('同一活动实例幂等，内容冲突和外部链接拒绝', () => {
    const adapter = createDesktopNotificationAdapter({ Notification: FakeNotification, permission: 'granted' });
    expect(adapter.submit(fixture())).toEqual({ status: 'submitted', instanceId: 'instance-1' });
    expect(adapter.submit(fixture())).toEqual({ status: 'idempotent', instanceId: 'instance-1' });
    expect(() => adapter.submit(fixture({ deepLink: 'nuanban://todo/todo-1' }))).toThrowError(/different content/);
    expect(() => adapter.submit(fixture({ instanceId: 'instance-2', deepLink: 'https://example.invalid' }))).toThrowError(/internal link/);
  });

  it('dispose 只关闭当前适配器持有的通知，不启动任何后台计时器', () => {
    const adapter = createDesktopNotificationAdapter({ Notification: FakeNotification, permission: 'granted' });
    adapter.submit(fixture());
    adapter.dispose();
    expect(FakeNotification.instances[0].closed).toBe(true);
    expect(adapter.activeCount()).toBe(0);
  });
});
