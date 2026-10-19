const { deflateSync } = require('node:zlib');
const { checkDimensions, ObservationError } = require('./observation-common.cjs');

function pngChunk(name, data) {
  const content = Buffer.concat([Buffer.from(name, 'ascii'), data]);
  let checksum = 0xffffffff;
  for (const byte of content) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) checksum = (checksum >>> 1) ^ ((checksum & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((checksum ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, content, crc]);
}

function createControlLayout(controls, width, height) {
  checkDimensions(width, height);
  if (!Array.isArray(controls) || controls.length < 1 || controls.length > 1024) throw new ObservationError('control_layout_invalid');
  const rectangles = controls.map(control => {
    const rect = control?.rect;
    if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
      || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0
      || rect.x + rect.width > width || rect.y + rect.height > height) throw new ObservationError('control_layout_invalid');
    return { left: Math.floor(rect.x), top: Math.floor(rect.y), right: Math.ceil(rect.x + rect.width), bottom: Math.ceil(rect.y + rect.height) };
  });
  if (rectangles.reduce((total, rect) => total + (rect.right - rect.left) * (rect.bottom - rect.top), 0) > 67_108_864) throw new ObservationError('control_layout_limit');
  const stride = width + 1;
  const pixels = Buffer.alloc(stride * height, 255);
  let compressed;
  try {
    for (let row = 0; row < height; row += 1) pixels[row * stride] = 0;
    for (const rect of rectangles) {
      for (let row = rect.top; row < rect.bottom; row += 1) pixels.fill(48, row * stride + 1 + rect.left, row * stride + 1 + rect.right);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    compressed = deflateSync(pixels);
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
  } finally {
    pixels.fill(0);
    compressed?.fill(0);
  }
}

module.exports = { createControlLayout };
