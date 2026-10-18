const { randomUUID } = require('node:crypto');

const STOP_REASONS = new Set(['user', 'capture-ended', 'time-limit', 'authorization-expired', 'display-changed', 'canary-changed', 'capture-failed', 'renderer-gone', 'control-closed', 'cleanup-timeout', 'app-quit', 'invalid-message', 'canary-hidden']);
const MAX_DURATION_MS = 30_000;
const ACK_TIMEOUT_MS = 1_000;

function exactRecord(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function validTicket(value) {
  return exactRecord(value, ['generation', 'nonce']) && Number.isSafeInteger(value.generation) && value.generation > 0 && typeof value.nonce === 'string' && /^[0-9a-f-]{36}$/.test(value.nonce);
}

class CaptureSession {
  #phase = 'idle';
  #generation = 0;
  #ticket = null;
  #frames = 0;
  #lateCallbacks = 0;
  #deadline = 0;
  #stoppingAt = 0;
  #reason = null;
  #clock;
  #overlay = false;

  constructor(clock = () => performance.now()) { this.#clock = clock; }

  snapshot() {
    return { phase: this.#phase, generation: this.#generation, frames: this.#frames, lateCallbacks: this.#lateCallbacks, reason: this.#reason, cleanupPending: this.#phase === 'stopping', overlay: this.#overlay, remainingMs: Math.max(0, Math.ceil(this.#deadline - this.#clock())) };
  }

  #matches(ticket) { return validTicket(ticket) && ticket.generation === this.#ticket?.generation && ticket.nonce === this.#ticket?.nonce; }

  begin(options) {
    if (!exactRecord(options, ['consent', 'overlay']) || options.consent !== true || typeof options.overlay !== 'boolean') throw new Error('本次用途同意缺失或字段不合法');
    if (!['idle', 'stopped'].includes(this.#phase)) throw new Error('仍有待完成的授权或清理');
    this.#generation += 1;
    this.#ticket = Object.freeze({ generation: this.#generation, nonce: randomUUID() });
    this.#phase = 'awaiting';
    this.#frames = 0;
    this.#lateCallbacks = 0;
    this.#reason = null;
    this.#overlay = options.overlay;
    this.#deadline = this.#clock() + 5_000;
    return { ...this.#ticket };
  }

  grant(request) {
    if (!exactRecord(request, ['trusted', 'userGesture', 'videoRequested', 'audioRequested', 'ownSourceId'])) return null;
    if (request.trusted !== true || request.userGesture !== true || request.videoRequested !== true || request.audioRequested !== false) return null;
    if (typeof request.ownSourceId !== 'string' || !/^window:[0-9]+:[0-9]+$/.test(request.ownSourceId)) return null;
    if (this.#phase !== 'awaiting') return null;
    if (this.#clock() >= this.#deadline) { this.stop('authorization-expired'); return null; }
    this.#phase = 'starting';
    this.#deadline = this.#clock() + MAX_DURATION_MS;
    return { sourceId: request.ownSourceId };
  }

  started(ticket, details) {
    if (!this.#matches(ticket) || this.#phase !== 'starting') return false;
    if (!exactRecord(details, ['videoTracks', 'audioTracks', 'width', 'height'])) return false;
    if (details.videoTracks !== 1 || details.audioTracks !== 0 || !Number.isSafeInteger(details.width) || !Number.isSafeInteger(details.height) || details.width < 1 || details.height < 1 || details.width > 1280 || details.height > 720) return false;
    if (this.#clock() >= this.#deadline) { this.stop('time-limit'); return false; }
    this.#phase = 'capturing';
    return true;
  }

  frame(ticket, sequence) {
    if (!this.#matches(ticket) || this.#phase !== 'capturing') { this.#lateCallbacks += 1; return false; }
    if (!Number.isSafeInteger(sequence) || sequence !== this.#frames + 1) return false;
    if (this.#clock() >= this.#deadline) { this.stop('time-limit'); return false; }
    this.#frames = sequence;
    return true;
  }

  stop(reason) {
    if (!STOP_REASONS.has(reason)) throw new Error('未知停止原因');
    if (['stopping', 'stopped', 'disposed'].includes(this.#phase)) return false;
    if (this.#phase === 'idle') { this.#phase = 'stopped'; this.#reason = reason; return true; }
    this.#generation += 1;
    this.#phase = 'stopping';
    this.#reason = reason;
    this.#deadline = 0;
    this.#stoppingAt = this.#clock();
    return true;
  }

  acknowledge(ticket, proof) {
    if (!this.#matches(ticket) || this.#phase !== 'stopping') return false;
    if (!exactRecord(proof, ['pendingCapture', 'liveTracks']) || proof.pendingCapture !== false || proof.liveTracks !== 0) return false;
    this.#phase = 'stopped';
    this.#ticket = null;
    return true;
  }

  dueReason() {
    if (this.#phase === 'awaiting' && this.#clock() >= this.#deadline) return 'authorization-expired';
    if (['starting', 'capturing'].includes(this.#phase) && this.#clock() >= this.#deadline) return 'time-limit';
    if (this.#phase === 'stopping' && this.#clock() - this.#stoppingAt >= ACK_TIMEOUT_MS) return 'cleanup-timeout';
    return null;
  }

  rendererTerminated() {
    if (!['stopped', 'disposed'].includes(this.#phase)) this.stop('renderer-gone');
    this.#phase = 'disposed';
    this.#ticket = null;
  }
}

function pointInBounds(bounds, normalized) {
  if (!exactRecord(bounds, ['x', 'y', 'width', 'height']) || !Object.values(bounds).every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) throw new Error('窗口边界无效');
  if (!exactRecord(normalized, ['x', 'y']) || !Object.values(normalized).every(value => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error('归一化点无效');
  return { x: bounds.x + bounds.width * normalized.x, y: bounds.y + bounds.height * normalized.y };
}

function checkedPoint(point) {
  if (!exactRecord(point, ['x', 'y']) || !Object.values(point).every(Number.isFinite)) throw new Error('坐标无效');
  return { x: point.x, y: point.y };
}

module.exports = { CaptureSession, MAX_DURATION_MS, ACK_TIMEOUT_MS, STOP_REASONS, exactRecord, validTicket, pointInBounds, checkedPoint };
