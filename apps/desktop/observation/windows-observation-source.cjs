const { createHash } = require('node:crypto');
const { ObservationError, limitsFor, pngDimensions, hashPng, checkDimensions, matchesCaptureDimensions, checkGeometry, checkAborted, abortable } = require('./observation-common.cjs');
const { createWindowsLocalDetector } = require('./windows-local-detector.cjs');
const { createControlledScreenCapture } = require('./controlled-screen-capture.cjs');
const { validateObservationRegion, cropObservationPng } = require('./observation-region.cjs');

function createWindowsObservationSource({ desktopCapturer, screen, nativeImage, BrowserWindow, ipcMain, session, canCapture = () => false, onCaptureInvalidated, now = Date.now, timeoutMs = 10_000, limits: limitOverrides, platform = process.platform, detectorOptions = {} } = {}) {
  const limits = limitsFor(limitOverrides);
  let capturedFrames = new WeakSet();
  const detector = createWindowsLocalDetector({ ...detectorOptions, nativeImage, platform, limits: limitOverrides,
    canReadShellControls: frame => capturedFrames.delete(frame) && listed.has(frame.sourceId) && canCapture({ sourceId: frame.sourceId }) === true });
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new ObservationError('invalid_timeout');
  let listed = new Map();
  let active = null;
  let captureRegionKey;
  const controlled = createControlledScreenCapture({ BrowserWindow, ipcMain, session, canCapture, timeoutMs, now, limits: limitOverrides,
    async resolveSource({ sourceId, sourceIdentity }) {
      const selected = listed.get(sourceId);
      if (!selected || !active || active.signal.aborted || createHash('sha256').update(identity(selected)).digest('hex') !== sourceIdentity) throw new ObservationError('source_not_selected');
      requireConsent(sourceId);
      const sources = await enumerate(active.signal, ['screen']);
      const source = sources.find(candidate => candidate.id === sourceId);
      if (!source || identity(metadataFor(source)) !== identity(selected)) throw new ObservationError('source_changed');
      requireConsent(sourceId);
      return { id: source.id, name: source.name };
    },
    onInvalidated(event) {
      listed.clear();
      active?.abort(new ObservationError(event.reason));
      detector.stop().catch(() => {});
      return onCaptureInvalidated?.(event);
    },
  });

  function ensureAvailable() {
    if (platform !== 'win32' || typeof desktopCapturer?.getSources !== 'function' || typeof screen?.getAllDisplays !== 'function') throw new ObservationError('windows_capture_unavailable');
  }

  function geometryFor(source) {
    if (source.type !== 'screen') return null;
    const displays = screen.getAllDisplays();
    if (!Array.isArray(displays) || displays.length > limits.maxSources) throw new ObservationError('display_metadata_invalid');
    const matches = displays.filter(display => /^\d{1,16}$/.test(String(display.id)) && Number.isSafeInteger(Number(display.id)) && String(display.id) === source.displayId);
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

  async function enumerate(signal, types) {
    checkAborted(signal);
    let sources;
    try {
      sources = await desktopCapturer.getSources({ types, thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
    } catch {
      throw new ObservationError('source_enumeration_failed');
    }
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
    const operation = Promise.resolve().then(() => action(controller.signal)).catch(error => {
      throw error instanceof ObservationError ? error : new ObservationError('capture_failed');
    }).finally(() => {
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
        await controlled.stop();
        controlled.reset();
        listed = new Map();
        capturedFrames = new WeakSet();
        captureRegionKey = undefined;
        const sources = await enumerate(operationSignal, ['screen', 'window']);
        const metadata = sources.map(metadataFor);
        checkAborted(operationSignal);
        listed = new Map(metadata.map(source => [source.id, source]));
        return metadata;
      });
    },
    capture({ sourceId, signal, region: requestedRegion } = {}) {
      return run(signal, async operationSignal => {
        let png;
        let returned = false;
        try {
        const selected = listed.get(sourceId);
        if (!selected) throw new ObservationError('source_not_selected');
        requireConsent(sourceId);
        if (!selected.geometry) throw new ObservationError(selected.unavailableReason ?? 'geometry_unproven');
        const region = validateObservationRegion(requestedRegion, selected.geometry.width, selected.geometry.height);
        const regionKey = JSON.stringify(region);
        if (captureRegionKey !== undefined && captureRegionKey !== regionKey) throw new ObservationError('capture_region_changed');
        captureRegionKey = regionKey;
        const types = [selected.type];
        const before = await enumerate(operationSignal, types);
        const current = before.find(source => source.id === sourceId);
        if (!current) throw new ObservationError('source_lost');
        if (identity(metadataFor(current)) !== identity(selected)) throw new ObservationError('source_changed');
        requireConsent(sourceId);
        const width = Math.round(selected.geometry.width * selected.geometry.scaleFactor);
        const height = Math.round(selected.geometry.height * selected.geometry.scaleFactor);
        const sourceIdentity = createHash('sha256').update(identity(selected)).digest('hex');
        const dimensions = { width, height, minWidth: Math.floor(selected.geometry.width * selected.geometry.scaleFactor), maxWidth: Math.ceil(selected.geometry.width * selected.geometry.scaleFactor), minHeight: Math.floor(selected.geometry.height * selected.geometry.scaleFactor), maxHeight: Math.ceil(selected.geometry.height * selected.geometry.scaleFactor) };
        const captured = await controlled.capture({ sourceId, sourceIdentity, ...dimensions, signal: operationSignal });
        png = captured.png;
          const decoded = pngDimensions(png, limits);
          if (!matchesCaptureDimensions(dimensions, decoded.width, decoded.height, limits)) throw new ObservationError('capture_dimensions_unproven');
          let geometry = checkGeometry({ ...selected.geometry, pixelWidth: decoded.width, pixelHeight: decoded.height }, decoded.width, decoded.height);
          const after = await enumerate(operationSignal, types);
          const last = after.find(source => source.id === sourceId);
          if (!last) throw new ObservationError('source_lost');
          if (identity(metadataFor(last)) !== identity(selected)) throw new ObservationError('source_changed');
          requireConsent(sourceId);
          checkAborted(operationSignal);
          if (region) {
            const cropped = cropObservationPng(png, geometry, region, nativeImage, limits);
            png.fill(0);
            png = cropped.png;
            geometry = cropped.geometry;
            requireConsent(sourceId);
            checkAborted(operationSignal);
          }
          const frame = Object.freeze({ sourceId, sourceName: region ? `${selected.name}（框选区域）` : selected.name, displayId: selected.displayId, sourceType: selected.type,
            sourceIdentity: region ? createHash('sha256').update(sourceIdentity + regionKey).digest('hex') : sourceIdentity,
            frameId: captured.frameId, png, width: geometry.pixelWidth, height: geometry.pixelHeight, capturedAt: captured.capturedAt, geometry, frameHash: hashPng(png), ...(region ? { region } : {}) });
          capturedFrames.add(frame);
          returned = true;
          return frame;
        } finally {
          if (!returned) {
            if (Buffer.isBuffer(png)) png.fill(0);
            listed.clear();
            await controlled.stop();
          }
        }
      });
    },
    detect: detector.detect,
    probe: detector.probe,
    async stop() {
      listed.clear();
      capturedFrames = new WeakSet();
      captureRegionKey = undefined;
      active?.abort(new ObservationError('aborted'));
      await Promise.all([detector.stop(), controlled.stop()]);
    },
  });
}

module.exports = { createWindowsObservationSource, ObservationError };
