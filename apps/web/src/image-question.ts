import { ServiceFailure, type ImageQuestionBridge, type ImageQuestionInput, type ImageQuestionPort, type ImageQuestionStatus, type ImageQuestionReply, type ImageQuestionMime } from '@nuanban/application';

declare global {
  interface Window { nuanbanImageQuestion?: ImageQuestionBridge; }
}

const unavailable: ImageQuestionStatus = Object.freeze({ available: false, reason: 'host_unavailable' });
const messages = {
  INVALID_REQUEST: '请选择有效的 PNG、JPEG 或 WebP 图片（不超过 10MB，最长边 4096 像素），问题不超过 1500 字。',
  CONSENT_REQUIRED: '请先确认仅本次允许发送检查通过的脱敏图片。',
  RISK_PAUSED: '图片未通过本机安全检查。敏感、无法确认或检测失败的图片不会发送，请换图或改用文字提问。',
  PROVIDER_UNAVAILABLE: '图片模型尚未接入，或接口暂不可用。图片和问题已保留，不会用演示回答冒充识别结果。',
  TIMEOUT: '图片接口等待超时，已停止本次请求。图片和问题已保留，可以稍后重试。',
  CANCELLED: '本次图片讲解已停止，不会自动恢复。',
};

function bridgeForWindow(): ImageQuestionBridge | undefined {
  const bridge = window.nuanbanImageQuestion;
  return bridge && ['status', 'answer', 'cancel'].every(method => typeof bridge[method as keyof ImageQuestionBridge] === 'function') ? bridge : undefined;
}

function waitFor<T>(task: Promise<T>, signal: AbortSignal | undefined, timeoutMs: number, onStop: () => void = () => undefined): Promise<T> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clean = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const fail = (error: unknown) => { if (!finished) { finished = true; clean(); reject(error); } };
    const abort = () => { onStop(); fail(new DOMException('已停止', 'AbortError')); };
    task.then(value => { if (!finished) { finished = true; clean(); resolve(value); } }, fail);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { onStop(); fail(new ServiceFailure('TIMEOUT', messages.TIMEOUT, true)); }, timeoutMs);
  });
}

export class DesktopImageQuestion implements ImageQuestionPort {
  async status(): Promise<ImageQuestionStatus> {
    const bridge = bridgeForWindow();
    if (!bridge) return unavailable;
    try {
      const value = await waitFor(bridge.status(), undefined, 2000);
      if (!value || typeof value.available !== 'boolean' || !['ready', 'model_not_configured', 'host_unavailable'].includes(value.reason)
        || value.available !== (value.reason === 'ready')) return unavailable;
      return { available: value.available, reason: value.reason };
    } catch { return unavailable; }
  }

  async answer(input: ImageQuestionInput, signal: AbortSignal): Promise<string> {
    if (signal.aborted) throw new DOMException('已停止', 'AbortError');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.image.type) || !input.image.size || input.image.size > 10 * 1024 * 1024
      || input.question.length > 1500) throw new ServiceFailure('INVALID_REQUEST', messages.INVALID_REQUEST);
    const status = await waitFor(this.status(), signal, 3000);
    const bridge = bridgeForWindow();
    if (!bridge || !status.available) throw new ServiceFailure('PROVIDER_UNAVAILABLE', status.reason === 'model_not_configured'
      ? '图片问答接口已就绪，模型暂未接入。本次没有上传图片；图片和问题已保留。'
      : '当前没有可用的桌面图片接口。请使用更新后的桌面客户端，图片不会改走网页上传。');
    if (!input.confirmed) throw new ServiceFailure('CONSENT_REQUIRED', messages.CONSENT_REQUIRED);
    const bytes = new Uint8Array(await waitFor(input.image.arrayBuffer(), signal, 5000));
    if (signal.aborted) { bytes.fill(0); throw new DOMException('已停止', 'AbortError'); }
    const requestId = crypto.randomUUID();
    const cancel = () => { try { void Promise.resolve(bridge.cancel(requestId)).catch(() => undefined); } catch {} };
    try {
      const reply: ImageQuestionReply = await waitFor(bridge.answer({ requestId, question: input.question.trim() || '请帮我看看这张图片。',
        image: { mime: input.image.type as ImageQuestionMime, bytes }, confirmed: true }), signal, 50000, cancel);
      if (!reply || reply.requestId !== requestId || typeof reply.ok !== 'boolean') throw new ServiceFailure('PROVIDER_UNAVAILABLE', messages.PROVIDER_UNAVAILABLE, true);
      if (!reply.ok) {
        if (!Object.hasOwn(messages, reply.code) || typeof reply.retryable !== 'boolean') throw new ServiceFailure('PROVIDER_UNAVAILABLE', messages.PROVIDER_UNAVAILABLE, true);
        throw new ServiceFailure(reply.code, messages[reply.code], reply.retryable);
      }
      if (typeof reply.text !== 'string' || !reply.text.trim() || reply.text.length > 24000) throw new ServiceFailure('PROVIDER_UNAVAILABLE', messages.PROVIDER_UNAVAILABLE, true);
      return reply.text.trim();
    } catch (error) {
      if (error instanceof ServiceFailure || (error instanceof DOMException && error.name === 'AbortError')) throw error;
      throw new ServiceFailure('PROVIDER_UNAVAILABLE', messages.PROVIDER_UNAVAILABLE, true);
    } finally { bytes.fill(0); }
  }
}
