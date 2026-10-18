import { describe, expect, it } from 'vitest';
import { createAccessibilityPatch, buildAssetRevision, validateAssetRevision } from '../../packages/accessibility-assets/src';

function fixture(overrides: Partial<Parameters<typeof buildAssetRevision>[0]> = {}) {
  return buildAssetRevision({
    assetId: 'pet-child-v1',
    revision: 1,
    audience: 'child',
    placement: 'desk-pet',
    width: 512,
    height: 512,
    bytes: 12,
    reducedMotionVariant: true,
    captions: true,
    focusOrder: ['pet', 'caption', 'stop'],
    source: 'reviewed',
    content: 'synthetic-asset',
    ...overrides,
  });
}

describe('E21 资源与无障碍修订', () => {
  it('拒绝儿童资源离开桌宠指向或缺少减动效版本', () => {
    expect(validateAssetRevision(fixture({ placement: 'hidden' })).findings).toContain('child_asset_must_remain_desk_pet');
    expect(validateAssetRevision(fixture({ reducedMotionVariant: false })).findings).toContain('child_reduced_motion_missing');
  });

  it('产生可追踪哈希、焦点环、字号和减动效修订', () => {
    const asset = fixture();
    expect(asset.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const patch = createAccessibilityPatch(asset, { fontScale: 1.5, reduceMotion: true });
    expect(patch).toMatchObject({ fontScale: 1.5, focusRingPx: 3, motion: 'reduced', childDirected: true, placement: 'desk-pet' });
  });

  it('不把未评审的本地后续修订当成可交付资源', () => {
    const result = validateAssetRevision(fixture({ revision: 2, source: 'local' }));
    expect(result.valid).toBe(false);
    expect(result.findings).toContain('unreviewed_revision');
  });
});
