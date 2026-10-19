import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const { createRealtimeVoiceClient, voiceServiceBase } = createRequire(import.meta.url)('../../apps/desktop/realtime-voice-client.cjs');
const env = { NUANBAN_DESKTOP_API_BASE_URL: 'https://nuanban.example', NUANBAN_DESKTOP_API_TOKEN: 'synthetic-device-token' };
const sdp = 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
const response = (data: unknown) => new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });

describe('桌宠实时语音鉴权客户端', () => {
  it.each(['http://public.example', 'https://user:password@example.com', 'https://example.com/?token=unsafe', 'file:///tmp', 'bad'])('拒绝不安全服务地址 %s', value => {
    expect(voiceServiceBase(value)).toBeNull();
  });

  it('无配置默认不联网，也不误用桌面供应密钥', async () => {
    const request = vi.fn();
    const client = createRealtimeVoiceClient({ env: { NUANBAN_REALTIME_API_KEY: 'must-not-be-used' }, fetch: request });
    expect(client.status()).toEqual({ configured: false });
    await expect(client.check()).rejects.toThrow('设备会话令牌');
    expect(request).not.toHaveBeenCalled();
  });

  it('先鉴权检查真实服务，再以当前同意发送纯音频 SDP', async () => {
    const request = vi.fn(async (_url: string, _options: RequestInit) => response({ configured: true, provider: 'OpenAI', audioOnly: true }))
      .mockResolvedValueOnce(response({ configured: true, provider: 'OpenAI', audioOnly: true }))
      .mockResolvedValueOnce(response({ answer: sdp }));
    const client = createRealtimeVoiceClient({ env, fetch: request });
    await client.check();
    expect(await client.connect(sdp)).toEqual({ answer: sdp });
    expect(request.mock.calls[0][0]).toBe('https://nuanban.example/internal/desktop/voice/status');
    expect(request.mock.calls[1][0]).toBe('https://nuanban.example/internal/desktop/voice/call');
    expect(request.mock.calls[1][1]).toMatchObject({ redirect: 'error', headers: { authorization: 'Bearer synthetic-device-token' } });
    expect(JSON.parse(request.mock.calls[1][1].body as string)).toEqual({ offer: sdp, consent: true });
    expect(JSON.stringify(client.status())).not.toContain('synthetic-device-token');
  });

  it('服务未配置、视频、无效答案和额外错误不能伪装为可用', async () => {
    const request = vi.fn(async () => response({ configured: false, provider: 'OpenAI', audioOnly: true }));
    await expect(createRealtimeVoiceClient({ env, fetch: request }).check()).rejects.toThrow('麦克风未开启');
    const client = createRealtimeVoiceClient({ env, fetch: request });
    await expect(client.connect(sdp + 'm=video 9 RTP/AVP 96\r\n')).rejects.toThrow('纯音频');
    expect(request).toHaveBeenCalledTimes(1);
    await expect(client.connect(sdp)).rejects.toThrow('有效会话');
  });

  it('停止后不发送请求，供应商正文不回显到错误', async () => {
    const request = vi.fn(async () => new Response('synthetic-device-token private-response', { status: 401 }));
    const client = createRealtimeVoiceClient({ env, fetch: request });
    const controller = new AbortController();
    controller.abort();
    await expect(client.check({ signal: controller.signal })).rejects.toThrow('已停止');
    expect(request).not.toHaveBeenCalled();
    await expect(client.check()).rejects.not.toThrow('private-response');
  });

  it('超大 JSON 在解析前关闭，不盲目读取任意服务响应', async () => {
    const request = vi.fn(async () => response({ answer: 'x'.repeat(100_000) }));
    await expect(createRealtimeVoiceClient({ env, fetch: request }).connect(sdp)).rejects.toThrow('服务不可用');
  });
});
