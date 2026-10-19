import { expect, test } from '@playwright/test';
import { installTextBridge } from '../helpers/text-bridge';

test('设置页只显示服务状态，保留云端发送和图片单次确认说明', async ({ page }) => {
  await installTextBridge(page);
  await page.goto('/#/settings');
  const panel = page.getByRole('region', { name: '智能服务状态' });
  await expect(panel.getByRole('heading', { name: '智能服务', exact: true })).toBeVisible();
  await expect(panel.getByRole('status')).toHaveText('服务已配置。连接结果以实际请求为准。');
  await expect(panel).toContainText('已配置的云端服务');
  await expect(panel).toContainText('图片须单次确认并在本机检测脱敏后发送');
  expect(await page.evaluate(() => sessionStorage.getItem('text-request-count'))).toBeNull();
});

test('兼容旧状态返回时也不把模型、域名或密钥渲染到页面', async ({ page }) => {
  await page.addInitScript(() => {
    window.nuanbanTextQuestion = {
      status: async () => ({ available: true, model: 'synthetic-private-model', gateway: 'private-gateway.example.test', apiKey: 'synthetic-private-credential' }),
      answer: async input => ({ ok: false, requestId: input.requestId, code: 'PROVIDER_UNAVAILABLE', retryable: false }),
      cancel: async () => false,
    };
  });
  await page.goto('/#/settings');
  await expect(page.getByRole('region', { name: '智能服务状态' }).getByRole('status')).toHaveText('服务已配置。连接结果以实际请求为准。');
  for (const value of ['synthetic-private-model', 'private-gateway.example.test', 'synthetic-private-credential']) {
    await expect(page.locator('html')).not.toContainText(value);
    expect(await page.content()).not.toContain(value);
  }
});

test('没有桌面状态桥时明确不可用，不伪装连接成功', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('region', { name: '智能服务状态' }).getByRole('status')).toHaveText('服务未配置或暂不可用。不会使用固定回答或假装连接成功。');
});

test('状态异常不把内部报错或配置显示给用户', async ({ page }) => {
  await page.addInitScript(() => {
    window.nuanbanTextQuestion = {
      status: async () => { throw new Error('synthetic-private-provider-details'); },
      answer: async input => ({ ok: false, requestId: input.requestId, code: 'PROVIDER_UNAVAILABLE', retryable: false }),
      cancel: async () => false,
    };
  });
  await page.goto('/#/settings');
  await expect(page.getByRole('region', { name: '智能服务状态' }).getByRole('status')).toHaveText('服务未配置或暂不可用。不会使用固定回答或假装连接成功。');
  await expect(page.locator('html')).not.toContainText('synthetic-private-provider-details');
});
