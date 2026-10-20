import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import { createApplication, type ServerOptions } from '../../apps/server/src/http.ts';
import { signDeviceChallenge } from '../../apps/server/src/auth.ts';
import { createStandaloneGuidanceService, StandaloneGuidanceError } from '../../apps/server/src/standalone-guidance.ts';
import { createDesktopAnalysisClient } from '../../apps/desktop/analysis-client.cjs';
import { syntheticDetection, syntheticFrame } from '../helpers/standalone-frame.ts';

const { evaluateLocalFrame } = createRequire(import.meta.url)('../../apps/desktop/observation-policy.cjs') as typeof import('../../apps/desktop/observation-policy.cjs');
const applications: ReturnType<typeof createApplication>[] = [];

async function start(options: ServerOptions = {}) {
  const application = createApplication(options);
  applications.push(application);
  await new Promise<void>(resolve => application.server.listen(0, '127.0.0.1', resolve));
  const address = application.server.address() as AddressInfo;
  const account = application.auth.createAccount({ account_id: 'standalone-http-owner' });
  const device = application.auth.bindDevice({ account_id: account.account_id, device_id: 'standalone-http-device', device_secret: 'synthetic-http-secret' });
  const challenge = application.auth.issueDeviceChallenge(device.device_id);
  const exchange = application.auth.exchangeDeviceChallenge(challenge.challenge_id, signDeviceChallenge(device.device_secret, challenge.challenge));
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${exchange.session.access_token}`, 'x-request-id': 'standalone-request' };
  return { application, baseUrl, headers };
}

afterEach(async () => {
  await Promise.all(applications.splice(0).map(({ server }) => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); })));
});

describe('authenticated standalone guidance HTTP route', () => {
  it('requires real service authentication before calling an injected analyzer', async () => {
    const analyze = vi.fn();
    const { baseUrl } = await start({ standaloneGuidance: { analyze } });
    const response = await fetch(`${baseUrl}/v1/standalone/guidance/analyze`, { method: 'POST', body: '{}' });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'AUTH_FAILED' } });
    expect(analyze).not.toHaveBeenCalled();
  });

  it('passes the actual authenticated account and cancellation signal with the usual envelope', async () => {
    const result = { kind: 'clarify' as const, instruction: '请您描述想完成的事情。', observation_id: 'o', guide_id: 'g', observation_generation: 1, task_generation: 1, trigger_id: 't', frame_id: 'f' };
    const analyze = vi.fn(async () => result);
    const { baseUrl, headers } = await start({ standaloneGuidance: { analyze } });
    const response = await fetch(`${baseUrl}/v1/standalone/guidance/analyze`, { method: 'POST', headers, body: '{"question":"测试"}' });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('standalone-request');
    expect(await response.json()).toMatchObject({ data: result, request_id: 'standalone-request', schema_version: '0.2.0' });
    expect(analyze).toHaveBeenCalledWith({ question: '测试' }, expect.objectContaining({ account_id: 'standalone-http-owner' }), { signal: expect.any(AbortSignal) });
  });

  it('reports missing real provider configuration instead of falling back to demo guidance', async () => {
    const provider = vi.fn();
    const { baseUrl, headers } = await start({ standaloneGuidance: createStandaloneGuidanceService({ env: {}, fetch: provider }) });
    const response = await fetch(`${baseUrl}/v1/standalone/guidance/analyze`, { method: 'POST', headers, body: '{}' });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'GUIDANCE_UNAVAILABLE' } });
    expect(provider).not.toHaveBeenCalled();
  });

  it('carries desktop follow-up replies through authenticated HTTP into the same provider task', async () => {
    const provider = vi.fn<typeof fetch>(async () => Response.json({ choices: [{ finish_reason: 'stop', message: {
      role: 'assistant', content: JSON.stringify({ kind: 'step', instruction: '请您亲手打开显示设置。' }),
    } }] }));
    const { baseUrl, headers } = await start({ standaloneGuidance: createStandaloneGuidanceService({ env: {
      NUANBAN_VISION_BASE_URL: 'https://vision.example.com/v1', NUANBAN_VISION_API_KEY: 'synthetic-http-provider-key', NUANBAN_VISION_MODEL: 'synthetic-model',
    }, fetch: provider }) });
    const client = createDesktopAnalysisClient({ env: { NUANBAN_DESKTOP_API_BASE_URL: baseUrl, NUANBAN_DESKTOP_API_TOKEN: headers.authorization.slice('Bearer '.length) } });
    const raw = syntheticFrame();
    const frame = evaluateLocalFrame(raw, syntheticDetection(raw));
    if (frame.decision !== 'allow') throw new Error('Synthetic HTTP frame was not admitted');
    const question = '教我调整文字大小';
    const replies = [{ prompt: '希望调整哪里的文字？', answer: 'Windows显示设置中的文字' }];
    const result = await client.analyze({ frame, question, clarificationReplies: replies,
      reason: 'question', observationId: 'observation-http', guideId: 'guide-http', observationGeneration: 1, taskGeneration: 2,
      triggerId: 'trigger-http', previousStep: null, signal: new AbortController().signal, canSend: () => true });
    expect(result).toMatchObject({ kind: 'step', instruction: '请您亲手打开显示设置。', guide_id: 'guide-http', task_generation: 2 });
    expect(provider).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(provider.mock.calls[0][1]?.body));
    expect(JSON.parse(payload.messages[1].content[0].text)).toMatchObject({ question,
      clarification_replies: [{ question: replies[0].prompt, answer: replies[0].answer }] });
    expect(payload.messages[0].content).toContain('person-authorized Windows computer');
    expect(payload.messages[1].content[1].image_url.url).toBe('data:image/png;base64,' + frame.sanitizedPng.toString('base64'));
    expect(String(provider.mock.calls[0][1]?.body)).not.toContain(raw.png.toString('base64'));
    expect(String(provider.mock.calls[0][1]?.body)).not.toContain(headers.authorization);
  });

  it('keeps frame bytes and questions out of generic request, authentication and response hooks', async () => {
    const seen: unknown[] = [];
    const analyze = vi.fn(async () => ({ kind: 'clarify' as const, instruction: '请描述想完成的功能。', observation_id: 'o', guide_id: 'g',
      observation_generation: 1, task_generation: 1, trigger_id: 't', frame_id: 'f' }));
    const { baseUrl, headers } = await start({ standaloneGuidance: { analyze }, hooks: {
      onRequest: context => { seen.push(context.body); },
      onRoute: context => { seen.push(context.body); },
      resolveActor: context => { seen.push(context.body); return context.authenticate(); },
      onResponse: context => { seen.push(context.body); },
    } });
    const response = await fetch(`${baseUrl}/v1/standalone/guidance/analyze`, { method: 'POST', headers,
      body: JSON.stringify({ question: 'private synthetic text', image: { mime: 'image/png', base64: 'synthetic-private-frame' },
        clarification_replies: [{ question: 'synthetic-private-prompt', answer: 'synthetic-private-answer' }] }) });
    expect(response.status).toBe(200);
    expect(seen.slice(0, 3)).toEqual(Array.from({ length: 3 }, () => ({ standalone_guidance: true })));
    expect(JSON.stringify(seen)).not.toContain('synthetic-private-frame');
    expect(JSON.stringify(seen)).not.toContain('private synthetic text');
    expect(JSON.stringify(seen)).not.toContain('synthetic-private-prompt');
    expect(JSON.stringify(seen)).not.toContain('synthetic-private-answer');
  });

  it('maps standalone provider errors without disguising them as successful replies', async () => {
    const analyze = vi.fn(async () => { throw new StandaloneGuidanceError(504, 'GUIDANCE_TIMEOUT', 'Vision provider timed out', true); });
    const { baseUrl, headers } = await start({ standaloneGuidance: { analyze } });
    const response = await fetch(`${baseUrl}/v1/standalone/guidance/analyze`, { method: 'POST', headers, body: '{}' });
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: { code: 'GUIDANCE_TIMEOUT', retryable: true }, request_id: 'standalone-request' });
  });

  it('never exposes an unexpected provider exception', async () => {
    const analyze = vi.fn(async () => { throw new Error('synthetic-provider-secret-body'); });
    const { baseUrl, headers } = await start({ standaloneGuidance: { analyze } });
    const response = await fetch(`${baseUrl}/v1/standalone/guidance/analyze`, { method: 'POST', headers, body: '{}' });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('synthetic-provider-secret-body');
  });

  it('raises only this route body limit and preserves the existing one MiB limit elsewhere', async () => {
    const analyze = vi.fn(async () => { throw new StandaloneGuidanceError(400, 'GUIDANCE_INVALID_REQUEST', 'Invalid test request'); });
    const { baseUrl, headers } = await start({ standaloneGuidance: { analyze } });
    const body = JSON.stringify({ padding: 'x'.repeat(1100 * 1024) });
    const guidance = await fetch(`${baseUrl}/v1/standalone/guidance/analyze`, { method: 'POST', headers, body });
    expect(guidance.status).toBe(400);
    expect(analyze).toHaveBeenCalledTimes(1);
    const other = await fetch(`${baseUrl}/v1/auth/refresh`, { method: 'POST', headers, body });
    expect(other.status).toBe(400);
    expect(await other.json()).toMatchObject({ error: { message: 'Request body is too large' } });
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('bounds large frame uploads before invoking the analyzer', async () => {
    const analyze = vi.fn();
    const { baseUrl, headers } = await start({ standaloneGuidance: { analyze } });
    const response = await fetch(`${baseUrl}/v1/standalone/guidance/analyze`, { method: 'POST', headers, body: JSON.stringify({ padding: 'x'.repeat(3 * 1024 * 1024) }) });
    expect(response.status).toBe(400);
    expect(analyze).not.toHaveBeenCalled();
  });

  it('cancels the provider when the desktop closes its outgoing request', async () => {
    let entered!: () => void;
    let cancelled!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const stopped = new Promise<void>(resolve => { cancelled = resolve; });
    const analyze = vi.fn((_input, _actor, options) => new Promise<never>((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => { cancelled(); reject(new StandaloneGuidanceError(499, 'GUIDANCE_ABORTED', 'Cancelled')); }, { once: true });
      entered();
    }));
    const { baseUrl, headers } = await start({ standaloneGuidance: { analyze } });
    const controller = new AbortController();
    const request = fetch(`${baseUrl}/v1/standalone/guidance/analyze`, { method: 'POST', headers, body: '{}', signal: controller.signal });
    await started;
    controller.abort();
    await expect(request).rejects.toThrow();
    await stopped;
  });
});
