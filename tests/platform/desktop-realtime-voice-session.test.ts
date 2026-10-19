import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { createRealtimeVoiceSession } = createRequire(import.meta.url)('../../apps/desktop/realtime-voice-session.js');

function fixture() {
  const track = { kind: 'audio', enabled: true, onended: null as null | (() => void), stop: vi.fn() };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] };
  const channel = { readyState: 'open', onopen: null as null | (() => void), onmessage: null as null | ((event: { data: string }) => void),
    onclose: null as null | (() => void), onerror: null as null | (() => void), close: vi.fn(), send: vi.fn() };
  const peer = { connectionState: 'new', localDescription: { sdp: 'synthetic-offer' },
    ontrack: null as null | ((event: { track: typeof track; streams: typeof stream[] }) => void), onconnectionstatechange: null as null | (() => void),
    addTrack: vi.fn(), createDataChannel: vi.fn(() => channel), createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'synthetic-offer' })),
    setLocalDescription: vi.fn(async () => {}), setRemoteDescription: vi.fn(async () => {}), close: vi.fn() };
  const audio = { pause: vi.fn(), play: vi.fn(async () => {}), srcObject: null as unknown };
  const options = { audio, getUserMedia: vi.fn(async () => stream), createPeerConnection: vi.fn(() => peer), createMediaStream: vi.fn(() => stream),
    connect: vi.fn(async (_offer: string) => ({ answer: 'synthetic-answer' })), onState: vi.fn(), onTranscript: vi.fn(), onError: vi.fn(), onEnd: vi.fn() };
  const conversation = createRealtimeVoiceSession(options);
  const receive = (value: unknown) => channel.onmessage?.({ data: typeof value === 'string' ? value : JSON.stringify(value) });
  return { conversation, options, track, stream, peer, channel, audio, receive };
}

afterEach(() => { vi.useRealTimers(); });

describe('实时语音 WebRTC 会话（合成音轨，不开启系统麦克风）', () => {
  it('默认不请求音频，启动后仅采集麦克风且由服务提供 SDP', async () => {
    const current = fixture();
    expect(current.options.getUserMedia).not.toHaveBeenCalled();
    await current.conversation.start();
    expect(current.options.getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    expect(current.peer.addTrack).toHaveBeenCalledWith(current.track, current.stream);
    expect(current.options.connect).toHaveBeenCalledWith('synthetic-offer');
    expect(current.peer.setRemoteDescription).toHaveBeenCalledWith({ type: 'answer', sdp: 'synthetic-answer' });
    current.channel.onopen?.();
    expect(current.options.onState).toHaveBeenLastCalledWith('listening');
    current.conversation.stop();
  });

  it('支持连续轮次、实际音频播放状态和逐句字幕', async () => {
    const current = fixture();
    await current.conversation.start();
    current.channel.onopen?.();
    current.receive({ type: 'input_audio_buffer.speech_stopped' });
    expect(current.options.onState).toHaveBeenLastCalledWith('thinking');
    current.receive({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'user-1', transcript: '你好' });
    current.receive({ type: 'response.output_audio_transcript.delta', item_id: 'assistant-1', delta: '你好，' });
    current.receive({ type: 'response.output_audio_transcript.delta', item_id: 'assistant-1', delta: '我在。' });
    expect(current.options.onTranscript).toHaveBeenLastCalledWith({ id: 'assistant:assistant-1', role: 'assistant', text: '你好，我在。' });
    current.receive({ type: 'output_audio_buffer.started' });
    expect(current.options.onState).toHaveBeenLastCalledWith('speaking');
    current.receive({ type: 'response.done', response: { status: 'completed' } });
    expect(current.options.onState).toHaveBeenLastCalledWith('speaking');
    current.receive({ type: 'output_audio_buffer.stopped' });
    expect(current.options.onState).toHaveBeenLastCalledWith('listening');
    current.receive({ type: 'input_audio_buffer.speech_stopped' });
    expect(current.options.onState).toHaveBeenLastCalledWith('thinking');
    current.conversation.stop();
  });

  it('显式打断取消生成并清空尚未播放的音频，说话也可触发服务端打断', async () => {
    const current = fixture();
    await current.conversation.start();
    expect(current.conversation.interrupt()).toBe(false);
    current.receive({ type: 'output_audio_buffer.started' });
    expect(current.conversation.interrupt()).toBe(true);
    expect(current.channel.send.mock.calls.map(call => JSON.parse(call[0]))).toEqual([{ type: 'response.cancel' }, { type: 'output_audio_buffer.clear' }]);
    current.receive({ type: 'output_audio_buffer.started' });
    current.receive({ type: 'input_audio_buffer.speech_started' });
    expect(current.options.onState).toHaveBeenLastCalledWith('listening');
    current.conversation.stop();
  });

  it('静音关闭输入音轨并清空待处理音频，恢复后不新建会话', async () => {
    const current = fixture();
    await current.conversation.start();
    expect(current.conversation.setMuted(true)).toBe(true);
    expect(current.track.enabled).toBe(false);
    expect(current.options.onState).toHaveBeenLastCalledWith('muted');
    expect(current.channel.send).toHaveBeenCalledWith(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    current.receive({ type: 'output_audio_buffer.started' });
    expect(current.options.onState).toHaveBeenLastCalledWith('muted');
    current.conversation.setMuted(false);
    expect(current.track.enabled).toBe(true);
    expect(current.options.getUserMedia).toHaveBeenCalledTimes(1);
    current.conversation.stop();
  });

  it('结束时停止音轨、播放和 RTC，迟到消息不再更新界面', async () => {
    const current = fixture();
    await current.conversation.start();
    current.peer.ontrack?.({ track: current.track, streams: [current.stream] });
    expect(current.audio.srcObject).toBe(current.stream);
    const late = current.channel.onmessage!;
    current.conversation.stop();
    expect(current.track.stop).toHaveBeenCalled();
    expect(current.audio.pause).toHaveBeenCalled();
    expect(current.audio.srcObject).toBeNull();
    expect(current.peer.close).toHaveBeenCalledTimes(1);
    expect(current.channel.close).toHaveBeenCalledTimes(1);
    late({ data: JSON.stringify({ type: 'response.output_audio_transcript.delta', item_id: 'late', delta: '不应出现' }) });
    expect(current.options.onTranscript).not.toHaveBeenCalled();
    current.conversation.stop();
    expect(current.options.onError).not.toHaveBeenCalled();
  });

  it('授权期间停止后，迟到的麦克风音轨立即释放且不联网', async () => {
    const current = fixture();
    let release!: (stream: typeof current.stream) => void;
    current.options.getUserMedia.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const starting = current.conversation.start();
    current.conversation.stop();
    release(current.stream);
    await starting;
    expect(current.track.stop).toHaveBeenCalledTimes(1);
    expect(current.options.createPeerConnection).not.toHaveBeenCalled();
    expect(current.options.connect).not.toHaveBeenCalled();
  });

  it('握手期间停止后，迟到的服务回答不得重建连接', async () => {
    const current = fixture();
    let release!: (answer: { answer: string }) => void;
    current.options.connect.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const starting = current.conversation.start();
    await vi.waitFor(() => expect(current.options.connect).toHaveBeenCalled());
    current.conversation.stop();
    release({ answer: 'late-answer' });
    await starting;
    expect(current.peer.setRemoteDescription).not.toHaveBeenCalled();
    expect(current.track.stop).toHaveBeenCalled();
  });

  it.each(['failed', 'disconnected', 'closed'])('连接 %s 时释放资源，不自动重连', async state => {
    const current = fixture();
    await current.conversation.start();
    current.peer.connectionState = state;
    current.peer.onconnectionstatechange?.();
    expect(current.track.stop).toHaveBeenCalled();
    expect(current.options.onError).toHaveBeenCalledTimes(1);
    expect(current.options.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('麦克风拒绝和错误/超大消息一律停止，不伪造回答', async () => {
    const denied = fixture();
    denied.options.getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));
    await denied.conversation.start();
    expect(denied.options.onError).toHaveBeenCalledTimes(1);
    expect(denied.options.connect).not.toHaveBeenCalled();
    const current = fixture();
    await current.conversation.start();
    current.receive('x'.repeat(128_001));
    expect(current.track.stop).toHaveBeenCalled();
    expect(current.options.onTranscript).not.toHaveBeenCalled();
  });

  it('握手超时与最长时限均真实结束，不在后台继续采集', async () => {
    vi.useFakeTimers();
    const timeout = fixture();
    await timeout.conversation.start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(timeout.options.onError).toHaveBeenCalledTimes(1);
    expect(timeout.track.stop).toHaveBeenCalled();
    const duration = fixture();
    await duration.conversation.start();
    duration.channel.onopen?.();
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(duration.options.onEnd).toHaveBeenCalledTimes(1);
    expect(duration.track.stop).toHaveBeenCalled();
  });
});
