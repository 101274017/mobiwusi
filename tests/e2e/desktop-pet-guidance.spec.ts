import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

type GuidanceReply = { guideId: string; taskGeneration: number; observationGeneration: number; text?: string };
type GuidanceAudit = { questions: { text: string; generation: number }[]; microphones: number[]; commands: string[]; replies: GuidanceReply[]; rescans: GuidanceReply[] };

async function guidanceFixture(page: Page, cloudConsent = true, consentResult: 'allow' | 'deny' | 'pending' = 'allow', sourceName = '合成整屏 · 800×600') {
  await page.route('http://127.0.0.1:41873/**', async route => {
    const filename = new URL(route.request().url()).pathname.slice(1);
    if (!['pet.html', 'pet.css', 'pet.js', 'pet-artwork.js', 'pet-search.js'].includes(filename)) return route.abort();
    await route.fulfill({ body: readFileSync(new URL(`../../apps/desktop/${filename}`, import.meta.url)),
      contentType: filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.css') ? 'text/css' : 'text/javascript' });
  });
  await page.addInitScript(({ cloudConsent, consentResult, sourceName }) => {
    const audit: GuidanceAudit = { questions: [], microphones: [], commands: [], replies: [], rescans: [] };
    let listener: ((value: unknown) => void) | undefined;
    const state = {
      observation: { state: 'observing', generation: 7, captureActive: true, cloudConsent, sourceName, reason: '' },
      task: { id: '', kind: 'guidance', state: 'idle', generation: 1, observationGeneration: 7, instruction: '', question: '', explanation: '', presentation: '', targetState: 'hidden', awaitingReply: false },
      analysis: { state: 'idle', message: '' }, captions: { enabled: false }, wake: { state: 'disabled' },
    };
    const publish = () => listener?.(structuredClone(state));
    let consentRace = '';
    const pauseObservation = () => {
      state.observation = { ...state.observation, state: 'privacy_paused', captureActive: false, cloudConsent: false,
        generation: state.observation.generation + 1, reason: 'sensitive_screen' };
      state.analysis = { state: 'error', message: '本地检测发现敏感文字，已停止采集和发送。请先关闭敏感页面，再由本人重新选择观察范围。' };
    };
    window.addEventListener('test-guidance-stale', event => {
      const mode = (event as CustomEvent<string>).detail;
      if (mode === 'snapshot') pauseObservation();
      else consentRace = mode;
    });
    let consentDecision: ((allowed: boolean) => void) | undefined;
    window.addEventListener('test-guidance-consent', () => consentDecision?.(true));
    window.addEventListener('test-guidance-stop', () => {
      state.observation = { ...state.observation, state: 'stopped', captureActive: false, cloudConsent: false, generation: state.observation.generation + 1 };
      publish();
    });
    Object.assign(window, { syntheticGuidanceAudit: audit, nuanbanPet: {
      snapshot: async () => structuredClone(state),
      onState: (callback: typeof listener) => { listener = callback; return () => { listener = undefined; }; },
      onPanel: () => () => {}, focusInput: async () => true,
      command: async ({ type, observationGeneration, taskGeneration, guideId, text }: { type: string; observationGeneration?: number; taskGeneration?: number; guideId?: string; text?: string }) => {
        audit.commands.push(type);
        if (type === 'guidance.reply' || type === 'guidance.rescan') {
          if (!state.task.awaitingReply || guideId !== state.task.id || taskGeneration !== state.task.generation
            || observationGeneration !== state.observation.generation || !state.observation.cloudConsent) throw new Error('追问或授权已变化');
          const entry = { guideId, taskGeneration, observationGeneration, ...(type === 'guidance.reply' ? { text } : {}) } as GuidanceReply;
          (type === 'guidance.reply' ? audit.replies : audit.rescans).push(entry);
          state.task = { ...state.task, awaitingReply: false, generation: state.task.generation + 1, state: 'analyzing', explanation: '' };
          state.analysis = { state: 'analyzing', message: '合成连续分析；保留原目标。' };
        }
        if (type === 'observation.authorize-cloud') {
          if (consentRace) {
            pauseObservation();
            if (consentRace === 'legacy') throw new Error("Error invoking remote method 'nuanban:pet:command': 请先开启屏幕观察");
            return { ok: false, status: 'observation_changed', snapshot: structuredClone(state) };
          }
          const allowed = consentResult === 'pending' ? await new Promise<boolean>(resolve => { consentDecision = resolve; }) : consentResult === 'allow';
          if (!allowed || state.observation.state !== 'observing' || observationGeneration !== state.observation.generation) return { ok: true, status: 'cancelled' };
          state.observation.cloudConsent = true;
        }
        if (type === 'observation.reselect') {
          state.observation.generation++;
          state.observation.cloudConsent = true;
        }
        if (type === 'observation.resume') {
          state.observation = { ...state.observation, state: 'observing', captureActive: true, cloudConsent: false,
            generation: state.observation.generation + 1, reason: '' };
          state.analysis = { state: 'idle', message: '仅本地观察，不向云端发送画面。' };
        }
        if (type === 'guidance.finish') {
          state.task.state = 'ended';
          state.task.awaitingReply = false;
          state.task.generation++;
          state.analysis = { state: 'idle', message: '本次教学已结束；本地观察仍由你授权。' };
        }
        publish();
        return { ok: true, snapshot: structuredClone(state) };
      },
      ask: async (text: string, generation: number) => {
        if (!state.observation.cloudConsent || generation !== state.observation.generation) throw new Error('本次画面授权已失效');
        audit.questions.push({ text, generation });
        state.task = { ...state.task, id: `guide-${audit.questions.length}`, kind: 'guidance', state: 'analyzing',
          generation: state.task.generation + 1, observationGeneration: generation, question: text, awaitingReply: false };
        state.analysis = { state: 'analyzing', message: '合成分析进度；不读取屏幕或调用模型。' };
        publish();
        return { ok: true, snapshot: structuredClone(state) };
      },
      dictate: async (generation: number) => {
        audit.microphones.push(generation);
        return { status: 'complete', text: '帮我找到设置', localOnly: true, microphoneActive: false };
      },
      cancelDictation: async () => true, showMenu: async () => true,
    } });
    window.addEventListener('test-guidance-failure', () => {
      state.task.state = 'needs_help';
      state.analysis = { state: 'error', message: '本次屏幕分析超时，已取消请求；不会自动重试。' };
      publish();
    });
    window.addEventListener('test-guidance-result', () => {
      state.task.state = 'awaiting_action';
      state.task.awaitingReply = false;
      state.task.instruction = '请核对箭头指引并亲手点击设置。';
      state.task.presentation = 'confirmed';
      state.task.targetState = 'visible';
      state.analysis = { state: 'ready', message: '合成目标已定位。' };
      publish();
    });
    window.addEventListener('test-guidance-clarify', () => {
      state.task.state = 'needs_help';
      state.task.awaitingReply = true;
      state.task.instruction = '';
      state.task.explanation = '当前画面没有可核验的朋友圈入口，请先亲手打开微信。';
      state.task.presentation = '';
      state.task.targetState = 'hidden';
      state.analysis = { state: 'ready', message: '本次画面分析已结束，未定位到可核验的目标。' };
      publish();
    });
    window.addEventListener('test-guidance-expire', () => {
      state.task.targetState = 'stale';
      publish();
    });
    window.addEventListener('test-guidance-local-frame', event => {
      const retrying = (event as CustomEvent<string>).detail === 'retry';
      state.observation.reason = 'stale_frame';
      state.task.state = retrying ? 'analyzing' : 'needs_help';
      state.task.targetState = 'hidden';
      state.analysis = { state: retrying ? 'capture_retry' : 'capture_error', message: retrying
        ? '正在重新采集最新画面；不会使用过期画面，也不会重新请求屏幕共享。'
        : '本地画面处理超时，未使用过期画面。当前屏幕共享仍保持，请重新点击查找并指引。' };
      publish();
    });
  }, { cloudConsent, consentResult, sourceName });
  await page.goto('http://127.0.0.1:41873/pet.html');
  await page.locator('#pet-toggle').click();
  await page.locator('#feature-guidance').click();
  await expect(page.locator('#lesson-card')).toBeVisible();
}

async function guidanceAudit(page: Page) {
  return page.evaluate(() => (window as unknown as { syntheticGuidanceAudit: GuidanceAudit }).syntheticGuidanceAudit);
}

test('本地画面过期只刷新画面，重试耗尽后可原授权再次查找', async ({ page }, testInfo) => {
  await guidanceFixture(page);
  await page.locator('#question').fill('如何打开微信');
  await page.locator('#send-question').click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('test-guidance-local-frame', { detail: 'retry' })));
  await expect(page.locator('#guidance-status')).toContainText('重新采集最新画面');
  await expect(page.locator('#privacy-notice')).toBeHidden();
  await expect(page.locator('#send-question')).toHaveText('正在刷新画面…');
  await expect(page.locator('#send-question')).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('test-guidance-local-frame', { detail: 'exhausted' })));
  await expect(page.locator('#guidance-status')).toContainText('当前屏幕共享仍保持');
  await expect(page.locator('#privacy-notice')).toBeHidden();
  await expect(page.locator('#send-question')).toBeEnabled();
  await expect(page.locator('#screen-voice-find')).toBeEnabled();
  await expect(page.locator('#question')).toHaveValue('如何打开微信');
  await page.screenshot({ path: testInfo.outputPath('guidance-local-frame-retry.png') });
  await page.locator('#send-question').click();
  const audit = await guidanceAudit(page);
  expect(audit.questions).toEqual([{ text: '如何打开微信', generation: 7 }, { text: '如何打开微信', generation: 7 }]);
  expect(audit.commands.some(type => type.startsWith('observation.'))).toBe(false);
  expect(audit.microphones).toEqual([]);
});

for (const mode of ['snapshot', 'reply', 'legacy']) {
  for (const input of ['text', 'voice']) {
    test(`观察授权竞态 ${mode}/${input} 显示真实暂停原因，恢复需本人点击且不自动重发`, async ({ page }, testInfo) => {
      await guidanceFixture(page, false);
      await page.locator('#question').fill('帮我找到微信');
      await page.evaluate(mode => window.dispatchEvent(new CustomEvent('test-guidance-stale', { detail: mode })), mode);
      await page.locator(input === 'text' ? '#send-question' : '#screen-voice-find').click();
      await expect(page.locator('#guidance-analysis')).toContainText('本地检测发现敏感文字');
      await expect(page.locator('#guidance-analysis')).toBeVisible();
      await expect(page.locator('#privacy-detail')).toContainText('本地检测发现敏感文字');
      await expect(page.locator('#privacy-detail')).toBeInViewport();
      await expect(page.locator('#error-notice')).toBeHidden();
      await expect(page.locator('#question')).toHaveValue('帮我找到微信');
      await expect(page.locator('#send-question')).toBeDisabled();
      await expect(page.locator('#screen-voice-find')).toBeDisabled();
      await expect(page.locator('#guidance-start-observation')).toBeEnabled();
      await expect(page.locator('#guidance-start-observation')).toHaveText('① 本人继续共享');
      const audit = await guidanceAudit(page);
      expect(audit.questions).toEqual([]);
      expect(audit.microphones).toEqual([]);
      expect(audit.commands).not.toContain('observation.resume');
      expect(audit.commands.filter(command => command === 'observation.authorize-cloud')).toHaveLength(mode === 'snapshot' ? 0 : 1);
      if (mode === 'snapshot' && input === 'text') await page.screenshot({ path: testInfo.outputPath('guidance-observation-paused.png') });
      await page.locator('#guidance-start-observation').click();
      await expect(page.locator('#send-question')).toBeEnabled();
      expect(await guidanceAudit(page)).toMatchObject({ questions: [], microphones: [] });
      expect((await guidanceAudit(page)).commands).toContain('observation.resume');
      expect((await guidanceAudit(page)).commands).not.toContain('observation.start');
    });
  }
}

test('已有屏幕授权可直接点击文字查找，单独同意分析后发送，无需重新选屏', async ({ page }, testInfo) => {
  await guidanceFixture(page, false);
  await expect(page.locator('#screen-voice-find')).toBeEnabled();
  await expect(page.locator('#guidance-status')).toContainText('无需重新选择屏幕');
  await expect(page.locator('#guidance-status')).toContainText('观察范围：合成整屏 · 800×600');
  expect(await guidanceAudit(page)).toMatchObject({ questions: [], microphones: [] });
  await page.locator('#question').fill('如何打开微信朋友圈');
  await expect(page.locator('#send-question')).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('guidance-local-observation.png') });
  await page.locator('#send-question').click();
  await expect(page.locator('#send-question')).toHaveText('正在分析画面…');
  await expect(page.locator('#question')).toHaveValue('如何打开微信朋友圈');
  expect(await guidanceAudit(page)).toMatchObject({ questions: [{ text: '如何打开微信朋友圈', generation: 7 }], microphones: [] });
  expect((await guidanceAudit(page)).commands).toContain('observation.authorize-cloud');
  expect((await guidanceAudit(page)).commands).not.toContain('observation.reselect');
});

test('光标指引展示本人所选框选范围，不因进入功能页扩大观察范围', async ({ page }) => {
  await guidanceFixture(page, true, 'allow', '合成屏幕（框选区域 400×300）');
  await expect(page.locator('#guidance-status')).toContainText('观察范围：合成屏幕（框选区域 400×300）');
  expect(await guidanceAudit(page)).toMatchObject({ questions: [], microphones: [] });
  expect((await guidanceAudit(page)).commands).not.toContain('observation.start');
  expect((await guidanceAudit(page)).commands).not.toContain('observation.reselect');
});

test('等待单独画面确认前不听写、不发送；确认后使用原屏幕代次查找', async ({ page }) => {
  await guidanceFixture(page, false, 'pending');
  await page.locator('#screen-voice-find').click();
  await expect(page.locator('#screen-voice-find')).toHaveText('正在等待分析授权…');
  await expect(page.locator('#screen-voice-find')).toBeDisabled();
  expect(await guidanceAudit(page)).toMatchObject({ questions: [], microphones: [] });
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-consent')));
  await expect(page.locator('#send-question')).toHaveText('正在分析画面…');
  expect(await guidanceAudit(page)).toMatchObject({ questions: [{ text: '帮我找到设置', generation: 7 }], microphones: [7] });
});

test('取消单独画面确认保留草稿，本地观察下仍可再次点击查找', async ({ page }) => {
  await guidanceFixture(page, false, 'deny');
  await page.locator('#question').fill('保留的草稿');
  await page.locator('#send-question').click();
  await expect(page.locator('#dictation-status')).toContainText('本次未同意画面分析');
  await expect(page.locator('#send-question')).toBeEnabled();
  await expect(page.locator('#screen-voice-find')).toBeEnabled();
  await expect(page.locator('#question')).toHaveValue('保留的草稿');
  await page.locator('#screen-voice-find').click();
  await expect(page.locator('#dictation-status')).toContainText('本次未同意画面分析');
  expect(await guidanceAudit(page)).toMatchObject({ questions: [], microphones: [] });
});

test('单独画面确认期间停止观察，迟到确认不能恢复查找或录音', async ({ page }) => {
  await guidanceFixture(page, false, 'pending');
  await page.locator('#screen-voice-find').click();
  await expect(page.locator('#screen-voice-find')).toHaveText('正在等待分析授权…');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('test-guidance-stop'));
    window.dispatchEvent(new Event('test-guidance-consent'));
  });
  await expect(page.locator('#dictation-status')).toContainText('本次查找没有发送');
  await expect(page.locator('#screen-voice-find')).toBeDisabled();
  expect(await guidanceAudit(page)).toMatchObject({ questions: [], microphones: [] });
});

test('屏幕提问受理后不再卡在发送态；超时保留草稿且可以结束或重新查找', async ({ page }) => {
  await guidanceFixture(page);
  await page.locator('#question').fill('帮我找到设置');
  await page.locator('#send-question').click();
  await expect(page.locator('#send-question')).toHaveText('正在分析画面…');
  await expect(page.locator('#question')).toHaveValue('帮我找到设置');
  await expect(page.locator('#finish-lesson')).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-failure')));
  await expect(page.locator('#guidance-status')).toContainText('超时');
  await expect(page.locator('#screen-voice-find')).toBeEnabled();
  await expect(page.locator('#send-question')).toBeEnabled();
  await expect(page.locator('#question')).toHaveValue('帮我找到设置');
  expect((await guidanceAudit(page)).questions).toEqual([{ text: '帮我找到设置', generation: 7 }]);
  await page.locator('#send-question').click();
  await expect(page.locator('#send-question')).toHaveText('正在分析画面…');
  await page.locator('#finish-lesson').click();
  await expect(page.locator('#screen-voice-find')).toBeEnabled();
  await expect(page.locator('#send-question')).toBeEnabled();
  expect((await guidanceAudit(page)).questions).toHaveLength(2);
});

test('语音查找只发送识别句和授权代次，后续通过状态流显示结果', async ({ page }) => {
  await guidanceFixture(page);
  await page.locator('#question').fill('保留这份手写草稿');
  await page.locator('#screen-voice-find').click();
  await expect(page.locator('#dictation-status')).toContainText('查找请求已受理');
  await expect(page.locator('#send-question')).toHaveText('正在分析画面…');
  await expect(page.locator('#question')).toHaveValue('保留这份手写草稿');
  expect(await guidanceAudit(page)).toMatchObject({ questions: [{ text: '帮我找到设置', generation: 7 }], microphones: [7] });
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-result')));
  await expect(page.locator('#step-title')).toContainText('亲手点击设置');
  await expect(page.locator('#guidance-status')).toContainText('已找到');
  await expect(page.locator('#screen-voice-find')).toBeEnabled();
});

test('语音分析未定位时直接展示下一步说明，不滞留分析态或开启大字字幕', async ({ page }, testInfo) => {
  await guidanceFixture(page);
  await page.locator('#question').fill('请帮我打开微信朋友圈');
  await page.locator('#screen-voice-find').click();
  await expect(page.locator('#send-question')).toHaveText('正在分析画面…');
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-clarify')));
  await expect(page.locator('#guidance-status')).toContainText('没有生成箭头');
  await expect(page.locator('#guidance-status')).toContainText('请先亲手打开微信');
  await expect(page.locator('#step-explanation')).toContainText('请先亲手打开微信');
  await expect(page.locator('#task-status')).toHaveText('需要再确认一下');
  await expect(page.locator('#question-form')).toBeHidden();
  await expect(page.locator('#guidance-reply-form')).toBeVisible();
  await expect(page.locator('#guidance-original-question')).toContainText('帮我找到设置');
  await expect(page.locator('#guidance-answer')).toBeEditable();
  await expect(page.locator('#guidance-rescan')).toBeEnabled();
  await expect(page.locator('#screen-voice-find')).toBeEnabled();
  await expect(page.locator('#caption-line')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('guidance-clarification-visible.png') });
  expect((await guidanceAudit(page)).questions).toHaveLength(1);
});

test('追问可直接文字回答，保留原目标和草稿；重识别不是另开问题', async ({ page }, testInfo) => {
  await guidanceFixture(page);
  await page.locator('#question').fill('帮我找到微信');
  await page.locator('#send-question').click();
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-clarify')));
  await page.locator('#guidance-answer').fill('微信在电脑左上角');
  await page.screenshot({ path: testInfo.outputPath('guidance-answer-composer.png') });
  await page.locator('#guidance-answer').press('Enter');
  await expect(page.locator('#guidance-reply-form')).toBeHidden();
  expect((await guidanceAudit(page)).replies).toEqual([{ guideId: 'guide-1', taskGeneration: 2, observationGeneration: 7, text: '微信在电脑左上角' }]);
  await expect(page.locator('#question')).toHaveValue('帮我找到微信');
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-clarify')));
  await page.locator('#guidance-rescan').click();
  expect((await guidanceAudit(page)).rescans).toEqual([{ guideId: 'guide-1', taskGeneration: 3, observationGeneration: 7 }]);
  expect((await guidanceAudit(page)).questions).toEqual([{ text: '帮我找到微信', generation: 7 }]);
  await expect(page.locator('#caption-line')).toBeHidden();
});

test('追问语音作为回答继续，改问时恢复原来的问题草稿', async ({ page }) => {
  await guidanceFixture(page);
  await page.locator('#question').fill('帮我找到微信');
  await page.locator('#send-question').click();
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-clarify')));
  await expect(page.locator('#screen-voice-find')).toContainText('语音回答并继续');
  await page.locator('#screen-voice-find').click();
  expect((await guidanceAudit(page)).replies).toEqual([{ guideId: 'guide-1', taskGeneration: 2, observationGeneration: 7, text: '帮我找到设置' }]);
  expect((await guidanceAudit(page)).questions).toHaveLength(1);
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-clarify')));
  await page.locator('#guidance-new-question').click();
  await expect(page.locator('#question-form')).toBeVisible();
  await expect(page.locator('#guidance-reply-form')).toBeHidden();
  await expect(page.locator('#question')).toHaveValue('帮我找到微信');
  await expect(page.locator('#question')).toBeFocused();
});

test('窄小桌宠窗口在分析完成后直接露出结果，不被流程说明和输入框挤出可视区', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 400, height: 720 });
  await guidanceFixture(page);
  await page.locator('#question').fill('请帮我找到微信朋友圈');
  await page.locator('#screen-voice-find').click();
  await page.locator('#panel-body').evaluate(body => { body.scrollTop = body.scrollHeight; });
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-clarify')));
  const visibility = await page.locator('#guidance-status').evaluate(feedback => {
    const feedbackBounds = feedback.getBoundingClientRect();
    const bodyBounds = document.getElementById('panel-body')!.getBoundingClientRect();
    return { top: feedbackBounds.top, bottom: feedbackBounds.bottom, viewportTop: bodyBounds.top, viewportBottom: bodyBounds.bottom };
  });
  expect(visibility.top).toBeGreaterThanOrEqual(visibility.viewportTop);
  expect(visibility.bottom).toBeLessThanOrEqual(visibility.viewportBottom);
  await expect(page.locator('#guidance-status')).toContainText('请先亲手打开微信');
  await page.screenshot({ path: testInfo.outputPath('guidance-small-window-feedback.png') });
});

test('位置失效明确显示隐藏原因，新安全帧恢复时重新展示当前操作说明', async ({ page }) => {
  await guidanceFixture(page);
  await page.locator('#screen-voice-find').click();
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-result')));
  await expect(page.locator('#guidance-status')).toContainText('亲手点击设置');
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-expire')));
  await expect(page.locator('#guidance-status')).toContainText('上次位置已隐藏');
  await expect(page.locator('#guidance-status')).not.toContainText('请看箭头');
  await page.evaluate(() => window.dispatchEvent(new Event('test-guidance-result')));
  await expect(page.locator('#guidance-status')).toContainText('请看箭头');
  expect((await guidanceAudit(page)).questions).toHaveLength(1);
});

test('只读浮层实际渲染箭头和局部提示，续期不闪空，安全时限到期即隐藏', async ({ page }, testInfo) => {
  await page.route('http://127.0.0.1:41873/**', async route => {
    const filename = new URL(route.request().url()).pathname.slice(1);
    if (!['guide.html', 'guide.css', 'guide.js'].includes(filename)) return route.abort();
    await route.fulfill({ body: readFileSync(new URL(`../../apps/desktop/${filename}`, import.meta.url)),
      contentType: filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.css') ? 'text/css' : 'text/javascript' });
  });
  await page.addInitScript(() => {
    let listener: ((value: unknown) => void) | undefined;
    Object.assign(window, { nuanbanGuide: { onState: (callback: typeof listener) => { listener = callback; return () => { listener = undefined; }; } } });
    window.addEventListener('test-guide-state', event => listener?.((event as CustomEvent).detail));
  });
  await page.clock.install();
  await page.goto('http://127.0.0.1:41873/guide.html');
  const refresh = () => page.evaluate(() => window.dispatchEvent(new CustomEvent('test-guide-state', { detail: {
    visible: true, rect: { x: 120, y: 180, width: 80, height: 48 }, label: '微信',
    instruction: '请亲手双击微信图标，打开后再核验。', presentation: 'uncertain_candidate', expiresAt: Date.now() + 5000,
  } })));
  await refresh();
  await expect(page.locator('#guide-arrow')).toBeVisible();
  await expect(page.locator('#guide-instruction')).toContainText('亲手双击微信');
  await expect(page.locator('#guide-certainty')).toContainText('请先核对');
  await page.clock.runFor(3500);
  await expect(page.locator('#guide-root')).toBeVisible();
  await refresh();
  await page.clock.runFor(3500);
  await expect(page.locator('#guide-arrow')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('guidance-local-arrow.png') });
  await page.clock.runFor(1600);
  await expect(page.locator('#guide-root')).toBeHidden();
});
