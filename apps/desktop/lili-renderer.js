(() => {
  'use strict';
  const bridge = window.nuanbanLili;
  const canvas = document.getElementById('lili-pet');
  const root = document.getElementById('pet-window');
  const bubble = document.getElementById('lili-bubble');
  if (!bridge || !canvas || !root || !bubble) return;
  const context = canvas.getContext('2d');
  const faceCanvas = document.createElement('canvas');
  const previousCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = previousCanvas.width = previousCanvas.height = 384;
  const faceContext = faceCanvas.getContext('2d');
  const cache = new Map();
  const pending = new Map();
  const subscriptions = [];
  let generation = 0;
  let serial = 0;
  let manifest;
  let urls;
  let faceAtlas;
  let state;
  let previousRequest;
  let transitionAt = 0;
  let rendered = false;
  let failed = false;
  let disposed = false;
  let resourceVersion = 0;
  let animationFrame;

  function image(url) {
    return new Promise((resolve, reject) => {
      const result = new Image();
      result.onload = () => resolve(result);
      result.onerror = () => reject(new Error('栗栗 PNG 加载失败'));
      result.src = url;
    });
  }

  async function atlas(index) {
    if (cache.has(index)) {
      const result = cache.get(index);
      cache.delete(index);
      cache.set(index, result);
      return result;
    }
    if (pending.has(index)) return pending.get(index);
    const current = generation;
    const promise = image(urls[index]).then(result => {
      if (generation === current && !disposed) {
        pending.delete(index);
        cache.set(index, result);
        while (cache.size > 4) cache.delete(cache.keys().next().value);
      }
      return result;
    }).catch(error => { if (generation === current) pending.delete(index); throw error; });
    pending.set(index, promise);
    return promise;
  }

  function showFailure() {
    if (failed || disposed || !state?.enabled) return;
    failed = true;
    root.classList.remove('is-lili');
    canvas.hidden = true;
    canvas.dataset.ready = 'false';
    bubble.textContent = '栗栗资源加载失败，暂用原有形象；可从右键菜单重新选择。';
    bubble.hidden = false;
    void bridge.interaction({ type: 'loadFailed' }).catch(() => {});
  }

  function faceLayer(expression, eye, opacity) {
    if (opacity <= 0) return;
    const tile = manifest.faces.frames[expression][eye];
    faceContext.globalAlpha = opacity;
    faceContext.drawImage(faceAtlas, ...tile, manifest.faceCrop[0], manifest.faceCrop[1], tile[2], tile[3]);
  }

  async function draw() {
    if (!manifest || !faceAtlas || !state?.enabled || !state.animation || failed || disposed) return;
    const currentSerial = ++serial;
    const currentGeneration = generation;
    const animation = state.animation;
    const frame = manifest.frames[animation.clip][animation.frame];
    try {
      const body = await atlas(frame.atlas);
      if (currentSerial !== serial || currentGeneration !== generation || disposed) return;
      context.clearRect(0, 0, 384, 384);
      context.drawImage(body, frame.x, frame.y, 384, 384, 0, 0, 384, 384);
      faceContext.clearRect(0, 0, 384, 384);
      faceLayer('smile', animation.eye, 1 - animation.intensity);
      faceLayer(animation.expression, animation.eye, animation.intensity);
      faceContext.globalAlpha = 1;
      context.save();
      context.setTransform(...frame.faceTransform);
      context.drawImage(faceCanvas, 0, 0);
      context.restore();
      const progress = Math.min(1, (performance.now() - transitionAt) / 140);
      if (transitionAt && progress < 1) {
        context.globalAlpha = 1 - progress;
        context.drawImage(previousCanvas, 0, 0);
        context.globalAlpha = 1;
        cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(draw);
      }
      const next = manifest.frames[animation.clip][(animation.frame + 1) % manifest.clips[animation.clip].count];
      if (next.atlas !== frame.atlas) void atlas(next.atlas).catch(() => { if (currentGeneration === generation) showFailure(); });
      canvas.dataset.clip = animation.clip;
      canvas.dataset.frame = String(animation.frame);
      canvas.dataset.expression = animation.expression;
      if (!rendered) {
        rendered = true;
        root.classList.add('is-lili');
        canvas.hidden = false;
        canvas.dataset.ready = 'true';
        void bridge.interaction({ type: 'loaded' }).catch(() => {});
      }
    } catch { if (currentGeneration === generation) showFailure(); }
  }

  function accept(next) {
    if (disposed) return;
    if (rendered && next.enabled && previousRequest !== undefined && previousRequest !== next.animation?.requestId) {
      const previousContext = previousCanvas.getContext('2d');
      previousContext.clearRect(0, 0, 384, 384);
      previousContext.drawImage(canvas, 0, 0);
      transitionAt = performance.now();
    }
    previousRequest = next.animation?.requestId;
    state = next;
    root.classList.toggle('lili-reduced-motion', next.enabled && next.animation?.reducedMotion === true);
    root.style.setProperty('--lili-size', `${next.view?.size ?? 240}px`);
    if (!failed) { bubble.textContent = next.bubble ?? ''; bubble.hidden = !next.enabled || !next.bubble; }
    if (!next.enabled) {
      root.classList.remove('is-lili');
      canvas.hidden = true;
      return;
    }
    void draw();
  }

  async function load(data) {
    const current = ++generation;
    serial += 1;
    cache.clear();
    pending.clear();
    manifest = null;
    faceAtlas = null;
    previousRequest = undefined;
    rendered = false;
    failed = false;
    canvas.dataset.ready = 'false';
    canvas.hidden = true;
    root.classList.remove('is-lili');
    accept(data);
    if (!data.enabled) return;
    manifest = data.manifest;
    urls = data.atlases;
    try {
      const loaded = await image(data.faceAtlas);
      if (current !== generation || disposed) return;
      faceAtlas = loaded;
      await draw();
    } catch { if (current === generation) showFailure(); }
  }

  const onCloud = event => { if (event.detail?.visible && state?.enabled) void bridge.select(false).catch(showFailure); };
  window.addEventListener('nuanban:avatar-visibility', onCloud);
  subscriptions.push(bridge.onState(accept), bridge.onResource(data => { resourceVersion += 1; void load(data); }));
  const initialVersion = resourceVersion;
  void bridge.bootstrap().then(data => { if (initialVersion === resourceVersion) return load(data); }).catch(showFailure);
  window.addEventListener('pagehide', () => {
    disposed = true;
    generation += 1;
    cancelAnimationFrame(animationFrame);
    for (const unsubscribe of subscriptions) unsubscribe();
    window.removeEventListener('nuanban:avatar-visibility', onCloud);
    cache.clear();
    pending.clear();
    manifest = faceAtlas = urls = state = null;
  }, { once: true });
})();
