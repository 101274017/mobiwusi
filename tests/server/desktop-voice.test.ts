import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createDesktopVoiceService, audioOnlySdp } from '../../apps/server/src/desktop-voice.ts';
import { createApplication, type ServerOptions } from '../../apps/server/src/http.ts';
import { signDeviceChallenge, type AuthenticatedSession } from '../../apps/server/src/auth.ts';

const offer = 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';
const env = { NUANBAN_REALTIME_API_KEY: 'synthetic-server-secret', NUANBAN_REALTIME_MODEL: 'gpt-realtime' };
const actor = { account_id: 'voice-owner', device_id: 'voice-device' } as AuthenticatedSession;
const applications: ReturnType<typeof createApplication>[] = [];
const signal = () => new AbortController().signal;

async function start(options: ServerOptions = {}) {
  const application = createApplication(options);
  applications.push(application);
  await new Promise<void>(resolve => application.server.listen(0, '127.0.0.1', resolve));
  const account = application.auth.createAccount({ account_id: 'voice-owner' });
  const device = application.auth.bindDevice({ account_id: account.account_id, device_id: 'voice-device', device_secret: 'synthetic-secret' });
  const challenge = application.auth.issueDeviceChallenge(device.device_id);
  const exchange = application.auth.exchangeDeviceChallenge(challenge.challenge_id, signDeviceChallenge(device.device_secret, challenge.challenge));
  return { application, base: 'http://127.0.0.1:' + (application.server.address() as AddressInfo).port,
    headers: { authorization: 'Bearer ' + exchange.session.access_token, 'content-type': 'application/json' } };
}

afterEach(async () => {
  await Promise.all(applications.splice(0).map(({ server }) => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); })));
});

describe('独立桌宠真实语音服务（合成供应响应，不使用真实麦克风）', () => {
  it('未配置时不调用供应商，不返回模拟对话', async () => {
    const request = vi.fn();
    const service = createDesktopVoiceService({ env: {}, fetch: request });
    expect(service.status()).toMatchObject({ configured: false, audioOnly: true });
    await expect(service.connect({ offer, consent: true }, actor, { signal: signal() })).rejects.toMatchObject({ status: 503, code: 'PROVIDER_UNAVAILABLE' });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([{}, { NUANBAN_REALTIME_API_KEY: 'key' }, { ...env, NUANBAN_REALTIME_MODEL: '../other' }, { ...env, NUANBAN_REALTIME_API_KEY: 'bad\nkey' }])('配置不能隐式回退到其他供应方', configuration => {
    expect(createDesktopVoiceService({ env: configuration }).status().configured).toBe(false);
  });

  it('仅在服务端使用密钥并固定纯音频、中文、打断和无工具配置', async () => {
    const request = vi.fn(async () => new Response(offer, { status: 201, headers: { 'content-type': 'application/sdp' } }));
    const service = createDesktopVoiceService({ env, fetch: request });
    expect(await service.connect({ offer, consent: true }, actor, { signal: signal() })).toEqual({ answer: offer });
    const [url, settings] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/realtime/calls');
    expect(settings.redirect).toBe('error');
    expect(settings.headers).toMatchObject({ authorization: 'Bearer synthetic-server-secret', 'OpenAI-Safety-Identifier': expect.stringMatching(/^[a-f0-9]{64}$/u) });
    const form = settings.body as FormData;
    expect(form.get('sdp')).toBe(offer);
    expect(JSON.parse(String(form.get('session')))).toMatchObject({ type: 'realtime', model: 'gpt-realtime', output_modalities: ['audio'],
      tools: [], tool_choice: 'none', tracing: null, audio: { input: { turn_detection: { create_response: true, interrupt_response: true }, transcription: { language: 'zh' } }, output: { voice: 'marin' } } });
    expect(JSON.stringify(service.status())).not.toContain(env.NUANBAN_REALTIME_API_KEY);
  });

  it.each([{ offer, consent: false }, { offer }, { offer: offer + 'm=video 9 UDP/TLS/RTP/SAVPF 96\r\n', consent: true },
    { offer, consent: true, apiKey: 'renderer-key' }, { offer: 'v=0\r\nm=audio 9\r\n'.repeat(5000), consent: true }])('拒绝无同意、视频、额外参数和超大 SDP', async body => {
    const request = vi.fn();
    await expect(createDesktopVoiceService({ env, fetch: request }).connect(body, actor, { signal: signal() })).rejects.toMatchObject({ status: 400 });
    expect(request).not.toHaveBeenCalled();
  });

  it('取消不触发供应请求，供应错误不回显密钥或响应正文', async () => {
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn();
    await expect(createDesktopVoiceService({ env, fetch: request }).connect({ offer, consent: true }, actor, { signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(request).not.toHaveBeenCalled();
    const unavailable = createDesktopVoiceService({ env, fetch: vi.fn(async () => new Response('synthetic-server-secret', { status: 401 })) });
    await expect(unavailable.connect({ offer, consent: true }, actor, { signal: signal() })).rejects.not.toThrow('synthetic-server-secret');
  });

  it('同一设备不能并发建立多条连接', async () => {
    let release!: (response: Response) => void;
    const service = createDesktopVoiceService({ env, fetch: vi.fn(() => new Promise<Response>(resolve => { release = resolve; })) });
    const pending = service.connect({ offer, consent: true }, actor, { signal: signal() });
    await expect(service.connect({ offer, consent: true }, actor, { signal: signal() })).rejects.toMatchObject({ status: 429 });
    release(new Response(offer, { headers: { 'content-type': 'application/sdp' } }));
    await pending;
  });

  it('状态和 SDP 路由都要求真实设备认证', async () => {
    const connect = vi.fn();
    const status = vi.fn(() => ({ configured: true, provider: 'OpenAI' as const, model: 'gpt-realtime', audioOnly: true as const }));
    const current = await start({ desktopVoice: { status, connect } });
    for (const [path, method] of [['status', 'GET'], ['call', 'POST']]) {
      expect((await fetch(current.base + '/internal/desktop/voice/' + path, { method })).status).toBe(401);
    }
    expect(connect).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    const response = await fetch(current.base + '/internal/desktop/voice/status', { headers: current.headers });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ data: { configured: true, audioOnly: true } });
  });

  it('SDP 不进入通用日志钩子，认证 actor 与取消信号传给供应适配器', async () => {
    const seen: unknown[] = [];
    const connect = vi.fn(async () => ({ answer: offer }));
    const current = await start({ desktopVoice: { status: () => ({ configured: true, provider: 'OpenAI', model: 'gpt-realtime', audioOnly: true }), connect }, hooks: {
      onRequest: context => { seen.push(context.body); }, onRoute: context => { seen.push(context.body); },
      resolveActor: context => { seen.push(context.body); return context.authenticate(); }, onResponse: context => { seen.push(context.body); },
    } });
    const response = await fetch(current.base + '/internal/desktop/voice/call', { method: 'POST', headers: current.headers, body: JSON.stringify({ offer, consent: true }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { answer: offer } });
    expect(connect).toHaveBeenCalledWith({ offer, consent: true }, expect.objectContaining({ account_id: 'voice-owner', device_id: 'voice-device' }), { signal: expect.any(AbortSignal) });
    expect(JSON.stringify(seen)).not.toContain('m=audio');
    expect(seen.slice(0, 3)).toEqual(Array.from({ length: 3 }, () => ({ desktop_voice: true })));
  });

  it('只接受单音轨 SDP，不接受隐含摄像头或空媒体', () => {
    expect(audioOnlySdp(offer)).toBe(true);
    expect(audioOnlySdp(offer + 'm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n')).toBe(false);
    expect(audioOnlySdp('v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n')).toBe(false);
  });
});
