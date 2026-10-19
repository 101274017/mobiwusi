const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REQUIRED_CLIPS = ['idle', 'wave', 'guide', 'sign', 'success', 'rest_enter', 'rest_loop', 'rest_exit'];
const REQUIRED_EXPRESSIONS = ['smile', 'blink', 'listening', 'happy', 'sleepy', 'concern'];

function readPng(filePath) {
  const descriptor = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(24);
  try { if (fs.readSync(descriptor, header, 0, 24, 0) !== 24) throw new Error('栗栗 PNG 文件不完整'); }
  finally { fs.closeSync(descriptor); }
  if (header.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || header.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`栗栗资源不是有效 PNG：${path.basename(filePath)}`);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function resolveAsset(directory, relativePath) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) throw new Error('栗栗资源路径必须是相对路径');
  const resolved = fs.realpathSync(path.resolve(directory, relativePath));
  const relative = path.relative(directory, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('栗栗资源路径越界');
  if (path.extname(resolved).toLowerCase() !== '.png' || !fs.statSync(resolved).isFile()) throw new Error(`栗栗资源文件不存在：${relativePath}`);
  readPng(resolved);
  return resolved;
}

function loadLiliResource(directory) {
  const resolvedDirectory = fs.realpathSync(directory);
  const manifestPath = path.join(resolvedDirectory, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.id !== 'lili' || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('栗栗资源清单版本不兼容');
  if (manifest.fps !== 24 || manifest.canvas?.join() !== '384,384' || manifest.anchor?.join() !== '192,336') throw new Error('栗栗资源尺寸或锚点不兼容');
  if (!Array.isArray(manifest.atlases) || manifest.atlases.length !== 30 || !manifest.faces?.file) throw new Error('栗栗资源图集不完整');
  if (manifest.actions?.join() !== 'idle,wave,guide,sign,success,rest' || manifest.expressions?.join() !== REQUIRED_EXPRESSIONS.join()
    || manifest.faceCrop?.join() !== '128,128,128,80' || manifest.facing?.join() !== 'front') throw new Error('栗栗资源能力清单不兼容');
  for (const clip of REQUIRED_CLIPS) {
    if (!manifest.clips?.[clip] || !Array.isArray(manifest.frames?.[clip]) || manifest.frames[clip].length !== manifest.clips[clip].count) throw new Error(`栗栗动作资源不完整：${clip}`);
    const definition = manifest.clips[clip];
    if (!Number.isInteger(definition.count) || definition.count < 1 || definition.count > 1000 || typeof definition.loop !== 'boolean'
      || typeof definition.interruptible !== 'boolean' || !Number.isFinite(definition.priority) || definition.priority < 0 || definition.priority > 100
      || !REQUIRED_EXPRESSIONS.includes(definition.expression)) throw new Error(`栗栗动作定义无效：${clip}`);
    for (const frame of manifest.frames[clip]) {
      if (!frame || !Number.isInteger(frame.atlas) || frame.atlas < 0 || frame.atlas >= 30
        || !Number.isInteger(frame.x) || !Number.isInteger(frame.y) || frame.x < 0 || frame.y < 0 || frame.x + 384 > 1920 || frame.y + 384 > 1920
        || !Number.isInteger(frame.eye) || frame.eye < 0 || frame.eye > 3 || !Array.isArray(frame.faceTransform) || frame.faceTransform.length !== 6
        || frame.faceTransform.some(value => !Number.isFinite(value) || Math.abs(value) > 1024)) throw new Error(`栗栗动作帧无效：${clip}`);
    }
  }
  for (const expression of REQUIRED_EXPRESSIONS) {
    if (!Array.isArray(manifest.faces.frames?.[expression]) || manifest.faces.frames[expression].length !== 4) throw new Error(`栗栗表情资源不完整：${expression}`);
    for (const tile of manifest.faces.frames[expression]) {
      if (!Array.isArray(tile) || tile.length !== 4 || tile.some(value => !Number.isInteger(value))
        || tile[0] < 0 || tile[1] < 0 || tile[2] !== 128 || tile[3] !== 80 || tile[0] + 128 > 512 || tile[1] + 80 > 480) throw new Error(`栗栗表情坐标无效：${expression}`);
    }
  }
  const atlases = manifest.atlases.map(relativePath => resolveAsset(resolvedDirectory, relativePath));
  const faceAtlas = resolveAsset(resolvedDirectory, manifest.faces.file);
  if (atlases.some(filePath => { const size = readPng(filePath); return size.width !== 1920 || size.height !== 1920; })
    || readPng(faceAtlas).width !== 512 || readPng(faceAtlas).height !== 480) throw new Error('栗栗图集尺寸不兼容');
  return { manifest, atlases, faceAtlas, baseUrl: pathToFileURL(resolvedDirectory + path.sep).href };
}

function describeLiliResource(resource) {
  return { id: resource.manifest.id, name: resource.manifest.name, version: resource.manifest.version, fps: resource.manifest.fps,
    canvas: resource.manifest.canvas, anchor: resource.manifest.anchor, actions: resource.manifest.actions, expressions: resource.manifest.expressions,
    capabilities: { animation: true, expressionIntensity: true, frontOnly: true, runtimeNeedsBlender: false } };
}

module.exports = { loadLiliResource, describeLiliResource };
