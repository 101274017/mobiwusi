import defaultPet from './default-pet.json';

const bridge = window.nuanbanAvatar;
const element = identifier => document.getElementById(identifier);
const container = element('xingyun-canvas');
const surface = element('xingyun-pet');
const consent = element('avatar-consent');
const startButton = element('avatar-start');
const stopButton = element('avatar-stop');
const progress = element('avatar-progress');
let state = { configured: false, phase: 'unconfigured', message: '正在读取本机形象配置…' };
let instance;
let generation = 0;
let timeout;
let disposed = false;
let lease;

function displayState() {
  const label = element('avatar-display-state');
  if (!label) return;
  const live = element('pet-toggle').classList.contains('is-cloud-avatar');
  label.textContent = live ? defaultPet.name + ' · 星云实时 3D'
    : !element('model-pet').hidden ? '本地 3D 模型'
      : !element('custom-pet').hidden ? '本机原画桌宠'
        : !element('fallback-cat-pet').hasAttribute('hidden') ? '预览不可用 · 备用小橘猫'
          : '默认' + defaultPet.name + ' · 本地静态预览';
}

function visibility(visible) {
  surface.hidden = !visible;
  surface.style.visibility = visible ? 'visible' : 'hidden';
  element('pet-toggle').classList.toggle('is-cloud-avatar', visible);
  window.dispatchEvent(new CustomEvent('nuanban:avatar-visibility', { detail: { visible } }));
  displayState();
}

function render() {
  element('avatar-status').textContent = state.message;
  element('avatar-status').dataset.phase = state.phase;
  element('avatar-application').textContent = state.configured ? '应用 · ' + state.appId.slice(-8)
    : state.configurationMismatch ? '待切换至应用 · ' + defaultPet.application.editorId : '本机尚未配置应用';
  startButton.disabled = !state.configured || !consent.checked || !['idle', 'error'].includes(state.phase);
  startButton.textContent = state.phase === 'error' ? '本人重试连接' : '启用' + defaultPet.name;
  stopButton.disabled = !['connecting', 'ready', 'cleanup_failed'].includes(state.phase);
  stopButton.textContent = state.phase === 'cleanup_failed' ? '重试关闭云端会话' : '停止并恢复原桌宠';
  progress.hidden = state.phase !== 'connecting';
  if (progress.hidden) element('avatar-download').textContent = '';
}

function destroyLocal() {
  generation++;
  clearTimeout(timeout);
  visibility(false);
  const previous = instance;
  instance = undefined;
  if (previous) void previous.destroy('user').catch(() => {});
}

function receive(next) {
  if (disposed) return;
  state = next;
  if (['idle', 'error', 'stopping', 'cleanup_failed', 'unconfigured'].includes(state.phase) && instance) destroyLocal();
  render();
}

const nativeFetch = window.fetch.bind(window);
async function sessionFetch(resource, options) {
  const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url;
  if (!url.startsWith('https://nuanban-xingyun.invalid/')) return nativeFetch(resource, options);
  const parsed = new URL(url);
  if (parsed.pathname !== '/session' || !['POST', 'DELETE'].includes(options?.method) || options.body?.length > 16384) throw new Error('形象请求无效');
  if (options.signal?.aborted) throw new DOMException('请求已取消', 'AbortError');
  const reply = await bridge.exchange(parsed.searchParams.get('lease'), { method: options.method, body: JSON.parse(options.body ?? '{}') });
  return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
}

async function start() {
  if (startButton.disabled || disposed || instance) return;
  const current = ++generation;
  let currentLease;
  consent.checked = false;
  state = { ...state, phase: 'connecting', message: '正在向主进程请求本次形象连接…' };
  progress.value = 0;
  render();
  try {
    const session = await bridge.begin(true);
    currentLease = session.lease;
    lease = currentLease;
    if (disposed || current !== generation) { await bridge.stop(); return; }
    let initialized = false;
    let rendered = false;
    let markedReady = false;
    let reportingFailure = false;
    const fail = kind => {
      if (disposed || current !== generation || reportingFailure) return;
      reportingFailure = true;
      destroyLocal();
      void bridge.fail(currentLease, kind).then(receive).catch(() => {
        receive({ ...state, phase: 'cleanup_failed', message: '形象停止尚未确认，请重试停止或在星云后台检查会话。' });
      });
    };
    const markReady = () => {
      if (!initialized || !rendered || markedReady || disposed || current !== generation) return;
      markedReady = true;
      clearTimeout(timeout);
      void bridge.ready(currentLease).then(accepted => { if (accepted && !disposed && current === generation) visibility(true); }).catch(() => fail('load_failed'));
    };
    timeout = setTimeout(() => fail('timeout'), 120000);
    const { default: XingyunAvatarAgent } = await import('@xmov/avatar/agent');
    if (disposed || current !== generation) return;
    container.replaceChildren();
    surface.hidden = false;
    surface.style.visibility = 'hidden';
    const created = new XingyunAvatarAgent({
      containerId: '#xingyun-canvas', container,
      appId: session.appId, appSecret: 'main-process-signing-only',
      gatewayServer: session.gatewayServer + '?lease=' + encodeURIComponent(currentLease),
      audio: { inputEnabled: false }, reconnect: { enabled: false, maxAttempts: 0 },
      features: { auto_send_asr_to_llm: false, speech_frontend: { enabled: false } },
      sentry: { enabled: false }, enableLogger: false, enableDebugger: false,
      useAlphaMask: true, scaleDownBy: 2,
      onMessage: error => { if (![50002, 30001].includes(Number(error.code))) fail('load_failed'); },
      onRenderChange: renderState => { if (['rendering', 'resumed'].includes(renderState)) { rendered = true; markReady(); } },
      agentCallbacks: {
        onAgentStateChange: agentState => { if (['failed', 'reconnecting'].includes(agentState)) fail('load_failed'); },
        onSocketStateChange: socketState => { if (['closed', 'error'].includes(socketState)) fail('load_failed'); },
        onError: error => { if (![50002, 30001].includes(Number(error.code))) fail('load_failed'); },
      },
    });
    if (disposed || current !== generation) { void created.destroy('load_failed').catch(() => {}); return; }
    instance = created;
    const currentInstance = created;
    currentInstance.setVolume(0);
    await currentInstance.init({ useAlphaMask: true, scaleDownBy: 2, onDownloadProgress: value => {
      if (disposed || current !== generation) return;
      progress.value = Math.min(100, Math.max(0, Number(value) || 0));
      element('avatar-download').textContent = '形象资源加载 · ' + Math.round(progress.value) + '%';
    } });
    if (disposed || current !== generation) return;
    initialized = true;
    markReady();
  } catch {
    if (disposed || current !== generation) return;
    destroyLocal();
    try { receive(currentLease ? await bridge.fail(currentLease, 'load_failed') : await bridge.status()); }
    catch { receive({ ...state, phase: 'error', message: '本次连接未完成；不会自动重连，请检查本机配置或网络后重试。' }); }
  }
}

async function stop() {
  destroyLocal();
  state = { ...state, phase: 'stopping', message: '正在确认星云会话停止…' };
  render();
  try { receive(await bridge.stop()); }
  catch { receive({ ...state, phase: 'cleanup_failed', message: '停止未确认，请重试停止并检查星云后台会话。' }); }
}

if (bridge && container && surface && startButton && stopButton && consent) {
  const sourceObserver = new MutationObserver(displayState);
  sourceObserver.observe(element('pet-toggle'), { attributes: true, attributeFilter: ['hidden'], subtree: true });
  displayState();
  window.fetch = sessionFetch;
  const unsubscribe = bridge.onState(receive);
  startButton.addEventListener('click', () => { void start(); });
  stopButton.addEventListener('click', () => { void stop(); });
  consent.addEventListener('change', render);
  void bridge.status().then(receive).catch(() => receive({ ...state, phase: 'error', message: '本机形象配置读取失败，原桌宠保持不变。' }));
  window.addEventListener('offline', () => { if (lease && instance) { const failedLease = lease; destroyLocal(); void bridge.fail(failedLease, 'load_failed').then(receive).catch(() => {}); } });
  window.addEventListener('pagehide', () => { disposed = true; destroyLocal(); sourceObserver.disconnect(); unsubscribe(); void bridge.stop().catch(() => {}); }, { once: true });
} else if (startButton) {
  receive({ ...state, phase: 'unconfigured', message: '请在独立桌宠中使用。浏览器预览不会连接形象服务。' });
}
