import { strict as assert } from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const schemaVersion = 1;
const require = createRequire(import.meta.url);
const { createDesktopReminderStore } = require('../reminder-store.cjs');
const rfc3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const internalDeepLink = /^nuanban:\/\/(?:review|todo)\/[a-z0-9-]{1,64}$/;

function errorWithCode(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

function validTimestamp(value) {
  return typeof value === 'string' && rfc3339.test(value) && Number.isFinite(Date.parse(value));
}

function validateSchedule(input) {
  if (!input || typeof input !== 'object') throw errorWithCode('INVALID_SCHEDULE', 'schedule must be an object');
  const schedule = input;
  if (!/^[a-z0-9-]{1,64}$/.test(schedule.accountId) || !/^[a-z0-9-]{1,64}$/.test(schedule.reminderId)) {
    throw errorWithCode('INVALID_SCHEDULE', 'accountId and reminderId are invalid');
  }
  if (!/^[a-z0-9-]{1,80}$/.test(schedule.instanceId) || !Number.isInteger(schedule.scheduleVersion) || schedule.scheduleVersion < 1) {
    throw errorWithCode('INVALID_SCHEDULE', 'instanceId or scheduleVersion is invalid');
  }
  if (!validTimestamp(schedule.dueAt) || !validTimestamp(schedule.updatedAt) || !internalDeepLink.test(schedule.deepLink)) {
    throw errorWithCode('INVALID_SCHEDULE', 'timestamp or internal deep link is invalid');
  }
  if (!schedule.payload || typeof schedule.payload !== 'object' || Array.isArray(schedule.payload)) {
    throw errorWithCode('INVALID_SCHEDULE', 'payload must be a plain object');
  }
  return {
    accountId: schedule.accountId,
    reminderId: schedule.reminderId,
    instanceId: schedule.instanceId,
    scheduleVersion: schedule.scheduleVersion,
    dueAt: schedule.dueAt,
    deepLink: schedule.deepLink,
    payloadJson: JSON.stringify(schedule.payload),
    updatedAt: schedule.updatedAt,
  };
}

function openStore(dbPath) {
  const database = new DatabaseSync(dbPath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 1000;
    CREATE TABLE IF NOT EXISTS reminder_store_meta (
      name TEXT PRIMARY KEY,
      version INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reminder_schedule (
      account_id TEXT NOT NULL,
      reminder_id TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      schedule_version INTEGER NOT NULL CHECK (schedule_version > 0),
      due_at TEXT NOT NULL,
      deep_link TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('scheduled', 'submitted', 'delivered', 'opened', 'completed', 'cancelled')),
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, reminder_id)
    );
    CREATE INDEX IF NOT EXISTS reminder_schedule_due_idx
      ON reminder_schedule (account_id, status, due_at);
  `);
  const metadata = database.prepare('SELECT version FROM reminder_store_meta WHERE name = ?').get('reminder_store');
  if (!metadata) {
    database.prepare('INSERT INTO reminder_store_meta (name, version) VALUES (?, ?)').run('reminder_store', schemaVersion);
  } else if (Number(metadata.version) !== schemaVersion) {
    database.close();
    throw errorWithCode('SCHEMA_VERSION', `unsupported schema version ${metadata.version}`);
  }
  return { database, schemaVersion };
}

function readReminder(store, accountId, reminderId) {
  const row = store.database.prepare(`
    SELECT account_id, reminder_id, instance_id, schedule_version, due_at, deep_link, status, payload_json, created_at, updated_at
    FROM reminder_schedule
    WHERE account_id = ? AND reminder_id = ?
  `).get(accountId, reminderId);
  if (!row) return null;
  return {
    accountId: row.account_id,
    reminderId: row.reminder_id,
    instanceId: row.instance_id,
    scheduleVersion: Number(row.schedule_version),
    dueAt: row.due_at,
    deepLink: row.deep_link,
    status: row.status,
    payloadJson: row.payload_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function scheduleReminder(store, input) {
  const candidate = validateSchedule(input);
  const existing = readReminder(store, candidate.accountId, candidate.reminderId);
  if (existing && existing.scheduleVersion > candidate.scheduleVersion) {
    throw errorWithCode('STALE_VERSION', 'older schedule version rejected');
  }
  if (existing && existing.scheduleVersion === candidate.scheduleVersion) {
    const same = existing.instanceId === candidate.instanceId && existing.dueAt === candidate.dueAt && existing.deepLink === candidate.deepLink && existing.payloadJson === candidate.payloadJson;
    if (same) return { outcome: 'idempotent', reminder: existing };
    throw errorWithCode('VERSION_CONFLICT', 'same schedule version has different content');
  }
  if (existing) {
    store.database.prepare(`
      UPDATE reminder_schedule
      SET instance_id = ?, schedule_version = ?, due_at = ?, deep_link = ?, status = 'scheduled', payload_json = ?, updated_at = ?
      WHERE account_id = ? AND reminder_id = ?
    `).run(candidate.instanceId, candidate.scheduleVersion, candidate.dueAt, candidate.deepLink, candidate.payloadJson, candidate.updatedAt, candidate.accountId, candidate.reminderId);
    return { outcome: 'replaced', reminder: readReminder(store, candidate.accountId, candidate.reminderId) };
  }
  store.database.prepare(`
    INSERT INTO reminder_schedule (account_id, reminder_id, instance_id, schedule_version, due_at, deep_link, status, payload_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
  `).run(candidate.accountId, candidate.reminderId, candidate.instanceId, candidate.scheduleVersion, candidate.dueAt, candidate.deepLink, candidate.payloadJson, candidate.updatedAt, candidate.updatedAt);
  return { outcome: 'created', reminder: readReminder(store, candidate.accountId, candidate.reminderId) };
}

function cancelReminder(store, accountId, reminderId, scheduleVersion, updatedAt) {
  const existing = readReminder(store, accountId, reminderId);
  if (!existing) throw errorWithCode('NOT_FOUND', 'reminder does not exist');
  if (existing.scheduleVersion !== scheduleVersion) throw errorWithCode('STALE_VERSION', 'cancel version does not match');
  if (existing.status === 'cancelled') return existing;
  if (existing.status !== 'scheduled') throw errorWithCode('INVALID_STATE', 'only scheduled reminders may be cancelled');
  store.database.prepare(`
    UPDATE reminder_schedule
    SET status = 'cancelled', updated_at = ?
    WHERE account_id = ? AND reminder_id = ? AND schedule_version = ?
  `).run(updatedAt, accountId, reminderId, scheduleVersion);
  return readReminder(store, accountId, reminderId);
}

function submitDueReminder(store, accountId, reminderId, now) {
  if (!validTimestamp(now)) throw errorWithCode('INVALID_TIME', 'now is invalid');
  const existing = readReminder(store, accountId, reminderId);
  if (!existing || existing.status !== 'scheduled' || Date.parse(existing.dueAt) > Date.parse(now)) return false;
  store.database.prepare(`
    UPDATE reminder_schedule
    SET status = 'submitted', updated_at = ?
    WHERE account_id = ? AND reminder_id = ? AND status = 'scheduled'
  `).run(now, accountId, reminderId);
  return true;
}

function accountCount(store, accountId) {
  const row = store.database.prepare('SELECT COUNT(*) AS count FROM reminder_schedule WHERE account_id = ?').get(accountId);
  return Number(row.count);
}

function scheduleFixture(overrides = {}) {
  return {
    accountId: 'account-a',
    reminderId: 'review-1',
    instanceId: 'instance-1',
    scheduleVersion: 1,
    dueAt: '2026-10-16T00:00:00Z',
    deepLink: 'nuanban://review/review-1',
    payload: { title: '复习第一张卡' },
    updatedAt: '2026-10-16T00:00:00Z',
    ...overrides,
  };
}

function withDatabase(root, name, callback) {
  const databasePath = join(root, `${name}.sqlite`);
  const store = openStore(databasePath);
  try {
    return callback(store, databasePath);
  } finally {
    store.database.close();
  }
}

function withProductionStore(root, name, callback) {
  const databasePath = join(root, `${name}-production.sqlite`);
  const store = createDesktopReminderStore({ databasePath });
  try {
    return callback(store, databasePath);
  } finally {
    store.close();
  }
}

export function runSqlitePreflight({ evidencePath } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'nuanban-c07-c08-sqlite-'));
  const checks = [];
  const check = (name, callback) => {
    try {
      const detail = callback();
      checks.push({ name, passed: true, detail });
    } catch (error) {
      checks.push({ name, passed: false, detail: error instanceof Error ? error.message : String(error), code: error?.code ?? 'UNKNOWN' });
    }
  };
  try {
    check('node sqlite runtime', () => {
      assert.equal(typeof DatabaseSync, 'function');
      return `DatabaseSync available in ${process.version}`;
    });
    check('schema migration is idempotent', () => {
      const path = join(root, 'migration.sqlite');
      const first = openStore(path);
      assert.equal(first.schemaVersion, schemaVersion);
      first.database.close();
      const second = openStore(path);
      const metadata = second.database.prepare('SELECT version FROM reminder_store_meta WHERE name = ?').get('reminder_store');
      assert.equal(Number(metadata.version), schemaVersion);
      second.database.close();

      const legacyPath = join(root, 'desktop-legacy.sqlite');
      const legacy = new DatabaseSync(legacyPath);
      legacy.exec(`
        CREATE TABLE reminder_store_meta (name TEXT PRIMARY KEY, version INTEGER NOT NULL);
        INSERT INTO reminder_store_meta (name, version) VALUES ('reminder_store', 1);
        CREATE TABLE reminder_schedule (
          account_id TEXT NOT NULL,
          reminder_id TEXT NOT NULL,
          instance_id TEXT NOT NULL,
          schedule_version INTEGER NOT NULL,
          due_at TEXT NOT NULL,
          deep_link TEXT NOT NULL,
          status TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (account_id, reminder_id)
        );
        INSERT INTO reminder_schedule
          (account_id, reminder_id, instance_id, schedule_version, due_at, deep_link, status, payload_json, created_at, updated_at)
        VALUES ('account-a', 'legacy-review', 'legacy-instance', 1, '2026-10-16T00:00:00Z', 'nuanban://review/legacy-review', 'submitted', '{"title":"legacy desktop reminder"}', '2026-10-15T00:00:00Z', '2026-10-16T00:01:00Z');
      `);
      legacy.close();
      const migratedStore = createDesktopReminderStore({ databasePath: legacyPath });
      const migratedReminder = migratedStore.read('account-a', 'legacy-review');
      assert.equal(migratedReminder.status, 'submitted');
      assert.equal(migratedReminder.payloadJson, '{"title":"legacy desktop reminder"}');
      migratedStore.close();
      const migratedDatabase = new DatabaseSync(legacyPath);
      const migratedColumns = new Set(migratedDatabase.prepare('PRAGMA table_info(reminder_schedule)').all().map(column => column.name));
      const migratedMetadata = migratedDatabase.prepare('SELECT version FROM reminder_store_meta WHERE name = ?').get('reminder_store');
      migratedDatabase.close();
      assert.deepEqual([...['submitted_at', 'delivered_at', 'opened_at', 'failed_at', 'missed_at', 'unknown_at', 'completed_at', 'cancelled_at']].filter(column => migratedColumns.has(column)), [
        'submitted_at', 'delivered_at', 'opened_at', 'failed_at', 'missed_at', 'unknown_at', 'completed_at', 'cancelled_at',
      ]);
      assert.equal(Number(migratedMetadata.version), 2);
      return 'independent schema reopen and production desktop v1→v2 migration preserve the legacy reminder';
    });
    check('account partition prevents cross-account reads', () => {
      withDatabase(root, 'partition', store => {
        scheduleReminder(store, scheduleFixture({ accountId: 'account-a', reminderId: 'same-id' }));
        scheduleReminder(store, scheduleFixture({ accountId: 'account-b', reminderId: 'same-id', instanceId: 'instance-b' }));
        assert.equal(accountCount(store, 'account-a'), 1);
        assert.equal(accountCount(store, 'account-b'), 1);
        assert.equal(readReminder(store, 'account-a', 'missing'), null);
        assert.equal(readReminder(store, 'account-b', 'same-id').instanceId, 'instance-b');
      });
      return 'same reminder id is stored independently per account';
    });
    check('same schedule is idempotent', () => {
      withDatabase(root, 'idempotent', store => {
        const fixture = scheduleFixture();
        assert.equal(scheduleReminder(store, fixture).outcome, 'created');
        assert.equal(scheduleReminder(store, fixture).outcome, 'idempotent');
        assert.equal(accountCount(store, fixture.accountId), 1);
      });
      return 'replaying the same version does not duplicate the row';
    });
    check('older version is rejected', () => {
      withDatabase(root, 'stale', store => {
        scheduleReminder(store, scheduleFixture({ scheduleVersion: 2, instanceId: 'instance-2' }));
        assert.throws(() => scheduleReminder(store, scheduleFixture()), error => error?.code === 'STALE_VERSION');
      });
      return 'a lower schedule version cannot overwrite a newer row';
    });
    check('same version conflict is rejected', () => {
      withDatabase(root, 'conflict', store => {
        scheduleReminder(store, scheduleFixture());
        assert.throws(() => scheduleReminder(store, scheduleFixture({ dueAt: '2026-10-17T00:00:00Z' })), error => error?.code === 'VERSION_CONFLICT');
      });
      return 'same version with different content is not silently merged';
    });
    check('cancelled reminder does not submit when due', () => {
      withDatabase(root, 'cancel', store => {
        const fixture = scheduleFixture();
        scheduleReminder(store, fixture);
        cancelReminder(store, fixture.accountId, fixture.reminderId, fixture.scheduleVersion, '2026-10-16T00:01:00Z');
        assert.equal(submitDueReminder(store, fixture.accountId, fixture.reminderId, '2026-10-16T00:02:00Z'), false);
        assert.equal(readReminder(store, fixture.accountId, fixture.reminderId).status, 'cancelled');
      });
      return 'cancelled rows remain cancelled at the due time';
    });
    check('submitted status survives close and reopen', () => {
      const path = join(root, 'reopen.sqlite');
      const first = openStore(path);
      const fixture = scheduleFixture({ dueAt: '2026-10-15T00:00:00Z' });
      scheduleReminder(first, fixture);
      assert.equal(submitDueReminder(first, fixture.accountId, fixture.reminderId, '2026-10-16T00:02:00Z'), true);
      first.database.close();
      const second = openStore(path);
      assert.equal(readReminder(second, fixture.accountId, fixture.reminderId).status, 'submitted');
      second.database.close();

      withProductionStore(root, 'production-boundaries', store => {
        const versionOne = scheduleFixture({
          accountId: 'account-a',
          reminderId: 'bound-review',
          instanceId: 'bound-instance-v1',
          dueAt: '2026-10-15T00:00:00Z',
        });
        const accountB = scheduleFixture({
          accountId: 'account-b',
          reminderId: 'bound-review',
          instanceId: 'account-b-instance',
          dueAt: '2026-10-15T00:00:00Z',
        });
        assert.equal(store.schedule(versionOne).outcome, 'created');
        assert.equal(store.schedule(accountB).outcome, 'created');
        assert.equal(store.read('account-a', 'bound-review').instanceId, 'bound-instance-v1');
        assert.equal(store.read('account-b', 'bound-review').instanceId, 'account-b-instance');
        assert.equal(store.submitDue({
          accountId: 'account-a',
          reminderId: 'bound-review',
          instanceId: 'wrong-instance',
          scheduleVersion: 1,
          now: '2026-10-16T00:01:00Z',
        }), false);
        assert.throws(() => store.recordReceipt({
          accountId: 'account-a',
          reminderId: 'bound-review',
          instanceId: 'wrong-instance',
          scheduleVersion: 1,
          state: 'submitted',
          observedAt: '2026-10-16T00:01:00Z',
        }), /no longer current/);
        assert.doesNotThrow(() => store.schedule({
          ...versionOne,
          instanceId: 'bound-instance-v2',
          scheduleVersion: 2,
        }));
        assert.throws(() => store.schedule(versionOne), /older/);
        assert.equal(store.submitDue({
          accountId: 'account-a',
          reminderId: 'bound-review',
          instanceId: 'bound-instance-v2',
          scheduleVersion: 2,
          now: '2026-10-16T00:01:00Z',
        }), true);
        store.recordReceipt({
          accountId: 'account-a',
          reminderId: 'bound-review',
          instanceId: 'bound-instance-v2',
          scheduleVersion: 2,
          state: 'delivered',
          observedAt: '2026-10-16T00:01:02Z',
        });
        assert.throws(() => store.recordReceipt({
          accountId: 'account-a',
          reminderId: 'bound-review',
          instanceId: 'bound-instance-v2',
          scheduleVersion: 2,
          state: 'opened',
          observedAt: '2026-10-16T00:01:01Z',
        }), /cannot move backwards/);
        assert.equal(store.read('account-a', 'bound-review').status, 'delivered');
      });

      for (const [state, field] of Object.entries({ failed: 'failedAt', missed: 'missedAt', unknown: 'unknownAt' })) {
        withProductionStore(root, `production-${state}`, store => {
          const fixture = scheduleFixture({ reminderId: `failure-${state}`, instanceId: `failure-${state}` });
          store.schedule(fixture);
          const failure = store.recordReceipt({
            accountId: fixture.accountId,
            reminderId: fixture.reminderId,
            state,
            observedAt: '2026-10-16T00:01:00Z',
          });
          assert.equal(failure.status, state);
          assert.equal(failure[field], '2026-10-16T00:01:00Z');
          for (const otherField of ['failedAt', 'missedAt', 'unknownAt']) {
            if (otherField !== field) assert.equal(failure[otherField], null);
          }
          assert.throws(() => store.recordReceipt({
            accountId: fixture.accountId,
            reminderId: fixture.reminderId,
            state,
            observedAt: '2026-10-16T00:00:59Z',
          }), /cannot move backwards/);
          assert.throws(() => store.recordReceipt({
            accountId: fixture.accountId,
            reminderId: fixture.reminderId,
            state: 'submitted',
            observedAt: '2026-10-16T00:01:01Z',
          }), /terminal/);
        });
      }
      return 'independent reopen plus production account, instance/version, monotonic receipt, and failure terminal checks passed';
    });
    const passed = checks.filter(checkResult => checkResult.passed).length;
    const result = {
      generatedAt: localDate(),
      scope: 'independent Node 24 SQLite preflight for C07/C08',
      runtime: process.version,
      engine: 'node:sqlite.DatabaseSync',
      schemaVersion,
      status: 'preparatory_not_accepted',
      success: passed === checks.length,
      checks,
      passed,
      failed: checks.length - passed,
      productionElectronIntegration: false,
      productionStorePreflight: true,
      deviceVerified: false,
      systemSchedulerVerified: false,
      limitations: [
        'This runs Node 24 node:sqlite fixtures and the production desktop store module without launching Electron; it is not a system-device or Electron runtime verification.',
        'No Android Room, notification permission, AlarmManager/WorkManager, Windows encryption key storage or system notification was tested.',
        'No force-stop, sleep, reboot, desktop toast, user-visible receipt or real background delivery was tested.',
        'Database files are temporary and removed after the preflight completes.'
      ]
    };
    if (evidencePath) {
      mkdirSync(dirname(resolve(evidencePath)), { recursive: true });
      writeFileSync(resolve(evidencePath), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    }
    return result;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const evidenceIndex = process.argv.indexOf('--evidence');
  const evidencePath = evidenceIndex >= 0 && process.argv[evidenceIndex + 1]
    ? process.argv[evidenceIndex + 1]
    : 'docs/implementation/evidence/sqlite-c07-c08-results.json';
  const result = runSqlitePreflight({ evidencePath });
  console.log(JSON.stringify(result, null, 2));
  if (!result.success) process.exitCode = 1;
}
