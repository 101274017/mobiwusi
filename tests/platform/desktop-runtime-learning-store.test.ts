import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createRuntimeLearningStore } from '../../apps/desktop/runtime-learning-store.cjs';
import type { LearningPayloadCodec, RuntimeLearningStore, TeachingInput } from '../../apps/desktop/runtime-learning-store.cjs';
import { safeSummary } from '../../apps/desktop/observation-policy.cjs';

const require = createRequire(import.meta.url);
const { createDesktopReminderStore, createSafeStoragePayloadCodec } = require('../../apps/desktop/reminder-store.cjs') as {
  createDesktopReminderStore(options: { databasePath: string; payloadCodec: LearningPayloadCodec }): {
    schedule(input: unknown): { outcome: string; reminder: { status: string; payloadJson: string; deliveredAt: string | null } };
    list(accountId: string): unknown[];
    close(): void;
  };
  createSafeStoragePayloadCodec(safeStorage: {
    isEncryptionAvailable(): boolean;
    encryptString(value: string): Buffer;
    decryptString(value: Buffer): string;
  }): LearningPayloadCodec;
};

const epoch = Date.parse('2026-10-18T04:00:00.000Z');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const roots: string[] = [];
const openStores: { close(): void }[] = [];

function unitCodec(): LearningPayloadCodec {
  const key = randomBytes(32);
  return {
    encrypted: true,
    encode(json) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      const ciphertext = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
      return `unit-aes-gcm-v1:${Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64')}`;
    },
    decode(encoded) {
      if (!encoded.startsWith('unit-aes-gcm-v1:')) throw new Error('unit ciphertext prefix is missing');
      const data = Buffer.from(encoded.slice('unit-aes-gcm-v1:'.length), 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
      decipher.setAuthTag(data.subarray(12, 28));
      return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}

function temporaryDatabasePath(): string {
  const root = mkdtempSync(join(tmpdir(), 'nuanban-runtime-learning-unit-'));
  roots.push(root);
  return join(root, 'learning.sqlite');
}

function teaching(overrides: Partial<TeachingInput> = {}): TeachingInput {
  return {
    sourceGuideId: 'guide-font-1', question: '如何调整电脑字体', summary: '亲手打开设置并调整了文本大小',
    result: 'completed', mastery: 'unmastered', startedAt: epoch - 10000, endedAt: epoch - 1000, ...overrides,
  };
}

function setup(payloadCodec = unitCodec()) {
  const databasePath = temporaryDatabasePath();
  let clock = epoch;
  const reopen = () => {
    const store = createRuntimeLearningStore({ databasePath, payloadCodec, now: () => clock });
    openStores.push(store);
    return store;
  };
  return { databasePath, payloadCodec, store: reopen(), reopen, setTime(value: number) { clock = value; } };
}

function inspect<Result>(databasePath: string, callback: (database: DatabaseSync) => Result): Result {
  const database = new DatabaseSync(databasePath);
  try { return callback(database); } finally { database.close(); }
}

function suggest(store: RuntimeLearningStore, overrides = {}) {
  return store.suggestReview({
    sourceGuideId: 'guide-font-1', remindAt: '2026-10-19T13:00:00+08:00', timezone: 'Asia/Shanghai',
    reason: '明天再亲手练习一次字体调整', source: 'ai', ...overrides,
  });
}

afterEach(() => {
  for (const store of openStores.splice(0).reverse()) store.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('独立桌宠教学记录 SQLite unit（合成 AES codec，不代表 DPAPI 真机验收）', () => {
  it('生成并持久化独立本机 owner UUID，不接受外部认证身份注入', () => {
    const fixture = setup();
    const ownerId = fixture.store.getOwnerId();
    expect(ownerId).toMatch(uuidPattern);
    expect(setup().store.getOwnerId()).not.toBe(ownerId);
    fixture.store.close();
    expect(fixture.reopen().getOwnerId()).toBe(ownerId);
    expect(() => createRuntimeLearningStore({
      databasePath: temporaryDatabasePath(), payloadCodec: unitCodec(), ownerId: randomUUID(),
    } as never)).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it('空仓返回 null，同次教学幂等并且不能覆盖本人掌握确认', () => {
    const { store } = setup();
    expect(store.getLatest()).toEqual({ note: null, proposal: null });
    expect(store.getNote(randomUUID())).toBeNull();
    const note = store.recordTeaching(teaching());
    expect(note.noteId).toMatch(uuidPattern);
    expect(note.ownerId).toBe(store.getOwnerId());
    const mastered = store.confirmMastery({ actor: 'owner', noteId: note.noteId, mastered: true });
    expect(store.recordTeaching(teaching({ summary: '不能覆盖原笔记', result: 'failed' }))).toEqual(mastered);
    expect(store.listNotes()).toEqual([mastered]);
  });

  it.each(['completed', 'unfinished', 'interrupted', 'risk_blocked', 'failed'] as const)('%s 教学均生成默认未掌握的笔记', result => {
    const { store } = setup();
    const note = store.recordTeaching(teaching({ result }));
    expect(note).toMatchObject({ result, mastery: 'unmastered', startedAt: epoch - 10000, endedAt: epoch - 1000 });
    expect(store.getNote(note.noteId)).toEqual(note);
  });

  it('相同问题的不同 guideId 每次保留一条独立记录', () => {
    const { store } = setup();
    const first = store.recordTeaching(teaching());
    const second = store.recordTeaching(teaching({ sourceGuideId: 'guide-font-2', result: 'unfinished' }));
    expect(second.noteId).not.toBe(first.noteId);
    expect(store.listNotes()).toEqual([second, first]);
    expect(store.getLatest()).toEqual({ note: second, proposal: null });
  });

  it('按教学结束时间倒序，默认最近 50 条，支持有界 limit 和稳定的同毫秒排序', () => {
    const { store } = setup();
    const notes = Array.from({ length: 55 }, (unusedValue, index) => store.recordTeaching(teaching({
      sourceGuideId: `guide-${index}`, startedAt: epoch - 20000, endedAt: epoch - 10000 + index,
    })));
    const descending = [...notes].reverse();
    expect(store.listNotes()).toEqual(descending.slice(0, 50));
    expect(store.listNotes({ limit: 200 })).toEqual(descending);
    expect(store.listNotes({ limit: 1 })).toEqual([notes[54]]);
    const earlierInsertedLate = store.recordTeaching(teaching({ sourceGuideId: 'guide-older', endedAt: epoch - 19999, startedAt: epoch - 20000 }));
    expect(store.listNotes({ limit: 200 }).at(-1)).toEqual(earlierInsertedLate);
    expect(store.getLatest().note).toEqual(notes[54]);
  });

  it('只有本人能确认或撤销掌握，重复确认不改时间', () => {
    const fixture = setup();
    const note = fixture.store.recordTeaching(teaching());
    fixture.setTime(epoch + 1000);
    const mastered = fixture.store.confirmMastery({ actor: 'owner', noteId: note.noteId, mastered: true });
    expect(mastered).toMatchObject({ mastery: 'mastered', updatedAt: epoch + 1000, result: 'completed' });
    fixture.setTime(epoch + 2000);
    expect(fixture.store.confirmMastery({ actor: 'owner', noteId: note.noteId, mastered: true })).toEqual(mastered);
    expect(fixture.store.confirmMastery({ actor: 'owner', noteId: note.noteId, mastered: false }))
      .toMatchObject({ mastery: 'unmastered', updatedAt: epoch + 2000 });
  });

  it.each(['family', 'ai', 'AI', 'system', 'owner ', 'OWNER', '', null, undefined, false, {}])('拒绝所有非本人 actor：%j', actor => {
    const { store } = setup();
    const note = store.recordTeaching(teaching());
    const proposal = suggest(store);
    expect(() => store.confirmMastery({ actor: actor as never, noteId: note.noteId, mastered: true }))
      .toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(() => store.confirmReview({ actor: actor as never, proposalId: proposal.proposalId }))
      .toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(() => store.declineReview({ actor: actor as never, proposalId: proposal.proposalId }))
      .toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(store.getNote(note.noteId)?.mastery).toBe('unmastered');
    expect(store.getLatest().proposal?.state).toBe('suggested');
    expect(store.pendingReminders()).toEqual([]);
  });

  it('AI 只创建建议，保留 IANA 时区并规范化 ISO 时间，不自动创建提醒', () => {
    const { store, databasePath } = setup();
    const note = store.recordTeaching(teaching());
    const proposal = suggest(store);
    expect(proposal).toMatchObject({
      noteId: note.noteId, sourceGuideId: note.sourceGuideId, source: 'ai', state: 'suggested',
      remindAt: '2026-10-19T05:00:00.000Z', timezone: 'Asia/Shanghai', reminderId: null, instanceId: null,
    });
    expect(proposal.proposalId).toMatch(uuidPattern);
    expect(store.getLatest()).toEqual({ note, proposal });
    expect(store.pendingReminders()).toEqual([]);
    expect(inspect(databasePath, database => database.prepare('SELECT COUNT(*) AS count FROM runtime_review_outbox').get()?.count)).toBe(0);
  });

  it('本人确认在一个事务中 accepted + pending outbox，重复确认复用同一提醒和实例', () => {
    const fixture = setup();
    const note = fixture.store.recordTeaching(teaching());
    const proposal = suggest(fixture.store);
    const accepted = fixture.store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId });
    expect(accepted.state).toBe('accepted');
    expect(accepted.reminderId).toMatch(uuidPattern);
    expect(accepted.instanceId).toMatch(uuidPattern);
    const pending = fixture.store.pendingReminders();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toEqual({
      accountId: fixture.store.getOwnerId(), reminderId: accepted.reminderId, instanceId: accepted.instanceId,
      scheduleVersion: 1, dueAt: proposal.remindAt, updatedAt: new Date(epoch).toISOString(),
      deepLink: `nuanban://review/${note.noteId}`, proposalId: proposal.proposalId, status: 'pending', scheduledAt: null,
      payload: { title: '复习一次亲手操作', safeSummary: note.summary, noteId: note.noteId, sourceGuideId: note.sourceGuideId },
    });
    fixture.setTime(epoch + 10000);
    expect(fixture.store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId })).toEqual(accepted);
    expect(fixture.store.pendingReminders()).toEqual(pending);
    expect(() => fixture.store.declineReview({ actor: 'owner', proposalId: proposal.proposalId }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_STATE' }));
  });

  it('本人拒绝建议没有 outbox，重复拒绝幂等，拒绝后不能再确认', () => {
    const { store } = setup();
    store.recordTeaching(teaching());
    const proposal = suggest(store);
    const declined = store.declineReview({ actor: 'owner', proposalId: proposal.proposalId });
    expect(declined).toMatchObject({ state: 'declined', reminderId: null, instanceId: null });
    expect(store.declineReview({ actor: 'owner', proposalId: proposal.proposalId })).toEqual(declined);
    expect(() => store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_STATE' }));
    expect(store.pendingReminders()).toEqual([]);
  });

  it('过期的未确认建议不可调度，已确认建议重复确认即使过期也不产生副作用', () => {
    const fixture = setup();
    fixture.store.recordTeaching(teaching());
    const acceptedProposal = suggest(fixture.store);
    const accepted = fixture.store.confirmReview({ actor: 'owner', proposalId: acceptedProposal.proposalId });
    const expired = suggest(fixture.store);
    const pending = fixture.store.pendingReminders();
    fixture.setTime(Date.parse(expired.remindAt));
    expect(() => fixture.store.confirmReview({ actor: 'owner', proposalId: expired.proposalId }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_TIME' }));
    expect(fixture.store.confirmReview({ actor: 'owner', proposalId: accepted.proposalId })).toEqual(accepted);
    expect(fixture.store.pendingReminders()).toEqual(pending);
    expect(fixture.store.getLatest().proposal?.state).toBe('suggested');
  });

  it('outbox 兼容真实 reminder-store.schedule，跨库中断可重试而不会伪装 delivered', () => {
    const fixture = setup();
    fixture.store.recordTeaching(teaching());
    const proposal = suggest(fixture.store);
    fixture.store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId });
    const reminder = fixture.store.pendingReminders()[0];
    const reminderStore = createDesktopReminderStore({
      databasePath: join(dirname(fixture.databasePath), 'reminders.sqlite'), payloadCodec: fixture.payloadCodec,
    });
    openStores.push(reminderStore);
    expect(reminderStore.list(fixture.store.getOwnerId())).toEqual([]);
    const scheduled = reminderStore.schedule(reminder);
    expect(scheduled.outcome).toBe('created');
    expect(scheduled.reminder).toMatchObject({ status: 'scheduled', deliveredAt: null });
    expect(JSON.parse(scheduled.reminder.payloadJson)).toEqual(reminder.payload);
    fixture.store.close();
    const reopened = fixture.reopen();
    expect(reopened.pendingReminders()).toEqual([reminder]);
    expect(reminderStore.schedule(reopened.pendingReminders()[0]).outcome).toBe('idempotent');
    fixture.setTime(epoch + 1000);
    const acknowledged = reopened.markReminderScheduled(reminder.reminderId);
    expect(acknowledged).toEqual({ ...reminder, status: 'scheduled', scheduledAt: epoch + 1000 });
    expect(reopened.pendingReminders()).toEqual([]);
    expect(reopened.markReminderScheduled(reminder.reminderId)).toEqual(acknowledged);
    expect(reopened.confirmReview({ actor: 'owner', proposalId: proposal.proposalId }).reminderId).toBe(reminder.reminderId);
    expect(reopened.pendingReminders()).toEqual([]);
    expect(reminderStore.list(reminder.accountId)).toHaveLength(1);
    reopened.close();
    const finalStore = fixture.reopen();
    expect(finalStore.pendingReminders()).toEqual([]);
    expect(finalStore.markReminderScheduled(reminder.reminderId)).toEqual(acknowledged);
  });

  it('模拟 outbox INSERT 失败时回滚 accepted 和关联 ID，随后可以正常重试', () => {
    const { store, databasePath } = setup();
    store.recordTeaching(teaching());
    const proposal = suggest(store);
    inspect(databasePath, database => database.exec(`
      CREATE TRIGGER reject_runtime_outbox BEFORE INSERT ON runtime_review_outbox
      BEGIN SELECT RAISE(ABORT, 'unit outbox failure'); END;
    `));
    expect(() => store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId })).toThrowError(/unit outbox failure/);
    expect(store.getLatest().proposal).toEqual(proposal);
    expect(store.pendingReminders()).toEqual([]);
    inspect(databasePath, database => database.exec('DROP TRIGGER reject_runtime_outbox'));
    expect(store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId }).state).toBe('accepted');
    expect(store.pendingReminders()).toHaveLength(1);
  });

  it('两个 SQLite 连接共享同一本机身份，重复教学与确认没有重复行', () => {
    const fixture = setup();
    const second = fixture.reopen();
    expect(second.getOwnerId()).toBe(fixture.store.getOwnerId());
    const note = fixture.store.recordTeaching(teaching());
    expect(second.recordTeaching(teaching())).toEqual(note);
    const proposal = suggest(second);
    const accepted = fixture.store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId });
    expect(second.confirmReview({ actor: 'owner', proposalId: proposal.proposalId })).toEqual(accepted);
    expect(second.listNotes()).toHaveLength(1);
    expect(second.pendingReminders()).toHaveLength(1);
  });

  it('确认时加密失败不会留下 accepted 半成品，恢复 codec 后可以重试', () => {
    const synthetic = unitCodec();
    let rejectEncryption = false;
    const fixture = setup({
      encrypted: true, decode: synthetic.decode,
      encode(json) {
        if (rejectEncryption) throw new Error('PRIVATE_ENCRYPTION_FAILURE');
        return synthetic.encode(json);
      },
    });
    fixture.store.recordTeaching(teaching());
    const proposal = suggest(fixture.store);
    rejectEncryption = true;
    expect(() => fixture.store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId }))
      .toThrowError('payload encryption failed');
    expect(fixture.store.getLatest().proposal).toEqual(proposal);
    expect(fixture.store.pendingReminders()).toEqual([]);
    rejectEncryption = false;
    expect(fixture.store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId }).state).toBe('accepted');
    expect(fixture.store.pendingReminders()).toHaveLength(1);
  });

  it('重启保留本人掌握状态、未完成笔记、建议状态和未调度 outbox，并按到期时间排序', () => {
    const fixture = setup();
    const note = fixture.store.recordTeaching(teaching({ result: 'interrupted' }));
    const mastered = fixture.store.confirmMastery({ actor: 'owner', noteId: note.noteId, mastered: true });
    const later = suggest(fixture.store, { remindAt: '2026-10-21T00:00:00Z' });
    const earlier = suggest(fixture.store);
    const suggested = suggest(fixture.store);
    const acceptedLater = fixture.store.confirmReview({ actor: 'owner', proposalId: later.proposalId });
    const acceptedEarlier = fixture.store.confirmReview({ actor: 'owner', proposalId: earlier.proposalId });
    const pending = fixture.store.pendingReminders();
    expect(pending.map(reminder => reminder.reminderId)).toEqual([acceptedEarlier.reminderId, acceptedLater.reminderId]);
    const ownerId = fixture.store.getOwnerId();
    fixture.store.close();
    const reopened = fixture.reopen();
    expect(reopened.getOwnerId()).toBe(ownerId);
    expect(reopened.getNote(note.noteId)).toEqual(mastered);
    expect(reopened.getLatest()).toEqual({ note: mastered, proposal: suggested });
    expect(reopened.pendingReminders()).toEqual(pending);
    const declined = reopened.declineReview({ actor: 'owner', proposalId: suggested.proposalId });
    reopened.close();
    expect(fixture.reopen().getLatest().proposal).toEqual(declined);
  });

  it('最新教学没有建议时不展示上一教学的建议', () => {
    const { store } = setup();
    store.recordTeaching(teaching());
    suggest(store);
    const note = store.recordTeaching(teaching({ sourceGuideId: 'guide-next', endedAt: epoch }));
    expect(store.getLatest()).toEqual({ note, proposal: null });
  });

  it('SQLite 主库和 WAL 无 question/summary/reason 明文，密文仅包含白名单字段', () => {
    const fixture = setup();
    const question = `问题明文禁止留存-${randomUUID()}`;
    const summary = `摘要明文禁止留存-${randomUUID()}`;
    const reason = `复习原因明文禁止留存-${randomUUID()}`;
    fixture.store.recordTeaching(teaching({ question, summary }));
    const proposal = suggest(fixture.store, { reason });
    fixture.store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId });
    inspect(fixture.databasePath, database => {
      const noteRow = database.prepare('SELECT * FROM runtime_learning_notes').get()!;
      const proposalRow = database.prepare('SELECT * FROM runtime_review_proposals').get()!;
      const outboxRow = database.prepare('SELECT * FROM runtime_review_outbox').get()!;
      expect(JSON.parse(fixture.payloadCodec.decode(noteRow.payload_ciphertext as string))).toEqual({ question, summary });
      expect(JSON.parse(fixture.payloadCodec.decode(proposalRow.payload_ciphertext as string))).toEqual({ timezone: 'Asia/Shanghai', reason });
      expect(Object.keys(JSON.parse(fixture.payloadCodec.decode(outboxRow.payload_ciphertext as string))).sort())
        .toEqual(['noteId', 'safeSummary', 'sourceGuideId', 'title']);
      for (const row of [noteRow, proposalRow, outboxRow]) {
        const storedValues = Object.values(row).join('|');
        for (const secret of [question, summary, reason]) expect(storedValues).not.toContain(secret);
      }
    });
    const assertNoPlaintext = () => {
      for (const suffix of ['', '-wal', '-shm']) {
        const path = `${fixture.databasePath}${suffix}`;
        if (!existsSync(path)) continue;
        const bytes = readFileSync(path);
        for (const secret of [question, summary, reason]) expect(bytes.includes(Buffer.from(secret))).toBe(false);
      }
    };
    assertNoPlaintext();
    fixture.store.close();
    assertNoPlaintext();
  });

  it('敏感文字在加密前脱敏，不在密文中重新留存', () => {
    const fixture = setup();
    const note = fixture.store.recordTeaching(teaching({ question: '邮箱 person@example.com', summary: '验证码 123456' }));
    expect(note.question).toBe(safeSummary(null));
    expect(note.summary).toBe(safeSummary(null));
    const proposal = suggest(fixture.store, { reason: '银行卡 1234567890' });
    expect(proposal.reason).toBe(safeSummary(null));
    fixture.store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId });
    expect(fixture.store.pendingReminders()[0].payload.safeSummary).toBe(safeSummary(null));
    inspect(fixture.databasePath, database => {
      for (const table of ['runtime_learning_notes', 'runtime_review_proposals', 'runtime_review_outbox']) {
        const row = database.prepare(`SELECT payload_ciphertext FROM ${table}`).get()!;
        const decrypted = fixture.payloadCodec.decode(row.payload_ciphertext as string);
        for (const secret of ['person@example.com', '123456', '1234567890']) expect(decrypted).not.toContain(secret);
      }
    });
  });

  it('拒绝缺失或不可用 codec、明文 fallback 和伪密文，失败不创建数据库', () => {
    const unavailable = createSafeStoragePayloadCodec({
      isEncryptionAvailable: () => false,
      encryptString: () => { throw new Error('must not encrypt when unavailable'); },
      decryptString: () => { throw new Error('must not decrypt when unavailable'); },
    });
    for (const payloadCodec of [undefined, null, unavailable, { encrypted: false, encode: String, decode: String }, { encrypted: true }]) {
      const databasePath = temporaryDatabasePath();
      expect(() => createRuntimeLearningStore({ databasePath, payloadCodec: payloadCodec as never }))
        .toThrowError(expect.objectContaining({ code: 'ENCRYPTION_UNAVAILABLE' }));
      expect(existsSync(databasePath)).toBe(false);
    }
    for (const payloadCodec of [
      { encrypted: true, encode: String, decode: String },
      { encrypted: true, encode: () => '', decode: String },
      { encrypted: true, encode: () => 'ciphertext', decode: () => '{"schemaVersion":99}' },
      { encrypted: true, encode: () => { throw new Error('sensitive codec message'); }, decode: String },
    ]) {
      const databasePath = temporaryDatabasePath();
      expect(() => createRuntimeLearningStore({ databasePath, payloadCodec }))
        .toThrowError(expect.objectContaining({ code: 'STORAGE_CODEC' }));
      expect(existsSync(databasePath)).toBe(false);
    }
  });

  it('可复用现有 safeStorage codec 契约（仍是合成 unit 适配器）', () => {
    const synthetic = unitCodec();
    const codec = createSafeStoragePayloadCodec({
      isEncryptionAvailable: () => true,
      encryptString: value => Buffer.from(synthetic.encode(value)),
      decryptString: value => synthetic.decode(value.toString()),
    });
    const fixture = setup(codec);
    const note = fixture.store.recordTeaching(teaching());
    expect(inspect(fixture.databasePath, database => database.prepare('SELECT payload_ciphertext FROM runtime_learning_notes').get()?.payload_ciphertext))
      .toMatch(/^safe-v1:/);
    fixture.store.close();
    expect(fixture.reopen().getNote(note.noteId)).toEqual(note);
  });

  it('插入后解码失败回滚教学记录且不泄露 codec 异常中的秘密', () => {
    const synthetic = unitCodec();
    let rejectNoteDecode = false;
    const fixture = setup({
      encrypted: true, encode: synthetic.encode,
      decode(encoded) {
        const json = synthetic.decode(encoded);
        if (rejectNoteDecode && Object.hasOwn(JSON.parse(json), 'question')) throw new Error('PRIVATE_CODEC_CONTENT');
        return json;
      },
    });
    rejectNoteDecode = true;
    expect(() => fixture.store.recordTeaching(teaching())).toThrowError('encrypted payload could not be opened');
    rejectNoteDecode = false;
    expect(fixture.store.listNotes()).toEqual([]);
    expect(fixture.store.recordTeaching(teaching()).mastery).toBe('unmastered');
  });

  it('运行期间加密不可用时拒绝写入且不回退为明文', () => {
    const codec = unitCodec() as { encrypted: boolean; encode(json: string): string; decode(encoded: string): string };
    const fixture = setup(codec);
    codec.encrypted = false;
    expect(() => fixture.store.recordTeaching(teaching())).toThrowError(expect.objectContaining({ code: 'ENCRYPTION_UNAVAILABLE' }));
    codec.encrypted = true;
    expect(fixture.store.listNotes()).toEqual([]);
  });

  it('用错误密钥重开不会把无法解密的旧笔记覆盖成新明文', () => {
    const fixture = setup();
    const note = fixture.store.recordTeaching(teaching());
    fixture.store.close();
    const wrongKeyStore = createRuntimeLearningStore({ databasePath: fixture.databasePath, payloadCodec: unitCodec(), now: () => epoch });
    openStores.push(wrongKeyStore);
    expect(() => wrongKeyStore.getNote(note.noteId)).toThrowError(expect.objectContaining({ code: 'STORAGE_CODEC' }));
    expect(() => wrongKeyStore.recordTeaching(teaching())).toThrowError(expect.objectContaining({ code: 'STORAGE_CODEC' }));
    wrongKeyStore.close();
    expect(fixture.reopen().getNote(note.noteId)).toEqual(note);
  });

  it('严格校验教学字段、时间、有界文本，不序列化未知原图、音频、OCR 或 toJSON', () => {
    const { store } = setup();
    const invalid = [
      null, undefined, [], new Date(), Object.create({ sourceGuideId: 'inherited' }), {},
      { ...teaching(), sourceGuideId: '' }, { ...teaching(), sourceGuideId: 'x'.repeat(129) },
      { ...teaching(), sourceGuideId: "guide'; DROP TABLE runtime_learning_notes;--" },
      { ...teaching(), question: '' }, { ...teaching(), question: 'x'.repeat(1001) },
      { ...teaching(), question: '\u0000' }, { ...teaching(), question: 'data:image/png;base64,AA==' },
      { ...teaching(), summary: 'x'.repeat(2001) }, { ...teaching(), summary: Buffer.from('raw') },
      { ...teaching(), mastery: 'mastered' }, { ...teaching(), result: 'delivered' },
      { ...teaching(), startedAt: -1 }, { ...teaching(), startedAt: NaN }, { ...teaching(), startedAt: Infinity },
      { ...teaching(), startedAt: 1.5 }, { ...teaching(), endedAt: '2026-10-18' },
      { ...teaching(), endedAt: epoch + 1 }, { ...teaching(), startedAt: epoch, endedAt: epoch - 1 },
      { ...teaching(), screenshot: Buffer.from('raw screenshot') }, { ...teaching(), audio: Buffer.from('raw audio') },
      { ...teaching(), ocrText: 'raw OCR body' }, { ...teaching(), [Symbol('unknown')]: 'raw' },
      { ...teaching(), raw: { toJSON() { throw new Error('must never serialize unknown objects'); } } },
    ];
    for (const input of invalid) expect(() => store.recordTeaching(input as never)).toThrow();
    let getterCalled = false;
    const accessor = { ...teaching(), get question() { getterCalled = true; return 'secret getter'; } };
    expect(() => store.recordTeaching(accessor)).toThrowError(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(getterCalled).toBe(false);
    expect(store.listNotes()).toEqual([]);
  });

  it('拒绝非法、非未来日期、无效 IANA 时区和额外的复习字段', () => {
    const { store } = setup();
    store.recordTeaching(teaching());
    for (const remindAt of [
      'tomorrow', '2026-10-20', '2026-10-20T00:00:00', '2027-02-30T00:00:00Z', '2027-13-01T00:00:00Z',
      '2027-01-01T24:00:00Z', '2027-01-01T00:60:00Z', '2027-01-01T00:00:60Z',
      '2027-01-01T00:00:00+25:00', '2026-10-17T00:00:00Z', new Date(epoch).toISOString(), null,
    ]) expect(() => suggest(store, { remindAt })).toThrowError(expect.objectContaining({ code: 'INVALID_TIME' }));
    for (const timezone of ['', 'Mars/Olympus', '+08:00', ' Asia/Shanghai ', null, 'x'.repeat(101)]) {
      expect(() => suggest(store, { timezone })).toThrowError(expect.objectContaining({ code: 'INVALID_TIMEZONE' }));
    }
    for (const overrides of [
      { reason: '' }, { reason: 'x'.repeat(501) }, { source: 'owner' }, { source: 'family' },
      { screenshot: 'raw screenshot' }, { sourceGuideId: '' },
    ]) expect(() => suggest(store, overrides)).toThrow();
    expect(() => suggest(store, { sourceGuideId: 'guide-not-recorded' })).toThrowError(expect.objectContaining({ code: 'NOT_FOUND' }));
    expect(store.getLatest().proposal).toBeNull();
    expect(store.pendingReminders()).toEqual([]);
  });

  it('严格校验查询、确认、主键与工厂参数', () => {
    const { store } = setup();
    const note = store.recordTeaching(teaching());
    for (const noteId of ['', 'not-a-uuid', note.noteId.toUpperCase(), null, 42]) expect(() => store.getNote(noteId as never)).toThrow();
    for (const options of [null, [], { limit: 0 }, { limit: 201 }, { limit: 1.5 }, { limit: '1' }, { limit: Infinity }, { raw: 'extra' }]) {
      expect(() => store.listNotes(options as never)).toThrow();
    }
    expect(() => store.confirmMastery({ actor: 'owner', noteId: note.noteId, mastered: 'true' } as never)).toThrow();
    expect(() => store.confirmMastery({ actor: 'owner', noteId: randomUUID(), mastered: true }))
      .toThrowError(expect.objectContaining({ code: 'NOT_FOUND' }));
    for (const action of [store.confirmReview, store.declineReview]) {
      expect(() => action({ actor: 'owner', proposalId: 'invalid' })).toThrowError(expect.objectContaining({ code: 'INVALID_ID' }));
      expect(() => action({ actor: 'owner', proposalId: randomUUID() })).toThrowError(expect.objectContaining({ code: 'NOT_FOUND' }));
      expect(() => action({ actor: 'owner', proposalId: randomUUID(), confirmed: true } as never)).toThrow();
    }
    expect(() => store.markReminderScheduled('invalid')).toThrowError(expect.objectContaining({ code: 'INVALID_ID' }));
    expect(() => store.markReminderScheduled(randomUUID())).toThrowError(expect.objectContaining({ code: 'NOT_FOUND' }));
    for (const databasePath of ['', ':memory:', 'relative.sqlite', `${temporaryDatabasePath()}\0`]) {
      expect(() => createRuntimeLearningStore({ databasePath, payloadCodec: unitCodec() })).toThrow();
    }
    for (const now of [() => NaN, () => -1, () => Infinity, () => 1.5, () => 253402300800000, 42]) {
      expect(() => createRuntimeLearningStore({ databasePath: temporaryDatabasePath(), payloadCodec: unitCodec(), now: now as never })).toThrow();
    }
  });

  it('拒绝未来版本数据库且不覆盖原 owner 或笔记', () => {
    const fixture = setup();
    const ownerId = fixture.store.getOwnerId();
    const note = fixture.store.recordTeaching(teaching());
    fixture.store.close();
    inspect(fixture.databasePath, database => database.prepare('UPDATE runtime_learning_store_meta SET version = ?').run(99));
    expect(() => fixture.reopen()).toThrowError(expect.objectContaining({ code: 'SCHEMA_VERSION' }));
    inspect(fixture.databasePath, database => {
      expect(database.prepare('SELECT owner_id, version FROM runtime_learning_store_meta').get()).toMatchObject({ owner_id: ownerId, version: 99 });
      database.prepare('UPDATE runtime_learning_store_meta SET version = ?').run(1);
    });
    expect(fixture.reopen().getNote(note.noteId)).toEqual(note);
  });

  it('关闭幂等，关闭后所有读写接口均拒绝使用', () => {
    const { store } = setup();
    const note = store.recordTeaching(teaching());
    const proposal = suggest(store);
    store.close();
    store.close();
    const operations = [
      () => store.recordTeaching(teaching()), () => store.getNote(note.noteId), () => store.listNotes(),
      () => store.confirmMastery({ actor: 'owner', noteId: note.noteId, mastered: true }), () => store.getOwnerId(),
      () => suggest(store), () => store.confirmReview({ actor: 'owner', proposalId: proposal.proposalId }),
      () => store.declineReview({ actor: 'owner', proposalId: proposal.proposalId }), () => store.pendingReminders(),
      () => store.markReminderScheduled(randomUUID()), () => store.getLatest(),
    ];
    for (const operation of operations) expect(operation).toThrowError(expect.objectContaining({ code: 'CLOSED' }));
  });
});
