import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createDesktopAnalysisClient, analysisEndpoint } from '../../apps/desktop/analysis-client.cjs';
import type { AnalysisInput } from '../../apps/desktop/runtime-coordinator.cjs';
import { syntheticDetection, syntheticFrame } from '../helpers/standalone-frame';

const { evaluateLocalFrame } = createRequire(import.meta.url)('../../apps/desktop/observation-policy.cjs') as typeof import('../../apps/desktop/observation-policy.cjs');

function requestInput(): AnalysisInput {
  const raw = syntheticFrame();
  const frame = evaluateLocalFrame(raw, syntheticDetection(raw));
  if (frame.decision !== 'allow') throw new Error('合成安全帧夹具未放行');
  return { frame, question: '教我调整文字大小', reason: 'question', observationId: 'observation-test', guideId: 'guide-test',
    observationGeneration: 1, taskGeneration: 1, triggerId: 'trigger-test', previousStep: null, signal: new AbortController().signal, canSend: () => true };
}

const env = { NUANBAN_DESKTOP_API_BASE_URL: 'http://127.0.0.1:3000', NUANBAN_DESKTOP_API_TOKEN: 'synthetic-account-token' };

describe('独立桌宠按需发送适配（合成HTTP单测，不是真实供应验收）', () => {
  it('默认无配置时明确不可用，不发送、不回退演示数据', async () => {
    const fetchRequest = vi.fn<typeof fetch>();
    const client = createDesktopAnalysisClient({ env: {}, fetch: fetchRequest });
    expect(client.capabilities().configured).toBe(false);
    await expect(client.analyze(requestInput())).rejects.toMatchObject({ code: 'ANALYSIS_UNAVAILABLE' });
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it('只允许HTTPS或回环服务，不接受用户信息、查询串和重定向入口', () => {
    expect(analysisEndpoint('https://example.test/base')).toBe('https://example.test/base/v1/standalone/guidance/analyze');
    expect(analysisEndpoint('http://localhost:3000')).toContain('/v1/standalone/guidance/analyze');
    for (const endpoint of ['http://example.test', 'file:///tmp', 'https://user:secret@example.test', 'https://example.test?token=secret', 'https://example.test/#secret']) expect(() => analysisEndpoint(endpoint)).toThrow();
  });

  it('只发送绑定同一帧的脱敏图和最小通用标签，不发送原图或全部OCR正文', async () => {
    const fetchRequest = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: { kind: 'clarify', instruction: '请说明目标。' } }), { status: 200 }));
    const client = createDesktopAnalysisClient({ env, fetch: fetchRequest });
    const input = requestInput();
    await client.analyze(input);
    expect(fetchRequest).toHaveBeenCalledOnce();
    const [endpoint, init] = fetchRequest.mock.calls[0];
    expect(endpoint).toBe('http://127.0.0.1:3000/v1/standalone/guidance/analyze');
    expect(init?.redirect).toBe('error');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ local_safety: 'safe', redaction_profile: 'all_text_and_faces_v1', trigger_reason: 'question', frame_id: input.frame.frameId });
    expect(body.image.base64).toBe(input.frame.sanitizedPng.toString('base64'));
    expect(body.frame_hash).not.toBe(body.sanitized_sha256);
    expect(body).not.toHaveProperty('rawFrame');
    expect(body).not.toHaveProperty('ocrText');
    expect(body).not.toHaveProperty('clarification_replies');
    expect(String(init?.body)).not.toContain(env.NUANBAN_DESKTOP_API_TOKEN);
  });

  it('保留原始目标并按顺序发送追问与回答，不把补充回答当成新问题', async () => {
    const fetchRequest = vi.fn<typeof fetch>(async () => Response.json({ kind: 'step', instruction: '请您亲手打开微信。' }));
    const client = createDesktopAnalysisClient({ env, fetch: fetchRequest });
    const input = requestInput();
    input.question = '教我在微信查看朋友圈';
    input.clarificationReplies = [
      { prompt: '您想使用哪个软件？', answer: '微信' },
      { prompt: '微信已经打开了吗？', answer: '还没打开，桌面有图标' },
    ];
    await client.analyze(input);
    const body = JSON.parse(String(fetchRequest.mock.calls[0][1]?.body));
    expect(body.question).toBe(input.question);
    expect(body.clarification_replies).toEqual([
      { question: '您想使用哪个软件？', answer: '微信' },
      { question: '微信已经打开了吗？', answer: '还没打开，桌面有图标' },
    ]);
    expect(body).not.toHaveProperty('clarificationReplies');
    expect(input.clarificationReplies[0]).toEqual({ prompt: '您想使用哪个软件？', answer: '微信' });
    expect(fetchRequest).toHaveBeenCalledOnce();
  });

  it.each([0, 3])('显式%d组追问允许空历史或恰好600/500字符上限，不截断内容', async count => {
    const fetchRequest = vi.fn<typeof fetch>(async () => Response.json({ kind: 'clarify', instruction: '请说明目标。' }));
    const client = createDesktopAnalysisClient({ env, fetch: fetchRequest });
    const replies = Array.from({ length: count }, () => ({ prompt: '问'.repeat(600), answer: '答'.repeat(500) }));
    await client.analyze({ ...requestInput(), clarificationReplies: replies });
    expect(JSON.parse(String(fetchRequest.mock.calls[0][1]?.body)).clarification_replies).toEqual(replies.map(reply => ({ question: reply.prompt, answer: reply.answer })));
  });

  it.each([
    ['null', null], ['非数组', {}], ['稀疏数组', Array(1)],
    ['超过3组', Array.from({ length: 4 }, () => ({ prompt: '哪个软件？', answer: '微信' }))],
    ['空条目', [null]], ['非对象条目', ['微信']], ['数组条目', [['哪个软件？', '微信']]],
    ['缺少追问', [{ answer: '微信' }]], ['缺少回答', [{ prompt: '哪个软件？' }]],
    ['额外字段', [{ prompt: '哪个软件？', answer: '微信', raw_ocr: '不允许外发' }]],
    ['错误追问类型', [{ prompt: 123, answer: '微信' }]], ['错误回答类型', [{ prompt: '哪个软件？', answer: 123 }]],
    ['空白追问', [{ prompt: ' \n', answer: '微信' }]], ['空白回答', [{ prompt: '哪个软件？', answer: ' \n' }]],
    ['过长追问', [{ prompt: '问'.repeat(601), answer: '微信' }]], ['过长回答', [{ prompt: '哪个软件？', answer: '答'.repeat(501) }]],
    ['追问控制字符', [{ prompt: '问\u0000', answer: '微信' }]], ['回答控制字符', [{ prompt: '哪个软件？', answer: '微\u200B信' }]],
  ] satisfies Array<[string, unknown]>)('无效追问记录拒绝整次发送而不是静默丢弃：%s', async (_name, replies) => {
    const fetchRequest = vi.fn<typeof fetch>();
    const client = createDesktopAnalysisClient({ env, fetch: fetchRequest });
    await expect(client.analyze({ ...requestInput(), clarificationReplies: replies } as AnalysisInput)).rejects.toMatchObject({ code: 'OUTBOUND_CLOSED' });
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it.each((['prompt', 'answer'] as const).flatMap(field => [
    '验证码123456', '查看私人聊天', 'private@example.test', '13800138000', 'Bearer synthetic-token',
    'ｐａｓｓｗｏｒｄ', 'sk-synthetic1234567890123456',
  ].map(content => [field, content] as const)))('追问的%s含敏感内容时不发送任何图像：%s', async (field, content) => {
    const fetchRequest = vi.fn<typeof fetch>();
    const client = createDesktopAnalysisClient({ env, fetch: fetchRequest });
    const reply = { prompt: '哪个软件？', answer: '微信', [field]: content };
    await expect(client.analyze({ ...requestInput(), clarificationReplies: [reply] })).rejects.toMatchObject({ code: 'OUTBOUND_CLOSED' });
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it('发送前二次门控关闭、伪造准入帧或敏感问题均不会触发网络', async () => {
    const fetchRequest = vi.fn<typeof fetch>();
    const client = createDesktopAnalysisClient({ env, fetch: fetchRequest });
    const input = requestInput();
    let checks = 0;
    input.canSend = () => ++checks < 2;
    await expect(client.analyze(input)).rejects.toMatchObject({ code: 'OUTBOUND_CLOSED' });
    await expect(client.analyze({ ...requestInput(), frame: { ...requestInput().frame } })).rejects.toMatchObject({ code: 'OUTBOUND_CLOSED' });
    await expect(client.analyze({ ...requestInput(), question: '教我提交验证码123456' })).rejects.toMatchObject({ code: 'OUTBOUND_CLOSED' });
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it('停止后返回的迟到结果丢弃，服务端错误正文不进入本地错误', async () => {
    const input = requestInput();
    let open = true;
    input.canSend = () => open;
    const late = createDesktopAnalysisClient({ env, fetch: async () => { open = false; return new Response(JSON.stringify({ kind: 'clarify', instruction: 'late' })); } });
    await expect(late.analyze(input)).rejects.toMatchObject({ code: 'OUTBOUND_CLOSED' });
    const failed = createDesktopAnalysisClient({ env, fetch: async () => new Response('provider-secret-token', { status: 503 }) });
    await expect(failed.analyze(requestInput())).rejects.toMatchObject({ code: 'ANALYSIS_UNAVAILABLE' });
    await failed.analyze(requestInput()).catch(error => expect(String(error)).not.toContain('provider-secret-token'));
  });

  it.each(['closed', 'aborted', 'tampered'] as const)('等待本地核验后仍检查门控、取消与帧完整性：%s', async condition => {
    const input = requestInput();
    const controller = new AbortController();
    input.signal = controller.signal;
    let open = true;
    input.canSend = () => open;
    input.confirmCurrentFrame = vi.fn(async () => {
      open = condition !== 'closed';
      if (condition === 'aborted') controller.abort();
      if (condition === 'tampered') input.frame.sanitizedPng.fill(0);
      return true;
    });
    const fetchRequest = vi.fn<typeof fetch>(async () => { open = false; return new Response(JSON.stringify({ kind: 'clarify', instruction: '请说明目标。' })); });
    const client = createDesktopAnalysisClient({ env, fetch: fetchRequest });
    await expect(client.analyze(input)).rejects.toMatchObject({ code: 'OUTBOUND_CLOSED' });
    expect(input.confirmCurrentFrame).toHaveBeenCalledOnce();
    expect(fetchRequest).toHaveBeenCalledOnce();
  });

  it('回复大小、格式和超时有界，不因错误常驻重连', async () => {
    const oversized = createDesktopAnalysisClient({ env, fetch: async () => new Response('x'.repeat(32001)) });
    await expect(oversized.analyze(requestInput())).rejects.toMatchObject({ code: 'INVALID_ANALYSIS_RESPONSE' });
    const invalid = createDesktopAnalysisClient({ env, fetch: async () => new Response('<not-json>') });
    await expect(invalid.analyze(requestInput())).rejects.toMatchObject({ code: 'ANALYSIS_FAILED' });
    const fetchRequest = vi.fn<typeof fetch>(async (_url, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('synthetic-timeout')), { once: true }); }));
    const timeout = createDesktopAnalysisClient({ env, fetch: fetchRequest, timeoutMs: 15 });
    await expect(timeout.analyze(requestInput())).rejects.toMatchObject({ code: 'ANALYSIS_CANCELLED' });
    expect(fetchRequest).toHaveBeenCalledOnce();
  });
});
