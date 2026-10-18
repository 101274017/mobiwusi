import { describe, expect, it } from 'vitest';
import { deriveReminderInstanceId, nextReminderPlannedAt, ReminderError, ReminderLedger, type ReminderScheduleInput } from '@nuanban/reminder-engine';

const todoId = '00000000-0000-4000-8000-000000000001';
const noteId = '00000000-0000-4000-8000-000000000002';

async function input(scheduleRevision = 1, plannedAt = '2026-10-20T01:00:00.000Z'): Promise<ReminderScheduleInput> {
  return { todoId, instanceId: await deriveReminderInstanceId(todoId, scheduleRevision, plannedAt), plannedAt, timezone: 'Asia/Shanghai', scheduleRevision, deepLink: `/review/${noteId}`, repeat: 'none', channel: 'local' };
}

async function expectReminderError(action: () => Promise<unknown>, code: ReminderError['code']): Promise<void> {
  await expect(action()).rejects.toMatchObject({ name: 'ReminderError', code });
}

describe('C07/C08 共享提醒排程层', () => {
  it('为同一排程生成稳定实例并幂等保存', async () => {
    const ledger = new ReminderLedger();
    const schedule = await input();
    const first = await ledger.schedule(schedule);
    const second = await ledger.schedule({ ...schedule });
    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.occurrence.instanceId).toBe(schedule.instanceId);
    expect(ledger.entries()).toHaveLength(1);
  });

  it('拒绝旧版本和同版本冲突，不静默覆盖', async () => {
    const ledger = new ReminderLedger();
    await ledger.schedule(await input(2, '2026-10-21T01:00:00.000Z'));
    const stale = await input(1);
    await expectReminderError(() => ledger.schedule(stale), 'STALE_SCHEDULE');
    const current = await input(2, '2026-10-21T01:00:00.000Z');
    await expectReminderError(() => ledger.schedule({ ...current, deepLink: '/todos' }), 'SCHEDULE_CONFLICT');
  });

  it('只提交到期实例一次，并把发出、投递、看到、完成分开', async () => {
    const ledger = new ReminderLedger();
    const schedule = await input(1, '2026-10-19T01:00:00.000Z');
    await ledger.schedule(schedule);
    expect(ledger.listDue(new Date('2026-10-19T02:00:00.000Z'))).toHaveLength(1);
    expect((await ledger.submitDue(new Date('2026-10-19T02:00:00.000Z'), new Date('2026-10-19T02:01:00.000Z'))).length).toBe(1);
    expect(await ledger.submitDue(new Date('2026-10-19T03:00:00.000Z'))).toHaveLength(0);
    await ledger.recordReceipt({ todoId, instanceId: schedule.instanceId, scheduleRevision: 1, state: 'delivered', observedAt: '2026-10-19T02:02:00.000Z' });
    const opened = await ledger.recordReceipt({ todoId, instanceId: schedule.instanceId, scheduleRevision: 1, state: 'opened', observedAt: '2026-10-19T02:03:00.000Z' });
    expect(opened.state).toBe('opened');
    const completed = await ledger.complete({ todoId, instanceId: schedule.instanceId, scheduleRevision: 1, completedAt: '2026-10-19T02:04:00.000Z' });
    expect(completed.state).toBe('opened');
    expect(completed.completedAt).toBe('2026-10-19T02:04:00.000Z');
    await expectReminderError(() => ledger.cancel({ todoId, instanceId: schedule.instanceId, scheduleRevision: 1 }), 'INVALID_TRANSITION');
  });

  it('拒绝跳过回执状态、未知后的伪造投递和逆序时间', async () => {
    const ledger = new ReminderLedger();
    const schedule = await input(1, '2026-10-19T01:00:00.000Z');
    await ledger.schedule(schedule);
    await expectReminderError(() => ledger.recordReceipt({ todoId, instanceId: schedule.instanceId, scheduleRevision: 1, state: 'delivered', observedAt: '2026-10-19T02:00:00.000Z' }), 'INVALID_TRANSITION');
    await ledger.recordReceipt({ todoId, instanceId: schedule.instanceId, scheduleRevision: 1, state: 'unknown', observedAt: '2026-10-19T02:00:00.000Z' });
    await expectReminderError(() => ledger.recordReceipt({ todoId, instanceId: schedule.instanceId, scheduleRevision: 1, state: 'delivered', observedAt: '2026-10-19T02:01:00.000Z' }), 'INVALID_TRANSITION');
  });

  it('取消后不再到期，重复取消保持幂等', async () => {
    const ledger = new ReminderLedger();
    const schedule = await input(1, '2026-10-19T01:00:00.000Z');
    await ledger.schedule(schedule);
    const cancelled = await ledger.cancel({ todoId, instanceId: schedule.instanceId, scheduleRevision: 1, cancelledAt: '2026-10-18T01:00:00.000Z' });
    expect(cancelled.state).toBe('cancelled');
    expect(ledger.listDue(new Date('2026-10-20T01:00:00.000Z'))).toHaveLength(0);
    expect((await ledger.cancel({ todoId, instanceId: schedule.instanceId, scheduleRevision: 1 })).state).toBe('cancelled');
  });

  it('严格拒绝外链、非法 ID、非法时间和未知回执', async () => {
    const ledger = new ReminderLedger();
    const schedule = await input();
    await expectReminderError(() => ledger.schedule({ ...schedule, deepLink: 'https://example.com' }), 'INVALID_INPUT');
    await expectReminderError(() => ledger.schedule({ ...schedule, todoId: 'todo-1' }), 'INVALID_INPUT');
    await expectReminderError(() => ledger.schedule({ ...schedule, plannedAt: 'not-a-time' }), 'INVALID_INPUT');
    await expectReminderError(() => ledger.schedule({ ...schedule, extra: true } as never), 'INVALID_INPUT');
    await expectReminderError(() => ledger.recordReceipt({ todoId, instanceId: schedule.instanceId, scheduleRevision: 1, state: 'mystery' as never, observedAt: '2026-10-20T01:00:00.000Z' }), 'INVALID_INPUT');
  });

  it('按 IANA 时区计算重复时间并保留夏令时语义', () => {
    expect(nextReminderPlannedAt({ plannedAt: '2026-03-07T07:30:00.000Z', timezone: 'America/New_York', repeat: 'daily' }, new Date('2026-03-07T08:00:00.000Z'))).toBe('2026-03-08T07:30:00.000Z');
    expect(nextReminderPlannedAt({ plannedAt: '2026-10-25T05:30:00.000Z', timezone: 'America/New_York', repeat: 'weekly' }, new Date('2026-10-25T06:00:00.000Z'))).toBe('2026-11-01T05:30:00.000Z');
  });

  it('实例 ID 随版本或时间变化，不能复用旧期', async () => {
    const first = await deriveReminderInstanceId(todoId, 1, '2026-10-20T01:00:00.000Z');
    const second = await deriveReminderInstanceId(todoId, 2, '2026-10-20T01:00:00.000Z');
    const third = await deriveReminderInstanceId(todoId, 1, '2026-10-20T02:00:00.000Z');
    expect(new Set([first, second, third]).size).toBe(3);
  });
});
