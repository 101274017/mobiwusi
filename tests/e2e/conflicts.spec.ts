import { expect, test } from '@playwright/test';

test('笔记冲突刷新保留草稿，逐项比较后明确选择本机版本', async ({ page }) => {
  await page.goto('/#/notes/demo-note-font?scenario=version-conflict');
  await page.getByRole('button', { name: '我确认已经掌握' }).click();
  await page.getByRole('button', { name: '确认更改状态' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('草稿已保留');
  await page.getByRole('button', { name: '关闭窗口' }).click();
  await expect(page.getByText('还想再练练', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: '比较并选择冲突内容' }).click();
  await expect(page.getByRole('heading', { name: '逐项核对，不替你决定' })).toBeVisible();
  await expect(page.getByRole('region', { name: '本机未保存草稿' })).toContainText('本人确认已掌握');
  await expect(page.getByRole('region', { name: '另一份模拟版本' })).toContainText('还想再练练');
  await expect(page.getByRole('button', { name: '核对选择并继续' })).toBeDisabled();
  await page.getByRole('radio', { name: '保留本机草稿（生成更高演示版本）' }).check();
  await page.getByRole('button', { name: '核对选择并继续' }).click();
  await page.getByRole('button', { name: '返回比较', exact: true }).click();
  await expect(page.getByRole('heading', { name: '把手机字体调大', level: 2, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '核对选择并继续' }).click();
  await page.getByRole('button', { name: '确认保留所选内容' }).click();
  await expect(page.getByRole('heading', { name: '没有待处理的冲突草稿' })).toBeVisible();
  await page.goto('/#/notes/demo-note-font');
  await expect(page.getByText('本人确认已掌握', { exact: true })).toBeVisible();
});

test('待办时间确认后失败保稿，采用另一版本不会误报云同步', async ({ page }) => {
  await page.goto('/#/todos?scenario=version-conflict');
  await page.getByRole('button', { name: '添加提醒', exact: true }).click();
  await page.getByLabel('提醒标题', { exact: true }).fill('本机待办草稿');
  await page.getByLabel('什么时候提醒').fill('2026-12-01T09:00');
  await page.getByRole('button', { name: '下一步：核对提醒时间' }).click();
  await page.getByRole('button', { name: '确认这个时间并保存' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('草稿已保留');
  await page.getByRole('button', { name: '关闭窗口' }).click();
  await page.getByRole('link', { name: '比较并选择冲突内容' }).click();
  await expect(page.getByRole('region', { name: '本机未保存草稿' })).toContainText('本机待办草稿');
  await page.getByRole('radio', { name: '采用另一份模拟版本（放弃这份草稿）' }).check();
  await page.getByRole('button', { name: '核对选择并继续' }).click();
  await page.getByRole('button', { name: '确认保留所选内容' }).click();
  await expect(page.getByRole('heading', { name: '没有待处理的冲突草稿' })).toBeVisible();
  await page.getByRole('link', { name: '查看待办', exact: true }).click();
  await expect(page.getByRole('heading', { name: '另一处演示版本：本机待办草稿', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
