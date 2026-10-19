(() => {
  'use strict';
  const element = name => document.getElementById(name);
  const bridge = window.nuanbanObservationRegion;
  const parameters = new URLSearchParams(window.location.search);
  const viewport = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, parameters.has(key) ? Number(parameters.get(key)) : NaN]));
  if (!Object.values(viewport).every(Number.isSafeInteger) || viewport.x < 0 || viewport.y < 0 || viewport.width < 32 || viewport.height < 32
    || viewport.x + viewport.width > window.innerWidth || viewport.y + viewport.height > window.innerHeight) { bridge.cancel(); return; }
  let anchor = null;
  let selected = null;
  let finished = false;
  const point = event => ({ x: Math.max(viewport.x, Math.min(viewport.x + viewport.width, Math.round(event.clientX))), y: Math.max(viewport.y, Math.min(viewport.y + viewport.height, Math.round(event.clientY))) });

  function update(event) {
    if (!anchor || finished) return;
    const position = point(event);
    selected = { x: Math.min(anchor.x, position.x), y: Math.min(anchor.y, position.y), width: Math.abs(position.x - anchor.x), height: Math.abs(position.y - anchor.y) };
    const selection = element('selection');
    selection.hidden = false;
    element('shade').hidden = true;
    for (const key of ['x', 'y', 'width', 'height']) selection.style[{ x: 'left', y: 'top', width: 'width', height: 'height' }[key]] = `${selected[key]}px`;
    const valid = selected.width >= 32 && selected.height >= 32;
    element('dimensions').textContent = `${selected.width} × ${selected.height}`;
    element('selection-status').textContent = valid ? '区域已选好。按 Enter 确认，或重新拖动选择；Esc 可取消。' : '区域太小，请重新拖动，至少选择 32 × 32。';
    element('confirm').disabled = !valid;
  }

  function confirm() {
    if (finished || !selected || element('confirm').disabled) return;
    finished = true;
    element('confirm').disabled = true;
    bridge.choose({ ...selected });
  }

  function cancel() {
    if (finished) return;
    finished = true;
    bridge.cancel();
  }

  document.addEventListener('pointerdown', event => {
    if (finished || event.button !== 0 || event.target.closest('.instructions')) return;
    anchor = point(event);
    selected = null;
    document.body.setPointerCapture(event.pointerId);
    update(event);
  });
  document.addEventListener('pointermove', update);
  document.addEventListener('pointerup', event => {
    if (!anchor) return;
    update(event);
    anchor = null;
    if (document.body.hasPointerCapture(event.pointerId)) document.body.releasePointerCapture(event.pointerId);
  });
  document.addEventListener('pointercancel', () => { anchor = null; selected = null; element('selection').hidden = true; element('shade').hidden = false; element('confirm').disabled = true; });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
    else if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') { event.preventDefault(); confirm(); }
  });
  element('confirm').addEventListener('click', confirm);
  element('cancel').addEventListener('click', cancel);
})();
