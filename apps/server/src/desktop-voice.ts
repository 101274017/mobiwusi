import type { AuthenticatedSession } from './auth.ts';
import { createHash } from 'node:crypto';
import { DomainError } from './errors.ts';

export interface DesktopVoiceStatus {
  configured: boolean;
  provider: 'OpenAI';
  model: string | null;
  audioOnly: true;
}

export interface DesktopVoiceService {
  status(): DesktopVoiceStatus;
  connect(body: Record<string, unknown>, actor: AuthenticatedSession, options: { signal: AbortSignal }): Promise<{ answer: string }>;
}

export function audioOnlySdp(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 20 && value.length <= 65_536
    && /^v=0\r?\n/u.test(value) && (value.match(/^m=audio /gmu) ?? []).length === 1
    && !/^m=(?!audio |application )/mu.test(value) && !value.includes('\0');
}

export function createDesktopVoiceService(options: {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  timeoutMs?: number;
} = {}): DesktopVoiceService {
  const env = options.env ?? process.env;
  const request = options.fetch ?? globalThis.fetch;
  const pending = new Set<string>();
  const timeoutMs = options.timeoutMs ?? 20_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) throw new RangeError('Invalid voice timeout');

  function configuration() {
    const key = env.NUANBAN_REALTIME_API_KEY;
    const model = env.NUANBAN_REALTIME_MODEL;
    return typeof key === 'string' && key.length > 0 && key.length <= 4096 && /^[\x21-\x7e]+$/u.test(key)
      && typeof model === 'string' && model.length <= 100 && /^gpt-realtime(?:-[a-z0-9.-]+)?$/u.test(model)
      ? { key, model } : null;
  }

  return {
    status() {
      const configured = configuration();
      return { configured: Boolean(configured), provider: 'OpenAI', model: configured?.model ?? null, audioOnly: true };
    },
    async connect(body, actor, { signal }) {
      const provider = configuration();
      if (!provider) throw new DomainError(503, 'PROVIDER_UNAVAILABLE', '实时语音服务尚未配置，不会使用模拟对话');
      if (Object.keys(body).length !== 2 || body.consent !== true || !audioOnlySdp(body.offer)) {
        throw new DomainError(400, 'INVALID_REQUEST', '需要本人当次语音同意及仅含音频的会话描述');
      }
      if (signal.aborted) throw new DomainError(499, 'CANCELLED', '实时语音连接已取消');
      if (pending.has(actor.device_id)) throw new DomainError(429, 'RATE_LIMITED', '本设备正在建立语音连接');
      pending.add(actor.device_id);
      const timeout = AbortSignal.timeout(timeoutMs);
      const combined = AbortSignal.any([signal, timeout]);
      try {
        const form = new FormData();
        form.set('sdp', body.offer);
        form.set('session', JSON.stringify({
          type: 'realtime', model: provider.model, output_modalities: ['audio'], max_output_tokens: 768,
          instructions: '你是微光指引桌宠暖暖，用自然、温暖的中文与用户面对面语音交流。每次简短回答，先倾听，可被打断。这是纯语音会话，你看不到屏幕、摄像头、学习记录或外部软件，也不能操作电脑，不得声称已经看见或执行。不要索要密码、验证码、身份证或银行卡等敏感信息。遇到医疗、法律、金融和紧急风险，不作确定性专业结论，提示求助合适的专业人士。',
          tools: [], tool_choice: 'none', tracing: null,
          audio: {
            input: { noise_reduction: { type: 'near_field' }, transcription: { model: 'gpt-4o-mini-transcribe', language: 'zh' },
              turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 600, create_response: true, interrupt_response: true } },
            output: { voice: 'marin' },
          },
        }));
        const response = await request('https://api.openai.com/v1/realtime/calls', {
          method: 'POST', redirect: 'error', signal: combined,
          headers: { authorization: 'Bearer ' + provider.key,
            'OpenAI-Safety-Identifier': createHash('sha256').update('nuanban-voice:' + actor.account_id).digest('hex') }, body: form,
        });
        if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('application/sdp') || !response.body) {
          await response.body?.cancel();
          throw new DomainError(502, 'PROVIDER_UNAVAILABLE', '实时语音供应服务未接受连接，请检查配置与额度', true);
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        const cancel = () => { void reader.cancel().catch(() => {}); };
        combined.addEventListener('abort', cancel, { once: true });
        if (combined.aborted) cancel();
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > 65_536) throw new DomainError(502, 'PROVIDER_UNAVAILABLE', '语音服务响应超出限制');
            chunks.push(chunk.value);
          }
          const answer = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
          if (!audioOnlySdp(answer) || answer.includes(provider.key) || combined.aborted) {
            throw new DomainError(502, 'PROVIDER_UNAVAILABLE', '语音服务未返回有效的音频会话');
          }
          return { answer };
        } finally {
          combined.removeEventListener('abort', cancel);
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
      } catch (error) {
        if (signal.aborted) throw new DomainError(499, 'CANCELLED', '实时语音连接已取消');
        if (timeout.aborted) throw new DomainError(504, 'TIMEOUT', '实时语音连接超时，请手动重试', true);
        if (error instanceof DomainError) throw error;
        throw new DomainError(502, 'PROVIDER_UNAVAILABLE', '实时语音服务连接失败', true);
      } finally {
        pending.delete(actor.device_id);
      }
    },
  };
}
