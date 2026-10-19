import type { WindowsObservationSource, WindowsObservationSourceOptions as BaseWindowsObservationSourceOptions } from './observation-types.cjs';
export type * from './observation-types.cjs';
export interface WindowsObservationSourceOptions extends BaseWindowsObservationSourceOptions {
  BrowserWindow?: typeof import('electron').BrowserWindow;
  ipcMain?: Pick<typeof import('electron').ipcMain, 'on' | 'removeListener'>;
  session?: Pick<typeof import('electron').session, 'fromPartition'>;
  onCaptureInvalidated?: (event: { reason: string; sourceId: string; generation: number }) => void | Promise<void>;
}
export class ObservationError extends Error { code: string; constructor(code: string) }
export function createWindowsObservationSource(options?: WindowsObservationSourceOptions): WindowsObservationSource;
