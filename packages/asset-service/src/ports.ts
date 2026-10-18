import type { AnimatedPetAssetManifest, AnimatedPetQualityReport, DrawingStroke } from '../../pet-engine/src/index.ts';

export interface AssetContext { actorId: string; }
export type AssetAction = 'create' | 'read' | 'cancel' | 'confirm' | 'publish' | 'rollback';
export interface AssetAuthorizer {
  authorize(actorId: string, ownerId: string, action: AssetAction): Promise<boolean>;
}
export interface PetPreferences {
  eyes: 'round' | 'happy' | 'sleepy';
  mouth: 'smile' | 'small' | 'open';
  color: string;
  action: 'idle' | 'greeting' | 'celebrating';
}
export type GenerationInput =
  | { kind: 'drawing'; strokes: DrawingStroke[]; preferences: PetPreferences }
  | { kind: 'preferences'; preferences: PetPreferences };
export interface AssetFile { path: string; bytes: Uint8Array; sha256: string; }
export interface AssetBundle { manifest: unknown; files: AssetFile[]; }
export interface GenerationRequest {
  jobId: string;
  assetId: string;
  ownerId: string;
  generation: number;
  input: GenerationInput;
}
export interface PetGenerationPort {
  generate(request: GenerationRequest, signal: AbortSignal): Promise<AssetBundle>;
}
export type GenerationState = 'queued' | 'processing' | 'preview' | 'confirmed' | 'cancelled' | 'failed';
export interface GenerationJob extends GenerationRequest {
  state: GenerationState;
  error: 'PROVIDER_UNAVAILABLE' | 'INVALID_ASSET' | 'TIMEOUT' | 'CANCELLED' | null;
  createdAt: number;
  updatedAt: number;
  preview: { token: string; actorId: string; assetHash: string; currentVersion: number; expiresAt: number } | null;
}
export interface GeneratedAsset {
  id: string;
  ownerId: string;
  jobId: string;
  generation: number;
  manifest: AnimatedPetAssetManifest;
  files: AssetFile[];
  hash: string;
  quality: AnimatedPetQualityReport;
}
export interface CurrentPet {
  ownerId: string;
  assetId: string;
  assetHash: string;
  version: number;
  updatedAt: number;
}
export interface AssetTransaction {
  getJob(id: string): Promise<GenerationJob | null>;
  saveJob(job: GenerationJob): Promise<void>;
  listJobs(ownerId: string): Promise<GenerationJob[]>;
  getAsset(id: string): Promise<GeneratedAsset | null>;
  saveAsset(asset: GeneratedAsset): Promise<void>;
  deleteAsset(id: string): Promise<void>;
  getCurrent(ownerId: string): Promise<CurrentPet | null>;
  saveCurrent(current: CurrentPet): Promise<void>;
}
export interface AssetStore {
  transaction<Result>(work: (transaction: AssetTransaction) => Promise<Result>): Promise<Result>;
}
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ConfigurationKind = 'flow' | 'config';
export interface ConfigurationPayload {
  schemaVersion: '1';
  ownerId: string;
  kind: ConfigurationKind;
  version: string;
  minClientVersion: string;
  safety: { localGate: true; stopOnRisk: true; relayOnly: true };
  data: { [key: string]: JsonValue };
}
export interface SignedConfiguration {
  payload: ConfigurationPayload;
  hash: string;
  keyId: string;
  signature: string;
}
export interface ConfigurationSigningPort {
  readonly keyId: string;
  sign(message: Uint8Array): Promise<Uint8Array>;
}
export interface ConfigurationVerificationPort {
  verify(keyId: string, message: Uint8Array, signature: Uint8Array): Promise<boolean>;
}
export interface ConfigurationHead {
  ownerId: string;
  kind: ConfigurationKind;
  version: string;
  revision: number;
}
export interface ConfigurationTransaction {
  getRelease(ownerId: string, kind: ConfigurationKind, version: string): Promise<SignedConfiguration | null>;
  saveRelease(release: SignedConfiguration): Promise<void>;
  getHead(ownerId: string, kind: ConfigurationKind): Promise<ConfigurationHead | null>;
  saveHead(head: ConfigurationHead): Promise<void>;
}
export interface ConfigurationStore {
  transaction<Result>(work: (transaction: ConfigurationTransaction) => Promise<Result>): Promise<Result>;
}
export class AssetServiceError extends Error {
  constructor(readonly code: 'SCOPE_DENIED' | 'NOT_FOUND' | 'INVALID_REQUEST' | 'INVALID_STATE' | 'INVALID_ASSET' | 'PREVIEW_REQUIRED' | 'VERSION_CONFLICT' | 'SIGNING_UNAVAILABLE' | 'INVALID_SIGNATURE' | 'INCOMPATIBLE_CLIENT', message: string = code) {
    super(message);
    this.name = 'AssetServiceError';
  }
}
export class OwnerAssetAuthorizer implements AssetAuthorizer {
  async authorize(actorId: string, ownerId: string): Promise<boolean> {
    return typeof actorId === 'string' && actorId.length > 0 && actorId === ownerId;
  }
}
