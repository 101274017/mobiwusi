import { describe, expect, it } from 'vitest';
import { assessAnimatedPetAsset, validAnimatedPetAsset, type AnimatedPetAssetManifest, type PetAction } from '@nuanban/pet-engine';

const assetId = '00000000-0000-4000-8000-000000000010';
const actions: Record<PetAction, { frames: number[]; durationMs: number; loop: boolean }> = {
  idle: { frames: [0, 1], durationMs: 600, loop: true },
  listening: { frames: [2, 3], durationMs: 500, loop: true },
  thinking: { frames: [4, 5], durationMs: 700, loop: true },
  speaking: { frames: [6, 7], durationMs: 220, loop: true },
  pointing: { frames: [8, 9], durationMs: 500, loop: false },
  celebrating: { frames: [10, 11], durationMs: 420, loop: false },
  concerned: { frames: [12], durationMs: 500, loop: false },
  paused: { frames: [13], durationMs: 500, loop: false },
};

function manifest(): AnimatedPetAssetManifest {
  return {
    version: '1', kind: 'animated_2d', source: 'generated_2d', generated: true, assetId,
    canvas: { width: 1024, height: 1024 }, decodedBytes: 8 * 1024 * 1024,
    palette: ['#A64B2A', '#FFF8EF', '#2D2521'],
    layers: [
      { id: 'body', kind: 'body', source: `assets/${assetId}/body.webp`, rect: { x: 0, y: 0, width: 1024, height: 1024 } },
      { id: 'eyes', kind: 'eyes', source: `assets/${assetId}/eyes.webp`, rect: { x: 220, y: 220, width: 584, height: 300 } },
      { id: 'mouth', kind: 'mouth', source: `assets/${assetId}/mouth.webp`, rect: { x: 300, y: 560, width: 424, height: 200 } },
    ],
    actions,
  };
}

describe('C13 可动 2D 资产质量规则', () => {
  it('允许结构完整资产进入预览，但不自动视为可发布', () => {
    const report = assessAnimatedPetAsset(manifest());
    expect(report.previewAllowed).toBe(true);
    expect(report.publishEligible).toBe(false);
    expect(report.manualReviewRequired).toBe(true);
    expect(report.score).toBe(1);
    expect(validAnimatedPetAsset(manifest())).toBe(true);
  });

  it('拒绝静态演示、错误身份或缺少动作的 manifest', () => {
    const staticAsset = { ...manifest(), source: 'built-in-demo', generated: false } as never;
    const missingAction = { ...manifest(), actions: { ...actions, paused: undefined } } as never;
    expect(assessAnimatedPetAsset(staticAsset).failureCodes).toContain('INVALID_IDENTITY');
    expect(assessAnimatedPetAsset(missingAction).previewAllowed).toBe(false);
    expect(assessAnimatedPetAsset(missingAction).failureCodes).toContain('INVALID_ACTIONS');
  });

  it('拒绝超过尺寸和解码内存预算的资源', () => {
    const report = assessAnimatedPetAsset({ ...manifest(), canvas: { width: 2049, height: 1024 }, decodedBytes: 64 * 1024 * 1024 + 1 });
    expect(report.failureCodes).toEqual(expect.arrayContaining(['INVALID_CANVAS', 'DECODED_MEMORY_LIMIT', 'INVALID_LAYER_BOUNDS']));
    expect(report.previewAllowed).toBe(false);
  });

  it('拒绝外链、路径穿越和越界图层', () => {
    const external = { ...manifest(), layers: manifest().layers.map((layer, index) => index === 0 ? { ...layer, source: 'https://example.invalid/pet.webp' } : layer) };
    const traversal = { ...manifest(), layers: manifest().layers.map((layer, index) => index === 1 ? { ...layer, source: 'assets/a/../eyes.webp' } : layer) };
    const outOfBounds = { ...manifest(), layers: manifest().layers.map((layer, index) => index === 2 ? { ...layer, rect: { x: 900, y: 900, width: 200, height: 200 } } : layer) };
    expect(assessAnimatedPetAsset(external).failureCodes).toContain('EXTERNAL_ASSET_URI');
    expect(assessAnimatedPetAsset(traversal).failureCodes).toContain('EXTERNAL_ASSET_URI');
    expect(assessAnimatedPetAsset(outOfBounds).failureCodes).toContain('INVALID_LAYER_BOUNDS');
  });

  it('拒绝缺少 body/eyes/mouth 图层、坏颜色和未知动作', () => {
    const incomplete = { ...manifest(), layers: manifest().layers.filter(layer => layer.kind !== 'mouth'), palette: ['red'], actions: { ...actions, extra: actions.idle } } as never;
    const report = assessAnimatedPetAsset(incomplete);
    expect(report.failureCodes).toEqual(expect.arrayContaining(['INVALID_PALETTE', 'MISSING_LAYER', 'INVALID_ACTIONS']));
  });

  it('拒绝畸形值而不抛出或放宽门控', () => {
    for (const value of [null, [], {}, { ...manifest(), canvas: null }, { ...manifest(), actions: null }]) {
      const report = assessAnimatedPetAsset(value);
      expect(report.previewAllowed).toBe(false);
      expect(report.manualReviewRequired).toBe(true);
    }
  });
});
