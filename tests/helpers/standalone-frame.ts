import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import type { LocalDetection, ObservationFrame, ScreenGeometry } from '../../apps/desktop/observation-policy.cjs';

function pngChunk(name: string, data: Buffer): Buffer {
  const content = Buffer.concat([Buffer.from(name), data]);
  let checksum = 0xffffffff;
  for (const byte of content) {
    checksum ^= byte;
    for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) checksum = (checksum >>> 1) ^ ((checksum & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((checksum ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, content, crc]);
}

export function syntheticPng(shade = 255, width = 800, height = 600, noisyBackground = false): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height, shade);
  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) pixels[rowIndex * (width * 3 + 1)] = 0;
  if (noisyBackground) {
    let noiseState = 123456789;
    for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
      for (let columnIndex = Math.floor(width / 3); columnIndex < width; columnIndex += 1) {
        for (let channel = 0; channel < 3; channel += 1) {
          noiseState ^= noiseState << 13;
          noiseState ^= noiseState >>> 17;
          noiseState ^= noiseState << 5;
          pixels[rowIndex * (width * 3 + 1) + 1 + columnIndex * 3 + channel] = noiseState & 255;
        }
      }
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(pixels)), pngChunk('IEND', Buffer.alloc(0))]);
}

export function syntheticFrame(geometry: ScreenGeometry | null = { x: -800, y: 0, width: 800, height: 600, scaleFactor: 1 }, now = Date.now()): ObservationFrame {
  const png = syntheticPng();
  return { sourceId: 'screen:test:0', sourceName: '合成测试屏幕', displayId: 'test', frameId: `frame_${now}`, frameHash: createHash('sha256').update(png).digest('hex'), capturedAt: now, width: 800, height: 600, png, geometry };
}

export function syntheticDetection(frame: ObservationFrame, labels = ['设置', '显示', '文本大小', '返回']): LocalDetection {
  return { status: 'complete', frameHash: frame.frameHash, width: frame.width, height: frame.height,
    words: labels.map((text, index) => ({ text, rect: { x: 20, y: 20 + index * 40, width: 100, height: 30 } })),
    faces: [], sanitizedPng: syntheticPng(0), redaction: { text: true, faces: true } };
}
