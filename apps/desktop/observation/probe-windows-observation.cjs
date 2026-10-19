const { app, nativeImage } = require('electron');
const { createHash } = require('node:crypto');
const { createWindowsObservationSource } = require('./windows-observation-source.cjs');

const GLYPHS = {
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
};

function syntheticFrame() {
  const width = 800;
  const height = 220;
  const bitmap = Buffer.alloc(width * height * 4, 255);
  const scale = 8;
  for (const [characterIndex, character] of [...'HELLO 1234'].entries()) {
    const glyph = GLYPHS[character];
    if (!glyph) continue;
    for (const [rowIndex, row] of glyph.entries()) {
      for (const [columnIndex, pixel] of [...row].entries()) {
        if (pixel !== '1') continue;
        const left = 48 + characterIndex * 6 * scale + columnIndex * scale;
        const top = 64 + rowIndex * scale;
        for (let pixelRow = top; pixelRow < top + scale; pixelRow += 1) bitmap.fill(Buffer.from([0, 0, 0, 255]), (pixelRow * width + left) * 4, (pixelRow * width + left + scale) * 4);
      }
    }
  }
  const png = nativeImage.createFromBitmap(bitmap, { width, height, scaleFactor: 1 }).toPNG();
  bitmap.fill(0);
  return { sourceId: 'screen:0:0', sourceIdentity: '0'.repeat(64), frameHash: createHash('sha256').update(png).digest('hex'), capturedAt: Date.now(), width, height, png, geometry: { coordinateSpace: 'screen-dip', x: -800, y: 0, width, height, scaleFactor: 1, pixelX: -800, pixelY: 0, pixelWidth: width, pixelHeight: height, rotation: 0 } };
}

app.whenReady().then(async () => {
  let captureCalls = 0;
  const source = createWindowsObservationSource({ nativeImage, desktopCapturer: { getSources: async () => { captureCalls += 1; throw new Error('probe_capture_forbidden'); } }, screen: { getAllDisplays: () => [] } });
  let frame;
  let detection;
  let exitCode = 1;
  try {
    const support = await source.probe();
    const report = { support, captureCalls };
    if (support.status === 'complete' && process.argv.includes('--synthetic')) {
      frame = syntheticFrame();
      detection = await source.detect(frame);
      if (detection.status === 'complete') {
        const bitmap = nativeImage.createFromBuffer(detection.sanitizedPng).toBitmap();
        let allWordRegionsBlack = true;
        for (const word of detection.words) {
          for (let row = Math.floor(word.rect.y); row < Math.ceil(word.rect.y + word.rect.height); row += 1) {
            for (let column = Math.floor(word.rect.x); column < Math.ceil(word.rect.x + word.rect.width); column += 1) {
              if (bitmap.readUInt32LE((row * frame.width + column) * 4) !== 0xff000000) allWordRegionsBlack = false;
            }
          }
        }
        report.synthetic = { status: detection.status, wordsDetected: detection.words.length, facesDetected: detection.faces.length, fullFrameDimensions: detection.width === frame.width && detection.height === frame.height, sameFrameHash: detection.frameHash === frame.frameHash, originalUnchanged: createHash('sha256').update(frame.png).digest('hex') === frame.frameHash, sanitizedHashChanged: detection.sanitizedFrameHash !== frame.frameHash, allWordRegionsBlack, nonTextCornerPreserved: bitmap.readUInt32LE(0) === 0xffffffff, redaction: detection.redaction };
        bitmap.fill(0);
        exitCode = detection.words.length > 0 && allWordRegionsBlack && report.synthetic.nonTextCornerPreserved && report.synthetic.sameFrameHash && report.synthetic.fullFrameDimensions && report.synthetic.originalUnchanged && report.synthetic.sanitizedHashChanged ? 0 : 1;
      } else {
        report.synthetic = { status: detection.status, reason: detection.reason };
      }
    } else if (support.status === 'complete') {
      exitCode = 0;
    }
    report.captureCalls = captureCalls;
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } catch {
    process.stdout.write('{"status":"failed","reason":"probe_failed"}\n');
  } finally {
    frame?.png.fill(0);
    detection?.sanitizedPng?.fill(0);
    await source.stop();
    app.exit(exitCode);
  }
});
