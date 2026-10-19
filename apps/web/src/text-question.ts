import { ServiceFailure, type ConversationPort, type TextQuestionBridge, type TextQuestionReply } from '@nuanban/application';
import type { ConversationEvent } from '@nuanban/contracts';

declare global { interface Window { nuanbanTextQuestion?: TextQuestionBridge; } }
const errors = {
  INVALID_REQUEST: '请填写 1～1500 字的问题。', RISK_PAUSED: '内容可能涉及隐私或高风险操作，已在本机拦截，未发送。',
  AUTH_FAILED: '模型网关拒绝了凭证或模型权限，请检查密钥与模型授权。', RATE_LIMITED: '模型网关暂时限流，请稍后手动重试。',
  PROVIDER_UNAVAILABLE: '真实模型接口暂不可用。问题已保留，不会回退固定回答。', STREAM_INTERRUPTED: '模型未完整返回回答，请缩小问题后重试。',
  TIMEOUT: '等待模型超时，已停止请求，问题已保留。', CANCELLED: '本次讲解已停止。',
};

export class DesktopConversation implements ConversationPort {
  async *stream(text: string, signal: AbortSignal): AsyncIterable<ConversationEvent> {
    if (signal.aborted) throw new DOMException('已停止', 'AbortError');
    const bridge = window.nuanbanTextQuestion;
    if (!bridge || typeof bridge.answer !== 'function' || typeof bridge.cancel !== 'function') throw new ServiceFailure('PROVIDER_UNAVAILABLE', '当前没有桌面模型接口。请使用桌面客户端，不会改用模拟对话。');
    const requestId = crypto.randomUUID();
    yield { type: 'started', request_id: requestId, sequence: 0 };
    const reply = await new Promise<TextQuestionReply>((resolve, reject) => {
      let finished = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cancel = () => { try { void bridge.cancel(requestId).catch(() => undefined); } catch {} };
      const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
      const fail = (error: unknown) => { if (!finished) { finished = true; clean(); reject(error); } };
      const abort = () => { cancel(); fail(new DOMException('已停止', 'AbortError')); };
      if (signal.aborted) { abort(); return; }
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => { cancel(); fail(new ServiceFailure('TIMEOUT', errors.TIMEOUT, true)); }, 50000);
      try {
        bridge.answer({ requestId, question: text }).then(value => { if (!finished) { finished = true; clean(); resolve(value); } }, () => fail(new ServiceFailure('PROVIDER_UNAVAILABLE', errors.PROVIDER_UNAVAILABLE, true)));
      } catch { fail(new ServiceFailure('PROVIDER_UNAVAILABLE', errors.PROVIDER_UNAVAILABLE, true)); }
    });
    if (signal.aborted) throw new DOMException('已停止', 'AbortError');
    if (!reply || reply.requestId !== requestId || typeof reply.ok !== 'boolean') throw new ServiceFailure('STREAM_INTERRUPTED', errors.STREAM_INTERRUPTED, true);
    if (!reply.ok) {
      if (!Object.hasOwn(errors, reply.code) || typeof reply.retryable !== 'boolean') throw new ServiceFailure('PROVIDER_UNAVAILABLE', errors.PROVIDER_UNAVAILABLE, true);
      throw new ServiceFailure(reply.code, errors[reply.code], reply.retryable);
    }
    if (typeof reply.text !== 'string' || !reply.text.trim() || reply.text.length > 24000) throw new ServiceFailure('STREAM_INTERRUPTED', errors.STREAM_INTERRUPTED, true);
    for (let offset = 0, sequence = 1; offset < reply.text.length; offset += 4000, sequence++) {
      if (signal.aborted) throw new DOMException('已停止', 'AbortError');
      yield { type: 'delta', request_id: requestId, sequence, text: reply.text.slice(offset, offset + 4000) };
    }
    yield { type: 'completed', request_id: requestId, sequence: Math.ceil(reply.text.length / 4000) + 1 };
  }
}
