import { describe, expect, it } from 'vitest';
import { InMemoryAuthorizer, InMemoryReminderDelivery, InMemoryReminderStore, InMemorySyncStore, InMemoryTaskQueue, NoteService, ReminderService, SyncEngineError, SyncService, TodoService, deriveOccurrenceId, type ReminderDeliveryPort, type RequestContext, type ReminderOccurrence } from '../../packages/sync-engine/src/index';

const owner = 'owner-a';
const other = 'owner-b';
const actor = 'actor-a';
const context: RequestContext = { actorId: actor, subjectId: owner, deviceId: 'device-a' };
const noteId = 'note-1';
const todoId = 'todo-1';

function setup() {
  const authorizer = new InMemoryAuthorizer();
  authorizer.grant(actor, owner, 'note', '*');
  authorizer.grant(actor, owner, 'todo', '*');
  const store = new InMemorySyncStore();
  return { authorizer, store, notes: new NoteService(store, authorizer), todos: new TodoService(store, authorizer), sync: new SyncService(store, authorizer) };
}

describe('E03 note/todo services', () => {
  it('uses object authorization and rejects cross-owner access', async () => {
    const { notes, sync } = setup();
    const note = await notes.create(context, { id: noteId, askedAt: '2026-10-17T00:00:00Z', question: 'q', topic: 't', summary: 's', source: 'conversation' }, 'create-note');
    expect(note.version).toBe(1);
    await expect(sync.get({ actorId: actor, subjectId: other }, 'note', note.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not mark mastery during review; explicit confirmation records source', async () => {
    const { notes } = setup();
    const note = await notes.create(context, { id: noteId, askedAt: '2026-10-17T00:00:00Z', question: 'q', topic: 't', summary: 's', source: 'guidance' }, 'create-note');
    const reviewed = await notes.review(context, note.id, note.version, '2026-10-18T00:00:00Z', 'review-note');
    expect(reviewed.mastery).toBe('unmastered');
    const mastered = await notes.confirmMastery(context, note.id, reviewed.version, 'self', 'master-note');
    expect(mastered.mastery).toBe('mastered');
    expect(mastered.masterySource).toBe('self');
  });

  it('validates timezone and repeat, and gives an occurrence a stable ID', async () => {
    const { todos } = setup();
    await expect(todos.create(context, { id: todoId, title: 'bad', timezone: 'Not/AZone', remindAt: '2026-10-18T00:00:00Z', repeatRule: { frequency: 'daily', interval: 1 }, timeConfirmed: true }, 'bad-todo')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const todo = await todos.create(context, { id: todoId, title: 'review', timezone: 'Asia/Shanghai', remindAt: '2026-10-18T00:00:00Z', repeatRule: { frequency: 'weekly', interval: 1 }, timeConfirmed: true }, 'create-todo');
    expect(deriveOccurrenceId(todo.id, todo.version, todo.nextFireAt!)).toBe(deriveOccurrenceId(todo.id, todo.version, todo.nextFireAt!));
    expect(todo.nextFireAt).toBe(todo.remindAt);
  });
});

describe('E04 mutations, outbox, tombstones, and cursor changes', () => {
  it('authorizes idempotent replay and rejects mutation ID reuse', async () => {
    const { sync, authorizer } = setup();
    const mutation = { mutationId: 'same-id', ownerId: owner, entityType: 'note' as const, entityId: 'replay-note', operation: 'create' as const, baseVersion: 0, patch: { id: 'replay-note', askedAt: '2026-10-17T00:00:00Z', question: 'q', topic: 't', summary: 's', source: 'conversation' }, createdAt: '2026-10-17T00:00:00Z' };
    const first = await sync.applyMutation(context, mutation);
    authorizer.revoke(actor, owner, 'note', '*');
    await expect(sync.applyMutation(context, mutation)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    authorizer.grant(actor, owner, 'note', '*');
    await expect(sync.applyMutation(context, { ...mutation, patch: { ...mutation.patch, summary: 'changed' } })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(first.status).toBe('acked');
  });

  it('does not skip an authorized change after an unauthorized sequence', async () => {
    const { sync, notes, store } = setup();
    const otherContext: RequestContext = { actorId: other, subjectId: other };
    const foreignAuthorizer = new InMemoryAuthorizer();
    const foreignNotes = new NoteService(store, foreignAuthorizer);
    await foreignNotes.create(otherContext, { id: 'foreign-note', askedAt: '2026-10-17T00:00:00Z', question: 'q', topic: 't', summary: 's', source: 'conversation' }, 'foreign-mutation');
    await notes.create(context, { id: noteId, askedAt: '2026-10-17T00:00:00Z', question: 'q', topic: 't', summary: 's', source: 'conversation' }, 'owner-mutation');
    const page = await sync.changes(context, undefined, 1);
    expect(page.changes).toHaveLength(1);
    expect(page.changes[0]?.entityId).toBe(noteId);
  });

  it('is idempotent, rejects stale versions, and never resurrects a tombstone', async () => {
    const { sync, notes } = setup();
    const mutation = { mutationId: 'm1', ownerId: owner, entityType: 'note' as const, entityId: noteId, operation: 'create' as const, baseVersion: 0, patch: { id: noteId, askedAt: '2026-10-17T00:00:00Z', question: 'q', topic: 't', summary: 's', source: 'conversation' }, createdAt: '2026-10-17T00:00:00Z' };
    const first = await sync.applyMutation(context, mutation);
    const repeated = await sync.applyMutation(context, mutation);
    expect(repeated).toEqual(first);
    const stale = await sync.applyMutation(context, { ...mutation, mutationId: 'm2', operation: 'update', baseVersion: 0, patch: { summary: 'new' } });
    expect(stale).toMatchObject({ status: 'conflict', conflict: { reason: 'updated', currentVersion: 1 } });
    const deleted = await notes.delete(context, noteId, 1, 'delete-note');
    expect(deleted.deletedAt).not.toBeNull();
    const revive = await sync.applyMutation(context, { ...mutation, mutationId: 'm3', operation: 'update', baseVersion: deleted.version, patch: { summary: 'revive' } });
    expect(revive).toMatchObject({ status: 'conflict', conflict: { reason: 'deleted' } });
    await expect(notes.update(context, noteId, deleted.version, { summary: 'revive' }, 'revive-direct')).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('returns only authorized changes and binds cursors to the actor', async () => {
    const { sync, notes, authorizer } = setup();
    await notes.create(context, { id: noteId, askedAt: '2026-10-17T00:00:00Z', question: 'q', topic: 't', summary: 's', source: 'conversation' }, 'm1');
    const page = await sync.changes(context);
    expect(page.changes).toHaveLength(1);
    await expect(sync.changes({ actorId: 'other-actor', subjectId: owner }, page.nextCursor)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    authorizer.revoke(actor, owner, 'note', '*');
    const hidden = await sync.changes(context, page.nextCursor);
    expect(hidden.changes).toHaveLength(0);
  });

  it('keeps occurrence identity stable across non-schedule edits', async () => {
    const { todos } = setup();
    const todo = await todos.create(context, { id: 'stable-todo', title: 'review', timezone: 'Asia/Shanghai', remindAt: '2026-10-18T00:00:00Z', repeatRule: { frequency: 'none', interval: 1 }, timeConfirmed: true }, 'stable-create');
    const instanceId = deriveOccurrenceId(todo.id, todo.scheduleRevision, todo.nextFireAt!);
    const updated = await todos.update(context, todo.id, todo.version, { title: 'review later' }, 'stable-update');
    expect(updated.scheduleRevision).toBe(todo.scheduleRevision);
    expect(deriveOccurrenceId(updated.id, updated.scheduleRevision, updated.nextFireAt!)).toBe(instanceId);
    const completed = await todos.completeOccurrence(context, updated.id, instanceId, '2026-10-18T01:00:00Z', 'stable-complete');
    expect(completed.status).toBe('completed');
    await expect(todos.completeOccurrence(context, updated.id, instanceId, '2026-10-18T01:01:00Z', 'stable-complete-again')).resolves.toEqual(completed);
  });
});

describe('E05 reminder queue and receipts', () => {
  function occurrence(): Omit<ReminderOccurrence, 'state' | 'submittedAt' | 'deliveredAt' | 'openedAt' | 'completedAt' | 'cancelledAt'> {
    return { ownerId: owner, todoId, instanceId: 'occ-1', plannedAt: '2026-10-17T01:00:00.000Z', timezone: 'Asia/Shanghai', scheduleRevision: 1, repeatRule: { frequency: 'none', interval: 1 } };
  }

  it('keeps submitted, delivered, and opened separate', async () => {
    const { authorizer } = setup();
    authorizer.grant(actor, owner, 'todo', todoId, ['schedule', 'receipt']);
    const reminders = new InMemoryReminderStore();
    const queue = new InMemoryTaskQueue();
    const delivery = new InMemoryReminderDelivery();
    const service = new ReminderService(reminders, queue, authorizer, delivery);
    await service.schedule(context, occurrence());
    expect(await service.processDue(context, '2026-10-17T02:00:00.000Z')).toBe(1);
    const submitted = await reminders.get(owner, 'occ-1');
    expect(submitted?.state).toBe('submitted');
    expect(submitted?.deliveredAt).toBeNull();
    await service.receipt(context, owner, todoId, 'occ-1', 'delivered', '2026-10-17T02:01:00.000Z');
    const delivered = await service.receipt(context, owner, todoId, 'occ-1', 'opened', '2026-10-17T02:02:00.000Z');
    expect(delivered.state).toBe('opened');
    expect(delivered.submittedAt).not.toBeNull();
    expect(delivered.deliveredAt).toBe('2026-10-17T02:01:00.000Z');
    expect(delivery.submitted).toHaveLength(1);
    await expect(service.receipt(context, owner, todoId, 'occ-1', 'opened', '2026-10-17T02:00:30.000Z')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('recovers a running task after restart and does not duplicate it', async () => {
    const { authorizer } = setup();
    authorizer.grant(actor, owner, 'todo', todoId, ['schedule', 'receipt']);
    const reminders = new InMemoryReminderStore();
    const firstQueue = new InMemoryTaskQueue();
    const delivery = new InMemoryReminderDelivery();
    const first = new ReminderService(reminders, firstQueue, authorizer, delivery);
    await first.schedule(context, { ...occurrence(), instanceId: 'occ-restart' });
    const running = await firstQueue.claim('reminder:owner-a:occ-restart', '2026-10-17T02:00:00.000Z');
    expect(running?.status).toBe('running');
    const restartedQueue = new InMemoryTaskQueue(firstQueue.snapshot());
    const restarted = new ReminderService(reminders, restartedQueue, authorizer, delivery);
    await restarted.recover('2026-10-17T02:01:00.000Z');
    expect(await restarted.processDue(context, '2026-10-17T02:02:00.000Z')).toBe(1);
    expect(await restarted.processDue(context, '2026-10-17T02:03:00.000Z')).toBe(0);
    expect(delivery.submitted).toHaveLength(1);
  });

  it('retries a failed delivery with the same idempotency key', async () => {
    const { authorizer } = setup();
    authorizer.grant(actor, owner, 'todo', todoId, ['schedule', 'receipt']);
    const reminders = new InMemoryReminderStore();
    const queue = new InMemoryTaskQueue();
    const keys: string[] = [];
    let attempts = 0;
    const delivery: ReminderDeliveryPort = {
      async submit(_occurrence, idempotencyKey) {
        attempts += 1;
        keys.push(idempotencyKey ?? '');
        if (attempts === 1) throw new Error('temporary');
      },
    };
    const service = new ReminderService(reminders, queue, authorizer, delivery);
    await service.schedule(context, occurrence());
    expect(await service.processDue(context, '2026-10-17T02:00:00.000Z')).toBe(0);
    expect(queue.snapshot()[0]?.status).toBe('queued');
    expect(await service.processDue(context, '2026-10-17T02:00:02.000Z')).toBe(1);
    expect(attempts).toBe(2);
    expect(keys[0]).toBe(keys[1]);
  });
});

it('exposes the intended error type', () => {
  expect(new SyncEngineError('INVALID_INPUT', 'x')).toBeInstanceOf(Error);
});
