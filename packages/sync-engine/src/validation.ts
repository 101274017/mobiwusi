import type { AccessAction, EntityType, ObjectAuthorizer, RepeatRule, RequestContext, SyncMutation } from './ports.ts';
import { SyncEngineError } from './ports.ts';

export const clone = <Value>(value: Value): Value => structuredClone(value);
export const systemClock = { now: (): string => new Date().toISOString() };

export function requiredText(value: unknown, field: string, max = 256): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new SyncEngineError('INVALID_INPUT', `${field} 无效。`);
  }
  return value;
}

export function instant(value: unknown, field: string): string {
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value)
    : null;
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12 || Number(match[3]) < 1
    || Number(match[3]) > new Date(Date.UTC(Number(match[1]) + 400, Number(match[2]), 0)).getUTCDate()
    || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59
    || !Number.isFinite(Date.parse(value as string))) {
    throw new SyncEngineError('INVALID_INPUT', `${field} 必须是带时区的有效 ISO 时间。`);
  }
  return new Date(value as string).toISOString();
}

export function timezone(value: unknown): string {
  requiredText(value, 'timezone', 128);
  if (/^[+-]/.test(value as string)) throw new SyncEngineError('INVALID_INPUT', 'timezone 必须是 IANA 时区。');
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value as string }).resolvedOptions().timeZone;
  } catch {
    throw new SyncEngineError('INVALID_INPUT', 'timezone 必须是有效 IANA 时区。');
  }
}

export function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new SyncEngineError('INVALID_INPUT', `${field} 必须是普通对象。`);
  }
  return value as Record<string, unknown>;
}

export function fields(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) {
    throw new SyncEngineError('INVALID_INPUT', '包含未知或不可修改的字段。');
  }
}

export function choice<Value extends string>(value: unknown, allowed: readonly Value[], field: string): Value {
  if (!allowed.includes(value as Value)) throw new SyncEngineError('INVALID_INPUT', `${field} 无效。`);
  return value as Value;
}

export function revision(value: unknown, field: string, minimum = 1): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new SyncEngineError('INVALID_INPUT', `${field} 必须是安全整数。`);
  }
  return value as number;
}

export function repeatRule(value: unknown): RepeatRule {
  const rule = object(value, 'repeatRule');
  fields(rule, ['frequency', 'interval']);
  const frequency = choice(rule.frequency, ['none', 'daily', 'weekly'], 'repeatRule.frequency');
  const interval = revision(rule.interval, 'repeatRule.interval');
  if (interval > 52 || (frequency === 'none' && interval !== 1)) {
    throw new SyncEngineError('INVALID_INPUT', 'repeatRule.interval 无效。');
  }
  return { frequency, interval };
}

export function validateContext(context: RequestContext): void {
  requiredText(context.actorId, 'actorId');
  requiredText(context.subjectId, 'subjectId');
  if (context.deviceId !== undefined) requiredText(context.deviceId, 'deviceId');
}

export async function authorizeOrThrow(authorizer: ObjectAuthorizer, context: RequestContext, action: AccessAction, entityType: EntityType, entityId: string, ownerId: string): Promise<void> {
  validateContext(context);
  if (context.subjectId !== ownerId) throw new SyncEngineError('FORBIDDEN', 'subject 与对象 owner 不一致。');
  if (!await authorizer.authorize({ actorId: context.actorId, subjectId: context.subjectId, entityType, entityId, ownerId, action })) {
    throw new SyncEngineError('FORBIDDEN', '当前 actor 没有该对象权限。');
  }
}

function canonical(value: unknown, seen: Set<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || seen.has(value)) {
    throw new SyncEngineError('INVALID_INPUT', 'mutation 必须包含无环 JSON 数据。');
  }
  seen.add(value);
  let result: unknown;
  if (Array.isArray(value)) {
    result = value.map(item => canonical(item, seen));
  } else {
    const record = object(value, 'patch');
    result = Object.fromEntries(Object.keys(record).sort().filter(key => record[key] !== undefined)
      .map(key => [key, canonical(record[key], seen)]));
  }
  seen.delete(value);
  return result;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonical(value, new Set()));
}

export function normalizeMutation(mutation: SyncMutation): SyncMutation {
  object(mutation, 'mutation');
  requiredText(mutation.mutationId, 'mutationId');
  requiredText(mutation.ownerId, 'ownerId');
  requiredText(mutation.entityId, 'entityId');
  choice(mutation.entityType, ['note', 'todo'], 'entityType');
  choice(mutation.operation, ['create', 'update', 'delete'], 'operation');
  revision(mutation.baseVersion, 'baseVersion', 0);
  const patch = object(mutation.patch, 'patch');
  if (mutation.operation === 'create' && mutation.baseVersion !== 0) {
    throw new SyncEngineError('INVALID_INPUT', 'create 的 baseVersion 必须为 0。');
  }
  if (mutation.operation === 'delete' && Object.keys(patch).length !== 0) {
    throw new SyncEngineError('INVALID_INPUT', 'delete 不接受 patch。');
  }
  return { ...mutation, patch: JSON.parse(canonicalJson(patch)) as Record<string, unknown>, createdAt: instant(mutation.createdAt, 'createdAt') };
}

export function fingerprint(mutation: SyncMutation): string {
  const { createdAt, ...intent } = mutation;
  return canonicalJson(intent);
}
