const { isAdmittedFrame, isRestrictedText } = require('./observation-policy.cjs');

const forbiddenTextPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function analysisEndpoint(baseUrl) {
  if (typeof baseUrl !== 'string' || !baseUrl) return null;
  const url = new URL(baseUrl);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) throw failure('INVALID_ANALYSIS_CONFIG', '云分析服务地址必须是HTTPS或本机回环地址');
  url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/standalone/guidance/analyze`;
  return url.href;
}

async function boundedJson(response, limit = 32000) {
  if (!response.body) throw failure('INVALID_ANALYSIS_RESPONSE', '分析服务未返回结果');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > limit) throw failure('INVALID_ANALYSIS_RESPONSE', '分析结果超过本地限制');
      chunks.push(Buffer.from(item.value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function createDesktopAnalysisClient(options = {}) {
  const env = options.env ?? process.env;
  const endpoint = analysisEndpoint(env.NUANBAN_DESKTOP_API_BASE_URL);
  const accessToken = env.NUANBAN_DESKTOP_API_TOKEN;
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  return {
    capabilities() { return { configured: Boolean(endpoint && typeof accessToken === 'string' && accessToken.length > 0), protocol: 'standalone-guidance-v1' }; },
    async analyze(input) {
      if (!endpoint || typeof accessToken !== 'string' || !accessToken || /[\r\n]/.test(accessToken)) throw failure('ANALYSIS_UNAVAILABLE', '尚未配置已认证的教学分析服务');
      if (!input || input.signal?.aborted || typeof input.canSend !== 'function' || !input.canSend()
        || !isAdmittedFrame(input.frame, now()) || isRestrictedText(input.question)) throw failure('OUTBOUND_CLOSED', '本地安全资格已失效，拒绝发送');
      if (input.frame.sanitizedPng.length > 2_000_000) throw failure('ANALYSIS_IMAGE_TOO_LARGE', '脱敏画面超过分析服务图像上限；本地共享仍保持，请缩小共享范围后手动重试');
      const replies = input.clarificationReplies;
      if (replies !== undefined && (!Array.isArray(replies) || replies.length > 3 || Array.from(replies).some(reply => !reply
        || typeof reply !== 'object' || Array.isArray(reply) || Object.keys(reply).length !== 2
        || !Object.hasOwn(reply, 'prompt') || !Object.hasOwn(reply, 'answer')
        || typeof reply.prompt !== 'string' || !reply.prompt.trim() || reply.prompt.length > 600
        || forbiddenTextPattern.test(reply.prompt) || isRestrictedText(reply.prompt)
        || typeof reply.answer !== 'string' || !reply.answer.trim() || reply.answer.length > 500
        || forbiddenTextPattern.test(reply.answer) || isRestrictedText(reply.answer)))) throw failure('OUTBOUND_CLOSED', '追问记录无效或涉及隐私，拒绝发送');
      const timeout = AbortSignal.timeout(options.timeoutMs ?? 12000);
      const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
      const body = {
        observation_id: input.observationId, guide_id: input.guideId, observation_generation: input.observationGeneration,
        task_generation: input.taskGeneration, trigger_id: input.triggerId, trigger_reason: input.reason,
        frame_id: input.frame.frameId, frame_hash: input.frame.frameHash, sanitized_sha256: input.frame.sanitizedHash,
        captured_at: new Date(input.frame.capturedAt).toISOString(),
        image: { mime: 'image/png', base64: input.frame.sanitizedPng.toString('base64') },
        redaction_profile: input.frame.redactionProfile, local_safety: 'safe', question: input.question,
        elements: input.frame.elements.map(element => ({ id: element.id, label: element.label, rect: { ...element.rect } })),
      };
      if (replies !== undefined) body.clarification_replies = replies.map(reply => ({ question: reply.prompt, answer: reply.answer }));
      if (input.previousStep) body.previous_step = { instruction: input.previousStep.instruction, expected_labels: input.previousStep.expectedLabels };
      const payload = JSON.stringify(body);
      if (Buffer.byteLength(payload) > 3_000_000) throw failure('ANALYSIS_IMAGE_TOO_LARGE', '脱敏画面请求超过分析服务上限；本地共享仍保持，请缩小共享范围后手动重试');
      if (!input.canSend() || !isAdmittedFrame(input.frame, now()) || signal.aborted) throw failure('OUTBOUND_CLOSED', '发送前本地门控已关闭');
      let response;
      try {
        response = await fetchRequest(endpoint, { method: 'POST', redirect: 'error', signal,
          headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', 'x-request-id': input.triggerId }, body: payload });
        if (!response.ok) {
          await response.body?.cancel();
          throw failure(response.status === 401 || response.status === 503 ? 'ANALYSIS_UNAVAILABLE' : 'ANALYSIS_FAILED', '教学分析服务暂不可用');
        }
        const parsed = await boundedJson(response);
        if (!signal.aborted && !input.canSend() && typeof input.confirmCurrentFrame === 'function') await input.confirmCurrentFrame();
        if (!input.canSend() || signal.aborted || !isAdmittedFrame(input.frame, input.frame.capturedAt)) throw failure('OUTBOUND_CLOSED', '分析结果所属会话已失效');
        const result = parsed?.data ?? parsed;
        if (!result || typeof result !== 'object' || Array.isArray(result) || Object.keys(result).length > 18) throw failure('INVALID_ANALYSIS_RESPONSE', '分析结果结构无效');
        return result;
      } catch (error) {
        if (error?.code && ['OUTBOUND_CLOSED', 'ANALYSIS_UNAVAILABLE', 'ANALYSIS_FAILED', 'INVALID_ANALYSIS_RESPONSE'].includes(error.code)) throw error;
        throw failure(signal.aborted ? 'ANALYSIS_CANCELLED' : 'ANALYSIS_FAILED', signal.aborted ? '分析已取消或超时' : '分析服务请求失败');
      }
    },
  };
}

module.exports = { createDesktopAnalysisClient, analysisEndpoint };
