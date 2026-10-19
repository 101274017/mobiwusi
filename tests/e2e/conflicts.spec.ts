import { expect, test } from '@playwright/test';

test('冲突页为空时不会制造另一份版本', async ({ page }) => {
  await page.goto('/#/sync/conflicts');
  await expect(page.getByRole('heading', { name: '没有待处理的冲突草稿' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '核对选择并继续' })).toHaveCount(0);
});

test('旧版本冲突参数不再制造假笔记或冲突', async ({ page }) => {
  await page.goto('/?scenario=version-conflict#/notes');
  await expect(page.getByRole('heading', { name: '这里还没有笔记' })).toBeVisible();
  await page.goto('/?scenario=version-conflict#/sync/conflicts');
  await expect(page.getByRole('heading', { name: '没有待处理的冲突草稿' })).toBeVisible();
  await expect(page.locator('.conflict-card')).toHaveCount(0);
});
