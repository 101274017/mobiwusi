const { createWindowsHelperProcess } = require('./windows-helper-process.cjs');
const { ObservationError, limitsFor, pngDimensions, hashPng, checkGeometry, checkAborted } = require('./observation-common.cjs');

const BLACK_PIXEL = Buffer.from([0, 0, 0, 255]);

function createWindowsLocalDetector({ nativeImage, spawn, timeoutMs, maxOutputBytes, platform, limits: limitOverrides } = {}) {
  const limits = limitsFor(limitOverrides);
  const helper = createWindowsHelperProcess({ spawn, timeoutMs, maxOutputBytes, platform });
  let busy = false;
  let active = null;

  function begin(signal) {
    const controller = new AbortController();
    let finish;
    const done = new Promise(resolve => { finish = resolve; });
    const operation = { controller, signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal, done, finish };
    active = operation;
    busy = true;
    return operation;
  }

  function end(operation) {
    if (active === operation) active = null;
    busy = false;
    operation.finish();
  }

  function failure(status, reason, frame = {}) {
    frame ??= {};
    return { status, reason, frameHash: typeof frame.frameHash === 'string' ? frame.frameHash : null, sourceId: typeof frame.sourceId === 'string' ? frame.sourceId : null, width: Number.isSafeInteger(frame.width) ? frame.width : null, height: Number.isSafeInteger(frame.height) ? frame.height : null, words: [], faces: [], redaction: { text: false, faces: false } };
  }

  function failFrom(error, frame) {
    const reason = error instanceof ObservationError ? error.code : 'local_analysis_failed';
    return failure(['windows_analysis_unavailable', 'helper_spawn_unavailable', 'native_image_unavailable'].includes(reason) ? 'unavailable' : 'failed', reason, frame);
  }

  function snapshotFrame(frame) {
    if (!frame || typeof frame.sourceId !== 'string' || !/^(screen|window):\d+:\d+$/.test(frame.sourceId) || typeof frame.frameHash !== 'string' || !/^[a-f0-9]{64}$/.test(frame.frameHash)) throw new ObservationError('frame_invalid');
    const dimensions = pngDimensions(frame.png, limits);
    if (frame.width !== dimensions.width || frame.height !== dimensions.height) throw new ObservationError('image_dimensions_mismatch');
    if (frame.frameHash !== hashPng(frame.png)) throw new ObservationError('frame_hash_mismatch');
    if (frame.sourceIdentity !== undefined && !/^[a-f0-9]{64}$/.test(frame.sourceIdentity)) throw new ObservationError('source_identity_invalid');
    const geometry = frame.geometry === null || frame.geometry === undefined ? null : checkGeometry(frame.geometry, frame.width, frame.height);
    return { sourceId: frame.sourceId, sourceIdentity: frame.sourceIdentity ?? null, frameHash: frame.frameHash, width: frame.width, height: frame.height, geometry, png: Buffer.from(frame.png) };
  }

  function checkedRect(rect, width, height) {
    if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > width || rect.y + rect.height > height) throw new ObservationError('detection_rect_out_of_bounds');
    return Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }

  function positioned(rect, geometry) {
    if (!geometry) return { rect };
    return { rect, globalRect: { x: geometry.x + rect.x / geometry.scaleFactor, y: geometry.y + rect.y / geometry.scaleFactor, width: rect.width / geometry.scaleFactor, height: rect.height / geometry.scaleFactor } };
  }

  function maskRect(rect, width, height, padding, angle = 0) {
    const corners = [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x, rect.y + rect.height], [rect.x + rect.width, rect.y + rect.height]];
    const points = [...corners];
    for (const degrees of [angle, -angle]) {
      const radians = degrees * Math.PI / 180;
      for (const [pointX, pointY] of corners) {
        const offsetX = pointX - width / 2;
        const offsetY = pointY - height / 2;
        points.push([width / 2 + offsetX * Math.cos(radians) - offsetY * Math.sin(radians), height / 2 + offsetX * Math.sin(radians) + offsetY * Math.cos(radians)]);
      }
    }
    const left = Math.max(0, Math.floor(Math.min(...points.map(point => point[0]))) - padding);
    const top = Math.max(0, Math.floor(Math.min(...points.map(point => point[1]))) - padding);
    const right = Math.min(width, Math.ceil(Math.max(...points.map(point => point[0]))) + padding);
    const bottom = Math.min(height, Math.ceil(Math.max(...points.map(point => point[1]))) + padding);
    return { left, top, right, bottom };
  }

  function sanitize(snapshot, words, faces, textAngle, signal) {
    checkAborted(signal);
    const image = nativeImage.createFromBuffer(snapshot.png);
    if (!image || image.isEmpty()) throw new ObservationError('native_image_decode_failed');
    const size = image.getSize(1);
    if (size.width !== snapshot.width || size.height !== snapshot.height) throw new ObservationError('image_dimensions_mismatch');
    const originalBitmap = image.toBitmap({ scaleFactor: 1 });
    if (!Buffer.isBuffer(originalBitmap) || originalBitmap.length !== snapshot.width * snapshot.height * 4) throw new ObservationError('bitmap_dimensions_mismatch');
    const bitmap = Buffer.from(originalBitmap);
    try {
      const masks = [...words.map(word => maskRect(word.rect, snapshot.width, snapshot.height, 3, textAngle)), ...faces.map(face => maskRect(face.rect, snapshot.width, snapshot.height, Math.max(4, Math.ceil(Math.max(face.rect.width, face.rect.height) * 0.08))))];
      const work = masks.reduce((total, rect) => total + (rect.right - rect.left) * (rect.bottom - rect.top), 0);
      if (work > limits.maxPixels * 4) throw new ObservationError('redaction_work_limit');
      for (const rect of masks) {
        checkAborted(signal);
        for (let row = rect.top; row < rect.bottom; row += 1) bitmap.fill(BLACK_PIXEL, (row * snapshot.width + rect.left) * 4, (row * snapshot.width + rect.right) * 4);
      }
      const sanitized = nativeImage.createFromBitmap(bitmap, { width: snapshot.width, height: snapshot.height, scaleFactor: 1 });
      if (!sanitized || sanitized.isEmpty()) throw new ObservationError('redaction_encode_failed');
      const png = sanitized.toPNG({ scaleFactor: 1 });
      const dimensions = pngDimensions(png, limits);
      if (dimensions.width !== snapshot.width || dimensions.height !== snapshot.height) throw new ObservationError('redaction_dimensions_mismatch');
      checkAborted(signal);
      return png;
    } finally {
      bitmap.fill(0);
      originalBitmap.fill(0);
    }
  }

  async function detect(frame, { signal } = {}) {
    if (busy) return failure('failed', 'busy', frame);
    const operation = begin(signal);
    signal = operation.signal;
    let snapshot;
    try {
      checkAborted(signal);
      if (typeof nativeImage?.createFromBuffer !== 'function' || typeof nativeImage?.createFromBitmap !== 'function') throw new ObservationError('native_image_unavailable');
      snapshot = snapshotFrame(frame);
      const result = await helper.run({ protocol: 1, operation: 'detect', sourceId: snapshot.sourceId, sourceIdentity: snapshot.sourceIdentity, frameHash: snapshot.frameHash, width: snapshot.width, height: snapshot.height, pngBase64: snapshot.png.toString('base64') }, { signal });
      checkAborted(signal);
      if (!result || result.protocol !== 1 || !['complete', 'unavailable', 'failed'].includes(result.status)) throw new ObservationError('detector_output_invalid');
      if (result.status !== 'complete') return failure(result.status, typeof result.reason === 'string' && /^[a-zA-Z0-9_:.+-]{1,160}$/.test(result.reason) ? result.reason : 'detector_unavailable', snapshot);
      if (result.frameHash !== snapshot.frameHash || result.sourceId !== snapshot.sourceId || result.sourceIdentity !== snapshot.sourceIdentity) throw new ObservationError('detector_frame_mismatch');
      if (result.width !== snapshot.width || result.height !== snapshot.height) throw new ObservationError('detector_dimensions_mismatch');
      if (result.ocrStatus !== 'complete' || result.faceStatus !== 'complete' || !Array.isArray(result.words) || !Array.isArray(result.faces)) throw new ObservationError('detector_incomplete');
      if (result.words.length > 8192 || result.faces.length > 512) throw new ObservationError('detector_output_limit');
      const textAngle = result.textAngle ?? 0;
      if (!Number.isFinite(textAngle) || Math.abs(textAngle) > 180) throw new ObservationError('ocr_rotation_invalid');
      const words = result.words.map(word => {
        if (!word || typeof word.text !== 'string' || word.text.length < 1 || word.text.length > 512) throw new ObservationError('ocr_word_invalid');
        return { text: word.text, ...positioned(checkedRect(word.rect, snapshot.width, snapshot.height), snapshot.geometry) };
      });
      const faces = result.faces.map(face => positioned(checkedRect(face?.rect, snapshot.width, snapshot.height), snapshot.geometry));
      const sanitizedPng = sanitize(snapshot, words, faces, textAngle, signal);
      return { status: 'complete', sourceId: snapshot.sourceId, sourceIdentity: snapshot.sourceIdentity, frameHash: snapshot.frameHash, width: snapshot.width, height: snapshot.height, words, faces, sanitizedPng, sanitizedFrameHash: hashPng(sanitizedPng), redaction: { text: true, faces: true }, ocrStatus: 'complete', faceStatus: 'complete' };
    } catch (error) {
      return failFrom(error, snapshot ?? frame);
    } finally {
      snapshot?.png.fill(0);
      end(operation);
    }
  }

  async function probe({ signal } = {}) {
    if (busy) return { status: 'failed', reason: 'busy' };
    const operation = begin(signal);
    signal = operation.signal;
    try {
      const result = await helper.run({ protocol: 1, operation: 'probe' }, { signal });
      checkAborted(signal);
      if (!result || result.protocol !== 1 || !['complete', 'unavailable', 'failed'].includes(result.status)) throw new ObservationError('detector_output_invalid');
      if (result.status !== 'complete') return { status: result.status, reason: typeof result.reason === 'string' && /^[a-zA-Z0-9_:.+-]{1,160}$/.test(result.reason) ? result.reason : 'detector_unavailable' };
      if (result.ocrStatus !== 'available' || result.faceStatus !== 'available' || !Array.isArray(result.languages) || result.languages.length > 128 || !result.languages.every(language => typeof language === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(language)) || !Number.isSafeInteger(result.maxImageDimension) || result.maxImageDimension < 1 || !Array.isArray(result.faceFormats) || result.faceFormats.length > 16 || !result.faceFormats.every(format => typeof format === 'string' && /^[a-zA-Z0-9]{1,32}$/.test(format)) || typeof result.powershellVersion !== 'string' || !/^\d+(\.\d+){1,3}$/.test(result.powershellVersion)) throw new ObservationError('detector_output_invalid');
      return { status: 'complete', ocr: { status: 'available', languages: result.languages, recognizerLanguage: result.recognizerLanguage, maxImageDimension: result.maxImageDimension }, face: { status: 'available', supportedPixelFormats: result.faceFormats }, powershellVersion: result.powershellVersion };
    } catch (error) {
      const result = failFrom(error);
      return { status: result.status, reason: result.reason };
    } finally {
      end(operation);
    }
  }

  async function stop() {
    const operation = active;
    operation?.controller.abort();
    await helper.stop();
    await operation?.done;
  }

  return Object.freeze({ detect, probe, stop });
}

module.exports = { createWindowsLocalDetector };
