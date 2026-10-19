(() => {
  'use strict';
  const bridge = window.nuanbanVoiceChat;
  const element = identifier => document.getElementById(identifier);
  const labels = { connecting: '正在连接', listening: '正在听你说', thinking: '暖暖想一想', speaking: '暖暖在说话', muted: '麦克风已静音' };
  const prompts = { connecting: '正在建立本次语音连接…', listening: '我在听，你慢慢说', thinking: '嗯，让我想一想…', speaking: '随时开口，就能打断我', muted: '先安静一会儿，点击即可恢复' };
  let muted = false;
  let ended = false;
  let connectedAt = null;
  let clock = null;
  let conversation = null;
  let localMode = false;
  let petPresentation = false;
  let unsubscribe;
  let unsubscribeControl;
  let controlPending = false;

  function close(failed = false) {
    if (ended) return;
    ended = true;
    conversation?.stop();
    unsubscribe?.();
    unsubscribeControl?.();
    clearInterval(clock);
    element('mute-voice').disabled = true;
    element('interrupt-voice').disabled = true;
    void (failed ? bridge?.failed() : bridge?.stop())?.catch(() => {});
  }

  function updateState(state) {
    if (ended) return;
    document.body.dataset.state = state;
    element('connection-status').textContent = labels[state];
    element('voice-prompt').textContent = localMode && state === 'speaking' ? '朗读时暂停听写，点击“打断暖暖”继续说' : localMode && state === 'connecting' ? '正在启动本机听写，请稍候…' : prompts[state];
    element('mute-voice').disabled = controlPending || state === 'connecting';
    element('interrupt-voice').disabled = state !== 'speaking';
    if (state !== 'connecting') {
      connectedAt ??= Date.now();
      if (!localMode) void bridge.state(state).catch(() => close(true));
    }
  }

  function updateTranscript(item) {
    if (ended) return;
    if (petPresentation) void bridge.transcript(item).catch(() => close(true));
    const list = element('voice-transcripts');
    let entry = Array.from(list.children).find(child => child.dataset.id === item.id);
    if (!entry) {
      entry = document.createElement('li');
      entry.dataset.id = item.id;
      entry.dataset.role = item.role;
      const speaker = document.createElement('span');
      speaker.className = 'speaker';
      speaker.textContent = item.role === 'user' ? '你' : '暖暖';
      entry.append(speaker, document.createElement('span'));
      list.append(entry);
    }
    entry.lastElementChild.textContent = item.text;
    while (list.children.length > 40) list.firstElementChild.remove();
    element('caption-empty').hidden = true;
    list.scrollTop = list.scrollHeight;
  }

  element('end-voice').addEventListener('click', () => close());
  element('mute-voice').addEventListener('click', async () => {
    if (!conversation || ended || controlPending) return;
    controlPending = true;
    element('mute-voice').disabled = true;
    try {
      muted = await conversation.setMuted(!muted);
      if (ended) return;
      element('mute-voice').setAttribute('aria-pressed', String(muted));
      element('mute-voice').textContent = muted ? '恢复麦克风' : '静音麦克风';
    } catch { close(true); }
    finally { controlPending = false; if (!ended) element('mute-voice').disabled = document.body.dataset.state === 'connecting'; }
  });
  element('interrupt-voice').addEventListener('click', () => {
    if (conversation && !ended) void Promise.resolve(conversation.interrupt()).catch(() => close(true));
  });
  window.addEventListener('pagehide', () => close());
  if (!bridge) {
    document.body.dataset.state = 'error';
    element('connection-status').textContent = '尚未连接';
    element('voice-prompt').textContent = '请从独立桌宠的“面对面语音”入口打开。麦克风未开启。';
    element('end-voice').disabled = true;
    return;
  }
  clock = setInterval(() => {
    if (connectedAt === null) return;
    const seconds = Math.floor((Date.now() - connectedAt) / 1000);
    element('call-duration').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }, 1000);
  async function initialize() {
    const configuration = typeof bridge.mode === 'function' ? await bridge.mode() : { mode: 'realtime' };
    if (ended) return;
    if (!['local', 'realtime'].includes(configuration?.mode)) throw new Error('语音模式未确认');
    localMode = configuration.mode === 'local';
    petPresentation = configuration.presentation === 'pet';
    if (petPresentation) unsubscribeControl = bridge.onControl(action => {
      if (ended || !conversation) return;
      if (action === 'interrupt') element('interrupt-voice').click();
      else if ((action === 'mute' && !muted) || (action === 'unmute' && muted)) element('mute-voice').click();
    });
    element('voice-privacy-note').textContent = localMode
      ? '本机识别与朗读 · 仅文字及本次上下文发给已有模型，仍需网络和模型额度；无需另开语音账号。请勿说出隐私。朗读时不听写，静音关闭麦克风；最多15分钟，失败不自动重连。'
      : '本次语音实时发送至 OpenAI，声音由 AI 生成。请勿说出隐私；静音不释放麦克风，结束才关闭。推荐戴耳机。每次最多15分钟，断线不自动重连。';
    if (localMode) {
      document.title = '暖伴 · 本地语音对话';
      conversation = {
        start: () => {
          unsubscribe = bridge.onEvent(event => {
            if (event.type === 'state') updateState(event.state);
            else if (event.type === 'transcript') updateTranscript(event);
          });
          return bridge.localControl('start');
        },
        setMuted: async value => (await bridge.localControl(value ? 'mute' : 'unmute')).muted,
        interrupt: () => bridge.localControl('interrupt'),
        stop: () => {},
      };
    } else {
      conversation = window.NuanbanRealtimeVoice.createRealtimeVoiceSession({
        audio: element('voice-playback'), getUserMedia: constraints => navigator.mediaDevices.getUserMedia(constraints),
        createPeerConnection: () => new RTCPeerConnection(), createMediaStream: tracks => new MediaStream(tracks),
        connect: offer => bridge.connect(offer), onState: updateState, onTranscript: updateTranscript,
        onError: () => close(true), onEnd: () => close(),
      });
    }
    await conversation.start();
  }
  void initialize().catch(() => close(true));
})();
