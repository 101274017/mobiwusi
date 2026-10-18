import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryAuthorizer, NoteService, SqliteReminderStore, SqliteSyncStore, SqliteTaskQueue, type ReminderOccurrence, type ReminderTask, type RequestContext } from '../../packages/sync-engine/src/index';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const context: RequestContext = { actorId: 'owner-a', subjectId: 'owner-a', deviceId: 'device-a' };

function occurrence(): ReminderOccurrence {
  return {
    ownerId: 'owner-a',
    todoId: 'todo-a',
    instanceId: 'occurrence-a',
    plannedAt: '2026-10-18T01:00:00.000Z',
    timezone: 'Asia/Shanghai',
    scheduleRevision: 1,
    repeatRule: { frequency: 'none', interval: 1 },
    state: 'scheduled',
    submittedAt: null,
    deliveredAt: null,
    openedAt: null,
    completedAt: null,
    cancelledAt: null,
  };
}

function task(): ReminderTask {
  return {
    id: 'reminder:owner-a:occurrence-a',
    ownerId: 'owner-a',
    occurrenceId: 'occurrence-a',
    availableAt: '2026-10-18T01:00:00.000Z',
    status: 'queued',
    attempts: 0,
    leaseToken: null,
    leaseExpiresAt: null,
    lastError: null,
  };
}

describe('SQLite sync persistence', () => {
  it('restores entities, mutation receipts, changes, and outbox after reopening', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'nuanban-sync-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'sync.sqlite');
    const authorizer = new InMemoryAuthorizer();
    const firstStore = new SqliteSyncStore({ path });
    const firstNotes = new NoteService(firstStore, authorizer);
    const note = await firstNotes.create(context, { id: 'note-a', askedAt: '2026-10-17T01:00:00.000Z', question: 'question', topic: 'topic', summary: 'summary', source: 'conversation' }, 'mutation-a');
    firstStore.close();

    const reopened = new SqliteSyncStore({ path });
    const secondNotes = new NoteService(reopened, authorizer);
    await expect(secondNotes.get(context, 'note', note.id)).resolves.toMatchObject({ id: 'note-a', version: 1 });
    await expect(secondNotes.changes(context)).resolves.toMatchObject({ changes: [{ entityId: 'note-a', version: 1, operation: 'upsert' }] });
    await expect(secondNotes.outbox(context)).resolves.toMatchObject([{ id: 'owner-a:mutation-a', status: 'pending' }]);
    await expect(secondNotes.applyMutation(context, { mutationId: 'mutation-a', ownerId: 'owner-a', entityType: 'note', entityId: 'note-a', operation: 'create', baseVersion: 0, patch: { id: 'note-a', askedAt: '2026-10-17T01:00:00.000Z', question: 'question', topic: 'topic', summary: 'summary', source: 'conversation' }, createdAt: note.createdAt })).resolves.toMatchObject({ status: 'acked', entity: { id: 'note-a' } });
    reopened.close();
  });

  it('restores reminder occurrences and task leases across a restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'nuanban-reminder-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'reminders.sqlite');
    const firstReminders = new SqliteReminderStore(path);
    const firstQueue = new SqliteTaskQueue(path);
    await firstReminders.save(occurrence());
    await firstQueue.enqueue(task());
    const claimed = await firstQueue.claim(task().id, '2026-10-18T01:01:00.000Z', 1000);
    expect(claimed?.status).toBe('running');
    firstReminders.close();
    firstQueue.close();

    const reopenedReminders = new SqliteReminderStore(path);
    const reopenedQueue = new SqliteTaskQueue(path);
    await expect(reopenedReminders.get('owner-a', 'occurrence-a')).resolves.toMatchObject({ state: 'scheduled' });
    await reopenedQueue.recover('2026-10-18T01:02:00.000Z');
    await expect(reopenedQueue.listReady('2026-10-18T01:02:00.000Z')).resolves.toMatchObject([{ status: 'queued', attempts: 1 }]);
    reopenedReminders.close();
    reopenedQueue.close();
  });

  it('serializes reminder and task transactions across adapters sharing one path', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'nuanban-reminder-lock-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'shared.sqlite');
    const reminders = new SqliteReminderStore(path);
    const queue = new SqliteTaskQueue(path);
    await Promise.all([reminders.save(occurrence()), queue.enqueue(task())]);
    await expect(reminders.get('owner-a', 'occurrence-a')).resolves.toMatchObject({ instanceId: 'occurrence-a' });
    await expect(queue.listReady('2026-10-18T01:01:00.000Z')).resolves.toMatchObject([{ id: task().id }]);
    reminders.close();
    queue.close();
  });
});
