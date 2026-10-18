export type ThreeDFormat = 'vrm' | 'fbx' | 'glb';
export type ThreeDPreflightDisposition = 'preview_allowed' | 'fallback_2d' | 'review_required';
export type ThreeDActionCompatibility = 'supported' | 'display_only' | 'unknown';
export type ThreeDMaterialKind = 'pbr' | 'unlit' | 'mtoon' | 'standard' | 'unknown';
export type ThreeDSkeletonKind = 'vrm_humanoid' | 'humanoid' | 'generic_skin' | 'fbx_skeleton' | 'none' | 'unknown';

export interface ThreeDTextureDimension {
  width: number;
  height: number;
}

export interface ThreeDInspection {
  formatVersion: string;
  textureDimensions: ThreeDTextureDimension[];
  triangleCount: number;
  boneCount: number;
  animationCount: number;
  decodedBytes: number;
  parserPeakBytes: number;
  externalUris: string[];
  scriptReferences: string[];
  materialKinds: ThreeDMaterialKind[];
  skeleton: ThreeDSkeletonKind;
}

export interface ThreeDAssetCandidate {
  fileName: string;
  bytes: Uint8Array;
  declaredFormat?: ThreeDFormat;
  inspection?: ThreeDInspection;
}

export interface ThreeDFormatSupportSpec {
  format: ThreeDFormat;
  targetVersions: string[];
  container: string;
  materials: ThreeDMaterialKind[];
  actionSkeletons: ThreeDSkeletonKind[];
  desktop: 'candidate';
  android: 'disabled';
  localOnly: true;
  externalUris: 'forbidden';
  scripts: 'forbidden';
}

export interface ThreeDPreflightCheck {
  code: ThreeDPreflightCode;
  passed: boolean;
  detail: string;
}

export type ThreeDPreflightCode =
  | 'INVALID_INPUT'
  | 'LOCAL_FILENAME'
  | 'FILE_SIZE_LIMIT'
  | 'UNRECOGNIZED_CONTAINER'
  | 'INVALID_GLB_CONTAINER'
  | 'INVALID_FBX_CONTAINER'
  | 'DECLARED_FORMAT_MISMATCH'
  | 'UNSUPPORTED_VERSION'
  | 'INSPECTION_REQUIRED'
  | 'INVALID_INSPECTION'
  | 'EXTERNAL_URI'
  | 'SCRIPT_REFERENCE'
  | 'UNKNOWN_TEXTURE_DIMENSION'
  | 'TEXTURE_SIZE_LIMIT'
  | 'TRIANGLE_LIMIT'
  | 'PARSER_MEMORY_LIMIT'
  | 'DECODED_MEMORY_LIMIT'
  | 'COMPRESSION_RATIO_LIMIT'
  | 'UNSUPPORTED_MATERIAL'
  | 'UNSUPPORTED_PRIMITIVE'
  | 'ACTION_SKELETON_UNAVAILABLE';

export interface ThreeDPreflightReport {
  detectedFormat: ThreeDFormat | null;
  disposition: ThreeDPreflightDisposition;
  previewAllowed: boolean;
  fallbackTo2d: boolean;
  manualReviewRequired: true;
  actionCompatibility: ThreeDActionCompatibility;
  support: ThreeDFormatSupportSpec | null;
  inspection: ThreeDInspection | null;
  checks: ThreeDPreflightCheck[];
  failureCodes: ThreeDPreflightCode[];
}

export const threeDBudgets = {
  maxFileBytes: 50 * 1024 * 1024,
  maxTextureDimension: 2048,
  maxTriangles: 100_000,
  maxParserPeakBytes: 512 * 1024 * 1024,
  maxDecodedBytes: 300 * 1024 * 1024,
  maxExpansionRatio: 100,
} as const;

export const threeDSupportMatrix: readonly ThreeDFormatSupportSpec[] = [
  {
    format: 'vrm',
    targetVersions: ['0.x', '1.0'],
    container: 'GLB / glTF 2.0 with VRM extension',
    materials: ['pbr', 'unlit', 'mtoon', 'standard'],
    actionSkeletons: ['vrm_humanoid'],
    desktop: 'candidate',
    android: 'disabled',
    localOnly: true,
    externalUris: 'forbidden',
    scripts: 'forbidden',
  },
  {
    format: 'fbx',
    targetVersions: ['7.4', '7.5'],
    container: 'FBX binary or ASCII; isolated parser required',
    materials: ['pbr', 'unlit', 'mtoon', 'standard'],
    actionSkeletons: ['humanoid'],
    desktop: 'candidate',
    android: 'disabled',
    localOnly: true,
    externalUris: 'forbidden',
    scripts: 'forbidden',
  },
  {
    format: 'glb',
    targetVersions: ['2.0'],
    container: 'GLB / glTF 2.0',
    materials: ['pbr', 'unlit', 'standard'],
    actionSkeletons: ['humanoid'],
    desktop: 'candidate',
    android: 'disabled',
    localOnly: true,
    externalUris: 'forbidden',
    scripts: 'forbidden',
  },
] as const;

const glbMagic = 0x46546c67;
const fbxBinaryHeader = 'Kaydara FBX Binary';
const allowedGlbExtensions = new Set([
  'KHR_materials_unlit',
  'KHR_texture_transform',
  'KHR_mesh_quantization',
  'KHR_lights_punctual',
  'VRM',
  'VRMC_vrm',
  'VRMC_materials_mtoon',
]);
const supportedMaterialKinds = new Set<ThreeDMaterialKind>(['pbr', 'unlit', 'mtoon', 'standard']);
const inspectionSkeletons = new Set<ThreeDSkeletonKind>(['vrm_humanoid', 'humanoid', 'generic_skin', 'fbx_skeleton', 'none', 'unknown']);
const inspectionKeys = [
  'formatVersion',
  'textureDimensions',
  'triangleCount',
  'boneCount',
  'animationCount',
  'decodedBytes',
  'parserPeakBytes',
  'externalUris',
  'scriptReferences',
  'materialKinds',
  'skeleton',
] as const;

interface GlbContainer {
  json: Record<string, unknown>;
  binary: Uint8Array;
  version: number;
}

interface ContainerProbe {
  detectedFormat: ThreeDFormat | null;
  container: GlbContainer | null;
  formatVersion: string | null;
  failure: ThreeDPreflightCode | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function positiveInteger(value: unknown): value is number {
  return integer(value, 1);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function readAscii(bytes: Uint8Array, length: number): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, Math.min(bytes.length, length)));
}

function readUint32(bytes: Uint8Array, offset: number, littleEndian: boolean): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, littleEndian);
}

function readUint16(bytes: Uint8Array, offset: number, littleEndian: boolean): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, littleEndian);
}

function array<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function child(value: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const candidate = value[key];
  return record(candidate) ? candidate : null;
}

function joinBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function parseGlb(bytes: Uint8Array): { container: GlbContainer | null; failure: ThreeDPreflightCode | null } {
  const magic = readUint32(bytes, 0, true);
  const version = readUint32(bytes, 4, true);
  const length = readUint32(bytes, 8, true);
  if (magic !== glbMagic || version !== 2 || length !== bytes.length || bytes.length < 20) return { container: null, failure: 'INVALID_GLB_CONTAINER' };
  let offset = 12;
  let jsonChunk: Uint8Array | null = null;
  const binaryChunks: Uint8Array[] = [];
  while (offset < bytes.length) {
    const chunkLength = readUint32(bytes, offset, true);
    const chunkType = readUint32(bytes, offset + 4, true);
    if (chunkLength === null || chunkType === null || chunkLength % 4 !== 0 || offset + 8 + chunkLength > bytes.length) return { container: null, failure: 'INVALID_GLB_CONTAINER' };
    const chunk = bytes.slice(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) {
      if (jsonChunk !== null) return { container: null, failure: 'INVALID_GLB_CONTAINER' };
      jsonChunk = chunk;
    } else if (chunkType === 0x004e4942) binaryChunks.push(chunk);
    offset += 8 + chunkLength;
  }
  if (offset !== bytes.length || jsonChunk === null) return { container: null, failure: 'INVALID_GLB_CONTAINER' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(jsonChunk).replace(/\u0000+$/g, '').trim());
  } catch {
    return { container: null, failure: 'INVALID_GLB_CONTAINER' };
  }
  if (!record(parsed) || child(parsed, 'asset')?.version !== '2.0') return { container: null, failure: 'INVALID_GLB_CONTAINER' };
  const binary = binaryChunks.length === 0 ? new Uint8Array() : joinBytes(binaryChunks);
  return { container: { json: parsed, binary, version }, failure: null };
}

function glbVrmVersion(json: Record<string, unknown>): string | null {
  const extensions = child(json, 'extensions');
  if (!extensions) return null;
  if (Object.hasOwn(extensions, 'VRMC_vrm')) return '1.0';
  if (Object.hasOwn(extensions, 'VRM')) return '0.x';
  return null;
}

function looksLikeFbxAscii(bytes: Uint8Array): boolean {
  const header = readAscii(bytes, 4096);
  return /^\s*;\s*FBX\s+\d+\.\d+\.\d+\s+project file/i.test(header) || /FBXHeaderExtension\s*:/i.test(header);
}

function fbxVersion(bytes: Uint8Array): string | null {
  const binaryHeader = readAscii(bytes, 23);
  if (binaryHeader.startsWith(fbxBinaryHeader)) {
    const version = readUint32(bytes, 23, true);
    return version === null ? null : String(version / 1000);
  }
  const header = readAscii(bytes, 8192);
  const match = header.match(/FBXVersion\s*:\s*(\d{4})/i);
  return match ? `${Number(match[1]) / 1000}` : null;
}

function probeContainer(bytes: Uint8Array): ContainerProbe {
  const magic = readUint32(bytes, 0, true);
  if (magic === glbMagic) {
    const result = parseGlb(bytes);
    if (!result.container) return { detectedFormat: null, container: null, formatVersion: null, failure: result.failure };
    const vrmVersion = glbVrmVersion(result.container.json);
    return { detectedFormat: vrmVersion ? 'vrm' : 'glb', container: result.container, formatVersion: vrmVersion ?? '2.0', failure: null };
  }
  const binaryHeader = readAscii(bytes, 23);
  if (binaryHeader.startsWith(fbxBinaryHeader) || looksLikeFbxAscii(bytes)) {
    return { detectedFormat: 'fbx', container: null, formatVersion: fbxVersion(bytes), failure: null };
  }
  return { detectedFormat: null, container: null, formatVersion: null, failure: 'UNRECOGNIZED_CONTAINER' };
}

function addUnique(target: string[], value: string): void {
  if (!target.includes(value)) target.push(value);
}

function inspectStrings(value: unknown, uris: string[], scripts: string[], nodes: { count: number }): boolean {
  if (nodes.count++ > 10_000) return false;
  if (Array.isArray(value)) {
    for (const item of value) if (!inspectStrings(item, uris, scripts, nodes)) return false;
    return true;
  }
  if (!record(value)) return true;
  for (const [key, childValue] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();
    if (typeof childValue === 'string') {
      if (lowerKey === 'uri' || lowerKey === 'url' || lowerKey === 'source') addUnique(uris, childValue);
      if (/script|shader|javascript|wasm|execute|eval|plugin/i.test(lowerKey)) addUnique(scripts, childValue);
      if (/technique|shader|script|wasm/i.test(childValue)) addUnique(scripts, childValue);
    }
    if (/script|shader|javascript|wasm|execute|eval|plugin/i.test(lowerKey) && childValue !== '') addUnique(scripts, String(childValue));
    if (!inspectStrings(childValue, uris, scripts, nodes)) return false;
  }
  return true;
}

function accessorCount(json: Record<string, unknown>, index: unknown): number | null {
  const accessors = array<Record<string, unknown>>(json.accessors);
  if (!integer(index, 0, accessors.length - 1)) return null;
  const accessor = accessors[index];
  return record(accessor) && integer(accessor.count, 0) ? accessor.count : null;
}

function glbTriangleCount(json: Record<string, unknown>): { count: number; unsupportedPrimitive: boolean } {
  const meshes = array<Record<string, unknown>>(json.meshes);
  let count = 0;
  let unsupportedPrimitive = false;
  for (const mesh of meshes) {
    for (const primitive of array<Record<string, unknown>>(mesh.primitives)) {
      const mode = integer(primitive.mode, 0, 6) ? primitive.mode : 4;
      if (!integer(primitive.mode, 0, 6) && Object.hasOwn(primitive, 'mode')) unsupportedPrimitive = true;
      const attributes = child(primitive, 'attributes');
      const indexedCount = accessorCount(json, primitive.indices);
      const positionCount = accessorCount(json, attributes?.POSITION);
      if (attributes === null || (indexedCount === null && positionCount === null)) unsupportedPrimitive = true;
      const vertexCount = indexedCount ?? positionCount ?? 0;
      if (mode === 4) count += Math.floor(vertexCount / 3);
      else if (mode === 5 || mode === 6) count += Math.max(0, vertexCount - 2);
    }
  }
  return { count, unsupportedPrimitive };
}

function bufferViewBytes(json: Record<string, unknown>, binary: Uint8Array, index: unknown): Uint8Array | null {
  const views = array<Record<string, unknown>>(json.bufferViews);
  if (!integer(index, 0, views.length - 1)) return null;
  const view = views[index];
  if (!record(view) || view.buffer !== 0 || !integer(view.byteLength, 0)) return null;
  const start = view.byteOffset === undefined ? 0 : view.byteOffset;
  if (!integer(start, 0)) return null;
  const end = start + view.byteLength;
  return end <= binary.length ? binary.slice(start, end) : null;
}

function imageDimensions(bytes: Uint8Array): ThreeDTextureDimension | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a && readUint32(bytes, 8, false) === 13 && readAscii(bytes.slice(12, 16), 4) === 'IHDR') {
    const width = readUint32(bytes, 16, false);
    const height = readUint32(bytes, 20, false);
    return width && height ? { width, height } : null;
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      const marker = bytes[offset + 1];
      const length = readUint16(bytes, offset + 2, false);
      if (length === null || length < 2 || offset + 2 + length > bytes.length) return null;
      if (marker >= 0xc0 && marker <= 0xc3 || marker >= 0xc5 && marker <= 0xc7 || marker >= 0xc9 && marker <= 0xcb || marker >= 0xcd && marker <= 0xcf) {
        const height = readUint16(bytes, offset + 5, false);
        const width = readUint16(bytes, offset + 7, false);
        return width && height ? { width, height } : null;
      }
      offset += 2 + length;
    }
  }
  return null;
}

function glbTextureDimensions(json: Record<string, unknown>, binary: Uint8Array): { dimensions: ThreeDTextureDimension[]; unknown: boolean } {
  const dimensions: ThreeDTextureDimension[] = [];
  let unknown = false;
  for (const image of array<Record<string, unknown>>(json.images)) {
    if (!record(image) || Object.hasOwn(image, 'uri')) continue;
    const bytes = bufferViewBytes(json, binary, image.bufferView);
    const dimension = bytes ? imageDimensions(bytes) : null;
    if (dimension) dimensions.push(dimension);
    else unknown = true;
  }
  return { dimensions, unknown };
}

function glbMaterialKinds(json: Record<string, unknown>): ThreeDMaterialKind[] {
  const materials = array<Record<string, unknown>>(json.materials);
  if (materials.length === 0) return ['standard'];
  const kinds: ThreeDMaterialKind[] = [];
  for (const material of materials) {
    const extensions = child(material, 'extensions');
    const kind: ThreeDMaterialKind = extensions && Object.hasOwn(extensions, 'VRMC_materials_mtoon') ? 'mtoon' : extensions && Object.hasOwn(extensions, 'KHR_materials_unlit') ? 'unlit' : child(material, 'pbrMetallicRoughness') ? 'pbr' : 'unknown';
    addUnique(kinds, kind);
  }
  return kinds;
}

function glbSkeleton(json: Record<string, unknown>, format: ThreeDFormat): { skeleton: ThreeDSkeletonKind; boneCount: number } {
  const skins = array<Record<string, unknown>>(json.skins);
  const boneCount = skins.reduce((total, skin) => total + array<unknown>(skin.joints).length, 0);
  if (format === 'vrm') {
    const extensions = child(json, 'extensions');
    const vrm = extensions && (child(extensions, 'VRMC_vrm') ?? child(extensions, 'VRM'));
    const humanoid = vrm && child(vrm, 'humanoid');
    const humanBones = humanoid?.humanBones;
    const humanBoneCount = Array.isArray(humanBones) ? humanBones.length : record(humanBones) ? Object.keys(humanBones).length : 0;
    return { skeleton: humanBoneCount > 0 ? 'vrm_humanoid' : boneCount > 0 ? 'generic_skin' : 'none', boneCount };
  }
  return { skeleton: boneCount > 0 ? 'generic_skin' : 'none', boneCount };
}

function glbInspection(container: GlbContainer, format: ThreeDFormat): { inspection: ThreeDInspection | null; failure: ThreeDPreflightCode | null } {
  const uris: string[] = [];
  const scripts: string[] = [];
  if (!inspectStrings(container.json, uris, scripts, { count: 0 })) return { inspection: null, failure: 'INVALID_GLB_CONTAINER' };
  const extensionsUsed = array<unknown>(container.json.extensionsUsed);
  const extensionsRequired = array<unknown>(container.json.extensionsRequired);
  const unsupportedExtension = [...extensionsUsed, ...extensionsRequired].some(extension => typeof extension !== 'string' || !allowedGlbExtensions.has(extension));
  if (unsupportedExtension) return { inspection: null, failure: 'UNSUPPORTED_VERSION' };
  const triangles = glbTriangleCount(container.json);
  const skeleton = glbSkeleton(container.json, format);
  const textureResult = glbTextureDimensions(container.json, container.binary);
  const textureDimensions = textureResult.dimensions;
  const animationCount = array<unknown>(container.json.animations).length;
  const decodedBytes = textureDimensions.reduce((sum, dimension) => sum + dimension.width * dimension.height * 4, container.binary.length);
  const inspection: ThreeDInspection = {
    formatVersion: format === 'vrm' ? (glbVrmVersion(container.json) ?? 'unknown') : '2.0',
    textureDimensions,
    triangleCount: triangles.count,
    boneCount: skeleton.boneCount,
    animationCount,
    decodedBytes: Math.max(1, decodedBytes),
    parserPeakBytes: Math.max(1, container.binary.length + decodedBytes),
    externalUris: uris,
    scriptReferences: scripts,
    materialKinds: glbMaterialKinds(container.json),
    skeleton: skeleton.skeleton,
  };
  return { inspection, failure: triangles.unsupportedPrimitive ? 'UNSUPPORTED_PRIMITIVE' : textureResult.unknown ? 'UNKNOWN_TEXTURE_DIMENSION' : null };
}

function validInspection(value: unknown): value is ThreeDInspection {
  if (!record(value) || Object.keys(value).some(key => !inspectionKeys.includes(key as typeof inspectionKeys[number]))) return false;
  if (!inspectionKeys.every(key => Object.hasOwn(value, key))) return false;
  if (!text(value.formatVersion) || !Array.isArray(value.textureDimensions) || !integer(value.triangleCount) || !integer(value.boneCount) || !integer(value.animationCount) || !positiveInteger(value.decodedBytes) || !positiveInteger(value.parserPeakBytes) || !Array.isArray(value.externalUris) || !Array.isArray(value.scriptReferences) || !Array.isArray(value.materialKinds) || typeof value.skeleton !== 'string' || !inspectionSkeletons.has(value.skeleton as ThreeDSkeletonKind)) return false;
  if (!value.textureDimensions.every(item => record(item) && positiveInteger(item.width) && positiveInteger(item.height))) return false;
  if (!value.externalUris.every(item => typeof item === 'string' && item.length > 0) || !value.scriptReferences.every(item => typeof item === 'string' && item.length > 0)) return false;
  if (!value.materialKinds.every(item => typeof item === 'string' && supportedMaterialKinds.has(item as ThreeDMaterialKind))) return false;
  return true;
}

function supportFor(format: ThreeDFormat): ThreeDFormatSupportSpec {
  return threeDSupportMatrix.find(item => item.format === format) as ThreeDFormatSupportSpec;
}

function actionCompatibility(format: ThreeDFormat | null, inspection: ThreeDInspection | null): ThreeDActionCompatibility {
  if (!format || !inspection) return 'unknown';
  if ((format === 'vrm' && inspection.skeleton === 'vrm_humanoid') || (format !== 'vrm' && inspection.skeleton === 'humanoid')) return 'supported';
  if (inspection.skeleton === 'none' || inspection.skeleton === 'generic_skin' || inspection.skeleton === 'fbx_skeleton') return 'display_only';
  return 'unknown';
}

function reportStatus(failureCodes: ThreeDPreflightCode[]): ThreeDPreflightDisposition {
  return failureCodes.includes('INSPECTION_REQUIRED') || failureCodes.includes('INVALID_INSPECTION') ? 'review_required' : failureCodes.length === 0 ? 'preview_allowed' : 'fallback_2d';
}

export function inspectThreeDAsset(candidate: ThreeDAssetCandidate): ThreeDPreflightReport {
  const checks: ThreeDPreflightCheck[] = [];
  const failures = new Set<ThreeDPreflightCode>();
  const check = (code: ThreeDPreflightCode, passed: boolean, detail: string) => {
    checks.push({ code, passed, detail });
    if (!passed) failures.add(code);
  };
  if (!record(candidate) || typeof candidate.fileName !== 'string' || !(candidate.bytes instanceof Uint8Array)) {
    check('INVALID_INPUT', false, '3D preflight input requires a local filename and byte array.');
    return { detectedFormat: null, disposition: 'fallback_2d', previewAllowed: false, fallbackTo2d: true, manualReviewRequired: true, actionCompatibility: 'unknown', support: null, inspection: null, checks, failureCodes: [...failures] };
  }
  check('LOCAL_FILENAME', /^[^\\/\x00]{1,240}$/.test(candidate.fileName), 'Only a single local filename is accepted; paths and control characters are rejected.');
  check('FILE_SIZE_LIMIT', candidate.bytes.length >= 1 && candidate.bytes.length <= threeDBudgets.maxFileBytes, 'File size is within the 50MiB candidate budget.');
  const probe = probeContainer(candidate.bytes);
  check(probe.failure ?? 'UNRECOGNIZED_CONTAINER', probe.failure === null, probe.failure === null ? 'Container header and structure are recognized without trusting the extension.' : 'The file is not a recognized complete VRM, FBX, or GLB container.');
  const detectedFormat = probe.detectedFormat;
  if (detectedFormat) check('DECLARED_FORMAT_MISMATCH', candidate.declaredFormat === undefined || candidate.declaredFormat === detectedFormat, 'The declared format matches the content sniff result.');
  const support = detectedFormat ? supportFor(detectedFormat) : null;
  let inspection: ThreeDInspection | null = null;
  if (probe.failure === null && detectedFormat) {
    if (probe.container) {
      const automatic = glbInspection(probe.container, detectedFormat);
      if (automatic.failure) failures.add(automatic.failure);
      inspection = automatic.inspection;
      check('UNSUPPORTED_VERSION', automatic.failure !== 'UNSUPPORTED_VERSION', automatic.failure === 'UNSUPPORTED_VERSION' ? 'GLB/VRM uses an extension outside the candidate matrix.' : 'GLB/VRM version and extensions are in the candidate matrix.');
      check('UNSUPPORTED_PRIMITIVE', automatic.failure !== 'UNSUPPORTED_PRIMITIVE', automatic.failure === 'UNSUPPORTED_PRIMITIVE' ? 'The mesh uses a primitive mode not covered by the budget preflight.' : 'Mesh primitive modes can be budgeted.');
      check('UNKNOWN_TEXTURE_DIMENSION', automatic.failure !== 'UNKNOWN_TEXTURE_DIMENSION', automatic.failure === 'UNKNOWN_TEXTURE_DIMENSION' ? 'An embedded texture could not be inspected for dimensions.' : 'Embedded texture dimensions are either known or no embedded texture is declared.');
    } else if (candidate.inspection === undefined) {
      check('INSPECTION_REQUIRED', false, 'FBX container detection is not a compatibility proof; an isolated parser summary is required.');
    }
    if (candidate.inspection !== undefined) {
      const inspectionValid = validInspection(candidate.inspection);
      check('INVALID_INSPECTION', inspectionValid, inspectionValid ? 'The isolated parser summary has a strict shape.' : 'The isolated parser summary is incomplete or contains unsafe values.');
      if (inspectionValid && !probe.container) inspection = candidate.inspection;
    }
    if (detectedFormat === 'vrm') check('UNSUPPORTED_VERSION', probe.formatVersion === '0.x' || probe.formatVersion === '1.0', 'VRM 0.x/1.0 is in the candidate matrix.');
    if (detectedFormat === 'glb') check('UNSUPPORTED_VERSION', probe.formatVersion === '2.0', 'Only glTF 2.0 GLB is in the candidate matrix.');
    if (detectedFormat === 'fbx') check('UNSUPPORTED_VERSION', probe.formatVersion === '7.4' || probe.formatVersion === '7.5', 'Only FBX 7.4/7.5 is in the candidate matrix.');
  }
  if (inspection) {
    check('EXTERNAL_URI', inspection.externalUris.length === 0, inspection.externalUris.length === 0 ? 'No external URI was reported.' : 'An external URI was reported; no network or unknown resource is loaded.');
    check('SCRIPT_REFERENCE', inspection.scriptReferences.length === 0, inspection.scriptReferences.length === 0 ? 'No script, shader, or executable reference was reported.' : 'A script or executable reference was reported and import is rejected.');
    const texturesValid = inspection.textureDimensions.every(dimension => dimension.width <= threeDBudgets.maxTextureDimension && dimension.height <= threeDBudgets.maxTextureDimension);
    check('TEXTURE_SIZE_LIMIT', texturesValid, texturesValid ? 'Every texture side is within 2048px.' : 'A texture side exceeds 2048px.');
    check('TRIANGLE_LIMIT', inspection.triangleCount <= threeDBudgets.maxTriangles, inspection.triangleCount <= threeDBudgets.maxTriangles ? 'Triangle count is within 100,000.' : 'Triangle count exceeds 100,000.');
    check('PARSER_MEMORY_LIMIT', inspection.parserPeakBytes <= threeDBudgets.maxParserPeakBytes, inspection.parserPeakBytes <= threeDBudgets.maxParserPeakBytes ? 'Parser peak memory is within 512MiB.' : 'Parser peak memory exceeds 512MiB.');
    check('DECODED_MEMORY_LIMIT', inspection.decodedBytes <= threeDBudgets.maxDecodedBytes, inspection.decodedBytes <= threeDBudgets.maxDecodedBytes ? 'Decoded resource memory is within 300MiB.' : 'Decoded resource memory exceeds 300MiB.');
    const expansionRatio = inspection.decodedBytes / Math.max(1, candidate.bytes.length);
    check('COMPRESSION_RATIO_LIMIT', expansionRatio <= threeDBudgets.maxExpansionRatio, expansionRatio <= threeDBudgets.maxExpansionRatio ? 'Expansion ratio is within 100x.' : 'Expansion ratio looks like a compression bomb.');
    const allowedMaterials = support ? new Set(support.materials) : supportedMaterialKinds;
    const materialsValid = inspection.materialKinds.length > 0 && inspection.materialKinds.every(material => allowedMaterials.has(material));
    check('UNSUPPORTED_MATERIAL', materialsValid, materialsValid ? 'Material types are in the format candidate matrix.' : 'An unsupported or unknown material type was reported.');
    if (actionCompatibility(detectedFormat, inspection) === 'display_only') check('ACTION_SKELETON_UNAVAILABLE', true, 'The model may display, but it has no standard action skeleton; actions must be disabled with a clear fallback message.');
  } else if (probe.failure === null && detectedFormat && !failures.has('INSPECTION_REQUIRED') && !failures.has('INVALID_INSPECTION')) {
    check('INVALID_INSPECTION', false, 'A safe resource summary could not be formed.');
  }
  const failureCodes = [...failures];
  const disposition = reportStatus(failureCodes);
  const action = actionCompatibility(detectedFormat, inspection);
  return { detectedFormat, disposition, previewAllowed: disposition === 'preview_allowed', fallbackTo2d: disposition !== 'preview_allowed', manualReviewRequired: true, actionCompatibility: action, support, inspection, checks, failureCodes };
}

export function validThreeDAsset(candidate: ThreeDAssetCandidate): boolean {
  return inspectThreeDAsset(candidate).previewAllowed;
}
