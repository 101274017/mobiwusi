import { expect, test } from '@playwright/test';

test('画稿保留真实本机功能，不再提供模拟生成入口', async ({ page }) => {
  await page.goto('/#/pets/draw');
  await expect(page.getByRole('button', { name: '保存本机草稿' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '演示生成任务流程' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '查看最近演示任务' })).toHaveCount(0);
  await page.getByRole('button', { name: 'AI 生成（未接入）' }).click();
  await expect(page.getByRole('status')).toContainText('真实 AI 生成未接入');
});

test('旧任务链接不恢复假队列、进度或生成资产', async ({ page }) => {
  await page.goto('/#/pets/jobs/old-demo-job?outcome=success');
  await expect(page.getByRole('heading', { name: '桌宠生成服务尚未接通' })).toBeVisible();
  await expect(page.locator('progress')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /演示|重试生成|确认生成/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '桌宠生成服务尚未接通' })).toBeVisible();
});
