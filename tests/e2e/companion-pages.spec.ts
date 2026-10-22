import { expect, test } from '@playwright/test';

test('伙伴收藏分别打开小鹿和小猫的独立页面，手机浏览器可显示页面陪伴', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/pets');
  const collection = page.getByRole('region', { name: '小鹿与小猫伙伴收藏' });
  await expect(collection.getByRole('link')).toHaveCount(2);
  await collection.getByRole('link', { name: /认识小鹿栗栗/ }).click();
  await expect(page).toHaveURL(/#\/pets\/lili$/);
  await expect(page.getByRole('heading', { name: '小鹿栗栗', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '栗栗 Lili' })).toContainText('栗栗目前不是 3D 模型');
  const liliButton = page.getByRole('button', { name: '在本页显示栗栗', exact: true });
  await expect(liliButton).toBeEnabled();
  await liliButton.click();
  await page.getByRole('button', { name: '确认在本页显示栗栗', exact: true }).click();
  await expect(page.locator('[aria-label="网页陪伴：栗栗"]')).toContainText('栗栗在这里陪你');
  await expect(page.getByRole('status')).toContainText('栗栗已显示在当前页面');
  await page.getByRole('button', { name: '关闭页面陪伴', exact: true }).click();
  await expect(page.locator('[aria-label="网页陪伴：栗栗"]')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '露米 Lumi' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: test.info().outputPath('lili-page.png'), fullPage: true });
  await page.getByRole('navigation', { name: '选择伙伴详情' }).getByRole('link', { name: /小猫露米/ }).click();
  await expect(page).toHaveURL(/#\/pets\/lumi$/);
  await expect(page.getByRole('region', { name: '露米 Lumi' })).toBeVisible();
  await expect(page.getByRole('region', { name: '栗栗 Lili' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '在本页显示露米', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: '返回伙伴收藏' }).click();
  await expect(collection).toBeVisible();
  expect(await page.evaluate(() => window.nuanbanCompanion)).toBeUndefined();
  expect(await page.evaluate(() => window.nuanbanModel)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('小鹿独立页确认后才调用原生桥，失败可重试且不伪报成功', async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0;
    window.nuanbanCompanion = {
      async showLili() {
        calls++;
        sessionStorage.setItem('lili-detail-calls', String(calls));
        if (calls === 1) throw new Error('测试角色资源读取失败');
        return { id: 'lili', version: '1.0.0' };
      },
    };
  });
  await page.goto('/#/pets/lili');
  expect(await page.evaluate(() => sessionStorage.getItem('lili-detail-calls'))).toBeNull();
  await page.getByRole('button', { name: '请栗栗到桌面', exact: true }).click();
  await page.getByRole('button', { name: '先不更换', exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('lili-detail-calls'))).toBeNull();
  await page.getByRole('button', { name: '请栗栗到桌面', exact: true }).click();
  await page.getByRole('button', { name: '确认切换并显示栗栗', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('测试角色资源读取失败');
  await expect(page.getByText('栗栗 1.0.0 已切换并显示在桌面。', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '确认切换并显示栗栗', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('栗栗 1.0.0 已切换并显示在桌面。');
  expect(await page.evaluate(() => sessionStorage.getItem('lili-detail-calls'))).toBe('2');
});
