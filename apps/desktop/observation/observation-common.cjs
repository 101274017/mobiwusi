const { createHash } = require('node:crypto');

const LIMITS = Object.freeze({ maxPngBytes: 24 * 1024 * 1024, maxPixels: 16_777_216, maxDimension: 8192, maxSources: 128 });
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

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

module.exports = { LIMITS, ObservationError, limitsFor, checkDimensions, pngDimensions, hashPng, checkGeometry, checkAborted, abortable };
