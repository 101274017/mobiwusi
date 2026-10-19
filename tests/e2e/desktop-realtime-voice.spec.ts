import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

type VoiceAuditWindow = Window & {
  syntheticVoice: { microphoneRequests: number; connects: number; stops: number; failures: number; trackStops: number; peerCloses: number;
    trackEnabled: boolean; sends: string[]; localControls: string[]; listeners: number; emit: (event: unknown) => void };
};

async function voiceFixture(page: Page, denied = false, withBridge = true, localMode = false) {
  await page.route('http://nuanban.test/**', async route => {
    const filename = new URL(route.request().url()).pathname.slice(1);
    if (!['realtime-voice.html', 'realtime-voice.css', 'realtime-voice.js', 'realtime-voice-session.js'].includes(filename)) return route.abort();
    await route.fulfill({ body: readFileSync(new URL('../../apps/desktop/' + filename, import.meta.url)),
      contentType: filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.css') ? 'text/css' : 'text/javascript' });
  });
  await page.addInitScript(({ denied, withBridge, localMode }) => {
    const audit = { microphoneRequests: 0, connects: 0, stops: 0, failures: 0, trackStops: 0, peerCloses: 0, trackEnabled: true, sends: [] as string[], localControls: [] as string[], listeners: 0, emit: (_event: unknown) => {} };
    Object.defineProperty(window, 'syntheticVoice', { value: audit });
    const track = { kind: 'audio', get enabled() { return audit.trackEnabled; }, set enabled(value: boolean) { audit.trackEnabled = value; },
      onended: null, stop() { audit.trackStops++; } };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] };
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => { audit.microphoneRequests++; if (denied) throw new Error('NotAllowedError'); return stream; } } });
    Object.defineProperty(window, 'RTCPeerConnection', { value: class {
      connectionState = 'new';
      localDescription = { sdp: 'synthetic-audio-offer' };
      channel = { readyState: 'open', onopen: null as (() => void) | null, onmessage: null as ((event: { data: string }) => void) | null,
        onclose: null, onerror: null, close() {}, send(message: string) { audit.sends.push(message); } };
      addTrack() {}
      createDataChannel() { audit.emit = event => this.channel.onmessage?.({ data: JSON.stringify(event) }); return this.channel; }
      async createOffer() { return { type: 'offer', sdp: this.localDescription.sdp }; }
      async setLocalDescription() {}
      async setRemoteDescription() { this.channel.onopen?.(); }
      close() { audit.peerCloses++; }
    } });
    HTMLMediaElement.prototype.play = async () => {};
    HTMLMediaElement.prototype.pause = () => {};
    if (withBridge) Object.defineProperty(window, 'nuanbanVoiceChat', { value: localMode ? {
      mode: async () => ({ mode: 'local' }),
      onEvent: (listener: (event: unknown) => void) => { audit.listeners++; audit.emit = listener; return () => { audit.listeners--; }; },
      localControl: async (action: string) => {
        audit.localControls.push(action);
        audit.emit({ type: 'state', state: action === 'mute' ? 'muted' : 'listening' });
        return { muted: action === 'mute' };
      },
      stop: async () => { audit.stops++; }, failed: async () => { audit.failures++; },
    } : {
      connect: async () => { audit.connects++; return { answer: 'synthetic-audio-answer' }; }, state: async () => true,
      stop: async () => { audit.stops++; }, failed: async () => { audit.failures++; },
    } });
  }, { denied, withBridge, localMode });
  await page.goto('http://nuanban.test/realtime-voice.html');
}

test('真实 DOM 中连续语音字幕只作文本显示，支持打断、静音和结束', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 480, height: 760 });
  await voiceFixture(page);
  await expect(page.getByText('我在听，你慢慢说')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as VoiceAuditWindow).syntheticVoice.microphoneRequests)).toBe(1);
  await page.evaluate(() => {
    const voice = (window as unknown as VoiceAuditWindow).syntheticVoice;
    voice.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'user-1', transcript: '今天心情不错' });
    voice.emit({ type: 'response.output_audio_transcript.delta', item_id: 'assistant-1', delta: '<img src=x onerror=alert(1)> 很高兴听到！' });
    voice.emit({ type: 'output_audio_buffer.started' });
  });
  await expect(page.getByText('今天心情不错')).toBeVisible();
  await expect(page.getByText('<img src=x onerror=alert(1)> 很高兴听到！')).toBeVisible();
  await expect(page.locator('#voice-transcripts img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '结束对话' })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('voice-conversation.png'), fullPage: true });
  await page.getByRole('button', { name: '打断暖暖' }).click();
  expect(await page.evaluate(() => (window as unknown as VoiceAuditWindow).syntheticVoice.sends.map(message => JSON.parse(message).type))).toEqual(['response.cancel', 'output_audio_buffer.clear']);
  await page.getByRole('button', { name: '静音麦克风' }).click();
  await expect(page.getByRole('button', { name: '恢复麦克风' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => (window as unknown as VoiceAuditWindow).syntheticVoice.trackEnabled)).toBe(false);
  await page.getByRole('button', { name: '恢复麦克风' }).click();
  await page.getByRole('button', { name: '结束对话' }).click();
  expect(await page.evaluate(() => {
    const audit = (window as unknown as VoiceAuditWindow).syntheticVoice;
    return { stopped: audit.stops, trackStops: audit.trackStops, peerCloses: audit.peerCloses, connects: audit.connects };
  })).toEqual({ stopped: 1, trackStops: 1, peerCloses: 1, connects: 1 });
});

test('麦克风被拒绝时结束会话，不创建语音供应请求或自动重连', async ({ page }) => {
  await voiceFixture(page, true);
  await expect.poll(() => page.evaluate(() => (window as unknown as VoiceAuditWindow).syntheticVoice.failures)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as VoiceAuditWindow).syntheticVoice.connects)).toBe(0);
});

test('脱离原生桌宠打开页面不会请求麦克风', async ({ page }) => {
  await voiceFixture(page, false, false);
  await expect(page.getByText(/请从独立桌宠的“面对面语音”入口打开/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as VoiceAuditWindow).syntheticVoice.microphoneRequests)).toBe(0);
});

test('低高度窗口中仍能直接点击结束，字幕在内部滚动', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 580 });
  await voiceFixture(page);
  await expect(page.getByText('我在听，你慢慢说')).toBeVisible();
  await page.evaluate(() => {
    const voice = (window as unknown as VoiceAuditWindow).syntheticVoice;
    for (let index = 0; index < 30; index++) voice.emit({ type: 'response.output_audio_transcript.done', item_id: 'line-' + index, transcript: '这是一段只在当前窗口显示的合成字幕。'.repeat(8) });
  });
  await expect(page.getByRole('button', { name: '结束对话' })).toBeInViewport();
  expect(await page.locator('#voice-transcripts').evaluate(list => list.scrollHeight > list.clientHeight)).toBe(true);
  await page.getByRole('button', { name: '结束对话' }).click();
});

test('无额外语音账号时使用本地模式，不创建云端音轨，字幕与控制可用', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 480, height: 760 });
  await voiceFixture(page, false, true, true);
  await expect(page.getByText('我在听，你慢慢说')).toBeVisible();
  await expect(page.locator('#voice-privacy-note')).toContainText('无需另开语音账号');
  expect(await page.evaluate(() => {
    const audit = (window as unknown as VoiceAuditWindow).syntheticVoice;
    return { microphones: audit.microphoneRequests, connects: audit.connects, controls: audit.localControls };
  })).toEqual({ microphones: 0, connects: 0, controls: ['start'] });
  await page.evaluate(() => {
    const audit = (window as unknown as VoiceAuditWindow).syntheticVoice;
    audit.emit({ type: 'transcript', id: 'local-user', role: 'user', text: '今天想和暖暖聊聊天' });
    audit.emit({ type: 'transcript', id: 'local-answer', role: 'assistant', text: '<img src=x onerror=alert(1)> 我在这里。' });
    audit.emit({ type: 'state', state: 'speaking' });
  });
  await expect(page.getByText('今天想和暖暖聊聊天')).toBeVisible();
  await expect(page.locator('#voice-transcripts img')).toHaveCount(0);
  await expect(page.locator('#voice-prompt')).toContainText('朗读时暂停听写');
  await page.getByRole('button', { name: '打断暖暖' }).click();
  await expect(page.getByText('我在听，你慢慢说')).toBeVisible();
  await page.getByRole('button', { name: '静音麦克风' }).click();
  await expect(page.getByRole('button', { name: '恢复麦克风' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '恢复麦克风' }).click();
  await expect(page.getByText('我在听，你慢慢说')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('local-voice-conversation.png'), fullPage: true });
  await page.getByRole('button', { name: '结束对话' }).click();
  expect(await page.evaluate(() => {
    const audit = (window as unknown as VoiceAuditWindow).syntheticVoice;
    return { listeners: audit.listeners, stops: audit.stops, failures: audit.failures, controls: audit.localControls };
  })).toEqual({ listeners: 0, stops: 1, failures: 0, controls: ['start', 'interrupt', 'mute', 'unmute'] });
});

test('本地模式在低高度窗口中仍可结束，且无需Renderer麦克风权限', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 580 });
  await voiceFixture(page, true, true, true);
  await expect(page.getByText('我在听，你慢慢说')).toBeVisible();
  await expect(page.getByRole('button', { name: '结束对话' })).toBeInViewport();
  expect(await page.evaluate(() => (window as unknown as VoiceAuditWindow).syntheticVoice.microphoneRequests)).toBe(0);
  await page.getByRole('button', { name: '结束对话' }).click();
});
