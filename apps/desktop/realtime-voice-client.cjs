const { randomUUID } = require('node:crypto');

function audioOnlySdp(value) {
  return typeof value === 'string' && value.length >= 20 && value.length <= 65_536
    && /^v=0\r?\n/u.test(value) && (value.match(/^m=audio /gmu) ?? []).length === 1
    && !/^m=(?!audio |application )/mu.test(value) && !value.includes('\0');
}

function voiceServiceBase(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash
      || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) return null;
    url.pathname = url.pathname.replace(/\/$/u, '') + '/internal/desktop/voice/';
    return url.href;
  } catch { return null; }
}

function createRealtimeVoiceClient({ env = process.env, fetch: request = globalThis.fetch, timeoutMs = 25_000 } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) throw new RangeError('语音连接超时限制无效');
  const base = voiceServiceBase(env.NUANBAN_DESKTOP_API_BASE_URL);
  const token = env.NUANBAN_DESKTOP_API_TOKEN;
  const configured = Boolean(base && typeof token === 'string' && token.length > 0 && token.length <= 4096 && /^[\x21-\x7e]+$/u.test(token));

  async function send(path, body, signal) {
    if (!configured) throw new Error('尚未配置桌宠服务地址与设备会话令牌，实时语音未开启');
    const combined = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    let response;
    try {
      if (combined.aborted) throw new Error('cancelled');
      response = await request(base + path, { method: body ? 'POST' : 'GET', signal: combined, redirect: 'error',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'x-request-id': randomUUID() },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('application/json') || !response.body) {
        await response.body?.cancel();
        throw new Error('unavailable');
      }
      const reader = response.body.getReader();
      const chunks = [];
      let bytes = 0;
      const cancel = () => { void reader.cancel().catch(() => {}); };
      combined.addEventListener('abort', cancel, { once: true });
      if (combined.aborted) cancel();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 96 * 1024) throw new Error('oversized');
          chunks.push(Buffer.from(chunk.value));
        }
        if (combined.aborted) throw new Error('cancelled');
        const result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
        if (!result?.data || result.error) throw new Error('invalid');
        return result.data;
      } finally {
        combined.removeEventListener('abort', cancel);
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch {
      throw new Error(signal?.aborted ? '实时语音连接已停止' : '实时语音服务不可用，请检查服务配置、设备令牌、网络及供应商额度后手动重试');
    }
  }

  return {
    status: () => ({ configured }),
    async check({ signal } = {}) {
      const result = await send('status', null, signal);
      if (result.configured !== true || result.provider !== 'OpenAI' || result.audioOnly !== true) throw new Error('服务端尚未配置真实语音模型与密钥，麦克风未开启');
      return { configured: true, provider: 'OpenAI', audioOnly: true };
    },
    async connect(offer, { signal } = {}) {
      if (!audioOnlySdp(offer)) throw new Error('只允许纯音频语音会话');
      const result = await send('call', { offer, consent: true }, signal);
      if (!audioOnlySdp(result.answer)) throw new Error('语音服务未返回有效会话');
      return { answer: result.answer };
    },
  };
}

module.exports = { createRealtimeVoiceClient, audioOnlySdp, voiceServiceBase };
