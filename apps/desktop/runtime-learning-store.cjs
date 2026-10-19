const { randomUUID } = require('node:crypto');
const { mkdirSync } = require('node:fs');
const { dirname, isAbsolute } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { isRestrictedText, safeSummary } = require('./observation-policy.cjs');

const schemaVersion = 1;
const maximumTimestamp = 253402300799999;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const guidePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const isoPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const results = new Set(['completed', 'unfinished', 'interrupted', 'risk_blocked', 'failed']);
const mediaPattern = /data:\s*(?:(?:image|audio|video)\/|application\/(?:octet-stream|pdf))/i;

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertObject(value, required, optional = []) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw failure('INVALID_INPUT', 'input must be a plain object');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const allowed = new Set([...required, ...optional]);
  if (Reflect.ownKeys(descriptors).some(key => !allowed.has(key) || !Object.hasOwn(descriptors[key], 'value'))
    || required.some(key => !Object.hasOwn(descriptors, key))) {
    throw failure('INVALID_INPUT', 'input contains missing, extra, or accessor fields');
  }
}

function assertTimestamp(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximumTimestamp) {
    throw failure('INVALID_TIME', 'timestamp must be a supported nonnegative integer in milliseconds');
  }
  return value;
}

function assertId(value) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw failure('INVALID_ID', 'a lowercase generated UUID is required');
  return value;
}

function assertGuideId(value) {
  if (typeof value !== 'string' || !guidePattern.test(value) || isRestrictedText(value)) {
    throw failure('INVALID_ID', 'sourceGuideId must be a bounded non-sensitive identifier');
  }
  return value;
}

function cleanText(value, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || mediaPattern.test(value)) {
    throw failure('INVALID_INPUT', 'text must be nonempty, bounded, and contain no media payload');
  }
  const cleaned = safeSummary(isRestrictedText(value) ? null : value, maximum).trim();
  if (!cleaned) throw failure('INVALID_INPUT', 'text must contain usable characters');
  return cleaned;
}

function assertOwner(actor) {
  if (actor !== 'owner') throw failure('FORBIDDEN', 'only the local owner may confirm');
}

function parseRemindAt(value, timestamp) {
  const match = typeof value === 'string' ? isoPattern.exec(value) : null;
  if (!match) throw failure('INVALID_TIME', 'remindAt must be an ISO timestamp with an explicit offset');
  const [, year, month, day, hour, minute, second] = match;
  const calendar = new Date(0);
  calendar.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  calendar.setUTCHours(Number(hour), Number(minute), Number(second), 0);
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month)
    || calendar.getUTCDate() !== Number(day) || calendar.getUTCHours() !== Number(hour)
    || calendar.getUTCMinutes() !== Number(minute) || calendar.getUTCSeconds() !== Number(second)) {
    throw failure('INVALID_TIME', 'remindAt contains an invalid calendar date');
  }
  const dueAt = Date.parse(value);
  assertTimestamp(dueAt);
  if (dueAt <= timestamp) throw failure('INVALID_TIME', 'review must be in the future');
  return new Date(dueAt).toISOString();
}

function assertTimezone(value) {
  if (typeof value !== 'string' || value.length > 100 || !/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(value)) {
    throw failure('INVALID_TIMEZONE', 'an IANA timezone is required');
  }
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0); }
  catch { throw failure('INVALID_TIMEZONE', 'an IANA timezone is required'); }
  return value;
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

function initialize(database, timestamp) {
  database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 1000; PRAGMA journal_mode = WAL; PRAGMA secure_delete = ON;');
  return transaction(database, () => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS runtime_learning_store_meta (
        name TEXT PRIMARY KEY CHECK (name = 'runtime_learning_store'),
        version INTEGER NOT NULL CHECK (version >= 1),
        owner_id TEXT NOT NULL UNIQUE CHECK (length(owner_id) = 36),
        created_at INTEGER NOT NULL CHECK (created_at >= 0)
      ) STRICT;
    `);
    let metadata = database.prepare('SELECT version, owner_id, created_at FROM runtime_learning_store_meta WHERE name = ?').get('runtime_learning_store');
    if (metadata && metadata.version !== schemaVersion) throw failure('SCHEMA_VERSION', 'unsupported runtime learning schema version');
    if (!metadata) {
      metadata = { version: schemaVersion, owner_id: randomUUID(), created_at: timestamp };
      database.prepare('INSERT INTO runtime_learning_store_meta (name, version, owner_id, created_at) VALUES (?, ?, ?, ?)')
        .run('runtime_learning_store', metadata.version, metadata.owner_id, metadata.created_at);
    }
    assertId(metadata.owner_id);
    assertTimestamp(metadata.created_at);
    database.exec(`
      CREATE TABLE IF NOT EXISTS runtime_learning_notes (
        note_id TEXT PRIMARY KEY CHECK (length(note_id) = 36),
        source_guide_id TEXT NOT NULL UNIQUE CHECK (length(source_guide_id) BETWEEN 1 AND 128),
        result TEXT NOT NULL CHECK (result IN ('completed', 'unfinished', 'interrupted', 'risk_blocked', 'failed')),
        mastery TEXT NOT NULL CHECK (mastery IN ('unmastered', 'mastered')),
        started_at INTEGER NOT NULL CHECK (started_at >= 0),
        ended_at INTEGER NOT NULL CHECK (ended_at >= started_at),
        created_at INTEGER NOT NULL CHECK (created_at >= ended_at),
        updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
        payload_ciphertext TEXT NOT NULL CHECK (length(payload_ciphertext) > 0)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS runtime_learning_notes_latest ON runtime_learning_notes (ended_at DESC, created_at DESC);
      CREATE TABLE IF NOT EXISTS runtime_review_proposals (
        proposal_id TEXT PRIMARY KEY CHECK (length(proposal_id) = 36),
        note_id TEXT NOT NULL REFERENCES runtime_learning_notes(note_id),
        state TEXT NOT NULL CHECK (state IN ('suggested', 'accepted', 'declined')),
        due_at TEXT NOT NULL,
        reminder_id TEXT UNIQUE,
        instance_id TEXT UNIQUE,
        created_at INTEGER NOT NULL CHECK (created_at >= 0),
        updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
        payload_ciphertext TEXT NOT NULL CHECK (length(payload_ciphertext) > 0),
        CHECK ((state = 'accepted' AND reminder_id IS NOT NULL AND instance_id IS NOT NULL)
          OR (state IN ('suggested', 'declined') AND reminder_id IS NULL AND instance_id IS NULL))
      ) STRICT;
      CREATE INDEX IF NOT EXISTS runtime_review_proposals_note ON runtime_review_proposals (note_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS runtime_review_outbox (
        reminder_id TEXT PRIMARY KEY CHECK (length(reminder_id) = 36),
        instance_id TEXT NOT NULL UNIQUE CHECK (length(instance_id) = 36),
        proposal_id TEXT NOT NULL UNIQUE REFERENCES runtime_review_proposals(proposal_id),
        status TEXT NOT NULL CHECK (status IN ('pending', 'scheduled')),
        scheduled_at INTEGER,
        created_at INTEGER NOT NULL CHECK (created_at >= 0),
        payload_ciphertext TEXT NOT NULL CHECK (length(payload_ciphertext) > 0),
        CHECK ((status = 'pending' AND scheduled_at IS NULL)
          OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at >= created_at))
      ) STRICT;
    `);
    return metadata.owner_id;
  });
}

function createRuntimeLearningStore(options) {
  assertObject(options, ['databasePath', 'payloadCodec'], ['now']);
  const { databasePath, payloadCodec, now = Date.now } = options;
  if (typeof databasePath !== 'string' || !isAbsolute(databasePath) || databasePath.includes('\0')
    || databasePath.length > 4096 || databasePath.trim() !== databasePath) throw failure('INVALID_INPUT', 'an absolute databasePath is required');
  if (!payloadCodec || payloadCodec.encrypted !== true || typeof payloadCodec.encode !== 'function' || typeof payloadCodec.decode !== 'function') {
    throw failure('ENCRYPTION_UNAVAILABLE', 'an available encrypted payload codec is required; plaintext fallback is prohibited');
  }
  if (typeof now !== 'function') throw failure('INVALID_TIME', 'now must be a clock function');
  const readNow = () => assertTimestamp(now());
  const encodePayload = payload => {
    if (payloadCodec.encrypted !== true) throw failure('ENCRYPTION_UNAVAILABLE', 'encrypted storage is unavailable');
    const json = JSON.stringify(payload);
    let encoded;
    try { encoded = payloadCodec.encode(json); }
    catch { throw failure('STORAGE_CODEC', 'payload encryption failed'); }
    if (typeof encoded !== 'string' || !encoded || encoded.length > 65536 || encoded === json) {
      throw failure('STORAGE_CODEC', 'payload codec did not produce bounded ciphertext');
    }
    return encoded;
  };
  const decodePayload = (encoded, fields) => {
    if (payloadCodec.encrypted !== true) throw failure('ENCRYPTION_UNAVAILABLE', 'encrypted storage is unavailable');
    try {
      const json = payloadCodec.decode(encoded);
      if (typeof json !== 'string' || json.length > 16384) throw new Error();
      const payload = JSON.parse(json);
      assertObject(payload, fields);
      return payload;
    } catch { throw failure('STORAGE_CODEC', 'encrypted payload could not be opened'); }
  };
  const probe = decodePayload(encodePayload({ schemaVersion }), ['schemaVersion']);
  if (probe.schemaVersion !== schemaVersion) throw failure('STORAGE_CODEC', 'payload codec round trip failed');
  const timestamp = readNow();
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  let ownerId;
  try { ownerId = initialize(database, timestamp); }
  catch (error) { database.close(); throw error; }
  let closed = false;
  const ensureOpen = () => { if (closed) throw failure('CLOSED', 'runtime learning store is closed'); };

  const noteFromRow = row => {
    if (!row) return null;
    const payload = decodePayload(row.payload_ciphertext, ['question', 'summary']);
    return {
      noteId: row.note_id, ownerId, sourceGuideId: row.source_guide_id,
      question: cleanText(payload.question, 1000), summary: cleanText(payload.summary, 2000),
      result: row.result, mastery: row.mastery, startedAt: row.started_at, endedAt: row.ended_at,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  };
  const readNote = noteId => noteFromRow(database.prepare('SELECT * FROM runtime_learning_notes WHERE note_id = ?').get(noteId));
  const proposalFromRow = row => {
    if (!row) return null;
    const payload = decodePayload(row.payload_ciphertext, ['timezone', 'reason']);
    return {
      proposalId: row.proposal_id, noteId: row.note_id, sourceGuideId: row.source_guide_id,
      remindAt: row.due_at, timezone: assertTimezone(payload.timezone), reason: cleanText(payload.reason, 500), source: 'ai',
      state: row.state, reminderId: row.reminder_id, instanceId: row.instance_id, createdAt: row.created_at, updatedAt: row.updated_at,
    };
  };
  const readProposal = proposalId => proposalFromRow(database.prepare(`
    SELECT proposal.*, note.source_guide_id FROM runtime_review_proposals proposal
    JOIN runtime_learning_notes note ON note.note_id = proposal.note_id WHERE proposal.proposal_id = ?
  `).get(proposalId));
  const reminderFromRow = row => {
    const payload = decodePayload(row.payload_ciphertext, ['title', 'safeSummary', 'noteId', 'sourceGuideId']);
    if (payload.noteId !== row.note_id || payload.sourceGuideId !== row.source_guide_id) throw failure('STORAGE_CODEC', 'reminder payload binding is invalid');
    return {
      accountId: ownerId, reminderId: row.reminder_id, instanceId: row.instance_id, scheduleVersion: 1,
      dueAt: row.due_at, updatedAt: new Date(row.created_at).toISOString(), deepLink: `nuanban://review/${row.note_id}`,
      payload: { title: cleanText(payload.title, 120), safeSummary: cleanText(payload.safeSummary, 500), noteId: row.note_id, sourceGuideId: row.source_guide_id },
      proposalId: row.proposal_id, status: row.status, scheduledAt: row.scheduled_at,
    };
  };
  const outboxSelect = `
    SELECT outbox.*, proposal.note_id, proposal.due_at, note.source_guide_id FROM runtime_review_outbox outbox
    JOIN runtime_review_proposals proposal ON proposal.proposal_id = outbox.proposal_id
    JOIN runtime_learning_notes note ON note.note_id = proposal.note_id
  `;
  const readReminder = reminderId => {
    const row = database.prepare(`${outboxSelect} WHERE outbox.reminder_id = ?`).get(reminderId);
    return row ? reminderFromRow(row) : null;
  };

  const recordTeaching = input => {
    ensureOpen();
    assertObject(input, ['sourceGuideId', 'question', 'summary', 'result', 'mastery', 'startedAt', 'endedAt']);
    const sourceGuideId = assertGuideId(input.sourceGuideId);
    const question = cleanText(input.question, 1000);
    const summary = cleanText(input.summary, 2000);
    if (!results.has(input.result) || input.mastery !== 'unmastered') throw failure('INVALID_INPUT', 'teaching result or initial mastery is invalid');
    const startedAt = assertTimestamp(input.startedAt);
    const endedAt = assertTimestamp(input.endedAt);
    const createdAt = readNow();
    if (endedAt < startedAt || endedAt > createdAt) throw failure('INVALID_TIME', 'teaching timestamps are out of order or in the future');
    return transaction(database, () => {
      const existing = database.prepare('SELECT * FROM runtime_learning_notes WHERE source_guide_id = ?').get(sourceGuideId);
      if (existing) return noteFromRow(existing);
      const noteId = randomUUID();
      database.prepare(`
        INSERT INTO runtime_learning_notes (note_id, source_guide_id, result, mastery, started_at, ended_at, created_at, updated_at, payload_ciphertext)
        VALUES (?, ?, ?, 'unmastered', ?, ?, ?, ?, ?)
      `).run(noteId, sourceGuideId, input.result, startedAt, endedAt, createdAt, createdAt, encodePayload({ question, summary }));
      return readNote(noteId);
    });
  };
  const getNote = noteId => { ensureOpen(); return readNote(assertId(noteId)); };
  const listNotes = (input = {}) => {
    ensureOpen();
    assertObject(input, [], ['limit']);
    const limit = input.limit === undefined ? 50 : input.limit;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw failure('INVALID_INPUT', 'limit must be an integer between 1 and 200');
    return database.prepare('SELECT * FROM runtime_learning_notes ORDER BY ended_at DESC, created_at DESC, rowid DESC LIMIT ?').all(limit).map(noteFromRow);
  };
  const confirmMastery = input => {
    ensureOpen();
    assertObject(input, ['actor', 'noteId', 'mastered']);
    assertOwner(input.actor);
    const noteId = assertId(input.noteId);
    if (typeof input.mastered !== 'boolean') throw failure('INVALID_INPUT', 'mastered must be a boolean');
    return transaction(database, () => {
      const note = readNote(noteId);
      if (!note) throw failure('NOT_FOUND', 'teaching note does not exist');
      const mastery = input.mastered ? 'mastered' : 'unmastered';
      if (note.mastery === mastery) return note;
      const updatedAt = Math.max(readNow(), note.updatedAt);
      database.prepare('UPDATE runtime_learning_notes SET mastery = ?, updated_at = ? WHERE note_id = ?').run(mastery, updatedAt, noteId);
      return readNote(noteId);
    });
  };
  const getOwnerId = () => { ensureOpen(); return ownerId; };

  const suggestReview = input => {
    ensureOpen();
    assertObject(input, ['sourceGuideId', 'remindAt', 'timezone', 'reason', 'source']);
    const sourceGuideId = assertGuideId(input.sourceGuideId);
    const createdAt = readNow();
    const dueAt = parseRemindAt(input.remindAt, createdAt);
    const timezone = assertTimezone(input.timezone);
    const reason = cleanText(input.reason, 500);
    if (input.source !== 'ai') throw failure('INVALID_INPUT', 'review proposals must identify their AI source');
    return transaction(database, () => {
      const note = database.prepare('SELECT note_id FROM runtime_learning_notes WHERE source_guide_id = ?').get(sourceGuideId);
      if (!note) throw failure('NOT_FOUND', 'review proposal requires a recorded teaching session');
      const proposalId = randomUUID();
      database.prepare(`
        INSERT INTO runtime_review_proposals (proposal_id, note_id, state, due_at, created_at, updated_at, payload_ciphertext)
        VALUES (?, ?, 'suggested', ?, ?, ?, ?)
      `).run(proposalId, note.note_id, dueAt, createdAt, createdAt, encodePayload({ timezone, reason }));
      return readProposal(proposalId);
    });
  };
  const confirmReview = input => {
    ensureOpen();
    assertObject(input, ['actor', 'proposalId']);
    assertOwner(input.actor);
    const proposalId = assertId(input.proposalId);
    return transaction(database, () => {
      const proposal = readProposal(proposalId);
      if (!proposal) throw failure('NOT_FOUND', 'review proposal does not exist');
      if (proposal.state === 'accepted') return proposal;
      if (proposal.state !== 'suggested') throw failure('INVALID_STATE', 'declined proposals cannot be accepted');
      const updatedAt = Math.max(readNow(), proposal.updatedAt);
      if (Date.parse(proposal.remindAt) <= updatedAt) throw failure('INVALID_TIME', 'expired proposals require a new future suggestion');
      const note = readNote(proposal.noteId);
      const reminderId = randomUUID();
      const instanceId = randomUUID();
      const payload = { title: '复习一次亲手操作', safeSummary: safeSummary(note.summary, 500), noteId: note.noteId, sourceGuideId: note.sourceGuideId };
      database.prepare(`
        UPDATE runtime_review_proposals SET state = 'accepted', reminder_id = ?, instance_id = ?, updated_at = ? WHERE proposal_id = ?
      `).run(reminderId, instanceId, updatedAt, proposalId);
      database.prepare(`
        INSERT INTO runtime_review_outbox (reminder_id, instance_id, proposal_id, status, scheduled_at, created_at, payload_ciphertext)
        VALUES (?, ?, ?, 'pending', NULL, ?, ?)
      `).run(reminderId, instanceId, proposalId, updatedAt, encodePayload(payload));
      return readProposal(proposalId);
    });
  };
  const declineReview = input => {
    ensureOpen();
    assertObject(input, ['actor', 'proposalId']);
    assertOwner(input.actor);
    const proposalId = assertId(input.proposalId);
    return transaction(database, () => {
      const proposal = readProposal(proposalId);
      if (!proposal) throw failure('NOT_FOUND', 'review proposal does not exist');
      if (proposal.state === 'declined') return proposal;
      if (proposal.state !== 'suggested') throw failure('INVALID_STATE', 'accepted proposals cannot be declined');
      database.prepare("UPDATE runtime_review_proposals SET state = 'declined', updated_at = ? WHERE proposal_id = ?")
        .run(Math.max(readNow(), proposal.updatedAt), proposalId);
      return readProposal(proposalId);
    });
  };
  const pendingReminders = () => {
    ensureOpen();
    return database.prepare(`${outboxSelect} WHERE outbox.status = 'pending' ORDER BY proposal.due_at ASC, outbox.rowid ASC`).all().map(reminderFromRow);
  };
  const markReminderScheduled = reminderId => {
    ensureOpen();
    assertId(reminderId);
    return transaction(database, () => {
      const reminder = readReminder(reminderId);
      if (!reminder) throw failure('NOT_FOUND', 'confirmed reminder outbox entry does not exist');
      if (reminder.status === 'scheduled') return reminder;
      database.prepare("UPDATE runtime_review_outbox SET status = 'scheduled', scheduled_at = ? WHERE reminder_id = ?")
        .run(Math.max(readNow(), Date.parse(reminder.updatedAt)), reminderId);
      return readReminder(reminderId);
    });
  };
  const getLatest = () => {
    ensureOpen();
    const note = listNotes({ limit: 1 })[0] ?? null;
    const proposal = note ? proposalFromRow(database.prepare(`
      SELECT proposal.*, note.source_guide_id FROM runtime_review_proposals proposal
      JOIN runtime_learning_notes note ON note.note_id = proposal.note_id WHERE proposal.note_id = ?
      ORDER BY proposal.created_at DESC, proposal.rowid DESC LIMIT 1
    `).get(note.noteId)) : null;
    return { note, proposal };
  };
  const close = () => {
    if (!closed) {
      database.close();
      closed = true;
    }
  };
  return Object.freeze({ recordTeaching, getNote, listNotes, confirmMastery, getOwnerId, suggestReview, confirmReview, declineReview, pendingReminders, markReminderScheduled, getLatest, close });
}

module.exports = { createRuntimeLearningStore };
