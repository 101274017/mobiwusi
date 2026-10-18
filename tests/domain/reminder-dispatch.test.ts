import { describe, expect, it, vi } from 'vitest';
import { deriveReminderInstanceId, ReminderDispatchGate, ReminderLedger, type ReminderOccurrence, type ReminderSchedulerPort } from '@nuanban/reminder-engine';

const todoId = '00000000-0000-4000-8000-000000000101';
const noteId = '00000000-0000-4000-8000-000000000102';
const ownerId = 'dispatch-owner';

async function occurrence(scheduleRevision = 1, plannedAt = '2026-10-20T01:00:00.000Z'): Promise<ReminderOccurrence> {
  const instanceId = await deriveReminderInstanceId(todoId, scheduleRevision, plannedAt);
  const ledger = new ReminderLedger();
  return (await ledger.schedule({ todoId, instanceId, plannedAt, timezone: 'Asia/Shanghai', scheduleRevision, deepLink: `/review/${noteId}`, repeat: 'none', channel: 'local' })).occurrence;
}

function scheduler(log: string[], failCancel = false): ReminderSchedulerPort {
  return {
    schedule: vi.fn(async request => { log.push(`schedule:${request.occurrence.scheduleRevision}:${request.generation}`); }),
    cancel: vi.fn(async request => {
      log.push(`cancel:${request.occurrence.scheduleRevision}:${request.generation}`);
      if (failCancel) throw new Error('synthetic scheduler cancel failure');
    }),
  };
}

describe('C07/C08 提醒系统派发闸门预备层', () => {
  it('page_only、unsupported 和未授权状态都不调用系统调度器', async () => {
    const item = await occurrence();
    const pageLog: string[] = [];
    const pageGate = new ReminderDispatchGate('page_only', 'granted', scheduler(pageLog));
    pageGate.start(1);
    await expect(pageGate.schedule(ownerId, item)).resolves.toMatchObject({ status: 'not_scheduled', reason: 'page_only' });
    expect(pageLog).toEqual([]);

    const deniedLog: string[] = [];
    const deniedGate = new ReminderDispatchGate('system', 'denied', scheduler(deniedLog));
    deniedGate.start(1);
    await expect(deniedGate.schedule(ownerId, item)).resolves.toMatchObject({ status: 'not_scheduled', reason: 'permission_denied' });
    expect(deniedLog).toEqual([]);
  });

  it('必须显式启动，系统能力获准后同一排程幂等且只调度一次', async () => {
    const item = await occurrence();
    const log: string[] = [];
    const gate = new ReminderDispatchGate('system', 'granted', scheduler(log));
    await expect(gate.schedule(ownerId, item)).resolves.toMatchObject({ status: 'not_scheduled', reason: 'lifecycle_stopped' });
    gate.start(1);
    await expect(gate.schedule(ownerId, item)).resolves.toMatchObject({ status: 'scheduled', generation: 1 });
    await expect(gate.schedule(ownerId, item)).resolves.toMatchObject({ status: 'idempotent', generation: 1 });
    expect(log).toEqual(['schedule:1:1']);
  });

  it('新版本先取消旧系统排程，旧版本回写被拒绝', async () => {
    const first = await occurrence(1, '2026-10-20T01:00:00.000Z');
    const second = await occurrence(2, '2026-10-20T01:00:00.000Z');
    const log: string[] = [];
    const gate = new ReminderDispatchGate('system', 'granted', scheduler(log));
    gate.start(1);
    await gate.schedule(ownerId, first);
    await expect(gate.schedule(ownerId, second)).resolves.toMatchObject({ status: 'scheduled' });
    await expect(gate.schedule(ownerId, first)).resolves.toMatchObject({ status: 'stale', reason: 'stale_schedule' });
    expect(log).toEqual(['schedule:1:1', 'cancel:1:1', 'schedule:2:1']);
  });

  it('撤权会取消已注册系统排程，恢复权限后也不会自动恢复', async () => {
    const item = await occurrence();
    const log: string[] = [];
    const gate = new ReminderDispatchGate('system', 'granted', scheduler(log));
    gate.start(1);
    await gate.schedule(ownerId, item);
    const report = await gate.updatePermission('denied');
    expect(report).toMatchObject({ reason: 'permission-revoked', cancelled: 1, generationBefore: 1, generationAfter: 2, restartBlocked: false });
    expect(gate.snapshot()).toMatchObject({ active: false, permission: 'denied', generation: 2, registered: 0 });
    await gate.updatePermission('granted');
    await expect(gate.schedule(ownerId, item)).resolves.toMatchObject({ status: 'not_scheduled', reason: 'lifecycle_stopped' });
    gate.start(3);
    await expect(gate.schedule(ownerId, item)).resolves.toMatchObject({ status: 'scheduled', generation: 3 });
    expect(log).toEqual(['schedule:1:1', 'cancel:1:1', 'schedule:1:3']);
  });

  it('停止清理失败时保留阻断状态并禁止同一进程重启', async () => {
    const item = await occurrence();
    const gate = new ReminderDispatchGate('system', 'granted', scheduler([], true));
    gate.start(1);
    await gate.schedule(ownerId, item);
    const report = await gate.stop('process-terminated');
    expect(report).toMatchObject({ restartBlocked: true, failed: [expect.stringContaining(ownerId)] });
    expect(() => gate.start(3)).toThrow('清理失败');
    await expect(gate.schedule(ownerId, item)).resolves.toMatchObject({ status: 'not_scheduled', reason: 'cleanup_failed' });
  });

  it('取消只接受当前版本并保留显式取消结果', async () => {
    const first = await occurrence(1, '2026-10-20T01:00:00.000Z');
    const second = await occurrence(2, '2026-10-20T01:00:00.000Z');
    const log: string[] = [];
    const gate = new ReminderDispatchGate('system', 'granted', scheduler(log));
    gate.start(1);
    await gate.schedule(ownerId, second);
    await expect(gate.cancel(ownerId, first.todoId, first.instanceId, first.scheduleRevision)).resolves.toMatchObject({ status: 'stale' });
    await expect(gate.cancel(ownerId, second.todoId, second.instanceId, second.scheduleRevision)).resolves.toMatchObject({ status: 'cancelled' });
    expect(log).toEqual(['schedule:2:1', 'cancel:2:1']);
  });
});
