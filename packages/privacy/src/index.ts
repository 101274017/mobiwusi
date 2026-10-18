import type { Risk } from '@nuanban/domain';
export interface GateContext { risk: Risk; consent: boolean; detectorHealthy: boolean; generation: number; }
export function canSendFrame(context: GateContext, frameGeneration: number): boolean { return context.consent && context.detectorHealthy && context.risk === 'safe' && context.generation === frameGeneration; }
export class SendingGate {
  private context: GateContext = { risk:'unknown',consent:false,detectorHealthy:false,generation:0 };
  authorize(context: GateContext): void { this.context = { ...context }; }
  stop(): void { this.context = { ...this.context, consent:false, generation:this.context.generation+1 }; }
  permits(generation: number): boolean { return canSendFrame(this.context,generation); }
  get generation(): number { return this.context.generation; }
}

export type DetectorStatus = 'healthy' | 'failed' | 'timeout' | 'unavailable';
export type OcrStatus = 'complete' | 'failed' | 'timeout' | 'unavailable';
export type FaceRedactionStatus = 'not_required' | 'applied' | 'failed';
export type LocalPageKind = 'verified' | 'unknown';
export type FrameDecision = 'allow' | 'pause' | 'deny';
export type FrameDecisionReason =
  | 'safe'
  | 'missing_system_authorization'
  | 'missing_consent'
  | 'session_stopped'
  | 'stale_generation'
  | 'destination_unauthorized'
  | 'frame_expired'
  | 'future_frame'
  | 'detector_failed'
  | 'detector_timeout'
  | 'detector_unavailable'
  | 'unknown_page'
  | 'ocr_failed'
  | 'ocr_timeout'
  | 'ocr_unavailable'
  | 'low_confidence'
  | 'face_redaction_failed'
  | 'transaction_risk'
  | 'private_risk'
  | 'medical_risk'
  | 'investment_risk'
  | 'invalid_frame';

export interface LocalFrameInput {
  frameId: string;
  frameHash: string;
  generation: number;
  capturedAt: number;
  pageKind: LocalPageKind;
  detectorStatus: DetectorStatus;
  ocrStatus: OcrStatus;
  text: string;
  confidence: number;
  thirdPartyFaces: number;
  faceRedaction: FaceRedactionStatus;
}

export interface LocalGateContext {
  systemAuthorized: boolean;
  consent: boolean;
  sessionActive: boolean;
  destinationAuthorized: boolean;
  generation: number;
  policyVersion: string;
  maxFrameAgeMs: number;
  minimumConfidence: number;
}

export interface FrameDecisionResult {
  decision: FrameDecision;
  reason: FrameDecisionReason;
  risk: Risk;
  frameId: string;
  frameHash: string;
  generation: number;
  policyVersion: string;
  evaluatedAt: number;
  redactionApplied: boolean;
  outboundAllowed: boolean;
}

export interface SafetyTicket {
  ticketId: string;
  frameId: string;
  frameHash: string;
  generation: number;
  policyVersion: string;
  issuedAt: number;
  expiresAt: number;
  destination: 'authorized';
}

const localRiskReasons: Record<Exclude<Risk, 'safe' | 'unknown'>, FrameDecisionReason> = {
  transaction: 'transaction_risk',
  private: 'private_risk',
  medical: 'medical_risk',
  investment: 'investment_risk',
};

const frameDecisions = new Set<FrameDecision>(['allow', 'pause', 'deny']);
const frameReasons = new Set<FrameDecisionReason>([
  'safe', 'missing_system_authorization', 'missing_consent', 'session_stopped', 'stale_generation', 'destination_unauthorized', 'frame_expired', 'future_frame',
  'detector_failed', 'detector_timeout', 'detector_unavailable', 'unknown_page', 'ocr_failed', 'ocr_timeout', 'ocr_unavailable', 'low_confidence',
  'face_redaction_failed', 'transaction_risk', 'private_risk', 'medical_risk', 'investment_risk', 'invalid_frame',
]);
const frameRisks = new Set<Risk>(['safe', 'private', 'transaction', 'unknown', 'medical', 'investment']);

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function finiteInteger(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value); }
function finiteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function nonEmptyAscii(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 128 && /^[\x21-\x7e]+$/.test(value); }
function validRiskContext(context: unknown): context is LocalGateContext {
  return exactRecord(context, ['systemAuthorized', 'consent', 'sessionActive', 'destinationAuthorized', 'generation', 'policyVersion', 'maxFrameAgeMs', 'minimumConfidence'])
    && typeof context.systemAuthorized === 'boolean'
    && typeof context.consent === 'boolean'
    && typeof context.sessionActive === 'boolean'
    && typeof context.destinationAuthorized === 'boolean'
    && finiteInteger(context.generation) && context.generation >= 0
    && nonEmptyAscii(context.policyVersion)
    && finiteInteger(context.maxFrameAgeMs) && context.maxFrameAgeMs > 0 && context.maxFrameAgeMs <= 10_000
    && finiteNumber(context.minimumConfidence) && context.minimumConfidence >= 0 && context.minimumConfidence <= 1;
}

function validFrameInput(input: unknown): input is LocalFrameInput {
  return exactRecord(input, ['frameId', 'frameHash', 'generation', 'capturedAt', 'pageKind', 'detectorStatus', 'ocrStatus', 'text', 'confidence', 'thirdPartyFaces', 'faceRedaction'])
    && nonEmptyAscii(input.frameId)
    && nonEmptyAscii(input.frameHash)
    && finiteInteger(input.generation) && input.generation >= 0
    && finiteNumber(input.capturedAt) && input.capturedAt >= 0
    && (input.pageKind === 'verified' || input.pageKind === 'unknown')
    && (input.detectorStatus === 'healthy' || input.detectorStatus === 'failed' || input.detectorStatus === 'timeout' || input.detectorStatus === 'unavailable')
    && (input.ocrStatus === 'complete' || input.ocrStatus === 'failed' || input.ocrStatus === 'timeout' || input.ocrStatus === 'unavailable')
    && typeof input.text === 'string' && input.text.length <= 20_000
    && finiteNumber(input.confidence) && input.confidence >= 0 && input.confidence <= 1
    && finiteInteger(input.thirdPartyFaces) && input.thirdPartyFaces >= 0 && input.thirdPartyFaces <= 100
    && (input.faceRedaction === 'not_required' || input.faceRedaction === 'applied' || input.faceRedaction === 'failed');
}

function validDecisionResult(result: unknown): result is FrameDecisionResult {
  if (!exactRecord(result, ['decision', 'reason', 'risk', 'frameId', 'frameHash', 'generation', 'policyVersion', 'evaluatedAt', 'redactionApplied', 'outboundAllowed'])) return false;
  return frameDecisions.has(result.decision as FrameDecision)
    && frameReasons.has(result.reason as FrameDecisionReason)
    && frameRisks.has(result.risk as Risk)
    && nonEmptyAscii(result.frameId)
    && nonEmptyAscii(result.frameHash)
    && finiteInteger(result.generation) && result.generation >= 0
    && nonEmptyAscii(result.policyVersion)
    && finiteNumber(result.evaluatedAt) && result.evaluatedAt >= 0
    && typeof result.redactionApplied === 'boolean'
    && typeof result.outboundAllowed === 'boolean';
}

function baseResult(input: unknown, context: unknown, reason: FrameDecisionReason, risk: Risk, decision: FrameDecision, evaluatedAt: number): FrameDecisionResult {
  const inputRecord = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const contextRecord = context && typeof context === 'object' ? context as Record<string, unknown> : {};
  return {
    decision,
    reason,
    risk,
    frameId: nonEmptyAscii(inputRecord.frameId) ? inputRecord.frameId : 'invalid-frame',
    frameHash: nonEmptyAscii(inputRecord.frameHash) ? inputRecord.frameHash : 'invalid-hash',
    generation: finiteInteger(inputRecord.generation) ? inputRecord.generation : -1,
    policyVersion: nonEmptyAscii(contextRecord.policyVersion) ? contextRecord.policyVersion : 'invalid-policy',
    evaluatedAt,
    redactionApplied: inputRecord.faceRedaction === 'applied',
    outboundAllowed: decision === 'allow',
  };
}

export function classifyLocalTextRisk(text: string): Risk {
  if (typeof text !== 'string') return 'unknown';
  return text.trim().length === 0 ? 'unknown' : detectLocalTextRisk(text);
}

function detectLocalTextRisk(text: string): Risk {
  if (/转账|支付|付款|验证码|银行卡|汇款|充值|收款码|短信校验/.test(text)) return 'transaction';
  if (/密码|私人聊天|身份证|账户口令|私密|聊天记录/.test(text)) return 'private';
  if (/药量|剂量|停药|吃什么药|诊断|用药方案/.test(text)) return 'medical';
  if (/买什么股票|投资建议|稳赚|理财决策|基金推荐/.test(text)) return 'investment';
  return 'safe';
}

export function evaluateLocalFrame(input: unknown, context: unknown, evaluatedAt: unknown): FrameDecisionResult {
  if (!validFrameInput(input) || !validRiskContext(context) || !finiteNumber(evaluatedAt) || evaluatedAt < 0) {
    return baseResult(input, context, 'invalid_frame', 'unknown', 'deny', finiteNumber(evaluatedAt) ? evaluatedAt : 0);
  }
  if (!context.sessionActive) return baseResult(input, context, 'session_stopped', 'unknown', 'deny', evaluatedAt);
  if (!context.systemAuthorized) return baseResult(input, context, 'missing_system_authorization', 'unknown', 'deny', evaluatedAt);
  if (!context.consent) return baseResult(input, context, 'missing_consent', 'unknown', 'deny', evaluatedAt);
  if (input.generation !== context.generation) return baseResult(input, context, 'stale_generation', 'unknown', 'deny', evaluatedAt);
  if (!context.destinationAuthorized) return baseResult(input, context, 'destination_unauthorized', 'unknown', 'deny', evaluatedAt);
  if (evaluatedAt < input.capturedAt) return baseResult(input, context, 'future_frame', 'unknown', 'deny', evaluatedAt);
  if (evaluatedAt - input.capturedAt > context.maxFrameAgeMs) return baseResult(input, context, 'frame_expired', 'unknown', 'deny', evaluatedAt);
  if (input.detectorStatus !== 'healthy') {
    const reason = input.detectorStatus === 'failed' ? 'detector_failed' : input.detectorStatus === 'timeout' ? 'detector_timeout' : 'detector_unavailable';
    return baseResult(input, context, reason, 'unknown', 'pause', evaluatedAt);
  }
  if (input.pageKind === 'unknown') return baseResult(input, context, 'unknown_page', 'unknown', 'pause', evaluatedAt);
  if (input.ocrStatus !== 'complete') {
    const reason = input.ocrStatus === 'failed' ? 'ocr_failed' : input.ocrStatus === 'timeout' ? 'ocr_timeout' : 'ocr_unavailable';
    return baseResult(input, context, reason, 'unknown', 'pause', evaluatedAt);
  }
  if (input.confidence < context.minimumConfidence) return baseResult(input, context, 'low_confidence', 'unknown', 'pause', evaluatedAt);
  if (input.thirdPartyFaces > 0 && input.faceRedaction !== 'applied') return baseResult(input, context, 'face_redaction_failed', 'private', 'pause', evaluatedAt);
  const risk = classifyLocalTextRisk(input.text);
  if (risk === 'unknown') return baseResult(input, context, 'unknown_page', risk, 'pause', evaluatedAt);
  if (risk !== 'safe') return baseResult(input, context, localRiskReasons[risk], risk, 'pause', evaluatedAt);
  return baseResult(input, context, 'safe', 'safe', 'allow', evaluatedAt);
}

export function issueSafetyTicket(result: FrameDecisionResult, ticketId: string, ttlMs: number): SafetyTicket | null {
  if (!validDecisionResult(result) || result.decision !== 'allow' || !result.outboundAllowed || !nonEmptyAscii(ticketId) || !finiteInteger(ttlMs) || ttlMs <= 0 || ttlMs > 2_000) return null;
  return { ticketId, frameId: result.frameId, frameHash: result.frameHash, generation: result.generation, policyVersion: result.policyVersion, issuedAt: result.evaluatedAt, expiresAt: result.evaluatedAt + ttlMs, destination: 'authorized' };
}

export function verifySafetyTicket(ticket: unknown, input: unknown, context: unknown, now: unknown): boolean {
  if (!exactRecord(ticket, ['ticketId', 'frameId', 'frameHash', 'generation', 'policyVersion', 'issuedAt', 'expiresAt', 'destination']) || !nonEmptyAscii(ticket.ticketId) || !nonEmptyAscii(ticket.frameId) || !nonEmptyAscii(ticket.frameHash) || !finiteInteger(ticket.generation) || !nonEmptyAscii(ticket.policyVersion) || !finiteNumber(ticket.issuedAt) || !finiteNumber(ticket.expiresAt) || ticket.expiresAt <= ticket.issuedAt || ticket.destination !== 'authorized' || !validFrameInput(input) || !validRiskContext(context) || !finiteNumber(now)) return false;
  return ticket.frameId === input.frameId && ticket.frameHash === input.frameHash && ticket.generation === input.generation && ticket.policyVersion === context.policyVersion && context.sessionActive && context.consent && context.systemAuthorized && context.destinationAuthorized && context.generation === input.generation && now >= ticket.issuedAt && now < ticket.expiresAt;
}

export class FrameSafetyGate {
  private context: LocalGateContext = { systemAuthorized: false, consent: false, sessionActive: false, destinationAuthorized: false, generation: 0, policyVersion: 'uninitialized', maxFrameAgeMs: 500, minimumConfidence: 0.85 };
  authorize(context: LocalGateContext): void {
    if (!validRiskContext(context)) throw new Error('无效的本地安全门控上下文');
    this.context = { ...context };
  }
  stop(): void { this.context = { ...this.context, systemAuthorized: false, consent: false, sessionActive: false, destinationAuthorized: false, generation: this.context.generation + 1 }; }
  evaluate(input: LocalFrameInput, now: number): FrameDecisionResult { return evaluateLocalFrame(input, this.context, now); }
  issue(input: LocalFrameInput, now: number, ticketId: string, ttlMs = 500): SafetyTicket | null { return issueSafetyTicket(this.evaluate(input, now), ticketId, ttlMs); }
  permits(ticket: SafetyTicket, input: LocalFrameInput, now: number): boolean { return verifySafetyTicket(ticket, input, this.context, now); }
  get generation(): number { return this.context.generation; }
  get policyVersion(): string { return this.context.policyVersion; }
}
