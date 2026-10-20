const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ObservationError, limitsFor, matchesCaptureDimensions, pngDimensions, checkAborted, abortable } = require('./observation-common.cjs');

function createControlledScreenCapture({ BrowserWindow, ipcMain, session, canCapture, resolveSource, onInvalidated, timeoutMs = 10_000, limits: limitOverrides, now = Date.now } = {}) {
  const limits = limitsFor(limitOverrides);
  const workerPath = path.join(__dirname, 'capture-worker.html');
  const workerUrl = pathToFileURL(workerPath).href;
  const scriptUrl = pathToFileURL(path.join(__dirname, 'capture-worker.js')).href;
  let context = null;
  let generation = 0;
  let invalidated = false;
  let busy = false;

  function authorized(sourceId) {
    try { return canCapture?.({ sourceId }) === true; } catch { return false; }
  }

  function exactWorker(current, frame) {
    const contents = current.window?.webContents;
    return context === current && !current.stopping && !current.invalid && !current.window?.isDestroyed() && !contents?.isDestroyed() && frame === contents?.mainFrame && frame?.url === workerUrl;
  }

  function destroy(current) {
    if (!current.window || current.window.isDestroyed()) return;
    try { current.window.destroy(); } catch { current.closeReject(new ObservationError('capture_worker_close_failed')); }
  }

  function closed(current) {
    clearTimeout(current.closeTimer);
    if (current.listener) ipcMain.removeListener(current.channel, current.listener);
    if (!current.stopping) fault(current, 'capture_worker_closed');
    current.readyReject(new ObservationError('capture_worker_closed'));
    current.pending?.reject(new ObservationError('capture_worker_closed'));
    current.pending = null;
    if (context === current) context = null;
    current.closeResolve();
  }

  function shutdown(current) {
    if (current.stopping) return current.closed;
    current.stopping = true;
    current.readyReject(new ObservationError('aborted'));
    current.pending?.reject(new ObservationError('aborted'));
    current.pending = null;
    if (!current.window || current.window.isDestroyed()) {
      closed(current);
      return current.closed;
    }
    current.closeTimer = setTimeout(() => destroy(current), 500);
    try { current.window.webContents.send(`${current.channel}:command`, { kind: 'stop', token: current.token, generation: current.generation, sourceId: current.sourceId }); } catch { destroy(current); }
    return current.closed;
  }

  function fault(current, reason) {
    if (current.invalid || current.stopping) return;
    current.invalid = true;
    invalidated = true;
    current.readyReject(new ObservationError(reason));
    current.pending?.reject(new ObservationError(reason));
    shutdown(current).catch(() => {});
    try { Promise.resolve(onInvalidated?.({ reason, sourceId: current.sourceId, generation: current.generation })).catch(() => {}); } catch {}
  }

  function disposePixels(payload) {
    try {
      if (payload?.png instanceof ArrayBuffer) new Uint8Array(payload.png).fill(0);
      else if (ArrayBuffer.isView(payload?.png)) new Uint8Array(payload.png.buffer, payload.png.byteOffset, payload.png.byteLength).fill(0);
    } catch {}
  }

  function receive(current, event, payload) {
    try {
      if (event.sender !== current.window?.webContents || event.senderFrame !== current.window?.webContents.mainFrame || event.senderFrame?.url !== workerUrl) return;
      if (!payload || payload.token !== current.token || payload.generation !== current.generation || payload.sourceId !== current.sourceId || payload.sourceIdentity !== current.sourceIdentity) return;
      if (payload.kind === 'stopped' && current.stopping) { destroy(current); return; }
      if (!exactWorker(current, event.senderFrame)) return;
      if (!authorized(current.sourceId)) { fault(current, 'consent_required'); return; }
      if (payload.kind === 'ended') { fault(current, 'capture_track_ended'); return; }
      if (payload.kind === 'error') { fault(current, typeof payload.reason === 'string' && /^capture_[a-z_]{1,60}$/.test(payload.reason) ? payload.reason : 'capture_worker_failed'); return; }
      if (payload.kind === 'ready') {
        if (!current.granted || current.readyReceived || !matchesCaptureDimensions(current, payload.width, payload.height, limits)) { fault(current, 'capture_dimensions_unproven'); return; }
        current.frameWidth = payload.width;
        current.frameHeight = payload.height;
        current.readyReceived = true;
        current.readyResolve();
        return;
      }
      if (payload.kind !== 'frame' || !current.pending || payload.requestId !== current.pending.requestId || !current.readyReceived) return;
      if (payload.width !== current.frameWidth || payload.height !== current.frameHeight) { fault(current, 'capture_dimensions_unproven'); return; }
      const bytes = payload.png instanceof ArrayBuffer ? new Uint8Array(payload.png) : ArrayBuffer.isView(payload.png) ? new Uint8Array(payload.png.buffer, payload.png.byteOffset, payload.png.byteLength) : null;
      if (!bytes || bytes.byteLength < 33 || bytes.byteLength > limits.maxPngBytes) { fault(current, 'capture_ipc_limit'); return; }
      const png = Buffer.from(bytes);
      try {
        const dimensions = pngDimensions(png, limits);
        if (dimensions.width !== current.frameWidth || dimensions.height !== current.frameHeight) throw new ObservationError('capture_dimensions_unproven');
        const pending = current.pending;
        let receivedAt;
        try { receivedAt = now(); } catch { throw new ObservationError('capture_time_invalid'); }
        if (!Number.isSafeInteger(payload.capturedAt) || payload.capturedAt < pending.requestedAt || !Number.isSafeInteger(receivedAt) || payload.capturedAt > receivedAt) throw new ObservationError('capture_time_invalid');
        current.pending = null;
        pending.resolve({ png, width: current.width, height: current.height, frameId: pending.requestId, capturedAt: payload.capturedAt });
      } catch (error) {
        png.fill(0);
        fault(current, error?.code === 'capture_time_invalid' ? 'capture_time_invalid' : 'capture_dimensions_unproven');
      }
    } finally { disposePixels(payload); }
  }

  function createWorker(input) {
    if (typeof BrowserWindow !== 'function' || typeof ipcMain?.on !== 'function' || typeof ipcMain?.removeListener !== 'function' || typeof session?.fromPartition !== 'function') throw new ObservationError('controlled_capture_unavailable');
    const token = randomUUID();
    const channel = `nuanban-capture-${token}`;
    const privateSession = session.fromPartition(channel, { cache: false });
    if (typeof privateSession?.setDisplayMediaRequestHandler !== 'function' || typeof privateSession?.setPermissionCheckHandler !== 'function' || typeof privateSession?.setPermissionRequestHandler !== 'function' || typeof privateSession?.enableNetworkEmulation !== 'function' || typeof privateSession?.webRequest?.onBeforeRequest !== 'function') throw new ObservationError('controlled_capture_unavailable');
    const current = { ...input, token, channel, generation: ++generation, window: null, stopping: false, invalid: false, granted: false, grantPending: false, readyReceived: false, pending: null, closeTimer: null };
    current.ready = new Promise((resolve, reject) => { current.readyResolve = resolve; current.readyReject = reject; });
    current.closed = new Promise((resolve, reject) => { current.closeResolve = resolve; current.closeReject = reject; });
    current.ready.catch(() => {});
    current.closed.catch(() => {});
    context = current;
    try {
    const permission = (contents, requested, details) => {
      const exact = contents === current.window?.webContents && details?.isMainFrame === true && details.requestingUrl === workerUrl && exactWorker(current, contents?.mainFrame) && authorized(current.sourceId);
      if (!exact) return false;
      if (requested === 'display-capture') return true;
      return requested === 'media' && Array.isArray(details.mediaTypes) && details.mediaTypes.length === 0;
    };
    privateSession.setPermissionCheckHandler((contents, requested, origin, details) => permission(contents, requested, details));
    privateSession.setPermissionRequestHandler((contents, requested, callback, details) => callback(permission(contents, requested, details)));
    privateSession.enableNetworkEmulation({ offline: true });
    privateSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => callback({ cancel: details.webContentsId !== current.window?.webContents.id || details.method !== 'GET' || !((details.url === workerUrl && details.resourceType === 'mainFrame') || (details.url === scriptUrl && details.resourceType === 'script')) }));
    privateSession.on?.('will-download', event => event.preventDefault());
    privateSession.setDisplayMediaRequestHandler((request, callback) => {
      let responded = false;
      const respond = streams => {
        if (responded) return;
        responded = true;
        callback(streams);
      };
      if (!exactWorker(current, request.frame) || request.videoRequested !== true || request.audioRequested !== false || request.userGesture !== true || !authorized(current.sourceId) || current.granted || current.grantPending) {
        try { respond(null); } catch {}
        if (exactWorker(current, request.frame)) fault(current, 'capture_grant_denied');
        return;
      }
      current.grantPending = true;
      Promise.resolve().then(() => resolveSource({ sourceId: current.sourceId, sourceIdentity: current.sourceIdentity })).then(source => {
        if (!exactWorker(current, request.frame) || !authorized(current.sourceId) || !source || source.id !== current.sourceId) {
          respond(null);
          fault(current, 'capture_source_unproven');
          return;
        }
        current.granted = true;
        respond({ video: { id: source.id, name: source.name } });
      }).catch(() => {
        try { respond(null); } catch {}
        fault(current, 'capture_grant_failed');
      }).finally(() => { current.grantPending = false; });
    }, { useSystemPicker: false });
      const configuration = { token, channel, generation: current.generation, sourceId: current.sourceId, sourceIdentity: current.sourceIdentity, width: current.width, height: current.height, minWidth: current.minWidth, maxWidth: current.maxWidth, minHeight: current.minHeight, maxHeight: current.maxHeight, maxDimension: limits.maxDimension, maxPngBytes: limits.maxPngBytes, maxPixels: limits.maxPixels };
      current.window = new BrowserWindow({ show: false, width: 16, height: 16, frame: false, focusable: false, skipTaskbar: true, webPreferences: { session: privateSession, preload: path.join(__dirname, 'capture-worker-preload.cjs'), additionalArguments: [`--nuanban-capture=${JSON.stringify(configuration)}`], sandbox: true, contextIsolation: true, nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, plugins: false, devTools: false, spellcheck: false, backgroundThrottling: false } });
      current.window.on('closed', () => closed(current));
      if (current.window.webContents.session !== privateSession) throw new ObservationError('capture_session_unproven');
      const contents = current.window.webContents;
      contents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
      contents.setWindowOpenHandler(() => ({ action: 'deny' }));
      for (const name of ['will-navigate', 'will-frame-navigate', 'will-attach-webview']) contents.on(name, event => { event.preventDefault(); fault(current, 'capture_worker_navigation'); });
      contents.on('render-process-gone', () => fault(current, 'capture_renderer_gone'));
      contents.on('did-fail-load', () => fault(current, 'capture_worker_load_failed'));
      current.window.on('unresponsive', () => fault(current, 'capture_worker_unresponsive'));
      current.listener = (event, payload) => receive(current, event, payload);
      ipcMain.on(channel, current.listener);
      current.loading = Promise.resolve(current.window.loadFile(workerPath)).then(() => {
        if (!exactWorker(current, contents.mainFrame) || !authorized(current.sourceId)) throw new ObservationError('consent_required');
        return contents.executeJavaScript('window.nuanbanCapture.start()', true);
      }).catch(() => { fault(current, 'capture_worker_start_failed'); });
    } catch (error) {
      fault(current, error instanceof ObservationError ? error.code : 'controlled_capture_unavailable');
      throw error instanceof ObservationError ? error : new ObservationError('controlled_capture_unavailable');
    }
    return current;
  }

  async function capture(input) {
    checkAborted(input.signal);
    if (busy) throw new ObservationError('busy');
    if (invalidated) throw new ObservationError('capture_session_invalidated');
    if (!authorized(input.sourceId)) throw new ObservationError('consent_required');
    busy = true;
    let current;
    const controller = new AbortController();
    const onAbort = () => controller.abort(new ObservationError('aborted'));
    input.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new ObservationError('timeout')), timeoutMs);
    let delivered;
    try {
      current = context ?? createWorker(input);
      if (current.stopping || current.sourceId !== input.sourceId || current.sourceIdentity !== input.sourceIdentity || ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'].some(key => current[key] !== input[key])) throw new ObservationError('capture_source_changed');
      await abortable(current.ready, controller.signal);
      if (!authorized(input.sourceId) || current.invalid || current.stopping) throw new ObservationError('consent_required');
      const requestId = randomUUID();
      const requestedAt = now();
      if (!Number.isSafeInteger(requestedAt) || requestedAt < 0) throw new ObservationError('capture_time_invalid');
      const result = new Promise((resolve, reject) => { current.pending = { requestId, requestedAt, resolve, reject }; });
      result.then(frame => { if (controller.signal.aborted) frame.png.fill(0); }, () => {});
      current.window.webContents.send(`${current.channel}:command`, { kind: 'capture', token: current.token, generation: current.generation, sourceId: current.sourceId, requestId });
      delivered = await abortable(result, controller.signal);
      checkAborted(input.signal);
      if (!authorized(input.sourceId) || current.invalid || current.stopping) throw new ObservationError('consent_required');
      return delivered;
    } catch (error) {
      delivered?.png.fill(0);
      if (current) { fault(current, error instanceof ObservationError ? error.code : 'capture_worker_failed'); await shutdown(current); }
      throw error instanceof ObservationError ? error : new ObservationError('capture_worker_failed');
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener('abort', onAbort);
      busy = false;
    }
  }

  async function stop() {
    invalidated = true;
    if (context) await shutdown(context);
  }

  function reset() {
    if (context || busy) throw new ObservationError('busy');
    invalidated = false;
  }

  return Object.freeze({ capture, stop, reset });
}

module.exports = { createControlledScreenCapture };
