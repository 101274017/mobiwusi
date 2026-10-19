export interface LocalObservationStatus {
  state: 'off' | 'observing' | 'privacy_paused' | 'stopped' | 'cleanup_failed';
  captureActive: boolean;
  sourceName: string;
  cloudConfigured: boolean;
}

export interface LocalObservationBridge {
  status(): Promise<LocalObservationStatus>;
  start(): Promise<LocalObservationStatus>;
  resume(): Promise<LocalObservationStatus>;
  stop(): Promise<LocalObservationStatus>;
  showPet(): Promise<LocalObservationStatus>;
}

declare global {
  interface Window { nuanbanObservation?: LocalObservationBridge; }
}

export function localObservationBridge(): LocalObservationBridge | undefined {
  const bridge = window.nuanbanObservation;
  return bridge && ['status', 'start', 'resume', 'stop', 'showPet'].every(method => typeof bridge[method as keyof LocalObservationBridge] === 'function') ? bridge : undefined;
}

export function checkedObservationStatus(value: unknown): LocalObservationStatus {
  if (!value || typeof value !== 'object') throw new Error('观察状态未确认');
  const current = value as Record<string, unknown>;
  if (!['off', 'observing', 'privacy_paused', 'stopped', 'cleanup_failed'].includes(String(current.state))
    || typeof current.captureActive !== 'boolean' || typeof current.sourceName !== 'string' || current.sourceName.length > 120
    || typeof current.cloudConfigured !== 'boolean') throw new Error('观察状态未确认');
  return { state: current.state as LocalObservationStatus['state'], captureActive: current.captureActive,
    sourceName: current.sourceName, cloudConfigured: current.cloudConfigured };
}
