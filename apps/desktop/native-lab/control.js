const bridge = window.nuanbanC02;
const elements = Object.fromEntries(['canary', 'consent', 'overlay', 'start', 'stop', 'message', 'status', 'displays', 'geometry', 'capture'].map(id => [id, document.getElementById(id)]));
const phaseNames = { idle: '尚未授权', awaiting: '等待本次捕获请求', starting: '等待轨道启动', capturing: '仅合成窗口 / 采集中', stopping: '已封闭 · 清理待确认', stopped: '已停止', disposed: '持有轨道的页面已关闭' };
let active = null;
let current = null;

function message(text) { elements.message.textContent = text; }

async function endLocal(run) {
  if (!run) return;
  run.stopped = true;
  if (run.frameHandle !== null) elements.capture.cancelVideoFrameCallback(run.frameHandle);
  for (const track of run.stream?.getTracks() ?? []) track.stop();
  if (active === run) { elements.capture.pause(); elements.capture.srcObject = null; }
  if (!run.pending) {
    const liveTracks = (run.stream?.getTracks() ?? []).filter(track => track.readyState !== 'ended').length;
    await bridge.stopped({ ticket: run.ticket, proof: { pendingCapture: false, liveTracks } }).catch(() => false);
    if (active === run) active = null;
  }
}

function render(snapshot) {
  current = snapshot;
  const state = snapshot.session;
  elements.start.disabled = !['idle', 'stopped'].includes(state.phase);
  elements.status.replaceChildren();
  for (const [title, value] of [['状态', phaseNames[state.phase] ?? state.phase], ['代际', state.generation], ['观察到的帧回调', state.frames], ['迟到回调（已拒绝）', state.lateCallbacks], ['清理待确认', state.cleanupPending ? '是' : '否'], ['停止原因', state.reason ?? '无']]) {
    const term = document.createElement('dt'); term.textContent = title;
    const detail = document.createElement('dd'); detail.textContent = String(value);
    elements.status.append(term, detail);
  }
  elements.geometry.textContent = JSON.stringify(snapshot.geometry, null, 2);
  const inventoryKey = JSON.stringify(snapshot.displays);
  if (elements.displays.dataset.key !== inventoryKey) {
    elements.displays.dataset.key = inventoryKey;
    elements.displays.replaceChildren();
    snapshot.displays.forEach((display, index) => {
      const card = document.createElement('div'); card.className = 'display';
      const label = document.createElement('p'); label.textContent = `显示器 ${index + 1} · ${display.scaleFactor}× / ${display.rotation}°`;
      const bounds = document.createElement('p'); bounds.textContent = `DIP：(${display.bounds.x}, ${display.bounds.y}) / ${display.bounds.width} × ${display.bounds.height}`;
      const move = document.createElement('button'); move.type = 'button'; move.textContent = '停止并移至此屏';
      move.addEventListener('click', () => bridge.moveCanary(display.id).catch(() => message('移动未完成；请先确认停止状态。')));
      card.append(label, bounds, move); elements.displays.append(card);
    });
  }
  if (active && (active.ticket.generation !== state.generation || state.phase === 'stopping')) void endLocal(active);
}

function countFrame(run) {
  if (active !== run || run.stopped) return;
  run.frameHandle = elements.capture.requestVideoFrameCallback(async () => {
    run.frameHandle = null;
    if (active !== run || run.stopped) return;
    run.sequence += 1;
    const accepted = await bridge.frame({ ticket: run.ticket, sequence: run.sequence }).catch(() => false);
    if (!accepted) { await endLocal(run); return; }
    countFrame(run);
  });
}

elements.start.addEventListener('click', async () => {
  if (!elements.consent.checked) { message('请先阅读并勾选本次实验说明。'); return; }
  if (active) return;
  let run;
  try {
    const ticket = await bridge.begin({ consent: true, overlay: elements.overlay.checked });
    elements.consent.checked = false;
    run = { ticket, pending: true, stream: null, stopped: false, frameHandle: null, sequence: 0 };
    active = run;
    const stream = await navigator.mediaDevices.getDisplayMedia({ audio: false, video: { frameRate: { ideal: 8, max: 15 }, width: { max: 1280 }, height: { max: 720 } } });
    run.stream = stream;
    if (run.stopped || current?.session.generation !== ticket.generation) { await endLocal(run); return; }
    const videoTracks = stream.getVideoTracks();
    const settings = videoTracks[0]?.getSettings() ?? {};
    const accepted = await bridge.started({ ticket, details: { videoTracks: videoTracks.length, audioTracks: stream.getAudioTracks().length, width: settings.width, height: settings.height } });
    if (!accepted) { await bridge.failed(ticket); await endLocal(run); return; }
    for (const track of stream.getTracks()) track.addEventListener('ended', () => { void bridge.ended(ticket).catch(() => false); void endLocal(run); }, { once: true });
    elements.capture.srcObject = stream;
    await elements.capture.play();
    if (run.stopped) { await endLocal(run); return; }
    countFrame(run);
    message('仅捕获本样例的固定合成窗口；所有帧留在本机内存，没有编码、保存或上传入口。');
  } catch (error) {
    if (run) { await bridge.failed(run.ticket).catch(() => false); await endLocal(run); }
    message(error?.name === 'NotAllowedError' ? '本次捕获未被允许；未恢复或切换为其他来源。' : '未能取得受控合成窗口；已请求停止。请检查本机权限与窗口状态。');
  } finally {
    if (run) { run.pending = false; if (run.stopped) await endLocal(run); }
  }
});
elements.stop.addEventListener('click', () => { void bridge.stop().catch(() => message('宿主停止未确认，请关闭验证程序并检查系统采集状态。')); });
elements.canary.addEventListener('click', () => { void bridge.showCanary().catch(() => message('无法显示合成窗口。')); });
window.addEventListener('pagehide', () => { if (active) void endLocal(active); });
bridge.onState(render);
bridge.read().then(render).catch(() => message('原生验证宿主不可用；本页面不会请求捕获。'));
