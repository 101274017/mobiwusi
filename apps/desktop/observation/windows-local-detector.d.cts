import type { LocalDetectorOptions, WindowsLocalDetector, ObservationFrame, SignalOptions, DetectionResult } from './observation-types.cjs';
export type * from './observation-types.cjs';
export function createWindowsLocalDetector(options?: LocalDetectorOptions): WindowsLocalDetector & {
  detectAttachment(frame: ObservationFrame, options?: SignalOptions): Promise<DetectionResult>;
};
