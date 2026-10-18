import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve as resolvePath } from 'node:path';
import type { ChangeEnvelope, EntityType, MutationReceipt, OutboxItem, ReminderOccurrence, ReminderStore, ReminderTask, ReminderTransaction, StoredEntity, SyncStore, SyncTransaction, TaskQueuePort } from './ports.ts';
import { SyncEngineError } from './ports.ts';

export const syncSchemaVersion = 1;

export interface SqliteSyncStoreOptions {
  database?: DatabaseSync;
  path?: string;
}

export interface SyncRestoreOptions {
  safetySnapshotPath: string;
  recoveredAt?: string;
}

type SqliteSource = DatabaseSync | string;

const databaseLocks = new WeakMap<DatabaseSync, Promise<void>>();
const databaseLockPaths = new WeakMap<DatabaseSync, string>();
const pathLocks = new Map<string, Promise<void>>();
const clone = <Value>(value: Value): Value => structuredClone(value);

function databaseFrom(options: SqliteSyncStoreOptions): { database: DatabaseSync; owned: boolean } {
  if (options.database) return { database: options.database, owned: false };
  const path = options.path ?? ':memory:';
  const database = new DatabaseSync(path);
  if (path !== ':memory:') databaseLockPaths.set(database, resolvePath(path));
  return { database, owned: true };
}

function resolveDatabase(source: SqliteSource | undefined): { database: DatabaseSync; owned: boolean } {
  return typeof source === 'string' || source === undefined
    ? databaseFrom({ path: source })
    : { database: source, owned: false };
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function parse<Value>(value: string): Value {
  return JSON.parse(value) as Value;
}

function schemaVersion(database: DatabaseSync): number {
  const row = database.prepare("SELECT value FROM nb_sync_meta WHERE key = 'schema_version'").get() as { value?: string } | undefined;
  return Number(row?.value ?? 0);
}

function databaseFile(database: DatabaseSync): string {
  const row = database.prepare("PRAGMA database_list").all().find(item => String(item.name) === 'main') as { file?: string } | undefined;
  return row?.file ?? ':memory:';
}

function shouldRestoreEntity(current: StoredEntity, source: StoredEntity): boolean {
  return current.deletedAt === null && (source.version > current.version || source.deletedAt !== null);
}

function numberValue(value: number | bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new SyncEngineError('INVALID_INPUT', 'SQLite sequence 超出安全整数范围。');
  return result;
}

async function withDatabaseLock<Result>(database: DatabaseSync, work: () => Promise<Result>): Promise<Result> {
  const lockPath = databaseLockPaths.get(database);
  const previous = lockPath ? pathLocks.get(lockPath) ?? Promise.resolve() : databaseLocks.get(database) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  if (lockPath) pathLocks.set(lockPath, current);
  else databaseLocks.set(database, current);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (lockPath) {
      if (pathLocks.get(lockPath) === current) pathLocks.delete(lockPath);
    } else if (databaseLocks.get(database) === current) {
      databaseLocks.delete(database);
    }
  }
}

async function transaction<Result>(database: DatabaseSync, work: () => Promise<Result>): Promise<Result> {
  return withDatabaseLock(database, async () => {
    database.exec('BEGIN IMMEDIATE');
    try {
      const result = await work();
      database.exec('COMMIT');
      return result;
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch { }
      throw error;
    }
  });
}

export function migrateSyncDatabase(database: DatabaseSync, targetVersion = syncSchemaVersion): void {
  if (!Number.isSafeInteger(targetVersion) || targetVersion < 0 || targetVersion > syncSchemaVersion) throw new Error(`Unsupported sync SQLite schema version: ${targetVersion}`);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec('CREATE TABLE IF NOT EXISTS nb_sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const row = database.prepare("SELECT value FROM nb_sync_meta WHERE key = 'schema_version'").get() as { value?: string } | undefined;
    const current = row ? Number(row.value) : 0;
    if (!Number.isSafeInteger(current) || current < 0 || current > syncSchemaVersion) throw new Error(`Invalid sync SQLite schema version: ${row?.value ?? 'missing'}`);
    if (current > targetVersion) throw new Error(`Sync SQLite rollback requires explicit rollback: ${current} -> ${targetVersion}`);
    if (current < 1 && targetVersion >= 1) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS nb_sync_entities (
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY (entity_type, entity_id)
        );
        CREATE TABLE IF NOT EXISTS nb_sync_changes (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          operation TEXT NOT NULL,
          payload TEXT
        );
        CREATE TABLE IF NOT EXISTS nb_sync_mutations (
          actor_id TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          mutation_id TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY (actor_id, owner_id, mutation_id)
        );
        CREATE TABLE IF NOT EXISTS nb_sync_outbox (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          status TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS nb_sync_changes_owner_sequence ON nb_sync_changes(owner_id, sequence);
        CREATE INDEX IF NOT EXISTS nb_sync_entities_owner_type ON nb_sync_entities(owner_id, entity_type);
        CREATE TABLE IF NOT EXISTS nb_reminder_occurrences (
          owner_id TEXT NOT NULL,
          instance_id TEXT NOT NULL,
          todo_id TEXT NOT NULL,
          state TEXT NOT NULL,
          planned_at TEXT NOT NULL,
          completed_at TEXT,
          payload TEXT NOT NULL,
          PRIMARY KEY (owner_id, instance_id)
        );
        CREATE INDEX IF NOT EXISTS nb_reminder_pending ON nb_reminder_occurrences(owner_id, state, completed_at);
        CREATE TABLE IF NOT EXISTS nb_reminder_tasks (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          available_at TEXT NOT NULL,
          lease_expires_at TEXT,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS nb_reminder_ready ON nb_reminder_tasks(status, available_at);
      `);
      database.prepare("INSERT INTO nb_sync_meta(key, value) VALUES ('schema_version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
    }
    database.exec('COMMIT');
  } catch (error) {
    try { database.exec('ROLLBACK'); } catch { }
    throw error;
  }
}

export function rollbackSyncDatabase(database: DatabaseSync, targetVersion = 0): void {
  if (targetVersion !== 0) throw new Error(`Unsupported sync SQLite rollback target: ${targetVersion}`);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec('DROP TABLE IF EXISTS nb_reminder_tasks; DROP TABLE IF EXISTS nb_reminder_occurrences; DROP TABLE IF EXISTS nb_sync_outbox; DROP TABLE IF EXISTS nb_sync_mutations; DROP TABLE IF EXISTS nb_sync_changes; DROP TABLE IF EXISTS nb_sync_entities;');
    database.prepare("INSERT INTO nb_sync_meta(key, value) VALUES ('schema_version', '0') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
    database.exec('COMMIT');
  } catch (error) {
    try { database.exec('ROLLBACK'); } catch { }
    throw error;
  }
}

class SqliteSyncTransaction implements SyncTransaction {
  constructor(private readonly database: DatabaseSync) {}

  async getEntity(entityType: EntityType, entityId: string, ownerId: string): Promise<StoredEntity | null> {
    const row = this.database.prepare('SELECT payload FROM nb_sync_entities WHERE entity_type = ? AND entity_id = ? AND owner_id = ?').get(entityType, entityId, ownerId) as { payload?: string } | undefined;
    return row?.payload ? clone(parse<StoredEntity>(row.payload)) : null;
  }

  async getEntityById(entityType: EntityType, entityId: string): Promise<StoredEntity | null> {
    const row = this.database.prepare('SELECT payload FROM nb_sync_entities WHERE entity_type = ? AND entity_id = ?').get(entityType, entityId) as { payload?: string } | undefined;
    return row?.payload ? clone(parse<StoredEntity>(row.payload)) : null;
  }

  async listEntities(entityType: EntityType, ownerId: string): Promise<StoredEntity[]> {
    const rows = this.database.prepare('SELECT payload FROM nb_sync_entities WHERE entity_type = ? AND owner_id = ? ORDER BY rowid').all(entityType, ownerId) as Array<{ payload: string }>;
    return rows.map(row => clone(parse<StoredEntity>(row.payload)));
  }

  async putEntity(entity: StoredEntity): Promise<void> {
    this.database.prepare(`INSERT INTO nb_sync_entities(entity_type, entity_id, owner_id, payload) VALUES (?, ?, ?, ?)
      ON CONFLICT(entity_type, entity_id) DO UPDATE SET owner_id = excluded.owner_id, payload = excluded.payload`).run(entity.entityType, entity.id, entity.ownerId, json(entity));
  }

  async appendChange(change: Omit<ChangeEnvelope, 'sequence'>): Promise<ChangeEnvelope> {
    const result = this.database.prepare('INSERT INTO nb_sync_changes(owner_id, entity_type, entity_id, version, operation, payload) VALUES (?, ?, ?, ?, ?, ?)').run(change.ownerId, change.entityType, change.entityId, change.version, change.operation, change.entity === null ? null : json(change.entity));
    const envelope: ChangeEnvelope = { ...clone(change), sequence: numberValue(result.lastInsertRowid) };
    return clone(envelope);
  }

  async listChanges(afterSequence: number, limit: number): Promise<ChangeEnvelope[]> {
    const rows = this.database.prepare('SELECT sequence, owner_id, entity_type, entity_id, version, operation, payload FROM nb_sync_changes WHERE sequence > ? ORDER BY sequence LIMIT ?').all(afterSequence, limit) as Array<{ sequence: number | bigint; owner_id: string; entity_type: EntityType; entity_id: string; version: number; operation: ChangeEnvelope['operation']; payload: string | null }>;
    return rows.map(row => ({ sequence: numberValue(row.sequence), ownerId: row.owner_id, entityType: row.entity_type, entityId: row.entity_id, version: row.version, operation: row.operation, entity: row.payload === null ? null : clone(parse<StoredEntity>(row.payload)) }));
  }

  async getChangeSequence(): Promise<number> {
    const row = this.database.prepare('SELECT COALESCE(MAX(sequence), 0) AS sequence FROM nb_sync_changes').get() as { sequence: number | bigint };
    return numberValue(row.sequence);
  }

  async getMutation(actorId: string, ownerId: string, mutationId: string): Promise<MutationReceipt | null> {
    const row = this.database.prepare('SELECT payload FROM nb_sync_mutations WHERE actor_id = ? AND owner_id = ? AND mutation_id = ?').get(actorId, ownerId, mutationId) as { payload?: string } | undefined;
    return row?.payload ? clone(parse<MutationReceipt>(row.payload)) : null;
  }

  async saveMutation(receipt: MutationReceipt): Promise<void> {
    this.database.prepare(`INSERT INTO nb_sync_mutations(actor_id, owner_id, mutation_id, fingerprint, payload) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(actor_id, owner_id, mutation_id) DO UPDATE SET fingerprint = excluded.fingerprint, payload = excluded.payload`).run(receipt.actorId, receipt.ownerId, receipt.mutation.mutationId, receipt.fingerprint, json(receipt));
  }

  async enqueueOutbox(item: OutboxItem): Promise<void> {
    const current = this.database.prepare('SELECT payload FROM nb_sync_outbox WHERE id = ?').get(item.id) as { payload?: string } | undefined;
    if (current?.payload && JSON.stringify(parse<OutboxItem>(current.payload)) !== JSON.stringify(item)) throw new SyncEngineError('IDEMPOTENCY_CONFLICT', 'outbox 项已存在且内容不同。');
    if (!current) this.database.prepare('INSERT INTO nb_sync_outbox(id, owner_id, status, payload) VALUES (?, ?, ?, ?)').run(item.id, item.ownerId, item.status, json(item));
  }

  async getOutbox(id: string): Promise<OutboxItem | null> {
    const row = this.database.prepare('SELECT payload FROM nb_sync_outbox WHERE id = ?').get(id) as { payload?: string } | undefined;
    return row?.payload ? clone(parse<OutboxItem>(row.payload)) : null;
  }

  async listOutbox(ownerId: string): Promise<OutboxItem[]> {
    const rows = this.database.prepare('SELECT payload FROM nb_sync_outbox WHERE owner_id = ? ORDER BY rowid').all(ownerId) as Array<{ payload: string }>;
    return rows.map(row => clone(parse<OutboxItem>(row.payload)));
  }

  async acknowledgeOutbox(id: string): Promise<void> {
    const row = this.database.prepare('SELECT payload FROM nb_sync_outbox WHERE id = ?').get(id) as { payload?: string } | undefined;
    if (!row?.payload) return;
    const item = parse<OutboxItem>(row.payload);
    item.status = 'acknowledged';
    this.database.prepare('UPDATE nb_sync_outbox SET status = ?, payload = ? WHERE id = ?').run(item.status, json(item), id);
  }
}

export class SqliteSyncStore implements SyncStore {
  readonly database: DatabaseSync;
  private readonly owned: boolean;

  constructor(options: SqliteSyncStoreOptions = {}) {
    const resolved = databaseFrom(options);
    this.database = resolved.database;
    this.owned = resolved.owned;
    try {
      migrateSyncDatabase(this.database);
    } catch (error) {
      if (this.owned) this.database.close();
      throw error;
    }
  }

  restoreFromSnapshot(snapshotPath: string, options: SyncRestoreOptions): { sourceSchemaVersion: number; rowsRead: number; destructiveStatePreserved: true; pendingSideEffectsRestored: false } {
    const recoveryTime = options?.recoveredAt ?? new Date().toISOString();
    if (!options?.safetySnapshotPath || !Number.isFinite(Date.parse(recoveryTime))) throw new Error('Sync SQLite recovery requires a retained safety snapshot and valid recovery time');
    const sourcePath = realpathSync(snapshotPath);
    const safetyPath = realpathSync(options.safetySnapshotPath);
    const activePath = databaseFile(this.database);
    if (activePath !== ':memory:' && [sourcePath, safetyPath].includes(realpathSync(activePath))) throw new Error('SQLite snapshots must be different from the active database');
    const snapshot = new DatabaseSync(sourcePath, { readOnly: true });
    let safety: DatabaseSync | undefined;
    try {
      safety = new DatabaseSync(safetyPath, { readOnly: true });
      const sourceSchemaVersion = schemaVersion(snapshot);
      for (const source of [snapshot, safety]) {
        if (schemaVersion(source) !== schemaVersion(this.database)) throw new Error('Sync SQLite snapshot schema version mismatch');
        if (source.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') throw new Error('Sync SQLite snapshot integrity check failed');
      }
      const safetyRows = safety.prepare('SELECT entity_type, entity_id, owner_id, payload FROM nb_sync_entities').all() as Array<{ entity_type: EntityType; entity_id: string; owner_id: string; payload: string }>;
      const entityKey = (row: typeof safetyRows[number]) => JSON.stringify([row.entity_type, row.entity_id]);
      const safetyOwners = new Map(safetyRows.map(row => [entityKey(row), row.owner_id]));
      let rowsRead = 0;
      this.database.exec('BEGIN IMMEDIATE');
      try {
        const backupRows = snapshot.prepare('SELECT entity_type, entity_id, owner_id, payload FROM nb_sync_entities').all() as typeof safetyRows;
        const entities = [...safetyRows, ...backupRows];
        const findEntity = this.database.prepare('SELECT payload FROM nb_sync_entities WHERE entity_type = ? AND entity_id = ?');
        const insertEntity = this.database.prepare('INSERT INTO nb_sync_entities(entity_type, entity_id, owner_id, payload) VALUES (?, ?, ?, ?)');
        const updateEntity = this.database.prepare('UPDATE nb_sync_entities SET owner_id = ?, payload = ? WHERE entity_type = ? AND entity_id = ?');
        for (const row of entities) {
          rowsRead += 1;
          const source = parse<StoredEntity>(row.payload);
          if (source.id !== row.entity_id || source.entityType !== row.entity_type || source.ownerId !== row.owner_id || !['note', 'todo'].includes(source.entityType) || !Number.isSafeInteger(source.version) || source.version < 1 || (source.deletedAt !== null && (typeof source.deletedAt !== 'string' || !Number.isFinite(Date.parse(source.deletedAt))))) throw new Error('Sync SQLite recovery entity identity is invalid');
          const safetyOwner = safetyOwners.get(entityKey(row));
          if (safetyOwner === undefined) continue;
          if (safetyOwner !== row.owner_id) throw new Error('Sync SQLite recovery owner mismatch');
          const currentRow = findEntity.get(row.entity_type, row.entity_id) as { payload?: string } | undefined;
          if (!currentRow) insertEntity.run(row.entity_type, row.entity_id, row.owner_id, row.payload);
          else {
            const current = parse<StoredEntity>(currentRow.payload ?? '{}');
            if (current.ownerId !== source.ownerId) throw new Error('Sync SQLite recovery owner mismatch');
            if (shouldRestoreEntity(current, source)) updateEntity.run(row.owner_id, json({ ...source, version: Math.max(current.version, source.version) }), row.entity_type, row.entity_id);
          }
        }
        const sourceSequence = Math.max(...[snapshot, safety, this.database].map(database => Number(database.prepare('SELECT COALESCE(MAX(sequence), 0) AS sequence FROM nb_sync_changes').get()?.sequence ?? 0)));
        const sequenceRow = this.database.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'nb_sync_changes'").get();
        if (!sequenceRow) this.database.prepare("INSERT INTO sqlite_sequence(name, seq) VALUES ('nb_sync_changes', ?)").run(sourceSequence);
        else if (Number(sequenceRow.seq) < sourceSequence) this.database.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name = 'nb_sync_changes'").run(sourceSequence);
        for (const row of this.database.prepare('SELECT entity_type, entity_id, owner_id, payload FROM nb_sync_entities').all() as typeof safetyRows) {
          const entity = parse<StoredEntity>(row.payload);
          if (!safetyOwners.has(entityKey(row)) && entity.deletedAt === null) throw new Error('Sync SQLite recovery requires a safety checkpoint for every active entity');
          const operation = entity.deletedAt === null ? 'upsert' : 'delete';
          const payload = entity.deletedAt === null ? row.payload : null;
          const latestChange = this.database.prepare('SELECT version, operation, payload FROM nb_sync_changes WHERE owner_id = ? AND entity_type = ? AND entity_id = ? ORDER BY sequence DESC LIMIT 1').get(row.owner_id, row.entity_type, row.entity_id);
          const appendCanonicalChange = !latestChange || latestChange.version !== entity.version || latestChange.operation !== operation || latestChange.payload !== payload;
          if (entity.deletedAt !== null) {
            this.database.prepare("UPDATE nb_sync_changes SET operation = 'delete', payload = NULL, version = ? WHERE owner_id = ? AND entity_type = ? AND entity_id = ?").run(entity.version, row.owner_id, row.entity_type, row.entity_id);
          }
          if (appendCanonicalChange) this.database.prepare('INSERT INTO nb_sync_changes(owner_id, entity_type, entity_id, version, operation, payload) VALUES (?, ?, ?, ?, ?, ?)').run(row.owner_id, row.entity_type, row.entity_id, entity.version, operation, payload);
        }
        this.database.exec('DELETE FROM nb_sync_mutations; DELETE FROM nb_sync_outbox;');
        for (const row of this.database.prepare("SELECT owner_id, instance_id, payload FROM nb_reminder_occurrences WHERE state IN ('scheduled', 'submitted')").all() as Array<{ owner_id: string; instance_id: string; payload: string }>) {
          const occurrence = parse<ReminderOccurrence>(row.payload);
          this.database.prepare("UPDATE nb_reminder_occurrences SET state = 'cancelled', payload = ? WHERE owner_id = ? AND instance_id = ?").run(json({ ...occurrence, state: 'cancelled', cancelledAt: recoveryTime }), row.owner_id, row.instance_id);
        }
        for (const row of this.database.prepare("SELECT id, payload FROM nb_reminder_tasks WHERE status IN ('queued', 'running')").all() as Array<{ id: string; payload: string }>) {
          const task = parse<ReminderTask>(row.payload);
          this.database.prepare("UPDATE nb_reminder_tasks SET status = 'cancelled', lease_expires_at = NULL, payload = ? WHERE id = ?").run(json({ ...task, status: 'cancelled', leaseToken: null, leaseExpiresAt: null }), row.id);
        }
        this.database.exec('COMMIT');
      } catch (error) {
        try { this.database.exec('ROLLBACK'); } catch { }
        throw error;
      }
      return { sourceSchemaVersion, rowsRead, destructiveStatePreserved: true, pendingSideEffectsRestored: false };
    } finally {
      safety?.close();
      snapshot.close();
    }
  }

  transaction<Result>(work: (transaction: SyncTransaction) => Promise<Result>): Promise<Result> {
    return transaction(this.database, () => work(new SqliteSyncTransaction(this.database)));
  }

  close(): void {
    if (this.owned) this.database.close();
  }
}

class SqliteReminderTransaction implements ReminderTransaction {
  constructor(private readonly database: DatabaseSync) {}

  async get(ownerId: string, instanceId: string): Promise<ReminderOccurrence | null> {
    const row = this.database.prepare('SELECT payload FROM nb_reminder_occurrences WHERE owner_id = ? AND instance_id = ?').get(ownerId, instanceId) as { payload?: string } | undefined;
    return row?.payload ? clone(parse<ReminderOccurrence>(row.payload)) : null;
  }

  async list(ownerId: string): Promise<ReminderOccurrence[]> {
    const rows = this.database.prepare('SELECT payload FROM nb_reminder_occurrences WHERE owner_id = ? ORDER BY planned_at').all(ownerId) as Array<{ payload: string }>;
    return rows.map(row => clone(parse<ReminderOccurrence>(row.payload)));
  }

  async save(occurrence: ReminderOccurrence): Promise<void> {
    this.database.prepare(`INSERT INTO nb_reminder_occurrences(owner_id, instance_id, todo_id, state, planned_at, completed_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, instance_id) DO UPDATE SET todo_id = excluded.todo_id, state = excluded.state, planned_at = excluded.planned_at, completed_at = excluded.completed_at, payload = excluded.payload`).run(occurrence.ownerId, occurrence.instanceId, occurrence.todoId, occurrence.state, occurrence.plannedAt, occurrence.completedAt, json(occurrence));
  }
}

export class SqliteReminderStore implements ReminderStore {
  readonly database: DatabaseSync;
  private readonly owned: boolean;

  constructor(source?: SqliteSource) {
    const resolved = resolveDatabase(source);
    this.database = resolved.database;
    this.owned = resolved.owned;
    try {
      migrateSyncDatabase(this.database);
    } catch (error) {
      if (this.owned) this.database.close();
      throw error;
    }
  }

  get(ownerId: string, instanceId: string): Promise<ReminderOccurrence | null> {
    return this.transaction(transactionValue => transactionValue.get(ownerId, instanceId));
  }

  list(ownerId: string): Promise<ReminderOccurrence[]> {
    return this.transaction(transactionValue => transactionValue.list(ownerId));
  }

  listPending(): Promise<ReminderOccurrence[]> {
    return transaction(this.database, async () => {
      const rows = this.database.prepare("SELECT payload FROM nb_reminder_occurrences WHERE state IN ('scheduled', 'submitted') AND completed_at IS NULL ORDER BY planned_at").all() as Array<{ payload: string }>;
      return rows.map(row => clone(parse<ReminderOccurrence>(row.payload)));
    });
  }

  save(occurrence: ReminderOccurrence): Promise<void> {
    return this.transaction(transactionValue => transactionValue.save(occurrence));
  }

  transaction<Result>(work: (transaction: ReminderTransaction) => Promise<Result>): Promise<Result> {
    return transaction(this.database, () => work(new SqliteReminderTransaction(this.database)));
  }

  close(): void {
    if (this.owned) this.database.close();
  }
}

function validTime(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new SyncEngineError('INVALID_INPUT', `${field} 必须是有效时间。`);
  return parsed;
}

class SqliteTaskQueueStore {
  constructor(private readonly database: DatabaseSync) {}

  private row(id: string): ReminderTask | null {
    const result = this.database.prepare('SELECT payload FROM nb_reminder_tasks WHERE id = ?').get(id) as { payload?: string } | undefined;
    return result?.payload ? clone(parse<ReminderTask>(result.payload)) : null;
  }

  async enqueue(task: ReminderTask): Promise<void> {
    await transaction(this.database, async () => {
      if (!this.row(task.id)) this.database.prepare('INSERT INTO nb_reminder_tasks(id, status, available_at, lease_expires_at, payload) VALUES (?, ?, ?, ?, ?)').run(task.id, task.status, task.availableAt, task.leaseExpiresAt, json(task));
    });
  }

  async listReady(now: string): Promise<ReminderTask[]> {
    const nowTime = validTime(now, 'now');
    return transaction(this.database, async () => {
      const rows = this.database.prepare("SELECT payload FROM nb_reminder_tasks WHERE status = 'queued'").all() as Array<{ payload: string }>;
      return rows.map(row => parse<ReminderTask>(row.payload)).filter(task => Date.parse(task.availableAt) <= nowTime).map(clone);
    });
  }

  async claim(taskId: string, now: string, leaseMilliseconds = 30_000): Promise<ReminderTask | null> {
    const nowTime = validTime(now, 'now');
    if (!Number.isSafeInteger(leaseMilliseconds) || leaseMilliseconds < 1) throw new SyncEngineError('INVALID_INPUT', 'leaseMilliseconds 无效。');
    return transaction(this.database, async () => {
      const task = this.row(taskId);
      if (!task || task.status !== 'queued' || Date.parse(task.availableAt) > nowTime) return null;
      const claimed: ReminderTask = { ...task, status: 'running', attempts: task.attempts + 1, leaseToken: `sqlite-lease-${randomUUID()}`, leaseExpiresAt: new Date(nowTime + leaseMilliseconds).toISOString() };
      this.database.prepare('UPDATE nb_reminder_tasks SET status = ?, available_at = ?, lease_expires_at = ?, payload = ? WHERE id = ?').run(claimed.status, claimed.availableAt, claimed.leaseExpiresAt, json(claimed), taskId);
      return clone(claimed);
    });
  }

  async complete(taskId: string, leaseToken: string): Promise<void> {
    await transaction(this.database, async () => {
      const task = this.row(taskId);
      if (task?.status === 'running' && task.leaseToken === leaseToken) {
        const completed: ReminderTask = { ...task, status: 'completed', leaseToken: null, leaseExpiresAt: null };
        this.database.prepare('UPDATE nb_reminder_tasks SET status = ?, lease_expires_at = NULL, payload = ? WHERE id = ?').run(completed.status, json(completed), taskId);
      }
    });
  }

  async retry(taskId: string, leaseToken: string, availableAt: string, error: string): Promise<void> {
    validTime(availableAt, 'availableAt');
    await transaction(this.database, async () => {
      const task = this.row(taskId);
      if (task?.status === 'running' && task.leaseToken === leaseToken) {
        const queued: ReminderTask = { ...task, status: 'queued', availableAt, leaseToken: null, leaseExpiresAt: null, lastError: error };
        this.database.prepare('UPDATE nb_reminder_tasks SET status = ?, available_at = ?, lease_expires_at = NULL, payload = ? WHERE id = ?').run(queued.status, queued.availableAt, json(queued), taskId);
      }
    });
  }

  async cancel(taskId: string): Promise<void> {
    await transaction(this.database, async () => {
      const task = this.row(taskId);
      if (task) {
        const cancelled: ReminderTask = { ...task, status: 'cancelled', leaseToken: null, leaseExpiresAt: null };
        this.database.prepare('UPDATE nb_reminder_tasks SET status = ?, lease_expires_at = NULL, payload = ? WHERE id = ?').run(cancelled.status, json(cancelled), taskId);
      }
    });
  }

  async recover(now: string): Promise<void> {
    const nowTime = validTime(now, 'now');
    await transaction(this.database, async () => {
      const rows = this.database.prepare("SELECT payload FROM nb_reminder_tasks WHERE status = 'running'").all() as Array<{ payload: string }>;
      for (const row of rows) {
        const task = parse<ReminderTask>(row.payload);
        if (!task.leaseExpiresAt || Date.parse(task.leaseExpiresAt) <= nowTime) {
          const recovered: ReminderTask = { ...task, status: 'queued', availableAt: now, leaseToken: null, leaseExpiresAt: null };
          this.database.prepare('UPDATE nb_reminder_tasks SET status = ?, available_at = ?, lease_expires_at = NULL, payload = ? WHERE id = ?').run(recovered.status, recovered.availableAt, json(recovered), task.id);
        }
      }
    });
  }

  snapshot(): Promise<ReminderTask[]> {
    return transaction(this.database, async () => {
      const rows = this.database.prepare('SELECT payload FROM nb_reminder_tasks ORDER BY rowid').all() as Array<{ payload: string }>;
      return rows.map(row => clone(parse<ReminderTask>(row.payload)));
    });
  }
}

export class SqliteTaskQueue implements TaskQueuePort {
  readonly database: DatabaseSync;
  private readonly owned: boolean;
  private readonly store: SqliteTaskQueueStore;

  constructor(source?: SqliteSource) {
    const resolved = resolveDatabase(source);
    this.database = resolved.database;
    this.owned = resolved.owned;
    try {
      migrateSyncDatabase(this.database);
    } catch (error) {
      if (this.owned) this.database.close();
      throw error;
    }
    this.store = new SqliteTaskQueueStore(this.database);
  }

  enqueue(task: ReminderTask): Promise<void> { return this.store.enqueue(task); }
  listReady(now: string): Promise<ReminderTask[]> { return this.store.listReady(now); }
  claim(taskId: string, now: string, leaseMilliseconds?: number): Promise<ReminderTask | null> { return this.store.claim(taskId, now, leaseMilliseconds); }
  complete(taskId: string, leaseToken: string): Promise<void> { return this.store.complete(taskId, leaseToken); }
  retry(taskId: string, leaseToken: string, availableAt: string, error: string): Promise<void> { return this.store.retry(taskId, leaseToken, availableAt, error); }
  cancel(taskId: string): Promise<void> { return this.store.cancel(taskId); }
  recover(now: string): Promise<void> { return this.store.recover(now); }

  snapshot(): Promise<ReminderTask[]> { return this.store.snapshot(); }

  close(): void {
    if (this.owned) this.database.close();
  }
}
