import { expect, test } from '@playwright/test';
import type { LocalModel } from '../../apps/web/src/local-model';
import { createModelGlb } from '../fixtures/local-models';

test('浏览器只解释电脑端入口，不选择或上传模型', async ({ page }) => {
  const uploads: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') uploads.push(request.url()); });
  await page.goto('/#/pets');
  const panel = page.getByRole('region', { name: '让你的 3D 伙伴，来到桌面。' });
  await expect(panel.getByText('仅电脑客户端可用')).toBeVisible();
  await expect(panel.getByRole('button', { name: '选择本地 3D 模型' })).toBeDisabled();
  await expect(panel.getByRole('button', { name: '确认设为独立桌宠' })).toBeDisabled();
  await expect(panel.locator('input[type="file"]')).toHaveCount(0);
  expect(uploads).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('模拟原生桥：真实旋转预览后才确认应用，并可切回原画', async ({ page }) => {
  await page.addInitScript(({ bytes }) => {
    const candidate = { token: 'preview-token', id: 'model-fixture', fileName: '本机伙伴.glb', format: 'glb' as const, bytes: new Uint8Array(bytes),
      summary: { triangles: 6, meshes: 1, bones: 0, animations: 0, decodedBytes: 200, textures: [] } };
    let state: LocalModel = { kind: 'none' };
    const listeners = new Set<(model: LocalModel) => void>();
    window.nuanbanModel = {
      read: async () => state,
      choose: async () => candidate,
      apply: async token => {
        if (token !== candidate.token) throw new Error('无效预览');
        state = { ...candidate, kind: 'model', updatedAt: new Date().toISOString() };
        for (const listener of listeners) listener(state);
        return state;
      },
      clear: async () => { state = { kind: 'none' }; for (const listener of listeners) listener(state); return state; },
      discard: async () => true,
      onChanged: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    };
  }, { bytes: Array.from(createModelGlb()) });
  await page.goto('/#/pets');
  const panel = page.getByRole('region', { name: '让你的 3D 伙伴，来到桌面。' });
  await panel.getByRole('button', { name: '选择本地 3D 模型' }).click();
  await expect(panel.locator('canvas')).toBeVisible();
  await expect(panel.getByRole('button', { name: '确认设为独立桌宠' })).toBeEnabled();
  expect(await page.evaluate(() => window.nuanbanModel!.read())).toEqual({ kind: 'none' });
  await expect(panel.getByText('此模型只作静态 3D 展示，不会伪装成已生成可动桌宠。')).toBeVisible();
  await panel.getByRole('button', { name: '确认设为独立桌宠' }).click();
  await expect(panel.getByText('当前独立桌宠：本机伙伴.glb')).toBeVisible();
  await panel.getByRole('button', { name: '切回原画 / 内置桌宠' }).click();
  await page.getByRole('button', { name: '确认切回', exact: true }).click();
  await expect(panel.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => window.nuanbanModel!.read())).toEqual({ kind: 'none' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
