import { describe, expect, it } from 'vitest';
import { IndexedDbReminderStore } from '@nuanban/local-data';
import { deriveReminderInstanceId, type ReminderOccurrence } from '@nuanban/reminder-engine';

async function occurrence(plannedAt = '2026-10-20T01:00:00.000Z'): Promise<ReminderOccurrence> {
  const todoId = crypto.randomUUID();
  const instanceId = await deriveReminderInstanceId(todoId, 1, plannedAt);
  return {
    todoId,
    instanceId,
    plannedAt,
    timezone: 'Asia/Shanghai',
    scheduleRevision: 1,
    deepLink: `/todos/edit/${todoId}`,
    repeat: 'none',
    channel: 'local',
    state: 'scheduled',
    receipts: { submitted: null, delivered: null, opened: null, failed: null, missed: null, unknown: null },
    completedAt: null,
    cancelledAt: null,
  };
}

describe('C07/C08 IndexedDB 提醒仓储预备层', () => {
  it('按账号隔离提醒，并在重新创建仓储后恢复记录', async () => {
    const ownerId = 'reminder-owner-' + crypto.randomUUID();
    const otherOwnerId = 'reminder-other-' + crypto.randomUUID();
    const item = await occurrence();
    await new IndexedDbReminderStore(ownerId).replace([item]);
    expect(await new IndexedDbReminderStore(ownerId).load()).toEqual([expect.objectContaining({ todoId: item.todoId, instanceId: item.instanceId })]);
    expect(await new IndexedDbReminderStore(otherOwnerId).load()).toEqual([]);
  });

  it('替换写入拒绝重复实例和非法深链，不静默破坏已有记录', async () => {
    const ownerId = 'reminder-validation-' + crypto.randomUUID();
    const store = new IndexedDbReminderStore(ownerId);
    const item = await occurrence();
    await store.replace([item]);
    await expect(store.replace([{ ...item, deepLink: 'https://example.invalid' }])).rejects.toThrow('无效');
    await expect(store.replace([item, item])).rejects.toThrow('重复');
    expect(await store.load()).toHaveLength(1);
  });

  it('只清理当前账号，并保持原子替换后的空集合可读', async () => {
    const ownerId = 'reminder-clear-' + crypto.randomUUID();
    const otherOwnerId = 'reminder-clear-other-' + crypto.randomUUID();
    const item = await occurrence();
    const otherItem = await occurrence('2026-10-21T01:00:00.000Z');
    const store = new IndexedDbReminderStore(ownerId);
    await store.replace([item]);
    await new IndexedDbReminderStore(otherOwnerId).replace([otherItem]);
    await store.replace([]);
    expect(await store.load()).toEqual([]);
    expect(await new IndexedDbReminderStore(otherOwnerId).load()).toHaveLength(1);
    await new IndexedDbReminderStore(otherOwnerId).clear();
  });

  it('拒绝非规范时间和不匹配稳定实例，避免本地资料绕过共享排程规则', async () => {
    const ownerId = 'reminder-shape-' + crypto.randomUUID();
    const store = new IndexedDbReminderStore(ownerId);
    const item = await occurrence();
    await expect(store.replace([{ ...item, plannedAt: '2026-10-20' }])).rejects.toThrow('无效');
    const mismatchedInstance = await deriveReminderInstanceId(item.todoId, 2, item.plannedAt);
    await expect(store.replace([{ ...item, instanceId: mismatchedInstance }])).rejects.toThrow('实例');
  });
});
