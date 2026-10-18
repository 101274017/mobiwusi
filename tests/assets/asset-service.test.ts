import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assessAnimatedPetAsset, type AnimatedPetAssetManifest, type PetAction } from '../../packages/pet-engine/src/index';
import { AssetService, ConfigurationService, InMemoryAssetStore, InMemoryConfigurationStore, OwnerAssetAuthorizer, sha256, type AssetBundle, type AssetContext, type ConfigurationPayload, type ConfigurationSigningPort, type ConfigurationVerificationPort, type GenerationInput, type PetGenerationPort } from '../../packages/asset-service/src/index';

const actions: Record<PetAction, { frames: number[]; durationMs: number; loop: boolean }> = {
  idle: { frames: [0, 1], durationMs: 600, loop: true }, listening: { frames: [2, 3], durationMs: 500, loop: true }, thinking: { frames: [4, 5], durationMs: 700, loop: true }, speaking: { frames: [6, 7], durationMs: 220, loop: true }, pointing: { frames: [8, 9], durationMs: 500, loop: false }, celebrating: { frames: [10, 11], durationMs: 420, loop: false }, concerned: { frames: [12], durationMs: 500, loop: false }, paused: { frames: [13], durationMs: 500, loop: false },
};
const input: GenerationInput = { kind: 'drawing', strokes: [{ color: '#000000', width: 2, eraser: false, points: [{ x: 1, y: 1 }, { x: 5, y: 5 }] }], preferences: { eyes: 'round', mouth: 'smile', color: '#A64B2A', action: 'idle' } };
const owner: AssetContext = { actorId: 'owner-1' };

function manifest(assetId: string): AnimatedPetAssetManifest {
  return { version: '1', kind: 'animated_2d', source: 'generated_2d', generated: true, assetId, canvas: { width: 1024, height: 1024 }, decodedBytes: 8 * 1024 * 1024, palette: ['#A64B2A', '#FFF8EF', '#2D2521'], layers: [
    { id: 'body', kind: 'body', source: `assets/${assetId}/body.webp`, rect: { x: 0, y: 0, width: 1024, height: 1024 } },
    { id: 'eyes', kind: 'eyes', source: `assets/${assetId}/eyes.webp`, rect: { x: 220, y: 220, width: 584, height: 300 } },
    { id: 'mouth', kind: 'mouth', source: `assets/${assetId}/mouth.webp`, rect: { x: 300, y: 560, width: 424, height: 200 } },
  ], actions };
}

function bundle(assetId: string): AssetBundle {
  const files = ['body.webp', 'eyes.webp', 'mouth.webp'].map((name, index) => { const bytes = new Uint8Array([index + 1, 2, 3]); return { path: `assets/${assetId}/${name}`, bytes, sha256: sha256(bytes) }; });
  return { manifest: manifest(assetId), files };
}

class FixedGenerator implements PetGenerationPort {
  constructor(private readonly result: AssetBundle) {}
  async generate(): Promise<AssetBundle> { return structuredClone(this.result); }
}

describe('E06/E09 asset service', () => {
  it('enforces owner ACL and keeps the old pet until preview confirmation', async () => {
    const store = new InMemoryAssetStore();
    await store.transaction(transaction => transaction.saveCurrent({ ownerId: 'owner-1', assetId: 'old-asset', assetHash: 'old-hash', version: 4, updatedAt: 1 }));
    const newAssetId = '00000000-0000-4000-8000-000000000010';
    const assetService = new AssetService({ store, authorizer: new OwnerAssetAuthorizer(), generator: new FixedGenerator(bundle(newAssetId)), now: () => 10_000, nextId: (() => { const values = ['00000000-0000-4000-8000-000000000001', newAssetId]; return () => values.shift()!; })() });
    await expect(assetService.create({ actorId: 'other' }, 'owner-1', input)).rejects.toMatchObject({ code: 'SCOPE_DENIED' });
    const job = await assetService.create(owner, 'owner-1', input);
    const preview = await assetService.process(job.jobId);
    expect(preview.state).toBe('preview');
    expect((await assetService.current(owner, 'owner-1'))?.assetId).toBe('old-asset');
    const confirmed = await assetService.confirm(owner, job.jobId, preview.preview!.token);
    expect(confirmed.state).toBe('confirmed');
    expect((await assetService.current(owner, 'owner-1'))).toMatchObject({ assetId: newAssetId, version: 5 });
  });

  it('rejects a malformed bundle without saving or applying it', async () => {
    const store = new InMemoryAssetStore();
    await store.transaction(transaction => transaction.saveCurrent({ ownerId: 'owner-1', assetId: 'old-asset', assetHash: 'old-hash', version: 1, updatedAt: 1 }));
    const invalid = bundle('asset-bad');
    invalid.files[0] = { ...invalid.files[0], sha256: '0'.repeat(64) };
    const assetService = new AssetService({ store, generator: new FixedGenerator(invalid), now: () => 10_000, nextId: (() => { const values = ['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000011']; return () => values.shift()!; })() });
    const job = await assetService.create(owner, 'owner-1', input);
    const result = await assetService.process(job.jobId);
    expect(result).toMatchObject({ state: 'failed', error: 'INVALID_ASSET' });
    expect((await assetService.current(owner, 'owner-1'))?.assetId).toBe('old-asset');
    expect(await store.transaction(transaction => transaction.getAsset(job.assetId))).toBeNull();
  });

  it('does not apply a late generation result after cancellation', async () => {
    let markStarted!: () => void;
    let resolveGeneration!: (value: AssetBundle) => void;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    const lateGenerator: PetGenerationPort = { generate: async () => { markStarted(); return new Promise<AssetBundle>(resolve => { resolveGeneration = resolve; }); } };
    const store = new InMemoryAssetStore();
    const assetService = new AssetService({ store, generator: lateGenerator, now: () => 10_000, nextId: (() => { const values = ['00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000012']; return () => values.shift()!; })() });
    const job = await assetService.create(owner, 'owner-1', input);
    const processing = assetService.process(job.jobId);
    await started;
    const cancelled = await assetService.cancel(owner, job.jobId);
    resolveGeneration(bundle(cancelled.assetId));
    const result = await processing;
    expect(result.state).toBe('cancelled');
    expect(await store.transaction(transaction => transaction.getAsset(job.assetId))).toBeNull();
  });
});

class FixtureSigner implements ConfigurationSigningPort, ConfigurationVerificationPort {
  readonly keyId = 'fixture-key';
  async sign(message: Uint8Array): Promise<Uint8Array> { return Uint8Array.from(Buffer.from(createHash('sha256').update(message).digest('hex'))); }
  async verify(_keyId: string, message: Uint8Array, signature: Uint8Array): Promise<boolean> { return Buffer.from(signature).toString() === createHash('sha256').update(message).digest('hex'); }
}

function configuration(version: string): ConfigurationPayload {
  return { schemaVersion: '1', ownerId: 'owner-1', kind: 'flow', version, minClientVersion: '1.0.0', safety: { localGate: true, stopOnRisk: true, relayOnly: true }, data: { steps: ['intro', 'confirm'], timeoutMs: 20_000 } };
}

describe('E06 signed configuration release', () => {
  it('publishes, verifies and rolls back signed releases with optimistic revisions', async () => {
    const signer = new FixtureSigner();
    const service = new ConfigurationService({ store: new InMemoryConfigurationStore(), signer, verifier: signer });
    const first = await service.publish(owner, configuration('1.0.0'), 0);
    expect(first.keyId).toBe('fixture-key');
    await service.publish(owner, configuration('1.1.0'), 1);
    await expect(service.publish(owner, configuration('1.2.0'), 0)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    const verified = await service.verify(owner, 'owner-1', 'flow', '1.1.0', '1.2.0');
    expect(verified.payload.version).toBe('1.1.0');
    const rolledBack = await service.rollback(owner, 'owner-1', 'flow', '1.0.0', 2);
    expect(rolledBack.version).toBe('1.0.0');
    expect((await service.head(owner, 'owner-1', 'flow'))).toMatchObject({ version: '1.0.0', revision: 3 });
  });

  it('rejects tampered signatures and unsafe release payloads', async () => {
    const signer = new FixtureSigner();
    const store = new InMemoryConfigurationStore();
    const service = new ConfigurationService({ store, signer, verifier: signer });
    await service.publish(owner, configuration('2.0.0'));
    await store.transaction(async transaction => { const release = await transaction.getRelease('owner-1', 'flow', '2.0.0'); if (release) await transaction.saveRelease({ ...release, signature: 'tampered' }); });
    await expect(service.get(owner, 'owner-1', 'flow', '2.0.0')).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
    const unsafe = { ...configuration('3.0.0'), safety: { localGate: false, stopOnRisk: true, relayOnly: true } } as unknown as ConfigurationPayload;
    await expect(service.publish(owner, unsafe)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });
});

describe('asset structural fixture', () => {
  it('uses the existing pet-engine structural gate, not a quality claim', () => {
    const report = assessAnimatedPetAsset(manifest('00000000-0000-4000-8000-000000000013'));
    expect(report.previewAllowed).toBe(true);
    expect(report.publishEligible).toBe(false);
    expect(report.manualReviewRequired).toBe(true);
  });
});
