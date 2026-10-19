const { createHash } = require('node:crypto');
const { createWindowsLocalDetector } = require('./observation/windows-local-detector.cjs');
const { evaluateLocalFrame, isRestrictedText } = require('./observation-policy.cjs');

const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const maxBytes = 10 * 1024 * 1024;
const maxPngBytes = 2_000_000;
const failureCodes = new Set(['INVALID_REQUEST', 'CONSENT_REQUIRED', 'RISK_PAUSED', 'PROVIDER_UNAVAILABLE', 'TIMEOUT', 'CANCELLED']);

class ImageQuestionError extends Error {
  constructor(code, retryable = false) {
    super(code);
    this.name = 'ImageQuestionError';
    this.code = code;
    this.retryable = retryable;
  }
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function validMime(bytes, mime) {
  if (mime === 'image/png') return bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg') return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === 'image/webp') return bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

function waitForAbort(task, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason instanceof ImageQuestionError ? signal.reason : new ImageQuestionError('CANCELLED'));
    task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
  });
}

function createImageQuestionService({ nativeImage, provider, detector, now = Date.now, timeoutMs = 30000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new ImageQuestionError('INVALID_REQUEST');
  let localDetector = detector;

  function status() {
    return Object.freeze(provider && typeof provider.answer === 'function'
      ? { available: true, reason: 'ready' }
      : { available: false, reason: 'model_not_configured' });
  }

  async function answer(input, { signal: parentSignal } = {}) {
    if (parentSignal?.aborted) throw new ImageQuestionError('CANCELLED');
    if (!input || !requestIdPattern.test(input.requestId) || typeof input.question !== 'string'
      || !input.question.trim() || input.question.length > 1500) throw new ImageQuestionError('INVALID_REQUEST');
    if (!status().available) throw new ImageQuestionError('PROVIDER_UNAVAILABLE');
    if (input.confirmed !== true) throw new ImageQuestionError('CONSENT_REQUIRED');
    if (isRestrictedText(input.question)) throw new ImageQuestionError('RISK_PAUSED');
    if (!(input.image?.bytes instanceof Uint8Array) || input.image.bytes.length < 1 || input.image.bytes.length > maxBytes) throw new ImageQuestionError('INVALID_REQUEST');
    const controller = new AbortController();
    const signal = parentSignal ? AbortSignal.any([parentSignal, controller.signal]) : controller.signal;
    const timer = setTimeout(() => controller.abort(new ImageQuestionError('TIMEOUT', true)), timeoutMs);
    const buffers = new Set();
    const clearBuffers = () => { for (const buffer of buffers) buffer.fill(0); buffers.clear(); };
    signal.addEventListener('abort', clearBuffers, { once: true });
    const check = () => {
      if (signal.aborted) throw signal.reason instanceof ImageQuestionError ? signal.reason : new ImageQuestionError('CANCELLED');
    };
    const run = async () => {
      let detection;
      try {
        check();
        const bytes = Buffer.from(input.image.bytes);
        buffers.add(bytes);
        if (!validMime(bytes, input.image.mime) || typeof nativeImage?.createFromBuffer !== 'function') throw new ImageQuestionError('INVALID_REQUEST');
        const image = nativeImage.createFromBuffer(bytes);
        if (!image || image.isEmpty()) throw new ImageQuestionError('INVALID_REQUEST');
        const { width, height } = image.getSize(1);
        if (![width, height].every(Number.isSafeInteger) || width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 8_388_608) throw new ImageQuestionError('INVALID_REQUEST');
        const png = image.toPNG({ scaleFactor: 1 });
        if (!Buffer.isBuffer(png)) throw new ImageQuestionError('INVALID_REQUEST');
        buffers.add(png);
        if (png.length > 24 * 1024 * 1024) throw new ImageQuestionError('INVALID_REQUEST');
        const frame = { sourceId: `attachment:${input.requestId}`, frameHash: hash(png), capturedAt: now(), width, height, png, geometry: null };
        localDetector ??= createWindowsLocalDetector({ nativeImage });
        if (typeof localDetector.detectAttachment !== 'function') throw new ImageQuestionError('RISK_PAUSED');
        detection = await localDetector.detectAttachment(frame, { signal });
        check();
        if (detection?.status !== 'complete' || detection.sourceId !== frame.sourceId || detection.ocrStatus !== 'complete'
          || detection.faceStatus !== 'complete' || !Buffer.isBuffer(detection.sanitizedPng)
          || detection.sanitizedFrameHash !== hash(detection.sanitizedPng)) throw new ImageQuestionError('RISK_PAUSED');
        const admitted = evaluateLocalFrame(frame, detection, { now: now(), maxAgeMs: timeoutMs });
        if (admitted.decision !== 'allow') throw new ImageQuestionError('RISK_PAUSED');
        const sanitized = admitted.sanitizedPng;
        buffers.add(sanitized);
        if (sanitized.length > maxPngBytes) throw new ImageQuestionError('RISK_PAUSED');
        check();
        const result = await provider.answer({ requestId: input.requestId, question: input.question.trim(),
          image: { mime: 'image/png', bytes: sanitized, width, height }, signal });
        check();
        if (!result || typeof result.text !== 'string' || !result.text.trim() || result.text.length > 24000) throw new ImageQuestionError('PROVIDER_UNAVAILABLE', true);
        if (isRestrictedText(result.text)) throw new ImageQuestionError('PROVIDER_UNAVAILABLE');
        return result.text.trim();
      } finally {
        if (Buffer.isBuffer(detection?.sanitizedPng)) detection.sanitizedPng.fill(0);
        clearBuffers();
      }
    };
    try {
      return await waitForAbort(run(), signal);
    } catch (error) {
      if (error instanceof ImageQuestionError) throw error;
      throw new ImageQuestionError('PROVIDER_UNAVAILABLE', true);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', clearBuffers);
      clearBuffers();
    }
  }

  return Object.freeze({ status, answer });
}

function registerManagementImageQuestionBridge({ ipcMain, isTrusted, service }) {
  const active = new Map();
  const channels = [];
  const cancelAll = () => { for (const operation of active.values()) operation.controller.abort(); };
  function handle(action, handler) {
    const channel = `nuanban:image-question:${action}`;
    channels.push(channel);
    ipcMain.handle(channel, (event, ...argumentsList) => {
      if (!isTrusted(event)) throw new Error('不可信图片提问入口');
      return handler(event, argumentsList);
    });
  }
  handle('status', (_event, argumentsList) => {
    if (argumentsList.length) throw new ImageQuestionError('INVALID_REQUEST');
    return service.status();
  });
  handle('cancel', (event, argumentsList) => {
    if (argumentsList.length !== 1 || !requestIdPattern.test(argumentsList[0])) throw new ImageQuestionError('INVALID_REQUEST');
    const operation = active.get(event.sender);
    if (operation?.requestId !== argumentsList[0]) return false;
    operation.controller.abort();
    return true;
  });
  handle('answer', async (event, argumentsList) => {
    const input = argumentsList[0];
    const requestId = typeof input?.requestId === 'string' && requestIdPattern.test(input.requestId) ? input.requestId : '';
    if (argumentsList.length !== 1 || !requestId || active.has(event.sender)) return { ok: false, requestId, code: 'INVALID_REQUEST', retryable: false };
    const operation = { requestId, controller: new AbortController() };
    active.set(event.sender, operation);
    const abort = () => operation.controller.abort();
    for (const name of ['destroyed', 'render-process-gone', 'did-start-navigation']) event.sender.once(name, abort);
    try {
      const text = await service.answer(input, { signal: operation.controller.signal });
      if (operation.controller.signal.aborted || !isTrusted(event)) throw new ImageQuestionError('CANCELLED');
      return { ok: true, requestId, text };
    } catch (error) {
      const code = error instanceof ImageQuestionError && failureCodes.has(error.code) ? error.code : 'PROVIDER_UNAVAILABLE';
      return { ok: false, requestId, code, retryable: error instanceof ImageQuestionError ? error.retryable : true };
    } finally {
      if (active.get(event.sender) === operation) active.delete(event.sender);
      for (const name of ['destroyed', 'render-process-gone', 'did-start-navigation']) event.sender.removeListener(name, abort);
    }
  });
  return { stop: cancelAll, dispose() { cancelAll(); for (const channel of channels.splice(0)) ipcMain.removeHandler(channel); } };
}

module.exports = { createImageQuestionService, registerManagementImageQuestionBridge, ImageQuestionError };
