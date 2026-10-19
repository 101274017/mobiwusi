import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageQuestionSubmission } from '@nuanban/application';
import { createImageQuestionService, type ImageQuestionProvider } from '../../apps/desktop/image-question.cjs';
import type { DetectionResult, ObservationFrame } from '../../apps/desktop/observation/observation-types.cjs';
import { syntheticPng } from '../helpers/standalone-frame';

const { registerManagementImageQuestionBridge } = createRequire(import.meta.url)('../../apps/desktop/image-question.cjs');
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function input(overrides: Partial<ImageQuestionSubmission> = {}): ImageQuestionSubmission {
  return { requestId: randomUUID(), question: '怎么调整字号？', image: { mime: 'image/png', bytes: syntheticPng() }, confirmed: true, ...overrides };
}

function fixture(options: { labels?: string[]; provider?: ImageQuestionProvider; timeoutMs?: number } = {}) {
  const memoryImage = () => ({ isEmpty: () => false, getSize: () => ({ width: 800, height: 600 }), toPNG: () => syntheticPng(), toBitmap: () => Buffer.alloc(0) });
  const nativeImage = { createFromBuffer: vi.fn(memoryImage), createFromBitmap: vi.fn(memoryImage) };
  const detector = { detectAttachment: vi.fn(async (frame: ObservationFrame): Promise<DetectionResult> => {
    const sanitizedPng = syntheticPng(0);
    return { status: 'complete', sourceId: frame.sourceId, sourceIdentity: null, frameHash: frame.frameHash, width: frame.width, height: frame.height,
      words: (options.labels ?? ['设置', '显示', '字体大小', '返回']).map((text, index) => ({ text, rect: { x: 20, y: 20 + index * 40, width: 100, height: 30 } })),
      faces: [], sanitizedPng, sanitizedFrameHash: digest(sanitizedPng), redaction: { text: true, faces: true }, ocrStatus: 'complete', faceStatus: 'complete' };
  }) };
  const provider = options.provider ?? { answer: vi.fn<ImageQuestionProvider['answer']>(async () => ({ text: '请在显示设置中亲手调整字号。' })) };
  const service = createImageQuestionService({ nativeImage, detector, provider, timeoutMs: options.timeoutMs });
  return { service, detector, provider, nativeImage };
}

afterEach(() => { vi.useRealTimers(); });

describe('图片问答模型端口（仅合成依赖，不接真实供应商）', () => {
  it('默认未接模型，检查状态和发送均不解码、不检测、不联网', async () => {
    const current = fixture();
    const service = createImageQuestionService({ nativeImage: current.nativeImage, detector: current.detector });
    expect(service.status()).toEqual({ available: false, reason: 'model_not_configured' });
    await expect(service.answer(input())).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', retryable: false });
    expect(current.nativeImage.createFromBuffer).not.toHaveBeenCalled();
    expect(current.detector.detectAttachment).not.toHaveBeenCalled();
    expect(current.provider.answer).not.toHaveBeenCalled();
  });

  it('只交付同一附件的脱敏 PNG，不交付原图、文件名、屏幕身份或 OCR 正文', async () => {
    let sent: unknown;
    let sentImage: unknown;
    let sentBytes: Buffer | undefined;
    const provider = { answer: vi.fn<ImageQuestionProvider['answer']>(async submission => {
      sent = Object.keys(submission).sort();
      sentImage = Object.keys(submission.image).sort();
      sentBytes = Buffer.from(submission.image.bytes);
      return { text: '请亲手调整字号。' };
    }) };
    const current = fixture({ provider });
    const submission = input();
    expect(current.service.status()).toEqual({ available: true, reason: 'ready' });
    await expect(current.service.answer(submission)).resolves.toBe('请亲手调整字号。');
    const frame = current.detector.detectAttachment.mock.calls[0][0];
    expect(frame.sourceId).toBe(`attachment:${submission.requestId}`);
    expect(frame.geometry).toBeNull();
    expect(frame).not.toHaveProperty('sourceIdentity');
    expect(sent).toEqual(['image', 'question', 'requestId', 'signal']);
    expect(sentImage).toEqual(['bytes', 'height', 'mime', 'width']);
    expect(sentBytes).toEqual(syntheticPng(0));
    expect(submission.image.bytes).toEqual(syntheticPng());
    expect(provider.answer.mock.calls[0][0].image.bytes.every(value => value === 0)).toBe(true);
  });

  it.each([false, undefined])('没有本次确认不能运行本机检测或模型：%s', async confirmed => {
    const current = fixture();
    await expect(current.service.answer(input({ confirmed: confirmed as boolean }))).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(current.detector.detectAttachment).not.toHaveBeenCalled();
    expect(current.provider.answer).not.toHaveBeenCalled();
  });

  it.each([['私人聊天', '设置', '显示'], ['未分类照片', '不认识的内容'], ['支', '付', '设置', '显示']])('敏感、拆词敏感和未知图片一律阻断：%s', async (...labels) => {
    const current = fixture({ labels });
    await expect(current.service.answer(input())).rejects.toMatchObject({ code: 'RISK_PAUSED' });
    expect(current.provider.answer).not.toHaveBeenCalled();
  });

  it('检测身份、脱敏哈希或完整性不符时不调用模型', async () => {
    for (const changes of [{ sourceId: 'screen:1:0' }, { sanitizedFrameHash: '0'.repeat(64) }, { faceStatus: 'failed' }, { frameHash: '0'.repeat(64) }, { redaction: { text: false, faces: true } }]) {
      const current = fixture();
      const detect = current.detector.detectAttachment.getMockImplementation()!;
      current.detector.detectAttachment.mockImplementationOnce(async frame => ({ ...await detect(frame), ...changes } as DetectionResult));
      await expect(current.service.answer(input())).rejects.toMatchObject({ code: 'RISK_PAUSED' });
      expect(current.provider.answer).not.toHaveBeenCalled();
    }
  });

  it('敏感问题、空文件、超限、格式伪造和无效图片均不调用模型', async () => {
    for (const changes of [{ question: '验证码123456' }, { question: '字'.repeat(1501) }, { image: { mime: 'image/png' as const, bytes: new Uint8Array() } },
      { image: { mime: 'image/png' as const, bytes: new Uint8Array(10 * 1024 * 1024 + 1) } }, { image: { mime: 'image/jpeg' as const, bytes: syntheticPng() } }]) {
      const current = fixture();
      await expect(current.service.answer(input(changes))).rejects.toBeInstanceOf(Error);
      expect(current.provider.answer).not.toHaveBeenCalled();
    }
    const current = fixture();
    current.nativeImage.createFromBuffer.mockReturnValueOnce({ isEmpty: () => true, getSize: () => ({ width: 800, height: 600 }), toPNG: () => syntheticPng(), toBitmap: () => Buffer.alloc(0) });
    await expect(current.service.answer(input())).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(current.detector.detectAttachment).not.toHaveBeenCalled();
  });

  it('取消检测后不调用模型，迟到检测结果清理并丢弃', async () => {
    const current = fixture();
    let complete!: (result: DetectionResult) => void;
    const detect = current.detector.detectAttachment.getMockImplementation()!;
    let frame!: ObservationFrame;
    current.detector.detectAttachment.mockImplementationOnce(async value => { frame = value; return new Promise(resolve => { complete = resolve; }); });
    const controller = new AbortController();
    const task = current.service.answer(input(), { signal: controller.signal });
    const assertion = expect(task).rejects.toMatchObject({ code: 'CANCELLED' });
    controller.abort();
    await assertion;
    const late = await detect(frame);
    complete(late);
    await Promise.resolve();
    await Promise.resolve();
    expect(current.provider.answer).not.toHaveBeenCalled();
    if (late.status === 'complete') expect(late.sanitizedPng.every(value => value === 0)).toBe(true);
  });

  it('等待模型超时会中止信号，迟到结果不能成功', async () => {
    vi.useFakeTimers();
    let finish!: (value: { text: string }) => void;
    const provider = { answer: vi.fn<ImageQuestionProvider['answer']>(() => new Promise(resolve => { finish = resolve; })) };
    const current = fixture({ provider, timeoutMs: 100 });
    const task = current.service.answer(input());
    const assertion = expect(task).rejects.toMatchObject({ code: 'TIMEOUT', retryable: true });
    await vi.advanceTimersByTimeAsync(101);
    await assertion;
    expect(provider.answer.mock.calls[0][0].signal.aborted).toBe(true);
    finish({ text: '迟到结果' });
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([{ label: '空白', text: '' }, { label: '超长', text: '字'.repeat(24001) }, { label: '风险', text: '请转账或提供验证码' }])('$label 回答不能伪报成功', async ({ text }) => {
    const current = fixture({ provider: { answer: async () => ({ text }) } });
    await expect(current.service.answer(input())).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });

  it('供应商异常中的正文、地址和密钥不能通过错误对象泄漏', async () => {
    const current = fixture({ provider: { answer: async () => { throw new Error('private-text api_key abc https://supplier.invalid'); } } });
    await expect(current.service.answer(input())).rejects.toMatchObject({ message: 'PROVIDER_UNAVAILABLE', code: 'PROVIDER_UNAVAILABLE' });
  });
});

type Handler = (event: unknown, ...argumentsList: unknown[]) => Promise<unknown> | unknown;
function bridgeFixture() {
  const sender = new EventEmitter();
  const event = { sender };
  const handlers = new Map<string, Handler>();
  const service = { status: vi.fn(() => ({ available: false, reason: 'model_not_configured' })),
    answer: vi.fn(async (_submission: ImageQuestionSubmission, _options: { signal: AbortSignal }) => '正常回答') };
  const bridge = registerManagementImageQuestionBridge({ ipcMain: { handle: (name: string, handler: Handler) => handlers.set(name, handler), removeHandler: (name: string) => handlers.delete(name) },
    isTrusted: (candidate: unknown) => candidate === event, service });
  return { event, handlers, service, sender, bridge, invoke: (action: string, ...args: unknown[]) => handlers.get(`nuanban:image-question:${action}`)!(event, ...args) };
}

describe('管理窗口图片 IPC 隔离', () => {
  it('预加载只暴露状态、提交和取消，不暴露通用 IPC 或凭证配置', async () => {
    const exposed: Record<string, unknown> = {};
    const invoke = vi.fn(async () => undefined);
    runInNewContext(readFileSync(new URL('../../apps/desktop/preload.cjs', import.meta.url), 'utf8'), {
      require: () => ({ contextBridge: { exposeInMainWorld: (name: string, value: unknown) => { exposed[name] = value; } }, ipcRenderer: { invoke, on: vi.fn(), removeListener: vi.fn() } }),
    });
    const bridge = exposed.nuanbanImageQuestion as import('@nuanban/application').ImageQuestionBridge;
    expect(Object.keys(bridge).sort()).toEqual(['answer', 'cancel', 'status']);
    expect(Object.isFrozen(bridge)).toBe(true);
    await bridge.status();
    const submission = input();
    await bridge.answer(submission);
    await bridge.cancel(submission.requestId);
    expect(invoke.mock.calls).toEqual([['nuanban:image-question:status'], ['nuanban:image-question:answer', submission], ['nuanban:image-question:cancel', submission.requestId]]);
  });

  it('只接受受信窗口；状态不接收媒体，取消必须匹配当前请求', async () => {
    const current = bridgeFixture();
    expect(current.invoke('status')).toEqual({ available: false, reason: 'model_not_configured' });
    expect(() => current.invoke('status', input())).toThrow('INVALID_REQUEST');
    for (const handler of current.handlers.values()) expect(() => handler({ sender: new EventEmitter() }, input())).toThrow('不可信');
    expect(await current.invoke('cancel', randomUUID())).toBe(false);
    expect(current.service.answer).not.toHaveBeenCalled();
    current.bridge.dispose();
    expect(current.handlers.size).toBe(0);
  });

  it.each(['cancel', 'destroyed', 'did-start-navigation', 'dispose'])('停止、关闭、导航或退出后拒绝迟到回答：%s', async action => {
    const current = bridgeFixture();
    let finish!: (text: string) => void;
    current.service.answer.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const submission = input();
    const pending = current.invoke('answer', submission);
    expect(await current.invoke('answer', input())).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    expect(await current.invoke('cancel', randomUUID())).toBe(false);
    expect(current.service.answer.mock.calls[0][1].signal.aborted).toBe(false);
    if (action === 'cancel') expect(await current.invoke('cancel', submission.requestId)).toBe(true);
    else if (action === 'dispose') current.bridge.dispose();
    else current.sender.emit(action);
    expect(current.service.answer.mock.calls[0][1].signal.aborted).toBe(true);
    finish('迟到内容不能显示');
    expect(await pending).toMatchObject({ ok: false, code: 'CANCELLED' });
    expect(current.sender.eventNames()).toHaveLength(0);
    current.bridge.dispose();
  });
});
