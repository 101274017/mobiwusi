import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { _electron } from 'playwright';
import { expect } from '@playwright/test';

const workspace = path.resolve(import.meta.dirname, '..');
const output = path.join(workspace, '.cache', 'xingyun-avatar-check-' + Date.now());
await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url);
const defaultPet = require('../apps/desktop/default-pet.json');
const electronDirectory = path.dirname(require.resolve('electron/package.json'));
const electronVersion = require('electron/package.json').version;
const executablePath = [path.join(electronDirectory, 'dist', 'electron.exe'),
  path.join(workspace, 'apps', 'desktop', 'node_modules', 'electron', 'dist', 'electron.exe'),
  path.join(workspace, 'node_modules', '.pnpm', 'electron@' + electronVersion, 'node_modules', 'electron', 'dist', 'electron.exe')].find(existsSync);
assert(executablePath && existsSync(executablePath), 'Install the pinned Electron runtime first');
const live = process.argv.includes('--live');
const synthetic = process.argv.includes('--simulate');
const checks = [];
const pageErrors = [];
const failedRequests = [];
const application = await _electron.launch({ executablePath, args: [path.join(workspace, 'tests/helpers/xingyun-avatar-electron-smoke.cjs')],
  env: { ...process.env, NUANBAN_SMOKE_USER_DATA: output, NUANBAN_AVATAR_SMOKE_SYNTHETIC: synthetic ? '1' : '' }, timeout: 30000 });
application.on('window', page => {
  page.on('pageerror', error => pageErrors.push(error.name));
  page.on('requestfailed', request => {
    let host;
    try { host = new URL(request.url()).hostname; } catch { return; }
    if (host && failedRequests.length < 100) failedRequests.push({ host, resourceType: request.resourceType(), error: request.failure()?.errorText?.match(/^net::ERR_[A-Z_]+/)?.[0] ?? 'request_failed' });
  });
});
let liveOutcome;
let cleanup;
let pet;
try {
  await expect.poll(async () => (await application.windows()).filter(page => page.url().endsWith('/pet.html')).length, { timeout: 20000 }).toBe(1);
  pet = (await application.windows()).find(page => page.url().endsWith('/pet.html'));
  await pet.waitForLoadState('domcontentloaded');
  await pet.evaluate(() => {
    window.__avatarPolicyViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      let host;
      try { host = new URL(event.blockedURI).hostname; } catch { host = ['eval', 'wasm-eval', 'inline'].includes(event.blockedURI) ? event.blockedURI : 'other'; }
      if (window.__avatarPolicyViolations.length < 100) window.__avatarPolicyViolations.push({ directive: event.effectiveDirective, host });
    });
  });
  await expect.poll(() => pet.evaluate(() => Boolean(window.nuanbanAvatar))).toBe(true);
  const initial = await pet.evaluate(() => window.nuanbanAvatar.status());
  assert(!JSON.stringify(initial).includes('appSecret'));
  assert.equal(initial.autoReconnect, false);
  assert.equal(initial.microphoneActive, false);
  assert.equal(initial.defaultAvatarId, defaultPet.id);
  await expect(pet.locator('#builtin-pet')).toBeVisible();
  assert(await pet.locator('#builtin-pet').evaluate(image => image.naturalWidth > 0));
  await expect(pet.locator('#fallback-cat-pet')).toBeHidden();
  await expect(pet.locator('#avatar-display-state')).toHaveText('默认' + defaultPet.name + ' · 本地静态预览');
  await expect(pet.locator('#avatar-display-state')).toBeHidden();
  await expect(pet.locator('.dock-copy')).toBeHidden();
  checks.push('collapsed_pet_has_no_status_labels_or_shortcut_controls');
  await pet.screenshot({ path: path.join(output, 'default-pet.png') });
  checks.push('default_avatar_is_local_preview_without_cloud_connection');
  assert.equal((await application.evaluate(() => global.__avatarSmoke)).posts, 0);
  checks.push('no_cloud_session_screen_or_microphone_on_start');
  await pet.evaluate(() => window.nuanbanPet.openMain('/chat/new'));
  const client = (await application.windows()).find(page => /\/(ui|dist)\/index.html/.test(page.url()));
  assert(client);
  await expect(client.getByRole('navigation', { name: '主要导航', exact: true })).toBeVisible();
  const draft = '客户端草稿保持不变：' + defaultPet.name + '仅替换桌宠形象';
  await client.locator('#question').fill(draft);
  const clientUrl = client.url();
  await pet.locator('#pet-toggle').click();
  await pet.locator('#feature-avatar').click();
  await expect(pet.locator('#avatar-view')).toBeVisible();
  await expect(pet.locator('#avatar-display-state')).toBeVisible();
  await expect(pet.locator('#feature-home')).toBeHidden();
  await expect(pet.locator('#lesson-card')).toBeHidden();
  await expect(pet.locator('#avatar-start')).toBeDisabled();
  assert.equal((await application.evaluate(() => global.__avatarSmoke)).posts, 0);
  checks.push('dedicated_pet_page_requires_explicit_cloud_consent');
  await pet.screenshot({ path: path.join(output, 'avatar-page.png') });
  if (initial.configurationMismatch) {
    await expect(pet.locator('#avatar-application')).toHaveText('待切换至应用 · ' + defaultPet.application.editorId);
    await pet.locator('#avatar-consent').check();
    await expect(pet.locator('#avatar-start')).toBeDisabled();
    assert.equal((await application.evaluate(() => global.__avatarSmoke)).beginCalls, 0);
    checks.push('mismatched_application_blocked_without_cloud_session');
  }
  if (live || synthetic) {
    assert(initial.configured, 'Configure an encrypted Xingyun application before --live');
    await pet.locator('#avatar-consent').check();
    await pet.locator('#avatar-start').click();
    await expect.poll(() => pet.evaluate(async () => (await window.nuanbanAvatar.status()).phase), { timeout: 135000, intervals: [500, 1000, 2000] }).toMatch(/^(ready|error|cleanup_failed)$/);
    liveOutcome = await pet.evaluate(() => window.nuanbanAvatar.status());
    await writeFile(path.join(output, 'connection-diagnostic.json'), JSON.stringify({ live, synthetic, liveOutcome, audit: await application.evaluate(() => global.__avatarSmoke), failedRequests, policyViolations: await pet.evaluate(() => window.__avatarPolicyViolations) }, null, 2));
    await pet.screenshot({ path: path.join(output, 'live-result.png') });
    if (liveOutcome.phase === 'ready') {
      await expect(pet.locator('#xingyun-pet')).toBeVisible();
      assert(await pet.locator('#xingyun-canvas canvas').count() > 0);
      await pet.locator('#collapse-panel').click();
      await pet.waitForTimeout(1200);
      await pet.screenshot({ path: path.join(output, 'live-desktop-pet.png') });
      checks.push('real_cloud_session_and_rendered_avatar');
    }
    assert.equal((await application.evaluate(() => global.__avatarSmoke)).posts, 1);
    checks.push('single_session_attempt_without_auto_reconnect');
    const requestAudit = await application.evaluate(() => global.__avatarSmoke);
    assert.equal(requestAudit.sdkAudioFormats.length, 1);
    assert.equal(typeof requestAudit.sdkAudioFormats[0], 'boolean');
    assert.deepEqual(requestAudit.sessionRequests, [{ rawAudio: requestAudit.sdkAudioFormats[0], hasTag: false }]);
    checks.push('sdk_audio_format_preserved_without_custom_tag');
    cleanup = await pet.evaluate(() => window.nuanbanAvatar.stop());
    assert.equal(cleanup.stopped, true, 'Remote stop must be confirmed; inspect the Xingyun console if not');
    if (synthetic) {
      const failureAudit = await application.evaluate(() => global.__avatarSmoke);
      assert.equal(liveOutcome.phase, 'error');
      assert(liveOutcome.message.includes('1008'));
      assert.equal(failureAudit.beginCalls, 1);
      assert.equal(failureAudit.deletes, 1);
      assert.deepEqual(failureAudit.sessionCodes.map(({ method, code }) => ({ method, code })), [{ method: 'POST', code: 1008 }, { method: 'DELETE', code: 0 }]);
      checks.push('platform_1008_cleaned_up_once_without_reconnecting');
    }
    await expect(pet.locator('#xingyun-pet')).toBeHidden();
    await expect(pet.locator('#builtin-pet')).toBeVisible();
    checks.push('remote_session_stop_confirmed_and_local_pet_restored');
  }
  await expect(client).toHaveURL(clientUrl);
  await expect(client.locator('#question')).toHaveValue(draft);
  await expect(client.getByRole('navigation', { name: '主要导航', exact: true })).toBeVisible();
  assert.equal(await client.evaluate(() => typeof window.nuanbanAvatar), 'undefined');
  checks.push('client_route_draft_navigation_and_network_boundary_unchanged');
  const state = await pet.evaluate(() => window.nuanbanPet.snapshot());
  const audit = await application.evaluate(() => global.__avatarSmoke);
  assert.equal(state.observation.captureActive, false);
  assert.equal(state.wake.microphoneActive, false);
  assert.equal(state.voice.microphoneActive, false);
  assert.equal(audit.screenRequests, 0);
  assert.equal(pageErrors.length, 0, 'Renderer errors must be investigated');
  checks.push('no_screen_capture_microphone_or_renderer_errors');
  const report = { live, synthetic, checks, liveOutcome, cleanup, audit, pageErrors, failedRequests, policyViolations: await pet.evaluate(() => window.__avatarPolicyViolations) };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, ...report }, null, 2));
  if (live && liveOutcome.phase !== 'ready') process.exitCode = 2;
} finally {
  if (pet) {
    try {
      const finalStop = await pet.evaluate(() => window.nuanbanAvatar.stop());
      if (!finalStop.stopped) console.error('Xingyun remote stop remains unconfirmed; check the platform console.');
    } catch { console.error('Could not confirm final avatar cleanup from renderer.'); }
  }
  await application.close();
}
