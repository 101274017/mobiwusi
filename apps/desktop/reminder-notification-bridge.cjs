const { createDesktopNotificationAdapter } = require('./notification-adapter.cjs');

const accountPattern = /^[a-z0-9-]{1,64}$/;
const reminderPattern = /^[a-z0-9-]{1,64}$/;
const instancePattern = /^[a-z0-9-]{1,80}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

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

function normalizeDueInput(input, clock) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw errorWithCode('INVALID_NOTIFY_REQUEST', 'notify request must be an object');
  if (!matches(accountPattern, input.accountId) || !matches(reminderPattern, input.reminderId)) throw errorWithCode('INVALID_NOTIFY_REQUEST', 'accountId and reminderId are invalid');
  if (input.instanceId !== undefined && (!matches(instancePattern, input.instanceId) || !Number.isSafeInteger(input.scheduleVersion) || input.scheduleVersion < 1)) throw errorWithCode('INVALID_NOTIFY_REQUEST', 'instanceId and scheduleVersion are invalid');
  const nowValue = input.now ?? clock();
  const now = nowValue instanceof Date ? nowValue.toISOString() : nowValue;
  if (!validTimestamp(now)) throw errorWithCode('INVALID_NOTIFY_REQUEST', 'now is invalid');
  return { accountId: input.accountId, reminderId: input.reminderId, now, instanceId: input.instanceId, scheduleVersion: input.scheduleVersion };
}

function createDesktopReminderNotificationBridge(options = {}) {
  const store = options.store;
  if (!store || typeof store.read !== 'function' || typeof store.submitDue !== 'function' || typeof store.recordReceipt !== 'function') throw new TypeError('store is incomplete');
  const clock = typeof options.clock === 'function' ? options.clock : () => new Date();
  const sendOpen = typeof options.sendOpen === 'function' ? options.sendOpen : () => undefined;
  const adapter = createDesktopNotificationAdapter({
    Notification: options.Notification,
    getPermission: options.getPermission,
    clock,
    onReceipt: event => {
      try {
        store.recordReceipt({ accountId: event.accountId, reminderId: event.reminderId, instanceId: event.instanceId, scheduleVersion: event.scheduleVersion, state: event.state, observedAt: event.observedAt });
      } catch {
        return undefined;
      }
      return undefined;
    },
    onOpen: event => {
      try {
        const current = store.read(event.accountId, event.reminderId);
        if (!current || current.instanceId !== event.instanceId || current.scheduleVersion !== event.scheduleVersion || current.status !== 'opened') return;
        sendOpen({ accountId: event.accountId, reminderId: event.reminderId, instanceId: event.instanceId, deepLink: event.deepLink });
      } catch {
        return undefined;
      }
      return undefined;
    },
  });

  function notifyDue(input) {
    const request = normalizeDueInput(input, clock);
    const readiness = adapter.capability();
    if (readiness.capability !== 'system') return { status: 'unsupported', reason: readiness.reason };
    const existing = store.read(request.accountId, request.reminderId);
    if (!existing) return { status: 'not_found', reason: 'reminder_not_found' };
    if (request.instanceId !== undefined && (existing.instanceId !== request.instanceId || existing.scheduleVersion !== request.scheduleVersion)) {
      return { status: 'stale', instanceId: existing.instanceId, scheduleVersion: existing.scheduleVersion, reason: 'stale_schedule' };
    }
    if (existing.status !== 'scheduled') return { status: 'not_scheduled', instanceId: existing.instanceId, reason: existing.status };
    if (Date.parse(existing.dueAt) > Date.parse(request.now)) return { status: 'not_due', instanceId: existing.instanceId, reason: 'planned_at_in_future' };
    if (!store.submitDue({ accountId: request.accountId, reminderId: request.reminderId, now: request.now, instanceId: existing.instanceId, scheduleVersion: existing.scheduleVersion })) {
      const current = store.read(request.accountId, request.reminderId);
      if (!current) return { status: 'not_found', reason: 'reminder_not_found' };
      if (current.instanceId !== existing.instanceId || current.scheduleVersion !== existing.scheduleVersion) return { status: 'stale', instanceId: current.instanceId, scheduleVersion: current.scheduleVersion, reason: 'stale_schedule' };
      return { status: 'not_due', instanceId: current.instanceId, reason: current.status === 'scheduled' ? 'already_submitted_or_cancelled' : current.status };
    }
    return adapter.submit({
      accountId: existing.accountId,
      reminderId: existing.reminderId,
      instanceId: existing.instanceId,
      scheduleVersion: existing.scheduleVersion,
      deepLink: existing.deepLink,
    });
  }

  function dispose() {
    adapter.dispose();
  }

  return Object.freeze({ capability: adapter.capability, notifyDue, dispose, activeCount: adapter.activeCount });
}

module.exports = { createDesktopReminderNotificationBridge };
