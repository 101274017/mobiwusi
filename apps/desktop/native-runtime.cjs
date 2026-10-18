const path = require('node:path');

function createWindowsCapabilityPolicy(options = {}) {
  const notificationSupported = Boolean(options.Notification?.isSupported?.() ?? false);
  const encryptedStorage = Boolean(options.safeStorage?.isEncryptionAvailable?.() ?? false);
  return {
    platform: 'windows',
    externalCapture: false,
    remoteMedia: false,
    nativeOverlay: false,
    notifications: notificationSupported,
    encryptedStorage,
    status: 'capability-gated',
    unsupported: ['externalCapture', 'remoteMedia', 'nativeOverlay'].filter(name => !options[name]),
  };
}

function createWindowGeometryGuard() {
  return {
    validate(input) {
      const values = [input?.displayId, input?.windowId, input?.scaleFactor, input?.contentWidth, input?.contentHeight];
      if (!values[0] || !values[1] || !Number.isFinite(values[2]) || input.scaleFactor < 0.75 || input.scaleFactor > 4) return { valid: false, reason: 'invalid_geometry' };
      if (!Number.isFinite(input.contentWidth) || !Number.isFinite(input.contentHeight) || input.contentWidth <= 0 || input.contentHeight <= 0) return { valid: false, reason: 'invalid_content_size' };
      return { valid: true, reason: 'verified', negativeOriginSupported: Number.isFinite(input.originX) && Number.isFinite(input.originY) };
    },
  };
}

function createNativeRuntimeAdapter(options = {}) {
  let generation = 0;
  let state = 'idle';
  let lastStopReason = null;
  return {
    capabilities: () => createWindowsCapabilityPolicy(options),
    start() {
      if (state === 'active') return { started: false, reason: 'already_active', generation };
      generation += 1;
      state = 'active';
      lastStopReason = null;
      return { started: true, generation };
    },
    stop(reason = 'user') {
      generation += 1;
      state = 'stopped';
      lastStopReason = reason;
      return { stopped: true, captureActive: false, mediaActive: false, generation, reason };
    },
    snapshot() {
      return { state, generation, captureActive: false, mediaActive: false, lastStopReason };
    },
    resolveLocalAsset(assetPath, root = process.cwd()) {
      const absoluteRoot = path.resolve(root);
      const absolutePath = path.resolve(root, assetPath);
      if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) return null;
      return absolutePath;
    },
  };
}

module.exports = { createWindowsCapabilityPolicy, createWindowGeometryGuard, createNativeRuntimeAdapter };
