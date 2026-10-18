import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AuthService, signDeviceChallenge } from '../../apps/server/src/auth.ts';
import { FamilyService } from '../../apps/server/src/family.ts';
import { createSqliteRepositories, type SqliteRepositories } from '../../apps/server/src/sqlite.ts';
import { NoteService } from '../../packages/sync-engine/src/services.ts';
import { SqliteReminderStore, SqliteSyncStore, SqliteTaskQueue } from '../../packages/sync-engine/src/sqlite.ts';

const environment = 'f-development-recovery';
const now = () => Date.parse('2026-10-17T00:00:00.000Z');
const ownerId = 'synthetic-f19-owner';
const deviceId = 'synthetic-f19-device';
const noteId = 'synthetic-f19-note';
const context = { actorId: ownerId, subjectId: ownerId, deviceId };
const recoveredAt = '2026-10-17T00:30:00.000Z';
const directories: string[] = [];
const openStores = new Set<{ close(): void }>();
const observations: Array<Record<string, unknown>> = [];
let cleanupPassed = true;

function hashFile(filename: string): string {
  return createHash('sha256').update(readFileSync(filename)).digest('hex');
}

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(realpathSync(tmpdir()), 'nuanban-f19-recovery-'));
  directories.push(directory);
  return directory;
}

function openProductionStores(directory: string) {
  mkdirSync(directory, { recursive: true });
  const repositories = createSqliteRepositories({ path: path.join(directory, 'auth.sqlite'), environment });
  openStores.add(repositories);
  const sync = new SqliteSyncStore({ path: path.join(directory, 'notes.sqlite') });
  openStores.add(sync);
  return { repositories, sync, auth: new AuthService(repositories, { now }), notes: new NoteService(sync) };
}

function closeProductionStores(stores: { repositories: SqliteRepositories; sync: SqliteSyncStore }) {
  for (const store of [stores.sync, stores.repositories]) {
    store.close();
    openStores.delete(store);
  }
}

function copyClosedDatabases(source: string, destination: string) {
  mkdirSync(destination, { recursive: true });
  const files = ['auth.sqlite', 'notes.sqlite'].map(name => {
    const sourcePath = path.join(source, name);
    const destinationPath = path.join(destination, name);
    copyFileSync(sourcePath, destinationPath);
    const database = new DatabaseSync(destinationPath, { readOnly: true });
    let integrity: string;
    try {
      integrity = String(database.prepare('PRAGMA integrity_check').get()?.integrity_check);
    } finally {
      database.close();
    }
    return { name, sourceSha256: hashFile(sourcePath), copySha256: hashFile(destinationPath), integrity };
  });
  expect(files.every(file => file.sourceSha256 === file.copySha256 && file.integrity === 'ok')).toBe(true);
  return files;
}

async function createRecoveryScenario() {
  const directory = temporaryDirectory();
  const active = path.join(directory, 'active');
  const oldSnapshot = path.join(directory, 'before-revocation');
  const latestSnapshot = path.join(directory, 'after-revocation');
  const first = openProductionStores(active);
  first.auth.createAccount({ account_id: ownerId, profile_label: 'Synthetic F19 recovery account' });
  const device = first.auth.bindDevice({ account_id: ownerId, device_id: deviceId, device_secret: 'synthetic-f19-runtime-only-secret' });
  const challenge = first.auth.issueDeviceChallenge(device.device_id);
  const session = first.auth.exchangeDeviceChallenge(challenge.challenge_id, signDeviceChallenge(device.device_secret, challenge.challenge)).session;
  const note = await first.notes.create(context, {
    id: noteId,
    askedAt: '2026-10-17T00:00:00.000Z',
    question: 'Synthetic recovery question',
    topic: 'Synthetic recovery',
    summary: 'No real account, device, or production data',
    source: 'demo',
  }, 'synthetic-f19-create');
  expect(first.auth.authenticateAccessToken(session.access_token).account_id).toBe(ownerId);
  expect(note.deletedAt).toBeNull();
  closeProductionStores(first);
  const beforeFiles = copyClosedDatabases(active, oldSnapshot);

  const current = openProductionStores(active);
  const tombstone = await current.notes.delete(context, note.id, note.version, 'synthetic-f19-delete');
  expect(tombstone.deletedAt).not.toBeNull();
  expect(tombstone.version).toBe(2);
  expect(current.auth.revokeDevice(ownerId, deviceId)).toEqual({ revoked: true });
  expect(() => current.auth.authenticateAccessToken(session.access_token)).toThrow();
  expect(() => current.auth.refreshSession(session.refresh_token)).toThrow();
  closeProductionStores(current);
  const afterFiles = copyClosedDatabases(active, latestSnapshot);
  expect(afterFiles.every(file => beforeFiles.find(before => before.name === file.name)?.sourceSha256 !== file.sourceSha256)).toBe(true);
  return { directory, active, oldSnapshot, latestSnapshot, beforeFiles, afterFiles, session };
}

afterEach(() => {
  try {
    for (const store of openStores) store.close();
    openStores.clear();
    for (const directory of directories.splice(0)) {
      const resolved = realpathSync(directory);
      if (path.dirname(resolved) !== realpathSync(tmpdir()) || !path.basename(resolved).startsWith('nuanban-f19-recovery-')) {
        throw new Error('Unsafe recovery fixture cleanup path');
      }
      rmSync(resolved, { recursive: true, force: true });
      expect(existsSync(resolved)).toBe(false);
    }
  } catch (error) {
    cleanupPassed = false;
    throw error;
  }
});

afterAll(() => {
  const evidencePath = process.env.NUANBAN_F_RECOVERY_EVIDENCE;
  if (!evidencePath) return;
  const resolved = path.resolve(evidencePath);
  const directory = realpathSync(path.dirname(resolved));
  if (path.dirname(directory) !== realpathSync(tmpdir()) || !path.basename(directory).startsWith('nuanban-f-delivery-') || existsSync(resolved)) {
    throw new Error('Recovery evidence must be a new file in the delivery executor temporary directory');
  }
  const sources = [
    'apps/server/src/auth.ts',
    'apps/server/src/sqlite.ts',
    'packages/sync-engine/src/services.ts',
    'packages/sync-engine/src/sqlite.ts',
    'tests/acceptance/f-development-recovery.test.ts',
  ].map(filename => ({ path: filename, sha256: hashFile(path.resolve(process.cwd(), filename)) }));
  const latest = observations.find(item => item.id === 'latest_snapshot');
  const safeRestore = observations.find(item => item.id === 'safe_restore');
  const guardrails = observations.find(item => item.id === 'restore_guardrails');
  const stale = observations.find(item => item.id === 'stale_snapshot_negative_probe');
  const safeRestoreSupported = safeRestore?.executed === true
    && safeRestore.tombstonePreserved === true
    && safeRestore.accessRejected === true
    && safeRestore.refreshRejected === true
    && safeRestore.pendingSideEffectsRestored === false;
  writeFileSync(resolved, `${JSON.stringify({
    schemaVersion: 'f-development-recovery/v1',
    mode: 'development_only',
    data: 'synthetic_only',
    productionModulesExecuted: ['SqliteRepositories', 'SqliteSyncStore', 'NoteService', 'AuthService'],
    recoveryMethod: safeRestoreSupported ? 'retained_safety_checkpoint_merge_with_sqlite_transaction' : 'closed_sqlite_file_copy_probe',
    safeRestoreSupported,
    status: safeRestoreSupported ? 'development_verified_external_pending' : 'unsupported',
    externalPendingCode: 'F19_PRODUCTION_RECOVERY',
    blocker: safeRestoreSupported
      ? 'Production credentials, controlled environment, monitoring, key review, and operational sign-off remain external pending; the synthetic development restore entrypoint is verified.'
      : 'The synthetic restore entrypoint did not produce complete evidence; an old SQLite snapshot must not be released as safe recovery.',
    destructiveSchemaRollbackIsNotDataRecovery: true,
    latestSnapshotPreservesDeletion: latest?.tombstonePreserved === true,
    safeRestoreReconcilesDeletionAndRevocation: safeRestoreSupported,
    guardrailsVerified: guardrails?.executed === true,
    staleSnapshotRemainsUnsafe: stale?.deletionResurrected === true && stale?.accessResurrected === true && stale?.refreshResurrected === true,
    cleanupPassed,
    sources,
    observations,
  }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
});

describe('F19 真实模块 SQLite 恢复边界，严格 offline/synthetic/development_only', () => {
  it('最新关闭快照可按实际字节恢复，并在 NoteService/AuthService 中保留 tombstone 和撤权', async () => {
    const scenario = await createRecoveryScenario();
    const restoredDirectory = path.join(scenario.directory, 'restore-latest');
    const files = copyClosedDatabases(scenario.latestSnapshot, restoredDirectory);
    const restored = openProductionStores(restoredDirectory);
    const tombstone = await restored.notes.get(context, 'note', noteId);
    expect(tombstone).toMatchObject({ id: noteId, version: 2, deletedAt: expect.any(String) });
    await expect(restored.notes.update(context, noteId, 1, { summary: 'Synthetic stale edit' }, 'synthetic-f19-stale-update')).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect((await restored.notes.changes(context)).changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: noteId, operation: 'delete', entity: null, version: 2 }),
    ]));
    expect(restored.repositories.devices.get(deviceId)?.status).toBe('revoked');
    expect(() => restored.auth.authenticateAccessToken(scenario.session.access_token)).toThrow();
    expect(() => restored.auth.refreshSession(scenario.session.refresh_token)).toThrow();
    observations.push({ id: 'latest_snapshot', executed: true, files, tombstonePreserved: true, staleMutationRejected: true, accessRejected: true, refreshRejected: true, scope: 'only_a_snapshot_already_containing_the_deletion_and_revocation' });
  });

  it('使用保留安全检查点合并旧备份，保留删除/撤权并停止待执行副作用', async () => {
    const scenario = await createRecoveryScenario();
    const restoredDirectory = path.join(scenario.directory, 'safe-restore-target');
    copyClosedDatabases(scenario.oldSnapshot, restoredDirectory);
    const restored = openProductionStores(restoredDirectory);
    const authRestore = restored.repositories.restoreFromSnapshot(path.join(scenario.oldSnapshot, 'auth.sqlite'), {
      safetySnapshotPath: path.join(scenario.latestSnapshot, 'auth.sqlite'),
      recoveredAt,
    });
    const syncRestore = restored.sync.restoreFromSnapshot(path.join(scenario.oldSnapshot, 'notes.sqlite'), {
      safetySnapshotPath: path.join(scenario.latestSnapshot, 'notes.sqlite'),
      recoveredAt,
    });
    const tombstone = await restored.notes.get(context, 'note', noteId);
    expect(tombstone).toMatchObject({ id: noteId, version: 2, deletedAt: expect.any(String) });
    expect(restored.repositories.devices.get(deviceId)?.status).toBe('revoked');
    expect(() => restored.auth.authenticateAccessToken(scenario.session.access_token)).toThrow();
    expect(() => restored.auth.refreshSession(scenario.session.refresh_token)).toThrow();
    expect(authRestore.destructiveStatePreserved).toBe(true);
    expect(syncRestore).toMatchObject({ destructiveStatePreserved: true, pendingSideEffectsRestored: false });
    const changes = await restored.notes.changes(context);
    expect(changes.changes.every(change => change.entityId !== noteId || (change.operation === 'delete' && change.entity === null))).toBe(true);
    await expect(restored.notes.create(context, {
      id: noteId, askedAt: '2026-10-17T00:00:00.000Z', question: 'Synthetic recovery question', topic: 'Synthetic recovery', summary: 'No real account, device, or production data', source: 'demo',
    }, 'synthetic-f19-create')).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    const sequenceBefore = restored.sync.database.prepare('SELECT MAX(sequence) AS value FROM nb_sync_changes').get()?.value;
    restored.repositories.restoreFromSnapshot(path.join(scenario.oldSnapshot, 'auth.sqlite'), { safetySnapshotPath: path.join(scenario.latestSnapshot, 'auth.sqlite'), recoveredAt });
    restored.sync.restoreFromSnapshot(path.join(scenario.oldSnapshot, 'notes.sqlite'), { safetySnapshotPath: path.join(scenario.latestSnapshot, 'notes.sqlite'), recoveredAt });
    expect(restored.sync.database.prepare('SELECT MAX(sequence) AS value FROM nb_sync_changes').get()?.value).toBe(sequenceBefore);
    closeProductionStores(restored);
    const restarted = openProductionStores(restoredDirectory);
    expect(restarted.repositories.accounts.get(ownerId)?.account_id).toBe(ownerId);
    expect((await restarted.notes.get(context, 'note', noteId))?.deletedAt).not.toBeNull();
    expect(() => restarted.auth.authenticateAccessToken(scenario.session.access_token)).toThrow();
    observations.push({ id: 'safe_restore', executed: true, authRestore, syncRestore, tombstonePreserved: true, accessRejected: true, refreshRejected: true, pendingSideEffectsRestored: false, repeatedRestoreIdempotent: true, sameSchemaRestartPreservesState: true, staleReceiptRejected: true, method: 'retained_safety_checkpoint_merge' });
  });

  it('缺少安全检查点或来源身份不一致时拒绝恢复并保持事务前状态', async () => {
    const scenario = await createRecoveryScenario();
    const restoredDirectory = path.join(scenario.directory, 'guardrail-target');
    copyClosedDatabases(scenario.oldSnapshot, restoredDirectory);
    const badDirectory = path.join(scenario.directory, 'bad-backup');
    copyClosedDatabases(scenario.oldSnapshot, badDirectory);
    const badAuth = new DatabaseSync(path.join(badDirectory, 'auth.sqlite'));
    badAuth.prepare('UPDATE devices SET account_id = ? WHERE device_id = ?').run('foreign-owner', deviceId);
    badAuth.close();
    const badSync = new DatabaseSync(path.join(badDirectory, 'notes.sqlite'));
    const entityRow = badSync.prepare('SELECT entity_type, entity_id, payload FROM nb_sync_entities WHERE entity_id = ?').get(noteId) as { entity_type: string; entity_id: string; payload: string };
    const entity = JSON.parse(entityRow.payload) as Record<string, unknown>;
    entity.ownerId = 'foreign-owner';
    badSync.prepare('UPDATE nb_sync_entities SET payload = ? WHERE entity_type = ? AND entity_id = ?').run(JSON.stringify(entity), entityRow.entity_type, entityRow.entity_id);
    badSync.close();
    const restored = openProductionStores(restoredDirectory);
    expect(() => restored.repositories.restoreFromSnapshot(path.join(scenario.oldSnapshot, 'auth.sqlite'), { safetySnapshotPath: '', recoveredAt })).toThrow('retained safety snapshot');
    expect(() => restored.repositories.restoreFromSnapshot(path.join(badDirectory, 'auth.sqlite'), { safetySnapshotPath: path.join(scenario.latestSnapshot, 'auth.sqlite'), recoveredAt })).toThrow('identity mismatch');
    expect(() => restored.sync.restoreFromSnapshot(path.join(scenario.oldSnapshot, 'notes.sqlite'), { safetySnapshotPath: '', recoveredAt })).toThrow('retained safety snapshot');
    expect(() => restored.sync.restoreFromSnapshot(path.join(badDirectory, 'notes.sqlite'), { safetySnapshotPath: path.join(scenario.latestSnapshot, 'notes.sqlite'), recoveredAt })).toThrow('identity is invalid');
    expect((await restored.notes.get(context, 'note', noteId))?.deletedAt).toBeNull();
    expect(restored.repositories.devices.get(deviceId)?.status).toBe('bound');
    observations.push({ id: 'restore_guardrails', executed: true, missingSafetyRejected: true, authIdentityMismatchRejected: true, syncIdentityMismatchRejected: true, transactionStatePreserved: true });
  });

  it('拒绝坏 schema、跨环境和活动文件路径，保持目标库未变', async () => {
    const scenario = await createRecoveryScenario();
    const target = openProductionStores(path.join(scenario.directory, 'schema-target'));
    const invalid = path.join(scenario.directory, 'invalid-schema');
    copyClosedDatabases(scenario.oldSnapshot, invalid);
    const authDatabase = new DatabaseSync(path.join(invalid, 'auth.sqlite'));
    authDatabase.exec('PRAGMA user_version = 99');
    authDatabase.close();
    const syncDatabase = new DatabaseSync(path.join(invalid, 'notes.sqlite'));
    syncDatabase.prepare("UPDATE nb_sync_meta SET value = '99' WHERE key = 'schema_version'").run();
    syncDatabase.close();
    expect(() => target.repositories.restoreFromSnapshot(path.join(invalid, 'auth.sqlite'), { safetySnapshotPath: path.join(scenario.latestSnapshot, 'auth.sqlite'), recoveredAt })).toThrow('schema version mismatch');
    expect(() => target.sync.restoreFromSnapshot(path.join(invalid, 'notes.sqlite'), { safetySnapshotPath: path.join(scenario.latestSnapshot, 'notes.sqlite'), recoveredAt })).toThrow('schema version mismatch');
    const foreignPath = path.join(scenario.directory, 'foreign.sqlite');
    const foreign = createSqliteRepositories({ path: foreignPath, environment: 'foreign-environment' });
    foreign.close();
    expect(() => target.repositories.restoreFromSnapshot(foreignPath, { safetySnapshotPath: path.join(scenario.latestSnapshot, 'auth.sqlite'), recoveredAt })).toThrow('environment mismatch');
    expect(() => target.repositories.restoreFromSnapshot(path.join(scenario.directory, 'schema-target', 'auth.sqlite'), { safetySnapshotPath: path.join(scenario.latestSnapshot, 'auth.sqlite'), recoveredAt })).toThrow('different from the active');
    expect(() => target.sync.restoreFromSnapshot(path.join(scenario.directory, 'schema-target', 'notes.sqlite'), { safetySnapshotPath: path.join(scenario.latestSnapshot, 'notes.sqlite'), recoveredAt })).toThrow('different from the active');
    expect(target.repositories.accounts.get(ownerId)).toBeUndefined();
    expect(await target.notes.get(context, 'note', noteId)).toBeNull();
    observations.push({ id: 'schema_environment_guardrails', executed: true, schemaMismatchRejected: true, environmentMismatchRejected: true, activePathRejected: true });
  });

  it('恢复未撤销会话也强制重认证，并保留关系撤销和 scope 收窄', async () => {
    const directory = temporaryDirectory();
    const active = path.join(directory, 'active');
    const backup = path.join(directory, 'backup');
    const safety = path.join(directory, 'safety');
    const first = openProductionStores(active);
    first.auth.createAccount({ account_id: ownerId });
    first.auth.createAccount({ account_id: 'synthetic-f19-helper' });
    const device = first.auth.bindDevice({ account_id: ownerId, device_id: deviceId, device_secret: 'runtime-only-f19-scope-secret' });
    const challenge = first.auth.issueDeviceChallenge(deviceId);
    const session = first.auth.exchangeDeviceChallenge(challenge.challenge_id, signDeviceChallenge(device.device_secret, challenge.challenge)).session;
    const unusedChallenge = first.auth.issueDeviceChallenge(deviceId);
    const family = new FamilyService(first.repositories, { now });
    const consent = family.createConsent(ownerId, { subject_id: ownerId, purpose: 'learning_share', scopes: ['learning.read', 'todo.write'], notice_version: 'synthetic-v1' });
    const invitation = family.invite(ownerId, { helper_ref: 'synthetic-f19-helper', requested_scopes: ['learning.read', 'todo.write'] });
    const relation = family.accept('synthetic-f19-helper', invitation.invitation_id, { consent_id: consent.consent_id, scopes: ['learning.read', 'todo.write'] }).relation;
    closeProductionStores(first);
    copyClosedDatabases(active, backup);
    const current = openProductionStores(active);
    const record = current.repositories.relations.get(relation.relation_id)!;
    current.repositories.relations.save({ ...record, scopes: ['learning.read'], grant_revision: record.grant_revision + 1, version: record.version + 1 });
    const consentRecord = current.repositories.consents.get(consent.consent_id)!;
    current.repositories.consents.save({ ...consentRecord, scopes: ['learning.read'], withdrawn_at: recoveredAt });
    closeProductionStores(current);
    copyClosedDatabases(active, safety);
    const target = openProductionStores(path.join(directory, 'target'));
    const result = target.repositories.restoreFromSnapshot(path.join(backup, 'auth.sqlite'), { safetySnapshotPath: path.join(safety, 'auth.sqlite'), recoveredAt });
    expect(result.sessionsInvalidated).toBeGreaterThan(0);
    expect(result.challengesInvalidated).toBeGreaterThan(0);
    expect(() => target.auth.authenticateAccessToken(session.access_token)).toThrow();
    expect(() => target.auth.refreshSession(session.refresh_token)).toThrow();
    expect(target.repositories.challenges.get(unusedChallenge.challenge_id)?.used_at).toBe(recoveredAt);
    expect(target.repositories.consents.get(consent.consent_id)?.scopes).toEqual(['learning.read']);
    expect(target.repositories.relations.get(relation.relation_id)).toMatchObject({ scopes: ['learning.read'], status: 'revoked', revoked_at: recoveredAt });
    observations.push({ id: 'permission_recovery', executed: true, activeSessionsInvalidated: true, unusedChallengesInvalidated: true, scopesNarrowed: true, withdrawnConsentPreserved: true, relationRevoked: true });
  });

  it('恢复后不重放旧 outbox、mutation、提醒或运行中任务', async () => {
    const scenario = await createRecoveryScenario();
    const targetDirectory = path.join(scenario.directory, 'side-effect-target');
    copyClosedDatabases(scenario.oldSnapshot, targetDirectory);
    const target = openProductionStores(targetDirectory);
    const reminders = new SqliteReminderStore(target.sync.database);
    const tasks = new SqliteTaskQueue(target.sync.database);
    await reminders.save({ ownerId, todoId: 'synthetic-f19-todo', instanceId: 'synthetic-f19-occurrence', plannedAt: recoveredAt, timezone: 'Asia/Shanghai', scheduleRevision: 1, repeatRule: { frequency: 'none', interval: 1 }, state: 'submitted', submittedAt: recoveredAt, deliveredAt: null, openedAt: null, completedAt: null, cancelledAt: null });
    await tasks.enqueue({ id: 'synthetic-f19-task', ownerId, occurrenceId: 'synthetic-f19-occurrence', availableAt: recoveredAt, status: 'queued', attempts: 0, leaseToken: null, leaseExpiresAt: null, lastError: null });
    const lease = await tasks.claim('synthetic-f19-task', recoveredAt);
    expect(lease).not.toBeNull();
    target.sync.restoreFromSnapshot(path.join(scenario.oldSnapshot, 'notes.sqlite'), { safetySnapshotPath: path.join(scenario.latestSnapshot, 'notes.sqlite'), recoveredAt });
    expect(await target.notes.outbox(context)).toEqual([]);
    expect(target.sync.database.prepare('SELECT COUNT(*) AS value FROM nb_sync_mutations').get()?.value).toBe(0);
    expect(await reminders.listPending()).toEqual([]);
    expect((await reminders.list(ownerId))[0]).toMatchObject({ state: 'cancelled', cancelledAt: recoveredAt });
    expect((await tasks.snapshot())[0]).toMatchObject({ status: 'cancelled', leaseToken: null, leaseExpiresAt: null });
    observations.push({ id: 'pending_side_effects', executed: true, outboxCleared: true, receiptsCleared: true, remindersCancelled: true, taskLeasesCancelled: true });
  });

  it('旧快照负向探针暴露删除与撤权复活，不将文件拷贝冒充安全恢复通过', async () => {
    const scenario = await createRecoveryScenario();
    const restoredDirectory = path.join(scenario.directory, 'unsafe-old-snapshot-probe');
    const files = copyClosedDatabases(scenario.oldSnapshot, restoredDirectory);
    const restored = openProductionStores(restoredDirectory);
    const note = await restored.notes.get(context, 'note', noteId);
    const deletionResurrected = note?.deletedAt === null && note.version === 1;
    const accessResurrected = restored.auth.authenticateAccessToken(scenario.session.access_token).account_id === ownerId;
    const refreshResurrected = restored.auth.refreshSession(scenario.session.refresh_token).session.account_id === ownerId;
    expect(deletionResurrected).toBe(true);
    expect(restored.repositories.devices.get(deviceId)?.status).toBe('bound');
    expect(accessResurrected).toBe(true);
    expect(refreshResurrected).toBe(true);
    expect(typeof Reflect.get(restored.repositories, 'restoreFromSnapshot')).toBe('function');
    expect(typeof Reflect.get(restored.sync, 'restoreFromSnapshot')).toBe('function');
    observations.push({ id: 'stale_snapshot_negative_probe', executed: true, files, deletionResurrected, accessResurrected, refreshResurrected, safetyPassed: false, productionRestoreEntrypointPresent: true, rawFileCopyIsSafe: false });
  });

  it('执行现有生产迁移回滚并证实它是破坏性 schema 回退，不是保留数据的发布回滚', async () => {
    const scenario = await createRecoveryScenario();
    const stores = openProductionStores(scenario.active);
    const beforeSha256 = hashFile(path.join(scenario.active, 'auth.sqlite'));
    expect(stores.repositories.schemaVersion).toBe(1);
    stores.repositories.rollback();
    expect(stores.repositories.schemaVersion).toBe(0);
    closeProductionStores(stores);
    const afterRollbackSha256 = hashFile(path.join(scenario.active, 'auth.sqlite'));
    expect(afterRollbackSha256).not.toBe(beforeSha256);
    const remigrated = openProductionStores(scenario.active);
    expect(remigrated.repositories.schemaVersion).toBe(1);
    expect(remigrated.repositories.accounts.get(ownerId)).toBeUndefined();
    expect(() => remigrated.auth.authenticateAccessToken(scenario.session.access_token)).toThrow();
    observations.push({ id: 'destructive_schema_rollback', executed: true, fromVersion: 1, rolledBackVersion: 0, remigratedVersion: 1, beforeSha256, afterRollbackSha256, accountDataLost: true, dataPreservingRollbackSupported: false });
  });
});
