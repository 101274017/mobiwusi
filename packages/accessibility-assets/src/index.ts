import { createHash } from 'node:crypto';

export type AssetAudience = 'child' | 'elder' | 'shared';
export type PetPlacement = 'desk-pet' | 'side-panel' | 'hidden';

export interface AssetRevision {
  assetId: string;
  revision: number;
  contentHash: string;
  audience: AssetAudience;
  placement: PetPlacement;
  width: number;
  height: number;
  bytes: number;
  reducedMotionVariant: boolean;
  captions: boolean;
  focusOrder: string[];
  source: 'local' | 'reviewed';
}

export interface AccessibilityPatch {
  assetId: string;
  revision: number;
  fontScale: number;
  focusRingPx: number;
  motion: 'full' | 'reduced' | 'static';
  childDirected: boolean;
  placement: PetPlacement;
  findings: string[];
}

export interface AssetValidation {
  valid: boolean;
  findings: string[];
  score: number;
}

function isHash(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function validateAssetRevision(asset: AssetRevision): AssetValidation {
  const findings: string[] = [];
  if (!asset.assetId.trim()) findings.push('asset_id_required');
  if (!Number.isInteger(asset.revision) || asset.revision < 1) findings.push('revision_invalid');
  if (!isHash(asset.contentHash)) findings.push('content_hash_invalid');
  if (!finitePositive(asset.width) || !finitePositive(asset.height)) findings.push('dimensions_invalid');
  if (!Number.isInteger(asset.bytes) || asset.bytes <= 0) findings.push('bytes_invalid');
  if (!asset.focusOrder.length) findings.push('focus_order_missing');
  if (!asset.captions) findings.push('captions_missing');
  if (asset.audience === 'child' && asset.placement !== 'desk-pet') findings.push('child_asset_must_remain_desk_pet');
  if (asset.audience === 'child' && !asset.reducedMotionVariant) findings.push('child_reduced_motion_missing');
  if (asset.source === 'local' && asset.revision > 1) findings.push('unreviewed_revision');
  const score = Math.max(0, 100 - findings.length * 12);
  return { valid: findings.length === 0, findings, score };
}

export function buildAssetRevision(input: Omit<AssetRevision, 'contentHash'> & { content?: Uint8Array | string }): AssetRevision {
  const bytes = typeof input.content === 'string'
    ? Buffer.from(input.content, 'utf8')
    : input.content ?? new Uint8Array(input.bytes);
  const { content, ...metadata } = input;
  return { ...metadata, bytes: bytes.byteLength, contentHash: createHash('sha256').update(bytes).digest('hex') };
}

export function createAccessibilityPatch(asset: AssetRevision, options: { fontScale?: number; reduceMotion?: boolean } = {}): AccessibilityPatch {
  const validation = validateAssetRevision(asset);
  if (!validation.valid) throw new Error(`资源不能进入无障碍修订：${validation.findings.join(',')}`);
  const reduceMotion = options.reduceMotion ?? false;
  return {
    assetId: asset.assetId,
    revision: asset.revision,
    fontScale: Math.min(2, Math.max(1, options.fontScale ?? 1)),
    focusRingPx: 3,
    motion: reduceMotion ? 'reduced' : asset.reducedMotionVariant ? 'full' : 'static',
    childDirected: asset.audience === 'child',
    placement: asset.audience === 'child' ? 'desk-pet' : asset.placement,
    findings: validation.findings,
  };
}

export function scoreAssetRevision(asset: AssetRevision): number {
  return validateAssetRevision(asset).score;
}
