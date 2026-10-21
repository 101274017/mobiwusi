import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function fixture(page: Page, mode: 'success' | 'failure' | 'pending' = 'success') {
  await page.route('http://127.0.0.1:41875/**', async route => {
    const name = new URL(route.request().url()).pathname.slice(1);
    if (!['pet.html', 'pet.css', 'pet.js', 'pet-artwork.js', 'pet-search.js', 'pet-single-frame.js', 'pet-single-frame.css'].includes(name)) return route.abort();
    await route.fulfill({ body: readFileSync(new URL(`../../apps/desktop/${name}`, import.meta.url)),
      contentType: name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.css') ? 'text/css' : 'text/javascript' });
  });
  await page.addInitScript(({ mode }) => {
    let listener: ((state: unknown) => void) | undefined;
    let state = { state: 'idle', message: '先截帧，再确认。', hasPreview: false };
    let release: (() => void) | undefined;
    const audit = { captures: 0, analyses: 0, cancellations: 0, questions: [] as string[] };
    const publish = (next: typeof state) => { state = next; listener?.(state); return state; };
    const runtime = { observation: { state: 'off', captureActive: false, generation: 1 }, task: { state: 'idle', generation: 1 }, analysis: { state: 'idle' }, captions: { enabled: false }, wake: { state: 'disabled' } };
    Object.assign(window, { singleFrameTestAudit: audit, nuanbanPet: {
      snapshot: async () => runtime, onState: () => () => {}, onPanel: () => () => {},
      command: async () => ({ ok: true }), focusInput: async () => true, showMenu: async () => true,
    }, nuanbanSingleFrame: {
      snapshot: async () => state,
      onState: (callback: typeof listener) => { listener = callback; return () => { listener = undefined; }; },
      capture: async () => {
        audit.captures++;
        publish({ state: 'capturing', message: '正在截帧', hasPreview: false });
        return { state: publish({ state: 'preview', message: '这是待发送的脱敏图，未上传。', hasPreview: true }),
          preview: { id: 'e179c642-1ed7-4322-8efc-6aca31b0773f', width: 1, height: 1, expiresAt: Date.now() + 120000,
            dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==' } };
      },
      analyze: async ({ question }: { question: string }) => {
        audit.analyses++; audit.questions.push(question);
        publish({ state: 'analyzing', message: '仅发送当前图片', hasPreview: true });
        if (mode === 'failure') { publish({ state: 'error', message: 'AI 调用失败，未显示箭头。', hasPreview: false }); throw new Error('AI 调用失败，未显示箭头。'); }
        if (mode === 'pending') { await new Promise<void>(resolve => { release = resolve; }); throw new Error('已取消'); }
        return publish({ state: 'shown', message: '请先核对箭头并亲手双击微信，箭头显示 5 秒。', hasPreview: false });
      },
      cancel: async () => { audit.cancellations++; release?.(); return publish({ state: 'idle', message: '已停止单帧流程。', hasPreview: false }); },
    } });
  }, { mode });
  await page.goto('http://127.0.0.1:41875/pet.html');
  await page.locator('#pet-toggle').click();
  await page.locator('#feature-guidance').click();
  await expect(page.locator('#single-frame-card')).toBeVisible();
}

function audit(page: Page) {
  return page.evaluate(() => (window as unknown as { singleFrameTestAudit: { captures: number; analyses: number; cancellations: number; questions: string[] } }).singleFrameTestAudit);
}

test('单帧入口独立于连续观察：预览不上传，输入问题后才允许分析', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await fixture(page);
  await expect(page.locator('#single-frame-analyze')).toBeDisabled();
  await page.locator('#single-frame-capture').click();
  await expect(page.locator('#single-frame-preview')).toBeVisible();
  await expect(page.locator('#question-form')).toBeHidden();
  await expect(page.locator('#guidance-start-observation')).toBeHidden();
  await expect(page.locator('#single-frame-question')).toBeVisible();
  expect((await audit(page)).analyses).toBe(0);
  await expect(page.locator('#single-frame-analyze')).toBeDisabled();
  await page.locator('#single-frame-question').fill('找到微信图标');
  await expect(page.locator('#single-frame-analyze')).toBeEnabled();
  await page.locator('#single-frame-analyze').scrollIntoViewIfNeeded();
  await expect(page.locator('#single-frame-analyze')).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('single-frame-preview-synthetic.png') });
  await page.locator('#single-frame-analyze').click();
  await expect(page.locator('#single-frame-status')).toContainText('亲手双击微信');
  await expect(page.locator('#single-frame-preview')).toBeHidden();
  await expect(page.locator('#single-frame-image')).not.toHaveAttribute('src');
  expect(await audit(page)).toMatchObject({ captures: 1, analyses: 1, questions: ['找到微信图标'] });
  expect(errors).toEqual([]);
});

test('分析失败显式反馈，不停留在正在发送，不显示成功位置', async ({ page }) => {
  await fixture(page, 'failure');
  await page.locator('#single-frame-capture').click();
  await page.locator('#single-frame-question').fill('找到微信');
  await page.locator('#single-frame-analyze').click();
  await expect(page.locator('#single-frame-status')).toContainText('未显示箭头');
  await expect(page.locator('#single-frame-capture')).toBeEnabled();
  await expect(page.locator('#single-frame-preview')).toBeHidden();
});

test('取消在途分析后清除预览，迟到响应不覆盖取消状态', async ({ page }) => {
  await fixture(page, 'pending');
  await page.locator('#single-frame-capture').click();
  await page.locator('#single-frame-question').fill('找到微信');
  await page.locator('#single-frame-analyze').click();
  await expect(page.locator('#single-frame-capture')).toBeDisabled();
  await page.locator('#single-frame-cancel').click();
  await expect(page.locator('#single-frame-status')).toContainText('已停止');
  await expect(page.locator('#single-frame-capture')).toBeEnabled();
  await expect(page.locator('#single-frame-preview')).toBeHidden();
  expect((await audit(page)).cancellations).toBe(1);
});

test('没有单帧桌面接口时明确提示，不能把普通浏览器当作真实共享', async ({ page }) => {
  await fixture(page);
  await page.reload();
  await page.evaluate(() => { delete (window as unknown as { nuanbanSingleFrame?: unknown }).nuanbanSingleFrame; });
  await page.addScriptTag({ url: 'http://127.0.0.1:41875/pet-single-frame.js' });
  await expect(page.locator('#single-frame-status')).toContainText('单帧接口尚未加载');
  await expect(page.locator('#single-frame-capture')).toBeDisabled();
});

test('退出单帧或切换功能会取消操作并恢复原输入区', async ({ page }) => {
  await fixture(page);
  await page.locator('#single-frame-capture').click();
  await page.locator('#single-frame-exit').click();
  await expect(page.locator('#single-frame-question')).toBeHidden();
  await expect(page.locator('#question-form')).toBeVisible();
  await expect(page.locator('#guidance-start-observation')).toBeVisible();
  await page.locator('#single-frame-capture').click();
  await page.locator('#view-features').click();
  await page.locator('#feature-question').click();
  await expect(page.locator('#question-form')).toBeVisible();
  await expect(page.locator('#single-frame-image')).not.toHaveAttribute('src');
  expect((await audit(page)).cancellations).toBe(2);
});

test('窄小桌宠窗口内可滚动完成预览与分析，不出现第二个输入区', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 620 });
  await fixture(page);
  await page.locator('#single-frame-capture').click();
  await page.locator('#single-frame-question').fill('找到微信');
  await page.locator('#single-frame-analyze').scrollIntoViewIfNeeded();
  await expect(page.locator('#single-frame-analyze')).toBeInViewport();
  await expect(page.locator('#question-form')).toBeHidden();
  await page.locator('#single-frame-analyze').click();
  await expect(page.locator('#single-frame-status')).toContainText('亲手双击微信');
});
