(() => {
  'use strict';
  const bridge = window.nuanbanArtwork;
  const builtin = document.getElementById('builtin-pet');
  const custom = document.getElementById('custom-pet');
  const status = document.getElementById('artwork-status');
  const emergency = document.getElementById('fallback-cat-pet');
  let builtinRequested = true;
  let previewFailed = false;
  function setBuiltinVisible(visible) {
    builtinRequested = visible;
    builtin?.toggleAttribute('hidden', !visible || previewFailed);
    emergency?.toggleAttribute('hidden', !visible || !previewFailed);
  }
  const useEmergency = () => { previewFailed = true; setBuiltinVisible(builtinRequested); };
  builtin?.addEventListener?.('error', useEmergency);
  if (builtin?.tagName === 'IMG' && builtin.complete && !builtin.naturalWidth) useEmergency();
  if (!bridge || !builtin || !custom || !status) return;
  let revision = 0;
  let disposed = false;
  let modelVisible = false;
  let currentArtwork = { kind: 'builtin' };
  window.addEventListener('nuanban:model-visibility', event => {
    modelVisible = event.detail?.visible === true;
    if (modelVisible) { revision++; custom.hidden = true; setBuiltinVisible(false); status.hidden = true; }
    else show(currentArtwork);
  });

  function fallback(message = '') {
    custom.hidden = true;
    custom.removeAttribute('src');
    setBuiltinVisible(true);
    status.textContent = message;
    status.hidden = !message;
  }

  function show(artwork) {
    if (disposed) return;
    currentArtwork = artwork;
    const current = ++revision;
    if (modelVisible) return;
    if (artwork?.kind === 'builtin') { fallback(); return; }
    if (artwork?.kind !== 'drawing' || typeof artwork.dataUrl !== 'string' || artwork.dataUrl.length > 2796226
      || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(artwork.dataUrl)
      || !Number.isInteger(artwork.width) || !Number.isInteger(artwork.height)
      || artwork.width < 1 || artwork.width > 800 || artwork.height < 1 || artwork.height > 480) {
      fallback('原画读取失败，暂用内置形象；请重新预览并应用。');
      return;
    }
    const image = new Image();
    image.onload = () => {
      if (disposed || current !== revision) return;
      if (image.naturalWidth !== artwork.width || image.naturalHeight !== artwork.height) {
        fallback('原画尺寸不一致，请重新预览并应用。');
        return;
      }
      custom.src = artwork.dataUrl;
      custom.hidden = false;
      setBuiltinVisible(false);
      status.textContent = '';
      status.hidden = true;
    };
    image.onerror = () => { if (!disposed && current === revision) fallback('原画显示失败，暂用内置形象；原画稿仍保留。'); };
    image.src = artwork.dataUrl;
  }

  const unsubscribe = bridge.onChanged(show);
  const requestRevision = revision;
  void bridge.read().then(artwork => { if (!disposed && revision === requestRevision) show(artwork); })
    .catch(() => { if (!disposed && revision === requestRevision) fallback('本机原画读取失败，暂用内置形象；请重新预览并应用。'); });
  window.addEventListener('pagehide', () => { disposed = true; revision += 1; unsubscribe(); }, { once: true });
})();
