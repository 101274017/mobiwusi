const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const { dirname } = require('node:path');

const schemaVersion = 2;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const accountPattern = /^[a-z0-9-]{1,64}$/;
const reminderPattern = /^[a-z0-9-]{1,64}$/;
const instancePattern = /^[a-z0-9-]{1,80}$/;
const internalDeepLink = /^nuanban:\/\/(?:review|todo)\/[a-z0-9-]{1,64}$/;
const statuses = new Set(['scheduled', 'submitted', 'delivered', 'opened', 'completed', 'cancelled', 'failed', 'missed', 'unknown']);
const receiptStatuses = new Set(['submitted', 'delivered', 'opened', 'failed', 'missed', 'unknown']);
const receiptColumns = Object.freeze({
  submitted: 'submitted_at',
  delivered: 'delivered_at',
  opened: 'opened_at',
  failed: 'failed_at',
  missed: 'missed_at',
  unknown: 'unknown_at',
});
const receiptProperties = Object.freeze({
  submitted_at: 'submittedAt',
  delivered_at: 'deliveredAt',
  opened_at: 'openedAt',
  failed_at: 'failedAt',
  missed_at: 'missedAt',
  unknown_at: 'unknownAt',
});
const timestampColumns = Object.freeze([...Object.values(receiptColumns), 'completed_at', 'cancelled_at']);

function errorWithCode(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validTimestamp(value) {
  return typeof value === 'string' && timestampPattern.test(value) && Number.isFinite(Date.parse(value));
}

function matches(pattern, value) {
  return typeof value === 'string' && pattern.test(value);
}

function validateOptionalBinding(instanceId, scheduleVersion, allowVersionOnly = false) {
  if (instanceId === undefined && scheduleVersion === undefined) return;
  if ((!allowVersionOnly && instanceId === undefined) || !matches(instancePattern, instanceId) && instanceId !== undefined || !Number.isSafeInteger(scheduleVersion) || scheduleVersion < 1) {
    throw errorWithCode('INVALID_BINDING', 'instanceId and scheduleVersion must identify a valid reminder schedule');
  }
}

function assertReminderBinding(existing, instanceId, scheduleVersion) {
  if (instanceId === undefined && scheduleVersion === undefined) return;
  if (!existing || (instanceId !== undefined && existing.instanceId !== instanceId) || (scheduleVersion !== undefined && existing.scheduleVersion !== scheduleVersion)) {
    throw errorWithCode('STALE_VERSION', 'reminder instance or schedule version is no longer current');
  }
}

function validateSchedule(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw errorWithCode('INVALID_SCHEDULE', 'schedule must be an object');
  const schedule = input;
  if (!matches(accountPattern, schedule.accountId) || !matches(reminderPattern, schedule.reminderId)) throw errorWithCode('INVALID_SCHEDULE', 'accountId and reminderId are invalid');
  if (!matches(instancePattern, schedule.instanceId) || !Number.isSafeInteger(schedule.scheduleVersion) || schedule.scheduleVersion < 1) throw errorWithCode('INVALID_SCHEDULE', 'instanceId or scheduleVersion is invalid');
  if (!validTimestamp(schedule.dueAt) || !validTimestamp(schedule.updatedAt) || !matches(internalDeepLink, schedule.deepLink)) throw errorWithCode('INVALID_SCHEDULE', 'timestamp or internal deep link is invalid');
  if (!schedule.payload || typeof schedule.payload !== 'object' || Array.isArray(schedule.payload)) throw errorWithCode('INVALID_SCHEDULE', 'payload must be a plain object');
  let payloadJson;
  try { payloadJson = JSON.stringify(schedule.payload); } catch { throw errorWithCode('INVALID_SCHEDULE', 'payload is not serializable'); }
  if (typeof payloadJson !== 'string') throw errorWithCode('INVALID_SCHEDULE', 'payload is not serializable');
  return {
    accountId: schedule.accountId,
    reminderId: schedule.reminderId,
    instanceId: schedule.instanceId,
    scheduleVersion: schedule.scheduleVersion,
    dueAt: schedule.dueAt,
    deepLink: schedule.deepLink,
    payloadJson,
    updatedAt: schedule.updatedAt,
  };
}

function rowToReminder(row) {
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
    submittedAt: row.submitted_at ?? null,
    deliveredAt: row.delivered_at ?? null,
    openedAt: row.opened_at ?? null,
    failedAt: row.failed_at ?? null,
    missedAt: row.missed_at ?? null,
    unknownAt: row.unknown_at ?? null,
    completedAt: row.completed_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createPlaintextPayloadCodec() {
  return Object.freeze({
    encrypted: false,
    encode(value) { return value; },
    decode(value) { return value; },
  });
}

function createSafeStoragePayloadCodec(safeStorage) {
  if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function' || typeof safeStorage.encryptString !== 'function' || typeof safeStorage.decryptString !== 'function') {
    throw new TypeError('safeStorage is incomplete');
  }
  const encrypted = safeStorage.isEncryptionAvailable() === true;
  return Object.freeze({
    encrypted,
    encode(value) {
      if (!encrypted) return value;
      return `safe-v1:${safeStorage.encryptString(value).toString('base64')}`;
    },
    decode(value) {
      if (!value.startsWith('safe-v1:')) return value;
      if (!encrypted) throw errorWithCode('ENCRYPTION_UNAVAILABLE', 'encrypted reminder payload cannot be opened');
      return safeStorage.decryptString(Buffer.from(value.slice('safe-v1:'.length), 'base64'));
    },
  });
}

function transaction(database, callback) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    try { database.exec('ROLLBACK'); } catch { }
    throw error;
  }
}

function tableColumns(database, tableName) {
  return new Set(database.prepare(`PRAGMA table_info(${tableName})`).all().map(row => row.name));
}

function migrateDatabase(database) {
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
      status TEXT NOT NULL CHECK (status IN ('scheduled', 'submitted', 'delivered', 'opened', 'completed', 'cancelled', 'failed', 'missed', 'unknown')),
      payload_json TEXT NOT NULL,
      submitted_at TEXT,
      delivered_at TEXT,
      opened_at TEXT,
      failed_at TEXT,
      missed_at TEXT,
      unknown_at TEXT,
      completed_at TEXT,
      cancelled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, reminder_id)
    );
    CREATE INDEX IF NOT EXISTS reminder_schedule_due_idx
      ON reminder_schedule (account_id, status, due_at);
  `);

  const metadata = database.prepare('SELECT version FROM reminder_store_meta WHERE name = ?').get('reminder_store');
  const columns = tableColumns(database, 'reminder_schedule');
  const hasReminderTable = columns.has('account_id');
  const hasV2TimestampColumns = timestampColumns.every(column => columns.has(column));
  const currentVersion = metadata ? Number(metadata.version) : (hasReminderTable ? (hasV2TimestampColumns ? schemaVersion : 1) : null);
  if (currentVersion !== null && (!Number.isSafeInteger(currentVersion) || currentVersion < 1)) {
    database.close();
    throw errorWithCode('SCHEMA_VERSION', 'invalid reminder store schema version');
  }
  if (currentVersion !== null && currentVersion > schemaVersion) {
    database.close();
    throw errorWithCode('SCHEMA_VERSION', `unsupported schema version ${currentVersion}`);
  }

  if (currentVersion === 1) {
    transaction(database, () => {
      const legacyColumns = tableColumns(database, 'reminder_schedule');
      for (const column of timestampColumns) {
        if (!legacyColumns.has(column)) database.exec(`ALTER TABLE reminder_schedule ADD COLUMN ${column} TEXT`);
      }
      database.prepare('INSERT INTO reminder_store_meta (name, version) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET version = excluded.version').run('reminder_store', schemaVersion);
    });
    return;
  }

  if (currentVersion === null) {
    database.prepare('INSERT INTO reminder_store_meta (name, version) VALUES (?, ?)').run('reminder_store', schemaVersion);
    return;
  }

  if (!metadata && currentVersion === schemaVersion) {
    database.prepare('INSERT INTO reminder_store_meta (name, version) VALUES (?, ?)').run('reminder_store', schemaVersion);
    return;
  }

  if (currentVersion !== schemaVersion) {
    database.close();
    throw errorWithCode('SCHEMA_VERSION', `unsupported schema version ${currentVersion}`);
  }
}

function createDatabase(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  migrateDatabase(database);
  return database;
}

function createDesktopReminderStore({ databasePath, payloadCodec = createPlaintextPayloadCodec() }) {
  if (typeof databasePath !== 'string' || databasePath.length === 0) throw new TypeError('databasePath is required');
  if (!payloadCodec || typeof payloadCodec.encode !== 'function' || typeof payloadCodec.decode !== 'function' || typeof payloadCodec.encrypted !== 'boolean') throw new TypeError('payloadCodec is incomplete');
  const database = createDatabase(databasePath);
  let closed = false;
  const ensureOpen = () => { if (closed) throw errorWithCode('CLOSED', 'reminder store is closed'); };
  const read = (accountId, reminderId) => {
    ensureOpen();
    if (!matches(accountPattern, accountId) || !matches(reminderPattern, reminderId)) throw errorWithCode('INVALID_ID', 'accountId and reminderId are invalid');
    const row = database.prepare(`
      SELECT account_id, reminder_id, instance_id, schedule_version, due_at, deep_link, status, payload_json,
             submitted_at, delivered_at, opened_at, failed_at, missed_at, unknown_at, completed_at, cancelled_at,
             created_at, updated_at
      FROM reminder_schedule
      WHERE account_id = ? AND reminder_id = ?
    `).get(accountId, reminderId);
    const reminder = rowToReminder(row);
    if (!reminder) return null;
    return { ...reminder, payloadJson: payloadCodec.decode(reminder.payloadJson) };
  };
  const list = accountId => {
    ensureOpen();
    if (!matches(accountPattern, accountId)) throw errorWithCode('INVALID_ID', 'accountId is invalid');
    return database.prepare(`
      SELECT account_id, reminder_id, instance_id, schedule_version, due_at, deep_link, status, payload_json,
             submitted_at, delivered_at, opened_at, failed_at, missed_at, unknown_at, completed_at, cancelled_at,
             created_at, updated_at
      FROM reminder_schedule
      WHERE account_id = ?
      ORDER BY due_at ASC, reminder_id ASC
    `).all(accountId).map(row => {
      const reminder = rowToReminder(row);
      return { ...reminder, payloadJson: payloadCodec.decode(reminder.payloadJson) };
    });
  };
  const schedule = input => {
    ensureOpen();
    const candidate = validateSchedule(input);
    return transaction(database, () => {
      const existing = read(candidate.accountId, candidate.reminderId);
      const storedPayloadJson = payloadCodec.encode(candidate.payloadJson);
      if (existing && existing.scheduleVersion > candidate.scheduleVersion) throw errorWithCode('STALE_VERSION', 'older schedule version rejected');
      if (existing && existing.scheduleVersion === candidate.scheduleVersion) {
        const same = existing.instanceId === candidate.instanceId && existing.dueAt === candidate.dueAt && existing.deepLink === candidate.deepLink && existing.payloadJson === candidate.payloadJson;
        if (same) return { outcome: 'idempotent', reminder: existing };
        throw errorWithCode('VERSION_CONFLICT', 'same schedule version has different content');
      }
      if (existing) {
        database.prepare(`
          UPDATE reminder_schedule
          SET instance_id = ?, schedule_version = ?, due_at = ?, deep_link = ?, status = 'scheduled', payload_json = ?,
              submitted_at = NULL, delivered_at = NULL, opened_at = NULL, failed_at = NULL,
              missed_at = NULL, unknown_at = NULL, completed_at = NULL, cancelled_at = NULL,
              updated_at = ?
          WHERE account_id = ? AND reminder_id = ?
        `).run(candidate.instanceId, candidate.scheduleVersion, candidate.dueAt, candidate.deepLink, storedPayloadJson, candidate.updatedAt, candidate.accountId, candidate.reminderId);
        return { outcome: 'replaced', reminder: read(candidate.accountId, candidate.reminderId) };
      }
      database.prepare(`
        INSERT INTO reminder_schedule (account_id, reminder_id, instance_id, schedule_version, due_at, deep_link, status, payload_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
      `).run(candidate.accountId, candidate.reminderId, candidate.instanceId, candidate.scheduleVersion, candidate.dueAt, candidate.deepLink, storedPayloadJson, candidate.updatedAt, candidate.updatedAt);
      return { outcome: 'created', reminder: read(candidate.accountId, candidate.reminderId) };
    });
  };
  const cancel = ({ accountId, reminderId, scheduleVersion, updatedAt, cancelledAt, instanceId }) => {
    ensureOpen();
    const observedAt = cancelledAt ?? updatedAt;
    validateOptionalBinding(instanceId, scheduleVersion, true);
    if (!validTimestamp(observedAt) || !Number.isSafeInteger(scheduleVersion) || scheduleVersion < 1) throw errorWithCode('INVALID_CANCEL', 'cancel version or timestamp is invalid');
    return transaction(database, () => {
      const existing = read(accountId, reminderId);
      if (!existing) throw errorWithCode('NOT_FOUND', 'reminder does not exist');
      if (existing.scheduleVersion !== scheduleVersion) throw errorWithCode('STALE_VERSION', 'cancel version does not match');
      assertReminderBinding(existing, instanceId, scheduleVersion);
      if (existing.status === 'cancelled') return existing;
      if (existing.status !== 'scheduled') throw errorWithCode('INVALID_STATE', 'only scheduled reminders may be cancelled');
      const instanceClause = instanceId === undefined ? '' : ' AND instance_id = ?';
      const parameters = [observedAt, observedAt, accountId, reminderId, scheduleVersion];
      if (instanceId !== undefined) parameters.push(instanceId);
      database.prepare(`
        UPDATE reminder_schedule
        SET status = 'cancelled', cancelled_at = ?, updated_at = ?
        WHERE account_id = ? AND reminder_id = ? AND schedule_version = ?${instanceClause}
      `).run(...parameters);
      return read(accountId, reminderId);
    });
  };
  const submitDue = ({ accountId, reminderId, now, instanceId, scheduleVersion }) => {
    ensureOpen();
    if (!validTimestamp(now)) throw errorWithCode('INVALID_TIME', 'now is invalid');
    validateOptionalBinding(instanceId, scheduleVersion);
    return transaction(database, () => {
      const existing = read(accountId, reminderId);
      if (!existing || existing.status !== 'scheduled' || Date.parse(existing.dueAt) > Date.parse(now)) return false;
      if (instanceId !== undefined && (existing.instanceId !== instanceId || existing.scheduleVersion !== scheduleVersion)) return false;
      const bindingClause = instanceId === undefined ? '' : ' AND instance_id = ? AND schedule_version = ?';
      const parameters = [now, now, accountId, reminderId];
      if (instanceId !== undefined) parameters.push(instanceId, scheduleVersion);
      const result = database.prepare(`
        UPDATE reminder_schedule
        SET status = 'submitted', submitted_at = COALESCE(submitted_at, ?), updated_at = ?
        WHERE account_id = ? AND reminder_id = ? AND status = 'scheduled'${bindingClause}
      `).run(...parameters);
      return Number(result.changes) === 1;
    });
  };
  const recordReceipt = ({ accountId, reminderId, state, observedAt, instanceId, scheduleVersion }) => {
    ensureOpen();
    if (!receiptStatuses.has(state) || !validTimestamp(observedAt)) throw errorWithCode('INVALID_RECEIPT', 'receipt state or timestamp is invalid');
    validateOptionalBinding(instanceId, scheduleVersion);
    return transaction(database, () => {
      const existing = read(accountId, reminderId);
      if (!existing) throw errorWithCode('NOT_FOUND', 'reminder does not exist');
      assertReminderBinding(existing, instanceId, scheduleVersion);
      if (existing.status === 'cancelled' || existing.status === 'completed') throw errorWithCode('INVALID_STATE', 'terminal reminder cannot receive a new receipt');
      const latestReceiptAt = Object.values(receiptColumns)
        .map(column => existing[receiptProperties[column]])
        .filter(Boolean)
        .map(Date.parse)
        .filter(Number.isFinite)
        .reduce((latest, value) => Math.max(latest, value), Number.NEGATIVE_INFINITY);
      if (latestReceiptAt !== Number.NEGATIVE_INFINITY && Date.parse(observedAt) < latestReceiptAt) throw errorWithCode('INVALID_RECEIPT_ORDER', 'receipt timestamp cannot move backwards');
      if (existing.status === state) return existing;
      if (['failed', 'missed', 'unknown', 'opened'].includes(existing.status)) throw errorWithCode('INVALID_STATE', 'terminal receipt cannot be overwritten');
      if (state === 'submitted' && existing.status !== 'scheduled') throw errorWithCode('INVALID_STATE', 'submitted requires a scheduled reminder');
      if (state === 'delivered' && existing.status !== 'submitted') throw errorWithCode('INVALID_STATE', 'delivered requires a submitted reminder');
      if (state === 'opened' && existing.status !== 'delivered') throw errorWithCode('INVALID_STATE', 'opened requires a delivered reminder');
      const column = receiptColumns[state];
      database.prepare(`
        UPDATE reminder_schedule
        SET status = ?, ${column} = ?, updated_at = ?
        WHERE account_id = ? AND reminder_id = ?
      `).run(state, observedAt, observedAt, accountId, reminderId);
      return read(accountId, reminderId);
    });
  };
  const complete = ({ accountId, reminderId, completedAt, instanceId, scheduleVersion }) => {
    ensureOpen();
    if (!validTimestamp(completedAt)) throw errorWithCode('INVALID_COMPLETION', 'completion timestamp is invalid');
    validateOptionalBinding(instanceId, scheduleVersion);
    return transaction(database, () => {
      const existing = read(accountId, reminderId);
      if (!existing) throw errorWithCode('NOT_FOUND', 'reminder does not exist');
      assertReminderBinding(existing, instanceId, scheduleVersion);
      if (!['submitted', 'delivered', 'opened'].includes(existing.status)) throw errorWithCode('INVALID_STATE', 'only active reminders may be completed');
      database.prepare(`
        UPDATE reminder_schedule
        SET status = 'completed', completed_at = ?, updated_at = ?
        WHERE account_id = ? AND reminder_id = ?
      `).run(completedAt, completedAt, accountId, reminderId);
      return read(accountId, reminderId);
    });
  };
  const close = () => {
    if (!closed) {
      closed = true;
      database.close();
    }
  };
  return Object.freeze({ databasePath, schemaVersion, encryptedReminderPayload: payloadCodec.encrypted, schedule, read, list, cancel, submitDue, recordReceipt, complete, close });
}

module.exports = { createDesktopReminderStore, createPlaintextPayloadCodec, createSafeStoragePayloadCodec, schemaVersion, statuses };
