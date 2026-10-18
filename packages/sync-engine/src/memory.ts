import type { AccessAction, ChangeEnvelope, EntityType, MutationReceipt, ObjectAuthorizer, ObjectAuthorizationRequest, OutboxItem, ReminderDeliveryPort, ReminderOccurrence, ReminderStore, ReminderTask, ReminderTransaction, StoredEntity, SyncStore, SyncTransaction, TaskQueuePort } from './ports.ts';
import { SyncEngineError } from './ports.ts';

const clone = <Value>(value: Value): Value => structuredClone(value);

function token(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface MemoryState {
  entities: Map<string, StoredEntity>;
  changes: ChangeEnvelope[];
  mutations: Map<string, MutationReceipt>;
  outbox: Map<string, OutboxItem>;
  sequence: number;
}

function entityKey(entityType: EntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

function mutationKey(actorId: string, ownerId: string, mutationId: string): string {
  return `${actorId}:${ownerId}:${mutationId}`;
}

class MemoryTransaction implements SyncTransaction {
  constructor(private readonly state: MemoryState) {}

  async getEntity(entityType: EntityType, entityId: string, ownerId: string): Promise<StoredEntity | null> {
    const entity = this.state.entities.get(entityKey(entityType, entityId));
    return entity?.ownerId === ownerId ? clone(entity) : null;
  }

  async getEntityById(entityType: EntityType, entityId: string): Promise<StoredEntity | null> {
    return clone(this.state.entities.get(entityKey(entityType, entityId)) ?? null);
  }

  async listEntities(entityType: EntityType, ownerId: string): Promise<StoredEntity[]> {
    return [...this.state.entities.values()]
      .filter(entity => entity.entityType === entityType && entity.ownerId === ownerId)
      .map(clone);
  }

  async putEntity(entity: StoredEntity): Promise<void> {
    this.state.entities.set(entityKey(entity.entityType, entity.id), clone(entity));
  }

  async appendChange(change: Omit<ChangeEnvelope, 'sequence'>): Promise<ChangeEnvelope> {
    const result = { ...clone(change), sequence: ++this.state.sequence };
    this.state.changes.push(result);
    return clone(result);
  }

  async listChanges(afterSequence: number, limit: number): Promise<ChangeEnvelope[]> {
    return this.state.changes.filter(change => change.sequence > afterSequence).slice(0, limit).map(clone);
  }

  async getChangeSequence(): Promise<number> {
    return this.state.sequence;
  }

  async getMutation(actorId: string, ownerId: string, mutationId: string): Promise<MutationReceipt | null> {
    return clone(this.state.mutations.get(mutationKey(actorId, ownerId, mutationId)) ?? null);
  }

  async saveMutation(receipt: MutationReceipt): Promise<void> {
    this.state.mutations.set(mutationKey(receipt.actorId, receipt.ownerId, receipt.mutation.mutationId), clone(receipt));
  }

  async enqueueOutbox(item: OutboxItem): Promise<void> {
    const current = this.state.outbox.get(item.id);
    if (current && JSON.stringify(current) !== JSON.stringify(item)) {
      throw new SyncEngineError('IDEMPOTENCY_CONFLICT', 'outbox 项已存在且内容不同。');
    }
    if (!current) this.state.outbox.set(item.id, clone(item));
  }

  async getOutbox(id: string): Promise<OutboxItem | null> {
    return clone(this.state.outbox.get(id) ?? null);
  }

  async listOutbox(ownerId: string): Promise<OutboxItem[]> {
    return [...this.state.outbox.values()].filter(item => item.ownerId === ownerId).map(clone);
  }

  async acknowledgeOutbox(id: string): Promise<void> {
    const item = this.state.outbox.get(id);
    if (item) this.state.outbox.set(id, { ...item, status: 'acknowledged' });
  }
}

function stateSnapshot(state: MemoryState): MemoryState {
  return {
    entities: new Map([...state.entities].map(([key, value]) => [key, clone(value)])),
    changes: clone(state.changes),
    mutations: new Map([...state.mutations].map(([key, value]) => [key, clone(value)])),
    outbox: new Map([...state.outbox].map(([key, value]) => [key, clone(value)])),
    sequence: state.sequence,
  };
}

function restoreState(target: MemoryState, source: MemoryState): void {
  target.entities = source.entities;
  target.changes = source.changes;
  target.mutations = source.mutations;
  target.outbox = source.outbox;
  target.sequence = source.sequence;
}

export class InMemorySyncStore implements SyncStore {
  private readonly state: MemoryState = { entities: new Map(), changes: [], mutations: new Map(), outbox: new Map(), sequence: 0 };
  private lock: Promise<void> = Promise.resolve();

  async transaction<Result>(work: (transaction: SyncTransaction) => Promise<Result>): Promise<Result> {
    let release!: () => void;
    const previous = this.lock;
    this.lock = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const before = stateSnapshot(this.state);
    try {
      return await work(new MemoryTransaction(this.state));
    } catch (error) {
      restoreState(this.state, before);
      throw error;
    } finally {
      release();
    }
  }

  snapshot(): Readonly<MemoryState> {
    return stateSnapshot(this.state);
  }
}

export class InMemoryAuthorizer implements ObjectAuthorizer {
  private readonly grants = new Map<string, Set<AccessAction>>();

  grant(actorId: string, ownerId: string, entityType: EntityType, entityId: string, actions: readonly AccessAction[] = ['read', 'write', 'schedule', 'receipt']): void {
    this.grants.set(this.key(actorId, ownerId, entityType, entityId), new Set(actions));
  }

  revoke(actorId: string, ownerId: string, entityType: EntityType, entityId: string): void {
    this.grants.delete(this.key(actorId, ownerId, entityType, entityId));
  }

  async authorize(request: ObjectAuthorizationRequest): Promise<boolean> {
    if (request.actorId === request.ownerId && request.subjectId === request.ownerId) return true;
    const exact = this.grants.get(this.key(request.actorId, request.ownerId, request.entityType, request.entityId));
    const wildcard = this.grants.get(this.key(request.actorId, request.ownerId, request.entityType, '*'));
    return Boolean(exact?.has(request.action) || wildcard?.has(request.action));
  }

  private key(actorId: string, ownerId: string, entityType: EntityType, entityId: string): string {
    return `${actorId}|${ownerId}|${entityType}|${entityId}`;
  }
}

class MemoryReminderTransaction implements ReminderTransaction {
  constructor(private readonly occurrences: Map<string, ReminderOccurrence>) {}

  async get(ownerId: string, instanceId: string): Promise<ReminderOccurrence | null> {
    return clone(this.occurrences.get(`${ownerId}:${instanceId}`) ?? null);
  }

  async list(ownerId: string): Promise<ReminderOccurrence[]> {
    return [...this.occurrences.values()].filter(item => item.ownerId === ownerId).map(clone);
  }

  async save(occurrence: ReminderOccurrence): Promise<void> {
    this.occurrences.set(`${occurrence.ownerId}:${occurrence.instanceId}`, clone(occurrence));
  }
}

export class InMemoryReminderStore implements ReminderStore {
  private occurrences = new Map<string, ReminderOccurrence>();
  private lock: Promise<void> = Promise.resolve();

  async get(ownerId: string, instanceId: string): Promise<ReminderOccurrence | null> {
    return new MemoryReminderTransaction(this.occurrences).get(ownerId, instanceId);
  }

  async list(ownerId: string): Promise<ReminderOccurrence[]> {
    return new MemoryReminderTransaction(this.occurrences).list(ownerId);
  }

  async listPending(): Promise<ReminderOccurrence[]> {
    return [...this.occurrences.values()]
      .filter(item => (item.state === 'scheduled' || item.state === 'submitted') && item.completedAt === null)
      .map(clone);
  }

  async save(occurrence: ReminderOccurrence): Promise<void> {
    await new MemoryReminderTransaction(this.occurrences).save(occurrence);
  }

  async transaction<Result>(work: (transaction: ReminderTransaction) => Promise<Result>): Promise<Result> {
    let release!: () => void;
    const previous = this.lock;
    this.lock = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const before = new Map([...this.occurrences].map(([key, value]) => [key, clone(value)]));
    try {
      return await work(new MemoryReminderTransaction(this.occurrences));
    } catch (error) {
      this.occurrences = before;
      throw error;
    } finally {
      release();
    }
  }
}

function normalizeTask(task: ReminderTask): ReminderTask {
  return { ...task, leaseToken: task.leaseToken ?? null, leaseExpiresAt: task.leaseExpiresAt ?? null, lastError: task.lastError ?? null };
}

export class InMemoryTaskQueue implements TaskQueuePort {
  private readonly tasks = new Map<string, ReminderTask>();

  constructor(tasks: readonly ReminderTask[] = []) {
    for (const task of tasks) this.tasks.set(task.id, clone(normalizeTask(task)));
  }

  async enqueue(task: ReminderTask): Promise<void> {
    const current = this.tasks.get(task.id);
    if (!current) this.tasks.set(task.id, clone(normalizeTask(task)));
  }

  async listReady(now: string): Promise<ReminderTask[]> {
    const nowTime = Date.parse(now);
    if (!Number.isFinite(nowTime)) throw new SyncEngineError('INVALID_INPUT', 'now 必须是有效时间。');
    return [...this.tasks.values()]
      .filter(task => task.status === 'queued' && Date.parse(task.availableAt) <= nowTime)
      .map(clone);
  }

  async claim(taskId: string, now: string, leaseMilliseconds = 30_000): Promise<ReminderTask | null> {
    const task = this.tasks.get(taskId);
    const nowTime = Date.parse(now);
    if (!task || task.status !== 'queued' || !Number.isFinite(nowTime) || Date.parse(task.availableAt) > nowTime) return null;
    const claimed = { ...task, status: 'running' as const, attempts: task.attempts + 1, leaseToken: token('lease'), leaseExpiresAt: new Date(nowTime + leaseMilliseconds).toISOString() };
    this.tasks.set(taskId, claimed);
    return clone(claimed);
  }

  async complete(taskId: string, leaseToken: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task?.status === 'running' && task.leaseToken === leaseToken) this.tasks.set(taskId, { ...task, status: 'completed', leaseToken: null, leaseExpiresAt: null });
  }

  async retry(taskId: string, leaseToken: string, availableAt: string, error: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task?.status === 'running' && task.leaseToken === leaseToken) this.tasks.set(taskId, { ...task, status: 'queued', availableAt, leaseToken: null, leaseExpiresAt: null, lastError: error });
  }

  async cancel(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) this.tasks.set(taskId, { ...task, status: 'cancelled', leaseToken: null, leaseExpiresAt: null });
  }

  async recover(now: string): Promise<void> {
    const nowTime = Date.parse(now);
    if (!Number.isFinite(nowTime)) throw new SyncEngineError('INVALID_INPUT', 'now 必须是有效时间。');
    for (const [id, task] of this.tasks) {
      if (task.status === 'running' && (!task.leaseExpiresAt || Date.parse(task.leaseExpiresAt) <= nowTime)) {
        this.tasks.set(id, { ...task, status: 'queued', availableAt: now, leaseToken: null, leaseExpiresAt: null });
      }
    }
  }

  snapshot(): ReminderTask[] {
    return [...this.tasks.values()].map(clone);
  }
}

export class InMemoryReminderDelivery implements ReminderDeliveryPort {
  readonly submitted: ReminderOccurrence[] = [];
  private readonly keys = new Set<string>();

  async submit(occurrence: ReminderOccurrence, idempotencyKey = `reminder:${occurrence.ownerId}:${occurrence.instanceId}:submit`): Promise<void> {
    if (this.keys.has(idempotencyKey)) return;
    this.keys.add(idempotencyKey);
    this.submitted.push(clone(occurrence));
  }
}
