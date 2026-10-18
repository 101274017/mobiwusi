export type PermissionState = 'unknown' | 'granted' | 'denied' | 'restricted' | 'unsupported';
export interface Capabilities { platform: 'browser' | 'windows' | 'android'; externalCapture: false; remoteMedia: false; nativeOverlay: false; notifications: boolean; }
export interface ReminderScheduleRequest {
  accountId?: string;
  todoId: string;
  instanceId: string;
  plannedAt: string;
  timezone?: string;
  scheduleRevision: number;
  deepLink?: string;
  repeat?: 'none' | 'daily' | 'weekly';
  channel?: 'local' | 'push';
}
export type ReminderCancelRequest = Pick<ReminderScheduleRequest, 'instanceId' | 'scheduleRevision'> & Partial<Pick<ReminderScheduleRequest, 'accountId' | 'todoId'>>;
export interface ReminderPlatformResult { status: 'page_only' | 'unsupported'; reason: string; persisted?: boolean; nativeStatus?: string; }
export interface PlatformPort {
  capabilities: Capabilities;
  stopAll(): Promise<void>;
  requestNotification(): Promise<PermissionState>;
  scheduleReminder(request: ReminderScheduleRequest): Promise<ReminderPlatformResult>;
  cancelReminder(request: ReminderCancelRequest): Promise<ReminderPlatformResult>;
  notifyReminderDue?(request: ReminderScheduleRequest, now?: Date): Promise<ReminderPlatformResult>;
}
export interface NativeReminderStoreBridge {
  schedule(input: {
    accountId: string;
    reminderId: string;
    todoId: string;
    instanceId: string;
    scheduleVersion: number;
    dueAt: string;
    timezone: string;
    deepLink: string;
    repeatRule: 'none' | 'daily' | 'weekly';
    channel: 'local' | 'push';
    payload: Record<string, unknown>;
    updatedAt: string;
  }): Promise<unknown> | unknown;
  cancel(input: { accountId: string; reminderId: string; todoId: string; instanceId: string; scheduleVersion: number; cancelledAt: string }): Promise<unknown> | unknown;
  notifyDue(input: { accountId: string; reminderId: string; now: string }): Promise<unknown> | unknown;
}
export interface NativeHostBridge {
  platform: 'android' | 'windows';
  capabilities(): Promise<unknown>;
  stopAll(): Promise<unknown>;
  reminderStore?: NativeReminderStoreBridge;
}

export interface NativeStopResult {
  stopped: true;
  captureActive: false;
  mediaActive?: false;
}

function isNativeStopResult(value: unknown): value is NativeStopResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return result.stopped === true && result.captureActive === false && (result.mediaActive === undefined || result.mediaActive === false);
}

export type LifecyclePlatform = 'android' | 'windows';
export type LifecycleState = 'idle' | 'active' | 'stopping' | 'stopped' | 'cleanup_failed';
export type LifecycleSignal = 'user-stop' | 'permission-revoked' | 'lock' | 'process-terminated' | 'overlay-contamination' | 'window-moved' | 'recursive-capture' | 'renderer-gone';
export type LifecycleStopReason = 'user' | 'permission-revoked' | 'lock' | 'process-terminated' | 'overlay-contamination' | 'window-moved' | 'recursive-capture' | 'renderer-gone';

export interface LifecycleResources {
  closeOutlets(): Promise<void>;
  clearQueue(): Promise<void>;
  stopTrack(): Promise<void>;
  hideOverlay(): Promise<void>;
}

export interface LifecycleCleanupReport {
  noOp: boolean;
  platform: LifecyclePlatform;
  signal: LifecycleSignal | null;
  reason: LifecycleStopReason | null;
  generationBefore: number;
  generationAfter: number;
  order: string[];
  failedSteps: string[];
  outletClosed: boolean;
  generationInvalidated: boolean;
  queueCleared: boolean;
  trackStopped: boolean;
  overlayHidden: boolean;
  restartBlocked: boolean;
}

export interface LifecycleSnapshot {
  platform: LifecyclePlatform;
  state: LifecycleState;
  generation: number;
  outputAllowed: boolean;
  restartBlocked: boolean;
  lastSignal: LifecycleSignal | null;
  lastStopReason: LifecycleStopReason | null;
  cleanup: LifecycleCleanupReport | null;
}

const lifecycleReasons: Record<LifecycleSignal, LifecycleStopReason> = {
  'user-stop': 'user',
  'permission-revoked': 'permission-revoked',
  lock: 'lock',
  'process-terminated': 'process-terminated',
  'overlay-contamination': 'overlay-contamination',
  'window-moved': 'window-moved',
  'recursive-capture': 'recursive-capture',
  'renderer-gone': 'renderer-gone',
};

const lifecyclePlatforms = new Set<LifecyclePlatform>(['android', 'windows']);
const lifecycleStopReasons = new Set<LifecycleStopReason>(Object.values(lifecycleReasons));

function isLifecyclePlatform(value: unknown): value is LifecyclePlatform {
  return typeof value === 'string' && lifecyclePlatforms.has(value as LifecyclePlatform);
}

function isLifecycleSignal(value: unknown): value is LifecycleSignal {
  return typeof value === 'string' && Object.hasOwn(lifecycleReasons, value);
}

function isLifecycleStopReason(value: unknown): value is LifecycleStopReason {
  return typeof value === 'string' && lifecycleStopReasons.has(value as LifecycleStopReason);
}

function safeGeneration(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export class LifecycleCoordinator {
  private state: LifecycleState = 'idle';
  private generation = 0;
  private outputAllowed = false;
  private restartBlocked = false;
  private lastSignal: LifecycleSignal | null = null;
  private lastStopReason: LifecycleStopReason | null = null;
  private cleanup: LifecycleCleanupReport | null = null;
  private stopPromise: Promise<LifecycleCleanupReport> | null = null;

  constructor(private readonly platform: LifecyclePlatform, private readonly resources: LifecycleResources) {
    if (!isLifecyclePlatform(platform)) throw new Error('生命周期平台不受支持。');
    if (!resources || typeof resources.closeOutlets !== 'function' || typeof resources.clearQueue !== 'function' || typeof resources.stopTrack !== 'function' || typeof resources.hideOverlay !== 'function') {
      throw new Error('生命周期资源端口不完整。');
    }
  }

  start(generation: number): void {
    if (!safeGeneration(generation) || generation >= Number.MAX_SAFE_INTEGER || generation <= this.generation) throw new Error('生命周期代际必须是递增的安全整数。');
    if (this.state === 'active' || this.state === 'stopping') throw new Error('生命周期仍在运行或清理中。');
    if (this.restartBlocked) throw new Error('清理失败后禁止在当前进程重新开始。');
    this.generation = generation;
    this.state = 'active';
    this.outputAllowed = true;
    this.lastSignal = null;
    this.lastStopReason = null;
    this.cleanup = null;
  }

  canRelease(generation: number): boolean {
    return this.state === 'active' && this.outputAllowed && generation === this.generation;
  }

  async signal(signal: LifecycleSignal): Promise<LifecycleCleanupReport> {
    if (!isLifecycleSignal(signal)) throw new Error('未知生命周期信号。');
    return this.stop(lifecycleReasons[signal], signal);
  }

  async stop(reason: LifecycleStopReason = 'user', signal: LifecycleSignal | null = 'user-stop'): Promise<LifecycleCleanupReport> {
    if (this.stopPromise) return this.stopPromise;
    if (this.state === 'stopped' || this.state === 'cleanup_failed') {
      if (!this.cleanup) throw new Error('生命周期清理报告缺失。');
      return structuredClone(this.cleanup);
    }
    if (!isLifecycleStopReason(reason) || (signal !== null && !isLifecycleSignal(signal))) throw new Error('生命周期停止原因或信号无效。');
    if (signal !== null && lifecycleReasons[signal] !== reason) throw new Error('生命周期停止原因与信号不匹配。');
    if (this.state === 'idle') {
      const report: LifecycleCleanupReport = {
        noOp: true, platform: this.platform, signal: null, reason: null, generationBefore: this.generation, generationAfter: this.generation,
        order: [], failedSteps: [], outletClosed: false, generationInvalidated: false, queueCleared: false, trackStopped: false, overlayHidden: false, restartBlocked: false,
      };
      this.cleanup = report;
      return structuredClone(report);
    }
    this.state = 'stopping';
    this.outputAllowed = false;
    this.lastSignal = signal;
    this.lastStopReason = reason;
    const generationBefore = this.generation;
    const order: string[] = [];
    const failedSteps: string[] = [];
    let outletClosed = false;
    let queueCleared = false;
    let trackStopped = false;
    let overlayHidden = false;
    const run = async (name: string, action: () => Promise<void>): Promise<void> => {
      order.push(name);
      try { await action(); } catch { failedSteps.push(name); }
    };
    let resolveStop!: (report: LifecycleCleanupReport) => void;
    let rejectStop!: (error: unknown) => void;
    const stopPromise = new Promise<LifecycleCleanupReport>((resolve, reject) => {
      resolveStop = resolve;
      rejectStop = reject;
    });
    this.stopPromise = stopPromise;
    void (async () => {
      await run('close_outlets', () => this.resources.closeOutlets());
      this.generation += 1;
      order.push('invalidate_generation');
      await run('clear_queue', () => this.resources.clearQueue());
      queueCleared = !failedSteps.includes('clear_queue');
      await run('stop_track', () => this.resources.stopTrack());
      trackStopped = !failedSteps.includes('stop_track');
      await run('hide_overlay', () => this.resources.hideOverlay());
      overlayHidden = !failedSteps.includes('hide_overlay');
      outletClosed = !failedSteps.includes('close_outlets');
      this.restartBlocked = failedSteps.length > 0;
      this.state = this.restartBlocked ? 'cleanup_failed' : 'stopped';
      this.lastStopReason = reason;
      const report: LifecycleCleanupReport = {
        noOp: false, platform: this.platform, signal, reason, generationBefore, generationAfter: this.generation, order, failedSteps,
        outletClosed, generationInvalidated: true, queueCleared, trackStopped, overlayHidden, restartBlocked: this.restartBlocked,
      };
      this.cleanup = report;
      return report;
    })().then(resolveStop, error => {
      this.outputAllowed = false;
      this.restartBlocked = true;
      this.state = 'cleanup_failed';
      this.lastStopReason = reason;
      rejectStop(error);
    });
    try {
      const report = await stopPromise;
      return structuredClone(report);
    } finally {
      if (this.stopPromise === stopPromise) this.stopPromise = null;
    }
  }

  snapshot(): LifecycleSnapshot {
    return structuredClone({ platform: this.platform, state: this.state, generation: this.generation, outputAllowed: this.outputAllowed, restartBlocked: this.restartBlocked, lastSignal: this.lastSignal, lastStopReason: this.lastStopReason, cleanup: this.cleanup });
  }
}

function nativeCapabilities(platform: NativeHostBridge['platform']): Capabilities {
  return { platform, externalCapture: false, remoteMedia: false, nativeOverlay: false, notifications: false };
}

export class BrowserPlatform implements PlatformPort {
  capabilities: Capabilities = { platform:'browser', externalCapture:false,remoteMedia:false,nativeOverlay:false,notifications:typeof Notification !== 'undefined' };
  async stopAll(): Promise<void> { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }
  async requestNotification(): Promise<PermissionState> { if (typeof Notification === 'undefined') return 'unsupported'; const permission=await Notification.requestPermission();return permission==='default'?'unknown':permission; }
  async scheduleReminder(_request: ReminderScheduleRequest): Promise<ReminderPlatformResult> { return { status: 'page_only', reason: '浏览器演示只在页面运行时检查到期，不代表系统后台调度。' }; }
  async cancelReminder(_request: ReminderCancelRequest): Promise<ReminderPlatformResult> { return { status: 'page_only', reason: '浏览器演示只取消页面内提醒，不代表系统调度已撤销。' }; }
}

export class NativeHostPlatform implements PlatformPort {
  capabilities: Capabilities;
  private readonly reminderRegistrations = new Map<string, { accountId: string; reminderId: string; scheduleVersion: number }>();
  constructor(private readonly host: NativeHostBridge) {
    this.capabilities = nativeCapabilities(host.platform);
    void Promise.resolve().then(() => host.capabilities()).catch(() => undefined);
  }
  async stopAll(): Promise<void> {
    try {
      const result = await this.host.stopAll();
      if (!isNativeStopResult(result)) throw new Error('原生宿主未确认捕获和媒体均已停止。');
    } finally { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }
  }
  async requestNotification(): Promise<PermissionState> { return 'unsupported'; }
  async scheduleReminder(request: ReminderScheduleRequest): Promise<ReminderPlatformResult> {
    const store = this.host.reminderStore;
    if (!store) return { status: 'unsupported', reason: '原生通知能力尚未通过 C07/C08 设备与系统验证。' };
    const nativeRequest = nativeReminderRequest(request);
    const result = await store.schedule(nativeRequest);
    const outcome = nativeStoreOutcome(result);
    this.reminderRegistrations.set(request.instanceId, { accountId: nativeRequest.accountId, reminderId: nativeRequest.reminderId, scheduleVersion: nativeRequest.scheduleVersion });
    return { status: 'unsupported', persisted: true, nativeStatus: outcome, reason: '提醒已写入显式宿主本地仓储；系统通知权限、后台调度和真实回执仍未验证。' };
  }
  async cancelReminder(request: ReminderCancelRequest): Promise<ReminderPlatformResult> {
    const store = this.host.reminderStore;
    if (!store) return { status: 'unsupported', reason: '原生通知能力尚未通过 C07/C08 设备与系统验证。' };
    const registration = this.reminderRegistrations.get(request.instanceId);
    const accountId = request.accountId ?? registration?.accountId;
    const reminderId = request.todoId ?? registration?.reminderId;
    if (!accountId || !reminderId) return { status: 'unsupported', reason: '提醒取消缺少账号或待办标识，未触碰宿主仓储。' };
    await store.cancel({ accountId, reminderId, todoId: request.todoId ?? reminderId, instanceId: request.instanceId, scheduleVersion: request.scheduleRevision, cancelledAt: new Date().toISOString() });
    this.reminderRegistrations.delete(request.instanceId);
    return { status: 'unsupported', persisted: true, nativeStatus: 'cancelled', reason: '提醒已从显式宿主本地仓储取消；系统通知撤销仍需设备验证。' };
  }
  async notifyReminderDue(request: ReminderScheduleRequest, now = new Date()): Promise<ReminderPlatformResult> {
    const store = this.host.reminderStore;
    if (!store) return { status: 'unsupported', reason: '原生通知桥尚未通过 C07/C08 设备与系统验证。' };
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('提醒到期时间无效。');
    const registration = this.reminderRegistrations.get(request.instanceId);
    const accountId = request.accountId ?? registration?.accountId;
    const reminderId = request.todoId ?? registration?.reminderId;
    if (!accountId || !reminderId) return { status: 'unsupported', reason: '提醒派发缺少账号或待办标识，未触碰宿主通知桥。' };
    const result = await store.notifyDue({ accountId, reminderId, now: now.toISOString() });
    const nativeStatus = nativeStoreStatus(result);
    return { status: 'unsupported', persisted: nativeStatus === 'submitted', nativeStatus, reason: '已向显式宿主通知桥请求到期派发；系统权限、展示和真实回执仍未验证。' };
  }
}

function nativeReminderRequest(request: ReminderScheduleRequest): {
  accountId: string;
  reminderId: string;
  todoId: string;
  instanceId: string;
  scheduleVersion: number;
  dueAt: string;
  timezone: string;
  deepLink: string;
  repeatRule: 'none' | 'daily' | 'weekly';
  channel: 'local' | 'push';
  payload: Record<string, unknown>;
  updatedAt: string;
} {
  if (!request.accountId || !request.todoId || !request.timezone || !request.deepLink || !Number.isSafeInteger(request.scheduleRevision) || request.scheduleRevision < 1) {
    throw new Error('原生提醒请求缺少账号、待办、时区、深链或有效排程版本。');
  }
  const deepLink = request.deepLink.match(/^\/review\/([a-z0-9-]{1,64})$/i)?.[1]
    ? `nuanban://review/${request.deepLink.slice('/review/'.length)}`
    : request.deepLink.match(/^\/todos\/edit\/([a-z0-9-]{1,64})$/i)?.[1]
      ? `nuanban://todo/${request.deepLink.slice('/todos/edit/'.length)}`
      : null;
  if (!deepLink) throw new Error('原生提醒深链不在受限应用内路径白名单中。');
  if (!Number.isFinite(Date.parse(request.plannedAt))) throw new Error('原生提醒时间无效。');
  return {
    accountId: request.accountId,
    reminderId: request.todoId,
    todoId: request.todoId,
    instanceId: request.instanceId,
    scheduleVersion: request.scheduleRevision,
    dueAt: new Date(request.plannedAt).toISOString(),
    timezone: request.timezone,
    deepLink,
    repeatRule: request.repeat ?? 'none',
    channel: request.channel ?? 'local',
    payload: { kind: 'review-reminder', todoId: request.todoId },
    updatedAt: new Date().toISOString(),
  };
}

function nativeStoreOutcome(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('宿主提醒仓储返回值无效。');
  const outcome = (value as Record<string, unknown>).outcome;
  if (outcome !== 'created' && outcome !== 'replaced' && outcome !== 'idempotent') throw new Error('宿主提醒仓储未确认排程结果。');
  return outcome;
}

function nativeStoreStatus(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('宿主通知桥返回值无效。');
  const status = (value as Record<string, unknown>).status;
  if (typeof status !== 'string' || status.length === 0 || status.length > 64) throw new Error('宿主通知桥未确认派发状态。');
  return status;
}

export function createPlatform(host?: NativeHostBridge): PlatformPort {
  let candidate = host;
  try {
    if (!candidate && typeof window !== 'undefined') candidate = window.nuanbanHost ?? (window.nuanbanBridge ? createAndroidMessageHost({ channel: window.nuanbanBridge, origin: window.location.origin, mainFrame: window.top === window, lifecycle: window }) : undefined);
  } catch { candidate = undefined; }
  return candidate && (candidate.platform === 'android' || candidate.platform === 'windows') && typeof candidate.capabilities === 'function' && typeof candidate.stopAll === 'function' ? new NativeHostPlatform(candidate) : new BrowserPlatform();
}

declare global {
  interface Window { nuanbanHost?: NativeHostBridge; nuanbanBridge?: AndroidMessageChannel; }
}
import { createAndroidMessageHost, type AndroidMessageChannel } from './android-message-host';
export { createAndroidMessageHost } from './android-message-host';
export type { AndroidMessageChannel, AndroidHostBridge, AndroidHostEnvironment } from './android-message-host';
export { bindLifecycleEvents } from './lifecycle-events';
export type { LifecycleEventBinding, LifecycleEventBindingOptions, LifecycleEventName } from './lifecycle-events';
export { ReminderRuntime } from './reminder-runtime';
export type { ReminderRuntimeTodo, ReminderRuntimeDueEvent, ReminderRuntimeFailure, ReminderRuntimeOptions, ReminderRuntimeReport, ReminderRuntimeStopReport } from './reminder-runtime';
