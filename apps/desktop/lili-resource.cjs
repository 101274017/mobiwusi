const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REQUIRED_CLIPS = ['idle', 'wave', 'guide', 'sign', 'success', 'rest_enter', 'rest_loop', 'rest_exit'];
const REQUIRED_EXPRESSIONS = ['smile', 'blink', 'listening', 'happy', 'sleepy', 'concern'];

function readPng(filePath) {
  const header = fs.readFileSync(filePath).subarray(0, 24);
  if (header.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`栗栗资源不是有效 PNG：${path.basename(filePath)}`);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function resolveAsset(directory, relativePath) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) throw new Error('栗栗资源路径必须是相对路径');
  const resolved = path.resolve(directory, relativePath);
  if (!resolved.startsWith(directory + path.sep)) throw new Error('栗栗资源路径越界');
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
  for (const clip of REQUIRED_CLIPS) {
    if (!manifest.clips?.[clip] || !Array.isArray(manifest.frames?.[clip]) || manifest.frames[clip].length !== manifest.clips[clip].count) throw new Error(`栗栗动作资源不完整：${clip}`);
  }
  for (const expression of REQUIRED_EXPRESSIONS) {
    if (!Array.isArray(manifest.faces.frames?.[expression]) || manifest.faces.frames[expression].length !== 4) throw new Error(`栗栗表情资源不完整：${expression}`);
  }
  const atlases = manifest.atlases.map(relativePath => resolveAsset(resolvedDirectory, relativePath));
  const faceAtlas = resolveAsset(resolvedDirectory, manifest.faces.file);
  return { manifest, atlases, faceAtlas, baseUrl: pathToFileURL(resolvedDirectory + path.sep).href };
}

function describeLiliResource(resource) {
  return { id: resource.manifest.id, name: resource.manifest.name, version: resource.manifest.version, fps: resource.manifest.fps,
    canvas: resource.manifest.canvas, anchor: resource.manifest.anchor, actions: resource.manifest.actions, expressions: resource.manifest.expressions,
    capabilities: { animation: true, expressionIntensity: true, frontOnly: true, runtimeNeedsBlender: false } };
}

module.exports = { loadLiliResource, describeLiliResource };
