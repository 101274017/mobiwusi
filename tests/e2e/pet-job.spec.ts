import { expect, test, type Page } from '@playwright/test';

async function createJob(page: Page) {
  await page.goto('/#/pets/draw');
  await expect(page.getByRole('button', { name: '保存本机草稿' })).toBeEnabled();
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('画布不存在');
  await page.mouse.move(bounds.x + 30, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 100, bounds.y + 90, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: '演示生成任务流程' }).click();
  await expect(page.getByRole('heading', { name: '等待你启动演示' })).toBeVisible();
}

test('模拟任务须预览确认，刷新后不冒充生成桌宠', async ({ page }) => {
  await createJob(page);
  await page.getByRole('button', { name: '开始模拟处理' }).click();
  await expect(page.getByRole('heading', { name: '演示预览就绪 · 仅原画' })).toBeVisible();
  await expect(page.getByText('这是你的原始画稿，不是 AI 生成结果。')).toBeVisible();
  await page.getByRole('button', { name: '确认保留演示预览' }).click();
  await expect(page.getByRole('heading', { name: '已确认保留演示预览' })).toBeVisible();
  await expect(page.getByText('本机状态已保存，刷新后可继续。')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '已确认保留演示预览' })).toBeVisible();
  await expect(page.getByText('你已确认保留这份演示预览。没有生成可动桌宠，当前桌宠未替换。')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('模拟失败保留原稿，可以重新排队', async ({ page }) => {
  await createJob(page);
  await page.getByLabel('演示结果').selectOption('failure');
  await page.getByRole('button', { name: '开始模拟处理' }).click();
  await expect(page.getByRole('heading', { name: '模拟生成失败 · 画稿保留' })).toBeVisible();
  await page.getByRole('button', { name: '重新排队，不自动启动' }).click();
  await expect(page.getByRole('heading', { name: '等待你启动演示' })).toBeVisible();
  await page.getByRole('link', { name: '返回原始画稿', exact: true }).click();
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeEnabled();
  await expect(page.getByRole('link', { name: '查看最近演示任务' })).toBeVisible();
});

test('停止任务后迟到结果不复活，清空画布需确认', async ({ page }) => {
  await createJob(page);
  await page.getByRole('button', { name: '开始模拟处理' }).click();
  await page.getByRole('button', { name: '随时停止', exact: true }).click();
  await expect(page.getByRole('heading', { name: '演示任务已取消' })).toBeVisible();
  await page.waitForTimeout(1100);
  await expect(page.getByRole('heading', { name: '演示任务已取消' })).toBeVisible();
  await page.getByRole('link', { name: '返回原始画稿', exact: true }).click();
  await page.getByRole('button', { name: '清画布', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '清空当前画布？' })).toBeVisible();
  await page.getByRole('button', { name: '关闭窗口' }).click();
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeEnabled();
});

test('处理中刷新不自动继续任务，画稿不丢失', async ({ page }) => {
  await createJob(page);
  await page.getByRole('button', { name: '开始模拟处理' }).click();
  await expect(page.getByText('正在演示等待过程，可以随时取消。')).toBeVisible();
  await page.reload();
  await expect(page.getByText('上次处理未完成。不会在刷新后自动启动，请明确重新排队。')).toBeVisible();
  await page.waitForTimeout(1100);
  await expect(page.getByRole('heading', { name: '模拟任务处理中' })).toBeVisible();
  await expect(page.getByRole('button', { name: '确认保留演示预览' })).toHaveCount(0);
});
