import { expect, test } from '@playwright/test';

test('儿童社区认领缺监护核验不能继续，完成也不是登录成功', async ({ page }) => {
  await page.goto('/#/onboarding/login');
  await page.getByLabel('被开通者', { exact: true }).selectOption('child');
  await page.getByRole('radio', { name: /社区批次中的本人认领/ }).check();
  await page.getByRole('checkbox', { name: '模拟协助者已认证且具备开通权限' }).check();
  await page.getByRole('checkbox', { name: '已阅读：只演练流程，不采集或认证真实身份' }).check();
  await page.getByRole('button', { name: '开始这条路径的演练' }).click();
  await expect(page.getByRole('heading', { name: '等待本人或有效监护人确认' })).toBeVisible();
  await page.getByRole('checkbox', { name: '由模拟监护人明确确认本次认领与用途' }).check();
  await page.getByRole('button', { name: '确认本次模拟认领' }).click();
  await expect(page.getByRole('alert')).toContainText('监护关系核验');
  await page.getByRole('checkbox', { name: '模拟有效监护关系已核验（不是实际核验）' }).check();
  await page.getByRole('button', { name: '确认本次模拟认领' }).click();
  await expect(page.getByRole('heading', { name: '模拟流程结束 · 仍是本机演示' })).toBeVisible();
  await expect(page.getByText('Mock · authenticated: false', { exact: true })).toBeVisible();
  await expect(page.locator('input[type="text"], input[type="password"], video')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Windows 无本机号码入口，陌生人脸不自动绑定；可安全改走家属路径', async ({ page }) => {
  await page.goto('/#/onboarding/login');
  await page.getByLabel('演示设备', { exact: true }).selectOption('windows');
  await expect(page.getByRole('radio', { name: /本机号码一键登录/ })).toBeDisabled();
  await page.getByRole('radio', { name: /已登记账号的人脸登录/ }).check();
  await page.getByRole('checkbox', { name: '已阅读：只演练流程，不采集或认证真实身份' }).check();
  await page.getByRole('button', { name: '开始这条路径的演练' }).click();
  await expect(page.getByRole('alert')).toContainText('不能用陌生人脸');
  await page.getByRole('radio', { name: /家属协助开通与认领/ }).check();
  await page.getByRole('checkbox', { name: '模拟协助者已认证且具备开通权限' }).check();
  await page.getByRole('button', { name: '按当前条件重新演练' }).click();
  await expect(page.getByRole('heading', { name: '等待本人或有效监护人确认' })).toBeVisible();
  await page.getByRole('button', { name: '演示认领到期' }).click();
  await expect(page.getByRole('heading', { name: '本次演示已过期' })).toBeVisible();
  await expect(page.getByRole('button', { name: '确认本次模拟认领' })).toHaveCount(0);
});

test('校验中停止隔离迟到结果，刷新不恢复认领或发放会话', async ({ page }) => {
  await page.goto('/#/onboarding/login');
  await page.getByRole('radio', { name: /已绑定设备免密登录/ }).check();
  await page.getByRole('checkbox', { name: '使用合成的已登记账号绑定（不是建立真实绑定）' }).check();
  await page.getByRole('checkbox', { name: '已阅读：只演练流程，不采集或认证真实身份' }).check();
  await page.getByRole('button', { name: '开始这条路径的演练' }).click();
  await page.getByRole('button', { name: '停止本次认领演练' }).click();
  await page.waitForTimeout(650);
  await expect(page.getByRole('heading', { name: '本次演示已停止' })).toBeVisible();
  await expect(page.getByRole('button', { name: '确认本次模拟认领' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '选择演示路径' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => /token|session|auth/i.test(key)))).toEqual([]);
});
