import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageQuestionBridge, ImageQuestionReply } from '@nuanban/application';
import { DesktopImageQuestion } from '../../apps/web/src/image-question';

function fixture() {
  const bridge: ImageQuestionBridge = { status: vi.fn<ImageQuestionBridge['status']>(async () => ({ available: true, reason: 'ready' })),
    answer: vi.fn<ImageQuestionBridge['answer']>(async submission => ({ ok: true, requestId: submission.requestId, text: '请亲手调整字号。' })), cancel: vi.fn(async () => true) };
  vi.stubGlobal('window', { nuanbanImageQuestion: bridge });
  const image = new Blob(['synthetic-image'], { type: 'image/png' });
  const read = vi.spyOn(image, 'arrayBuffer');
  return { bridge, read, image, port: new DesktopImageQuestion(), input: { question: '怎么调字号？', image, confirmed: true } };
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('图片附件应用适配器', () => {
  it('浏览器不回退上传或文字演示接口', async () => {
    const current = fixture();
    vi.stubGlobal('window', {});
    expect(await current.port.status()).toEqual({ available: false, reason: 'host_unavailable' });
    await expect(current.port.answer(current.input, new AbortController().signal)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(current.read).not.toHaveBeenCalled();
    expect(current.bridge.answer).not.toHaveBeenCalled();
  });

  it('模型未配置时不读取文件字节、不发送 IPC 附件，保留明确原因', async () => {
    const current = fixture();
    vi.mocked(current.bridge.status).mockResolvedValue({ available: false, reason: 'model_not_configured' });
    await expect(current.port.answer(current.input, new AbortController().signal)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', retryable: false, message: expect.stringContaining('本次没有上传图片') });
    expect(current.read).not.toHaveBeenCalled();
    expect(current.bridge.answer).not.toHaveBeenCalled();
  });

  it('本人未确认时不读取或发送附件', async () => {
    const current = fixture();
    await expect(current.port.answer({ ...current.input, confirmed: false }, new AbortController().signal)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(current.read).not.toHaveBeenCalled();
    expect(current.bridge.answer).not.toHaveBeenCalled();
  });

  it('可仅发送图片，携带有效请求身份，结束后清空传输缓冲', async () => {
    const current = fixture();
    await expect(current.port.answer({ ...current.input, question: '' }, new AbortController().signal)).resolves.toBe('请亲手调整字号。');
    const submission = vi.mocked(current.bridge.answer).mock.calls[0][0];
    expect(submission.question).toBe('请帮我看看这张图片。');
    expect(submission.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(Object.keys(submission.image).sort()).toEqual(['bytes', 'mime']);
    expect(submission.image.bytes.every(value => value === 0)).toBe(true);
  });

  it.each(['image/svg+xml', 'image/gif', 'application/octet-stream'])('不接受不支持的格式：%s', async type => {
    const current = fixture();
    await expect(current.port.answer({ ...current.input, image: new Blob(['x'], { type }) }, new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(current.bridge.status).not.toHaveBeenCalled();
  });

  it('拒绝错误请求身份和空回答，不转而使用演示回答', async () => {
    for (const reply of [{ ok: true, requestId: 'wrong', text: '迟到内容' }, { ok: true, text: '' }] as const) {
      const current = fixture();
      vi.mocked(current.bridge.answer).mockImplementationOnce(async submission => ({ requestId: submission.requestId, ...reply }));
      await expect(current.port.answer(current.input, new AbortController().signal)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    }
  });

  it('取消在途请求后通知主进程，迟到回复不能成功', async () => {
    const current = fixture();
    let finish!: (reply: ImageQuestionReply) => void;
    vi.mocked(current.bridge.answer).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const controller = new AbortController();
    const task = current.port.answer(current.input, controller.signal);
    const assertion = expect(task).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(current.bridge.answer).toHaveBeenCalledOnce());
    const requestId = vi.mocked(current.bridge.answer).mock.calls[0][0].requestId;
    controller.abort();
    await assertion;
    expect(current.bridge.cancel).toHaveBeenCalledExactlyOnceWith(requestId);
    finish({ ok: true, requestId, text: '迟到内容' });
    await Promise.resolve();
  });

  it('读取状态超时会关闭发送，不读取附件', async () => {
    vi.useFakeTimers();
    const current = fixture();
    vi.mocked(current.bridge.status).mockImplementationOnce(() => new Promise(() => undefined));
    const task = current.port.answer(current.input, new AbortController().signal);
    const assertion = expect(task).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    await vi.advanceTimersByTimeAsync(2001);
    await assertion;
    expect(current.read).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
