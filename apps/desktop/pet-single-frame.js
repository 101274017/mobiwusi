(() => {
  'use strict';
  const bridge = window.nuanbanSingleFrame;
  const element = id => document.getElementById(id);
  const capture = element('single-frame-capture');
  const analyze = element('single-frame-analyze');
  const cancel = element('single-frame-cancel');
  const question = element('single-frame-question');
  const image = element('single-frame-image');
  const preview = element('single-frame-preview');
  const status = element('single-frame-status');
  const exit = element('single-frame-exit');
  const panel = element('pet-panel');
  if (![capture, analyze, cancel, question, image, preview, status, exit, panel].every(Boolean)) return;
  let currentPreview;
  let busy = false;
  let generation = 0;
  let expiryTimer;
  let disposed = false;
  let unsubscribe;
  let modeActive = false;

  function setMode(active) {
    modeActive = active;
    if (active) panel.dataset.singleFrame = 'active';
    else delete panel.dataset.singleFrame;
  }

  function discard() { clearTimeout(expiryTimer); currentPreview = undefined; image.removeAttribute('src'); preview.hidden = true; }
  function render() {
    capture.disabled = busy || !bridge;
    analyze.disabled = busy || !currentPreview || currentPreview.expiresAt <= Date.now() || !question.value.trim() || !bridge;
    cancel.disabled = !bridge;
  }
  function apply(state) {
    if (disposed || !state) return;
    status.textContent = state.message;
    if (!state.hasPreview) discard();
    render();
  }
  async function perform(operation) {
    if (busy || disposed) return;
    const current = ++generation;
    busy = true;
    render();
    try { const result = await operation(current); if (current === generation) apply(result); }
    catch (error) { if (current === generation && !disposed) status.textContent = error.message || '单帧操作失败，请重试。'; }
    finally { if (current === generation) { busy = false; render(); } }
  }
  capture.addEventListener('click', () => { void perform(async current => {
    setMode(true);
    discard();
    status.textContent = '请选择共享屏幕或框选区域…';
    const result = await bridge.capture();
    if (disposed || current !== generation) return;
    if (result.preview) {
      currentPreview = result.preview;
      image.src = result.preview.dataUrl;
      preview.hidden = false;
      expiryTimer = setTimeout(() => { discard(); status.textContent = '预览已过期，请重新截帧。'; render(); }, Math.max(0, result.preview.expiresAt - Date.now()));
    }
    return result.state;
  }); });
  analyze.addEventListener('click', () => { void perform(() => {
    status.textContent = '等待本人确认，然后仅发送当前预览…';
    return bridge.analyze({ previewId: currentPreview.id, question: question.value.trim() });
  }); });
  async function stop() {
    ++generation;
    discard();
    status.textContent = '正在取消单帧操作…';
    try { apply(await bridge.cancel()); } catch (error) { status.textContent = `停止未确认：${error.message}`; }
    finally { busy = false; render(); }
  }
  cancel.addEventListener('click', () => { void stop(); });
  exit.addEventListener('click', () => { setMode(false); void stop(); });
  const navigation = new MutationObserver(() => {
    if (modeActive && panel.dataset.view !== 'guidance') { setMode(false); void stop(); }
  });
  navigation.observe(panel, { attributes: true, attributeFilter: ['data-view'] });
  question.addEventListener('input', render);
  question.addEventListener('pointerdown', () => { void window.nuanbanPet?.focusInput?.(); });
  function dispose() { disposed = true; ++generation; discard(); unsubscribe?.(); navigation.disconnect(); }
  window.addEventListener('pagehide', dispose, { once: true });
  if (bridge) {
    unsubscribe = bridge.onState(apply);
    void bridge.snapshot().then(apply).catch(error => { status.textContent = error.message; });
  } else status.textContent = '单帧接口尚未加载，请保存操作后重新打开桌宠。';
  render();
})();
