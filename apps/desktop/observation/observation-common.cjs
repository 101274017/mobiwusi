const { createHash } = require('node:crypto');

const LIMITS = Object.freeze({ maxPngBytes: 24 * 1024 * 1024, maxPixels: 16_777_216, maxDimension: 8192, maxSources: 128 });
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CAPTURE_FAILURE_MESSAGES = Object.freeze(Object.fromEntries([
  [['capture_region_invalid', 'capture_region_changed'], '观察区域无效或已经改变，已停止观察。请本人重新框选区域并确认授权。'],
  [['capture_region_unavailable'], '本地区域裁剪不可用，已停止观察；不会改为观察整个屏幕。请重新框选或重启桌宠。'],
  [['capture_dimensions_unproven', 'geometry_unproven', 'image_dimensions_invalid'], '屏幕实际像素与共享范围不一致，已停止观察。请重新选择屏幕；更改分辨率或缩放后需重新授权。'],
  [['capture_permission_denied', 'capture_grant_denied', 'capture_grant_failed', 'consent_required'], '未获得本次屏幕捕获权限，已停止观察。请本人重新选择屏幕并确认授权；不会自动重试或开启。'],
  [['source_changed', 'source_lost', 'capture_source_changed', 'capture_source_unproven', 'source_not_selected'], '所选屏幕已断开或范围发生变化，已停止观察。请重新选择共享屏幕。'],
  [['capture_track_ended'], '系统已结束本次屏幕共享，观察已停止。请本人重新选择屏幕并确认授权。'],
  [['capture_refresh_unavailable'], '屏幕实时帧刷新不可用，已停止观察。请退出桌宠后重新启动；不会用旧截图冒充新画面。'],
  [['timeout'], '本地捕获或检测超时，已停止观察且未发送画面。请稍后重新选择屏幕再试。'],
  [['controlled_capture_unavailable', 'windows_capture_unavailable', 'capture_media_unavailable'], '当前屏幕捕获组件不可用，已停止观察。请退出桌宠后重新启动。'],
  [['capture_worker_closed', 'capture_renderer_gone', 'capture_worker_load_failed', 'capture_worker_start_failed', 'capture_worker_unresponsive', 'capture_media_failed', 'capture_frame_failed', 'capture_worker_failed', 'capture_session_invalidated', 'capture_or_detector_failed'], '本地捕获或检测失败，已停止观察且未发送画面。请重新选择屏幕；若再次失败，请重启桌宠。'],
].flatMap(([codes, message]) => codes.map(code => [code, message]))));

function captureFailureReason(reason) {
  return typeof reason === 'string' && Object.hasOwn(CAPTURE_FAILURE_MESSAGES, reason) ? reason : 'capture_or_detector_failed';
}

function captureFailureMessage(reason) {
  return typeof reason === 'string' && Object.hasOwn(CAPTURE_FAILURE_MESSAGES, reason) ? CAPTURE_FAILURE_MESSAGES[reason] : null;
}

class ObservationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ObservationError';
    this.code = code;
  }
}

function limitsFor(overrides = {}) {
  const limits = {};
  for (const [key, maximum] of Object.entries(LIMITS)) {
    const value = overrides[key] ?? maximum;
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new ObservationError('invalid_limits');
    limits[key] = value;
  }
  return limits;
}

function checkDimensions(width, height, limits = LIMITS) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > limits.maxDimension || height > limits.maxDimension || width * height > limits.maxPixels) throw new ObservationError('image_dimensions_invalid');
}

function matchesCaptureDimensions(configuration, width, height, limits = LIMITS) {
  try { checkDimensions(width, height, limits); } catch { return false; }
  return width >= configuration.minWidth && width <= configuration.maxWidth && height >= configuration.minHeight && height <= configuration.maxHeight;
}

function pngDimensions(png, limits = LIMITS) {
  if (!Buffer.isBuffer(png) || png.length < 33 || png.length > limits.maxPngBytes || !png.subarray(0, 8).equals(PNG_SIGNATURE) || png.readUInt32BE(8) !== 13 || png.toString('ascii', 12, 16) !== 'IHDR') throw new ObservationError('png_invalid');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  checkDimensions(width, height, limits);
  return { width, height };
}

function hashPng(png) {
  return createHash('sha256').update(png).digest('hex');
}

function checkGeometry(geometry, width, height) {
  if (!geometry || geometry.coordinateSpace !== 'screen-dip') throw new ObservationError('geometry_unproven');
  const { x: originX, y: originY, width: dipWidth, height: dipHeight, pixelX, pixelY, pixelWidth, pixelHeight, scaleFactor, rotation } = geometry;
  if (![originX, originY, dipWidth, dipHeight, pixelX, pixelY, pixelWidth, pixelHeight].every(Number.isSafeInteger) || Math.abs(originX) > 10_000_000 || Math.abs(originY) > 10_000_000 || Math.abs(pixelX) > 10_000_000 || Math.abs(pixelY) > 10_000_000 || dipWidth <= 0 || dipHeight <= 0 || !Number.isFinite(scaleFactor) || scaleFactor < 0.5 || scaleFactor > 8 || ![0, 90, 180, 270].includes(rotation) || pixelWidth !== width || pixelHeight !== height || Math.abs(dipWidth * scaleFactor - pixelWidth) > 1 || Math.abs(dipHeight * scaleFactor - pixelHeight) > 1) throw new ObservationError('geometry_unproven');
  return Object.freeze({ coordinateSpace: 'screen-dip', x: originX, y: originY, width: dipWidth, height: dipHeight, pixelX, pixelY, pixelWidth, pixelHeight, scaleFactor, rotation });
}

function checkAborted(signal) {
  if (signal?.aborted) throw new ObservationError('aborted');
}

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason instanceof ObservationError ? signal.reason : new ObservationError('aborted'));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason instanceof ObservationError ? signal.reason : new ObservationError('aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

module.exports = { LIMITS, ObservationError, captureFailureReason, captureFailureMessage, limitsFor, checkDimensions, matchesCaptureDimensions, pngDimensions, hashPng, checkGeometry, checkAborted, abortable };
