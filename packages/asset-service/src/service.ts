import { randomUUID } from 'node:crypto';
import { validDrawing } from '../../pet-engine/src/index.ts';
import { AssetServiceError, type AssetAuthorizer, type AssetContext, type AssetStore, type ConfigurationPayload, type ConfigurationSigningPort, type ConfigurationVerificationPort, type ConfigurationStore, type GeneratedAsset, type GenerationInput, type GenerationJob, type PetGenerationPort, type SignedConfiguration } from './ports.ts';
import { canonicalJson, sha256, validateAssetBundle } from './integrity.ts';

export interface AssetServiceOptions {
  store: AssetStore;
  authorizer?: AssetAuthorizer;
  generator: PetGenerationPort;
  now?: () => number;
  nextId?: () => string;
  nextToken?: () => string;
}

function requireIdentifier(value: string, label: string): void {
  if (!/^[a-zA-Z0-9-]{1,120}$/.test(value)) throw new AssetServiceError('INVALID_REQUEST', `${label} is invalid`);
}

function requireInput(input: GenerationInput): void {
  if (!input || !input.preferences || !/^#[a-f\d]{6}$/i.test(input.preferences.color)) throw new AssetServiceError('INVALID_REQUEST');
  if (input.kind === 'drawing' && (!validDrawing(input.strokes) || !input.strokes.some(stroke => !stroke.eraser && stroke.points.length > 0))) throw new AssetServiceError('INVALID_REQUEST');
  if (input.kind !== 'drawing' && input.kind !== 'preferences') throw new AssetServiceError('INVALID_REQUEST');
}

export class AssetService {
  private readonly store: AssetStore;
  private readonly authorizer: AssetAuthorizer;
  private readonly generator: PetGenerationPort;
  private readonly now: () => number;
  private readonly nextId: () => string;
  private readonly nextToken: () => string;
  private readonly controllers = new Map<string, AbortController>();

  constructor(options: AssetServiceOptions) {
    this.store = options.store;
    this.authorizer = options.authorizer ?? { authorize: async (actorId, ownerId) => actorId === ownerId };
    this.generator = options.generator;
    this.now = options.now ?? (() => Date.now());
    this.nextId = options.nextId ?? randomUUID;
    this.nextToken = options.nextToken ?? randomUUID;
  }

  async create(context: AssetContext, ownerId: string, input: GenerationInput): Promise<GenerationJob> {
    requireIdentifier(ownerId, 'ownerId');
    requireInput(input);
    await this.requireAccess(context.actorId, ownerId, 'create');
    const now = this.now();
    const job: GenerationJob = {
      jobId: this.nextId(), assetId: this.nextId(), ownerId, generation: 0, input: structuredClone(input),
      state: 'queued', error: null, createdAt: now, updatedAt: now, preview: null,
    };
    await this.store.transaction(transaction => transaction.saveJob(job));
    return structuredClone(job);
  }

  async get(context: AssetContext, jobId: string): Promise<GenerationJob> {
    const job = await this.store.transaction(transaction => transaction.getJob(jobId));
    if (!job) throw new AssetServiceError('NOT_FOUND');
    await this.requireAccess(context.actorId, job.ownerId, 'read');
    return job;
  }

  async list(context: AssetContext, ownerId: string): Promise<GenerationJob[]> {
    await this.requireAccess(context.actorId, ownerId, 'read');
    return this.store.transaction(transaction => transaction.listJobs(ownerId));
  }

  async process(jobId: string): Promise<GenerationJob> {
    const started = await this.store.transaction(async transaction => {
      const current = await transaction.getJob(jobId);
      if (!current) throw new AssetServiceError('NOT_FOUND');
      if (current.state !== 'queued') return current;
      const processing = { ...current, state: 'processing' as const, generation: current.generation + 1, updatedAt: this.now() };
      await transaction.saveJob(processing);
      return processing;
    });
    if (started.state !== 'processing') return started;
    const controller = new AbortController();
    this.controllers.set(jobId, controller);
    try {
      const bundle = await this.generator.generate(structuredClone(started), controller.signal);
      const validated = validateAssetBundle(bundle, started.assetId);
      return await this.store.transaction(async transaction => {
        const current = await transaction.getJob(jobId);
        if (!current || current.state !== 'processing' || current.generation !== started.generation) return current ?? started;
        const asset: GeneratedAsset = { id: started.assetId, ownerId: started.ownerId, jobId, generation: started.generation, ...validated };
        await transaction.saveAsset(asset);
        const preview = { token: this.nextToken(), actorId: started.ownerId, assetHash: asset.hash, currentVersion: (await transaction.getCurrent(started.ownerId))?.version ?? 0, expiresAt: this.now() + 15 * 60_000 };
        const completed: GenerationJob = { ...current, state: 'preview', error: null, preview, updatedAt: this.now() };
        await transaction.saveJob(completed);
        return completed;
      });
    } catch (error) {
      const cancelled = controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
      return this.store.transaction(async transaction => {
        const current = await transaction.getJob(jobId);
        if (!current || current.state !== 'processing' || current.generation !== started.generation) return current ?? started;
        const failed: GenerationJob = { ...current, state: cancelled ? 'cancelled' : 'failed', error: cancelled ? 'CANCELLED' : error instanceof AssetServiceError && error.code === 'INVALID_ASSET' ? 'INVALID_ASSET' : 'PROVIDER_UNAVAILABLE', updatedAt: this.now() };
        await transaction.saveJob(failed);
        return failed;
      });
    } finally {
      if (this.controllers.get(jobId) === controller) this.controllers.delete(jobId);
    }
  }

  async cancel(context: AssetContext, jobId: string): Promise<GenerationJob> {
    const result = await this.store.transaction(async transaction => {
      const current = await transaction.getJob(jobId);
      if (!current) throw new AssetServiceError('NOT_FOUND');
      await this.requireAccess(context.actorId, current.ownerId, 'cancel');
      if (['confirmed', 'failed', 'cancelled'].includes(current.state)) return current;
      const cancelled: GenerationJob = { ...current, state: 'cancelled', error: 'CANCELLED', generation: current.generation + 1, updatedAt: this.now(), preview: null };
      await transaction.saveJob(cancelled);
      return cancelled;
    });
    this.controllers.get(jobId)?.abort();
    return result;
  }

  async confirm(context: AssetContext, jobId: string, previewToken: string): Promise<GenerationJob> {
    return this.store.transaction(async transaction => {
      const job = await transaction.getJob(jobId);
      if (!job) throw new AssetServiceError('NOT_FOUND');
      await this.requireAccess(context.actorId, job.ownerId, 'confirm');
      if (job.state !== 'preview' || !job.preview) throw new AssetServiceError('PREVIEW_REQUIRED');
      if (job.preview.actorId !== context.actorId || job.preview.token !== previewToken || job.preview.expiresAt <= this.now()) throw new AssetServiceError('PREVIEW_REQUIRED');
      const asset = await transaction.getAsset(job.assetId);
      if (!asset || asset.hash !== job.preview.assetHash) throw new AssetServiceError('INVALID_ASSET');
      const current = await transaction.getCurrent(job.ownerId);
      if ((current?.version ?? 0) !== job.preview.currentVersion) throw new AssetServiceError('VERSION_CONFLICT');
      await transaction.saveCurrent({ ownerId: job.ownerId, assetId: asset.id, assetHash: asset.hash, version: (current?.version ?? 0) + 1, updatedAt: this.now() });
      const confirmed: GenerationJob = { ...job, state: 'confirmed', generation: job.generation + 1, updatedAt: this.now(), preview: null };
      await transaction.saveJob(confirmed);
      return confirmed;
    });
  }

  async current(context: AssetContext, ownerId: string) {
    await this.requireAccess(context.actorId, ownerId, 'read');
    return this.store.transaction(transaction => transaction.getCurrent(ownerId));
  }

  private async requireAccess(actorId: string, ownerId: string, action: 'create' | 'read' | 'cancel' | 'confirm'): Promise<void> {
    if (!(await this.authorizer.authorize(actorId, ownerId, action))) throw new AssetServiceError('SCOPE_DENIED');
  }
}

export interface ConfigurationServiceOptions {
  store: ConfigurationStore;
  authorizer?: AssetAuthorizer;
  signer: ConfigurationSigningPort;
  verifier: ConfigurationVerificationPort;
  now?: () => number;
}

function bytes(value: string): Uint8Array { return new TextEncoder().encode(value); }
function base64(value: Uint8Array): string { return Buffer.from(value).toString('base64url'); }
function fromBase64(value: string): Uint8Array { return new Uint8Array(Buffer.from(value, 'base64url')); }
function configurationMessage(payload: ConfigurationPayload, hash: string): Uint8Array { return bytes(`${hash}.${canonicalJson(payload as never)}`); }

export class ConfigurationService {
  private readonly store: ConfigurationStore;
  private readonly authorizer: AssetAuthorizer;
  private readonly signer: ConfigurationSigningPort;
  private readonly verifier: ConfigurationVerificationPort;
  private readonly now: () => number;

  constructor(options: ConfigurationServiceOptions) {
    this.store = options.store;
    this.authorizer = options.authorizer ?? { authorize: async (actorId, ownerId) => actorId === ownerId };
    this.signer = options.signer;
    this.verifier = options.verifier;
    this.now = options.now ?? (() => Date.now());
  }

  async publish(context: AssetContext, payload: ConfigurationPayload, expectedRevision?: number): Promise<SignedConfiguration> {
    await this.requireAccess(context.actorId, payload.ownerId, 'publish');
    this.validatePayload(payload);
    const encoded = canonicalJson(payload as never);
    const hash = sha256(encoded);
    let signature: Uint8Array;
    try { signature = await this.signer.sign(configurationMessage(payload, hash)); } catch { throw new AssetServiceError('SIGNING_UNAVAILABLE'); }
    if (!(signature instanceof Uint8Array) || signature.length < 16) throw new AssetServiceError('SIGNING_UNAVAILABLE');
    const release: SignedConfiguration = { payload: structuredClone(payload), hash, keyId: this.signer.keyId, signature: base64(signature) };
    return this.store.transaction(async transaction => {
      const head = await transaction.getHead(payload.ownerId, payload.kind);
      if (expectedRevision !== undefined && expectedRevision !== (head?.revision ?? 0)) throw new AssetServiceError('VERSION_CONFLICT');
      if (head?.version === payload.version) throw new AssetServiceError('VERSION_CONFLICT');
      await transaction.saveRelease(release);
      await transaction.saveHead({ ownerId: payload.ownerId, kind: payload.kind, version: payload.version, revision: (head?.revision ?? 0) + 1 });
      return release;
    });
  }

  async get(context: AssetContext, ownerId: string, kind: ConfigurationPayload['kind'], version: string): Promise<SignedConfiguration> {
    await this.requireAccess(context.actorId, ownerId, 'read');
    const release = await this.store.transaction(transaction => transaction.getRelease(ownerId, kind, version));
    if (!release) throw new AssetServiceError('NOT_FOUND');
    await this.assertValid(release);
    return release;
  }

  async verify(context: AssetContext, ownerId: string, kind: ConfigurationPayload['kind'], version: string, clientVersion?: string): Promise<SignedConfiguration> {
    const release = await this.get(context, ownerId, kind, version);
    if (clientVersion && clientVersion < release.payload.minClientVersion) throw new AssetServiceError('INCOMPATIBLE_CLIENT');
    return release;
  }

  async rollback(context: AssetContext, ownerId: string, kind: ConfigurationPayload['kind'], version: string, expectedRevision?: number): Promise<ConfigurationPayload> {
    await this.requireAccess(context.actorId, ownerId, 'rollback');
    const release = await this.get(context, ownerId, kind, version);
    return this.store.transaction(async transaction => {
      const head = await transaction.getHead(ownerId, kind);
      if (!head || (expectedRevision !== undefined && expectedRevision !== head.revision)) throw new AssetServiceError('VERSION_CONFLICT');
      await transaction.saveHead({ ...head, version: release.payload.version, revision: head.revision + 1 });
      return structuredClone(release.payload);
    });
  }

  async head(context: AssetContext, ownerId: string, kind: ConfigurationPayload['kind']) {
    await this.requireAccess(context.actorId, ownerId, 'read');
    return this.store.transaction(transaction => transaction.getHead(ownerId, kind));
  }

  private async assertValid(release: SignedConfiguration): Promise<void> {
    this.validatePayload(release.payload);
    const hash = sha256(canonicalJson(release.payload as never));
    if (hash !== release.hash || release.keyId.length === 0 || !/^[A-Za-z0-9_-]+$/.test(release.signature)) throw new AssetServiceError('INVALID_SIGNATURE');
    let valid = false;
    try { valid = await this.verifier.verify(release.keyId, configurationMessage(release.payload, release.hash), fromBase64(release.signature)); } catch { valid = false; }
    if (!valid) throw new AssetServiceError('INVALID_SIGNATURE');
  }

  private validatePayload(payload: ConfigurationPayload): void {
    if (!payload || payload.schemaVersion !== '1' || !payload.ownerId || !/^[A-Za-z0-9._-]{1,100}$/.test(payload.version) || !payload.minClientVersion || !payload.safety || payload.safety.localGate !== true || payload.safety.stopOnRisk !== true || payload.safety.relayOnly !== true || !['flow', 'config'].includes(payload.kind) || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) throw new AssetServiceError('INVALID_REQUEST');
    canonicalJson(payload as never);
  }

  private async requireAccess(actorId: string, ownerId: string, action: 'publish' | 'read' | 'rollback'): Promise<void> {
    if (!(await this.authorizer.authorize(actorId, ownerId, action))) throw new AssetServiceError('SCOPE_DENIED');
  }
}
