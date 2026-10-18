import type { LifecycleCleanupReport, LifecycleCoordinator, LifecyclePlatform, LifecycleSignal } from './index';

export type LifecycleEventName =
  | 'nuanban:host-pause'
  | 'nuanban:host-destroy'
  | 'nuanban:host-permission-revoked'
  | 'nuanban:host-before-quit'
  | 'nuanban:host-renderer-gone'
  | 'nuanban:host-window-moved'
  | 'nuanban:host-recursive-capture';

export interface LifecycleEventBindingOptions {
  onCleanup?: (report: LifecycleCleanupReport) => void;
  onError?: (error: unknown) => void;
}

export interface LifecycleEventBinding {
  dispose(): void;
  lastCleanup(): Promise<LifecycleCleanupReport> | null;
}

const eventSignals: Record<LifecyclePlatform, Readonly<Partial<Record<LifecycleEventName, LifecycleSignal>>>> = {
  android: {
    'nuanban:host-pause': 'lock',
    'nuanban:host-destroy': 'process-terminated',
    'nuanban:host-permission-revoked': 'permission-revoked',
  },
  windows: {
    'nuanban:host-before-quit': 'process-terminated',
    'nuanban:host-renderer-gone': 'renderer-gone',
    'nuanban:host-window-moved': 'window-moved',
    'nuanban:host-recursive-capture': 'recursive-capture',
  },
};

export function bindLifecycleEvents(
  coordinator: LifecycleCoordinator,
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
  options: LifecycleEventBindingOptions = {},
): LifecycleEventBinding {
  if (!target || typeof target.addEventListener !== 'function' || typeof target.removeEventListener !== 'function') {
    throw new Error('生命周期事件目标不完整。');
  }

  let latestCleanup: Promise<LifecycleCleanupReport> | null = null;
  let disposed = false;
  const platform = coordinator.snapshot().platform;
  const signals = eventSignals[platform];
  if (!signals) throw new Error('生命周期平台不受支持。');
  const listeners: Array<{ eventName: LifecycleEventName; listener: EventListener }> = [];
  try {
    for (const [eventName, signal] of Object.entries(signals)) {
      if (!signal) continue;
      const listener: EventListener = (): void => {
        if (disposed || coordinator.snapshot().state !== 'active') return;
        const cleanup = coordinator.signal(signal);
        latestCleanup = cleanup;
        void cleanup.then(options.onCleanup ?? (() => undefined)).catch(options.onError ?? (() => undefined));
      };
      target.addEventListener(eventName, listener);
      listeners.push({ eventName: eventName as LifecycleEventName, listener });
    }
  } catch (error) {
    for (const { eventName, listener } of listeners) {
      try { target.removeEventListener(eventName, listener); } catch { }
    }
    throw error;
  }

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const { eventName, listener } of listeners) {
        try { target.removeEventListener(eventName, listener); } catch { }
      }
    },
    lastCleanup(): Promise<LifecycleCleanupReport> | null {
      return latestCleanup;
    },
  };
}
