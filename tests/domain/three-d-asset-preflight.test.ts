import { describe, expect, it } from 'vitest';
import {
  inspectThreeDAsset,
  threeDBudgets,
  type ThreeDAssetCandidate,
  type ThreeDInspection,
} from '@nuanban/pet-engine';

function paddedJson(value: Record<string, unknown>): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const paddedLength = Math.ceil(encoded.length / 4) * 4;
  const result = new Uint8Array(paddedLength);
  result.fill(0x20);
  result.set(encoded);
  return result;
}

function glb(value: Record<string, unknown>): Uint8Array {
  const json = paddedJson(value);
  const length = 12 + 8 + json.length;
  const result = new Uint8Array(length);
  const view = new DataView(result.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, length, true);
  view.setUint32(12, json.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  result.set(json, 20);
  return result;
}

function fbxBinary(size = 27): Uint8Array {
  const result = new Uint8Array(Math.max(27, size));
  result.set(new TextEncoder().encode('Kaydara FBX Binary'), 0);
  new DataView(result.buffer).setUint32(23, 7400, true);
  return result;
}

function inspection(overrides: Partial<ThreeDInspection> = {}): ThreeDInspection {
  return {
    formatVersion: '7.4',
    textureDimensions: [{ width: 1024, height: 1024 }],
    triangleCount: 20_000,
    boneCount: 32,
    animationCount: 3,
    decodedBytes: 16 * 1024 * 1024,
    parserPeakBytes: 96 * 1024 * 1024,
    externalUris: [],
    scriptReferences: [],
    materialKinds: ['standard'],
    skeleton: 'humanoid',
    ...overrides,
  };
}

function candidate(bytes: Uint8Array, extra: Partial<ThreeDAssetCandidate> = {}): ThreeDAssetCandidate {
  return { fileName: 'sample.asset', bytes, ...extra };
}

const validGlb = {
  asset: { version: '2.0' },
  materials: [{ pbrMetallicRoughness: {} }],
  accessors: [{ count: 3 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
};

describe('C11 3D 本地资源预检', () => {
  it('按容器识别合法 GLB，而不是按扩展名放行', () => {
    const report = inspectThreeDAsset(candidate(glb(validGlb), { fileName: 'sample.fbx', declaredFormat: 'glb' }));
    expect(report.detectedFormat).toBe('glb');
    expect(report.previewAllowed).toBe(true);
    expect(report.actionCompatibility).toBe('display_only');
    expect(report.manualReviewRequired).toBe(true);
    expect(report.failureCodes).toEqual([]);
  });

  it('识别 VRM 0.x/1.0 扩展并仅对标准人形骨骼开放动作兼容', () => {
    const report = inspectThreeDAsset(candidate(glb({
      ...validGlb,
      extensions: { VRMC_vrm: { humanoid: { humanBones: { hips: { node: 0 }, head: { node: 1 } } } } },
    }), { fileName: 'sample.vrm', declaredFormat: 'vrm' }));
    expect(report.detectedFormat).toBe('vrm');
    expect(report.previewAllowed).toBe(true);
    expect(report.actionCompatibility).toBe('supported');
    expect(report.inspection?.skeleton).toBe('vrm_humanoid');
  });

  it('拒绝损坏的 GLB、格式声明冲突和未知扩展', () => {
    const broken = glb(validGlb).slice(0, -1);
    const brokenReport = inspectThreeDAsset(candidate(broken, { fileName: 'broken.glb', declaredFormat: 'glb' }));
    expect(brokenReport.previewAllowed).toBe(false);
    expect(brokenReport.failureCodes).toContain('INVALID_GLB_CONTAINER');

    const mismatch = inspectThreeDAsset(candidate(glb(validGlb), { fileName: 'wrong.fbx', declaredFormat: 'fbx' }));
    expect(mismatch.failureCodes).toContain('DECLARED_FORMAT_MISMATCH');

    const unsupported = inspectThreeDAsset(candidate(glb({ ...validGlb, extensionsRequired: ['KHR_draco_mesh_compression'] }), { fileName: 'compressed.glb', declaredFormat: 'glb' }));
    expect(unsupported.failureCodes).toContain('UNSUPPORTED_VERSION');
  });

  it('拒绝 GLB 外链和脚本引用，不会加载未知资源', () => {
    const report = inspectThreeDAsset(candidate(glb({
      ...validGlb,
      buffers: [{ uri: 'https://example.invalid/model.bin' }],
      extras: { script: 'javascript:alert(1)' },
    }), { fileName: 'linked.glb', declaredFormat: 'glb' }));
    expect(report.previewAllowed).toBe(false);
    expect(report.failureCodes).toEqual(expect.arrayContaining(['EXTERNAL_URI', 'SCRIPT_REFERENCE']));
  });

  it('无法确定内嵌贴图尺寸时拒绝预算预检', () => {
    const report = inspectThreeDAsset(candidate(glb({
      ...validGlb,
      images: [{ bufferView: 0, mimeType: 'image/png' }],
    }), { fileName: 'unknown-texture.glb', declaredFormat: 'glb' }));
    expect(report.previewAllowed).toBe(false);
    expect(report.failureCodes).toContain('UNKNOWN_TEXTURE_DIMENSION');
  });

  it('对 FBX 只做容器识别，缺少隔离解析摘要时保守要求复核', () => {
    const report = inspectThreeDAsset(candidate(fbxBinary(), { fileName: 'sample.fbx', declaredFormat: 'fbx' }));
    expect(report.detectedFormat).toBe('fbx');
    expect(report.disposition).toBe('review_required');
    expect(report.previewAllowed).toBe(false);
    expect(report.failureCodes).toContain('INSPECTION_REQUIRED');
  });

  it('使用 FBX 隔离摘要验证版本、材质、骨骼和资源预算', () => {
    const report = inspectThreeDAsset(candidate(fbxBinary(256 * 1024), { fileName: 'sample.fbx', declaredFormat: 'fbx', inspection: inspection() }));
    expect(report.previewAllowed).toBe(true);
    expect(report.actionCompatibility).toBe('supported');
    expect(report.inspection?.formatVersion).toBe('7.4');
  });

  it('发现外链、脚本、贴图、面数、解析内存和展开比例超限时回退 2D', () => {
    const report = inspectThreeDAsset(candidate(fbxBinary(), {
      fileName: 'unsafe.fbx',
      declaredFormat: 'fbx',
      inspection: inspection({
        textureDimensions: [{ width: 4096, height: 1024 }],
        triangleCount: threeDBudgets.maxTriangles + 1,
        parserPeakBytes: threeDBudgets.maxParserPeakBytes + 1,
        decodedBytes: 10_000,
        externalUris: ['textures/model.png'],
        scriptReferences: ['shader:unsafe'],
      }),
    }));
    expect(report.previewAllowed).toBe(false);
    expect(report.fallbackTo2d).toBe(true);
    expect(report.failureCodes).toEqual(expect.arrayContaining([
      'EXTERNAL_URI',
      'SCRIPT_REFERENCE',
      'TEXTURE_SIZE_LIMIT',
      'TRIANGLE_LIMIT',
      'PARSER_MEMORY_LIMIT',
      'COMPRESSION_RATIO_LIMIT',
    ]));
  });

  it('允许无标准骨骼模型预览，但明确动作不兼容', () => {
    const report = inspectThreeDAsset(candidate(fbxBinary(256 * 1024), {
      fileName: 'static.fbx',
      declaredFormat: 'fbx',
      inspection: inspection({ skeleton: 'generic_skin', boneCount: 12 }),
    }));
    expect(report.previewAllowed).toBe(true);
    expect(report.actionCompatibility).toBe('display_only');
    expect(report.checks.find(check => check.code === 'ACTION_SKELETON_UNAVAILABLE')?.passed).toBe(true);
  });

  it('拒绝超过 50MiB 的本地文件和不完整摘要', () => {
    const oversized = new Uint8Array(threeDBudgets.maxFileBytes + 1);
    const oversizedReport = inspectThreeDAsset(candidate(oversized, { fileName: 'oversized.fbx', declaredFormat: 'fbx' }));
    expect(oversizedReport.failureCodes).toContain('FILE_SIZE_LIMIT');

    const invalidSummary = inspectThreeDAsset(candidate(fbxBinary(), { fileName: 'invalid.fbx', declaredFormat: 'fbx', inspection: { skeleton: 'humanoid' } as never }));
    expect(invalidSummary.disposition).toBe('review_required');
    expect(invalidSummary.failureCodes).toContain('INVALID_INSPECTION');
  });
});
