export interface WindowsCapabilityPolicy {
  platform: 'windows';
  externalCapture: false;
  remoteMedia: false;
  nativeOverlay: false;
  notifications: boolean;
  encryptedStorage: boolean;
  status: 'capability-gated';
  unsupported: string[];
}

export interface WindowGeometryGuard {
  validate(input: { displayId?: string; windowId?: string; scaleFactor?: number; contentWidth?: number; contentHeight?: number; originX?: number; originY?: number }): { valid: boolean; reason: string; negativeOriginSupported?: boolean };
}

export interface NativeRuntimeAdapter {
  capabilities(): WindowsCapabilityPolicy;
  start(): { started: boolean; reason?: string; generation: number };
  stop(reason?: string): { stopped: true; captureActive: false; mediaActive: false; generation: number; reason: string };
  snapshot(): { state: string; generation: number; captureActive: false; mediaActive: false; lastStopReason: string | null };
  resolveLocalAsset(assetPath: string, root?: string): string | null;
}

export function createWindowsCapabilityPolicy(options?: { Notification?: { isSupported?: () => boolean }; safeStorage?: { isEncryptionAvailable?: () => boolean } }): WindowsCapabilityPolicy;
export function createWindowGeometryGuard(): WindowGeometryGuard;
export function createNativeRuntimeAdapter(options?: Record<string, unknown>): NativeRuntimeAdapter;
