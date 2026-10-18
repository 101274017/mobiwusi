const { randomUUID } = require('node:crypto');
const { evaluateLocalFrame, isAdmittedFrame, isRestrictedText, normalizeLabel, safeSummary } = require('./observation-policy.cjs');

function createDesktopRuntime(options) {
  if (!options?.source || typeof options.source.capture !== 'function' || typeof options.source.detect !== 'function') throw new TypeError('本地观察端口不完整');
  const now = options.now ?? Date.now;
  const intervalMs = options.intervalMs ?? 1500;
  const maxAgeMs = options.maxAgeMs ?? 5000;
  const notify = options.onState ?? (() => undefined);
  const renderTarget = options.onTarget ?? (() => undefined);
  let observationGeneration = 0;
  let taskGeneration = 0;
  let analysisSequence = 0;
  let timer = null;
  let captureController = null;
  let captureJob = null;
  let analysisController = null;
  let analysisJob = null;
  let cleanupJob = null;
  let pendingReason = null;
  let pendingAnalysis = null;
  let latestFrame = null;
  let analysisFrame = null;
  let previousStep = null;
  let sourceId = null;
  let cloudConsent = false;
  let gateOpen = false;
  let disposed = false;
  const recordedTasks = new Set();
  const state = {
    observation: { state: 'off', generation: 0, sourceName: '', reason: null, captureActive: false },
    task: { state: 'idle', id: null, question: '', instruction: '', explanation: '', presentation: null, result: null },
    analysis: { state: 'idle', message: '默认不采集。请本人选择观察范围并开启。' },
    captions: { enabled: true, text: '' },
    wake: { state: 'unsupported', reason: '尚未配置经本机验证的本地唤醒引擎；点击和文字提问仍可用。' },
    messages: [], message: '右键查看功能；提问和教学不需要打开管理窗口。',
  };

  function snapshot() {
    return structuredClone({ ...state, observation: { ...state.observation, generation: observationGeneration }, task: { ...state.task, generation: taskGeneration } });
  }

  function publish() {
    notify(snapshot());
  }

  function message(text, role = 'system') {
    state.message = text;
    state.messages.push({ id: randomUUID(), role, text });
    if (state.messages.length > 24) state.messages.splice(0, state.messages.length - 24);
  }

  function clearTarget() {
    renderTarget(null);
  }

  function release(frame) {
    if (frame && frame !== latestFrame && frame !== analysisFrame && frame !== pendingAnalysis?.frame) frame.sanitizedPng?.fill(0);
  }

  function invalidateAnalysis() {
    analysisSequence += 1;
    analysisController?.abort();
    const obsolete = pendingAnalysis?.frame;
    pendingAnalysis = null;
    release(obsolete);
  }

  async function recordTeaching(result) {
    if (!state.task.id || recordedTasks.has(state.task.id)) return;
    const note = {
      sourceGuideId: state.task.id, question: safeSummary(state.task.question),
      summary: safeSummary(state.task.instruction || state.task.explanation || '教学未完成。'),
      result, mastery: 'unmastered', startedAt: state.task.startedAt, endedAt: now(),
    };
    if (options.recordTeaching) await options.recordTeaching(note);
    recordedTasks.add(state.task.id);
    if (recordedTasks.size > 128) recordedTasks.delete(recordedTasks.values().next().value);
  }

  async function finishTeaching(result = 'unfinished') {
    taskGeneration += 1;
    invalidateAnalysis();
    clearTarget();
    previousStep = null;
    if (state.task.id) {
      try { await recordTeaching(result); }
      catch {
        message('本次教学记录未保存，请保留当前窗口稍后重试。');
        state.task.state = 'needs_help';
        publish();
        return snapshot();
      }
      state.task.state = result === 'completed' ? 'completed' : 'ended';
      state.task.result = result;
      state.task.instruction = '';
    }
    state.analysis = { state: 'idle', message: '本次教学已结束；仍获授权的本地观察可继续。' };
    state.captions.text = '';
    publish();
    return snapshot();
  }

  function closeObservation(reason, privacyPaused = false) {
    if (cleanupJob) return cleanupJob.then(async result => {
      if (!privacyPaused) {
        state.observation.state = result.stopped ? 'stopped' : 'cleanup_failed';
        await finishTeaching('interrupted');
        publish();
      }
      return result;
    });
    cleanupJob = performCloseObservation(reason, privacyPaused).finally(() => { cleanupJob = null; });
    return cleanupJob;
  }

  async function performCloseObservation(reason, privacyPaused) {
    gateOpen = false;
    observationGeneration += 1;
    invalidateAnalysis();
    pendingReason = null;
    clearTimeout(timer);
    timer = null;
    captureController?.abort();
    clearTarget();
    previousStep = null;
    const obsolete = latestFrame;
    latestFrame = null;
    release(obsolete);
    state.observation.state = privacyPaused ? 'privacy_paused' : 'stopped';
    state.observation.reason = reason;
    state.analysis = { state: privacyPaused ? 'error' : 'idle', message: privacyPaused ? '本地安全检查未放行，已停止采集和发送。请离开风险页面后本人点击“继续共享”。' : '观察已停止；不会自动重新开启。' };
    state.captions.text = '';
    let stopped = true;
    try { await options.source.stop?.(); }
    catch {
      stopped = false;
      state.observation.state = 'cleanup_failed';
      state.observation.reason = 'capture_cleanup_failed';
      message('本地采集退出未确认，已关闭发送。请退出桌宠后重新启动，不能继续共享。');
    }
    state.observation.captureActive = !stopped;
    if (!privacyPaused) await finishTeaching('interrupted');
    else if (state.task.id) state.task.state = 'needs_help';
    publish();
    return { stopped, captureActive: !stopped, mediaActive: false, reason };
  }

  function sameGeneration(observation, task) {
    return !disposed && state.observation.state === 'observing' && observationGeneration === observation && (task === undefined || taskGeneration === task);
  }

  function scheduleCapture() {
    clearTimeout(timer);
    timer = null;
    if (disposed || state.observation.state !== 'observing') return;
    timer = setTimeout(() => { timer = null; requestFrame('page_changed'); }, intervalMs);
    timer.unref?.();
  }

  function targetFor(frame, element) {
    const geometry = frame.geometry;
    if (!geometry || ![geometry.x, geometry.y, geometry.width, geometry.height].every(Number.isFinite)
      || geometry.width <= 0 || geometry.height <= 0
      || Math.abs((frame.width / frame.height) / (geometry.width / geometry.height) - 1) > 0.01) return null;
    return {
      x: geometry.x + element.rect.x * geometry.width / frame.width,
      y: geometry.y + element.rect.y * geometry.height / frame.height,
      width: element.rect.width * geometry.width / frame.width,
      height: element.rect.height * geometry.height / frame.height,
    };
  }

  function currentElement(original, originalFrame, currentFrame) {
    if (originalFrame.signature !== currentFrame.signature || originalFrame.sourceId !== currentFrame.sourceId
      || JSON.stringify(originalFrame.geometry) !== JSON.stringify(currentFrame.geometry)) return null;
    const matches = currentFrame.elements.filter(element => normalizeLabel(element.label) === normalizeLabel(original.label)
      && Math.abs(element.rect.x - original.rect.x) <= 4 && Math.abs(element.rect.y - original.rect.y) <= 4);
    return matches.length === 1 ? matches[0] : null;
  }

  function showStepTarget(frame, element) {
    const rect = targetFor(frame, element);
    if (!rect) {
      clearTarget();
      state.task.explanation = '当前捕获范围的屏幕坐标未验证，暂不绘制位置指引。';
      return;
    }
    renderTarget({ visible: true, rect, label: element.label, instruction: state.task.instruction, presentation: state.task.presentation, expiresAt: now() + Math.min(2500, Math.max(0, frame.capturedAt + maxAgeMs - now())) });
  }

  function canUseFrame(frame, observation, task) {
    return gateOpen && cloudConsent && sameGeneration(observation, task) && isAdmittedFrame(frame, now(), maxAgeMs)
      && latestFrame?.signature === frame.signature && latestFrame.sourceId === frame.sourceId;
  }

  async function installAnalysis(result, job) {
    const current = latestFrame;
    if (!current || !sameGeneration(job.observation, job.task) || !isAdmittedFrame(current, now(), maxAgeMs)
      || current.signature !== job.frame.signature || current.sourceId !== job.frame.sourceId) return false;
    if (!result || typeof result.instruction !== 'string' || result.instruction.length > 600 || isRestrictedText(result.instruction)) throw new Error('invalid_analysis');
    const identity = result.observation_generation === job.observation && result.task_generation === job.task
      && result.frame_id === job.frame.frameId && result.guide_id === state.task.id && result.trigger_id === job.triggerId;
    if (!identity) throw new Error('stale_analysis');
    if (result.kind === 'completed') {
      const labels = new Set(current.elements.map(element => normalizeLabel(element.label)));
      const expected = previousStep?.expectedLabels ?? [];
      const evidence = result.evidence_labels;
      if (job.reason === 'question' || !previousStep || current.signature === previousStep.signature || expected.length === 0
        || !expected.every(label => labels.has(normalizeLabel(label)))
        || !Array.isArray(evidence) || !expected.every(label => evidence.some(item => normalizeLabel(item) === normalizeLabel(label)))) throw new Error('completion_not_verified');
      state.task.explanation = result.instruction;
      state.captions.text = result.instruction;
      message(result.instruction, 'assistant');
      await finishTeaching('completed');
      return true;
    }
    if (result.kind !== 'step') {
      clearTarget();
      state.task.state = 'needs_help';
      state.task.instruction = '';
      state.task.explanation = result.instruction;
      state.captions.text = result.instruction;
      message(result.instruction, 'assistant');
      return true;
    }
    const proposed = job.frame.elements.find(element => element.id === result.target_id);
    const element = proposed ? currentElement(proposed, job.frame, current) : null;
    if (!element || !['confirmed', 'uncertain_candidate'].includes(result.presentation)) throw new Error('target_not_in_current_frame');
    if (previousStep && current.signature !== previousStep.signature && previousStep.expectedLabels.length > 0) {
      const labels = new Set(current.elements.map(item => normalizeLabel(item.label)));
      if (!previousStep.expectedLabels.every(label => labels.has(normalizeLabel(label)))) throw new Error('previous_step_not_verified');
    }
    const expected = Array.isArray(result.expected_labels) ? result.expected_labels.filter(label => typeof label === 'string' && label.length <= 80 && !isRestrictedText(label)).slice(0, 10) : [];
    state.task.state = 'awaiting_action';
    state.task.instruction = result.instruction;
    state.task.presentation = result.presentation;
    state.task.explanation = result.presentation === 'uncertain_candidate' ? '这是当前画面中的候选位置，尚未确认；请先核对。' : '请亲手操作；暖伴不会自动点击或输入。';
    state.captions.text = result.instruction;
    previousStep = { element: { ...element, rect: { ...element.rect } }, signature: current.signature, frame: current, expectedLabels: expected, instruction: result.instruction };
    showStepTarget(current, element);
    message(result.instruction, 'assistant');
    return true;
  }

  function queueAnalysis(frame, reason) {
    if (!state.task.id || ['completed', 'ended', 'idle'].includes(state.task.state)) return;
    if (!cloudConsent || !options.analyzer?.analyze) {
      state.analysis = { state: 'unavailable', message: cloudConsent ? '尚未配置已认证的云分析服务；不使用模拟答案。' : '未同意云分析，画面仅在本地处理。可停止或重新选择观察用途。' };
      state.task.state = 'needs_help';
      publish();
      return;
    }
    const obsolete = pendingAnalysis?.frame;
    pendingAnalysis = { frame, reason, observation: observationGeneration, task: taskGeneration, triggerId: randomUUID(), previous: previousStep };
    release(obsolete);
    if (analysisJob) {
      analysisController?.abort();
      return;
    }
    analysisJob = (async () => {
      while (pendingAnalysis) {
        const job = pendingAnalysis;
        pendingAnalysis = null;
        analysisFrame = job.frame;
        const sequence = ++analysisSequence;
        analysisController = new AbortController();
        if (!canUseFrame(job.frame, job.observation, job.task)) { analysisFrame = null; release(job.frame); continue; }
        state.analysis = { state: 'analyzing', message: '仅为本次有效触发发送经过本地检查与脱敏的必要画面。' };
        state.task.state = job.reason === 'verification' ? 'verifying' : 'analyzing';
        publish();
        try {
          const result = await options.analyzer.analyze({
            frame: job.frame, question: state.task.question, reason: job.reason,
            observationId: state.observation.id, guideId: state.task.id, observationGeneration: job.observation,
            taskGeneration: job.task, triggerId: job.triggerId,
            previousStep: job.previous ? { instruction: job.previous.instruction, expectedLabels: job.previous.expectedLabels } : null,
            signal: analysisController.signal, canSend: () => sequence === analysisSequence && canUseFrame(job.frame, job.observation, job.task),
          });
          if (sequence === analysisSequence && sameGeneration(job.observation, job.task) && !analysisController.signal.aborted) {
            const installed = await installAnalysis(result, job);
            if (installed && state.task.state !== 'completed') state.analysis = { state: 'ready', message: '请按当前一步亲手操作。' };
            publish();
          }
        } catch (error) {
          if (sequence === analysisSequence && sameGeneration(job.observation, job.task) && !analysisController.signal.aborted) {
            clearTarget();
            state.task.state = 'needs_help';
            state.analysis = { state: 'error', message: error?.code === 'ANALYSIS_UNAVAILABLE' ? '云分析服务尚未配置或未登录；不会用演示数据替代。' : '本次分析未获得可核验的结果。可以重新提问、核验或结束，不会继续指错。' };
            publish();
          }
        } finally {
          analysisFrame = null;
          release(job.frame);
        }
      }
    })().finally(() => { analysisJob = null; analysisController = null; });
  }

  async function captureOne(reason) {
    const generation = observationGeneration;
    captureController = new AbortController();
    let frame;
    let detection;
    try {
      frame = await options.source.capture({ sourceId, signal: captureController.signal });
      if (!sameGeneration(generation)) return;
      detection = await options.source.detect(frame, { signal: captureController.signal });
      if (!sameGeneration(generation)) return;
      const admitted = evaluateLocalFrame(frame, detection, { now: now(), maxAgeMs });
      if (admitted.decision !== 'allow') {
        await closeObservation(admitted.reason, true);
        return;
      }
      const old = latestFrame;
      const changed = Boolean(old && (old.signature !== admitted.signature || JSON.stringify(old.geometry) !== JSON.stringify(admitted.geometry)));
      latestFrame = admitted;
      gateOpen = true;
      if (changed) {
        clearTarget();
        invalidateAnalysis();
      }
      release(old);
      if (reason === 'verification' && previousStep && previousStep.signature === admitted.signature) {
        state.task.state = 'awaiting_action';
        state.analysis = { state: 'ready', message: '已检查新画面，尚未观察到预期变化；不会因为点击“我点好了”就进入下一步。' };
        const element = currentElement(previousStep.element, previousStep.frame, admitted);
        if (element) showStepTarget(admitted, element);
        publish();
      } else if (reason !== 'page_changed' || changed) queueAnalysis(admitted, reason);
      else if (previousStep && state.task.state === 'awaiting_action') {
        const element = currentElement(previousStep.element, previousStep.frame, admitted);
        if (element) showStepTarget(admitted, element);
      }
    } catch {
      if (sameGeneration(generation) && !captureController.signal.aborted) await closeObservation('capture_or_detector_failed', true);
    } finally {
      frame?.png?.fill(0);
      detection?.sanitizedPng?.fill(0);
      captureController = null;
    }
  }

  function requestFrame(reason) {
    if (disposed || state.observation.state !== 'observing') return;
    const priority = { page_changed: 0, question: 1, verification: 2 };
    if (!pendingReason || priority[reason] >= priority[pendingReason]) pendingReason = reason;
    clearTimeout(timer);
    timer = null;
    if (captureJob) return;
    captureJob = (async () => {
      while (pendingReason && state.observation.state === 'observing') {
        const nextReason = pendingReason;
        pendingReason = null;
        await captureOne(nextReason);
      }
    })().finally(() => { captureJob = null; scheduleCapture(); });
  }

  async function startObservation(input) {
    if (disposed || input?.actor !== 'owner' || input?.confirmed !== true || typeof input.sourceId !== 'string' || !input.sourceId) throw new Error('必须由本人选择范围并明确开启观察');
    if (cleanupJob) await cleanupJob;
    if (state.observation.state === 'cleanup_failed') throw new Error('采集清理尚未确认，不能重新开启');
    if (state.observation.state === 'privacy_paused' && input.resume !== true) throw new Error('隐私暂停仅允许本人点击继续共享后恢复');
    if (state.observation.state === 'observing') await closeObservation('source_changed');
    observationGeneration += 1;
    sourceId = input.sourceId;
    cloudConsent = input.cloudConsent === true;
    gateOpen = false;
    state.observation = { state: 'observing', id: randomUUID(), generation: observationGeneration, sourceName: input.sourceName ?? '', reason: null, captureActive: true };
    state.analysis = { state: 'idle', message: cloudConsent ? '本地观察已开启；没有有效任务触发时不会持续上传。' : '仅本地观察，不向云端发送画面。' };
    message('观察范围由本人开启；随时可以停止。');
    publish();
    requestFrame(state.task.id && !['completed', 'ended'].includes(state.task.state) ? 'question' : 'page_changed');
    return snapshot();
  }

  async function ask(text) {
    if (disposed || typeof text !== 'string' || !text.trim() || text.length > 500) throw new Error('请输入不超过500字的问题');
    if (state.task.id && !['completed', 'ended'].includes(state.task.state)) await finishTeaching('interrupted');
    taskGeneration += 1;
    state.task = { id: randomUUID(), state: 'needs_help', question: safeSummary(text.trim()), instruction: '', explanation: '', presentation: null, result: null, startedAt: now() };
    message(safeSummary(text.trim()), 'user');
    if (isRestrictedText(text)) {
      clearTarget();
      state.task.state = 'ended';
      state.task.result = 'risk_blocked';
      state.task.explanation = '涉及支付、转账、验证码或私人信息时，暖伴不继续指导该操作。请退出风险页面，必要时与家人电话确认。';
      state.captions.text = state.task.explanation;
      message(state.task.explanation, 'assistant');
      await recordTeaching('risk_blocked');
    } else if (state.observation.state !== 'observing') message('请先本人开启本地观察，选择真实桌面范围，再开始外部软件教学。');
    else requestFrame('question');
    publish();
    return snapshot();
  }

  async function verify() {
    if (state.observation.state !== 'observing' || !state.task.id || !previousStep) throw new Error('当前没有可核验的教学步骤');
    clearTarget();
    state.task.state = 'verifying';
    state.analysis = { state: 'analyzing', message: '正在重新观察当前画面，不会把按钮点击当成成功。' };
    publish();
    requestFrame('verification');
    return snapshot();
  }

  function repeat() {
    if (!state.task.instruction) throw new Error('当前没有可重讲的步骤');
    state.captions.text = state.task.instruction;
    message(state.task.instruction, 'assistant');
    publish();
    return snapshot();
  }

  function toggleCaptions() {
    state.captions.enabled = !state.captions.enabled;
    publish();
    return snapshot();
  }

  async function dispose(reason = 'process-terminated') {
    const result = await closeObservation(reason);
    disposed = true;
    state.messages.length = 0;
    return result;
  }

  async function whenIdle() {
    while (captureJob || analysisJob) {
      if (captureJob) await captureJob;
      if (analysisJob) await analysisJob;
    }
  }

  return { snapshot, startObservation, stopObservation: reason => closeObservation(reason ?? 'user'),
    resumeObservation: input => startObservation({ ...input, resume: true }), ask, verify, finishTeaching, repeat,
    toggleCaptions, dispose, whenIdle };
}

module.exports = { createDesktopRuntime };
