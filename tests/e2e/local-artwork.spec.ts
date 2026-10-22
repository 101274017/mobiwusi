import { expect, test, type Page } from '@playwright/test';

async function drawStroke(page: Page) {
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('画布不可用');
  await page.mouse.move(bounds.x + 40, bounds.y + 45);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 140, bounds.y + 45, { steps: 8 });
  await page.mouse.up();
}

async function saveAndPreview(page: Page) {
  await page.getByRole('button', { name: '保存本机草稿' }).click();
  await expect(page.getByRole('status')).toContainText('原始画稿已保存在本机');
  await page.getByRole('button', { name: '预览原画桌宠' }).click();
  await expect(page.getByRole('dialog', { name: '原画桌宠预览' })).toBeVisible();
}

async function installBridgeFixture(page: Page) {
  await page.addInitScript(() => {
    const key = 'test-local-artwork';
    window.nuanbanArtwork = {
      read: async () => JSON.parse(localStorage.getItem(key) ?? '{"kind":"builtin"}'),
      apply: async artwork => {
        if (localStorage.getItem('test-artwork-write-failed')) throw new Error('本机原画写入失败，请重试。');
        const state = { kind: 'drawing' as const, ...artwork, updatedAt: new Date().toISOString() };
        localStorage.setItem(key, JSON.stringify(state));
        return state;
      },
      clear: async () => { localStorage.removeItem(key); return { kind: 'builtin' as const }; },
      onChanged: () => () => undefined,
    };
  });
}

test('浏览器可保存、透明预览并显示页面原画，不冒充系统桌宠', async ({ page }) => {
  await page.goto('/#/pets/draw');
  await expect(page.getByRole('button', { name: '保存本机草稿' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '预览原画桌宠' })).toBeDisabled();
  await drawStroke(page);
  await saveAndPreview(page);
  await expect(page.getByRole('button', { name: '在本页显示原画', exact: true })).toBeEnabled();
  const pixels = await page.getByAltText('你的原画桌宠预览，透明背景').evaluate(async element => {
    const image = element as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return { width: canvas.width, height: canvas.height, cornerAlpha: data[3], visible: data.some((value, index) => index % 4 === 3 && value > 0) };
  });
  expect(pixels.width).toBeLessThan(800);
  expect(pixels.height).toBeLessThan(480);
  expect(pixels.cornerAlpha).toBe(0);
  expect(pixels.visible).toBe(true);
  await page.getByRole('button', { name: '在本页显示原画', exact: true }).click();
  await expect(page.locator('[aria-label="网页陪伴：你的原画"]')).toContainText('你的原画在这里陪你');
  await expect(page.locator('[aria-label="网页陪伴：你的原画"]')).toContainText('不会替换系统桌宠');
  await page.getByRole('button', { name: '关闭页面陪伴', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '预览原画桌宠' })).toBeEnabled();
});

test('本地桥接模拟：确认前不替换，确认后持久化并可恢复内置', async ({ page }) => {
  await installBridgeFixture(page);
  const posts: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
  await page.goto('/#/pets/draw');
  await expect(page.getByRole('button', { name: '保存本机草稿' })).toBeEnabled();
  await drawStroke(page);
  await saveAndPreview(page);
  expect(await page.evaluate(() => localStorage.getItem('test-local-artwork'))).toBeNull();
  await page.getByRole('button', { name: '直接设为桌宠', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByAltText('当前悬浮桌宠原画')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('已直接设为桌宠');
  await page.reload();
  await expect(page.getByAltText('当前悬浮桌宠原画')).toBeVisible();
  await drawStroke(page);
  await expect(page.getByRole('button', { name: '预览原画桌宠' })).toBeDisabled();
  await page.getByRole('button', { name: '恢复内置桌宠' }).click();
  await expect(page.getByAltText('当前悬浮桌宠原画')).toHaveCount(0);
  await page.reload();
  await expect(page.getByAltText('当前悬浮桌宠原画')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeEnabled();
  expect(posts).toEqual([]);
});

test('擦除全部笔画后不能应用空白原画', async ({ page }) => {
  await page.goto('/#/pets/draw');
  await expect(page.getByRole('button', { name: '保存本机草稿' })).toBeEnabled();
  await drawStroke(page);
  await page.getByRole('button', { name: '橡皮', exact: true }).click();
  await page.getByLabel('画笔粗细').selectOption('18');
  await drawStroke(page);
  await page.getByRole('button', { name: '保存本机草稿' }).click();
  await page.getByRole('button', { name: '预览原画桌宠' }).click();
  await expect(page.getByRole('status')).toContainText('没有可见笔画');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('本地桥接模拟：应用失败保留预览与原稿，可再次确认重试', async ({ page }) => {
  await installBridgeFixture(page);
  await page.goto('/#/pets/draw');
  await expect(page.getByRole('button', { name: '保存本机草稿' })).toBeEnabled();
  await drawStroke(page);
  await saveAndPreview(page);
  await page.evaluate(() => localStorage.setItem('test-artwork-write-failed', '1'));
  await page.getByRole('button', { name: '直接设为桌宠', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('写入失败');
  await expect(page.getByRole('dialog', { name: '原画桌宠预览' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('test-local-artwork'))).toBeNull();
  await page.evaluate(() => localStorage.removeItem('test-artwork-write-failed'));
  await page.getByRole('button', { name: '直接设为桌宠', exact: true }).click();
  await expect(page.getByAltText('当前悬浮桌宠原画')).toBeVisible();
});
