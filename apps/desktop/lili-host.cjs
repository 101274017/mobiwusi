const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { performance } = require('node:perf_hooks');
const { AnimationController } = require('./lili-animation.cjs');
const { loadLiliResource, describeLiliResource } = require('./lili-resource.cjs');
const { createLiliAdapter } = require('./lili-adapter.cjs');

function createLiliHost(options) {
  const preferencesPath = path.join(options.userDataPath, 'lili-pet-preferences.json');
  let resource;
  let animator;
  let adapter;
  let enabled = false;
  let disposed = false;
  let timer;
  let bubbleTimer;
  let bubble = '';
  let failure = '';
  let lastTime = performance.now();
  let preferences = { size: 240, opacity: 1, alwaysOnTop: true, clickThrough: false, paused: false, reducedMotion: false };
  try {
    const saved = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
    if (Number.isFinite(saved.size) && saved.size >= 64 && saved.size <= 320) preferences.size = saved.size;
    if (Number.isFinite(saved.opacity) && saved.opacity >= 0.2 && saved.opacity <= 1) preferences.opacity = saved.opacity;
    for (const key of ['alwaysOnTop', 'paused', 'reducedMotion']) if (typeof saved[key] === 'boolean') preferences[key] = saved[key];
    if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) { preferences.x = Math.round(saved.x); preferences.y = Math.round(saved.y); }
  } catch {}

  function event(type, payload = {}) { options.onEvent?.({ type, ...payload }); }

  function persist() {
    try {
      fs.mkdirSync(options.userDataPath, { recursive: true });
      fs.writeFileSync(preferencesPath + '.tmp', JSON.stringify(preferences, null, 2));
      fs.renameSync(preferencesPath + '.tmp', preferencesPath);
    } catch { event('preferences.save_failed'); }
  }

  function snapshot() {
    return { enabled, resourceId: 'lili', version: resource?.manifest.version, failure, view: { ...preferences }, bubble,
      animation: animator?.snapshot() ?? null };
  }

  function frame() { if (!disposed) options.onFrame?.(snapshot()); }

  function resetAnimation() {
    animator?.removeAllListeners();
    animator = new AnimationController(resource.manifest);
    animator.configure({ paused: preferences.paused, reducedMotion: preferences.reducedMotion });
    animator.on('event', payload => { event(payload.type, payload); frame(); });
    adapter = createLiliAdapter({ play: (action, settings) => animator.play(action, settings),
      setExpression: (expression, intensity) => animator.setExpression(expression, intensity), showBubble });
  }

  function ensureResource() {
    if (!resource) resource = loadLiliResource(options.resourcePath ?? path.join(__dirname, 'assets', 'lili'));
  }

  function bootstrap() {
    return { ...snapshot(), ...(enabled ? { manifest: resource.manifest,
      atlases: resource.atlases.map(filePath => pathToFileURL(filePath).href), faceAtlas: pathToFileURL(resource.faceAtlas).href,
      capabilities: describeLiliResource(resource) } : {}) };
  }

  function setEnabled(value) {
    if (disposed) return { ok: false, code: 'disposed' };
    if (typeof value !== 'boolean') return { ok: false, code: 'invalid_enabled' };
    if (enabled === value && (!value || !failure)) return { ok: true, enabled };
    try {
      if (value) {
        if (failure) resource = null;
        ensureResource();
        resetAnimation();
      }
    }
    catch (error) {
      enabled = false;
      failure = error.message;
      options.onResource?.(snapshot());
      event('resource.load_failed', { message: failure });
      return { ok: false, code: 'resource_load_failed' };
    }
    enabled = value;
    failure = '';
    preferences.clickThrough = false;
    bubble = '';
    clearTimeout(bubbleTimer);
    if (!value) animator?.stop();
    options.onView?.({ ...preferences, enabled, visible: true });
    lastTime = performance.now();
    options.onResource?.(bootstrap());
    event('resource.changed', { enabled, id: 'lili', version: resource?.manifest.version });
    return { ok: true, enabled };
  }

  function showBubble(text) {
    bubble = text;
    clearTimeout(bubbleTimer);
    if (text) {
      bubbleTimer = setTimeout(() => { bubble = ''; frame(); }, 12000);
      bubbleTimer.unref?.();
    }
    frame();
    return { ok: true };
  }

  function setView(changes) {
    const allowed = ['size', 'opacity', 'alwaysOnTop', 'clickThrough', 'visible', 'x', 'y', 'facing'];
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)
      || Object.keys(changes).some(key => !allowed.includes(key))) return { ok: false, code: 'invalid_view' };
    if ('facing' in changes && changes.facing !== 'front') return { ok: false, code: 'unsupported_facing', supported: ['front'] };
    for (const key of ['alwaysOnTop', 'clickThrough', 'visible']) if (key in changes && typeof changes[key] !== 'boolean') return { ok: false, code: 'invalid_view' };
    if ('size' in changes && (!Number.isFinite(changes.size) || changes.size < 64 || changes.size > 320)) return { ok: false, code: 'invalid_size' };
    if ('opacity' in changes && (!Number.isFinite(changes.opacity) || changes.opacity < 0.2 || changes.opacity > 1)) return { ok: false, code: 'invalid_opacity' };
    if (('x' in changes) !== ('y' in changes) || ['x', 'y'].some(key => key in changes && (!Number.isFinite(changes[key]) || Math.abs(changes[key]) > 100000))) return { ok: false, code: 'invalid_position' };
    const next = { ...preferences, ...changes };
    const result = options.onView?.({ ...next, enabled });
    if (result?.ok === false) return result;
    delete next.visible;
    delete next.facing;
    preferences = next;
    persist();
    event('display.changed', { view: { ...preferences } });
    frame();
    return { ok: true, view: { ...preferences } };
  }

  function command(payload) {
    if (disposed) return { ok: false, code: 'disposed' };
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, code: 'invalid_command' };
    const fields = { 'resource.describe': [], 'state.get': [], 'action.play': ['action', 'options'], 'action.stop': [],
      'expression.set': ['expression', 'intensity'], 'expression.reset': [], 'animation.configure': ['options'],
      'semantic.send': ['name', 'text'], 'ui.bubble': ['text'], 'display.set': ['options'] };
    if (!Object.hasOwn(fields, payload.type) || Object.keys(payload).some(key => key !== 'type' && !fields[payload.type].includes(key))) return { ok: false, code: 'unsupported_command' };
    if (payload.type === 'state.get') return { ok: true, state: snapshot() };
    if (payload.type === 'resource.describe') {
      try { ensureResource(); return { ok: true, resource: describeLiliResource(resource) }; }
      catch { return { ok: false, code: 'resource_load_failed' }; }
    }
    if (!enabled) return { ok: false, code: 'lili_not_selected' };
    let result;
    switch (payload.type) {
      case 'action.play': result = animator.play(payload.action, payload.options); break;
      case 'action.stop': result = animator.stop(); break;
      case 'expression.set': result = animator.setExpression(payload.expression, payload.intensity); break;
      case 'expression.reset': result = animator.setExpression(null); break;
      case 'animation.configure':
        result = animator.configure(payload.options);
        if (result.ok) { preferences.paused = animator.paused; preferences.reducedMotion = animator.reducedMotion; persist(); }
        break;
      case 'semantic.send': result = adapter.semantic(payload.name, payload.text); break;
      case 'ui.bubble': result = typeof payload.text === 'string' && payload.text.length <= 500 ? showBubble(payload.text) : { ok: false, code: 'invalid_text' }; break;
      case 'display.set': return setView(payload.options);
    }
    frame();
    return result;
  }

  function start() {
    if (timer || disposed) return;
    timer = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;
      if (!enabled || !animator || options.isVisible?.() === false) return;
      animator.advance(delta);
      frame();
    }, 1000 / 24);
    timer.unref?.();
  }

  function rememberPosition(bounds) {
    if (!enabled || !bounds) return;
    preferences.x = Math.round(bounds.x);
    preferences.y = Math.round(bounds.y);
    persist();
  }

  return { bootstrap, command, snapshot, setEnabled, start, rememberPosition,
    observe: state => { if (enabled && !disposed) adapter.observe(state); },
    interaction: payload => {
      if (!enabled || !payload || !['loaded', 'loadFailed', 'click'].includes(payload.type)) return { ok: false, code: 'invalid_interaction' };
      if (payload.type === 'loadFailed') { failure = '栗栗 PNG 资源加载失败，请重新选择角色或检查本机资源。'; event('resource.load_failed', { message: failure }); }
      else if (payload.type === 'click') { animator.play('wave'); event('interaction.clicked'); }
      else event('resource.loaded', { id: 'lili', version: resource.manifest.version });
      return { ok: true };
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      enabled = false;
      clearInterval(timer);
      clearTimeout(bubbleTimer);
      animator?.removeAllListeners();
      resource = null;
      adapter = null;
      animator = null;
      event('lifecycle.destroyed');
    } };
}

module.exports = { createLiliHost };
