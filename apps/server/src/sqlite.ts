import { mkdirSync, realpathSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { DeviceDto, Mode, Scope } from '@nuanban/contracts';
import type {
  AccountRecord,
  AccountRepository,
  ChallengeRecord,
  ChallengeRepository,
  ConsentRecord,
  ConsentRepository,
  DeviceRecord,
  DeviceRepository,
  InvitationRecord,
  InvitationRepository,
  RelationRecord,
  RelationRepository,
  ServerRepositories,
  SessionRecord,
  SessionRepository,
} from './repositories.ts';

export const sqliteSchemaVersion = 1;

export interface SqliteRepositoryOptions {
  path: string;
  environment?: string;
  createDirectory?: boolean;
}

export interface SqliteRestoreOptions {
  safetySnapshotPath: string;
  recoveredAt: string;
}

type SqlValue = string | number | null;
type SqlRow = Record<string, unknown>;

function normalizedEnvironment(environment: string): string {
  const value = environment.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(value)) throw new Error('SQLite environment must contain only letters, numbers, dots, underscores, or hyphens');
  return value;
}

export function defaultSqlitePath(environment = 'development'): string {
  const safeEnvironment = normalizedEnvironment(environment);
  return join(homedir(), '.nuanban', 'server', `${safeEnvironment}.sqlite`);
}

function readSchemaVersion(database: DatabaseSync): number {
  const row = database.prepare('PRAGMA user_version').get() as { user_version: number };
  return Number(row.user_version);
}

function setSchemaVersion(database: DatabaseSync, version: number): void {
  if (!Number.isInteger(version) || version < 0) throw new Error('SQLite schema version must be a non-negative integer');
  database.exec(`PRAGMA user_version = ${version}`);
}

function inTransaction(database: DatabaseSync, action: () => void): void {
  database.exec('BEGIN IMMEDIATE');
  try {
    action();
    database.exec('COMMIT');
  } catch (error) {
    try {
      database.exec('ROLLBACK');
    } catch {
      
    }
    throw error;
  }
}

function createSchemaV1(database: DatabaseSync, environment: string): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS nb_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT PRIMARY KEY,
      profile_label TEXT NOT NULL,
      mode TEXT NOT NULL,
      version INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      device_secret TEXT NOT NULL,
      last_seen_at TEXT
    );
    CREATE TABLE IF NOT EXISTS challenges (
      challenge_id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      nonce TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      access_token_hash TEXT PRIMARY KEY,
      refresh_token_hash TEXT NOT NULL UNIQUE,
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      access_expires_at TEXT NOT NULL,
      refresh_expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS invitations (
      invitation_id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      helper_id TEXT NOT NULL,
      requested_scopes TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL,
      accepted_relation_id TEXT
    );
    CREATE TABLE IF NOT EXISTS consents (
      consent_id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      scopes TEXT NOT NULL,
      notice_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      withdrawn_at TEXT
    );
    CREATE TABLE IF NOT EXISTS relations (
      relation_id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      helper_id TEXT NOT NULL,
      label TEXT NOT NULL,
      scopes TEXT NOT NULL,
      consent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      grant_revision INTEGER NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_devices_account_id ON devices(account_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
    CREATE INDEX IF NOT EXISTS idx_invitations_participants ON invitations(subject_id, helper_id, status);
    CREATE INDEX IF NOT EXISTS idx_consents_subject_id ON consents(subject_id, purpose, notice_version);
    CREATE INDEX IF NOT EXISTS idx_relations_participant ON relations(subject_id, helper_id, status);
  `);
  database.prepare('INSERT INTO nb_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('environment', environment);
}

function dropSchemaV1(database: DatabaseSync): void {
  database.exec(`
    DROP INDEX IF EXISTS idx_relations_participant;
    DROP INDEX IF EXISTS idx_consents_subject_id;
    DROP INDEX IF EXISTS idx_invitations_participants;
    DROP INDEX IF EXISTS idx_sessions_refresh_token_hash;
    DROP INDEX IF EXISTS idx_devices_account_id;
    DROP TABLE IF EXISTS relations;
    DROP TABLE IF EXISTS consents;
    DROP TABLE IF EXISTS invitations;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS challenges;
    DROP TABLE IF EXISTS devices;
    DROP TABLE IF EXISTS accounts;
    DROP TABLE IF EXISTS nb_meta;
  `);
}

function assertEnvironment(database: DatabaseSync, environment: string): void {
  const row = database.prepare('SELECT value FROM nb_meta WHERE key = ?').get('environment') as { value: string } | undefined;
  if (!row || row.value !== environment) throw new Error(`SQLite environment mismatch: expected ${environment}`);
}

export function migrateSqliteDatabase(database: DatabaseSync, environment: string, targetVersion = sqliteSchemaVersion): void {
  const normalized = normalizedEnvironment(environment);
  if (!Number.isInteger(targetVersion) || targetVersion < 0 || targetVersion > sqliteSchemaVersion) throw new Error(`Unsupported SQLite schema version: ${targetVersion}`);
  let currentVersion = readSchemaVersion(database);
  if (currentVersion > sqliteSchemaVersion) throw new Error(`SQLite schema version ${currentVersion} is newer than supported version ${sqliteSchemaVersion}`);
  while (currentVersion < targetVersion) {
    const nextVersion = currentVersion + 1;
    inTransaction(database, () => {
      if (nextVersion === 1) createSchemaV1(database, normalized);
      setSchemaVersion(database, nextVersion);
    });
    currentVersion = nextVersion;
  }
  while (currentVersion > targetVersion) {
    const nextVersion = currentVersion - 1;
    inTransaction(database, () => {
      if (currentVersion === 1) dropSchemaV1(database);
      setSchemaVersion(database, nextVersion);
    });
    currentVersion = nextVersion;
  }
  if (currentVersion > 0) assertEnvironment(database, normalized);
}

export function rollbackSqliteMigrations(database: DatabaseSync, targetVersion = 0): void {
  const row = database.prepare('PRAGMA user_version').get() as { user_version: number };
  const currentVersion = Number(row.user_version);
  if (!Number.isInteger(targetVersion) || targetVersion < 0 || targetVersion > currentVersion) throw new Error(`Invalid SQLite rollback target: ${targetVersion}`);
  migrateSqliteDatabase(database, 'rollback', targetVersion);
}

function scopesFromJson(value: unknown): Scope[] {
  const parsed = JSON.parse(String(value)) as unknown;
  if (!Array.isArray(parsed)) throw new Error('SQLite scopes column is invalid');
  return parsed as Scope[];
}

function scopesToJson(scopes: Scope[]): string {
  return JSON.stringify(scopes);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

type SnapshotColumn = 'account_id' | 'profile_label' | 'mode' | 'version' | 'device_id' | 'platform' | 'status' | 'device_secret' | 'last_seen_at' | 'challenge_id' | 'nonce' | 'expires_at' | 'used_at' | 'access_token_hash' | 'refresh_token_hash' | 'access_expires_at' | 'refresh_expires_at' | 'revoked_at' | 'invitation_id' | 'subject_id' | 'helper_id' | 'requested_scopes' | 'accepted_relation_id' | 'consent_id' | 'purpose' | 'scopes' | 'notice_version' | 'created_at' | 'withdrawn_at' | 'relation_id' | 'label' | 'grant_revision' | 'updated_at' | 'deleted_at';

function shouldMergeSnapshotRow(current: Record<string, unknown>, source: Record<string, unknown>): boolean {
  const sourceVersion = Number(source.version);
  const currentVersion = Number(current.version);
  if (Number.isFinite(sourceVersion) && Number.isFinite(currentVersion) && sourceVersion > currentVersion) return true;
  for (const marker of ['deleted_at', 'revoked_at', 'withdrawn_at', 'used_at']) {
    if (source[marker] !== null && source[marker] !== undefined && (current[marker] === null || current[marker] === undefined)) return true;
  }
  return source.status === 'revoked' && current.status !== 'revoked';
}

function mergeSnapshotRows(database: DatabaseSync, snapshot: DatabaseSync, table: string, columns: SnapshotColumn[], keyColumns: SnapshotColumn[]): number {
  const select = snapshot.prepare(`SELECT ${columns.join(', ')} FROM ${table}`).all() as Array<Record<string, unknown>>;
  const placeholders = columns.map(() => '?').join(', ');
  const insert = database.prepare(`INSERT INTO ${table}(${columns.join(', ')}) VALUES (${placeholders})`);
  const update = database.prepare(`UPDATE ${table} SET ${columns.filter(column => !keyColumns.includes(column)).map(column => `${column} = ?`).join(', ')} WHERE ${keyColumns.map(column => `${column} = ?`).join(' AND ')}`);
  const find = database.prepare(`SELECT ${columns.join(', ')} FROM ${table} WHERE ${keyColumns.map(column => `${column} = ?`).join(' AND ')}`);
  for (const row of select) {
    const current = find.get(...keyColumns.map(column => row[column] as SqlValue)) as Record<string, unknown> | undefined;
    if (!current) insert.run(...columns.map(column => row[column] as SqlValue));
    else {
      for (const identity of ['account_id', 'subject_id', 'helper_id', 'device_id', 'device_secret', 'consent_id', 'purpose', 'notice_version', 'refresh_token_hash', 'nonce']) {
        if (current[identity] !== undefined && row[identity] !== undefined && current[identity] !== row[identity]) throw new Error(`SQLite recovery identity mismatch: ${table}.${identity}`);
      }
      const merged = { ...(shouldMergeSnapshotRow(current, row) ? row : current) };
      for (const marker of ['deleted_at', 'revoked_at', 'withdrawn_at', 'used_at']) {
        if (columns.includes(marker as SnapshotColumn)) merged[marker] = current[marker] ?? row[marker] ?? null;
      }
      if (current.status === 'revoked' || row.status === 'revoked') merged.status = 'revoked';
      if (table === 'invitations' && (current.status === 'accepted' || row.status === 'accepted') && merged.status !== 'revoked') merged.status = 'accepted';
      if (current.deleted_at || row.deleted_at) merged.deleted_at = current.deleted_at ?? row.deleted_at;
      for (const version of ['version', 'grant_revision'] as const) {
        if (columns.includes(version)) merged[version] = Math.max(Number(current[version]), Number(row[version]));
      }
      if (columns.includes('scopes')) {
        const currentScopes = scopesFromJson(current.scopes);
        const sourceScopes = scopesFromJson(row.scopes);
        merged.scopes = scopesToJson(currentScopes.filter(scope => sourceScopes.includes(scope)));
      }
      update.run(...columns.filter(column => !keyColumns.includes(column)).map(column => merged[column] as SqlValue), ...keyColumns.map(column => row[column] as SqlValue));
    }
  }
  return select.length;
}

function accountFromRow(row: SqlRow): AccountRecord {
  return { account_id: String(row.account_id), profile_label: String(row.profile_label), mode: row.mode as Mode, version: Number(row.version) };
}

function deviceFromRow(row: SqlRow): DeviceRecord {
  return {
    device_id: String(row.device_id),
    account_id: String(row.account_id),
    platform: row.platform as DeviceDto['platform'],
    status: row.status as DeviceDto['status'],
    device_secret: String(row.device_secret),
    last_seen_at: nullableString(row.last_seen_at),
  };
}

function challengeFromRow(row: SqlRow): ChallengeRecord {
  return { challenge_id: String(row.challenge_id), device_id: String(row.device_id), account_id: String(row.account_id), nonce: String(row.nonce), expires_at: String(row.expires_at), used_at: nullableString(row.used_at) };
}

function sessionFromRow(row: SqlRow): SessionRecord {
  return { access_token_hash: String(row.access_token_hash), refresh_token_hash: String(row.refresh_token_hash), account_id: String(row.account_id), device_id: String(row.device_id), access_expires_at: String(row.access_expires_at), refresh_expires_at: String(row.refresh_expires_at), revoked_at: nullableString(row.revoked_at) };
}

function invitationFromRow(row: SqlRow): InvitationRecord {
  return { invitation_id: String(row.invitation_id), subject_id: String(row.subject_id), helper_id: String(row.helper_id), requested_scopes: scopesFromJson(row.requested_scopes), expires_at: String(row.expires_at), status: row.status as InvitationRecord['status'], accepted_relation_id: nullableString(row.accepted_relation_id) };
}

function consentFromRow(row: SqlRow): ConsentRecord {
  return { consent_id: String(row.consent_id), subject_id: String(row.subject_id), purpose: row.purpose as ConsentRecord['purpose'], scopes: scopesFromJson(row.scopes), notice_version: String(row.notice_version), created_at: String(row.created_at), withdrawn_at: nullableString(row.withdrawn_at) };
}

function relationFromRow(row: SqlRow): RelationRecord {
  return { relation_id: String(row.relation_id), subject_id: String(row.subject_id), helper_id: String(row.helper_id), label: String(row.label), scopes: scopesFromJson(row.scopes), consent_id: String(row.consent_id), status: row.status as RelationRecord['status'], grant_revision: Number(row.grant_revision), version: Number(row.version), created_at: String(row.created_at), updated_at: String(row.updated_at), deleted_at: nullableString(row.deleted_at), revoked_at: nullableString(row.revoked_at) };
}

export class SqliteRepositories implements ServerRepositories {
  readonly storage = 'sqlite' as const;
  readonly isProductionDatabase = false as const;
  readonly database: DatabaseSync;
  readonly accounts: AccountRepository;
  readonly devices: DeviceRepository;
  readonly challenges: ChallengeRepository;
  readonly sessions: SessionRepository;
  readonly invitations: InvitationRepository;
  readonly consents: ConsentRepository;
  readonly relations: RelationRepository;
  private readonly environment: string;
  private closed = false;

  constructor(options: SqliteRepositoryOptions) {
    if (!options.path.trim()) throw new Error('SQLite path must be explicit');
    const environment = normalizedEnvironment(options.environment ?? 'development');
    this.environment = environment;
    if (options.path !== ':memory:' && options.createDirectory !== false) mkdirSync(dirname(resolve(options.path)), { recursive: true });
    this.database = new DatabaseSync(options.path);
    try {
      this.database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      migrateSqliteDatabase(this.database, environment);
    } catch (error) {
      this.database.close();
      throw error;
    }

    this.accounts = {
      get: accountId => this.readOne('SELECT account_id, profile_label, mode, version FROM accounts WHERE account_id = ?', [accountId], accountFromRow),
      save: account => this.write('INSERT INTO accounts(account_id, profile_label, mode, version) VALUES (?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET profile_label = excluded.profile_label, mode = excluded.mode, version = excluded.version', [account.account_id, account.profile_label, account.mode, account.version]),
    };
    this.devices = {
      get: deviceId => this.readOne('SELECT device_id, account_id, platform, status, device_secret, last_seen_at FROM devices WHERE device_id = ?', [deviceId], deviceFromRow),
      listByAccount: accountId => this.readMany('SELECT device_id, account_id, platform, status, device_secret, last_seen_at FROM devices WHERE account_id = ? ORDER BY device_id', [accountId], deviceFromRow),
      save: device => this.write('INSERT INTO devices(device_id, account_id, platform, status, device_secret, last_seen_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(device_id) DO UPDATE SET account_id = excluded.account_id, platform = excluded.platform, status = excluded.status, device_secret = excluded.device_secret, last_seen_at = excluded.last_seen_at', [device.device_id, device.account_id, device.platform, device.status, device.device_secret, device.last_seen_at]),
    };
    this.challenges = {
      get: challengeId => this.readOne('SELECT challenge_id, device_id, account_id, nonce, expires_at, used_at FROM challenges WHERE challenge_id = ?', [challengeId], challengeFromRow),
      save: challenge => this.write('INSERT INTO challenges(challenge_id, device_id, account_id, nonce, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(challenge_id) DO UPDATE SET device_id = excluded.device_id, account_id = excluded.account_id, nonce = excluded.nonce, expires_at = excluded.expires_at, used_at = excluded.used_at', [challenge.challenge_id, challenge.device_id, challenge.account_id, challenge.nonce, challenge.expires_at, challenge.used_at]),
    };
    this.sessions = {
      getByAccessHash: accessTokenHash => this.readOne('SELECT access_token_hash, refresh_token_hash, account_id, device_id, access_expires_at, refresh_expires_at, revoked_at FROM sessions WHERE access_token_hash = ?', [accessTokenHash], sessionFromRow),
      getByRefreshHash: refreshTokenHash => this.readOne('SELECT access_token_hash, refresh_token_hash, account_id, device_id, access_expires_at, refresh_expires_at, revoked_at FROM sessions WHERE refresh_token_hash = ?', [refreshTokenHash], sessionFromRow),
      listByDevice: deviceId => this.readMany('SELECT access_token_hash, refresh_token_hash, account_id, device_id, access_expires_at, refresh_expires_at, revoked_at FROM sessions WHERE device_id = ? ORDER BY access_expires_at', [deviceId], sessionFromRow),
      save: session => this.write('INSERT INTO sessions(access_token_hash, refresh_token_hash, account_id, device_id, access_expires_at, refresh_expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(access_token_hash) DO UPDATE SET refresh_token_hash = excluded.refresh_token_hash, account_id = excluded.account_id, device_id = excluded.device_id, access_expires_at = excluded.access_expires_at, refresh_expires_at = excluded.refresh_expires_at, revoked_at = excluded.revoked_at', [session.access_token_hash, session.refresh_token_hash, session.account_id, session.device_id, session.access_expires_at, session.refresh_expires_at, session.revoked_at]),
    };
    this.invitations = {
      get: invitationId => this.readOne('SELECT invitation_id, subject_id, helper_id, requested_scopes, expires_at, status, accepted_relation_id FROM invitations WHERE invitation_id = ?', [invitationId], invitationFromRow),
      findPending: (subjectId, helperId, scopes) => this.readMany('SELECT invitation_id, subject_id, helper_id, requested_scopes, expires_at, status, accepted_relation_id FROM invitations WHERE subject_id = ? AND helper_id = ? AND status = ? ORDER BY expires_at DESC', [subjectId, helperId, 'pending'], invitationFromRow).find(invitation => sameScopes(invitation.requested_scopes, scopes)),
      save: invitation => this.write('INSERT INTO invitations(invitation_id, subject_id, helper_id, requested_scopes, expires_at, status, accepted_relation_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(invitation_id) DO UPDATE SET subject_id = excluded.subject_id, helper_id = excluded.helper_id, requested_scopes = excluded.requested_scopes, expires_at = excluded.expires_at, status = excluded.status, accepted_relation_id = excluded.accepted_relation_id', [invitation.invitation_id, invitation.subject_id, invitation.helper_id, scopesToJson(invitation.requested_scopes), invitation.expires_at, invitation.status, invitation.accepted_relation_id]),
    };
    this.consents = {
      get: consentId => this.readOne('SELECT consent_id, subject_id, purpose, scopes, notice_version, created_at, withdrawn_at FROM consents WHERE consent_id = ?', [consentId], consentFromRow),
      findActive: (subjectId, purpose, noticeVersion, scopes) => this.readMany('SELECT consent_id, subject_id, purpose, scopes, notice_version, created_at, withdrawn_at FROM consents WHERE subject_id = ? AND purpose = ? AND notice_version = ? AND withdrawn_at IS NULL ORDER BY created_at DESC', [subjectId, purpose, noticeVersion], consentFromRow).find(consent => sameScopes(consent.scopes, scopes)),
      save: consent => this.write('INSERT INTO consents(consent_id, subject_id, purpose, scopes, notice_version, created_at, withdrawn_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(consent_id) DO UPDATE SET subject_id = excluded.subject_id, purpose = excluded.purpose, scopes = excluded.scopes, notice_version = excluded.notice_version, created_at = excluded.created_at, withdrawn_at = excluded.withdrawn_at', [consent.consent_id, consent.subject_id, consent.purpose, scopesToJson(consent.scopes), consent.notice_version, consent.created_at, consent.withdrawn_at]),
    };
    this.relations = {
      get: relationId => this.readOne('SELECT relation_id, subject_id, helper_id, label, scopes, consent_id, status, grant_revision, version, created_at, updated_at, deleted_at, revoked_at FROM relations WHERE relation_id = ?', [relationId], relationFromRow),
      find: (subjectId, helperId) => this.readOne('SELECT relation_id, subject_id, helper_id, label, scopes, consent_id, status, grant_revision, version, created_at, updated_at, deleted_at, revoked_at FROM relations WHERE subject_id = ? AND helper_id = ? ORDER BY CASE WHEN status = \'active\' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1', [subjectId, helperId], relationFromRow),
      listByParticipant: accountId => this.readMany('SELECT relation_id, subject_id, helper_id, label, scopes, consent_id, status, grant_revision, version, created_at, updated_at, deleted_at, revoked_at FROM relations WHERE subject_id = ? OR helper_id = ? ORDER BY created_at', [accountId, accountId], relationFromRow),
      save: relation => this.write('INSERT INTO relations(relation_id, subject_id, helper_id, label, scopes, consent_id, status, grant_revision, version, created_at, updated_at, deleted_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(relation_id) DO UPDATE SET subject_id = excluded.subject_id, helper_id = excluded.helper_id, label = excluded.label, scopes = excluded.scopes, consent_id = excluded.consent_id, status = excluded.status, grant_revision = excluded.grant_revision, version = excluded.version, created_at = excluded.created_at, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, revoked_at = excluded.revoked_at', [relation.relation_id, relation.subject_id, relation.helper_id, relation.label, scopesToJson(relation.scopes), relation.consent_id, relation.status, relation.grant_revision, relation.version, relation.created_at, relation.updated_at, relation.deleted_at, relation.revoked_at]),
    };
  }

  get schemaVersion(): number {
    return readSchemaVersion(this.database);
  }

  restoreFromSnapshot(snapshotPath: string, options: SqliteRestoreOptions): { sourceSchemaVersion: number; rowsRead: number; sessionsInvalidated: number; challengesInvalidated: number; destructiveStatePreserved: true } {
    if (this.closed) throw new Error('SQLite repositories are closed');
    if (!options?.safetySnapshotPath || !Number.isFinite(Date.parse(options.recoveredAt))) throw new Error('SQLite recovery requires a retained safety snapshot and valid recovery time');
    const sourcePath = realpathSync(snapshotPath);
    const safetyPath = realpathSync(options.safetySnapshotPath);
    const activePath = this.databasePath();
    if (activePath !== ':memory:' && [sourcePath, safetyPath].includes(realpathSync(activePath))) throw new Error('SQLite snapshots must be different from the active database');
    const snapshot = new DatabaseSync(sourcePath, { readOnly: true });
    let safety: DatabaseSync | undefined;
    try {
      safety = new DatabaseSync(safetyPath, { readOnly: true });
      const sourceSchemaVersion = readSchemaVersion(snapshot);
      for (const source of [snapshot, safety]) {
        if (readSchemaVersion(source) !== this.schemaVersion) throw new Error('SQLite snapshot schema version mismatch');
        assertEnvironment(source, this.environment);
        if (source.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') throw new Error('SQLite snapshot integrity check failed');
      }
      let rowsRead = 0;
      let sessionsInvalidated = 0;
      let challengesInvalidated = 0;
      inTransaction(this.database, () => {
        for (const sourceDatabase of [safety!, snapshot]) {
          rowsRead += mergeSnapshotRows(this.database, sourceDatabase, 'accounts', ['account_id', 'profile_label', 'mode', 'version'], ['account_id']);
          rowsRead += mergeSnapshotRows(this.database, sourceDatabase, 'devices', ['device_id', 'account_id', 'platform', 'status', 'device_secret', 'last_seen_at'], ['device_id']);
          rowsRead += mergeSnapshotRows(this.database, sourceDatabase, 'challenges', ['challenge_id', 'device_id', 'account_id', 'nonce', 'expires_at', 'used_at'], ['challenge_id']);
          rowsRead += mergeSnapshotRows(this.database, sourceDatabase, 'sessions', ['access_token_hash', 'refresh_token_hash', 'account_id', 'device_id', 'access_expires_at', 'refresh_expires_at', 'revoked_at'], ['access_token_hash']);
          rowsRead += mergeSnapshotRows(this.database, sourceDatabase, 'invitations', ['invitation_id', 'subject_id', 'helper_id', 'requested_scopes', 'expires_at', 'status', 'accepted_relation_id'], ['invitation_id']);
          rowsRead += mergeSnapshotRows(this.database, sourceDatabase, 'consents', ['consent_id', 'subject_id', 'purpose', 'scopes', 'notice_version', 'created_at', 'withdrawn_at'], ['consent_id']);
          rowsRead += mergeSnapshotRows(this.database, sourceDatabase, 'relations', ['relation_id', 'subject_id', 'helper_id', 'label', 'scopes', 'consent_id', 'status', 'grant_revision', 'version', 'created_at', 'updated_at', 'deleted_at', 'revoked_at'], ['relation_id']);
        }
        sessionsInvalidated = Number(this.database.prepare('UPDATE sessions SET revoked_at = ? WHERE revoked_at IS NULL').run(options.recoveredAt).changes);
        challengesInvalidated = Number(this.database.prepare('UPDATE challenges SET used_at = ? WHERE used_at IS NULL').run(options.recoveredAt).changes);
        this.database.prepare("UPDATE invitations SET status = 'revoked' WHERE status = 'pending'").run();
        const safetyDevices = new Set((safety!.prepare('SELECT device_id FROM devices').all() as Array<{ device_id: string }>).map(item => item.device_id));
        for (const device of this.database.prepare('SELECT device_id FROM devices').all() as Array<{ device_id: string }>) {
          if (!safetyDevices.has(device.device_id)) this.database.prepare("UPDATE devices SET status = 'revoked' WHERE device_id = ?").run(device.device_id);
        }
        const safetyConsents = new Set((safety!.prepare('SELECT consent_id FROM consents').all() as Array<{ consent_id: string }>).map(item => item.consent_id));
        for (const consent of this.database.prepare('SELECT consent_id FROM consents WHERE withdrawn_at IS NULL').all() as Array<{ consent_id: string }>) {
          if (!safetyConsents.has(consent.consent_id)) this.database.prepare('UPDATE consents SET withdrawn_at = ? WHERE consent_id = ?').run(options.recoveredAt, consent.consent_id);
        }
        const safetyRelations = new Set((safety!.prepare('SELECT relation_id FROM relations').all() as Array<{ relation_id: string }>).map(item => item.relation_id));
        for (const relation of this.database.prepare('SELECT relation_id, consent_id FROM relations').all() as Array<{ relation_id: string; consent_id: string }>) {
          const consent = this.database.prepare('SELECT withdrawn_at FROM consents WHERE consent_id = ?').get(relation.consent_id) as { withdrawn_at: string | null } | undefined;
          const deleted = this.database.prepare('SELECT deleted_at, revoked_at FROM relations WHERE relation_id = ?').get(relation.relation_id) as { deleted_at: string | null; revoked_at: string | null };
          if (!safetyRelations.has(relation.relation_id) || !consent || consent.withdrawn_at !== null || deleted.deleted_at !== null || deleted.revoked_at !== null) this.database.prepare("UPDATE relations SET status = 'revoked', revoked_at = COALESCE(revoked_at, ?) WHERE relation_id = ?").run(options.recoveredAt, relation.relation_id);
        }
      });
      return { sourceSchemaVersion, rowsRead, sessionsInvalidated, challengesInvalidated, destructiveStatePreserved: true };
    } finally {
      safety?.close();
      snapshot.close();
    }
  }

  private databasePath(): string {
    const row = this.database.prepare("PRAGMA database_list").all().find(item => String(item.name) === 'main') as { file?: string } | undefined;
    return row?.file ?? ':memory:';
  }

  rollback(targetVersion = 0): void {
    migrateSqliteDatabase(this.database, 'rollback', targetVersion);
  }

  close(): void {
    if (this.closed) return;
    this.database.close();
    this.closed = true;
  }

  private readOne<T>(sql: string, parameters: SqlValue[], map: (row: SqlRow) => T): T | undefined {
    const row = this.database.prepare(sql).get(...parameters) as SqlRow | undefined;
    return row ? map(row) : undefined;
  }

  private readMany<T>(sql: string, parameters: SqlValue[], map: (row: SqlRow) => T): T[] {
    return (this.database.prepare(sql).all(...parameters) as SqlRow[]).map(map);
  }

  private write(sql: string, parameters: SqlValue[]): void {
    this.database.prepare(sql).run(...parameters);
  }
}

function sameScopes(left: Scope[], right: Scope[]): boolean {
  return left.length === right.length && left.every(scope => right.includes(scope));
}

export function createSqliteRepositories(options: SqliteRepositoryOptions): SqliteRepositories {
  return new SqliteRepositories(options);
}
