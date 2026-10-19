(() => {
  'use strict';

  const root = document.getElementById('guide-root');
  const target = document.getElementById('guide-target');
  const callout = document.getElementById('guide-callout');
  const arrow = document.getElementById('guide-arrow');
  const label = document.getElementById('guide-label');
  const instruction = document.getElementById('guide-instruction');
  const certainty = document.getElementById('guide-certainty');
  let current;
  let expiryTimer;
  let unsubscribe;
  let disposed = false;

  function clearGuide() {
    if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    expiryTimer = undefined;
    current = undefined;
    root.hidden = true;
    label.textContent = '';
    instruction.textContent = '';
    certainty.textContent = '';
    target.removeAttribute('style');
    callout.removeAttribute('style');
    arrow.removeAttribute('style');
    root.removeAttribute('data-presentation');
  }

  function renderGuide(state) {
    if (disposed) return;
    clearGuide();
    const rect = state?.rect;
    if (state?.visible !== true || !['confirmed', 'uncertain_candidate'].includes(state.presentation) || !Number.isFinite(state.expiresAt) || state.expiresAt <= Date.now() || !rect || !['x', 'y', 'width', 'height'].every(field => Number.isFinite(rect[field])) || rect.width <= 0 || rect.height <= 0 || window.innerWidth < 32 || window.innerHeight < 32) return;
    const left = Math.max(0, rect.x);
    const top = Math.max(0, rect.y);
    const right = Math.min(window.innerWidth, rect.x + rect.width);
    const bottom = Math.min(window.innerHeight, rect.y + rect.height);
    if (right <= left || bottom <= top) return;
    current = state;
    root.dataset.presentation = state.presentation;
    target.style.left = `${left}px`;
    target.style.top = `${top}px`;
    target.style.width = `${right - left}px`;
    target.style.height = `${bottom - top}px`;
    label.textContent = typeof state.label === 'string' ? state.label : '请核对目标位置';
    instruction.textContent = typeof state.instruction === 'string' ? state.instruction : '';
    certainty.textContent = state.presentation === 'uncertain_candidate' ? '可能是这里 · 请先核对' : '这一步的位置';
    root.hidden = false;
    const calloutWidth = Math.min(310, window.innerWidth - 16);
    callout.style.width = `${calloutWidth}px`;
    callout.style.left = `${Math.max(8, Math.min(window.innerWidth - calloutWidth - 8, left + (right - left - calloutWidth) / 2))}px`;
    const calloutHeight = callout.offsetHeight;
    const above = top >= calloutHeight + 40;
    const calloutTop = above ? top - calloutHeight - 32 : bottom + 32;
    callout.style.top = `${Math.max(8, Math.min(window.innerHeight - calloutHeight - 8, calloutTop))}px`;
    arrow.hidden = top < 30 && bottom > window.innerHeight - 30;
    arrow.style.left = `${Math.max(2, Math.min(window.innerWidth - 6, left + (right - left) / 2 - 2))}px`;
    const arrowAbove = above || bottom > window.innerHeight - 30;
    arrow.style.top = `${arrowAbove ? Math.max(0, top - 27) : bottom + 8}px`;
    arrow.style.transform = arrowAbove ? 'rotate(0deg)' : 'rotate(180deg)';
    expiryTimer = window.setTimeout(() => {
      if (current && current.expiresAt > Date.now()) renderGuide(current);
      else clearGuide();
    }, Math.min(state.expiresAt - Date.now(), 2147483647));
  }

  function resize() {
    if (current) renderGuide(current);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearGuide();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', dispose);
    window.removeEventListener('beforeunload', dispose);
    if (unsubscribe) {
      try { unsubscribe(); } catch (error) { console.error('指引状态订阅清理失败', error); }
    }
    unsubscribe = undefined;
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', dispose);
  window.addEventListener('beforeunload', dispose);
  try {
    if (typeof window.nuanbanGuide?.onState !== 'function') throw new Error('只读指引接口尚未接入');
    unsubscribe = window.nuanbanGuide.onState(renderGuide);
    if (typeof unsubscribe !== 'function') throw new Error('指引接口没有提供订阅取消函数');
  } catch (error) {
    clearGuide();
    console.error('暖伴只读指引未就绪，请检查桌面主进程', error);
  }
})();
