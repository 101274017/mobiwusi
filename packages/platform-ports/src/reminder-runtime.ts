import { deriveReminderInstanceId, type ReminderChannel, type ReminderRepeat } from '@nuanban/reminder-engine';
import type { PlatformPort, ReminderPlatformResult, ReminderScheduleRequest } from './index';

export interface ReminderRuntimeTodo {
  id: string;
  title: string;
  dueAt: string;
  timezone: string;
  noteId: string | null;
  repeat: ReminderRepeat;
  version: number;
  completedAt: string | null;
  deletedAt: string | null;
}

export interface ReminderRuntimeDueEvent {
  todo: ReminderRuntimeTodo;
  request: ReminderScheduleRequest;
  result: ReminderPlatformResult;
}

export interface ReminderRuntimeFailure {
  todoId: string;
  phase: 'schedule' | 'cancel';
  error: unknown;
}

export interface ReminderRuntimeOptions {
  clock?: () => Date;
  onDue?: (event: ReminderRuntimeDueEvent) => void;
  onError?: (failure: ReminderRuntimeFailure) => void;
}

export interface ReminderRuntimeReport {
  scheduled: number;
  unchanged: number;
  cancelled: number;
  due: number;
  failures: number;
}

export interface ReminderRuntimeStopReport {
  cancelled: number;
  failures: number;
  stopped: true;
}

interface Registration {
  todo: ReminderRuntimeTodo;
  request: ReminderScheduleRequest;
  fingerprint: string;
  result: ReminderPlatformResult;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function errorValue(value: unknown): unknown {
  return value instanceof Error ? value : new Error(String(value));
}

async function fallbackReminderInstanceId(todoId: string, scheduleRevision: number, plannedAt: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('当前运行环境没有可用的 Web Crypto，不能生成稳定提醒实例。');
  const seed = new TextEncoder().encode(`nuanban:demo-reminder:${todoId}:${scheduleRevision}:${plannedAt}`);
  const digest = new Uint8Array(await subtle.digest('SHA-256', seed));
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function stableReminderInstanceId(todoId: string, scheduleRevision: number, plannedAt: string): Promise<string> {
  if (uuid.test(todoId)) return deriveReminderInstanceId(todoId, scheduleRevision, plannedAt);
  return fallbackReminderInstanceId(todoId, scheduleRevision, plannedAt);
}

function reminderDeepLink(todo: ReminderRuntimeTodo): string {
  return todo.noteId ? `/review/${todo.noteId}` : `/todos/edit/${todo.id}`;
}

function requestFingerprint(request: ReminderScheduleRequest): string {
  return JSON.stringify({
    accountId: request.accountId,
    todoId: request.todoId,
    instanceId: request.instanceId,
    plannedAt: request.plannedAt,
    timezone: request.timezone,
    scheduleRevision: request.scheduleRevision,
    deepLink: request.deepLink,
    repeat: request.repeat,
    channel: request.channel,
  });
}

function cancelRequest(request: ReminderScheduleRequest): Pick<ReminderScheduleRequest, 'instanceId' | 'scheduleRevision' | 'accountId' | 'todoId'> {
  return { accountId: request.accountId, todoId: request.todoId, instanceId: request.instanceId, scheduleRevision: request.scheduleRevision };
}

export class ReminderRuntime {
  private readonly registrations = new Map<string, Registration>();
  private readonly fired = new Set<string>();
  private readonly clock: () => Date;
  private readonly onDue: (event: ReminderRuntimeDueEvent) => void;
  private readonly onError: (failure: ReminderRuntimeFailure) => void;
  private queue = Promise.resolve();
  private stopped = false;

  constructor(private readonly ownerId: string, private readonly platform: PlatformPort, options: ReminderRuntimeOptions = {}) {
    if (!ownerId || !platform || typeof platform.scheduleReminder !== 'function' || typeof platform.cancelReminder !== 'function') throw new Error('提醒运行时端口不完整。');
    this.clock = options.clock ?? (() => new Date());
    this.onDue = options.onDue ?? (() => undefined);
    this.onError = options.onError ?? (() => undefined);
  }

  sync(todos: readonly ReminderRuntimeTodo[], now = this.clock()): Promise<ReminderRuntimeReport> {
    return this.enqueue(async () => {
      if (this.stopped) return { scheduled: 0, unchanged: 0, cancelled: 0, due: 0, failures: 0 };
      if (!validDate(now)) throw new Error('提醒运行时的当前时间无效。');
      const desired = new Map<string, { todo: ReminderRuntimeTodo; request: ReminderScheduleRequest; fingerprint: string }>();
      let failures = 0;
      for (const todo of todos) {
        if (todo.deletedAt || todo.completedAt) continue;
        try {
          const plannedAt = new Date(todo.dueAt);
          if (!validDate(plannedAt)) throw new Error('提醒时间无效。');
          const canonicalPlannedAt = plannedAt.toISOString();
          const request: ReminderScheduleRequest = {
            accountId: this.ownerId,
            todoId: todo.id,
            instanceId: await stableReminderInstanceId(todo.id, todo.version, canonicalPlannedAt),
            plannedAt: canonicalPlannedAt,
            timezone: todo.timezone,
            scheduleRevision: todo.version,
            deepLink: reminderDeepLink(todo),
            repeat: todo.repeat,
            channel: 'local' satisfies ReminderChannel,
          };
          desired.set(todo.id, { todo, request, fingerprint: requestFingerprint(request) });
        } catch (error) {
          failures += 1;
          this.onError({ todoId: todo.id, phase: 'schedule', error: errorValue(error) });
        }
      }

      let cancelled = 0;
      const blocked = new Set<string>();
      for (const [todoId, registration] of this.registrations) {
        const next = desired.get(todoId);
        if (!next || next.fingerprint !== registration.fingerprint) {
          try {
            await this.platform.cancelReminder(cancelRequest(registration.request));
            this.registrations.delete(todoId);
            this.fired.delete(`${todoId}:${registration.request.instanceId}`);
            cancelled += 1;
          } catch (error) {
            failures += 1;
            blocked.add(todoId);
            this.onError({ todoId, phase: 'cancel', error: errorValue(error) });
          }
        }
      }

      let scheduled = 0;
      let unchanged = 0;
      let due = 0;
      for (const [todoId, next] of desired) {
        if (blocked.has(todoId)) continue;
        const current = this.registrations.get(todoId);
        if (current && current.fingerprint === next.fingerprint) {
          current.todo = next.todo;
          unchanged += 1;
          if (Date.parse(next.request.plannedAt) <= now.getTime()) due += this.emitDue(current);
          continue;
        }
        try {
          const result = await this.platform.scheduleReminder(next.request);
          this.registrations.set(todoId, { ...next, result });
          scheduled += 1;
          if (Date.parse(next.request.plannedAt) <= now.getTime()) due += this.emitDue(this.registrations.get(todoId)!);
        } catch (error) {
          failures += 1;
          this.onError({ todoId, phase: 'schedule', error: errorValue(error) });
        }
      }
      return { scheduled, unchanged, cancelled, due, failures };
    });
  }

  stop(): Promise<ReminderRuntimeStopReport> {
    return this.enqueue(async () => {
      if (this.stopped) return { cancelled: 0, failures: 0, stopped: true };
      this.stopped = true;
      let cancelled = 0;
      let failures = 0;
      for (const [todoId, registration] of this.registrations) {
        try {
          await this.platform.cancelReminder(cancelRequest(registration.request));
          this.registrations.delete(todoId);
          cancelled += 1;
        } catch (error) {
          failures += 1;
          this.onError({ todoId, phase: 'cancel', error: errorValue(error) });
        }
      }
      return { cancelled, failures, stopped: true };
    });
  }

  snapshot(): { registered: number; stopped: boolean } {
    return { registered: this.registrations.size, stopped: this.stopped };
  }

  private emitDue(registration: Registration): number {
    const key = `${registration.todo.id}:${registration.request.instanceId}`;
    if (this.fired.has(key)) return 0;
    this.fired.add(key);
    this.onDue({ todo: registration.todo, request: registration.request, result: registration.result });
    return 1;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation);
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }
}
