import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

type GuidanceAudit = { questions: { text: string; generation: number }[]; microphones: number[]; commands: string[] };

async function guidanceFixture(page: Page, cloudConsent = true, consentResult: 'allow' | 'deny' | 'pending' = 'allow') {
  await page.route('http://127.0.0.1:41873/**', async route => {
    const filename = new URL(route.request().url()).pathname.slice(1);
    if (!['pet.html', 'pet.css', 'pet.js', 'pet-artwork.js', 'pet-search.js'].includes(filename)) return route.abort();
    await route.fulfill({ body: readFileSync(new URL(`../../apps/desktop/${filename}`, import.meta.url)),
      contentType: filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.css') ? 'text/css' : 'text/javascript' });
  });
  await page.addInitScript(({ cloudConsent, consentResult }) => {
    const audit: GuidanceAudit = { questions: [], microphones: [], commands: [] };
    let listener: ((value: unknown) => void) | undefined;
    const state = {
      observation: { state: 'observing', generation: 7, captureActive: true, cloudConsent },
      task: { id: '', kind: 'guidance', state: 'idle', generation: 1, observationGeneration: 7, instruction: '', question: '' },
      analysis: { state: 'idle', message: '' }, captions: { enabled: false }, wake: { state: 'disabled' },
    };
    const publish = () => listener?.(structuredClone(state));
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
      command: async ({ type, observationGeneration }: { type: string; observationGeneration?: number }) => {
        audit.commands.push(type);
        if (type === 'observation.authorize-cloud') {
          const allowed = consentResult === 'pending' ? await new Promise<boolean>(resolve => { consentDecision = resolve; }) : consentResult === 'allow';
          if (!allowed || state.observation.state !== 'observing' || observationGeneration !== state.observation.generation) return { ok: true, status: 'cancelled' };
          state.observation.cloudConsent = true;
        }
        if (type === 'observation.reselect') {
          state.observation.generation++;
          state.observation.cloudConsent = true;
        }
        if (type === 'guidance.finish') {
          state.task.state = 'ended';
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
          generation: state.task.generation + 1, observationGeneration: generation, question: text };
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
      state.task.instruction = '请核对箭头指引并亲手点击设置。';
      state.analysis = { state: 'ready', message: '合成目标已定位。' };
      publish();
    });
  }, { cloudConsent, consentResult });
  await page.goto('http://127.0.0.1:41873/pet.html');
  await page.locator('#pet-toggle').click();
  await page.locator('#feature-guidance').click();
  await expect(page.locator('#lesson-card')).toBeVisible();
}

async function guidanceAudit(page: Page) {
  return page.evaluate(() => (window as unknown as { syntheticGuidanceAudit: GuidanceAudit }).syntheticGuidanceAudit);
}

test('已有屏幕授权可直接点击文字查找，单独同意分析后发送，无需重新选屏', async ({ page }, testInfo) => {
  await guidanceFixture(page, false);
  await expect(page.locator('#screen-voice-find')).toBeEnabled();
  await expect(page.locator('#guidance-status')).toContainText('无需重新选择屏幕');
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
