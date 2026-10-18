import { InMemoryAuthorizer } from './memory.ts';
import type { AccessAction, ChangeEnvelope, ClockPort, Conflict, CursorPage, EntityType, MutationResult, NoteCreateInput, NotePatch, NoteRecord, ObjectAuthorizer, OutboxItem, RepeatRule, ReminderDeliveryPort, ReminderOccurrence, ReminderScheduleInput, ReminderStore, RequestContext, SyncMutation, SyncStore, TaskQueuePort, TodoCreateInput, TodoPatch, TodoRecord, StoredEntity } from './ports.ts';
import { SyncEngineError } from './ports.ts';
import { authorizeOrThrow, choice, clone, fields, instant, normalizeMutation, object, repeatRule, requiredText, revision, systemClock, timezone, validateContext } from './validation.ts';

function mutationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `mutation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function conflict(mutation: SyncMutation, current: StoredEntity | null, reason: Conflict['reason']): MutationResult {
  return {
    mutationId: mutation.mutationId,
    status: 'conflict',
    version: current?.version ?? null,
    entity: clone(current),
    conflict: { entityType: mutation.entityType, entityId: mutation.entityId, ownerId: mutation.ownerId, baseVersion: mutation.baseVersion, currentVersion: current?.version ?? 0, reason, current: clone(current) },
  };
}

function validClock(clock: ClockPort): string {
  return instant(clock.now(), 'clock.now');
}

export class SyncService {
  constructor(protected readonly store: SyncStore, protected readonly authorizer: ObjectAuthorizer = new InMemoryAuthorizer(), protected readonly clock: ClockPort = systemClock) {}

  async applyMutation(context: RequestContext, mutation: SyncMutation): Promise<MutationResult> {
    validateContext(context);
    const normalized = normalizeMutation(mutation);
    if (normalized.ownerId !== context.subjectId) throw new SyncEngineError('FORBIDDEN', 'mutation owner 与 subject 不一致。');
    return this.store.transaction(async tx => {
      await authorizeOrThrow(this.authorizer, context, 'write', normalized.entityType, normalized.entityId, normalized.ownerId);
      const previous = await tx.getMutation(context.actorId, normalized.ownerId, normalized.mutationId);
      if (previous) {
        if (previous.fingerprint !== this.fingerprint(normalized)) throw new SyncEngineError('IDEMPOTENCY_CONFLICT', 'mutationId 已用于另一条 mutation。');
        return clone(previous.result);
      }
      const anyCurrent = await tx.getEntityById(normalized.entityType, normalized.entityId);
      if (anyCurrent && anyCurrent.ownerId !== normalized.ownerId) throw new SyncEngineError('FORBIDDEN', '对象不属于当前 owner。');
      const current = anyCurrent;
      const timestamp = validClock(this.clock);
      let result: MutationResult;
      if (normalized.operation === 'create') {
        result = current
          ? conflict(normalized, current, current.deletedAt ? 'deleted' : 'updated')
          : { mutationId: normalized.mutationId, status: 'acked', version: 1, entity: this.createEntity(normalized, timestamp), conflict: null };
      } else if (!current) {
        result = conflict(normalized, null, 'missing');
      } else if (current.deletedAt) {
        result = conflict(normalized, current, 'deleted');
      } else if (current.version !== normalized.baseVersion) {
        result = conflict(normalized, current, 'updated');
      } else if (normalized.operation === 'delete') {
        const deletedAt = timestamp;
        const entity = { ...current, version: current.version + 1, updatedAt: deletedAt, deletedAt } as StoredEntity;
        result = { mutationId: normalized.mutationId, status: 'acked', version: entity.version, entity: clone(entity), conflict: null };
      } else {
        result = { mutationId: normalized.mutationId, status: 'acked', version: current.version + 1, entity: this.updateEntity(current, normalized.patch, timestamp), conflict: null };
      }
      if (result.status === 'acked' && result.entity) {
        await tx.putEntity(result.entity);
        await tx.appendChange({ ownerId: normalized.ownerId, entityType: normalized.entityType, entityId: normalized.entityId, version: result.entity.version, operation: result.entity.deletedAt ? 'delete' : 'upsert', entity: result.entity.deletedAt ? null : result.entity });
        await tx.enqueueOutbox({ id: `${normalized.ownerId}:${normalized.mutationId}`, mutationId: normalized.mutationId, ownerId: normalized.ownerId, entityType: normalized.entityType, entityId: normalized.entityId, operation: normalized.operation, version: result.entity.version, status: 'pending', createdAt: timestamp, actorId: context.actorId, mutation: clone(normalized) });
      }
      await tx.saveMutation({ actorId: context.actorId, ownerId: normalized.ownerId, fingerprint: this.fingerprint(normalized), mutation: clone(normalized), result: clone(result) });
      return clone(result);
    });
  }

  async get(context: RequestContext, entityType: EntityType, entityId: string): Promise<StoredEntity | null> {
    validateContext(context);
    return this.store.transaction(async tx => {
      const entity = await tx.getEntityById(entityType, entityId);
      if (!entity) return null;
      await authorizeOrThrow(this.authorizer, context, 'read', entityType, entityId, entity.ownerId);
      return clone(entity);
    });
  }

  async list(context: RequestContext, entityType: EntityType): Promise<StoredEntity[]> {
    validateContext(context);
    return this.store.transaction(async tx => {
      const entities = await tx.listEntities(entityType, context.subjectId);
      const visible: StoredEntity[] = [];
      for (const entity of entities) {
        if (await this.authorizer.authorize({ actorId: context.actorId, subjectId: context.subjectId, entityType, entityId: entity.id, ownerId: entity.ownerId, action: 'read' })) {
          visible.push(clone(entity));
        }
      }
      return visible;
    });
  }

  async changes(context: RequestContext, cursor?: string, limit = 100): Promise<CursorPage> {
    validateContext(context);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new SyncEngineError('INVALID_INPUT', 'limit 无效。');
    let after = decodeCursor(cursor, context);
    return this.store.transaction(async tx => {
      const visible: ChangeEnvelope[] = [];
      while (visible.length < limit) {
        const batch = await tx.listChanges(after, Math.max(100, limit));
        if (batch.length === 0) break;
        for (const change of batch) {
          after = change.sequence;
          if (await this.authorizer.authorize({ actorId: context.actorId, subjectId: context.subjectId, entityType: change.entityType, entityId: change.entityId, ownerId: change.ownerId, action: 'read' })) visible.push(clone(change));
          if (visible.length >= limit) break;
        }
        if (batch.length < Math.max(100, limit) || visible.length >= limit) break;
      }
      return { changes: visible, nextCursor: encodeCursor(context, after) };
    });
  }

  async outbox(context: RequestContext): Promise<OutboxItem[]> {
    validateContext(context);
    return this.store.transaction(async tx => {
      const items = await tx.listOutbox(context.subjectId);
      for (const item of items) await authorizeOrThrow(this.authorizer, context, 'write', item.entityType, item.entityId, item.ownerId);
      return clone(items);
    });
  }

  async acknowledgeOutbox(context: RequestContext, item: Pick<OutboxItem, 'id'>): Promise<void> {
    validateContext(context);
    await this.store.transaction(async tx => {
      const stored = await tx.getOutbox(item.id);
      if (!stored) throw new SyncEngineError('NOT_FOUND', 'outbox 项不存在。');
      if (stored.ownerId !== context.subjectId) throw new SyncEngineError('FORBIDDEN', 'outbox 项不属于当前 owner。');
      await authorizeOrThrow(this.authorizer, context, 'write', stored.entityType, stored.entityId, stored.ownerId);
      await tx.acknowledgeOutbox(stored.id);
    });
  }

  protected createEntity(mutation: SyncMutation, timestamp: string): StoredEntity {
    const patch = object(mutation.patch, 'patch');
    if (patch.id !== undefined && patch.id !== mutation.entityId) throw new SyncEngineError('INVALID_INPUT', 'patch.id 与 entityId 不一致。');
    if (mutation.entityType === 'note') {
      fields(patch, ['id', 'askedAt', 'question', 'topic', 'summary', 'source', 'sourceSessionId']);
      const source = choice(patch.source ?? 'conversation', ['conversation', 'guidance', 'demo'], 'source');
      return { entityType: 'note', id: mutation.entityId, ownerId: mutation.ownerId, askedAt: instant(patch.askedAt, 'askedAt'), question: requiredText(patch.question, 'question', 1500), topic: requiredText(patch.topic, 'topic', 200), summary: requiredText(patch.summary, 'summary', 10000), mastery: 'unmastered', masterySource: null, reviewedAt: null, source, sourceSessionId: patch.sourceSessionId === undefined || patch.sourceSessionId === null ? null : requiredText(patch.sourceSessionId, 'sourceSessionId', 256), version: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
    }
    fields(patch, ['id', 'title', 'noteId', 'timezone', 'remindAt', 'repeatRule', 'timeConfirmed', 'source']);
    if (patch.timeConfirmed !== true) throw new SyncEngineError('INVALID_INPUT', '精确提醒时间必须先确认。');
    const remindAt = instant(patch.remindAt, 'remindAt');
    return { entityType: 'todo', id: mutation.entityId, ownerId: mutation.ownerId, creatorId: mutation.ownerId, title: requiredText(patch.title, 'title', 200), noteId: patch.noteId === undefined || patch.noteId === null ? null : requiredText(patch.noteId, 'noteId', 256), timezone: timezone(patch.timezone), remindAt, repeatRule: repeatRule(patch.repeatRule), status: 'pending', completedAt: null, source: choice(patch.source ?? 'self', ['self', 'review', 'authorized_family'], 'source'), nextFireAt: remindAt, scheduleRevision: 1, lastCompletedInstanceId: null, version: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
  }

  protected updateEntity(current: StoredEntity, patchValue: Record<string, unknown>, timestamp: string): StoredEntity {
    const patch = object(patchValue, 'patch');
    if (current.entityType === 'note') {
      fields(patch, ['summary', 'mastery', 'masterySource', 'reviewedAt']);
      const mastery = patch.mastery === undefined ? current.mastery : choice(patch.mastery, ['unmastered', 'mastered'], 'mastery');
      const masterySource = patch.masterySource === undefined ? current.masterySource : patch.masterySource === null ? null : choice(patch.masterySource, ['self', 'authorized_family'], 'masterySource');
      const normalizedSource = mastery === 'unmastered' ? null : masterySource;
      if (mastery === 'mastered' && !normalizedSource) throw new SyncEngineError('INVALID_INPUT', '掌握必须记录来源。');
      return { ...current, summary: patch.summary === undefined ? current.summary : requiredText(patch.summary, 'summary', 10000), mastery, masterySource: normalizedSource, reviewedAt: patch.reviewedAt === undefined ? current.reviewedAt : patch.reviewedAt === null ? null : instant(patch.reviewedAt, 'reviewedAt'), version: current.version + 1, updatedAt: timestamp };
    }
    fields(patch, ['title', 'noteId', 'timezone', 'remindAt', 'repeatRule', 'timeConfirmed', 'status', 'completion']);
    const completion = patch.completion === undefined ? null : object(patch.completion, 'completion');
    if (completion) fields(completion, ['instanceId', 'completedAt']);
    if (completion && (patch.status !== undefined || patch.remindAt !== undefined || patch.timezone !== undefined || patch.repeatRule !== undefined)) throw new SyncEngineError('INVALID_INPUT', '完成 occurrence 不能与排程或状态修改合并。');
    const scheduleChanged = patch.remindAt !== undefined || patch.timezone !== undefined || patch.repeatRule !== undefined;
    if (scheduleChanged && patch.timeConfirmed !== true) throw new SyncEngineError('INVALID_INPUT', '修改提醒时间必须重新确认。');
    const nextRemindAt = patch.remindAt === undefined ? current.remindAt : instant(patch.remindAt, 'remindAt');
    const nextTimezone = patch.timezone === undefined ? current.timezone : timezone(patch.timezone);
    const nextRule = patch.repeatRule === undefined ? current.repeatRule : repeatRule(patch.repeatRule);
    const status = patch.status === undefined ? current.status : choice(patch.status, ['pending', 'cancelled'], 'status');
    const next: TodoRecord = { ...current, title: patch.title === undefined ? current.title : requiredText(patch.title, 'title', 200), noteId: patch.noteId === undefined || patch.noteId === null ? patch.noteId === null ? null : current.noteId : requiredText(patch.noteId, 'noteId', 256), timezone: nextTimezone, remindAt: nextRemindAt, repeatRule: nextRule, status, completedAt: current.completedAt, nextFireAt: current.nextFireAt, scheduleRevision: current.scheduleRevision, lastCompletedInstanceId: current.lastCompletedInstanceId, version: current.version + 1, updatedAt: timestamp };
    if (scheduleChanged) {
      next.nextFireAt = nextRemindAt;
      next.scheduleRevision = current.scheduleRevision + 1;
      next.status = 'pending';
      next.completedAt = null;
      next.lastCompletedInstanceId = null;
    }
    if (status === 'cancelled') next.nextFireAt = null;
      if (completion) {
        const instanceId = requiredText(completion.instanceId, 'completion.instanceId', 256);
        const completedAt = instant(completion.completedAt, 'completion.completedAt');
        const expected = deriveOccurrenceId(current.id, current.scheduleRevision, current.nextFireAt ?? current.remindAt);
        if (instanceId !== expected) throw new SyncEngineError('VERSION_CONFLICT', '提醒实例已过期。');
        if (current.lastCompletedInstanceId === instanceId) throw new SyncEngineError('VERSION_CONFLICT', '提醒实例已完成。');
      next.lastCompletedInstanceId = instanceId;
      next.completedAt = completedAt;
      next.nextFireAt = current.repeatRule.frequency === 'none' ? null : nextRepeatAt(current.nextFireAt ?? current.remindAt, current.timezone, current.repeatRule);
      next.status = current.repeatRule.frequency === 'none' ? 'completed' : 'pending';
    }
    return next;
  }

  private fingerprint(mutation: SyncMutation): string {
    return JSON.stringify({ ownerId: mutation.ownerId, entityType: mutation.entityType, entityId: mutation.entityId, operation: mutation.operation, baseVersion: mutation.baseVersion, patch: mutation.patch });
  }
}

export class NoteService extends SyncService {
  async create(context: RequestContext, input: NoteCreateInput, id = mutationId()): Promise<NoteRecord> {
    return this.expectNote(await this.applyMutation(context, { mutationId: id, ownerId: context.subjectId, entityType: 'note', entityId: input.id, operation: 'create', baseVersion: 0, patch: input as unknown as Record<string, unknown>, createdAt: validClock(systemClock) }));
  }

  async update(context: RequestContext, id: string, baseVersion: number, patch: NotePatch, mutation = mutationId()): Promise<NoteRecord> {
    return this.expectNote(await this.applyMutation(context, { mutationId: mutation, ownerId: context.subjectId, entityType: 'note', entityId: id, operation: 'update', baseVersion, patch: patch as Record<string, unknown>, createdAt: validClock(systemClock) }));
  }

  async confirmMastery(context: RequestContext, id: string, baseVersion: number, source: Exclude<NoteRecord['masterySource'], null>, mutation = mutationId()): Promise<NoteRecord> {
    return this.update(context, id, baseVersion, { mastery: 'mastered', masterySource: source }, mutation);
  }

  async review(context: RequestContext, id: string, baseVersion: number, reviewedAt: string, mutation = mutationId()): Promise<NoteRecord> {
    return this.update(context, id, baseVersion, { reviewedAt: instant(reviewedAt, 'reviewedAt') }, mutation);
  }

  async delete(context: RequestContext, id: string, baseVersion: number, mutation = mutationId()): Promise<NoteRecord> {
    return this.expectNote(await this.applyMutation(context, { mutationId: mutation, ownerId: context.subjectId, entityType: 'note', entityId: id, operation: 'delete', baseVersion, patch: {}, createdAt: validClock(systemClock) }));
  }

  private expectNote(result: MutationResult): NoteRecord {
    if (result.status === 'conflict') throw new SyncEngineError('VERSION_CONFLICT', result.conflict?.reason ?? '版本冲突。');
    if (!result.entity || result.entity.entityType !== 'note') throw new SyncEngineError('INVALID_INPUT', '结果不是 note。');
    return clone(result.entity);
  }
}

export class TodoService extends SyncService {
  async create(context: RequestContext, input: TodoCreateInput, id = mutationId()): Promise<TodoRecord> {
    return this.expectTodo(await this.applyMutation(context, { mutationId: id, ownerId: context.subjectId, entityType: 'todo', entityId: input.id, operation: 'create', baseVersion: 0, patch: input as unknown as Record<string, unknown>, createdAt: validClock(systemClock) }));
  }

  async update(context: RequestContext, id: string, baseVersion: number, patch: TodoPatch, mutation = mutationId()): Promise<TodoRecord> {
    return this.expectTodo(await this.applyMutation(context, { mutationId: mutation, ownerId: context.subjectId, entityType: 'todo', entityId: id, operation: 'update', baseVersion, patch: patch as Record<string, unknown>, createdAt: validClock(systemClock) }));
  }

  async completeOccurrence(context: RequestContext, todoId: string, instanceId: string, completedAt: string, mutation = mutationId()): Promise<TodoRecord> {
    const todo = await this.get(context, 'todo', todoId);
    if (!todo || todo.entityType !== 'todo' || todo.deletedAt) throw new SyncEngineError('NOT_FOUND', '待办不存在。');
    if (todo.status === 'cancelled' || deriveOccurrenceId(todo.id, todo.scheduleRevision, todo.nextFireAt ?? todo.remindAt) !== instanceId) throw new SyncEngineError('VERSION_CONFLICT', '提醒实例已过期。');
    if (todo.lastCompletedInstanceId === instanceId) return clone(todo);
    return this.update(context, todo.id, todo.version, { completion: { instanceId, completedAt } }, mutation);
  }

  async cancel(context: RequestContext, id: string, baseVersion: number, mutation = mutationId()): Promise<TodoRecord> {
    return this.update(context, id, baseVersion, { status: 'cancelled' }, mutation);
  }

  private expectTodo(result: MutationResult): TodoRecord {
    if (result.status === 'conflict') throw new SyncEngineError('VERSION_CONFLICT', result.conflict?.reason ?? '版本冲突。');
    if (!result.entity || result.entity.entityType !== 'todo') throw new SyncEngineError('INVALID_INPUT', '结果不是 todo。');
    return clone(result.entity);
  }
}

export function deriveOccurrenceId(todoId: string, scheduleRevision: number, plannedAt: string): string {
  const seed = `${todoId}|${scheduleRevision}|${instant(plannedAt, 'plannedAt')}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  return `occurrence-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function formatter(timezoneName: string): Intl.DateTimeFormat { return new Intl.DateTimeFormat('en-CA', { timeZone: timezoneName, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
function wallMilliseconds(date: Date, format: Intl.DateTimeFormat): number { const parts = Object.fromEntries(format.formatToParts(date).map(part => [part.type, part.value])); return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)); }
function resolveWallTime(wall: Date, format: Intl.DateTimeFormat): Date { let guess = new Date(wall); for (let attempt = 0; attempt < 3; attempt += 1) { const correction = wall.getTime() - wallMilliseconds(guess, format); if (correction === 0) return guess; guess = new Date(guess.getTime() + correction); } return guess; }
function nextRepeatAt(plannedAt: string, timezoneName: string, rule: RepeatRule): string { const wall = new Date(wallMilliseconds(new Date(plannedAt), formatter(timezoneName))); wall.setUTCDate(wall.getUTCDate() + rule.interval * (rule.frequency === 'daily' ? 1 : 7)); return resolveWallTime(wall, formatter(timezoneName)).toISOString(); }

type ReminderState = 'submitted' | 'delivered' | 'opened';

export class ReminderService {
  constructor(private readonly store: ReminderStore, private readonly queue: TaskQueuePort, private readonly authorizer: ObjectAuthorizer, private readonly delivery: ReminderDeliveryPort, private readonly clock: ClockPort = systemClock) {}

  async get(context: RequestContext, ownerId: string, instanceId: string): Promise<ReminderOccurrence | null> {
    validateContext(context);
    await authorizeOrThrow(this.authorizer, context, 'receipt', 'todo', instanceId, ownerId);
    return clone(await this.store.get(ownerId, instanceId));
  }

  async schedule(context: RequestContext, input: ReminderScheduleInput): Promise<{ occurrence: ReminderOccurrence; idempotent: boolean }> {
    validateContext(context);
    const ownerId = requiredText(input.ownerId, 'ownerId');
    const todoId = requiredText(input.todoId, 'todoId');
    const instanceId = requiredText(input.instanceId, 'instanceId');
    const plannedAt = instant(input.plannedAt, 'plannedAt');
    const zone = timezone(input.timezone);
    const scheduleRevision = revision(input.scheduleRevision, 'scheduleRevision');
    const rule = repeatRule(input.repeatRule);
    await authorizeOrThrow(this.authorizer, context, 'schedule', 'todo', todoId, ownerId);
    const result = await this.store.transaction(async tx => {
      const current = await tx.get(ownerId, instanceId);
      const same = current && current.todoId === todoId && current.plannedAt === plannedAt && current.timezone === zone && current.scheduleRevision === scheduleRevision && JSON.stringify(current.repeatRule) === JSON.stringify(rule);
      if (same) return { occurrence: clone(current), idempotent: true, cancelled: [] as string[] };
      if (current && current.todoId !== todoId) throw new SyncEngineError('IDEMPOTENCY_CONFLICT', '提醒实例 ID 已属于另一待办。');
      if (current && current.scheduleRevision >= scheduleRevision) throw new SyncEngineError('VERSION_CONFLICT', '提醒排程版本冲突。');
      const cancelled: string[] = [];
      for (const occurrence of await tx.list(ownerId)) {
        if (occurrence.todoId === todoId && occurrence.scheduleRevision < scheduleRevision && occurrence.state !== 'cancelled') {
          cancelled.push(occurrence.instanceId);
          await tx.save({ ...occurrence, state: 'cancelled', cancelledAt: validClock(this.clock) });
        }
      }
      const occurrence: ReminderOccurrence = { ownerId, todoId, instanceId, plannedAt, timezone: zone, scheduleRevision, repeatRule: rule, state: 'scheduled', submittedAt: null, deliveredAt: null, openedAt: null, completedAt: null, cancelledAt: null };
      await tx.save(occurrence);
      return { occurrence: clone(occurrence), idempotent: false, cancelled };
    });
    for (const instance of result.cancelled) await this.queue.cancel(`reminder:${ownerId}:${instance}`);
    if (!result.occurrence.completedAt && result.occurrence.state !== 'cancelled') {
      await this.queue.enqueue({ id: `reminder:${ownerId}:${result.occurrence.instanceId}`, ownerId, occurrenceId: result.occurrence.instanceId, availableAt: result.occurrence.plannedAt, status: 'queued', attempts: 0, leaseToken: null, leaseExpiresAt: null, lastError: null });
    }
    return { occurrence: clone(result.occurrence), idempotent: result.idempotent };
  }

  async processDue(context: RequestContext, now = this.clock.now()): Promise<number> {
    validateContext(context);
    const observedAt = instant(now, 'now');
    let processed = 0;
    for (const task of await this.queue.listReady(observedAt)) {
      if (task.ownerId !== context.subjectId) continue;
      const occurrence = await this.store.get(task.ownerId, task.occurrenceId);
      if (!occurrence || occurrence.state === 'cancelled' || occurrence.deliveredAt || occurrence.openedAt || occurrence.completedAt) { await this.queue.cancel(task.id); continue; }
      if (!(await this.authorizer.authorize({ actorId: context.actorId, subjectId: context.subjectId, entityType: 'todo', entityId: occurrence.todoId, ownerId: occurrence.ownerId, action: 'schedule' }))) continue;
      const claimed = await this.queue.claim(task.id, observedAt);
      if (!claimed) continue;
      try {
        const latest = await this.store.get(task.ownerId, task.occurrenceId);
        if (!latest || latest.state === 'cancelled' || latest.deliveredAt || latest.openedAt || latest.completedAt) {
          await this.queue.cancel(claimed.id);
          continue;
        }
        const submittedAt = latest.submittedAt ?? observedAt;
        const submitted: ReminderOccurrence = latest.submittedAt ? latest : { ...latest, state: 'submitted', submittedAt };
        if (!latest.submittedAt) await this.store.save(submitted);
        await this.delivery.submit(submitted, `reminder:${occurrence.ownerId}:${occurrence.instanceId}:submit`);
        await this.queue.complete(claimed.id, claimed.leaseToken as string);
        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : '提醒投递失败。';
        const delay = Math.min(60_000, 1_000 * (2 ** Math.min(claimed.attempts - 1, 6)));
        await this.queue.retry(claimed.id, claimed.leaseToken as string, new Date(Date.parse(observedAt) + delay).toISOString(), message);
      }
    }
    return processed;
  }

  async receipt(context: RequestContext, ownerId: string, todoId: string, instanceId: string, state: ReminderState, observedAt: string): Promise<ReminderOccurrence> {
    const allowed = choice(state, ['submitted', 'delivered', 'opened'], 'state');
    await authorizeOrThrow(this.authorizer, context, 'receipt', 'todo', todoId, ownerId);
    const observed = instant(observedAt, 'observedAt');
    return this.store.transaction(async tx => {
      const occurrence = await tx.get(ownerId, instanceId);
      if (!occurrence || occurrence.todoId !== todoId) throw new SyncEngineError('NOT_FOUND', '提醒实例不存在。');
      if (occurrence.state === 'cancelled') throw new SyncEngineError('INVALID_TRANSITION', '提醒实例已取消。');
      const recordedAt = allowed === 'submitted' ? occurrence.submittedAt : allowed === 'delivered' ? occurrence.deliveredAt : occurrence.openedAt;
      if (recordedAt) {
        if (Date.parse(observed) < Date.parse(recordedAt)) throw new SyncEngineError('INVALID_TRANSITION', '回执时间不能倒退。');
        return clone(occurrence);
      }
      const latest = [occurrence.submittedAt, occurrence.deliveredAt, occurrence.openedAt].filter((value): value is string => value !== null).map(Date.parse).reduce((max, value) => Math.max(max, value), Number.NEGATIVE_INFINITY);
      if (Date.parse(observed) < latest || (allowed === 'delivered' && !occurrence.submittedAt) || (allowed === 'opened' && !occurrence.deliveredAt)) throw new SyncEngineError('INVALID_TRANSITION', '提醒回执状态或时间无效。');
      const next: ReminderOccurrence = { ...occurrence, state: allowed, submittedAt: allowed === 'submitted' ? observed : occurrence.submittedAt ?? observed, deliveredAt: allowed === 'delivered' ? observed : occurrence.deliveredAt, openedAt: allowed === 'opened' ? observed : occurrence.openedAt };
      await tx.save(next);
      return clone(next);
    });
  }

  async complete(context: RequestContext, ownerId: string, todoId: string, instanceId: string, completedAt: string): Promise<ReminderOccurrence> {
    await authorizeOrThrow(this.authorizer, context, 'receipt', 'todo', todoId, ownerId);
    const completed = instant(completedAt, 'completedAt');
    const result = await this.store.transaction(async tx => {
      const occurrence = await tx.get(ownerId, instanceId);
      if (!occurrence || occurrence.todoId !== todoId) throw new SyncEngineError('NOT_FOUND', '提醒实例不存在。');
      if (occurrence.state === 'cancelled') throw new SyncEngineError('INVALID_TRANSITION', '提醒实例已取消。');
      if (occurrence.completedAt) return clone(occurrence);
      const latest = [occurrence.submittedAt, occurrence.deliveredAt, occurrence.openedAt].filter((value): value is string => value !== null).map(Date.parse).reduce((max, value) => Math.max(max, value), Number.NEGATIVE_INFINITY);
      if (Date.parse(completed) < latest) throw new SyncEngineError('INVALID_TRANSITION', '完成时间不能早于提醒回执。');
      const next = { ...occurrence, completedAt: completed };
      await tx.save(next);
      return clone(next);
    });
    await this.queue.cancel(`reminder:${ownerId}:${instanceId}`);
    return result;
  }

  async recover(now = this.clock.now()): Promise<void> {
    const recoveredAt = instant(now, 'now');
    await this.queue.recover(recoveredAt);
    for (const occurrence of await this.store.listPending()) {
      if (occurrence.state === 'scheduled' || occurrence.state === 'submitted') {
        await this.queue.enqueue({ id: `reminder:${occurrence.ownerId}:${occurrence.instanceId}`, ownerId: occurrence.ownerId, occurrenceId: occurrence.instanceId, availableAt: occurrence.state === 'submitted' ? recoveredAt : occurrence.plannedAt, status: 'queued', attempts: 0, leaseToken: null, leaseExpiresAt: null, lastError: null });
      }
    }
  }
}

function encodeCursor(context: RequestContext, sequence: number): string { return Buffer.from(JSON.stringify({ actorId: context.actorId, subjectId: context.subjectId, sequence }), 'utf8').toString('base64url'); }
function decodeCursor(cursor: string | undefined, context: RequestContext): number { if (!cursor) return 0; try { const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { actorId: string; subjectId: string; sequence: number }; if (value.actorId !== context.actorId || value.subjectId !== context.subjectId || !Number.isSafeInteger(value.sequence) || value.sequence < 0) throw new Error(); return value.sequence; } catch { throw new SyncEngineError('INVALID_INPUT', 'cursor 无效或不属于当前 actor/subject。'); } }

export { encodeCursor };
