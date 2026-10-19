import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { createWindowsLocalSpeech } = createRequire(import.meta.url)('../../apps/desktop/voice/windows-local-speech.cjs');
type Packet = { token: string; op: string; text?: string };

function fixture() {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() });
  let packet: Packet;
  child.stdin.on('data', chunk => { packet = JSON.parse(chunk.toString()); });
  const spawn = vi.fn(() => child);
  const speech = createWindowsLocalSpeech({ spawn, platform: 'win32', probeTimeoutMs: 1000 });
  const complete = (changes: Record<string, unknown> = {}) => {
    child.stdout.write(JSON.stringify({ token: packet.token, kind: 'complete', localOnly: true, culture: 'zh-CN', ...changes }));
    child.emit('close', 0);
  };
  return { child, spawn, speech, complete, packet: () => packet };
}

afterEach(() => vi.useRealTimers());

describe('本机中文朗读进程（不实际播放）', () => {
  it('构造不启动进程；无效输入、已取消和非 Windows 不播放', async () => {
    const current = fixture();
    expect(current.spawn).not.toHaveBeenCalled();
    await expect(current.speech.speak('')).rejects.toThrow('speech_request_invalid');
    await expect(current.speech.probe({ signal: AbortSignal.abort() })).rejects.toThrow('speech_cancelled');
    await expect(createWindowsLocalSpeech({ platform: 'linux', spawn: current.spawn }).probe()).rejects.toThrow('speech_windows_unavailable');
    expect(current.spawn).not.toHaveBeenCalled();
  });

  it('探测只传 probe，不携带朗读文字，等待真实退出才完成', async () => {
    const current = fixture();
    const pending = current.speech.probe();
    expect(current.packet()).toMatchObject({ op: 'probe' });
    expect(current.packet()).not.toHaveProperty('text');
    expect(current.spawn.mock.calls[0]).toMatchObject([expect.stringContaining('powershell.exe'), expect.arrayContaining(['-WindowStyle', 'Hidden', '-File']), { windowsHide: true, shell: false }]);
    current.complete();
    expect(await pending).toEqual({ status: 'complete', localOnly: true, culture: 'zh-CN', audioPlayed: false });
    expect(current.speech.snapshot().active).toBe(false);
  });

  it('文本经标准输入传递，不进入命令行，不允许并发朗读', async () => {
    const current = fixture();
    const pending = current.speech.speak('这是一段合成测试文字');
    expect(current.packet()).toMatchObject({ op: 'speak', text: '这是一段合成测试文字' });
    expect(JSON.stringify(current.spawn.mock.calls)).not.toContain('这是一段合成测试文字');
    await expect(current.speech.speak('第二段')).rejects.toThrow('speech_busy');
    current.complete();
    expect((await pending).audioPlayed).toBe(true);
  });

  it('取消只请求终止，close 事件前不会假报已停止', async () => {
    const current = fixture();
    const pending = current.speech.speak('不应继续播放');
    const rejected = expect(pending).rejects.toThrow('speech_cancelled');
    let stopped = false;
    const stopping = current.speech.stop().then(() => { stopped = true; });
    await Promise.resolve();
    expect(current.child.kill).toHaveBeenCalledTimes(1);
    expect(stopped).toBe(false);
    expect(current.speech.snapshot().active).toBe(true);
    current.child.emit('close', 1);
    await stopping;
    await rejected;
    expect(stopped).toBe(true);
  });

  it.each([{ token: 'wrong' }, { localOnly: false }, { culture: 'en-US' }, { kind: 'error', reason: 'private-provider-message' }])('拒绝损坏或非本地结果 %j', async changes => {
    const current = fixture();
    const pending = current.speech.probe();
    current.complete(changes);
    await expect(pending).rejects.toThrow('speech_engine_unavailable');
  });

  it('超时会终止，但仍然等待 close', async () => {
    vi.useFakeTimers();
    const current = fixture();
    const pending = current.speech.probe();
    const rejected = expect(pending).rejects.toThrow('speech_timeout');
    await vi.advanceTimersByTimeAsync(1000);
    expect(current.child.kill).toHaveBeenCalled();
    expect(current.speech.snapshot().active).toBe(true);
    current.child.emit('close', 1);
    await rejected;
  });
});
