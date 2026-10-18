import { describe, expect, it } from 'vitest';
import {
  ProviderSandbox,
  providerSandboxMatrix,
  verifyProviderSandbox,
  type ControlledCredentialEvidence,
  type ProviderKind,
  type ProviderSandboxRequest,
} from '@nuanban/provider-sandbox';

const credentials: ControlledCredentialEvidence[] = providerSandboxMatrix.map(({ provider }) => ({
  provider,
  source: 'synthetic_fixture',
  reference: `fixture-${provider}`,
  authorized: true,
  expiresAt: '2099-01-01T00:00:00.000Z',
  termsAccepted: true,
}));

function request(provider: ProviderKind, scenario: ProviderSandboxRequest['scenario']): ProviderSandboxRequest {
  return { provider, scenario, requestId: `test-${provider}-${scenario}`, generation: 1 };
}

describe('C12 供应沙箱预备层', () => {
  it('生成供应验证与缺口报告，并将真实凭证状态保持为阻塞', async () => {
    const report = await verifyProviderSandbox();

    expect(report.status).toBe('blocked');
    expect(report.realCredentialState).toBe('missing');
    expect(report.syntheticChecksPassed).toBe(true);
    expect(report.productionReady).toBe(false);
    expect(report.checks).toHaveLength(11);
    expect(report.checks.every(check => check.passed)).toBe(true);
    expect(report.checks.every(check => !check.result.networkAttempted && check.result.rawPayloadsRetained === 0)).toBe(true);
    expect(report.gaps.join('\n')).toContain('真实授权凭证');
    expect(report.gaps.join('\n')).toContain('区域、配额、价格、数据保留');
  });

  it('矩阵覆盖六类供应能力且凭证只使用合成夹具', () => {
    expect(providerSandboxMatrix.map(item => item.provider)).toEqual([
      'carrier_auth',
      'face_auth',
      'multimodal',
      'asr',
      'tts',
      'pet_generation',
    ]);
    expect(credentials.every(credential => credential.source === 'synthetic_fixture')).toBe(true);
    expect(credentials.every(credential => credential.termsAccepted && credential.authorized)).toBe(true);
  });

  it('没有可用凭证时阻塞，不产生事件、网络尝试或原始载荷留存', async () => {
    const result = await new ProviderSandbox([], '2026-10-16T00:00:00.000Z').run(request('multimodal', 'success'));

    expect(result.status).toBe('blocked');
    expect(result.failureCode).toBe('PROVIDER_UNAVAILABLE');
    expect(result.events).toEqual([]);
    expect(result.credentialReferenceUsed).toBe(false);
    expect(result.networkAttempted).toBe(false);
    expect(result.rawPayloadsRetained).toBe(0);
  });

  it('拒绝过期、未授权或非法的受控凭证引用', () => {
    const sandbox = new ProviderSandbox([
      { provider: 'asr', source: 'synthetic_fixture', reference: 'expired', authorized: true, expiresAt: '2020-01-01T00:00:00.000Z', termsAccepted: true },
      { provider: 'tts', source: 'managed_vault_ref', reference: 'not-a-vault-reference', authorized: true, expiresAt: '2099-01-01T00:00:00.000Z', termsAccepted: true },
      { provider: 'face_auth', source: 'managed_vault_ref', reference: 'vault://face/demo', authorized: false, expiresAt: '2099-01-01T00:00:00.000Z', termsAccepted: true },
    ]);

    expect(sandbox.hasUsableCredential('asr')).toBe(false);
    expect(sandbox.hasUsableCredential('tts')).toBe(false);
    expect(sandbox.hasUsableCredential('face_auth')).toBe(false);
  });

  it('成功流按 started、delta、completed 顺序结束，并保留安全边界', async () => {
    const result = await new ProviderSandbox(credentials).run(request('multimodal', 'success'));

    expect(result.status).toBe('passed');
    expect(result.failureCode).toBeNull();
    expect(result.fallback).toBe('none');
    expect(result.events.map(event => event.type)).toEqual(['started', 'delta', 'completed']);
    expect(result.events.map(event => event.sequence)).toEqual([0, 1, 2]);
    expect(result.credentialReferenceUsed).toBe(true);
    expect(result.networkAttempted).toBe(false);
    expect(result.rawPayloadsRetained).toBe(0);
  });

  it('取消会产生 cancelled 而不会产生 completed，生成取消保留旧资产回退', async () => {
    const controller = new AbortController();
    controller.abort();
    const stream = await new ProviderSandbox(credentials).run(request('multimodal', 'success'), controller.signal);
    const generation = await new ProviderSandbox(credentials).run(request('pet_generation', 'generation_cancelled'));

    expect(stream.status).toBe('cancelled');
    expect(stream.events.map(event => event.type)).toEqual(['started', 'cancelled']);
    expect(stream.events.some(event => event.type === 'completed')).toBe(false);
    expect(generation.status).toBe('cancelled');
    expect(generation.fallback).toBe('keep_existing_2d');
    expect(generation.events.some(event => event.type === 'completed')).toBe(false);
  });

  it.each([
    ['asr', 'asr_no_result', 'PARTIAL_FAILURE', 'text_input'],
    ['tts', 'tts_timeout', 'TIMEOUT', 'captions_only'],
    ['face_auth', 'face_invalid_proof', 'AUTH_FAILED', 'family_claim'],
    ['carrier_auth', 'carrier_no_sim', 'PROVIDER_UNAVAILABLE', 'device_binding'],
    ['multimodal', 'rate_limited', 'RATE_LIMITED', 'text_input'],
    ['multimodal', 'provider_unavailable', 'PROVIDER_UNAVAILABLE', 'text_input'],
    ['pet_generation', 'quality_below_threshold', 'PARTIAL_FAILURE', 'keep_existing_2d'],
  ] as const)('按场景返回 %s 的安全失败和回退', async (provider, scenario, failureCode, fallback) => {
    const result = await new ProviderSandbox(credentials).run(request(provider, scenario));

    expect(result.status).toBe('failed');
    expect(result.failureCode).toBe(failureCode);
    expect(result.fallback).toBe(fallback);
    expect(result.events.at(-1)?.type).toBe('failed');
    expect(result.events.at(-1)?.code).toBe(failureCode);
    expect(result.networkAttempted).toBe(false);
    expect(result.rawPayloadsRetained).toBe(0);
  });

  it('非法请求保守失败且不尝试供应调用', async () => {
    const result = await new ProviderSandbox(credentials).run({
      provider: 'multimodal',
      scenario: 'success',
      requestId: 'contains spaces',
      generation: -1,
    });

    expect(result.status).toBe('failed');
    expect(result.failureCode).toBe('INVALID_REQUEST');
    expect(result.events).toEqual([{ sequence: 0, type: 'failed', code: 'INVALID_REQUEST' }]);
    expect(result.networkAttempted).toBe(false);
    expect(result.rawPayloadsRetained).toBe(0);
  });
});
