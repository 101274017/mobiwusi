import { validInstant, validTimezone } from '@nuanban/contracts';

export type ReminderRepeat = 'none' | 'daily' | 'weekly';
export type ReminderChannel = 'local' | 'push';
export type ReminderReceiptState = 'submitted' | 'delivered' | 'opened' | 'failed' | 'missed' | 'unknown';
export type ReminderState = 'scheduled' | 'cancelled' | ReminderReceiptState;
export type ReminderReceiptMap = Record<ReminderReceiptState, string | null>;

export interface ReminderScheduleInput {
  todoId: string;
  instanceId: string;
  plannedAt: string;
  timezone: string;
  scheduleRevision: number;
  deepLink: string;
  repeat?: ReminderRepeat;
  channel?: ReminderChannel;
}

export interface ReminderOccurrence {
  todoId: string;
  instanceId: string;
  plannedAt: string;
  timezone: string;
  scheduleRevision: number;
  deepLink: string;
  repeat: ReminderRepeat;
  channel: ReminderChannel;
  state: ReminderState;
  receipts: ReminderReceiptMap;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface ReminderReceiptInput {
  todoId: string;
  instanceId: string;
  scheduleRevision: number;
  state: ReminderReceiptState;
  observedAt: string;
}

export interface ReminderCompletionInput {
  todoId: string;
  instanceId: string;
  scheduleRevision: number;
  completedAt: string;
}

export interface ReminderCancelInput {
  todoId: string;
  instanceId: string;
  scheduleRevision: number;
  cancelledAt?: string;
}

export type ReminderErrorCode = 'INVALID_INPUT' | 'STALE_SCHEDULE' | 'SCHEDULE_CONFLICT' | 'INVALID_TRANSITION' | 'NOT_FOUND';

export class ReminderError extends Error {
  constructor(public readonly code: ReminderErrorCode, message: string) {
    super(message);
    this.name = 'ReminderError';
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const receiptRank: Record<ReminderReceiptState, number> = { submitted: 1, delivered: 2, opened: 3, failed: 0, missed: 0, unknown: 0 };
const receiptStates = new Set<ReminderReceiptState>(['submitted', 'delivered', 'opened', 'failed', 'missed', 'unknown']);
const repeatStates = new Set<ReminderRepeat>(['none', 'daily', 'weekly']);
const channels = new Set<ReminderChannel>(['local', 'push']);

function fail(code: ReminderErrorCode, message: string): never {
  throw new ReminderError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assertKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !allowed.has(key))) fail('INVALID_INPUT', '提醒请求包含缺失或不支持的字段。');
}

function assertUuid(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !uuid.test(value)) fail('INVALID_INPUT', `${field} 必须是 UUID。`);
}

function normalizeInstant(value: unknown, field: string): string {
  if (typeof value !== 'string' || !validInstant(value)) fail('INVALID_INPUT', `${field} 必须是有效的 RFC3339 时间。`);
  return new Date(value).toISOString();
}

function assertTimezone(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !validTimezone(value)) fail('INVALID_INPUT', 'timezone 必须是有效的 IANA 时区。');
}

function assertRevision(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) fail('INVALID_INPUT', 'scheduleRevision 必须是从 1 开始的安全整数。');
}

function assertLink(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512 || /[\u0000-\u001f\\]/.test(value) || value.startsWith('//')) {
    fail('INVALID_INPUT', 'deepLink 必须是应用内路径。');
  }
  const review = /^\/review\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
  const todo = /^\/todos(?:\/edit\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}))?$/i;
  if (!review.test(value) && !todo.test(value)) fail('INVALID_INPUT', 'deepLink 只能指向复习或待办页面。');
}

function normalizeSchedule(input: ReminderScheduleInput): ReminderScheduleInput & { repeat: ReminderRepeat; channel: ReminderChannel } {
  if (!isRecord(input)) fail('INVALID_INPUT', '提醒排程必须是对象。');
  assertKeys(input, ['todoId', 'instanceId', 'plannedAt', 'timezone', 'scheduleRevision', 'deepLink'], ['repeat', 'channel']);
  assertUuid(input.todoId, 'todoId');
  assertUuid(input.instanceId, 'instanceId');
  const plannedAt = normalizeInstant(input.plannedAt, 'plannedAt');
  assertTimezone(input.timezone);
  assertRevision(input.scheduleRevision);
  assertLink(input.deepLink);
  const repeat = input.repeat ?? 'none';
  const channel = input.channel ?? 'local';
  if (!repeatStates.has(repeat)) fail('INVALID_INPUT', 'repeat 规则不受支持。');
  if (!channels.has(channel)) fail('INVALID_INPUT', '提醒通道不受支持。');
  return { ...input, plannedAt, repeat, channel };
}

function normalizeReceipt(input: ReminderReceiptInput): ReminderReceiptInput {
  if (!isRecord(input)) fail('INVALID_INPUT', '提醒回执必须是对象。');
  assertKeys(input, ['todoId', 'instanceId', 'scheduleRevision', 'state', 'observedAt']);
  assertUuid(input.todoId, 'todoId');
  assertUuid(input.instanceId, 'instanceId');
  assertRevision(input.scheduleRevision);
  if (typeof input.state !== 'string' || !receiptStates.has(input.state as ReminderReceiptState)) fail('INVALID_INPUT', '未知提醒回执不能写入。');
  return { ...input, observedAt: normalizeInstant(input.observedAt, 'observedAt') };
}

function key(todoId: string, instanceId: string): string {
  return `${todoId}:${instanceId}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyReceipts(): ReminderReceiptMap {
  return { submitted: null, delivered: null, opened: null, failed: null, missed: null, unknown: null };
}

function scheduleFingerprint(input: ReminderScheduleInput & { repeat: ReminderRepeat; channel: ReminderChannel }): string {
  return JSON.stringify({ todoId: input.todoId, instanceId: input.instanceId, plannedAt: input.plannedAt, timezone: input.timezone, scheduleRevision: input.scheduleRevision, deepLink: input.deepLink, repeat: input.repeat, channel: input.channel });
}

function assertDateOrder(occurrence: ReminderOccurrence, observedAt: string): void {
  const latest = Object.values(occurrence.receipts).filter((value): value is string => value !== null).map(value => Date.parse(value)).sort((left, right) => right - left)[0];
  if (latest !== undefined && Date.parse(observedAt) < latest) fail('INVALID_TRANSITION', '回执时间不能早于已记录的回执。');
}

function isTerminal(state: ReminderState): boolean {
  return state === 'cancelled' || state === 'failed' || state === 'missed' || state === 'unknown';
}

function isCurrent(occurrence: ReminderOccurrence, latestRevision: Map<string, number>): boolean {
  return latestRevision.get(occurrence.todoId) === occurrence.scheduleRevision;
}

function formatter(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
}

function wallMilliseconds(date: Date, format: Intl.DateTimeFormat): number {
  const parts = Object.fromEntries(format.formatToParts(date).map(part => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
}

function resolveWallTime(wall: Date, format: Intl.DateTimeFormat): Date {
  let guess = new Date(wall);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = wallMilliseconds(guess, format);
    const correction = wall.getTime() - observed;
    if (correction === 0) return guess;
    guess = new Date(guess.getTime() + correction);
  }
  return guess;
}

export async function deriveReminderInstanceId(todoId: string, scheduleRevision: number, plannedAt: string): Promise<string> {
  assertUuid(todoId, 'todoId');
  assertRevision(scheduleRevision);
  const canonicalPlannedAt = normalizeInstant(plannedAt, 'plannedAt');
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) fail('INVALID_INPUT', '当前运行环境没有可用的 Web Crypto，不能生成稳定提醒实例。');
  const seed = new TextEncoder().encode(`nuanban:reminder:${todoId}:${scheduleRevision}:${canonicalPlannedAt}`);
  const digest = new Uint8Array(await subtle.digest('SHA-256', seed));
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function hasStableReminderInstance(input: Pick<ReminderScheduleInput, 'todoId' | 'instanceId' | 'plannedAt' | 'scheduleRevision'>): Promise<boolean> {
  return input.instanceId === await deriveReminderInstanceId(input.todoId, input.scheduleRevision, input.plannedAt);
}

export function nextReminderPlannedAt(input: Pick<ReminderScheduleInput, 'plannedAt' | 'timezone'> & { repeat: ReminderRepeat }, now = new Date()): string | null {
  const plannedAt = normalizeInstant(input.plannedAt, 'plannedAt');
  assertTimezone(input.timezone);
  if (!repeatStates.has(input.repeat)) fail('INVALID_INPUT', 'repeat 规则不受支持。');
  if (input.repeat === 'none') return null;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('INVALID_INPUT', 'now 必须是有效时间。');
  const format = formatter(input.timezone);
  const originalWall = new Date(wallMilliseconds(new Date(plannedAt), format));
  const interval = input.repeat === 'daily' ? 1 : 7;
  for (let count = 0; count < 10000; count += 1) {
    originalWall.setUTCDate(originalWall.getUTCDate() + interval);
    const candidate = resolveWallTime(originalWall, format);
    if (candidate > now) return candidate.toISOString();
  }
  fail('INVALID_INPUT', '无法在有限范围内计算下一次提醒。');
}

export class ReminderLedger {
  private readonly occurrences = new Map<string, ReminderOccurrence>();
  private readonly fingerprints = new Map<string, string>();
  private readonly latestRevision = new Map<string, number>();

  async schedule(input: ReminderScheduleInput): Promise<{ occurrence: ReminderOccurrence; idempotent: boolean }> {
    const normalized = normalizeSchedule(input);
    if (!await hasStableReminderInstance(normalized)) fail('INVALID_INPUT', 'instanceId 必须由 todoId、scheduleRevision 和 plannedAt 稳定生成。');
    const latest = this.latestRevision.get(normalized.todoId);
    if (latest !== undefined && normalized.scheduleRevision < latest) fail('STALE_SCHEDULE', '旧排程版本不能覆盖较新的提醒。');
    const revisionKey = `${normalized.todoId}:${normalized.scheduleRevision}`;
    const existingKey = this.fingerprints.get(revisionKey);
    if (existingKey) {
      const existing = this.occurrences.get(existingKey);
      if (!existing) fail('INVALID_TRANSITION', '提醒排程索引损坏。');
      if (scheduleFingerprint(normalized) !== scheduleFingerprint(existing)) fail('SCHEDULE_CONFLICT', '同一排程版本的内容不一致，拒绝静默覆盖。');
      return { occurrence: clone(existing), idempotent: true };
    }
    const occurrence: ReminderOccurrence = { todoId: normalized.todoId, instanceId: normalized.instanceId, plannedAt: normalized.plannedAt, timezone: normalized.timezone, scheduleRevision: normalized.scheduleRevision, deepLink: normalized.deepLink, repeat: normalized.repeat, channel: normalized.channel, state: 'scheduled', receipts: emptyReceipts(), completedAt: null, cancelledAt: null };
    const occurrenceKey = key(occurrence.todoId, occurrence.instanceId);
    if (this.occurrences.has(occurrenceKey)) fail('SCHEDULE_CONFLICT', '提醒实例已存在但排程版本不一致。');
    this.occurrences.set(occurrenceKey, occurrence);
    this.fingerprints.set(revisionKey, occurrenceKey);
    this.latestRevision.set(normalized.todoId, Math.max(latest ?? 0, normalized.scheduleRevision));
    return { occurrence: clone(occurrence), idempotent: false };
  }

  get(todoId: string, instanceId: string): ReminderOccurrence | null {
    assertUuid(todoId, 'todoId');
    assertUuid(instanceId, 'instanceId');
    const occurrence = this.occurrences.get(key(todoId, instanceId));
    return occurrence ? clone(occurrence) : null;
  }

  listDue(now = new Date()): ReminderOccurrence[] {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('INVALID_INPUT', 'now 必须是有效时间。');
    return Array.from(this.occurrences.values()).filter(occurrence => isCurrent(occurrence, this.latestRevision) && occurrence.state === 'scheduled' && occurrence.completedAt === null && Date.parse(occurrence.plannedAt) <= now.getTime()).map(clone);
  }

  async submitDue(now = new Date(), observedAt = new Date(now)): Promise<ReminderOccurrence[]> {
    if (!(observedAt instanceof Date) || !Number.isFinite(observedAt.getTime())) fail('INVALID_INPUT', 'observedAt 必须是有效时间。');
    const due = this.listDue(now);
    const result: ReminderOccurrence[] = [];
    for (const candidate of due) {
      const occurrence = this.requireCurrent(candidate.todoId, candidate.instanceId, candidate.scheduleRevision);
      const submittedAt = observedAt.toISOString();
      occurrence.receipts.submitted = submittedAt;
      occurrence.state = 'submitted';
      result.push(clone(occurrence));
    }
    return result;
  }

  async recordReceipt(input: ReminderReceiptInput): Promise<ReminderOccurrence> {
    const receipt = normalizeReceipt(input);
    const occurrence = this.requireCurrent(receipt.todoId, receipt.instanceId, receipt.scheduleRevision);
    if (occurrence.completedAt !== null || occurrence.state === 'cancelled') fail('INVALID_TRANSITION', '已取消或完成的提醒不能继续写入回执。');
    assertDateOrder(occurrence, receipt.observedAt);
    const current = occurrence.state;
    if (receipt.state === current) return clone(occurrence);
    if (isTerminal(current) || current === 'opened') fail('INVALID_TRANSITION', '终止回执不能被后续状态覆盖。');
    if (receipt.state === 'submitted') {
      if (current !== 'scheduled') fail('INVALID_TRANSITION', 'submitted 只能从 scheduled 产生。');
    } else if (receipt.state === 'delivered') {
      if (current !== 'submitted') fail('INVALID_TRANSITION', 'delivered 必须先有 submitted。');
    } else if (receipt.state === 'opened') {
      if (current !== 'delivered') fail('INVALID_TRANSITION', 'opened 必须先有 delivered。');
    }
    occurrence.receipts[receipt.state] = receipt.observedAt;
    occurrence.state = receipt.state;
    return clone(occurrence);
  }

  async complete(input: ReminderCompletionInput): Promise<ReminderOccurrence> {
    if (!isRecord(input)) fail('INVALID_INPUT', '完成回执必须是对象。');
    assertKeys(input, ['todoId', 'instanceId', 'scheduleRevision', 'completedAt']);
    assertUuid(input.todoId, 'todoId');
    assertUuid(input.instanceId, 'instanceId');
    assertRevision(input.scheduleRevision);
    const completedAt = normalizeInstant(input.completedAt, 'completedAt');
    const occurrence = this.requireCurrent(input.todoId, input.instanceId, input.scheduleRevision);
    if (occurrence.state === 'cancelled' || occurrence.state === 'failed' || occurrence.state === 'missed' || occurrence.state === 'unknown') fail('INVALID_TRANSITION', '取消、失败或未知提醒不能标记为完成。');
    if (occurrence.completedAt === null) occurrence.completedAt = completedAt;
    return clone(occurrence);
  }

  async cancel(input: ReminderCancelInput): Promise<ReminderOccurrence> {
    if (!isRecord(input)) fail('INVALID_INPUT', '取消请求必须是对象。');
    assertKeys(input, ['todoId', 'instanceId', 'scheduleRevision'], ['cancelledAt']);
    assertUuid(input.todoId, 'todoId');
    assertUuid(input.instanceId, 'instanceId');
    assertRevision(input.scheduleRevision);
    const cancelledAt = normalizeInstant(input.cancelledAt ?? new Date().toISOString(), 'cancelledAt');
    const occurrence = this.requireCurrent(input.todoId, input.instanceId, input.scheduleRevision);
    if (occurrence.state === 'cancelled') return clone(occurrence);
    if (occurrence.completedAt !== null) fail('INVALID_TRANSITION', '已完成的提醒不能再次取消。');
    if (occurrence.state !== 'scheduled') fail('INVALID_TRANSITION', '只有尚未发出的提醒可以取消。');
    occurrence.state = 'cancelled';
    occurrence.cancelledAt = cancelledAt;
    return clone(occurrence);
  }

  entries(): ReminderOccurrence[] {
    return Array.from(this.occurrences.values()).map(clone);
  }

  private requireCurrent(todoId: string, instanceId: string, scheduleRevision: number): ReminderOccurrence {
    const occurrence = this.occurrences.get(key(todoId, instanceId));
    if (!occurrence) {
      const latest = this.latestRevision.get(todoId);
      if (latest !== undefined && scheduleRevision < latest) fail('STALE_SCHEDULE', '旧排程版本不能继续写入提醒状态。');
      fail('NOT_FOUND', '提醒实例不存在。');
    }
    if (occurrence.scheduleRevision !== scheduleRevision) fail('STALE_SCHEDULE', '提醒回执的排程版本已过期。');
    if (!isCurrent(occurrence, this.latestRevision)) fail('STALE_SCHEDULE', '提醒实例不是当前排程版本。');
    return occurrence;
  }
}

export type ReminderDispatchCapability = 'system' | 'page_only' | 'unsupported';
export type ReminderDispatchPermission = 'unknown' | 'granted' | 'denied' | 'unsupported';
export type ReminderDispatchStatus = 'scheduled' | 'idempotent' | 'not_scheduled' | 'cancelled' | 'not_found' | 'stale';

export interface ReminderSchedulerRequest {
  ownerId: string;
  occurrence: ReminderOccurrence;
  generation: number;
}

export interface ReminderSchedulerPort {
  schedule(request: ReminderSchedulerRequest): Promise<void>;
  cancel(request: ReminderSchedulerRequest): Promise<void>;
}

export interface ReminderDispatchResult {
  status: ReminderDispatchStatus;
  generation: number;
  reason?: string;
}

export interface ReminderDispatchStopReport {
  noOp: boolean;
  reason: string | null;
  generationBefore: number;
  generationAfter: number;
  cancelled: number;
  failed: string[];
  restartBlocked: boolean;
}

export interface ReminderDispatchSnapshot {
  capability: ReminderDispatchCapability;
  permission: ReminderDispatchPermission;
  active: boolean;
  generation: number;
  registered: number;
  restartBlocked: boolean;
}

interface RegisteredReminderDispatch {
  ownerId: string;
  occurrence: ReminderOccurrence;
  generation: number;
  fingerprint: string;
}

const dispatchCapabilities = new Set<ReminderDispatchCapability>(['system', 'page_only', 'unsupported']);
const dispatchPermissions = new Set<ReminderDispatchPermission>(['unknown', 'granted', 'denied', 'unsupported']);
const dispatchOwner = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function dispatchKey(ownerId: string, todoId: string, instanceId: string): string {
  return `${ownerId}:${todoId}:${instanceId}`;
}

function dispatchFingerprint(occurrence: ReminderOccurrence): string {
  return JSON.stringify({ todoId: occurrence.todoId, instanceId: occurrence.instanceId, plannedAt: occurrence.plannedAt, timezone: occurrence.timezone, scheduleRevision: occurrence.scheduleRevision, deepLink: occurrence.deepLink, repeat: occurrence.repeat, channel: occurrence.channel });
}

function assertDispatchOwner(ownerId: unknown): asserts ownerId is string {
  if (typeof ownerId !== 'string' || !dispatchOwner.test(ownerId)) fail('INVALID_INPUT', '提醒账号命名空间无效。');
}

async function assertDispatchOccurrence(occurrence: ReminderOccurrence): Promise<void> {
  if (!occurrence || typeof occurrence !== 'object') fail('INVALID_INPUT', '系统提醒资料无效。');
  assertUuid(occurrence.todoId, 'todoId');
  assertUuid(occurrence.instanceId, 'instanceId');
  assertRevision(occurrence.scheduleRevision);
  normalizeInstant(occurrence.plannedAt, 'plannedAt');
  assertTimezone(occurrence.timezone);
  assertLink(occurrence.deepLink);
  if (occurrence.repeat !== 'none' && occurrence.repeat !== 'daily' && occurrence.repeat !== 'weekly') fail('INVALID_INPUT', 'repeat 规则不受支持。');
  if (occurrence.channel !== 'local' && occurrence.channel !== 'push') fail('INVALID_INPUT', '提醒通道不受支持。');
  if (occurrence.state !== 'scheduled' || occurrence.completedAt !== null || occurrence.cancelledAt !== null) fail('INVALID_TRANSITION', '只有尚未发出的提醒可以进入系统排程。');
  if (!await hasStableReminderInstance(occurrence)) fail('INVALID_INPUT', 'instanceId 与提醒排程不匹配。');
}

export class ReminderDispatchGate {
  private active = false;
  private generation = 0;
  private restartBlocked = false;
  private stopPromise: Promise<ReminderDispatchStopReport> | null = null;
  private lastStop: ReminderDispatchStopReport | null = null;
  private readonly registered = new Map<string, RegisteredReminderDispatch>();

  constructor(private readonly capability: ReminderDispatchCapability, private permission: ReminderDispatchPermission, private readonly scheduler: ReminderSchedulerPort) {
    if (!dispatchCapabilities.has(capability) || !dispatchPermissions.has(permission) || !scheduler || typeof scheduler.schedule !== 'function' || typeof scheduler.cancel !== 'function') throw new Error('提醒派发端口不完整。');
  }

  start(generation: number): void {
    if (!Number.isSafeInteger(generation) || generation < 1 || generation <= this.generation) throw new Error('提醒派发代际必须是递增的安全整数。');
    if (this.active || this.stopPromise) throw new Error('提醒派发仍在运行或清理中。');
    if (this.restartBlocked) throw new Error('提醒派发清理失败后禁止在当前进程重新开始。');
    this.generation = generation;
    this.active = true;
    this.lastStop = null;
  }

  async updatePermission(permission: ReminderDispatchPermission): Promise<ReminderDispatchStopReport | null> {
    if (!dispatchPermissions.has(permission)) fail('INVALID_INPUT', '提醒权限状态无效。');
    this.permission = permission;
    if (permission === 'granted' || !this.active) return null;
    return this.stop('permission-revoked');
  }

  async schedule(ownerId: string, occurrence: ReminderOccurrence): Promise<ReminderDispatchResult> {
    assertDispatchOwner(ownerId);
    await assertDispatchOccurrence(occurrence);
    if (!this.active) return { status: 'not_scheduled', generation: this.generation, reason: this.restartBlocked ? 'cleanup_failed' : 'lifecycle_stopped' };
    if (this.capability !== 'system') return { status: 'not_scheduled', generation: this.generation, reason: this.capability === 'page_only' ? 'page_only' : 'unsupported' };
    if (this.permission !== 'granted') return { status: 'not_scheduled', generation: this.generation, reason: this.permission === 'unknown' ? 'permission_unknown' : this.permission === 'denied' ? 'permission_denied' : 'permission_unsupported' };

    const related = Array.from(this.registered.values()).find(item => item.ownerId === ownerId && item.occurrence.todoId === occurrence.todoId);
    if (related && related.occurrence.scheduleRevision > occurrence.scheduleRevision) return { status: 'stale', generation: this.generation, reason: 'stale_schedule' };
    if (related && related.occurrence.scheduleRevision === occurrence.scheduleRevision) {
      if (related.fingerprint !== dispatchFingerprint(occurrence)) fail('SCHEDULE_CONFLICT', '同一提醒排程版本的系统派发内容不一致。');
      return { status: 'idempotent', generation: this.generation };
    }

    if (related) {
      await this.scheduler.cancel({ ownerId: related.ownerId, occurrence: clone(related.occurrence), generation: related.generation });
      this.registered.delete(dispatchKey(related.ownerId, related.occurrence.todoId, related.occurrence.instanceId));
    }
    const request = { ownerId, occurrence: clone(occurrence), generation: this.generation } satisfies ReminderSchedulerRequest;
    await this.scheduler.schedule(request);
    this.registered.set(dispatchKey(ownerId, occurrence.todoId, occurrence.instanceId), { ownerId, occurrence: clone(occurrence), generation: this.generation, fingerprint: dispatchFingerprint(occurrence) });
    return { status: 'scheduled', generation: this.generation };
  }

  async cancel(ownerId: string, todoId: string, instanceId: string, scheduleRevision: number): Promise<ReminderDispatchResult> {
    assertDispatchOwner(ownerId);
    assertUuid(todoId, 'todoId');
    assertUuid(instanceId, 'instanceId');
    assertRevision(scheduleRevision);
    const exactKey = dispatchKey(ownerId, todoId, instanceId);
    const registered = this.registered.get(exactKey);
    if (!registered) {
      const current = Array.from(this.registered.values()).find(item => item.ownerId === ownerId && item.occurrence.todoId === todoId);
      return current ? { status: 'stale', generation: this.generation, reason: 'stale_schedule' } : { status: 'not_found', generation: this.generation };
    }
    if (registered.occurrence.scheduleRevision !== scheduleRevision) return { status: 'stale', generation: this.generation, reason: 'stale_schedule' };
    await this.scheduler.cancel({ ownerId, occurrence: clone(registered.occurrence), generation: registered.generation });
    this.registered.delete(exactKey);
    return { status: 'cancelled', generation: this.generation };
  }

  async stop(reason = 'user-stop'): Promise<ReminderDispatchStopReport> {
    if (this.stopPromise) return this.stopPromise;
    if (this.lastStop) return structuredClone(this.lastStop);
    if (!this.active) {
      const report: ReminderDispatchStopReport = { noOp: true, reason: null, generationBefore: this.generation, generationAfter: this.generation, cancelled: 0, failed: [], restartBlocked: false };
      this.lastStop = report;
      return structuredClone(report);
    }
    this.active = false;
    const generationBefore = this.generation;
    this.generation += 1;
    const failed: string[] = [];
    let cancelled = 0;
    this.stopPromise = (async () => {
      for (const [key, registered] of this.registered) {
        try {
          await this.scheduler.cancel({ ownerId: registered.ownerId, occurrence: clone(registered.occurrence), generation: registered.generation });
          this.registered.delete(key);
          cancelled += 1;
        } catch {
          failed.push(key);
        }
      }
      this.restartBlocked = failed.length > 0;
      const report: ReminderDispatchStopReport = { noOp: false, reason, generationBefore, generationAfter: this.generation, cancelled, failed, restartBlocked: this.restartBlocked };
      this.lastStop = report;
      return report;
    })();
    const report = await this.stopPromise;
    this.stopPromise = null;
    return structuredClone(report);
  }

  snapshot(): ReminderDispatchSnapshot {
    return { capability: this.capability, permission: this.permission, active: this.active, generation: this.generation, registered: this.registered.size, restartBlocked: this.restartBlocked };
  }
}
