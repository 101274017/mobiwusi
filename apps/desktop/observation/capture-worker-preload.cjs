const { contextBridge, ipcRenderer } = require('electron');

const argument = process.argv.find(value => value.startsWith('--nuanban-capture='));
let configuration;
try { configuration = JSON.parse(argument?.slice('--nuanban-capture='.length) ?? 'null'); } catch {}
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
if (!configuration || !uuid.test(configuration.token) || configuration.channel !== `nuanban-capture-${configuration.token}` || !Number.isSafeInteger(configuration.generation) || configuration.generation < 1 || !/^screen:\d+:\d+$/.test(configuration.sourceId) || !/^[a-f0-9]{64}$/.test(configuration.sourceIdentity) || !Number.isSafeInteger(configuration.width) || !Number.isSafeInteger(configuration.height) || configuration.width < 1 || configuration.height < 1 || configuration.width > 8192 || configuration.height > 8192 || configuration.width * configuration.height > 16_777_216 || !Number.isSafeInteger(configuration.maxPngBytes) || configuration.maxPngBytes < 33 || configuration.maxPngBytes > 24 * 1024 * 1024 || !Number.isSafeInteger(configuration.maxPixels) || configuration.width * configuration.height > configuration.maxPixels) throw new Error('capture_configuration_invalid');
if (!Number.isSafeInteger(configuration.maxDimension) || configuration.maxDimension < 1 || configuration.maxDimension > 8192 || configuration.maxPixels < 1 || configuration.maxPixels > 16_777_216 || ['Width', 'Height'].some(axis => {
  const minimum = configuration[`min${axis}`];
  const maximum = configuration[`max${axis}`];
  const expected = configuration[axis.toLowerCase()];
  return !Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum < 1 || maximum < minimum || maximum - minimum > 1 || maximum > 8192 || expected < minimum || expected > maximum;
})) throw new Error('capture_configuration_invalid');
configuration = Object.freeze(configuration);
let subscribed = false;
let frameSize = null;

function validDimensions(width, height) {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width >= configuration.minWidth && width <= configuration.maxWidth && height >= configuration.minHeight && height <= configuration.maxHeight && width <= configuration.maxDimension && height <= configuration.maxDimension && width * height <= configuration.maxPixels;
}

function post(kind, packet = {}) {
  if (!['ready', 'frame', 'ended', 'error', 'stopped'].includes(kind)) return;
  const payload = { kind, token: configuration.token, generation: configuration.generation, sourceId: configuration.sourceId, sourceIdentity: configuration.sourceIdentity };
  if (kind === 'frame') {
    if (!frameSize || !uuid.test(packet.requestId) || !(packet.png instanceof ArrayBuffer) || packet.png.byteLength < 33 || packet.png.byteLength > configuration.maxPngBytes || packet.width !== frameSize.width || packet.height !== frameSize.height) return;
    Object.assign(payload, { requestId: packet.requestId, capturedAt: packet.capturedAt, png: packet.png, width: packet.width, height: packet.height });
  }
  if (kind === 'ready') {
    if (frameSize || !validDimensions(packet.width, packet.height)) return;
    frameSize = Object.freeze({ width: packet.width, height: packet.height });
    Object.assign(payload, { width: packet.width, height: packet.height });
  }
  if (kind === 'error') payload.reason = /^capture_[a-z_]{1,60}$/.test(packet.reason) ? packet.reason : 'capture_worker_failed';
  try { ipcRenderer.send(configuration.channel, payload); } finally { if (kind === 'frame') new Uint8Array(packet.png).fill(0); }
}

contextBridge.exposeInMainWorld('captureHost', Object.freeze({
  configuration: Object.freeze({ width: configuration.width, height: configuration.height, minWidth: configuration.minWidth, maxWidth: configuration.maxWidth, minHeight: configuration.minHeight, maxHeight: configuration.maxHeight, maxDimension: configuration.maxDimension, maxPngBytes: configuration.maxPngBytes, maxPixels: configuration.maxPixels }),
  post,
  onCommand(callback) {
    if (subscribed || typeof callback !== 'function') return;
    subscribed = true;
    ipcRenderer.on(`${configuration.channel}:command`, (event, message) => {
      if (!message || message.token !== configuration.token || message.generation !== configuration.generation || message.sourceId !== configuration.sourceId || !['capture', 'stop'].includes(message.kind)) return;
      if (message.kind === 'capture' && !uuid.test(message.requestId)) return;
      callback(Object.freeze({ kind: message.kind, requestId: message.requestId }));
    });
  },
}));
