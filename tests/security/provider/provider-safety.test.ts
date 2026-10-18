import { describe, expect, it } from 'vitest';
import {
  LocalPolicyGate,
  ProviderOrchestrator,
  ProviderSandbox,
  ProviderUsageLedger,
  providerSandboxMatrix,
  type ControlledCredentialEvidence,
  type ProviderAdapter,
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

const success: ProviderAdapterResponse = {
  status: 'passed',
  events: [{ sequence: 0, type: 'started' }, { sequence: 1, type: 'completed' }],
};

function request(provider: ProviderKind, requestId = `security-${provider}`, generation = 1) {
  return { provider, scenario: 'success' as const, requestId, generation, usageEstimate: { inputUnits: 1, outputUnits: 1, estimatedCostMinor: 1 } };
}

function adapter(provider: ProviderKind, execute: ProviderAdapter['execute'], mode?: ProviderAdapter['mode']): ProviderAdapter {
  return { provider, execute, ...(mode ? { mode } : {}) };
}

describe('供应适配器安全边界', () => {
  it('拒绝不匹配的终止事件，不把坏响应当作成功', async () => {
    const result = await new ProviderOrchestrator({
      sandbox: new ProviderSandbox(credentials),
      adapters: [adapter('multimodal', async () => ({ status: 'passed', events: [{ sequence: 0, type: 'started' }, { sequence: 1, type: 'failed' }] } as never))],
    }).run(request('multimodal'));

    expect(result.status).toBe('failed');
    expect(result.failureCode).toBe('INVALID_RESPONSE');
    expect(result.events.at(-1)?.type).toBe('failed');
    expect(result.events.some(event => event.type === 'completed')).toBe(false);
    expect(result.credentialReferenceUsed).toBe(true);
  });

  it('适配器异常归类为供应失败而不是取消', async () => {
    const orchestrator = new ProviderOrchestrator({
      sandbox: new ProviderSandbox(credentials),
      adapters: [adapter('asr', async () => { throw new Error('fixture failure'); })],
    });

    const result = await orchestrator.run(request('asr'));

    expect(result.status).toBe('failed');
    expect(result.failureCode).toBe('PROVIDER_UNAVAILABLE');
    expect(result.events.at(-1)?.type).toBe('failed');
    expect(orchestrator.usageSnapshot().providers.asr).toMatchObject({ failed: 1, cancelled: 0, inFlight: 0 });
  });

  it('默认拒绝 network adapter 且不调用它', async () => {
    let calls = 0;
    const result = await new ProviderOrchestrator({
      sandbox: new ProviderSandbox(credentials),
      adapters: [adapter('tts', async () => { calls++; return success; }, 'network')],
    }).run(request('tts'));

    expect(result.status).toBe('blocked');
    expect(result.failureCode).toBe('NETWORK_DISABLED');
    expect(result.networkAttempted).toBe(false);
    expect(calls).toBe(0);
  });

  it('并发请求先预留预算，不能在完成前超额放行', async () => {
    let finish!: (value: ProviderAdapterResponse) => void;
    const firstAdapter = new Promise<ProviderAdapterResponse>(resolve => { finish = resolve; });
    const usage = new ProviderUsageLedger({ budgets: { multimodal: { maxRequests: 1, maxCostMinor: 1 } } });
    const orchestrator = new ProviderOrchestrator({
      sandbox: new ProviderSandbox(credentials),
      usage,
      adapters: [adapter('multimodal', async () => firstAdapter)],
    });

    const first = orchestrator.run(request('multimodal', 'budget-first'));
    await Promise.resolve();
    const second = await orchestrator.run(request('multimodal', 'budget-second'));

    expect(second.status).toBe('blocked');
    expect(second.failureCode).toBe('BUDGET_EXCEEDED');
    expect(usage.snapshot().providers.multimodal).toMatchObject({ inFlight: 1, reserved: { estimatedCostMinor: 1 } });

    finish(success);
    const firstResult = await first;
    expect(firstResult.status).toBe('passed');
    expect(usage.snapshot().providers.multimodal).toMatchObject({ inFlight: 0, reserved: { estimatedCostMinor: 0 }, passed: 1, blocked: 1 });
  });

  it('策略模型返回未知风险时默认拒绝，即使请求声明 safe', async () => {
    const gate = new LocalPolicyGate({
      id: 'fixture-model',
      version: '1',
      async evaluate() { return { state: 'healthy', risk: 'not-a-risk' as never }; },
    });

    const decision = await gate.evaluate({ requestId: 'risk-security', generation: 1, risk: 'safe' });

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toBe('risk_unknown');
    expect(decision.networkAttempted).toBe(false);
    expect(decision.rawPayloadsRetained).toBe(0);
  });

  it('只返回规范化结果，不保留适配器原始对象', async () => {
    const result = await new ProviderOrchestrator({
      sandbox: new ProviderSandbox(credentials),
      adapters: [adapter('multimodal', async () => ({ ...success, rawPayload: 'fixture-secret', providerResponse: { token: 'fixture-token' } } as never))],
    }).run(request('multimodal', 'raw-payload'));

    expect(result).not.toHaveProperty('rawPayload');
    expect(result).not.toHaveProperty('providerResponse');
    expect(result.rawPayloadsRetained).toBe(0);
    expect(JSON.stringify(result)).not.toContain('fixture-secret');
    expect(JSON.stringify(result)).not.toContain('fixture-token');
  });
});
