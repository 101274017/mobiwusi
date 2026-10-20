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
  [['capture_time_invalid'], '本地帧时间校验未通过，已停止观察且未发送画面。请重新选择屏幕；若再次失败，请重启桌宠。'],
  [['capture_worker_closed', 'capture_renderer_gone', 'capture_worker_load_failed', 'capture_worker_start_failed', 'capture_worker_unresponsive', 'capture_media_failed', 'capture_frame_failed', 'capture_worker_failed', 'capture_session_invalidated', 'capture_or_detector_failed'], '本地捕获或检测失败，已停止观察且未发送画面。请重新选择屏幕；若再次失败，请重启桌宠。'],
].flatMap(([codes, message]) => codes.map(code => [code, message]))));

function captureFailureReason(reason) {
  return typeof reason === 'string' && Object.hasOwn(CAPTURE_FAILURE_MESSAGES, reason) ? reason : 'capture_or_detector_failed';
}

function captureFailureMessage(reason) {
  return typeof reason === 'string' && Object.hasOwn(CAPTURE_FAILURE_MESSAGES, reason) ? CAPTURE_FAILURE_MESSAGES[reason] : null;
}

const LOCAL_DETECTION_FAILURE_MESSAGES = Object.freeze(Object.fromEntries([
  [['no_readable_text'], '本地文字检测已完成，但当前范围没有识别到文字，已停止观察且未发送画面。请先亲手打开目标软件，再框选包含菜单或按钮文字的区域；空白画面不等于检测器损坏。'],
  [['local_detection_limit', 'local_text_limit', 'control_layout_limit', 'detector_output_limit', 'ocr_output_limit', 'helper_output_limit'], '当前观察范围的文字或控件超过本地处理上限，已停止观察且未发送画面。请本人继续共享时框选目标软件，减少无关窗口；不会截断检查结果后发送。'],
  [['incomplete_local_detection', 'local_detector_unavailable', 'detector_incomplete', 'detector_unavailable'], '本地文字或人脸检测没有完整完成，已停止观察且未发送画面。请停止后检查本地检测能力；反复点击继续共享不能修复检测器。'],
  [['local_redaction_invalid', 'unredacted_frame'], '本地脱敏结果未通过校验，已停止观察且未发送画面。请停止观察后检查本地检测器；不会改发原图。'],
  [['detector_frame_mismatch', 'invalid_local_regions', 'detection_rect_out_of_bounds'], '本地检测结果与当前画面或坐标不一致，已停止观察且未发送画面。请本人重新框选目标软件；调整分辨率或缩放后须重新授权。'],
  [['invalid_or_stale_frame'], '本地画面的时间或完整性校验失败，已停止观察且未发送画面。请停止观察后检查本地捕获能力，再由本人重新选择范围；不会用损坏画面或修改时间戳绕过检查。'],
  [['helper_timeout'], '本地文字或人脸检测超时，已停止观察且未发送画面。请关闭高负载应用后重新框选较小区域，不会跳过检测。'],
  [['ocr_language_unavailable'], 'Windows 本地文字识别语言不可用，已停止观察且未发送画面。请在系统语言设置中安装目标语言的文字识别组件后重新授权。'],
  [['face_detection_unavailable'], 'Windows 本地人脸检测不可用，已停止观察且未发送画面。请检查本机系统组件；不会关闭人脸保护后继续发送。'],
].flatMap(([codes, message]) => codes.map(code => [code, message]))));

function localDetectionFailureMessage(reason) {
  return typeof reason === 'string' && Object.hasOwn(LOCAL_DETECTION_FAILURE_MESSAGES, reason)
    ? `${LOCAL_DETECTION_FAILURE_MESSAGES[reason]}（${reason}）` : null;
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

module.exports = { LIMITS, ObservationError, captureFailureReason, captureFailureMessage, localDetectionFailureMessage, limitsFor, checkDimensions, matchesCaptureDimensions, pngDimensions, hashPng, checkGeometry, checkAborted, abortable };
