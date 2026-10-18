import { expect, test } from '@playwright/test';

test('普通网页不能因同名消息对象取得 Android 宿主身份', async ({ page }) => {
  await page.addInitScript(() => {
    const messages: string[] = [];
    Object.defineProperty(window, 'syntheticNativeMessages', { value: messages });
    window.nuanbanBridge = { postMessage: message => { messages.push(message); } };
  });
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: /今天/ }).first()).toBeVisible();
  await page.getByRole('button', { name: '随时停止', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { syntheticNativeMessages: string[] }).syntheticNativeMessages)).toEqual([]);
});

test('模拟宿主停止失败时告知未确认，不产生未处理异常', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.nuanbanHost = { platform: 'windows', capabilities: async () => ({ platform: 'windows', externalCapture: false }), stopAll: async () => { throw new Error('synthetic stop failure'); } };
  });
  await page.goto('/#/');
  await page.getByRole('button', { name: '随时停止', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('原生停止未确认');
  expect(errors).toEqual([]);
});

test('模拟原生暂停事件会停止讲解，恢复页面也不自动续播', async ({ page }) => {
  await page.goto('/#/chat/new?scenario=loading');
  await page.getByLabel('想问暖伴的问题').fill('合成暂停问题');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('button', { name: '讲解中', exact: true })).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event('nuanban:host-pause')));
  await expect(page.locator('.caption')).toHaveText('已停止，本次讲解不会自动恢复。');
  await expect(page.locator('.message[data-state="stopped"]')).toHaveCount(1);
  await page.getByLabel('想问暖伴的问题').fill('我准备好后再发送');
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  await page.waitForTimeout(800);
  await expect(page.locator('.caption')).toHaveText('已停止，本次讲解不会自动恢复。');
});

for (const native of [true, false]) {
  test(native ? '原生能力关闭时只显示页面提醒，不越权调用系统通知' : '浏览器已授权通知仍可提醒，作为能力门控的正对照', async ({ page }) => {
    await page.clock.install({ time: new Date('2027-01-01T09:00:00Z') });
    await page.addInitScript(({ native }) => {
      const notifications: string[] = [];
      Object.defineProperty(window, 'syntheticNotifications', { value: notifications });
      Object.defineProperty(window, 'Notification', { configurable: true, value: class {
        static permission = 'granted';
        constructor(title: string) { notifications.push(title); }
      } });
      if (native) window.nuanbanHost = { platform: 'windows', capabilities: async () => ({ platform: 'windows' }), stopAll: async () => ({ stopped: true }) };
    }, { native });
    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: '你好，今天也有暖伴陪着你。' })).toBeVisible();
    await page.clock.runFor(16000);
    await expect(page.locator('.toast[role="status"]')).toContainText('复习时间到了');
    expect(await page.evaluate(() => (window as unknown as { syntheticNotifications: string[] }).syntheticNotifications)).toHaveLength(native ? 0 : 1);
  });
}
