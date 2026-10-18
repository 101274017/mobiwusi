export type ProviderKind = 'carrier_auth' | 'face_auth' | 'multimodal' | 'asr' | 'tts' | 'pet_generation';
export type ProviderSandboxScenario =
  | 'success'
  | 'stream_cancelled'
  | 'asr_no_result'
  | 'tts_timeout'
  | 'generation_cancelled'
  | 'face_invalid_proof'
  | 'carrier_no_sim'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'quality_below_threshold';
export type ProviderSandboxStatus = 'blocked' | 'passed' | 'failed' | 'cancelled';
export type ProviderSandboxFailureCode = 'AUTH_FAILED' | 'CANCELLED' | 'TIMEOUT' | 'PROVIDER_UNAVAILABLE' | 'PARTIAL_FAILURE' | 'RATE_LIMITED' | 'INVALID_REQUEST' | 'INVALID_RESPONSE' | 'NETWORK_DISABLED' | 'STALE_GENERATION' | 'BUDGET_EXCEEDED' | 'CIRCUIT_OPEN' | 'MODEL_BAD' | 'MODEL_UNKNOWN' | 'MODEL_TIMEOUT' | 'RISK_UNKNOWN' | 'RISK_BLOCKED';
export type ProviderFallback = 'none' | 'text_input' | 'captions_only' | 'keep_draft' | 'keep_existing_2d' | 'device_binding' | 'family_claim' | 'manual_help';
export type ProviderCaption = { id: string; index: number; text: string };

export interface ProviderSpec {
  provider: ProviderKind;
  capability: string;
  credentialRequirement: string;
  fallback: ProviderFallback;
  cancellationBoundary: string;
  qualityEvidence: string;
}

export interface ControlledCredentialEvidence {
  provider: ProviderKind;
  source: 'synthetic_fixture' | 'managed_vault_ref';
  reference: string;
  authorized: boolean;
  expiresAt: string;
  termsAccepted: boolean;
}

export interface ProviderSandboxRequest {
  provider: ProviderKind;
  scenario: ProviderSandboxScenario;
  requestId: string;
  generation: number;
}

export interface ProviderSandboxEvent {
  sequence: number;
  type: 'started' | 'delta' | 'completed' | 'cancelled' | 'failed';
  text?: string;
  code?: ProviderSandboxFailureCode;
}

export interface ProviderSandboxQuality {
  score: number;
  threshold: number;
}

export interface ProviderSandboxResult {
  provider: ProviderKind;
  scenario: ProviderSandboxScenario;
  generation: number;
  status: ProviderSandboxStatus;
  failureCode: ProviderSandboxFailureCode | null;
  fallback: ProviderFallback;
  events: ProviderSandboxEvent[];
  captions: readonly ProviderCaption[];
  credentialReferenceUsed: boolean;
  networkAttempted: false;
  rawPayloadsRetained: 0;
  quality: ProviderSandboxQuality | null;
}

export interface ProviderSandboxCheck {
  id: string;
  provider: ProviderKind;
  scenario: ProviderSandboxScenario;
  expected: ProviderSandboxStatus;
  passed: boolean;
  result: ProviderSandboxResult;
}

export interface ProviderSandboxReport {
  status: 'blocked';
  realCredentialState: 'missing';
  syntheticChecksPassed: boolean;
  productionReady: false;
  networkAttempted: false;
  rawPayloadsRetained: 0;
  checks: ProviderSandboxCheck[];
  gaps: string[];
}

export interface ProviderUsageDelta {
  inputUnits: number;
  outputUnits: number;
  estimatedCostMinor: number;
}

export type ProviderUsageOutcome = 'passed' | 'failed' | 'cancelled' | 'blocked';

export interface ProviderUsageRecord extends ProviderUsageDelta {
  provider: ProviderKind;
  operation: string;
  outcome: ProviderUsageOutcome;
  failureCode?: ProviderSandboxFailureCode | null;
}

export interface ProviderBudget {
  maxRequests?: number;
  maxInputUnits?: number;
  maxOutputUnits?: number;
  maxCostMinor?: number;
}

export interface ProviderFaultIsolationOptions {
  failureThreshold?: number;
  cooldownMs?: number;
}

export interface ProviderUsageLedgerOptions extends ProviderFaultIsolationOptions {
  budgets?: Partial<Record<ProviderKind, ProviderBudget>>;
  defaultBudget?: ProviderBudget;
  now?: () => number;
}

export interface ProviderUsageStat extends ProviderUsageDelta {
  requests: number;
  inFlight: number;
  reserved: ProviderUsageDelta;
  passed: number;
  failed: number;
  cancelled: number;
  blocked: number;
  timeoutCount: number;
  consecutiveFailures: number;
  circuit: 'closed' | 'open';
  failureCounts: Partial<Record<ProviderSandboxFailureCode, number>>;
}

export interface ProviderUsageSnapshot {
  providers: Readonly<Record<ProviderKind, ProviderUsageStat>>;
  total: ProviderUsageStat;
  networkAttempted: false;
  rawPayloadsRetained: 0;
}

export interface ProviderAdmission {
  allowed: boolean;
  failureCode: 'BUDGET_EXCEEDED' | 'CIRCUIT_OPEN' | null;
}

export interface ProviderReservation extends ProviderAdmission {
  reservationId: number | null;
}

export interface ProviderAdapterRequest {
  provider: ProviderKind;
  scenario: ProviderSandboxScenario;
  requestId: string;
  generation: number;
  captions: readonly ProviderCaption[];
  usageEstimate: ProviderUsageDelta;
}

export interface ProviderAdapterResponse {
  status: Exclude<ProviderSandboxStatus, 'blocked'>;
  failureCode?: ProviderSandboxFailureCode | null;
  events?: readonly ProviderSandboxEvent[];
  captions?: readonly ProviderCaption[];
  quality?: ProviderSandboxQuality | null;
  usage?: ProviderUsageDelta;
}

export interface ProviderAdapter {
  readonly provider: ProviderKind;
  readonly mode?: 'synthetic' | 'network';
  execute(request: ProviderAdapterRequest, signal: AbortSignal): Promise<ProviderAdapterResponse>;
}

export type ProviderAdapterPort = ProviderAdapter;

export type LocalModelState = 'healthy' | 'bad' | 'unknown' | 'timeout';
export type LocalRisk = 'safe' | 'unknown' | 'private' | 'transaction' | 'medical' | 'investment';

export interface LocalPolicyRequest {
  requestId?: string;
  generation?: number;
  modelState?: LocalModelState;
  risk?: LocalRisk;
}

export interface LocalPolicyModelResult {
  state: LocalModelState;
  risk?: LocalRisk;
}

export interface LocalPolicyModel {
  readonly id: string;
  readonly version: string;
  evaluate(request: LocalPolicyRequest, signal: AbortSignal): Promise<LocalPolicyModelResult>;
}

export type LocalPolicyReason = 'allowed' | 'model_bad' | 'model_unknown' | 'model_timeout' | 'stale_generation' | 'risk_unknown' | 'risk_blocked' | 'cancelled';

export interface LocalPolicyDecision {
  decision: 'allow' | 'deny';
  reason: LocalPolicyReason;
  modelState: LocalModelState;
  risk: LocalRisk;
  modelId: string;
  modelVersion: string;
  generation: number | null;
  networkAttempted: false;
  rawPayloadsRetained: 0;
}

export interface ProviderOrchestrationRequest extends ProviderSandboxRequest {
  timeoutMs?: number;
  captions?: readonly ProviderCaption[];
  usageEstimate?: ProviderUsageDelta;
  policy?: LocalPolicyRequest;
}

export interface ProviderOrchestratorOptions {
  sandbox?: ProviderSandbox;
  adapters?: readonly ProviderAdapter[];
  usage?: ProviderUsageLedger;
  policy?: LocalPolicyGate;
  defaultTimeoutMs?: number;
}

export const providerSandboxMatrix: readonly ProviderSpec[] = [
  {
    provider: 'carrier_auth',
    capability: '一次性运营商 token 兑换',
    credentialRequirement: '受控凭证、单次 nonce、回调验签和可审计区域',
    fallback: 'device_binding',
    cancellationBoundary: '兑换前取消或 nonce 已消费均不得创建会话',
    qualityEvidence: '无 SIM、过期 token、重放 token、错误绑定和替代认领结果',
  },
  {
    provider: 'face_auth',
    capability: '服务端活体与人脸证明',
    credentialRequirement: '已登记绑定、活体供应证明和数据保留条款',
    fallback: 'family_claim',
    cancellationBoundary: '相机/活体失败或撤回同意立即关闭交换出口',
    qualityEvidence: '无相机、低光、拒绝、错误绑定、撤权和重放 proof',
  },
  {
    provider: 'multimodal',
    capability: '受控多模态流式回答',
    credentialRequirement: '授权模型端点、配额、内容条款和取消接口',
    fallback: 'text_input',
    cancellationBoundary: '用户停止或风险暂停后不再产生新句段',
    qualityEvidence: '首片段时延、流式顺序、风险暂停、限流、断线和成本摘要',
  },
  {
    provider: 'asr',
    capability: '短时受控语音转写',
    credentialRequirement: '音频用途授权、时长配额、无结果与删除条款',
    fallback: 'text_input',
    cancellationBoundary: '停止录音后不提交新音频帧，迟到转写丢弃',
    qualityEvidence: '空结果、噪声、超时、取消、语言/时长边界和计费摘要',
  },
  {
    provider: 'tts',
    capability: '字幕绑定的句段播报',
    credentialRequirement: '句段接口、播放位置或可接受的纯字幕降级',
    fallback: 'captions_only',
    cancellationBoundary: '新 generation 取消旧播报，不删除完整字幕',
    qualityEvidence: '超时、失败、静音、播放位置、重复播报和字符/时长摘要',
  },
  {
    provider: 'pet_generation',
    capability: '异步可动 2D 桌宠生成',
    credentialRequirement: '图像生成授权、内容审核、资产许可和任务取消',
    fallback: 'keep_existing_2d',
    cancellationBoundary: '取消后迟到资产不能应用，草稿必须保留',
    qualityEvidence: '分层完整性、动作覆盖、相似性、成本、取消和旧资产回退',
  },
] as const;

const providerKinds = new Set<ProviderKind>(providerSandboxMatrix.map(item => item.provider));
const scenarios = new Set<ProviderSandboxScenario>([
  'success',
  'stream_cancelled',
  'asr_no_result',
  'tts_timeout',
  'generation_cancelled',
  'face_invalid_proof',
  'carrier_no_sim',
  'rate_limited',
  'provider_unavailable',
  'quality_below_threshold',
]);
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const credentialReferencePattern = /^vault:\/\/[A-Za-z0-9/_-]{1,160}$/;
const localModelStates = new Set<LocalModelState>(['healthy', 'bad', 'unknown', 'timeout']);
const localRisks = new Set<LocalRisk>(['safe', 'unknown', 'private', 'transaction', 'medical', 'investment']);

function providerSpec(provider: ProviderKind): ProviderSpec {
  return providerSandboxMatrix.find(item => item.provider === provider) as ProviderSpec;
}

function validCredential(value: ControlledCredentialEvidence, now: string): boolean {
  return !!value && typeof value === 'object' && providerKinds.has(value.provider) && typeof value.reference === 'string' && (value.source === 'synthetic_fixture' || (value.source === 'managed_vault_ref' && credentialReferencePattern.test(value.reference))) && value.reference.length <= 180 && value.authorized === true && value.termsAccepted === true && typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt)) && Date.parse(value.expiresAt) > Date.parse(now);
}

function validRequest(value: ProviderSandboxRequest): boolean {
  return !!value && typeof value === 'object' && providerKinds.has(value.provider) && scenarios.has(value.scenario) && typeof value.requestId === 'string' && requestIdPattern.test(value.requestId) && Number.isSafeInteger(value.generation) && value.generation >= 0;
}

function event(type: ProviderSandboxEvent['type'], sequence: number, text?: string, code?: ProviderSandboxFailureCode): ProviderSandboxEvent {
  return { sequence, type, ...(text === undefined ? {} : { text }), ...(code === undefined ? {} : { code }) };
}

function resultBase(request: ProviderSandboxRequest, spec: ProviderSpec, status: ProviderSandboxStatus, failureCode: ProviderSandboxFailureCode | null, events: ProviderSandboxEvent[], credentialReferenceUsed: boolean, quality: ProviderSandboxQuality | null = null): ProviderSandboxResult {
  return {
    provider: request.provider,
    scenario: request.scenario,
    generation: request.generation,
    status,
    failureCode,
    fallback: status === 'passed' ? 'none' : request.scenario === 'asr_no_result' ? 'text_input' : request.scenario === 'tts_timeout' ? 'captions_only' : request.scenario === 'generation_cancelled' || request.scenario === 'quality_below_threshold' ? 'keep_existing_2d' : request.scenario === 'face_invalid_proof' ? 'family_claim' : request.scenario === 'carrier_no_sim' ? 'device_binding' : spec.fallback,
    events,
    captions: [],
    credentialReferenceUsed,
    networkAttempted: false,
    rawPayloadsRetained: 0,
    quality,
  };
}

export class ProviderSandbox {
  private readonly credentialReferences = new Map<ProviderKind, string>();
  private readonly latestGenerations = new Map<string, number>();
  private readonly now: string;

  constructor(credentials: readonly ControlledCredentialEvidence[] = [], now = '2026-10-16T00:00:00.000Z') {
    if (!Number.isFinite(Date.parse(now))) throw new Error('沙箱时钟无效。');
    this.now = now;
    for (const credential of credentials) if (validCredential(credential, now)) this.credentialReferences.set(credential.provider, credential.reference);
  }

  hasUsableCredential(provider: ProviderKind): boolean {
    return this.credentialReferences.has(provider);
  }

  claimGeneration(request: ProviderSandboxRequest): boolean {
    const latest = this.latestGenerations.get(request.requestId);
    if (latest !== undefined && request.generation < latest) return false;
    if (latest === undefined || request.generation > latest) this.latestGenerations.set(request.requestId, request.generation);
    return true;
  }

  async run(request: ProviderSandboxRequest, signal: AbortSignal = new AbortController().signal): Promise<ProviderSandboxResult> {
    const fallback = providerKinds.has(request?.provider) ? providerSpec(request.provider).fallback : 'manual_help';
    if (!validRequest(request)) return { provider: request?.provider ?? 'multimodal', scenario: request?.scenario ?? 'provider_unavailable', generation: Number.isSafeInteger(request?.generation) ? request.generation : 0, status: 'failed', failureCode: 'INVALID_REQUEST', fallback, events: [event('failed', 0, undefined, 'INVALID_REQUEST')], captions: [], credentialReferenceUsed: false, networkAttempted: false, rawPayloadsRetained: 0, quality: null };
    const spec = providerSpec(request.provider);
    if (!this.claimGeneration(request)) return resultBase(request, spec, 'cancelled', 'STALE_GENERATION', [event('cancelled', 0, undefined, 'STALE_GENERATION')], false);
    if (!this.hasUsableCredential(request.provider)) return resultBase(request, spec, 'blocked', 'PROVIDER_UNAVAILABLE', [], false);
    await Promise.resolve();
    if (signal.aborted || request.scenario === 'stream_cancelled' || request.scenario === 'generation_cancelled') return resultBase(request, spec, 'cancelled', 'CANCELLED', [event('started', 0), event('cancelled', 1, undefined, 'CANCELLED')], true);
    if (request.scenario === 'asr_no_result') return resultBase(request, spec, 'failed', 'PARTIAL_FAILURE', [event('started', 0), event('failed', 1, undefined, 'PARTIAL_FAILURE')], true);
    if (request.scenario === 'tts_timeout') return resultBase(request, spec, 'failed', 'TIMEOUT', [event('started', 0), event('failed', 1, undefined, 'TIMEOUT')], true);
    if (request.scenario === 'face_invalid_proof') return resultBase(request, spec, 'failed', 'AUTH_FAILED', [event('started', 0), event('failed', 1, undefined, 'AUTH_FAILED')], true);
    if (request.scenario === 'carrier_no_sim') return resultBase(request, spec, 'failed', 'PROVIDER_UNAVAILABLE', [event('started', 0), event('failed', 1, undefined, 'PROVIDER_UNAVAILABLE')], true);
    if (request.scenario === 'rate_limited') return resultBase(request, spec, 'failed', 'RATE_LIMITED', [event('started', 0), event('failed', 1, undefined, 'RATE_LIMITED')], true);
    if (request.scenario === 'provider_unavailable') return resultBase(request, spec, 'failed', 'PROVIDER_UNAVAILABLE', [event('started', 0), event('failed', 1, undefined, 'PROVIDER_UNAVAILABLE')], true);
    if (request.scenario === 'quality_below_threshold') return resultBase(request, spec, 'failed', 'PARTIAL_FAILURE', [event('started', 0), event('failed', 1, undefined, 'PARTIAL_FAILURE')], true, { score: 0.42, threshold: 0.8 });
    return resultBase(request, spec, 'passed', null, [event('started', 0), event('delta', 1, 'synthetic-provider-result'), event('completed', 2)], true);
  }
}

const emptyUsage = (): ProviderUsageDelta => ({ inputUnits: 0, outputUnits: 0, estimatedCostMinor: 0 });
const zeroUsage = (): ProviderUsageStat => ({ inputUnits: 0, outputUnits: 0, estimatedCostMinor: 0, requests: 0, inFlight: 0, reserved: emptyUsage(), passed: 0, failed: 0, cancelled: 0, blocked: 0, timeoutCount: 0, consecutiveFailures: 0, circuit: 'closed', failureCounts: {} });
const validUsage = (usage: ProviderUsageDelta): boolean => Number.isSafeInteger(usage.inputUnits) && usage.inputUnits >= 0 && Number.isSafeInteger(usage.outputUnits) && usage.outputUnits >= 0 && Number.isSafeInteger(usage.estimatedCostMinor) && usage.estimatedCostMinor >= 0;
const validOutcome = (outcome: ProviderUsageOutcome): boolean => outcome === 'passed' || outcome === 'failed' || outcome === 'cancelled' || outcome === 'blocked';
const validFailureCode = (code: ProviderSandboxFailureCode | null | undefined): boolean => code === undefined || code === null || ['AUTH_FAILED', 'CANCELLED', 'TIMEOUT', 'PROVIDER_UNAVAILABLE', 'PARTIAL_FAILURE', 'RATE_LIMITED', 'INVALID_REQUEST', 'INVALID_RESPONSE', 'NETWORK_DISABLED', 'STALE_GENERATION', 'BUDGET_EXCEEDED', 'CIRCUIT_OPEN', 'MODEL_BAD', 'MODEL_UNKNOWN', 'MODEL_TIMEOUT', 'RISK_UNKNOWN', 'RISK_BLOCKED'].includes(code);

export class ProviderUsageLedger {
  private readonly stats = new Map<ProviderKind, ProviderUsageStat>();
  private readonly openedAt = new Map<ProviderKind, number>();
  private readonly budgets: Partial<Record<ProviderKind, ProviderBudget>>;
  private readonly defaultBudget: ProviderBudget;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private nextReservationId = 1;
  private readonly reservations = new Map<number, { provider: ProviderKind; usage: ProviderUsageDelta }>();

  constructor(options: ProviderUsageLedgerOptions = {}) {
    this.budgets = options.budgets ?? {};
    this.defaultBudget = options.defaultBudget ?? {};
    this.failureThreshold = Number.isSafeInteger(options.failureThreshold) && (options.failureThreshold ?? 0) > 0 ? options.failureThreshold! : 3;
    this.cooldownMs = Number.isFinite(options.cooldownMs) && (options.cooldownMs ?? -1) >= 0 ? options.cooldownMs! : 30_000;
    this.now = options.now ?? Date.now;
  }

  admit(provider: ProviderKind, estimate: ProviderUsageDelta = emptyUsage()): ProviderAdmission {
    if (!validUsage(estimate)) return { allowed: false, failureCode: 'BUDGET_EXCEEDED' };
    const current = this.stat(provider);
    const opened = this.openedAt.get(provider);
    if (opened !== undefined) {
      if (this.now() - opened < this.cooldownMs) return { allowed: false, failureCode: 'CIRCUIT_OPEN' };
      this.openedAt.delete(provider);
      current.circuit = 'closed';
      current.consecutiveFailures = 0;
    }
    const budget = { ...this.defaultBudget, ...this.budgets[provider] };
    if ((budget.maxRequests !== undefined && current.requests + current.inFlight >= budget.maxRequests)
      || (budget.maxInputUnits !== undefined && current.inputUnits + current.reserved.inputUnits + estimate.inputUnits > budget.maxInputUnits)
      || (budget.maxOutputUnits !== undefined && current.outputUnits + current.reserved.outputUnits + estimate.outputUnits > budget.maxOutputUnits)
      || (budget.maxCostMinor !== undefined && current.estimatedCostMinor + current.reserved.estimatedCostMinor + estimate.estimatedCostMinor > budget.maxCostMinor)) return { allowed: false, failureCode: 'BUDGET_EXCEEDED' };
    return { allowed: true, failureCode: null };
  }

  reserve(provider: ProviderKind, estimate: ProviderUsageDelta = emptyUsage()): ProviderReservation {
    const admission = this.admit(provider, estimate);
    if (!admission.allowed) return { ...admission, reservationId: null };
    const stat = this.stat(provider);
    const reservationId = this.nextReservationId++;
    stat.inFlight++;
    stat.reserved.inputUnits += estimate.inputUnits;
    stat.reserved.outputUnits += estimate.outputUnits;
    stat.reserved.estimatedCostMinor += estimate.estimatedCostMinor;
    this.reservations.set(reservationId, { provider, usage: { ...estimate } });
    return { allowed: true, failureCode: null, reservationId };
  }

  release(reservationId: number): void {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) return;
    const stat = this.stat(reservation.provider);
    stat.inFlight = Math.max(0, stat.inFlight - 1);
    stat.reserved.inputUnits = Math.max(0, stat.reserved.inputUnits - reservation.usage.inputUnits);
    stat.reserved.outputUnits = Math.max(0, stat.reserved.outputUnits - reservation.usage.outputUnits);
    stat.reserved.estimatedCostMinor = Math.max(0, stat.reserved.estimatedCostMinor - reservation.usage.estimatedCostMinor);
    this.reservations.delete(reservationId);
  }

  commit(reservationId: number, record: ProviderUsageRecord): void {
    this.release(reservationId);
    this.record(record);
  }

  record(record: ProviderUsageRecord): void {
    if (!providerKinds.has(record.provider) || !validUsage(record) || !validOutcome(record.outcome) || !validFailureCode(record.failureCode)) return;
    this.applyRecord(record);
  }

  private applyRecord(record: ProviderUsageRecord): void {
    const stat = this.stat(record.provider);
    stat.inputUnits += record.inputUnits;
    stat.outputUnits += record.outputUnits;
    stat.estimatedCostMinor += record.estimatedCostMinor;
    stat.requests++;
    stat[record.outcome]++;
    if (record.failureCode === 'TIMEOUT' || record.failureCode === 'MODEL_TIMEOUT') stat.timeoutCount++;
    if (record.failureCode) stat.failureCounts[record.failureCode] = (stat.failureCounts[record.failureCode] ?? 0) + 1;
    if (record.outcome === 'failed') {
      stat.consecutiveFailures++;
      if (stat.consecutiveFailures >= this.failureThreshold) {
        stat.circuit = 'open';
        this.openedAt.set(record.provider, this.now());
      }
    } else if (record.outcome === 'passed') {
      stat.consecutiveFailures = 0;
      stat.circuit = 'closed';
      this.openedAt.delete(record.provider);
    }
  }

  snapshot(): ProviderUsageSnapshot {
    const providers = Object.fromEntries(providerSandboxMatrix.map(({ provider }) => {
      const value = this.stat(provider);
      return [provider, { ...value, reserved: { ...value.reserved }, failureCounts: { ...value.failureCounts } }];
    })) as Record<ProviderKind, ProviderUsageStat>;
    const total = zeroUsage();
    for (const value of Object.values(providers)) {
      for (const key of ['inputUnits', 'outputUnits', 'estimatedCostMinor', 'requests', 'inFlight', 'passed', 'failed', 'cancelled', 'blocked', 'timeoutCount'] as const) total[key] += value[key];
      total.reserved.inputUnits += value.reserved.inputUnits;
      total.reserved.outputUnits += value.reserved.outputUnits;
      total.reserved.estimatedCostMinor += value.reserved.estimatedCostMinor;
      total.consecutiveFailures = Math.max(total.consecutiveFailures, value.consecutiveFailures);
      if (value.circuit === 'open') total.circuit = 'open';
      for (const [code, count] of Object.entries(value.failureCounts)) total.failureCounts[code as ProviderSandboxFailureCode] = (total.failureCounts[code as ProviderSandboxFailureCode] ?? 0) + count;
    }
    return { providers, total, networkAttempted: false, rawPayloadsRetained: 0 };
  }

  private stat(provider: ProviderKind): ProviderUsageStat {
    let value = this.stats.get(provider);
    if (!value) { value = zeroUsage(); this.stats.set(provider, value); }
    return value;
  }
}

class UnknownLocalModel implements LocalPolicyModel {
  readonly id = 'local-model-unconfigured';
  readonly version = 'unknown';
  async evaluate(): Promise<LocalPolicyModelResult> { return { state: 'unknown', risk: 'unknown' }; }
}

export class LocalPolicyGate {
  private readonly latestGeneration = new Map<string, number>();
  private readonly model: LocalPolicyModel;
  private readonly timeoutMs: number;

  constructor(model: LocalPolicyModel = new UnknownLocalModel(), timeoutMs = 250) {
    this.model = model;
    this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 250;
  }

  async evaluate(input: LocalPolicyRequest = {}, signal: AbortSignal = new AbortController().signal): Promise<LocalPolicyDecision> {
    const requestId = typeof input.requestId === 'string' && requestIdPattern.test(input.requestId) ? input.requestId : 'local-default';
    const generation = Number.isSafeInteger(input.generation) && (input.generation ?? -1) >= 0 ? input.generation! : null;
    if (generation !== null && generation < (this.latestGeneration.get(requestId) ?? generation)) return this.decision('deny', 'stale_generation', 'unknown', 'unknown', generation);
    if (generation !== null) this.latestGeneration.set(requestId, generation);
    if (signal.aborted) return this.decision('deny', 'cancelled', 'bad', 'unknown', generation);
    const modelController = new AbortController();
    const propagateAbort = () => modelController.abort(signal.reason);
    const rejectCancellation = () => cancelReject?.(new Error('POLICY_CANCELLED'));
    signal.addEventListener('abort', propagateAbort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelReject: ((reason?: unknown) => void) | undefined;
    signal.addEventListener('abort', rejectCancellation, { once: true });
    try {
      const modelResult = await Promise.race([
        this.model.evaluate(input, modelController.signal),
        new Promise<never>((_, reject) => { cancelReject = reject; }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { modelController.abort('timeout'); reject(new Error('MODEL_TIMEOUT')); }, this.timeoutMs); }),
      ]);
      if (signal.aborted) return this.decision('deny', 'cancelled', 'bad', 'unknown', generation);
      if (!modelResult || !localModelStates.has(modelResult.state)) return this.decision('deny', 'model_bad', 'bad', 'unknown', generation);
      const effectiveRisk = modelResult.risk === undefined ? localRisks.has(input.risk as LocalRisk) ? input.risk as LocalRisk : 'unknown' : localRisks.has(modelResult.risk as LocalRisk) ? modelResult.risk as LocalRisk : 'unknown';
      if (modelResult.state !== 'healthy') return this.decision('deny', modelResult.state === 'timeout' ? 'model_timeout' : modelResult.state === 'bad' ? 'model_bad' : 'model_unknown', modelResult.state, effectiveRisk, generation);
      if (generation !== null && this.latestGeneration.get(requestId) !== generation) return this.decision('deny', 'stale_generation', modelResult.state, effectiveRisk, generation);
      if (effectiveRisk !== 'safe') return this.decision('deny', effectiveRisk === 'unknown' ? 'risk_unknown' : 'risk_blocked', modelResult.state, effectiveRisk, generation);
      return this.decision('allow', 'allowed', modelResult.state, effectiveRisk, generation);
    } catch (error) {
      const timedOut = error instanceof Error && error.message === 'MODEL_TIMEOUT';
      const cancelled = signal.aborted || (error instanceof Error && error.message === 'POLICY_CANCELLED');
      return this.decision('deny', cancelled ? 'cancelled' : timedOut ? 'model_timeout' : 'model_bad', cancelled ? 'bad' : timedOut ? 'timeout' : 'bad', 'unknown', generation);
    } finally {
      if (timer) clearTimeout(timer);
      signal.removeEventListener('abort', propagateAbort);
      signal.removeEventListener('abort', rejectCancellation);
      cancelReject = undefined;
    }
  }

  private decision(decision: LocalPolicyDecision['decision'], reason: LocalPolicyReason, modelState: LocalModelState, risk: LocalRisk, generation: number | null): LocalPolicyDecision {
    return { decision, reason, modelState, risk, modelId: this.model.id, modelVersion: this.model.version, generation, networkAttempted: false, rawPayloadsRetained: 0 };
  }
}

function validCaptions(captions: readonly ProviderCaption[]): boolean {
  const ids = new Set<string>();
  return Array.isArray(captions) && captions.length <= 256 && captions.every((caption, index) => caption && requestIdPattern.test(caption.id) && !ids.has(caption.id) && Number.isSafeInteger(caption.index) && caption.index >= 0 && (index === 0 || captions[index - 1]!.index < caption.index) && typeof caption.text === 'string' && caption.text.length <= 4000 && ids.add(caption.id));
}

function validAdapterResponse(value: unknown): value is ProviderAdapterResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as ProviderAdapterResponse;
  if (!['passed', 'failed', 'cancelled'].includes(response.status)) return false;
  if (response.status === 'passed' && response.failureCode != null) return false;
  if (response.status === 'failed' && !response.failureCode) return false;
  if (response.status === 'cancelled' && response.failureCode != null && response.failureCode !== 'CANCELLED' && response.failureCode !== 'STALE_GENERATION') return false;
  if (response.failureCode !== undefined && response.failureCode !== null && !validFailureCode(response.failureCode)) return false;
  if (response.captions !== undefined && !validCaptions(response.captions)) return false;
  if (response.usage !== undefined && !validUsage(response.usage)) return false;
  if (response.quality !== undefined && response.quality !== null && (!Number.isFinite(response.quality.score) || !Number.isFinite(response.quality.threshold) || response.quality.score < 0 || response.quality.score > 1 || response.quality.threshold < 0 || response.quality.threshold > 1)) return false;
  if (response.events === undefined) return true;
  if (!Array.isArray(response.events) || response.events.length < 2 || response.events.length > 1024) return false;
  const terminal = response.status === 'passed' ? 'completed' : response.status === 'cancelled' ? 'cancelled' : 'failed';
  return response.events.every((item, index, events) => {
    if (!item || !['started', 'delta', 'completed', 'cancelled', 'failed'].includes(item.type) || !Number.isSafeInteger(item.sequence) || typeof item.sequence !== 'number' || (item.text !== undefined && (typeof item.text !== 'string' || item.text.length > 4000)) || (item.code !== undefined && item.code !== null && !validFailureCode(item.code))) return false;
    if (index === 0) return item.type === 'started';
    if (index === events.length - 1) return item.type === terminal && (item.code === undefined || item.code === response.failureCode || (response.status === 'cancelled' && item.code === 'CANCELLED'));
    return item.type === 'delta';
  });
}

function normalizedEvents(status: ProviderSandboxStatus, code: ProviderSandboxFailureCode | null, events?: readonly ProviderSandboxEvent[]): ProviderSandboxEvent[] {
  if (!events) {
    if (status === 'blocked') return [];
    return [event('started', 0), event(status === 'passed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'failed', 1, undefined, code ?? undefined)];
  }
  return events.map((item, index) => ({
    sequence: index,
    type: item.type,
    ...(item.type === 'delta' && item.text !== undefined ? { text: item.text } : {}),
    ...(index === events.length - 1 && code ? { code } : {}),
  }));
}

function terminalResult(request: ProviderSandboxRequest, status: ProviderSandboxStatus, code: ProviderSandboxFailureCode | null, fallback: ProviderFallback, captions: readonly ProviderCaption[], events?: readonly ProviderSandboxEvent[], quality: ProviderSandboxQuality | null = null, credentialReferenceUsed = false): ProviderSandboxResult {
  return { provider: request.provider, scenario: request.scenario, generation: request.generation, status, failureCode: code, fallback, events: normalizedEvents(status, code, events), captions, credentialReferenceUsed, networkAttempted: false, rawPayloadsRetained: 0, quality };
}

export class ProviderOrchestrator {
  private readonly sandbox: ProviderSandbox;
  private readonly adapters = new Map<ProviderKind, ProviderAdapter>();
  private readonly usage: ProviderUsageLedger;
  private readonly policy?: LocalPolicyGate;
  private readonly defaultTimeoutMs: number;
  private readonly latestGeneration = new Map<string, number>();
  private readonly active = new Map<string, { generation: number; controller: AbortController }>();

  constructor(options: ProviderOrchestratorOptions = {}) {
    this.sandbox = options.sandbox ?? new ProviderSandbox();
    this.usage = options.usage ?? new ProviderUsageLedger();
    this.policy = options.policy;
    this.defaultTimeoutMs = Number.isFinite(options.defaultTimeoutMs) && (options.defaultTimeoutMs ?? 0) > 0 ? options.defaultTimeoutMs! : 10_000;
    for (const adapter of options.adapters ?? []) if (adapter && providerKinds.has(adapter.provider) && typeof adapter.execute === 'function') this.adapters.set(adapter.provider, adapter);
  }

  async run(request: ProviderOrchestrationRequest, signal: AbortSignal = new AbortController().signal): Promise<ProviderSandboxResult> {
    const fallback = providerKinds.has(request?.provider) ? providerSpec(request.provider).fallback : 'manual_help';
    if (!validRequest(request)) return terminalResult({ provider: request?.provider ?? 'multimodal', scenario: request?.scenario ?? 'provider_unavailable', requestId: 'invalid', generation: 0 }, 'failed', 'INVALID_REQUEST', fallback, []);
    if (!this.sandbox.hasUsableCredential(request.provider)) return terminalResult(request, 'blocked', 'PROVIDER_UNAVAILABLE', fallback, []);
    const previousGeneration = this.latestGeneration.get(request.requestId);
    if (previousGeneration !== undefined && request.generation < previousGeneration) return terminalResult(request, 'cancelled', 'STALE_GENERATION', fallback, request.captions ?? []);
    if (previousGeneration === undefined || request.generation > previousGeneration) this.latestGeneration.set(request.requestId, request.generation);
    const previousActive = this.active.get(request.requestId);
    if (previousActive && request.generation > previousActive.generation) previousActive.controller.abort('superseded');
    const captions = request.captions ?? [];
    if (!validCaptions(captions)) return terminalResult(request, 'failed', 'INVALID_REQUEST', fallback, []);
    const estimate = request.usageEstimate ?? emptyUsage();
    if (!validUsage(estimate)) return terminalResult(request, 'failed', 'INVALID_REQUEST', fallback, captions);
    if (signal.aborted) return terminalResult(request, 'cancelled', 'CANCELLED', request.provider === 'tts' ? 'captions_only' : fallback, captions);
    const reservation = this.usage.reserve(request.provider, estimate);
    const settle = (outcome: ProviderUsageOutcome, failureCode: ProviderSandboxFailureCode | null, usage: ProviderUsageDelta = emptyUsage()) => {
      const record = { provider: request.provider, operation: request.scenario, outcome, failureCode, ...usage };
      if (reservation.reservationId === null) this.usage.record(record);
      else this.usage.commit(reservation.reservationId, record);
    };
    if (!reservation.allowed) {
      this.usage.record({ provider: request.provider, operation: request.scenario, outcome: 'blocked', failureCode: reservation.failureCode, ...emptyUsage() });
      return terminalResult(request, 'blocked', reservation.failureCode, request.provider === 'tts' ? 'captions_only' : fallback, captions);
    }
    if (this.policy || request.policy) {
      const policy = await (this.policy ?? new LocalPolicyGate()).evaluate({ ...(request.policy ?? {}), requestId: request.requestId, generation: request.generation }, signal);
      if (policy.decision !== 'allow') {
        const code: ProviderSandboxFailureCode = policy.reason === 'stale_generation' ? 'STALE_GENERATION' : policy.reason === 'cancelled' ? 'CANCELLED' : policy.reason === 'model_timeout' ? 'MODEL_TIMEOUT' : policy.reason === 'model_unknown' ? 'MODEL_UNKNOWN' : policy.reason === 'risk_unknown' ? 'RISK_UNKNOWN' : policy.reason === 'risk_blocked' ? 'RISK_BLOCKED' : 'MODEL_BAD';
        settle(code === 'CANCELLED' ? 'cancelled' : 'blocked', code);
        if (code === 'CANCELLED') return terminalResult(request, 'cancelled', code, request.provider === 'tts' ? 'captions_only' : fallback, captions);
        return terminalResult(request, 'blocked', code, request.provider === 'tts' ? 'captions_only' : fallback, captions);
      }
    }
    if (signal.aborted || this.latestGeneration.get(request.requestId) !== request.generation) {
      const code = signal.aborted ? 'CANCELLED' : 'STALE_GENERATION';
      settle('cancelled', code);
      return terminalResult(request, 'cancelled', code, request.provider === 'tts' ? 'captions_only' : fallback, captions);
    }
    const adapter = this.adapters.get(request.provider);
    if (!adapter) {
      settle('failed', 'PROVIDER_UNAVAILABLE');
      return terminalResult(request, 'failed', 'PROVIDER_UNAVAILABLE', request.provider === 'tts' ? 'captions_only' : fallback, captions);
    }
    if (adapter.mode !== undefined && adapter.mode !== 'synthetic') {
      settle('blocked', 'NETWORK_DISABLED');
      return terminalResult(request, 'blocked', 'NETWORK_DISABLED', request.provider === 'tts' ? 'captions_only' : fallback, captions);
    }
    const controller = new AbortController();
    this.active.set(request.requestId, { generation: request.generation, controller });
    let abortCause: 'external' | 'superseded' | 'timeout' | null = null;
    const abort = () => { abortCause ??= 'external'; controller.abort('external'); };
    signal.addEventListener('abort', abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTriggered = false;
    const timeoutMs = Number.isFinite(request.timeoutMs) && (request.timeoutMs ?? 0) > 0 ? request.timeoutMs! : this.defaultTimeoutMs;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { timeoutTriggered = true; abortCause = 'timeout'; controller.abort('timeout'); reject(new Error('ADAPTER_TIMEOUT')); }, timeoutMs); });
    let rejectAbort: ((reason?: unknown) => void) | undefined;
    const onControllerAbort = () => {
      const reason = controller.signal.reason;
      if (reason === 'timeout') abortCause = 'timeout';
      else if (reason === 'superseded') abortCause = 'superseded';
      else abortCause ??= 'external';
      rejectAbort?.(new Error('ADAPTER_CANCELLED'));
    };
    controller.signal.addEventListener('abort', onControllerAbort, { once: true });
    const cancelled = new Promise<never>((_, reject) => { rejectAbort = reject; });
    try {
      const response = await Promise.race([adapter.execute({ provider: request.provider, scenario: request.scenario, requestId: request.requestId, generation: request.generation, captions, usageEstimate: estimate }, controller.signal), timeout, cancelled]);
      if (signal.aborted || controller.signal.aborted || abortCause) {
        const code = abortCause === 'superseded' || this.latestGeneration.get(request.requestId) !== request.generation ? 'STALE_GENERATION' : abortCause === 'timeout' ? 'TIMEOUT' : 'CANCELLED';
        settle(code === 'TIMEOUT' ? 'failed' : 'cancelled', code);
        return terminalResult(request, code === 'TIMEOUT' ? 'failed' : 'cancelled', code, request.provider === 'tts' ? 'captions_only' : fallback, captions, undefined, null, true);
      }
      if (this.latestGeneration.get(request.requestId) !== request.generation) {
        settle('cancelled', 'STALE_GENERATION');
        return terminalResult(request, 'cancelled', 'STALE_GENERATION', request.provider === 'tts' ? 'captions_only' : fallback, captions, undefined, null, true);
      }
      if (!validAdapterResponse(response)) {
        settle('failed', 'INVALID_RESPONSE');
        return terminalResult(request, 'failed', 'INVALID_RESPONSE', request.provider === 'tts' ? 'captions_only' : fallback, captions, undefined, null, true);
      }
      const finalCaptions = request.provider === 'tts' ? captions : (response.captions ?? captions);
      const status = response.status;
      const failureCode = response.failureCode ?? (status === 'cancelled' ? 'CANCELLED' : null);
      settle(status, failureCode, response.usage ?? estimate);
      return terminalResult(request, status, failureCode, status === 'passed' ? 'none' : request.provider === 'tts' ? 'captions_only' : fallback, finalCaptions, response.events, response.quality ?? null, true);
    } catch (error) {
      const stale = this.latestGeneration.get(request.requestId) !== request.generation || abortCause === 'superseded';
      const timedOut = timeoutTriggered || abortCause === 'timeout';
      const wasCancelled = signal.aborted || abortCause === 'external';
      const code: ProviderSandboxFailureCode = stale ? 'STALE_GENERATION' : timedOut ? 'TIMEOUT' : wasCancelled ? 'CANCELLED' : 'PROVIDER_UNAVAILABLE';
      const status: ProviderSandboxStatus = stale || wasCancelled ? 'cancelled' : 'failed';
      settle(status === 'cancelled' ? 'cancelled' : 'failed', code);
      return terminalResult(request, status, code, request.provider === 'tts' ? 'captions_only' : fallback, captions, undefined, null, true);
    } finally {
      if (timer) clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', onControllerAbort);
      rejectAbort = undefined;
      if (this.active.get(request.requestId)?.controller === controller) this.active.delete(request.requestId);
    }
  }

  usageSnapshot(): ProviderUsageSnapshot { return this.usage.snapshot(); }
}

function fixtureCredential(provider: ProviderKind): ControlledCredentialEvidence {
  return { provider, source: 'synthetic_fixture', reference: `fixture-${provider}`, authorized: true, expiresAt: '2099-01-01T00:00:00.000Z', termsAccepted: true };
}

export async function verifyProviderSandbox(): Promise<ProviderSandboxReport> {
  const sandbox = new ProviderSandbox(providerSandboxMatrix.map(item => fixtureCredential(item.provider)));
  const definitions: Array<Omit<ProviderSandboxCheck, 'passed' | 'result'>> = [
    { id: 'multimodal-stream', provider: 'multimodal', scenario: 'success', expected: 'passed' },
    { id: 'stream-cancel', provider: 'multimodal', scenario: 'stream_cancelled', expected: 'cancelled' },
    { id: 'asr-no-result', provider: 'asr', scenario: 'asr_no_result', expected: 'failed' },
    { id: 'tts-timeout', provider: 'tts', scenario: 'tts_timeout', expected: 'failed' },
    { id: 'face-proof-rejected', provider: 'face_auth', scenario: 'face_invalid_proof', expected: 'failed' },
    { id: 'carrier-no-sim', provider: 'carrier_auth', scenario: 'carrier_no_sim', expected: 'failed' },
    { id: 'generation-cancel', provider: 'pet_generation', scenario: 'generation_cancelled', expected: 'cancelled' },
    { id: 'generation-quality', provider: 'pet_generation', scenario: 'quality_below_threshold', expected: 'failed' },
    { id: 'bounded-rate-limit', provider: 'multimodal', scenario: 'rate_limited', expected: 'failed' },
    { id: 'provider-unavailable', provider: 'multimodal', scenario: 'provider_unavailable', expected: 'failed' },
  ];
  const checks: ProviderSandboxCheck[] = [];
  for (const definition of definitions) {
    const result = await sandbox.run({ provider: definition.provider, scenario: definition.scenario, requestId: `c12-${definition.id}`, generation: 1 });
    checks.push({ ...definition, result, passed: result.status === definition.expected && !result.networkAttempted && result.rawPayloadsRetained === 0 });
  }
  const missingCredential = await new ProviderSandbox().run({ provider: 'multimodal', scenario: 'success', requestId: 'c12-missing-credential', generation: 1 });
  checks.push({ id: 'missing-credential-blocks', provider: 'multimodal', scenario: 'success', expected: 'blocked', result: missingCredential, passed: missingCredential.status === 'blocked' && missingCredential.failureCode === 'PROVIDER_UNAVAILABLE' && !missingCredential.networkAttempted && missingCredential.rawPayloadsRetained === 0 });
  return {
    status: 'blocked',
    realCredentialState: 'missing',
    syntheticChecksPassed: checks.every(check => check.passed),
    productionReady: false,
    networkAttempted: false,
    rawPayloadsRetained: 0,
    checks,
    gaps: [
      '未提供运营商、服务端人脸、ASR、TTS、多模态或手绘生成的真实授权凭证。',
      '未验证真实供应区域、配额、价格、数据保留、回调验签和合同条款。',
      '未验证真实音频质量、活体质量、流式首片段、取消延迟或生成资产质量。',
      '沙箱使用合成事件和受控引用，不代表真实网络接入或供应通过。',
    ],
  };
}
