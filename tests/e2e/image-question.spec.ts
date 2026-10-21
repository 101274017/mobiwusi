import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { syntheticPng } from '../helpers/standalone-frame';

type FixtureMode = 'unconfigured' | 'ready' | 'blocked' | 'pending';
async function installFixture(page: Page, mode: FixtureMode) {
  await page.addInitScript(mode => {
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function () {
      sessionStorage.setItem('attachment-read-count', String(Number(sessionStorage.getItem('attachment-read-count') || 0) + 1));
      return read.call(this);
    };
    let complete: (() => void) | undefined;
    window.nuanbanImageQuestion = {
      status: async () => mode === 'unconfigured' ? { available: false, reason: 'model_not_configured' } : { available: true, reason: 'ready' },
      answer: async input => {
        sessionStorage.setItem('image-request-count', String(Number(sessionStorage.getItem('image-request-count') || 0) + 1));
        sessionStorage.setItem('image-request-question', input.question);
        if (mode === 'blocked') return { ok: false, requestId: input.requestId, code: 'RISK_PAUSED', retryable: false };
        if (mode === 'pending') return new Promise(resolve => { complete = () => resolve({ ok: true, requestId: input.requestId, text: '迟到结果不应显示' }); });
        return { ok: true, requestId: input.requestId, text: '合成接口回执：请在设置页面亲手调整字号。' };
      },
      cancel: async () => { sessionStorage.setItem('image-cancelled', 'true'); complete?.(); return true; },
    };
  }, mode);
  await page.goto('/#/chat/new');
}

async function chooseImage(page: Page, name = '合成设置图.png') {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: 'image/png', buffer: syntheticPng() });
  await expect(page.locator('.media-preview')).toContainText(name);
}

test('未接模型时图片可单独提交检查，但不读取、不发送、不生成模拟回答', async ({ page }, testInfo) => {
  await installFixture(page, 'unconfigured');
  await chooseImage(page);
  await expect(page.locator('.media-preview')).toContainText('模型暂未接入');
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('alert', { name: '讲解未完成' })).toContainText('本次没有上传图片');
  await expect(page.locator('.media-preview')).toBeVisible();
  await expect(page.locator('.message.assistant[data-state="completed"]')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('attachment-read-count'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('image-request-count'))).toBeNull();
  await page.screenshot({ path: join(tmpdir(), `nuanban-image-interface-${testInfo.project.name}.png`), fullPage: true });
});

test('网页没有原生接口时明确提示，不悄悄切换文字演示', async ({ page }) => {
  await page.goto('/#/chat/new');
  await chooseImage(page);
  await page.getByLabel('想问微光指引的问题').fill('这张图怎么操作？');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('alert', { name: '讲解未完成' })).toContainText('当前没有可用的桌面图片接口');
  await expect(page.getByLabel('想问微光指引的问题')).toHaveValue('这张图怎么操作？');
  await expect(page.locator('.message.assistant[data-state="completed"]')).toHaveCount(0);
});

test('接口可用时必须本次确认；图片单独提交不再只预览，也不自动保存图片笔记', async ({ page }) => {
  await installFixture(page, 'ready');
  await chooseImage(page);
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: '仅本次允许发送检查通过的脱敏图片' }).check();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.locator('.message.assistant[data-state="completed"]')).toContainText('合成接口回执');
  await expect(page.locator('.message.assistant')).not.toContainText('演示讲解');
  await expect(page.locator('.media-preview')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('image-request-question'))).toBe('请帮我看看这张图片。');
});

test('安全阻断后保留图片和问题，换图必须重新确认，同一文件可以再次选择', async ({ page }) => {
  await installFixture(page, 'blocked');
  await chooseImage(page);
  await page.getByLabel('想问微光指引的问题').fill('这张图怎么操作？');
  const consent = page.getByRole('checkbox', { name: '仅本次允许发送检查通过的脱敏图片' });
  await consent.check();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('alert', { name: '讲解未完成' })).toContainText('未通过本机安全检查');
  await expect(page.getByLabel('想问微光指引的问题')).toHaveValue('这张图怎么操作？');
  await expect(consent).not.toBeChecked();
  await chooseImage(page);
  await expect(consent).not.toBeChecked();
  await expect(page.getByRole('alert', { name: '讲解未完成' })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('image-request-count'))).toBe('1');
});

test('停止后取消图片接口，保留草稿，迟到回答不覆盖停止状态', async ({ page }) => {
  await installFixture(page, 'pending');
  await chooseImage(page);
  await page.getByLabel('想问微光指引的问题').fill('这张图怎么操作？');
  await page.getByRole('checkbox', { name: '仅本次允许发送检查通过的脱敏图片' }).check();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('image-request-count'))).toBe('1');
  await page.getByRole('button', { name: '停止讲解', exact: true }).click();
  await expect(page.locator('.message.assistant[data-state="stopped"]')).toBeVisible();
  await expect(page.getByLabel('想问微光指引的问题')).toHaveValue('这张图怎么操作？');
  await expect(page.locator('.message.assistant')).not.toContainText('迟到结果');
  expect(await page.evaluate(() => sessionStorage.getItem('image-cancelled'))).toBe('true');
  await expect(page.locator('.media-preview')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '仅本次允许发送检查通过的脱敏图片' })).not.toBeChecked();
});

test('带图文字问题不自动生成学习笔记', async ({ page }) => {
  await installFixture(page, 'ready');
  await chooseImage(page);
  await page.getByLabel('想问微光指引的问题').fill('怎么按图调整字号？');
  await page.getByRole('checkbox', { name: '仅本次允许发送检查通过的脱敏图片' }).check();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.locator('.message.assistant[data-state="completed"]')).toContainText('合成接口回执');
  await page.goto('/#/notes');
  await expect(page.getByRole('main')).not.toContainText('怎么按图调整字号？');
  await expect(page.getByRole('main')).not.toContainText('合成接口回执');
});

test('移除正在处理的图片也会取消，不恢复迟到结果', async ({ page }) => {
  await installFixture(page, 'pending');
  await chooseImage(page);
  await page.getByRole('checkbox', { name: '仅本次允许发送检查通过的脱敏图片' }).check();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('image-request-count'))).toBe('1');
  await page.getByRole('button', { name: '移除图片', exact: true }).click();
  await expect(page.locator('.media-preview')).toHaveCount(0);
  await expect(page.locator('.message.assistant[data-state="stopped"]')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('image-cancelled'))).toBe('true');
});

test('拒绝 SVG、GIF 和空文件，原有附件不会被无效文件替换', async ({ page }) => {
  await installFixture(page, 'ready');
  await chooseImage(page);
  for (const [name, mimeType, buffer] of [['vector.svg', 'image/svg+xml', Buffer.from('<svg/>')], ['empty.png', 'image/png', Buffer.alloc(0)]] as const) {
    await page.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });
    await expect(page.locator('.media-preview')).toContainText('合成设置图.png');
  }
});
