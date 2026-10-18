import { isBridgeMessage, isAndroidBridgeReply, type ActiveBridgeMethod } from '@nuanban/contracts';
import type { NativeHostBridge, NativeReminderStoreBridge } from './index';

export interface AndroidMessageChannel {
  postMessage(message: string): void;
  onmessage?: ((event: { data: unknown }) => void) | null;
}
export interface AndroidHostEnvironment {
  channel: AndroidMessageChannel;
  origin: string;
  mainFrame: boolean;
  lifecycle?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  requestId?: () => string;
  timeoutMs?: number;
}
export interface AndroidHostBridge extends NativeHostBridge { dispose(): void; }
interface PendingRequest { generation: number; method: ActiveBridgeMethod; resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout>; }
type AndroidScheduleInput = Parameters<NativeReminderStoreBridge['schedule']>[0];
type AndroidCancelInput = Parameters<NativeReminderStoreBridge['cancel']>[0];
type AndroidNotifyDueInput = Parameters<NativeReminderStoreBridge['notifyDue']>[0];

class MessageHost implements AndroidHostBridge {
  readonly platform = 'android' as const;
  readonly reminderStore: NativeReminderStoreBridge;
  private generation = 0;
  private disposed = false;
  private stopping: Promise<unknown> | null = null;
  private stopRequested = false;
  private stopFailed = false;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly issuedIds = new Set<string>();
  private readonly timeoutMs: number;
  private readonly previousHandler: AndroidMessageChannel['onmessage'];
  constructor(private readonly environment: AndroidHostEnvironment) {
    this.timeoutMs = Number.isFinite(environment.timeoutMs) && environment.timeoutMs! >= 1 && environment.timeoutMs! <= 30000 ? environment.timeoutMs! : 3000;
    this.previousHandler = environment.channel.onmessage;
    this.reminderStore = Object.freeze({
      schedule: (input: AndroidScheduleInput) => this.request('reminder_schedule', {
        account_id: input.accountId,
        reminder_id: input.reminderId,
        todo_id: input.todoId,
        instance_id: input.instanceId,
        schedule_version: input.scheduleVersion,
        due_at: input.dueAt,
        timezone: input.timezone,
        deep_link: input.deepLink,
        repeat_rule: input.repeatRule,
        channel: input.channel,
        payload: { kind: 'review-reminder' },
        updated_at: input.updatedAt,
      }),
      cancel: (input: AndroidCancelInput) => this.request('reminder_cancel', {
        account_id: input.accountId,
        reminder_id: input.reminderId,
        todo_id: input.todoId,
        instance_id: input.instanceId,
        schedule_version: input.scheduleVersion,
        cancelled_at: input.cancelledAt,
      }),
      notifyDue: (input: AndroidNotifyDueInput) => this.request('reminder_notify_due', {
        account_id: input.accountId,
        reminder_id: input.reminderId,
        now: input.now,
      }),
    });
    let messageInstalled = false;
    try {
      environment.channel.onmessage = this.receive;
      messageInstalled = true;
      environment.lifecycle?.addEventListener('pagehide', this.dispose);
    } catch (error) {
      try { environment.lifecycle?.removeEventListener('pagehide', this.dispose); } catch { }
      if (messageInstalled && environment.channel.onmessage === this.receive) {
        try { environment.channel.onmessage = this.previousHandler; } catch { }
      }
      throw error;
    }
  }
  capabilities(): Promise<unknown> { return this.request('capabilities'); }
  stopAll(): Promise<unknown> {
    if (this.stopping) return this.stopping;
    if (this.disposed || this.generation >= Number.MAX_SAFE_INTEGER) return Promise.reject(new Error('Native bridge unavailable'));
    this.stopRequested = true;
    this.generation += 1;
    this.rejectPending('Native request cancelled by stop');
    let resolveStop!: (value: unknown) => void;
    let rejectStop!: (error: unknown) => void;
    const stopPromise = new Promise<unknown>((resolve, reject) => {
      resolveStop = resolve;
      rejectStop = reject;
    });
    this.stopping = stopPromise;
    void this.request('stop_all', {}, true).then(
      value => {
        if (this.stopping === stopPromise) {
          this.stopping = null;
          this.stopRequested = false;
          this.stopFailed = false;
        }
        resolveStop(value);
      },
      error => {
        if (this.stopping === stopPromise) {
          this.stopping = null;
          this.stopRequested = false;
          this.stopFailed = true;
        }
        rejectStop(error);
      },
    );
    return stopPromise;
  }
  private request(method: ActiveBridgeMethod, fields: Record<string, unknown> = {}, allowDuringStop = false): Promise<unknown> {
    if (this.disposed || this.pending.size >= 8) return Promise.reject(new Error('Native bridge unavailable'));
    if (this.stopRequested && !allowDuringStop) return Promise.reject(new Error('Native bridge stopping'));
    if (this.stopFailed && !allowDuringStop) return Promise.reject(new Error('Native bridge cleanup failed'));
    return new Promise((resolve, reject) => {
      let requestId: string;
      try { requestId = (this.environment.requestId ?? (() => crypto.randomUUID()))(); }
      catch { reject(new Error('Native request ID unavailable')); return; }
      const message = { version: 1, request_id: requestId, generation: this.generation, method, ...fields };
      if (!isBridgeMessage(message) || this.issuedIds.has(requestId)) { reject(new Error('Invalid native request correlation')); return; }
      this.issuedIds.add(requestId);
      const timer = setTimeout(() => this.fail(requestId, 'Native bridge timeout'), this.timeoutMs);
      this.pending.set(requestId, { generation: this.generation, method, resolve, reject, timer });
      try { this.environment.channel.postMessage(JSON.stringify(message)); }
      catch { this.fail(requestId, 'Native bridge send failed'); }
    });
  }
  private fail(requestId: string, message: string): void {
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);
    clearTimeout(pending.timer);
    pending.reject(new Error(message));
  }
  private rejectPending(message: string): void { for (const requestId of this.pending.keys()) this.fail(requestId, message); }
  private readonly receive = (event: { data: unknown }): void => {
    if (this.disposed || typeof event.data !== 'string' || event.data.length > 4096) return;
    let value: unknown;
    try { value = JSON.parse(event.data); } catch { return; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const response = value as Record<string, unknown>;
    const pending = typeof response.request_id === 'string' ? this.pending.get(response.request_id) : undefined;
    if (!pending || response.generation !== pending.generation) return;
    if (!isAndroidBridgeReply(response, pending.method)) { this.fail(response.request_id as string, 'Invalid native bridge reply'); return; }
    this.pending.delete(response.request_id as string);
    clearTimeout(pending.timer);
    if ('error_code' in response) pending.reject(new Error(typeof response.message === 'string' ? response.message : 'Native bridge request failed'));
    else pending.resolve(response);
  };
  readonly dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    this.rejectPending('Native bridge disposed');
    this.issuedIds.clear();
    if (this.environment.channel.onmessage === this.receive) this.environment.channel.onmessage = this.previousHandler;
    this.environment.lifecycle?.removeEventListener('pagehide', this.dispose);
  };
}

export function createAndroidMessageHost(environment: AndroidHostEnvironment): AndroidHostBridge | undefined {
  try {
    if (!environment || typeof environment !== 'object' || environment.origin !== 'https://appassets.androidplatform.net' || !environment.mainFrame || typeof environment.channel?.postMessage !== 'function' || environment.channel.onmessage != null) return undefined;
    if (environment.lifecycle && (typeof environment.lifecycle.addEventListener !== 'function' || typeof environment.lifecycle.removeEventListener !== 'function')) return undefined;
    return new MessageHost(environment);
  } catch { return undefined; }
}
