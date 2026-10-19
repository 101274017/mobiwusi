import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { _electron } from 'playwright';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const petPresentation = process.argv.includes('--pet');
const output = path.join(workspace, '.cache', 'desktop-voice-loopback-' + Date.now());
await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url);
const version = require('electron/package.json').version;
const executablePath = [path.join(path.dirname(require.resolve('electron/package.json')), 'dist', 'electron.exe'),
  path.join(workspace, 'node_modules', '.pnpm', 'electron@' + version, 'node_modules', 'electron', 'dist', 'electron.exe')].find(existsSync);
assert(executablePath, 'Use the installed Electron binary; never download during smoke');
const errors = [];
const application = await _electron.launch({ executablePath, args: [path.join(workspace, 'tests', 'helpers', 'desktop-voice-loopback.cjs')],
  env: { ...process.env, NUANBAN_VOICE_SMOKE_USER_DATA: output, NUANBAN_VOICE_SMOKE_PRESENTATION: petPresentation ? 'pet' : 'window' }, timeout: 30_000 });
application.on('window', window => window.on('pageerror', error => errors.push(error.message)));

try {
  let voice;
  for (let attempt = 0; attempt < 100; attempt++) {
    voice = (await application.windows()).find(window => window.url().endsWith('/realtime-voice.html'));
    if (voice) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(voice, 'Native voice window is created after synthetic consent');
  await voice.locator('#voice-prompt').filter({ hasText: '我在听，你慢慢说' }).waitFor({ state: 'visible', timeout: 25_000 });
  await voice.getByText('本机合成音频回环').waitFor({ state: 'visible' });
  await voice.getByText('虚拟音轨连通，不代表真实供应验收。').waitFor({ state: 'visible' });
  const connected = await application.evaluate(({ app }) => ({ snapshot: global.__nuanbanVoiceLoopback.host.snapshot(), audit: global.__nuanbanVoiceLoopback.audit,
    virtualInput: app.commandLine.hasSwitch('use-fake-device-for-media-stream') }));
  assert.equal(connected.virtualInput, true);
  assert.equal(connected.snapshot.microphoneActive, true);
  assert.equal(connected.audit.calls, 1);
  if (petPresentation) {
    const hidden = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(window => window !== global.__nuanbanVoiceLoopback.receiver).map(window => ({ visible: window.isVisible() })));
    assert.deepEqual(hidden, [{ visible: false }], 'Pet voice never shows a separate chat window');
    assert(connected.audit.transcripts.some(item => item.role === 'user' && item.text === '本机合成音频回环'));
    assert(connected.audit.transcripts.some(item => item.role === 'assistant' && item.text === '虚拟音轨连通，不代表真实供应验收。'));
  }
  const rtc = await application.evaluate(async () => global.__nuanbanVoiceLoopback.receiver.webContents.executeJavaScript('({ receivedTrack: window.syntheticReceivedTrack, channelOpened: window.syntheticChannelOpened, connectionState: window.syntheticVoicePeer.connectionState })'));
  assert.equal(rtc.receivedTrack, true);
  assert.equal(rtc.channelOpened, true);
  assert.equal(rtc.connectionState, 'connected');
  const endAlwaysVisible = await voice.locator('#end-voice').evaluate(button => {
    const bounds = button.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
  });
  assert.equal(endAlwaysVisible, true, 'End call stays inside the native viewport without scrolling');
  await voice.screenshot({ path: path.join(output, 'native-voice.png') });
  if (petPresentation) await application.evaluate(() => global.__nuanbanVoiceLoopback.host.control('mute'));
  else await voice.getByRole('button', { name: '静音麦克风' }).click();
  await voice.getByRole('button', { name: '恢复麦克风' }).waitFor({ state: 'visible' });
  if (petPresentation) {
    await application.evaluate(() => global.__nuanbanVoiceLoopback.host.control('unmute'));
    await voice.getByRole('button', { name: '静音麦克风' }).waitFor({ state: 'visible' });
    await application.evaluate(() => global.__nuanbanVoiceLoopback.host.control('interrupt'));
    await voice.locator('#voice-prompt').filter({ hasText: '我在听，你慢慢说' }).waitFor({ state: 'visible' });
  }
  const ended = voice.waitForEvent('close');
  if (petPresentation) await application.evaluate(() => global.__nuanbanVoiceLoopback.host.stop());
  else await voice.getByRole('button', { name: '结束对话' }).click().catch(() => {});
  await ended;
  const stopped = await application.evaluate(() => global.__nuanbanVoiceLoopback.host.snapshot());
  assert.equal(stopped.active, false);
  assert.equal(stopped.microphoneActive, false);
  assert.deepEqual(errors, []);
  const report = { generatedAt: new Date().toISOString(), evidence: 'real Electron, virtual microphone device and local RTC loopback only; no physical microphone or external supplier',
    passed: ['isolated_native_audio_permission', 'real_rtc_audio_track_and_data_channel', 'live_caption_rendering', 'end_always_visible', 'mute_control', 'end_destroys_audio_context',
      ...(petPresentation ? ['hidden_audio_host', 'pet_transcript_projection', 'pet_mute_unmute_interrupt_controls'] : [])],
    rtc, errors, realMicrophoneAccepted: false, realProviderAccepted: false };
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed.length, report: path.join(output, 'results.json'), screenshot: path.join(output, 'native-voice.png') }));
} finally {
  await application.close();
}
