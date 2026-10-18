export type ActiveBridgeMethod = 'capabilities' | 'stop_all' | 'reminder_schedule' | 'reminder_cancel' | 'reminder_notify_due';

export interface BridgeCorrelation {
  version: 1;
  request_id: string;
  generation: number;
}

export interface BridgeCapabilitiesMessage extends BridgeCorrelation { method: 'capabilities'; }
export interface BridgeStopMessage extends BridgeCorrelation { method: 'stop_all'; }
export interface BridgeReminderScheduleMessage extends BridgeCorrelation {
  method: 'reminder_schedule';
  account_id: string;
  reminder_id: string;
  todo_id: string;
  instance_id: string;
  schedule_version: number;
  due_at: string;
  timezone: string;
  deep_link: string;
  repeat_rule: 'none' | 'daily' | 'weekly';
  channel: 'local' | 'push';
  payload: { kind: 'review-reminder' };
  updated_at: string;
}
export interface BridgeReminderCancelMessage extends BridgeCorrelation {
  method: 'reminder_cancel';
  account_id: string;
  reminder_id: string;
  todo_id: string;
  instance_id: string;
  schedule_version: number;
  cancelled_at: string;
}
export interface BridgeReminderNotifyDueMessage extends BridgeCorrelation {
  method: 'reminder_notify_due';
  account_id: string;
  reminder_id: string;
  now: string;
}
export type BridgeMessage =
  | BridgeCapabilitiesMessage
  | BridgeStopMessage
  | BridgeReminderScheduleMessage
  | BridgeReminderCancelMessage
  | BridgeReminderNotifyDueMessage;

export interface AndroidCapabilitiesReply { request_id: string; generation: number; platform: 'android'; externalCapture: false; nativeOverlay: false; remoteMedia: false; status: 'native-skeleton'; }
export interface AndroidStopReply { request_id: string; generation: number; stopped: true; captureActive: false; }
export interface AndroidReminderScheduleReply { request_id: string; generation: number; outcome: 'created' | 'replaced' | 'idempotent'; status: 'scheduled' | 'unsupported'; reason: string; }
export interface AndroidReminderCancelReply { request_id: string; generation: number; status: 'cancelled' | 'unsupported'; reason: string; }
export interface AndroidReminderNotifyDueReply { request_id: string; generation: number; status: 'submitted' | 'not_due' | 'not_found' | 'not_scheduled' | 'unsupported'; reason: string; }
export interface AndroidBridgeErrorReply { request_id: string; generation: number; error_code: 'bridge_error' | 'storage_error' | 'scheduler_error'; message: string; }
export type AndroidBridgeReply = AndroidCapabilitiesReply | AndroidStopReply | AndroidReminderScheduleReply | AndroidReminderCancelReply | AndroidReminderNotifyDueReply | AndroidBridgeErrorReply;

const requestId = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\\s\\S])' } as const;
const generation = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } as const;
const uuid = { type: 'string', minLength: 36, maxLength: 36, pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}(?![\\s\\S])' } as const;
const identifier = { type: 'string', minLength: 1, maxLength: 80, pattern: '^[A-Za-z0-9-]{1,80}(?![\\s\\S])' } as const;
const account = { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-z0-9-]{1,64}(?![\\s\\S])' } as const;
const instant = { type: 'string', minLength: 20, maxLength: 24, pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{3})?Z(?![\\s\\S])' } as const;
const timezone = { type: 'string', minLength: 1, maxLength: 64, pattern: '^[A-Za-z_][A-Za-z0-9_+./-]{0,63}(?![\\s\\S])' } as const;
const deepLink = { type: 'string', minLength: 1, maxLength: 128, pattern: '^(?:nuanban://(?:review|todo)/[A-Za-z0-9-]{1,80}|/(?:review|todos)(?:/edit)?/[A-Za-z0-9-]{1,80})(?![\\s\\S])' } as const;
const payload = {
  type: 'object',
  additionalProperties: false,
  required: ['kind'],
  properties: { kind: { const: 'review-reminder' } },
} as const;
const correlation = { request_id: requestId, generation } as const;
const base = { version: { const: 1 }, ...correlation } as const;
const schedule = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'request_id', 'generation', 'method', 'account_id', 'reminder_id', 'todo_id', 'instance_id', 'schedule_version', 'due_at', 'timezone', 'deep_link', 'repeat_rule', 'channel', 'payload', 'updated_at'],
  properties: { ...base, method: { const: 'reminder_schedule' }, account_id: account, reminder_id: identifier, todo_id: uuid, instance_id: uuid, schedule_version: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, due_at: instant, timezone, deep_link: deepLink, repeat_rule: { enum: ['none', 'daily', 'weekly'] }, channel: { enum: ['local', 'push'] }, payload, updated_at: instant },
} as const;
const cancel = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'request_id', 'generation', 'method', 'account_id', 'reminder_id', 'todo_id', 'instance_id', 'schedule_version', 'cancelled_at'],
  properties: { ...base, method: { const: 'reminder_cancel' }, account_id: account, reminder_id: identifier, todo_id: uuid, instance_id: uuid, schedule_version: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, cancelled_at: instant },
} as const;
const notifyDue = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'request_id', 'generation', 'method', 'account_id', 'reminder_id', 'now'],
  properties: { ...base, method: { const: 'reminder_notify_due' }, account_id: account, reminder_id: identifier, now: instant },
} as const;
const capabilities = { type: 'object', additionalProperties: false, required: ['version', 'request_id', 'generation', 'method'], properties: { ...base, method: { const: 'capabilities' } } } as const;
const stopped = { type: 'object', additionalProperties: false, required: ['version', 'request_id', 'generation', 'method'], properties: { ...base, method: { const: 'stop_all' } } } as const;
const errorReply = { type: 'object', additionalProperties: false, required: ['request_id', 'generation', 'error_code', 'message'], properties: { ...correlation, error_code: { enum: ['bridge_error', 'storage_error', 'scheduler_error'] }, message: { type: 'string', minLength: 1, maxLength: 256 } } } as const;
const capabilitiesReply = { type: 'object', additionalProperties: false, required: ['request_id', 'generation', 'platform', 'externalCapture', 'nativeOverlay', 'remoteMedia', 'status'], properties: { ...correlation, platform: { const: 'android' }, externalCapture: { const: false }, nativeOverlay: { const: false }, remoteMedia: { const: false }, status: { const: 'native-skeleton' } } } as const;
const stoppedReply = { type: 'object', additionalProperties: false, required: ['request_id', 'generation', 'stopped', 'captureActive'], properties: { ...correlation, stopped: { const: true }, captureActive: { const: false } } } as const;
const scheduleReply = { type: 'object', additionalProperties: false, required: ['request_id', 'generation', 'outcome', 'status', 'reason'], properties: { ...correlation, outcome: { enum: ['created', 'replaced', 'idempotent'] }, status: { enum: ['scheduled', 'unsupported'] }, reason: { type: 'string', minLength: 1, maxLength: 256 } } } as const;
const cancelReply = { type: 'object', additionalProperties: false, required: ['request_id', 'generation', 'status', 'reason'], properties: { ...correlation, status: { enum: ['cancelled', 'unsupported'] }, reason: { type: 'string', minLength: 1, maxLength: 256 } } } as const;
const notifyDueReply = { type: 'object', additionalProperties: false, required: ['request_id', 'generation', 'status', 'reason'], properties: { ...correlation, status: { enum: ['submitted', 'not_due', 'not_found', 'not_scheduled', 'unsupported'] }, reason: { type: 'string', minLength: 1, maxLength: 256 } } } as const;

export const bridgeSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', oneOf: [capabilities, stopped, schedule, cancel, notifyDue] } as const;
export const androidBridgeReplySchema = { $schema: 'https://json-schema.org/draft/2020-12/schema', oneOf: [capabilitiesReply, stoppedReply, scheduleReply, cancelReply, notifyDueReply, errorReply] } as const;

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function exact(value: Record<string, unknown>, keys: readonly string[]): boolean { return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)); }
function matches(value: unknown, pattern: RegExp, maxLength: number): value is string { return typeof value === 'string' && value.length <= maxLength && pattern.test(value); }
function validUuid(value: unknown): value is string { return matches(value, /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}(?![\s\S])/, 36); }
function validIdentifier(value: unknown): value is string { return matches(value, /^[A-Za-z0-9-]{1,80}(?![\s\S])/, 80); }
function validAccount(value: unknown): value is string { return matches(value, /^[a-z0-9-]{1,64}(?![\s\S])/, 64); }
function validInstant(value: unknown): value is string { return matches(value, /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{3})?Z(?![\s\S])/, 24) && Number.isFinite(Date.parse(value)); }
function validDeepLink(value: unknown): value is string { return matches(value, /^(?:nuanban:\/\/(?:review|todo)\/[A-Za-z0-9-]{1,80}|\/(?:review|todos)(?:\/edit)?\/[A-Za-z0-9-]{1,80})(?![\s\S])/, 128); }
function correlated(value: Record<string, unknown>): boolean { return matches(value.request_id, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/, 128) && Number.isSafeInteger(value.generation) && (value.generation as number) >= 0 && (value.generation as number) <= Number.MAX_SAFE_INTEGER; }
function validPayload(value: unknown): boolean { return record(value) && exact(value, ['kind']) && value.kind === 'review-reminder'; }
function validSchedule(value: Record<string, unknown>): boolean {
  return exact(value, ['version', 'request_id', 'generation', 'method', 'account_id', 'reminder_id', 'todo_id', 'instance_id', 'schedule_version', 'due_at', 'timezone', 'deep_link', 'repeat_rule', 'channel', 'payload', 'updated_at'])
    && correlated(value) && value.version === 1 && value.method === 'reminder_schedule'
    && validAccount(value.account_id) && validIdentifier(value.reminder_id) && validUuid(value.todo_id) && validUuid(value.instance_id)
    && Number.isSafeInteger(value.schedule_version) && (value.schedule_version as number) >= 1 && (value.schedule_version as number) <= Number.MAX_SAFE_INTEGER
    && validInstant(value.due_at) && typeof value.timezone === 'string' && /^[A-Za-z_][A-Za-z0-9_+./-]{0,63}(?![\s\S])/.test(value.timezone) && validDeepLink(value.deep_link)
    && (value.repeat_rule === 'none' || value.repeat_rule === 'daily' || value.repeat_rule === 'weekly')
    && (value.channel === 'local' || value.channel === 'push') && validPayload(value.payload) && validInstant(value.updated_at);
}
function validCancel(value: Record<string, unknown>): boolean {
  return exact(value, ['version', 'request_id', 'generation', 'method', 'account_id', 'reminder_id', 'todo_id', 'instance_id', 'schedule_version', 'cancelled_at'])
    && correlated(value) && value.version === 1 && value.method === 'reminder_cancel' && validAccount(value.account_id) && validIdentifier(value.reminder_id)
    && validUuid(value.todo_id) && validUuid(value.instance_id) && Number.isSafeInteger(value.schedule_version) && (value.schedule_version as number) >= 1 && (value.schedule_version as number) <= Number.MAX_SAFE_INTEGER && validInstant(value.cancelled_at);
}
function validNotifyDue(value: Record<string, unknown>): boolean {
  return exact(value, ['version', 'request_id', 'generation', 'method', 'account_id', 'reminder_id', 'now'])
    && correlated(value) && value.version === 1 && value.method === 'reminder_notify_due' && validAccount(value.account_id) && validIdentifier(value.reminder_id) && validInstant(value.now);
}
export function isBridgeMessage(value: unknown): value is BridgeMessage {
  if (!record(value) || !correlated(value) || value.version !== 1 || typeof value.method !== 'string') return false;
  if (value.method === 'capabilities') return exact(value, ['version', 'request_id', 'generation', 'method']);
  if (value.method === 'stop_all') return exact(value, ['version', 'request_id', 'generation', 'method']);
  if (value.method === 'reminder_schedule') return validSchedule(value);
  if (value.method === 'reminder_cancel') return validCancel(value);
  if (value.method === 'reminder_notify_due') return validNotifyDue(value);
  return false;
}
function validErrorReply(value: Record<string, unknown>): boolean { return exact(value, ['request_id', 'generation', 'error_code', 'message']) && correlated(value) && (value.error_code === 'bridge_error' || value.error_code === 'storage_error' || value.error_code === 'scheduler_error') && typeof value.message === 'string' && value.message.length >= 1 && value.message.length <= 256; }
function validReason(value: unknown): value is string { return typeof value === 'string' && value.length >= 1 && value.length <= 256; }
export function isAndroidBridgeReply(value: unknown, method: ActiveBridgeMethod): value is AndroidBridgeReply {
  if (!record(value) || !correlated(value)) return false;
  if (validErrorReply(value)) return method === 'reminder_schedule' || method === 'reminder_cancel' || method === 'reminder_notify_due';
  if (method === 'capabilities') return exact(value, ['request_id', 'generation', 'platform', 'externalCapture', 'nativeOverlay', 'remoteMedia', 'status']) && value.platform === 'android' && value.externalCapture === false && value.nativeOverlay === false && value.remoteMedia === false && value.status === 'native-skeleton';
  if (method === 'stop_all') return exact(value, ['request_id', 'generation', 'stopped', 'captureActive']) && value.stopped === true && value.captureActive === false;
  if (method === 'reminder_schedule') return exact(value, ['request_id', 'generation', 'outcome', 'status', 'reason']) && (value.outcome === 'created' || value.outcome === 'replaced' || value.outcome === 'idempotent') && (value.status === 'scheduled' || value.status === 'unsupported') && validReason(value.reason);
  if (method === 'reminder_cancel') return exact(value, ['request_id', 'generation', 'status', 'reason']) && (value.status === 'cancelled' || value.status === 'unsupported') && validReason(value.reason);
  return exact(value, ['request_id', 'generation', 'status', 'reason']) && (value.status === 'submitted' || value.status === 'not_due' || value.status === 'not_found' || value.status === 'not_scheduled' || value.status === 'unsupported') && validReason(value.reason);
}
