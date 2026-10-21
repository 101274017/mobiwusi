const accountPattern = /^[a-z0-9-]{1,64}$/;
const reminderPattern = /^[a-z0-9-]{1,64}$/;
const instancePattern = /^[a-z0-9-]{1,80}$/;
const deepLinkPattern = /^nuanban:\/\/(?:review|todo)\/[a-z0-9-]{1,64}$/;
const permissionStates = new Set(['unknown', 'granted', 'denied', 'unsupported']);

const notificationTitle = '微光指引提醒';
const notificationBody = '有一项提醒到期，请打开微光指引查看。';

function errorWithCode(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeReminder(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw errorWithCode('INVALID_REMINDER', 'reminder must be an object');
  if (!accountPattern.test(input.accountId) || !reminderPattern.test(input.reminderId)) throw errorWithCode('INVALID_REMINDER', 'accountId and reminderId are invalid');
  if (!instancePattern.test(input.instanceId) || !Number.isSafeInteger(input.scheduleVersion) || input.scheduleVersion < 1) throw errorWithCode('INVALID_REMINDER', 'instanceId or scheduleVersion is invalid');
  if (!deepLinkPattern.test(input.deepLink)) throw errorWithCode('INVALID_REMINDER', 'deepLink must be an internal link');
  return {
    accountId: input.accountId,
    reminderId: input.reminderId,
    instanceId: input.instanceId,
    scheduleVersion: input.scheduleVersion,
    deepLink: input.deepLink,
  };
}

function reminderKey(reminder) {
  return `${reminder.accountId}:${reminder.reminderId}:${reminder.instanceId}`;
}

function reminderFingerprint(reminder) {
  return JSON.stringify({
    accountId: reminder.accountId,
    reminderId: reminder.reminderId,
    instanceId: reminder.instanceId,
    scheduleVersion: reminder.scheduleVersion,
    deepLink: reminder.deepLink,
  });
}

function notifyObserver(observer, event) {
  try {
    const result = observer(event);
    if (result && typeof result.then === 'function') result.catch(() => undefined);
  } catch {
    return undefined;
  }
  return undefined;
}

function createDesktopNotificationAdapter(options = {}) {
  const Notification = options.Notification;
  const getPermission = typeof options.getPermission === 'function'
    ? options.getPermission
    : () => options.permission ?? 'unknown';
  const onReceipt = typeof options.onReceipt === 'function' ? options.onReceipt : () => undefined;
  const onOpen = typeof options.onOpen === 'function' ? options.onOpen : () => undefined;
  const clock = typeof options.clock === 'function' ? options.clock : () => new Date();
  const active = new Map();

  function capability() {
    if (typeof Notification !== 'function' || typeof Notification.isSupported !== 'function') {
      return { capability: 'unsupported', permission: 'unsupported', reason: 'electron_notification_api_unavailable' };
    }
    let supported = false;
    try { supported = Notification.isSupported() === true; } catch { supported = false; }
    if (!supported) return { capability: 'unsupported', permission: 'unsupported', reason: 'electron_notification_unsupported' };
    let permission = 'unknown';
    try { permission = getPermission(); } catch { permission = 'unknown'; }
    if (!permissionStates.has(permission)) return { capability: 'unsupported', permission: 'unknown', reason: 'notification_permission_unknown' };
    if (permission !== 'granted') return { capability: 'unsupported', permission, reason: `notification_permission_${permission}` };
    return { capability: 'system', permission: 'granted', reason: null };
  }

  function observedAt() {
    const value = clock();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw errorWithCode('INVALID_CLOCK', 'clock must return a valid date');
    return date.toISOString();
  }

  function submit(input) {
    const reminder = normalizeReminder(input);
    const readiness = capability();
    if (readiness.capability !== 'system') return { status: 'unsupported', instanceId: reminder.instanceId, reason: readiness.reason };

    const key = reminderKey(reminder);
    const fingerprint = reminderFingerprint(reminder);
    const previous = active.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw errorWithCode('SCHEDULE_CONFLICT', 'same reminder instance has different content');
      return { status: 'idempotent', instanceId: reminder.instanceId };
    }

    const receiptBase = {
      accountId: reminder.accountId,
      reminderId: reminder.reminderId,
      instanceId: reminder.instanceId,
      scheduleVersion: reminder.scheduleVersion,
    };
    const emitted = new Set();
    let opened = false;
    const emitReceipt = state => {
      if (emitted.has(state)) return;
      emitted.add(state);
      let timestamp;
      try { timestamp = observedAt(); } catch { return; }
      notifyObserver(onReceipt, { ...receiptBase, state, observedAt: timestamp });
    };
    const emitOpen = () => notifyObserver(onOpen, { ...receiptBase, deepLink: reminder.deepLink });
    let notification;
    try {
      notification = new Notification({
        title: notificationTitle,
        body: notificationBody,
        silent: false,
        tag: `nuanban-reminder-${reminder.instanceId}`,
      });
      if (!notification || typeof notification.on !== 'function' || typeof notification.show !== 'function') throw errorWithCode('INVALID_NOTIFICATION', 'Electron Notification instance is incomplete');
      notification.on('show', () => emitReceipt('delivered'));
      notification.on('click', () => {
        if (opened) return;
        opened = true;
        emitReceipt('opened');
        emitOpen();
      });
      notification.on('failed', () => {
        emitReceipt('failed');
        active.delete(key);
      });
      notification.on('close', () => active.delete(key));
      active.set(key, { fingerprint, notification });
      emitReceipt('submitted');
      notification.show();
      return { status: 'submitted', instanceId: reminder.instanceId };
    } catch {
      active.delete(key);
      emitReceipt('failed');
      return { status: 'failed', instanceId: reminder.instanceId, reason: 'notification_failed' };
    }
  }

  function dispose() {
    for (const { notification } of active.values()) {
      try { notification.close(); } catch { }
    }
    active.clear();
  }

  return Object.freeze({ capability, submit, dispose, activeCount: () => active.size });
}

module.exports = { createDesktopNotificationAdapter, notificationTitle, notificationBody };
