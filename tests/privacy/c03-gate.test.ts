import { describe, expect, it } from 'vitest';
import {
  FrameSafetyGate,
  classifyLocalTextRisk,
  evaluateLocalFrame,
  issueSafetyTicket,
  verifySafetyTicket,
  type LocalFrameInput,
  type LocalGateContext,
} from '@nuanban/privacy';

const context: LocalGateContext = {
  systemAuthorized: true,
  consent: true,
  sessionActive: true,
  destinationAuthorized: true,
  generation: 4,
  policyVersion: 'privacy-0.3.0',
  maxFrameAgeMs: 500,
  minimumConfidence: 0.85,
};

const frame = (overrides: Partial<LocalFrameInput> = {}): LocalFrameInput => ({
  frameId: 'frame-4-001',
  frameHash: 'sha256-canary-safe-001',
  generation: 4,
  capturedAt: 1_000,
  pageKind: 'verified',
  detectorStatus: 'healthy',
  ocrStatus: 'complete',
  text: 'NUANBAN-C03-SYNTHETIC safe page',
  confidence: 0.98,
  thirdPartyFaces: 0,
  faceRedaction: 'not_required',
  ...overrides,
});

describe('C03 本地逐帧风险门控', () => {
  it('允许安全、已授权、同代际且未过期的合成帧', () => {
    const result = evaluateLocalFrame(frame(), context, 1_200);
    expect(result).toMatchObject({ decision: 'allow', reason: 'safe', risk: 'safe', outboundAllowed: true, redactionApplied: false });
    expect(result).not.toHaveProperty('text');
  });

  it.each([
    ['system', { systemAuthorized: false }, 'missing_system_authorization'],
    ['purpose', { consent: false }, 'missing_consent'],
    ['session', { sessionActive: false }, 'session_stopped'],
    ['destination', { destinationAuthorized: false }, 'destination_unauthorized'],
    ['generation', { generation: 3 }, 'stale_generation'],
  ] as const)('缺少 %s 门控时拒绝外发', (_name, changes, reason) => {
    const result = evaluateLocalFrame(frame(), { ...context, ...changes }, 1_200);
    expect(result).toMatchObject({ decision: 'deny', outboundAllowed: false, reason });
  });

  it.each([
    [1_501, 'frame_expired'],
    [999, 'future_frame'],
  ] as const)('帧时间边界 %s 产生 %s', (now, reason) => {
    const result = evaluateLocalFrame(frame(), context, now);
    expect(result).toMatchObject({ decision: 'deny', outboundAllowed: false, reason });
  });

  it.each([
    ['failed', 'detector_failed'],
    ['timeout', 'detector_timeout'],
    ['unavailable', 'detector_unavailable'],
  ] as const)('检测器 %s 时保守暂停且标为未知', (detectorStatus, reason) => {
    const result = evaluateLocalFrame(frame({ detectorStatus }), context, 1_200);
    expect(result).toMatchObject({ decision: 'pause', risk: 'unknown', outboundAllowed: false, reason });
  });

  it.each([
    ['unknown page', { pageKind: 'unknown' as const }, 'unknown_page'],
    ['OCR failure', { ocrStatus: 'failed' as const }, 'ocr_failed'],
    ['OCR timeout', { ocrStatus: 'timeout' as const }, 'ocr_timeout'],
    ['OCR unavailable', { ocrStatus: 'unavailable' as const }, 'ocr_unavailable'],
    ['low confidence', { confidence: 0.849 }, 'low_confidence'],
  ] as const)('%s 不得凭猜测发送', (_name, changes, reason) => {
    const result = evaluateLocalFrame(frame(changes), context, 1_200);
    expect(result).toMatchObject({ decision: 'pause', risk: 'unknown', outboundAllowed: false, reason });
  });

  it('第三方人脸已可靠脱敏才允许继续走安全文字样例', () => {
    const result = evaluateLocalFrame(frame({ thirdPartyFaces: 2, faceRedaction: 'applied' }), context, 1_200);
    expect(result).toMatchObject({ decision: 'allow', reason: 'safe', redactionApplied: true, outboundAllowed: true });
  });

  it.each(['not_required', 'failed'] as const)('第三方人脸脱敏状态 %s 时暂停', faceRedaction => {
    const result = evaluateLocalFrame(frame({ thirdPartyFaces: 1, faceRedaction }), context, 1_200);
    expect(result).toMatchObject({ decision: 'pause', risk: 'private', reason: 'face_redaction_failed', outboundAllowed: false });
  });

  it.each([
    ['支付和私人聊天同时出现', '请支付前先看私人聊天记录', 'transaction', 'transaction_risk'],
    ['私人内容', '这是私人聊天和账户口令', 'private', 'private_risk'],
    ['医疗决策', '请告诉我停药后的药量和诊断', 'medical', 'medical_risk'],
    ['投资决策', '请推荐稳赚的基金投资', 'investment', 'investment_risk'],
  ] as const)('文本风险：%s 按保守优先级暂停', (_name, text, risk, reason) => {
    const result = evaluateLocalFrame(frame({ text }), context, 1_200);
    expect(result).toMatchObject({ decision: 'pause', risk, reason, outboundAllowed: false });
  });

  it('空文本不能把 OCR 缺失伪装成安全', () => {
    expect(classifyLocalTextRisk('')).toBe('unknown');
    const result = evaluateLocalFrame(frame({ text: '' }), context, 1_200);
    expect(result).toMatchObject({ decision: 'pause', risk: 'unknown', reason: 'unknown_page' });
  });

  it('明确的固定 canary 文字可判为安全，但结果不带原文', () => {
    expect(classifyLocalTextRisk('NUANBAN-C03-SYNTHETIC')).toBe('safe');
    const result = evaluateLocalFrame(frame({ text: 'NUANBAN-C03-SYNTHETIC' }), context, 1_200);
    expect(result).toMatchObject({ decision: 'allow', risk: 'safe' });
    expect(JSON.stringify(result)).not.toContain('NUANBAN-C03-SYNTHETIC');
  });
});

describe('C03 短时安全票据与停止竞态', () => {
  it('安全结果才能签发绑定 frame hash、代际和策略版本的票据', () => {
    const result = evaluateLocalFrame(frame(), context, 1_200);
    const ticket = issueSafetyTicket(result, 'ticket-c03-001', 500);
    expect(ticket).toMatchObject({ ticketId: 'ticket-c03-001', frameId: frame().frameId, frameHash: frame().frameHash, generation: 4, policyVersion: context.policyVersion, issuedAt: 1_200, expiresAt: 1_700, destination: 'authorized' });
    expect(verifySafetyTicket(ticket, frame(), context, 1_699)).toBe(true);
    expect(verifySafetyTicket(ticket, frame(), context, 1_700)).toBe(false);
    expect(issueSafetyTicket({ ...result, extra: true } as never, 'ticket-c03-forged', 500)).toBeNull();
    expect(issueSafetyTicket({ decision: 'allow', outboundAllowed: true } as never, 'ticket-c03-incomplete', 500)).toBeNull();
  });

  it.each([
    ['paused result', evaluateLocalFrame(frame({ text: '请输入验证码后支付' }), context, 1_200), 'ticket-c03-002', 500],
    ['empty id', evaluateLocalFrame(frame(), context, 1_200), '', 500],
    ['long ttl', evaluateLocalFrame(frame(), context, 1_200), 'ticket-c03-003', 2_001],
  ] as const)('不安全条件 %s 不签发票据', (_name, result, ticketId, ttl) => {
    expect(issueSafetyTicket(result, ticketId, ttl)).toBeNull();
  });

  it('篡改 frame、hash、策略、代际、目的地或票据时间都拒绝', () => {
    const result = evaluateLocalFrame(frame(), context, 1_200);
    const ticket = issueSafetyTicket(result, 'ticket-c03-004', 500);
    expect(ticket).not.toBeNull();
    const variants = [
      { ...ticket, frameId: 'frame-other' },
      { ...ticket, frameHash: 'hash-other' },
      { ...ticket, generation: 3 },
      { ...ticket, policyVersion: 'privacy-old' },
      { ...ticket, destination: 'other' },
      { ...ticket, expiresAt: 1_000 },
      { ...ticket, ticketId: `${ticket?.ticketId}\n` },
    ];
    for (const variant of variants) expect(verifySafetyTicket(variant, frame(), context, 1_300)).toBe(false);
  });

  it('输入帧变化后旧票据不能用于新内容', () => {
    const result = evaluateLocalFrame(frame(), context, 1_200);
    const ticket = issueSafetyTicket(result, 'ticket-c03-005', 500);
    expect(verifySafetyTicket(ticket, frame({ frameHash: 'sha256-canary-changed' }), context, 1_300)).toBe(false);
    expect(verifySafetyTicket(ticket, frame({ text: '本地安全页面但 hash 未变' }), context, 1_300)).toBe(true);
  });

  it('停止时关闭门控并递增代际，所有旧票据失效', () => {
    const gate = new FrameSafetyGate();
    gate.authorize(context);
    const ticket = gate.issue(frame(), 1_200, 'ticket-c03-006');
    expect(ticket).not.toBeNull();
    gate.stop();
    expect(gate.generation).toBe(5);
    expect(gate.permits(ticket!, frame(), 1_300)).toBe(false);
    expect(gate.evaluate(frame(), 1_300)).toMatchObject({ decision: 'deny', reason: 'session_stopped' });
  });

  it('重新授权需要明确的同代际上下文，不能自动恢复', () => {
    const gate = new FrameSafetyGate();
    gate.authorize(context);
    gate.stop();
    expect(gate.issue(frame(), 1_200, 'ticket-c03-007')).toBeNull();
    gate.authorize({ ...context, generation: gate.generation });
    expect(gate.issue(frame({ generation: gate.generation }), 1_200, 'ticket-c03-008')).not.toBeNull();
  });
});

describe('C03 严格输入与最小外发证明', () => {
  it.each([null, undefined, [], {}, { ...frame(), extra: true }, { ...frame(), frameId: 'frame with space' }, { ...frame(), thirdPartyFaces: -1 }, { ...frame(), confidence: 2 }, { ...frame(), text: 'x'.repeat(20_001) }])('畸形帧只得到 deny，不抛出或放宽', malformed => {
    const result = evaluateLocalFrame(malformed, context, 1_200);
    expect(result).toMatchObject({ decision: 'deny', reason: 'invalid_frame', outboundAllowed: false, risk: 'unknown' });
  });

  it.each([null, undefined, [], {}, { ...context, extra: true }, { ...context, generation: -1 }, { ...context, maxFrameAgeMs: 0 }, { ...context, minimumConfidence: 2 }])('畸形上下文只得到 deny', malformed => {
    const result = evaluateLocalFrame(frame(), malformed, 1_200);
    expect(result).toMatchObject({ decision: 'deny', reason: 'invalid_frame', outboundAllowed: false });
  });

  it('无论安全结果如何，票据和决策都不包含原始 OCR 文本', () => {
    const secret = '私人聊天 密码 abc123 验证码 654321';
    const result = evaluateLocalFrame(frame({ text: secret }), context, 1_200);
    const ticket = issueSafetyTicket(result, 'ticket-c03-009', 500);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(ticket)).not.toContain(secret);
  });

  it('策略版本、目标授权和系统授权全部进入票据复核', () => {
    const result = evaluateLocalFrame(frame(), context, 1_200);
    const ticket = issueSafetyTicket(result, 'ticket-c03-010', 500);
    expect(verifySafetyTicket(ticket, frame(), { ...context, policyVersion: 'privacy-0.3.1' }, 1_300)).toBe(false);
    expect(verifySafetyTicket(ticket, frame(), { ...context, destinationAuthorized: false }, 1_300)).toBe(false);
    expect(verifySafetyTicket(ticket, frame(), { ...context, systemAuthorized: false }, 1_300)).toBe(false);
  });
});
