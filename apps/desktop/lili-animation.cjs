const { EventEmitter } = require('node:events');

class AnimationController extends EventEmitter {
  constructor(manifest) {
    super();
    this.manifest = manifest;
    this.queue = [];
    this.current = { clip: 'idle', action: 'idle', priority: 0, requestId: 0 };
    this.desiredState = 'idle';
    this.elapsedMs = 0;
    this.sequence = 0;
    this.paused = false;
    this.reducedMotion = false;
    this.expression = null;
    this.intensity = 1;
    this.stopPending = false;
  }

  event(type, payload = {}) { this.emit('event', { type, ...payload }); }

  switchTo(clip, request = {}) {
    this.current = { clip, action: clip.startsWith('rest_') ? 'rest' : clip,
      priority: this.manifest.clips[clip].priority, requestId: ++this.sequence, ...request };
    this.elapsedMs = 0;
    if (!['idle', 'rest_loop', 'rest_exit'].includes(clip)) this.event('action.started', this.current);
    this.event('state.changed', { state: this.snapshot() });
  }

  get locked() {
    return !this.manifest.clips[this.current.clip].interruptible || ['rest_enter', 'rest_exit'].includes(this.current.clip);
  }

  play(action, options = {}) {
    if (!this.manifest.actions.includes(action)) return { ok: false, code: 'unsupported_action' };
    if (!options || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some(key => !['priority', 'enqueue'].includes(key))
      || ('enqueue' in options && typeof options.enqueue !== 'boolean')) return { ok: false, code: 'invalid_options' };
    if ('priority' in options && (!Number.isFinite(options.priority) || options.priority < 0 || options.priority > 100)) return { ok: false, code: 'invalid_priority' };
    if (action === 'idle') return this.stop();
    if (action === 'rest') {
      this.desiredState = 'rest';
      if (this.current.clip === 'idle') this.switchTo('rest_enter');
      return { ok: true, status: this.current.action === 'rest' ? 'resting' : 'scheduled' };
    }
    if (this.current.action === action || this.queue.some(request => request.action === action)) {
      this.event('action.coalesced', { action });
      return { ok: true, status: 'coalesced' };
    }
    const request = { action, priority: options.priority ?? this.manifest.clips[action].priority, requestId: ++this.sequence };
    if (this.current.clip === 'idle') {
      this.switchTo(action, request);
      return { ok: true, status: 'started', requestId: request.requestId };
    }
    if (this.queue.length >= 4) return { ok: false, code: 'queue_full', limit: 4 };
    if (this.current.clip === 'rest_loop') {
      this.queue.push(request);
      this.switchTo('rest_exit');
      return { ok: true, status: 'waking', requestId: request.requestId };
    }
    if (!this.locked && !options.enqueue && request.priority > this.current.priority) {
      this.event('action.completed', { ...this.current, reason: 'interrupted' });
      this.switchTo(action, request);
      return { ok: true, status: 'started', requestId: request.requestId };
    }
    this.queue.push(request);
    this.queue.sort((first, second) => second.priority - first.priority || first.requestId - second.requestId);
    this.event('state.changed', { state: this.snapshot() });
    return { ok: true, status: 'queued', requestId: request.requestId };
  }

  stop() {
    for (const request of this.queue) this.event('action.completed', { ...request, reason: 'cancelled_before_start' });
    this.queue = [];
    this.desiredState = 'idle';
    if (this.locked) {
      this.stopPending = true;
      return { ok: true, status: 'deferred_until_safe', clip: this.current.clip };
    }
    if (this.current.clip === 'rest_loop') this.switchTo('rest_exit');
    else {
      if (this.current.clip !== 'idle') this.event('action.completed', { ...this.current, reason: 'stopped' });
      this.switchTo('idle');
    }
    return { ok: true, status: 'stopping' };
  }

  setExpression(expression, intensity = 1) {
    if (expression !== null && !this.manifest.expressions.includes(expression)) return { ok: false, code: 'unsupported_expression' };
    if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) return { ok: false, code: 'invalid_intensity' };
    this.expression = expression;
    this.intensity = intensity;
    this.event('state.changed', { state: this.snapshot() });
    return { ok: true, expression: expression ?? 'action_default', intensity };
  }

  configure(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some(key => !['paused', 'reducedMotion'].includes(key) || typeof options[key] !== 'boolean')) return { ok: false, code: 'invalid_options' };
    if ('paused' in options) this.paused = options.paused;
    if ('reducedMotion' in options) this.reducedMotion = options.reducedMotion;
    this.event('state.changed', { state: this.snapshot() });
    return { ok: true, paused: this.paused, reducedMotion: this.reducedMotion };
  }

  finish() {
    const finished = this.current;
    if (!['idle', 'rest_loop', 'rest_exit'].includes(finished.clip)) this.event('action.completed', { ...finished, reason: 'finished' });
    if (finished.clip === 'rest_enter') {
      this.switchTo(this.stopPending || this.queue.length || this.desiredState !== 'rest' ? 'rest_exit' : 'rest_loop');
      this.stopPending = false;
      return;
    }
    this.stopPending = false;
    if (this.queue.length) {
      const request = this.queue.shift();
      this.switchTo(request.action, request);
    } else this.switchTo(this.desiredState === 'rest' ? 'rest_enter' : 'idle');
  }

  advance(deltaMs) {
    if (this.paused || !Number.isFinite(deltaMs)) return;
    const duration = this.manifest.clips[this.current.clip].count * 1000 / this.manifest.fps;
    this.elapsedMs += Math.max(0, Math.min(250, deltaMs));
    if (this.elapsedMs >= duration) {
      if (this.manifest.clips[this.current.clip].loop) this.elapsedMs %= duration;
      else this.finish();
    }
  }

  snapshot() {
    const clip = this.manifest.clips[this.current.clip];
    let frame = Math.min(clip.count - 1, Math.floor(this.elapsedMs * this.manifest.fps / 1000));
    if (this.reducedMotion) {
      if (clip.loop || this.current.clip === 'success') frame = 0;
      else if (['wave', 'guide'].includes(this.current.clip)) frame = Math.floor(clip.count / 2);
    }
    const data = this.manifest.frames[this.current.clip][frame];
    const expression = this.expression ?? clip.expression;
    let eye = data.eye;
    if (expression === 'blink') {
      const phase = this.elapsedMs % 3600;
      eye = phase < 1400 || phase > 2200 ? 0 : phase < 1550 || phase > 2000 ? 1 : phase < 1700 || phase > 1850 ? 2 : 3;
    }
    if (this.reducedMotion) eye = expression === 'sleepy' ? 3 : 0;
    return { ...this.current, frame, expression, intensity: this.intensity, eye, paused: this.paused,
      reducedMotion: this.reducedMotion, desiredState: this.desiredState, queue: this.queue.map(request => request.action) };
  }
}

module.exports = { AnimationController };
