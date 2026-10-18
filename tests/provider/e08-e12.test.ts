import { describe, expect, it } from 'vitest';
import {
  LocalPolicyGate,
  ProviderOrchestrator,
  ProviderSandbox,
  ProviderUsageLedger,
  providerSandboxMatrix,
  type ControlledCredentialEvidence,
  type LocalPolicyModel,
  type ProviderAdapter,
  type ProviderAdapterRequest,
  type ProviderAdapterResponse,
  type ProviderKind,
} from '@nuanban/provider-sandbox';

const credentials: ControlledCredentialEvidence[] = providerSandboxMatrix.map(({ provider }) => ({
  provider,
  source: 'synthetic_fixture',
  reference: `fixture-${provider}`,
  authorized: true,
  expiresAt: '2099-01-01T00:00:00.000Z',
  termsAccepted: true,
}));

function response(status: ProviderAdapterResponse['status'], failureCode: ProviderAdapterResponse['failureCode'] = null): ProviderAdapterResponse {
  return { status, failureCode, events: [{ sequence: 0, type: 'started' }, { sequence: 1, type: status === 'passed' ? 'completed' : 'failed', ...(failureCode ? { code: failureCode } : {}) }] };
}

function adapter(provider: ProviderKind, execute: ProviderAdapter['execute'] = async () => response('passed')): ProviderAdapter {
  return { provider, execute };
}

function baseRequest(provider: ProviderKind, requestId = `e08-${provider}`) {
  return { provider, scenario: 'success' as const, requestId, generation: 1 };
}

const safeModel: LocalPolicyModel = {
  id: 'fixture-detector',
  version: 'test-1',
  async evaluate(request) { return { state: 'healthy', risk: request.risk ?? 'safe' }; },
};

describe('E08/E11/E12 供应编排与本地策略骨架', () => {
  it('适配器只收到合成请求；ASR 失败与 TTS 失败都保留字幕', async () => {
    let received: ProviderAdapterRequest | undefined;
    const captions = [{ id: 'caption-1', index: 0, text: '字幕留在本地' }];
    const orchestrator = new ProviderOrchestrator({
      sandbox: new ProviderSandbox(credentials),
      adapters: [
        adapter('asr', async request => { received = request; return response('failed', 'PARTIAL_FAILURE'); }),
        adapter('tts', async () => response('failed', 'TIMEOUT')),
      ],
      policy: new LocalPolicyGate(safeModel),
    });

    const asr = await orchestrator.run({ ...baseRequest('asr'), captions });
    const tts = await orchestrator.run({ ...baseRequest('tts'), captions });

    expect(asr.status).toBe('failed');
    expect(asr.fallback).toBe('text_input');
    expect(asr.captions).toEqual(captions);
    expect(tts.status).toBe('failed');
    expect(tts.fallback).toBe('captions_only');
    expect(tts.captions).toEqual(captions);
    expect(received).toMatchObject({ provider: 'asr', generation: 1, captions });
    expect(received).not.toHaveProperty('credential');
  });

  it('适配器超时会取消其信号并失败关闭', async () => {
    let adapterSignal: AbortSignal | undefined;
    const orchestrator = new ProviderOrchestrator({
      sandbox: new ProviderSandbox(credentials),
      adapters: [adapter('multimodal', (_request, signal) => new Promise(() => { adapterSignal = signal; }))],
      policy: new LocalPolicyGate(safeModel),
    });

    const result = await orchestrator.run({ ...baseRequest('multimodal'), timeoutMs: 5 });

    expect(result.status).toBe('failed');
    expect(result.failureCode).toBe('TIMEOUT');
    expect(adapterSignal?.aborted).toBe(true);
    expect(result.networkAttempted).toBe(false);
  });

  it('外部取消会传递给适配器且不产出完成事件', async () => {
    const controller = new AbortController();
    let adapterSignal: AbortSignal | undefined;
    const orchestrator = new ProviderOrchestrator({
      sandbox: new ProviderSandbox(credentials),
      adapters: [adapter('multimodal', (_request, signal) => new Promise(() => { adapterSignal = signal; }))],
      policy: new LocalPolicyGate(safeModel),
    });
    const pending = orchestrator.run(baseRequest('multimodal'), controller.signal);
    await new Promise(resolve => setTimeout(resolve, 0));
    controller.abort();
    const result = await pending;

    expect(adapterSignal?.aborted).toBe(true);
    expect(result.status).toBe('cancelled');
    expect(result.events.some(item => item.type === 'completed')).toBe(false);
  });

  it('不接受旧 generation，且新 generation 取消正在运行的旧适配器', async () => {
    let oldSignal: AbortSignal | undefined;
    const orchestrator = new ProviderOrchestrator({
      sandbox: new ProviderSandbox(credentials),
      adapters: [adapter('multimodal', (_request, signal) => {
        if (signal) oldSignal = signal;
        return new Promise(() => {});
      })],
      policy: new LocalPolicyGate(safeModel),
    });
    const first = orchestrator.run(baseRequest('multimodal', 'same-request'));
    await Promise.resolve();
    const second = orchestrator.run({ ...baseRequest('multimodal', 'same-request'), generation: 2, timeoutMs: 5 });
    const oldResult = await first;
    const stale = await orchestrator.run(baseRequest('multimodal', 'same-request'));
    await second;

    expect(oldSignal?.aborted).toBe(true);
    expect(oldResult.failureCode).toBe('STALE_GENERATION');
    expect(stale.failureCode).toBe('STALE_GENERATION');
    expect(stale.status).toBe('cancelled');
  });

  it.each([
    ['bad', 'model_bad'],
    ['unknown', 'model_unknown'],
    ['timeout', 'model_timeout'],
  ] as const)('模型 %s 默认拒绝', async (state, reason) => {
    const gate = new LocalPolicyGate({ id: 'fixture-model', version: 'test', async evaluate() { return { state }; } });
    const decision = await gate.evaluate({ requestId: 'policy-case', generation: 1 });

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toBe(reason);
    expect(decision.networkAttempted).toBe(false);
    expect(decision.rawPayloadsRetained).toBe(0);
  });

  it('未知风险与不支持的策略结果均不放行', async () => {
    const gate = new LocalPolicyGate(safeModel);
    const unknownRisk = await gate.evaluate({ requestId: 'risk-case', generation: 1, risk: 'unknown' });
    const malformed = new LocalPolicyGate({ id: 'broken', version: 'broken', async evaluate() { return null as never; } });

    expect(unknownRisk.decision).toBe('deny');
    expect(unknownRisk.reason).toBe('risk_unknown');
    expect((await malformed.evaluate()).decision).toBe('deny');
  });

  it('按 provider 聚合最小用量、预算拒绝及连续故障熔断，不记录请求原文', () => {
    let now = 100;
    const ledger = new ProviderUsageLedger({
      budgets: { multimodal: { maxCostMinor: 5 } },
      failureThreshold: 2,
      cooldownMs: 50,
      now: () => now,
    });
    ledger.record({ provider: 'multimodal', operation: 'chat', outcome: 'failed', failureCode: 'TIMEOUT', inputUnits: 2, outputUnits: 0, estimatedCostMinor: 3 });
    ledger.record({ provider: 'multimodal', operation: 'chat', outcome: 'failed', failureCode: 'PROVIDER_UNAVAILABLE', inputUnits: 1, outputUnits: 0, estimatedCostMinor: 2 });

    expect(ledger.admit('multimodal', { inputUnits: 1, outputUnits: 0, estimatedCostMinor: 1 })).toEqual({ allowed: false, failureCode: 'CIRCUIT_OPEN' });
    expect(ledger.snapshot().providers.multimodal).toMatchObject({ requests: 2, failed: 2, timeoutCount: 1, inputUnits: 3, estimatedCostMinor: 5, circuit: 'open' });
    now = 151;
    expect(ledger.admit('multimodal', { inputUnits: 0, outputUnits: 0, estimatedCostMinor: 1 })).toEqual({ allowed: false, failureCode: 'BUDGET_EXCEEDED' });
    expect(JSON.stringify(ledger.snapshot())).not.toContain('原文');
    expect(ledger.snapshot().rawPayloadsRetained).toBe(0);
  });

  it('无凭证时不调用适配器，networkAttempted 始终为 false', async () => {
    let calls = 0;
    const orchestrator = new ProviderOrchestrator({
      adapters: [adapter('asr', async () => { calls++; return response('passed'); })],
      policy: new LocalPolicyGate(safeModel),
    });
    const result = await orchestrator.run(baseRequest('asr'));

    expect(result.status).toBe('blocked');
    expect(result.credentialReferenceUsed).toBe(false);
    expect(result.networkAttempted).toBe(false);
    expect(calls).toBe(0);
  });
});
