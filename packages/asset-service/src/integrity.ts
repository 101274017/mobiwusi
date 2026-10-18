import { createHash } from 'node:crypto';
import { assessAnimatedPetAsset, validAnimatedPetAsset } from '../../pet-engine/src/index.ts';
import { AssetServiceError, type AssetBundle, type GeneratedAsset, type JsonValue } from './ports.ts';

export function canonicalJson(value: JsonValue): string {
  let nodes = 0;
  const visit = (item: JsonValue, depth: number): string => {
    if (++nodes > 100_000 || depth > 32) throw new AssetServiceError('INVALID_REQUEST');
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (Array.isArray(item)) return '[' + item.map(child => visit(child, depth + 1)).join(',') + ']';
    if (typeof item !== 'object' || !item || ![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new AssetServiceError('INVALID_REQUEST');
    return '{' + Object.keys(item).sort().map(key => {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new AssetServiceError('INVALID_REQUEST');
      return JSON.stringify(key) + ':' + visit(item[key], depth + 1);
    }).join(',') + '}';
  };
  const encoded = visit(value, 0);
  if (Buffer.byteLength(encoded) > 512 * 1024) throw new AssetServiceError('INVALID_REQUEST');
  return encoded;
}

export function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function validateAssetBundle(bundle: AssetBundle, expectedAssetId: string): Pick<GeneratedAsset, 'manifest' | 'files' | 'hash' | 'quality'> {
  try {
    if (!bundle || !validAnimatedPetAsset(bundle.manifest) || bundle.manifest.assetId !== expectedAssetId || !Array.isArray(bundle.files) || bundle.files.length < 1 || bundle.files.length > 64) throw new Error();
    const manifest = structuredClone(bundle.manifest);
    const paths = new Set<string>();
    let totalBytes = 0;
    const files = bundle.files.map(file => {
      if (!file || typeof file.path !== 'string' || !file.path.startsWith(`assets/${expectedAssetId}/`) || !/^assets\/[a-zA-Z0-9-]+\/[a-zA-Z0-9/_-]+\.(png|webp)$/.test(file.path) || paths.has(file.path) || !(file.bytes instanceof Uint8Array) || file.bytes.byteLength === 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error();
      totalBytes += file.bytes.byteLength;
      if (totalBytes > 64 * 1024 * 1024 || sha256(file.bytes) !== file.sha256) throw new Error();
      paths.add(file.path);
      return { path: file.path, sha256: file.sha256, bytes: new Uint8Array(file.bytes) };
    });
    if (manifest.layers.some(layer => !paths.has(layer.source)) || paths.size !== new Set(manifest.layers.map(layer => layer.source)).size) throw new Error();
    files.sort((first, second) => first.path.localeCompare(second.path, 'en'));
    const hash = sha256(canonicalJson({ manifest: manifest as unknown as JsonValue, files: files.map(file => ({ path: file.path, sha256: file.sha256, size: file.bytes.byteLength })) }));
    return { manifest, files, hash, quality: assessAnimatedPetAsset(manifest) };
  } catch { throw new AssetServiceError('INVALID_ASSET'); }
}
