import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { AnalysisInput } from '../../apps/desktop/runtime-coordinator.cjs';
import type { AiProvider, ProviderInput } from '../../apps/desktop/ai-provider.cjs';
import { syntheticDetection, syntheticFrame } from '../helpers/standalone-frame';

const requireModule = createRequire(import.meta.url);
const { createProviderAnalysisClient } = requireModule('../../apps/desktop/provider-analysis.cjs') as typeof import('../../apps/desktop/provider-analysis.cjs');
const { evaluateLocalFrame } = requireModule('../../apps/desktop/observation-policy.cjs') as typeof import('../../apps/desktop/observation-policy.cjs');
function requestInput(timestamp = Date.now()): AnalysisInput {
  const raw = syntheticFrame(undefined, timestamp);
  const frame = evaluateLocalFrame(raw, syntheticDetection(raw), { now: timestamp });
  if (frame.decision !== 'allow') throw new Error('测试帧未放行');
  return { frame, question: '教我调整字体', reason: 'question', observationId: 'observation-test', guideId: 'guide-test',
    observationGeneration: 1, taskGeneration: 2, triggerId: 'trigger-test', previousStep: null, signal: new AbortController().signal, canSend: () => true };
}
function provider(answer: AiProvider['answer']) { return { answer: vi.fn(answer) }; }

describe('指定模型到桌宠只读教学适配（合成供应测试）', () => {
  it('缺配置时不可用，无默认教学答案', async () => {
    const client = createProviderAnalysisClient();
    expect(client.capabilities().configured).toBe(false);
    await expect(client.analyze(requestInput())).rejects.toMatchObject({ code: 'ANALYSIS_UNAVAILABLE' });
  });

  it('只向模型发送脱敏图和有限通用控件，结果身份由本机绑定', async () => {
    const input = requestInput();
    const endpoint = provider(async () => ({ text: JSON.stringify({ kind: 'step', instruction: '请亲手打开文本大小。', target_id: input.frame.elements[2].id, presentation: 'confirmed', expected_labels: ['缩放'] }) }));
    const result = await createProviderAnalysisClient({ provider: endpoint }).analyze(input);
    expect(result).toMatchObject({ kind: 'step', observation_id: input.observationId, guide_id: input.guideId, observation_generation: 1, task_generation: 2, trigger_id: input.triggerId, frame_id: input.frame.frameId, target_id: input.frame.elements[2].id });
    const sent = endpoint.answer.mock.calls[0][0];
    expect(sent.image?.bytes).toBe(input.frame.sanitizedPng);
    expect(sent.question).toBe(input.question);
    expect(sent.instructions).toContain(input.frame.elements[2].id);
    expect(sent.instructions).toContain('本机仍会独立核验');
    expect(sent).not.toHaveProperty('rawFrame');
    expect(sent).not.toHaveProperty('ocrText');
    expect(sent.instructions).not.toContain(input.frame.sourceName);
  });

  it('安全控件布局明确告诉模型这不是原始截图，未知正文不进入上下文', async () => {
    const raw = syntheticFrame();
    const frame = evaluateLocalFrame(raw, syntheticDetection(raw, ['文件', '编辑', '查看', '练习文档', '普通正文', '第二行内容']));
    if (frame.decision !== 'allow') throw new Error('missing projected frame');
    const input = { ...requestInput(), frame };
    const endpoint = provider(async () => ({ text: JSON.stringify({ kind: 'clarify', instruction: '请说明要使用的菜单功能。' }) }));
    await createProviderAnalysisClient({ provider: endpoint }).analyze(input);
    const sent = endpoint.answer.mock.calls[0][0];
    expect(sent.instructions).toContain(JSON.stringify({ view: 'controls_only_layout' }).slice(1, -1));
    expect(sent.instructions).toContain('布局示意图而非原始截图');
    expect(sent.instructions).not.toContain('普通正文');
    expect(sent.instructions).not.toContain('练习文档');
    expect(sent.image?.bytes).toBe(frame.sanitizedPng);
    expect(sent.image?.bytes).not.toEqual(raw.png);
  });

  it('本地门控关闭、过期、伪造准入与敏感问题在发送前被拒绝', async () => {
    const endpoint = provider(async () => ({ text: '{}' }));
    const client = createProviderAnalysisClient({ provider: endpoint });
    const copied = requestInput();
    copied.frame = { ...copied.frame };
    const old = requestInput(Date.now() - 6000);
    const aborted = new AbortController();
    aborted.abort();
    for (const input of [copied, old, { ...requestInput(), canSend: () => false }, { ...requestInput(), question: '帮我输入密码' }, { ...requestInput(), signal: aborted.signal }]) {
      await expect(client.analyze(input)).rejects.toMatchObject({ code: 'OUTBOUND_CLOSED' });
    }
    let checks = 0;
    await expect(client.analyze({ ...requestInput(), canSend: () => ++checks < 2 })).rejects.toMatchObject({ code: 'OUTBOUND_CLOSED' });
    expect(endpoint.answer).not.toHaveBeenCalled();
  });

  it('停止或篡改脱敏图后，不安装迟到结果', async () => {
    const input = requestInput();
    let open = true;
    input.canSend = () => open;
    const endpoint = provider(async () => { open = false; return { text: '{"kind":"clarify","instruction":"迟到内容"}' }; });
    await expect(createProviderAnalysisClient({ provider: endpoint }).analyze(input)).rejects.toMatchObject({ code: 'OUTBOUND_CLOSED' });
    const changed = requestInput();
    const changedProvider = provider(async () => { changed.frame.sanitizedPng.fill(0); return { text: '{"kind":"clarify","instruction":"不采用"}' }; });
    await expect(createProviderAnalysisClient({ provider: changedProvider }).analyze(changed)).rejects.toMatchObject({ code: 'OUTBOUND_CLOSED' });
  });

  it('拒绝命令、伪造目标、额外身份字段、超长和敏感建议', async () => {
    const input = requestInput();
    const invalid = [
      { kind: 'step', instruction: '下一步', target_id: 'not-in-frame', presentation: 'confirmed', expected_labels: [] },
      { kind: 'clarify', instruction: '说明目标', command: 'click' },
      { kind: 'clarify', instruction: '说明目标', task_generation: 999 },
      { kind: 'clarify', instruction: '字'.repeat(601) },
      { kind: 'step', instruction: '请输入验证码', target_id: input.frame.elements[0].id, presentation: 'confirmed', expected_labels: [] },
      { kind: 'completed', instruction: '已经完成', evidence_labels: ['设置'] },
    ];
    for (const reply of invalid) {
      const endpoint = provider(async () => ({ text: JSON.stringify(reply) }));
      await expect(createProviderAnalysisClient({ provider: endpoint }).analyze(input)).rejects.toMatchObject({ code: 'INVALID_ANALYSIS_RESPONSE' });
    }
    await expect(createProviderAnalysisClient({ provider: provider(async () => ({ text: '```json\n{}\n```' })) }).analyze(input)).rejects.toMatchObject({ code: 'INVALID_ANALYSIS_RESPONSE' });
  });

  it('完成仅是带证据的建议，保留后续运行核心的独立核验', async () => {
    const input = requestInput();
    input.reason = 'verification';
    input.previousStep = { instruction: '打开字体设置', expectedLabels: ['字体大小'] };
    const endpoint = provider(async () => ({ text: JSON.stringify({ kind: 'completed', instruction: '请核对字体大小页面。', evidence_labels: ['字体大小'] }) }));
    const result = await createProviderAnalysisClient({ provider: endpoint }).analyze(input);
    expect(result).toMatchObject({ kind: 'completed', evidence_labels: ['字体大小'], task_generation: input.taskGeneration });
    expect(result).not.toHaveProperty('verified');
    expect(result).not.toHaveProperty('mastered');
  });

  it('异常只暴露安全状态，不传播供应商正文', async () => {
    const endpoint = provider(async (_input: ProviderInput) => { throw new Error('private-provider-body'); });
    await expect(createProviderAnalysisClient({ provider: endpoint }).analyze(requestInput())).rejects.toMatchObject({ code: 'ANALYSIS_FAILED', message: 'ANALYSIS_FAILED' });
  });
});
