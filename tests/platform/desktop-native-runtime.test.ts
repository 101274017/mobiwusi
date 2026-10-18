import { describe, expect, it } from 'vitest';
import { createNativeRuntimeAdapter, createWindowGeometryGuard, createWindowsCapabilityPolicy } from '../../apps/desktop/native-runtime.cjs';

describe('E19/E20 Windows 原生能力策略', () => {
  it('未完成真实平台验证时保持高风险能力关闭', () => {
    const policy = createWindowsCapabilityPolicy({ Notification: { isSupported: () => false }, safeStorage: { isEncryptionAvailable: () => false } });
    expect(policy).toMatchObject({ platform: 'windows', externalCapture: false, remoteMedia: false, nativeOverlay: false, notifications: false, encryptedStorage: false });
  });

  it('支持负坐标与混合 DPI 的几何预检，但不伪造捕获能力', () => {
    const guard = createWindowGeometryGuard();
    expect(guard.validate({ displayId: 'display-2', windowId: 'window-1', scaleFactor: 1.5, contentWidth: 900, contentHeight: 600, originX: -1920, originY: 0 })).toMatchObject({ valid: true, negativeOriginSupported: true });
    expect(guard.validate({ displayId: 'display-2', windowId: 'window-1', scaleFactor: 5, contentWidth: 900, contentHeight: 600, originX: 0, originY: 0 })).toMatchObject({ valid: false });
  });

  it('停止会递增代际并确认捕获/媒体均已停止', () => {
    const runtime = createNativeRuntimeAdapter();
    expect(runtime.start()).toMatchObject({ started: true, generation: 1 });
    expect(runtime.stop('permission-revoked')).toMatchObject({ stopped: true, captureActive: false, mediaActive: false, generation: 2, reason: 'permission-revoked' });
    expect(runtime.snapshot()).toMatchObject({ state: 'stopped', captureActive: false, mediaActive: false, lastStopReason: 'permission-revoked' });
  });

  it('资源路径不能逃逸应用根目录', () => {
    const runtime = createNativeRuntimeAdapter();
    expect(runtime.resolveLocalAsset('ui/index.html', 'C:/nuanban')).toBe('C:\\nuanban\\ui\\index.html');
    expect(runtime.resolveLocalAsset('../secret.txt', 'C:/nuanban')).toBeNull();
  });
});
