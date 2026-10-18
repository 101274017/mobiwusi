import type { WindowsObservationSource, WindowsObservationSourceOptions } from './observation-types.cjs';
export type * from './observation-types.cjs';
export class ObservationError extends Error { code: string; constructor(code: string) }
export function createWindowsObservationSource(options?: WindowsObservationSourceOptions): WindowsObservationSource;
