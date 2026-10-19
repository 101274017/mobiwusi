import { expect, test } from '@playwright/test';

test('账号服务未接通时移除模拟登录、认领和身份采集', async ({ page }) => {
  await page.goto('/#/onboarding/login');
  await expect(page.getByRole('heading', { name: '账号认证尚未接通' })).toBeVisible();
  await expect(page.locator('input[type="text"], input[type="password"], input[type="checkbox"], video')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /演练|模拟|认领/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '账号认证尚未接通' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => /token|session|auth/i.test(key)))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('家属与远程协助未接通，不通过勾选冒充授权或连接', async ({ page }) => {
  await page.goto('/#/family');
  await expect(page.getByRole('heading', { name: '当前没有可用的家属服务' })).toBeVisible();
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
  await page.goto('/#/assist/synthetic-id');
  await expect(page.getByRole('heading', { name: '远程协助尚未接通' })).toBeVisible();
  await expect(page.getByRole('button', { name: /接听|共享|重连|邀请/ })).toHaveCount(0);
});
