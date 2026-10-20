import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node scripts/prepare-lumi-model.mjs <original Lumi_Magical_Kitten.glb>');
const source = readFileSync(resolve(sourcePath));
const sourceHash = createHash('sha256').update(source).digest('hex');
if (sourceHash !== '4f731fa804dd92883c53b7fcaa7965720a2b822ea733be668db0dc04ec0f0319') throw new Error('This preparation step only accepts the verified Lumi v1.0.0 source asset');
const jsonLength = source.readUInt32LE(12);
const document = JSON.parse(source.toString('utf8', 20, 20 + jsonLength));
const binary = source.subarray(28 + jsonLength);
const parts = [binary];
let offset = binary.length;
let expanded = 0;

for (const accessor of document.accessors) {
  if (!accessor.sparse) continue;
  if (accessor.componentType !== 5126 || accessor.type !== 'VEC3' || accessor.bufferView !== undefined) throw new Error('Unexpected sparse layout in the verified source');
  const sparse = accessor.sparse;
  const indices = document.bufferViews[sparse.indices.bufferView];
  const values = document.bufferViews[sparse.values.bufferView];
  const indexSize = { 5121: 1, 5123: 2, 5125: 4 }[sparse.indices.componentType];
  if (!indexSize) throw new Error('Unsupported sparse index component');
  const dense = Buffer.alloc(accessor.count * 12);
  let previous = -1;
  for (let entry = 0; entry < sparse.count; entry++) {
    const indexOffset = (indices.byteOffset ?? 0) + (sparse.indices.byteOffset ?? 0) + entry * indexSize;
    const vertex = binary.readUIntLE(indexOffset, indexSize);
    if (vertex <= previous || vertex >= accessor.count) throw new Error('Invalid sparse index');
    previous = vertex;
    const valueOffset = (values.byteOffset ?? 0) + (sparse.values.byteOffset ?? 0) + entry * 12;
    binary.copy(dense, vertex * 12, valueOffset, valueOffset + 12);
  }
  accessor.bufferView = document.bufferViews.length;
  accessor.byteOffset = 0;
  document.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: dense.length });
  delete accessor.sparse;
  parts.push(dense);
  offset += dense.length;
  expanded++;
}

document.buffers[0].byteLength = offset;
const json = Buffer.from(JSON.stringify(document));
const padding = Buffer.alloc((4 - json.length % 4) % 4, 0x20);
const jsonChunk = Buffer.concat([json, padding]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + jsonChunk.length + offset, 8);
header.writeUInt32LE(jsonChunk.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(offset, 0);
binaryHeader.writeUInt32LE(0x004e4942, 4);
const runtime = Buffer.concat([header, jsonChunk, binaryHeader, ...parts]);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/web/public/models/lumi');
writeFileSync(join(root, 'Lumi_Magical_Kitten.glb'), runtime);
const manifest = JSON.parse(readFileSync(join(root, 'character_manifest.json'), 'utf8'));
manifest.runtime.fileBytes = runtime.length;
manifest.runtime.preparation = { sourceSha256: sourceHash, runtimeSha256: createHash('sha256').update(runtime).digest('hex'), expandedSparseAccessors: expanded, operation: 'Lossless sparse-to-dense morph accessor expansion; geometry, animations and material values unchanged.' };
writeFileSync(join(root, 'character_manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ fileBytes: runtime.length, ...manifest.runtime.preparation }, null, 2));
