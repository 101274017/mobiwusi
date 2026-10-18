import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createDesktopReminderStore, createSafeStoragePayloadCodec } = require('../../apps/desktop/reminder-store.cjs') as {
  createDesktopReminderStore: (options: { databasePath: string; payloadCodec?: Record<string, unknown> }) => {
    schedule(input: Record<string, unknown>): { outcome: string; reminder: Record<string, unknown> };
    read(accountId: string, reminderId: string): Record<string, unknown> | null;
    list(accountId: string): Record<string, unknown>[];
    cancel(input: Record<string, unknown>): Record<string, unknown>;
    submitDue(input: Record<string, unknown>): boolean;
    recordReceipt(input: Record<string, unknown>): Record<string, unknown>;
    complete(input: Record<string, unknown>): Record<string, unknown>;
    encryptedReminderPayload: boolean;
    close(): void;
  };
  createSafeStoragePayloadCodec: (safeStorage: {
    isEncryptionAvailable(): boolean;
    encryptString(value: string): Buffer;
    decryptString(value: Buffer): string;
  }) => {
    encrypted: boolean;
    encode(value: string): string;
    decode(value: string): string;
  };
};

const fixture = (overrides: Record<string, unknown> = {}) => ({
  accountId: 'account-a',
  reminderId: 'review-1',
  instanceId: 'instance-1',
  scheduleVersion: 1,
  dueAt: '2026-10-16T00:00:00Z',
  deepLink: 'nuanban://review/review-1',
  payload: { title: '复习第一张卡' },
  updatedAt: '2026-10-16T00:00:00Z',
  ...overrides,
});

function withStore(callback: (store: ReturnType<typeof createDesktopReminderStore>) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'nuanban-desktop-reminders-'));
  const store = createDesktopReminderStore({ databasePath: join(root, 'reminders.sqlite') });
  try { callback(store); } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
}

describe('C08 Electron SQLite 本地提醒仓储', () => {
  it('按账号隔离并在关闭重开后保留记录', () => {
    const root = mkdtempSync(join(tmpdir(), 'nuanban-desktop-reminders-reopen-'));
    const databasePath = join(root, 'reminders.sqlite');
    const first = createDesktopReminderStore({ databasePath });
    first.schedule(fixture());
    first.close();
    const metadataDatabase = new DatabaseSync(databasePath);
    const metadata = metadataDatabase.prepare('SELECT version FROM reminder_store_meta WHERE name = ?').get('reminder_store') as { version: number };
    expect(metadata.version).toBe(2);
    metadataDatabase.close();
    const second = createDesktopReminderStore({ databasePath });
    expect(second.list('account-a')).toHaveLength(1);
    expect(second.list('account-b')).toEqual([]);
    second.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('将 v1 旧库迁移到 v2，并保留已有提醒数据', () => {
    const root = mkdtempSync(join(tmpdir(), 'nuanban-desktop-reminders-migration-'));
    const databasePath = join(root, 'reminders.sqlite');
    const legacy = new DatabaseSync(databasePath);
    legacy.exec(`
      CREATE TABLE reminder_store_meta (name TEXT PRIMARY KEY, version INTEGER NOT NULL);
      INSERT INTO reminder_store_meta (name, version) VALUES ('reminder_store', 1);
      CREATE TABLE reminder_schedule (
        account_id TEXT NOT NULL,
        reminder_id TEXT NOT NULL,
        instance_id TEXT NOT NULL,
        schedule_version INTEGER NOT NULL,
        due_at TEXT NOT NULL,
        deep_link TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (account_id, reminder_id)
      );
      INSERT INTO reminder_schedule
        (account_id, reminder_id, instance_id, schedule_version, due_at, deep_link, status, payload_json, created_at, updated_at)
      VALUES ('account-a', 'review-1', 'instance-1', 1, '2026-10-16T00:00:00Z', 'nuanban://review/review-1', 'submitted', '{"title":"旧库提醒"}', '2026-10-15T00:00:00Z', '2026-10-16T00:01:00Z');
    `);
    legacy.close();

    const store = createDesktopReminderStore({ databasePath });
    expect(store.read('account-a', 'review-1')).toMatchObject({ status: 'submitted', payloadJson: '{"title":"旧库提醒"}' });
    const database = new DatabaseSync(databasePath);
    const columns = database.prepare('PRAGMA table_info(reminder_schedule)').all().map(row => row.name);
    const metadata = database.prepare('SELECT version FROM reminder_store_meta WHERE name = ?').get('reminder_store') as { version: number };
    expect(columns).toEqual(expect.arrayContaining(['submitted_at', 'completed_at', 'cancelled_at']));
    expect(metadata.version).toBe(2);
    database.close();
    store.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('同版本重放幂等，旧版本和内容冲突拒绝覆盖', () => withStore(store => {
    expect(store.schedule(fixture()).outcome).toBe('created');
    expect(store.schedule(fixture()).outcome).toBe('idempotent');
    expect(() => store.schedule(fixture({ scheduleVersion: 0 }))).toThrowError(/invalid/);
    expect(() => store.schedule(fixture({ scheduleVersion: 1, dueAt: '2026-10-17T00:00:00Z' }))).toThrowError(/different content/);
    expect(() => store.schedule(fixture({ scheduleVersion: 2, instanceId: 'instance-2' }))).not.toThrow();
    expect(() => store.schedule(fixture({ scheduleVersion: 1, instanceId: 'instance-1' }))).toThrowError(/older/);
  }));

  it('取消、到期提交、回执和完成按状态顺序持久化', () => withStore(store => {
    store.schedule(fixture());
    expect(store.submitDue({ accountId: 'account-a', reminderId: 'review-1', now: '2026-10-16T00:01:00Z' })).toBe(true);
    expect(store.read('account-a', 'review-1')?.submittedAt).toBe('2026-10-16T00:01:00Z');
    expect(store.recordReceipt({ accountId: 'account-a', reminderId: 'review-1', state: 'delivered', observedAt: '2026-10-16T00:01:01Z' }).status).toBe('delivered');
    expect(store.read('account-a', 'review-1')?.deliveredAt).toBe('2026-10-16T00:01:01Z');
    expect(store.recordReceipt({ accountId: 'account-a', reminderId: 'review-1', state: 'opened', observedAt: '2026-10-16T00:01:02Z' }).status).toBe('opened');
    expect(store.complete({ accountId: 'account-a', reminderId: 'review-1', completedAt: '2026-10-16T00:02:00Z' }).status).toBe('completed');
    expect(store.read('account-a', 'review-1')?.completedAt).toBe('2026-10-16T00:02:00Z');
    expect(store.submitDue({ accountId: 'account-a', reminderId: 'review-1', now: '2026-10-16T00:03:00Z' })).toBe(false);
  }));

  it('拒绝倒退的回执时间，并保留已确认的最新状态', () => withStore(store => {
    store.schedule(fixture());
    store.submitDue({ accountId: 'account-a', reminderId: 'review-1', now: '2026-10-16T00:01:00Z' });
    store.recordReceipt({ accountId: 'account-a', reminderId: 'review-1', state: 'delivered', observedAt: '2026-10-16T00:01:02Z' });
    expect(() => store.recordReceipt({ accountId: 'account-a', reminderId: 'review-1', state: 'opened', observedAt: '2026-10-16T00:01:01Z' })).toThrowError(/cannot move backwards/);
    expect(store.read('account-a', 'review-1')).toMatchObject({ status: 'delivered', deliveredAt: '2026-10-16T00:01:02Z' });
  }));

  it('取消后到期提交不会重新激活提醒', () => withStore(store => {
    store.schedule(fixture());
    expect(store.cancel({ accountId: 'account-a', reminderId: 'review-1', scheduleVersion: 1, updatedAt: '2026-10-15T23:59:00Z' }).status).toBe('cancelled');
    expect(store.read('account-a', 'review-1')?.cancelledAt).toBe('2026-10-15T23:59:00Z');
    expect(store.submitDue({ accountId: 'account-a', reminderId: 'review-1', now: '2026-10-16T00:01:00Z' })).toBe(false);
  }));

  it('到期提交、回执和完成可绑定实例与版本，旧实例不能污染当前排程', () => withStore(store => {
    store.schedule(fixture());
    expect(store.submitDue({ accountId: 'account-a', reminderId: 'review-1', instanceId: 'stale-instance', scheduleVersion: 1, now: '2026-10-16T00:01:00Z' })).toBe(false);
    expect(store.read('account-a', 'review-1')?.status).toBe('scheduled');
    expect(() => store.recordReceipt({ accountId: 'account-a', reminderId: 'review-1', instanceId: 'stale-instance', scheduleVersion: 1, state: 'submitted', observedAt: '2026-10-16T00:01:00Z' })).toThrowError(/no longer current/);

    expect(store.submitDue({ accountId: 'account-a', reminderId: 'review-1', instanceId: 'instance-1', scheduleVersion: 1, now: '2026-10-16T00:01:00Z' })).toBe(true);
    store.recordReceipt({ accountId: 'account-a', reminderId: 'review-1', instanceId: 'instance-1', scheduleVersion: 1, state: 'delivered', observedAt: '2026-10-16T00:01:01Z' });
    expect(() => store.complete({ accountId: 'account-a', reminderId: 'review-1', instanceId: 'stale-instance', scheduleVersion: 1, completedAt: '2026-10-16T00:01:02Z' })).toThrowError(/no longer current/);
    expect(store.read('account-a', 'review-1')?.status).toBe('delivered');
  }));

  it('拒绝外部深链和不可序列化资料', () => withStore(store => {
    expect(() => store.schedule(fixture({ deepLink: 'https://example.invalid' }))).toThrowError(/internal deep link/);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => store.schedule(fixture({ payload: circular }))).toThrowError(/serializable/);
  }));

  it('只加密 payload，关闭重开后仍能解码，SQLite 元数据保持可读', () => {
    const root = mkdtempSync(join(tmpdir(), 'nuanban-desktop-reminders-encrypted-'));
    const databasePath = join(root, 'reminders.sqlite');
    const safeStorage = {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) => Buffer.from(`cipher:${value}`, 'utf8'),
      decryptString: (value: Buffer) => value.toString('utf8').replace(/^cipher:/, ''),
    };
    const payloadCodec = createSafeStoragePayloadCodec(safeStorage);
    const first = createDesktopReminderStore({ databasePath, payloadCodec });
    expect(first.encryptedReminderPayload).toBe(true);
    expect(first.schedule(fixture()).reminder.payloadJson).toBe(JSON.stringify({ title: '复习第一张卡' }));
    first.close();

    const database = new DatabaseSync(databasePath);
    const row = database.prepare('SELECT status, payload_json FROM reminder_schedule WHERE account_id = ? AND reminder_id = ?').get('account-a', 'review-1') as { status: string; payload_json: string };
    expect(row.status).toBe('scheduled');
    expect(row.payload_json).toMatch(/^safe-v1:/);
    expect(row.payload_json).not.toContain('复习第一张卡');
    database.close();

    const second = createDesktopReminderStore({ databasePath, payloadCodec });
    expect(second.read('account-a', 'review-1')?.payloadJson).toBe(JSON.stringify({ title: '复习第一张卡' }));
    second.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('safeStorage 不可用时不伪称加密，遇到已有密文则拒绝读取', () => {
    const unavailable = createSafeStoragePayloadCodec({
      isEncryptionAvailable: () => false,
      encryptString: value => Buffer.from(value, 'utf8'),
      decryptString: value => value.toString('utf8'),
    });
    expect(unavailable.encrypted).toBe(false);
    expect(unavailable.encode('{"title":"明文回退"}')).toBe('{"title":"明文回退"}');
    expect(() => unavailable.decode('safe-v1:Y2lwaGVy')).toThrowError(/ENCRYPTION_UNAVAILABLE|encrypted reminder payload/);
  });
});
