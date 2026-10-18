import { describe, expect, it } from 'vitest';
import Ajv from 'ajv/dist/2020.js';
import { bridgeSchema, androidBridgeReplySchema, isBridgeMessage, isAndroidBridgeReply } from '@nuanban/contracts';
import { contractFormats, validInstant } from '../../packages/contracts/src/formats';

const ajv = new Ajv({ strict: true });
const request = ajv.compile(bridgeSchema);
const reply = ajv.compile(androidBridgeReplySchema);
const valid = { version: 1, request_id: 'synthetic-request', generation: 2147483648, method: 'capabilities' };
const todoId = '00000000-0000-4000-8000-000000000001';
const instanceId = '00000000-0000-4000-8000-000000000002';
const schedule = {
  version: 1,
  request_id: 'synthetic-schedule',
  generation: 0,
  method: 'reminder_schedule',
  account_id: 'demo-owner',
  reminder_id: 'todo-1',
  todo_id: todoId,
  instance_id: instanceId,
  schedule_version: 1,
  due_at: '2026-10-20T01:00:00.000Z',
  timezone: 'Asia/Shanghai',
  deep_link: '/todos/edit/todo-1',
  repeat_rule: 'none',
  channel: 'local',
  payload: { kind: 'review-reminder' },
  updated_at: '2026-10-16T01:00:00.000Z',
};
const cancel = {
  version: 1,
  request_id: 'synthetic-cancel',
  generation: 0,
  method: 'reminder_cancel',
  account_id: 'demo-owner',
  reminder_id: 'todo-1',
  todo_id: todoId,
  instance_id: instanceId,
  schedule_version: 1,
  cancelled_at: schedule.updated_at,
};
const notifyDue = { version: 1, request_id: 'synthetic-notify', generation: 0, method: 'reminder_notify_due', account_id: 'demo-owner', reminder_id: 'todo-1', now: '2026-10-20T01:00:00.000Z' };
describe('活动桥协议独立于未来宽桥草案', () => {
  it.each([valid, { ...valid, method: 'stop_all' }, schedule, cancel, notifyDue, { ...valid, generation: Number.MAX_SAFE_INTEGER }, { ...valid, generation: Number.MAX_SAFE_INTEGER + 1 }, { ...valid, generation: -1 }, { ...valid, generation: 0.5 }, { ...valid, generation: '1' }, { ...valid, version: '1' }, { ...valid, request_id: 'synthetic\n' }, { ...valid, request_id: ' ' }, { ...valid, request_id: 'x'.repeat(129) }, { ...schedule, payload: { kind: 'unknown' } }, { ...schedule, method: 'reminder_unknown' }, { ...schedule, granted: true }, null])('请求守卫与 Schema 逐例一致：%j', value => {
    expect(isBridgeMessage(value)).toBe(request(value));
  });
  it('回复严格保持高风险能力关闭，并与请求方法对应', () => {
    const capabilities = { request_id: valid.request_id, generation: valid.generation, platform: 'android', externalCapture: false, nativeOverlay: false, remoteMedia: false, status: 'native-skeleton' };
    const stopped = { request_id: valid.request_id, generation: 1, stopped: true, captureActive: false };
    const scheduled = { request_id: schedule.request_id, generation: schedule.generation, outcome: 'created', status: 'unsupported', reason: 'permission_unknown' };
    const cancelled = { request_id: cancel.request_id, generation: cancel.generation, status: 'cancelled', reason: 'cancelled' };
    const due = { request_id: notifyDue.request_id, generation: notifyDue.generation, status: 'submitted', reason: 'submitted' };
    for (const [value, method] of [[capabilities, 'capabilities'], [stopped, 'stop_all'], [scheduled, 'reminder_schedule'], [cancelled, 'reminder_cancel'], [due, 'reminder_notify_due']] as const) expect(isAndroidBridgeReply(value, method)).toBe(reply(value));
    for (const [value, method] of [[{ ...capabilities, externalCapture: true }, 'capabilities'], [{ ...capabilities, granted: true }, 'capabilities'], [{ ...stopped, captureActive: true }, 'stop_all'], [{ ...scheduled, status: 'scheduled', extra: true }, 'reminder_schedule'], [{ ...cancelled, status: 'sent' }, 'reminder_cancel'], [{ ...due, generation: '0' }, 'reminder_notify_due']] as const) expect(isAndroidBridgeReply(value, method)).toBe(false);
    expect(isAndroidBridgeReply(stopped, 'capabilities')).toBe(false);
    expect(isAndroidBridgeReply(capabilities, 'stop_all')).toBe(false);
  });
  it('标识与时间格式不能借末尾换行绕过完整匹配', () => {
    const identifier = '00000000-0000-4000-8000-000000000001';
    expect(contractFormats.uuid(identifier)).toBe(true);
    expect(contractFormats.uuid(identifier + '\n')).toBe(false);
    expect(validInstant('2026-10-15T01:00:00Z\n')).toBe(false);
  });
});
