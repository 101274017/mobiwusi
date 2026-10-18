const { createHash } = require('node:crypto');
const { ObservationError, limitsFor, pngDimensions, hashPng, checkDimensions, checkGeometry, checkAborted, abortable } = require('./observation-common.cjs');
const { createWindowsLocalDetector } = require('./windows-local-detector.cjs');

function createWindowsObservationSource({ desktopCapturer, screen, nativeImage, canCapture = () => false, now = Date.now, timeoutMs = 10_000, limits: limitOverrides, platform = process.platform, detectorOptions = {} } = {}) {
  const limits = limitsFor(limitOverrides);
  const detector = createWindowsLocalDetector({ ...detectorOptions, nativeImage, platform, limits: limitOverrides });
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new ObservationError('invalid_timeout');
  let listed = new Map();
  let active = null;

  function ensureAvailable() {
    if (platform !== 'win32' || typeof desktopCapturer?.getSources !== 'function' || typeof screen?.getAllDisplays !== 'function') throw new ObservationError('windows_capture_unavailable');
  }

  function geometryFor(source) {
    if (source.type !== 'screen') return null;
    const displays = screen.getAllDisplays();
    if (!Array.isArray(displays) || displays.length > limits.maxSources) throw new ObservationError('display_metadata_invalid');
    const matches = displays.filter(display => String(display.id) === source.displayId && ![-1, -10].includes(display.id));
    if (matches.length !== 1) throw new ObservationError('display_identity_unproven');
    const display = matches[0];
    const bounds = display.bounds;
    if (!bounds || !Number.isFinite(display.scaleFactor)) throw new ObservationError('geometry_unproven');
    let pixels;
    if (typeof screen.dipToScreenRect === 'function') {
      pixels = screen.dipToScreenRect(null, { ...bounds });
    } else if (display.nativeOrigin) {
      pixels = { ...display.nativeOrigin, width: Math.round(bounds.width * display.scaleFactor), height: Math.round(bounds.height * display.scaleFactor) };
    } else {
      throw new ObservationError('physical_origin_unproven');
    }
    checkDimensions(pixels?.width, pixels?.height, limits);
    return checkGeometry({ coordinateSpace: 'screen-dip', ...bounds, pixelX: pixels.x, pixelY: pixels.y, pixelWidth: pixels.width, pixelHeight: pixels.height, scaleFactor: display.scaleFactor, rotation: display.rotation }, pixels.width, pixels.height);
  }

  function metadataFor(raw) {
    if (!raw || typeof raw.id !== 'string' || !/^(screen|window):\d+:\d+$/.test(raw.id) || raw.id.length > 256 || typeof raw.name !== 'string' || raw.name.length > 4096 || typeof raw.display_id !== 'string' || raw.display_id.length > 128) throw new ObservationError('source_metadata_invalid');
    const metadata = { id: raw.id, name: raw.name, displayId: raw.display_id, type: raw.id.startsWith('screen:') ? 'screen' : 'window', geometry: null };
    let unavailableReason;
    try {
      metadata.geometry = geometryFor(metadata);
      if (metadata.geometry === null) unavailableReason = 'window_geometry_unproven';
    } catch (error) {
      unavailableReason = error instanceof ObservationError ? error.code : 'geometry_unproven';
    }
    return Object.freeze({ ...metadata, ...(unavailableReason ? { unavailableReason } : {}) });
  }

  async function enumerate(signal, types, thumbnailSize) {
    checkAborted(signal);
    const sources = await desktopCapturer.getSources({ types, thumbnailSize, fetchWindowIcons: false });
    checkAborted(signal);
    if (!Array.isArray(sources) || sources.length > limits.maxSources || new Set(sources.map(source => source?.id)).size !== sources.length) throw new ObservationError('source_metadata_invalid');
    return sources;
  }

  function run(signal, action) {
    try {
      ensureAvailable();
      checkAborted(signal);
      if (active) throw new ObservationError('busy');
    } catch (error) {
      return Promise.reject(error);
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort(new ObservationError('aborted'));
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new ObservationError('timeout')), timeoutMs);
    active = controller;
    const operation = Promise.resolve().then(() => action(controller.signal)).finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (active === controller) active = null;
    });
    return abortable(operation, controller.signal);
  }

  function identity(metadata) {
    return JSON.stringify(metadata);
  }

  function requireConsent(sourceId) {
    let allowed = false;
    try {
      allowed = canCapture({ sourceId }) === true;
    } catch {}
    if (!allowed) throw new ObservationError('consent_required');
  }

  return Object.freeze({
    listSources({ signal } = {}) {
      return run(signal, async operationSignal => {
        listed = new Map();
        const sources = await enumerate(operationSignal, ['screen', 'window'], { width: 0, height: 0 });
        const metadata = sources.map(metadataFor);
        checkAborted(operationSignal);
        listed = new Map(metadata.map(source => [source.id, source]));
        return metadata;
      });
    },
    capture({ sourceId, signal } = {}) {
      return run(signal, async operationSignal => {
        const selected = listed.get(sourceId);
        if (!selected) throw new ObservationError('source_not_selected');
        requireConsent(sourceId);
        if (!selected.geometry) throw new ObservationError(selected.unavailableReason ?? 'geometry_unproven');
        const types = [selected.type];
        const before = await enumerate(operationSignal, types, { width: 0, height: 0 });
        const current = before.find(source => source.id === sourceId);
        if (!current) throw new ObservationError('source_lost');
        if (identity(metadataFor(current)) !== identity(selected)) throw new ObservationError('source_changed');
        requireConsent(sourceId);
        const { pixelWidth: width, pixelHeight: height } = selected.geometry;
        const captured = await enumerate(operationSignal, types, { width, height });
        requireConsent(sourceId);
        const raw = captured.find(source => source.id === sourceId);
        if (!raw) throw new ObservationError('source_lost');
        if (identity(metadataFor(raw)) !== identity(selected)) throw new ObservationError('source_changed');
        const image = raw.thumbnail;
        if (!image || image.isEmpty() || typeof image.getSize !== 'function' || typeof image.toPNG !== 'function') throw new ObservationError('capture_empty');
        const size = image.getSize(1);
        if (size.width !== width || size.height !== height) throw new ObservationError('capture_dimensions_unproven');
        const png = image.toPNG({ scaleFactor: 1 });
        let returned = false;
        try {
          const decoded = pngDimensions(png, limits);
          if (decoded.width !== width || decoded.height !== height) throw new ObservationError('capture_dimensions_unproven');
          const after = await enumerate(operationSignal, types, { width: 0, height: 0 });
          const last = after.find(source => source.id === sourceId);
          if (!last) throw new ObservationError('source_lost');
          if (identity(metadataFor(last)) !== identity(selected)) throw new ObservationError('source_changed');
          requireConsent(sourceId);
          checkAborted(operationSignal);
          const capturedAt = now();
          if (!Number.isSafeInteger(capturedAt) || capturedAt < 0) throw new ObservationError('capture_time_invalid');
          const frame = Object.freeze({ sourceId, sourceName: selected.name, displayId: selected.displayId, sourceType: selected.type, sourceIdentity: createHash('sha256').update(identity(selected)).digest('hex'), png, width, height, capturedAt, geometry: selected.geometry, frameHash: hashPng(png) });
          returned = true;
          return frame;
        } finally {
          if (!returned && Buffer.isBuffer(png)) png.fill(0);
        }
      });
    },
    detect: detector.detect,
    probe: detector.probe,
    async stop() {
      listed.clear();
      active?.abort(new ObservationError('aborted'));
      await detector.stop();
    },
  });
}

module.exports = { createWindowsObservationSource, ObservationError };
