import { expect, test } from '@playwright/test';

test('内置伙伴先预览确认再应用，刷新可撤回', async ({ page }) => {
  await page.goto('/#/pets');
  const preview = page.getByRole('region', { name: '桌宠微调预览' });
  await expect(page.getByRole('button', { name: '撤回上次应用' })).toBeDisabled();
  await page.getByRole('button', { name: '小白兔', exact: true }).click();
  await page.getByLabel('眼睛', { exact: true }).selectOption('happy');
  await page.getByLabel('嘴型', { exact: true }).selectOption('open');
  await page.getByLabel('动作姿态', { exact: true }).selectOption('greeting');
  await expect(preview.getByRole('img').first()).toHaveAttribute('aria-label', '小橘猫暖暖');
  await expect(preview.getByRole('img').last()).toHaveAttribute('aria-label', '小兔子暖暖');
  await page.getByRole('button', { name: '预览满意，确认应用' }).click();
  await page.getByRole('button', { name: '暂不更改', exact: true }).click();
  await expect(preview.getByRole('img').first()).toHaveAttribute('aria-label', '小橘猫暖暖');
  await page.getByRole('button', { name: '预览满意，确认应用' }).click();
  await page.getByRole('button', { name: '确认应用到本机' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(preview.getByRole('img').first()).toHaveAttribute('aria-label', '小兔子暖暖');
  await expect(preview.getByRole('img').first()).toHaveClass(/action-greeting/);
  await page.reload();
  await expect(page.getByRole('button', { name: '撤回上次应用' })).toBeEnabled();
  await page.getByRole('button', { name: '撤回上次应用' }).click();
  await page.getByRole('button', { name: '确认撤回', exact: true }).click();
  await expect(preview.getByRole('img').first()).toHaveAttribute('aria-label', '小橘猫暖暖');
  await expect(page.getByRole('button', { name: '撤回上次应用' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('未保存的微调可以放弃，保存冲突不替换伙伴', async ({ page }) => {
  await page.goto('/#/pets?scenario=version-conflict');
  await page.getByLabel('眼睛', { exact: true }).selectOption('happy');
  await page.getByRole('button', { name: '放弃预览，读取当前设置' }).click();
  await expect(page.getByLabel('眼睛', { exact: true })).toHaveValue('round');
  await page.getByRole('button', { name: '小白兔', exact: true }).click();
  await page.getByRole('button', { name: '预览满意，确认应用' }).click();
  const dialog = page.getByRole('dialog', { name: '确认应用内置桌宠微调？' });
  await dialog.getByRole('button', { name: '确认应用到本机' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '暂不更改', exact: true }).click();
  await expect(page.getByRole('region', { name: '桌宠微调预览' }).getByRole('img').first()).toHaveAttribute('aria-label', '小橘猫暖暖');
  await expect(page.getByRole('button', { name: '小白兔', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
