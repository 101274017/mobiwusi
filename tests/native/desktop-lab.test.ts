import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { CaptureSession, MAX_DURATION_MS, ACK_TIMEOUT_MS, STOP_REASONS, pointInBounds, checkedPoint, validTicket } = require('../../apps/desktop/native-lab/policy.cjs');
const source = (file: string) => readFileSync(new URL(`../../apps/desktop/native-lab/${file}`, import.meta.url), 'utf8');
const normalRequest = { trusted: true, userGesture: true, videoRequested: true, audioRequested: false, ownSourceId: 'window:12345:0' };
const details = { videoTracks: 1, audioTracks: 0, width: 640, height: 480 };
function running() {
  let now = 0;
  const session = new CaptureSession(() => now);
  const ticket = session.begin({ consent: true, overlay: false });
  expect(session.grant(normalRequest)).toEqual({ sourceId: 'window:12345:0' });
  expect(session.started(ticket, details)).toBe(true);
  return { session, ticket, advance: (value: number) => { now += value; } };
}

describe('C02 capture purpose and strict source policy', () => {
  it('starts without permission or frames and exposes no capture source in snapshot', () => {
    const session = new CaptureSession();
    expect(session.snapshot()).toMatchObject({ phase: 'idle', frames: 0, cleanupPending: false });
    expect(session.snapshot()).not.toHaveProperty('nonce');
    expect(session.grant(normalRequest)).toBeNull();
  });
  it.each([null, undefined, {}, [], { consent: false, overlay: false }, { consent: 1, overlay: false }, { consent: true, overlay: 'yes' }, { consent: true, overlay: false, sourceId: 'screen:0:0' }])('rejects missing, coercive or extra purpose fields: %j', (options) => {
    const session = new CaptureSession();
    expect(() => session.begin(options)).toThrow();
    expect(session.snapshot().phase).toBe('idle');
  });
  it('issues a fresh nonce and consumes permission only once', () => {
    const session = new CaptureSession();
    const ticket = session.begin({ consent: true, overlay: false });
    expect(validTicket(ticket)).toBe(true);
    expect(() => session.begin({ consent: true, overlay: true })).toThrow();
    expect(session.grant(normalRequest)).not.toBeNull();
    expect(session.grant(normalRequest)).toBeNull();
  });
  it.each([
    { trusted: false }, { userGesture: false }, { userGesture: 'true' }, { videoRequested: false }, { audioRequested: true },
    { ownSourceId: 'screen:0:0' }, { ownSourceId: 'window:1:0\n' }, { ownSourceId: 'window:-1:0' }, { ownSourceId: 'window:1:0 extra' },
  ])('denies untrusted, unactivated, audio or non-window requests: %j', (overrides) => {
    const session = new CaptureSession();
    session.begin({ consent: true, overlay: false });
    expect(session.grant({ ...normalRequest, ...overrides })).toBeNull();
    expect(session.snapshot().phase).toBe('awaiting');
  });
  it('rejects extra request fields and expired authorization', () => {
    let now = 0;
    const session = new CaptureSession(() => now);
    session.begin({ consent: true, overlay: false });
    expect(session.grant({ ...normalRequest, extra: true })).toBeNull();
    now = 5_000;
    expect(session.grant(normalRequest)).toBeNull();
    expect(session.snapshot()).toMatchObject({ phase: 'stopping', reason: 'authorization-expired' });
  });
  it.each([{ audioTracks: 1 }, { videoTracks: 0 }, { videoTracks: 2 }, { width: 0 }, { height: 4097 }, { width: 1281 }, { height: 721 }, { width: 2.5 }, { width: NaN }, { width: Infinity }, { extra: true }])('requires one bounded video track and no audio: %j', (overrides) => {
    const session = new CaptureSession();
    const ticket = session.begin({ consent: true, overlay: false });
    session.grant(normalRequest);
    expect(session.started(ticket, { ...details, ...overrides })).toBe(false);
    expect(session.snapshot().phase).toBe('starting');
  });
  it('cannot accept a forged nonce, generation, extra ticket fields or trailing newline', () => {
    const { session, ticket } = running();
    for (const forged of [{ ...ticket, nonce: 'forged' }, { ...ticket, generation: ticket.generation + 1 }, { ...ticket, extra: true }, { ...ticket, nonce: ticket.nonce + '\n' }]) expect(session.frame(forged, 1)).toBe(false);
    expect(session.snapshot().frames).toBe(0);
  });
});

describe('C02 stop fence and late result isolation', () => {
  it.each([...STOP_REASONS] as string[])('fences every supported stop path: %s', (reason) => {
    const { session, ticket } = running();
    const generation = session.snapshot().generation;
    expect(session.stop(reason)).toBe(true);
    expect(session.snapshot()).toMatchObject({ phase: 'stopping', generation: generation + 1, reason, cleanupPending: true });
    expect(session.frame(ticket, 1)).toBe(false);
    expect(session.started(ticket, details)).toBe(false);
    expect(() => session.begin({ consent: true, overlay: false })).toThrow();
    expect(session.acknowledge(ticket, { pendingCapture: false, liveTracks: 0 })).toBe(true);
    expect(session.snapshot()).toMatchObject({ phase: 'stopped', cleanupPending: false });
  });
  it.each([{ pendingCapture: true, liveTracks: 0 }, { pendingCapture: false, liveTracks: 1 }, { pendingCapture: false, liveTracks: '0' }, { pendingCapture: false, liveTracks: 0, extra: true }])('does not call pending or live resources stopped: %j', (proof) => {
    const { session, ticket } = running();
    session.stop('user');
    expect(session.acknowledge(ticket, proof)).toBe(false);
    expect(session.snapshot().cleanupPending).toBe(true);
  });
  it('preserves the first stop reason and invalidates delayed start', () => {
    const session = new CaptureSession();
    const ticket = session.begin({ consent: true, overlay: false });
    session.stop('user');
    const first = session.snapshot();
    expect(session.stop('capture-ended')).toBe(false);
    expect(session.snapshot()).toEqual(first);
    expect(session.grant(normalRequest)).toBeNull();
    expect(session.started(ticket, details)).toBe(false);
  });
  it('does not let an old acknowledgement release a new run', () => {
    const { session, ticket } = running();
    session.stop('user');
    session.acknowledge(ticket, { pendingCapture: false, liveTracks: 0 });
    const next = session.begin({ consent: true, overlay: false });
    session.grant(normalRequest);
    session.started(next, details);
    session.stop('user');
    expect(session.acknowledge(ticket, { pendingCapture: false, liveTracks: 0 })).toBe(false);
    expect(session.snapshot().cleanupPending).toBe(true);
    expect(session.acknowledge(next, { pendingCapture: false, liveTracks: 0 })).toBe(true);
  });
  it('uses a fresh ticket after explicit restart, never automatically resumes', () => {
    const { session, ticket } = running();
    session.stop('user');
    session.acknowledge(ticket, { pendingCapture: false, liveTracks: 0 });
    const next = session.begin({ consent: true, overlay: true });
    expect(next.generation).toBeGreaterThan(ticket.generation);
    expect(next.nonce).not.toBe(ticket.nonce);
    expect(session.snapshot().phase).toBe('awaiting');
    expect(session.frame(ticket, 1)).toBe(false);
  });
  it('checks authorization, capture and cleanup deadlines with a monotonic clock', () => {
    const { session, ticket, advance } = running();
    advance(MAX_DURATION_MS);
    expect(session.dueReason()).toBe('time-limit');
    expect(session.frame(ticket, 1)).toBe(false);
    expect(session.snapshot().reason).toBe('time-limit');
    advance(ACK_TIMEOUT_MS);
    expect(session.dueReason()).toBe('cleanup-timeout');
  });
  it('never restarts a terminated renderer as an authorized capture', () => {
    const { session, ticket } = running();
    session.rendererTerminated();
    expect(session.snapshot().phase).toBe('disposed');
    expect(session.frame(ticket, 1)).toBe(false);
    expect(() => session.begin({ consent: true, overlay: false })).toThrow();
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 2])('rejects invalid or out-of-order frame callback sequence: %s', (sequence) => {
    const { session, ticket } = running();
    expect(session.frame(ticket, sequence)).toBe(false);
    expect(session.snapshot().frames).toBe(0);
  });
  it('accepts sequential metadata only and rejects duplicate callbacks', () => {
    const { session, ticket } = running();
    expect(session.frame(ticket, 1)).toBe(true);
    expect(session.frame(ticket, 1)).toBe(false);
    expect(session.frame(ticket, 2)).toBe(true);
    expect(session.snapshot().frames).toBe(2);
  });
});

describe('C02 coordinate fixtures and build isolation, not hardware acceptance', () => {
  it.each([
    [{ x: -1920, y: -1080, width: 1920, height: 1080 }, { x: 0.5, y: 0.5 }, { x: -960, y: -540 }],
    [{ x: -2560, y: 200, width: 1280, height: 720 }, { x: 1, y: 0 }, { x: -1280, y: 200 }],
    [{ x: 0, y: 0, width: 800, height: 600 }, { x: 0.25, y: 1 }, { x: 200, y: 600 }],
  ])('preserves signed DIP origins for synthetic case %j', (bounds, normalized, expected) => {
    expect(pointInBounds(bounds, normalized)).toEqual(expected);
  });
  it.each([{ x: -0.1, y: 0 }, { x: 0, y: 1.1 }, { x: NaN, y: 0 }, { x: Infinity, y: 0 }, { x: 0, y: 0, extra: 1 }])('rejects out-of-bounds or nonfinite target: %j', (point) => {
    expect(() => pointInBounds({ x: -100, y: 0, width: 200, height: 200 }, point)).toThrow();
  });
  it('does not silently clamp invalid geometry or physical points', () => {
    expect(() => pointInBounds({ x: 0, y: 0, width: 0, height: 1 }, { x: 0, y: 0 })).toThrow();
    expect(() => checkedPoint({ x: 0, y: Infinity })).toThrow();
    expect(checkedPoint({ x: -100, y: -200 })).toEqual({ x: -100, y: -200 });
  });
  it('does not enable the normal host or package the lab into the normal demonstration', () => {
    const normal = readFileSync(new URL('../../apps/desktop/main.cjs', import.meta.url), 'utf8');
    const forge = require('../../apps/desktop/forge.config.cjs');
    expect(normal).toContain('externalCapture:false');
    expect(normal).not.toContain('setDisplayMediaRequestHandler');
    expect(forge.packagerConfig.ignore.some((expression: RegExp) => expression.test('/native-lab/main.cjs'))).toBe(true);
  });
  it('selects only the owned native window without listing desktop or other applications', () => {
    const main = source('main.cjs');
    expect(main).toContain('canary.getMediaSourceId()');
    expect(main).not.toMatch(/desktopCapturer|\.getSources\(/);
    expect(main).toContain('request.frame === control.webContents.mainFrame');
    expect(main).toContain('request.frame.url === expectedUrl(\'control.html\')');
    expect(main).toContain("connect-src 'none'");
  });
  it('has no encoder, peer, filesystem, microphone or raw pixel entry in the capture renderer', () => {
    expect(source('control.js')).not.toMatch(/MediaRecorder|RTCPeerConnection|WebSocket|fetch\(|getUserMedia|toDataURL|toBlob|\.getImageData\(/);
    expect(source('control.js')).toContain('audio: false');
    expect(source('control.js')).toContain('track.stop()');
    expect(source('main.cjs')).toContain('setIgnoreMouseEvents(true');
    expect(source('preload.cjs')).not.toMatch(/sourceId|sendInput|readFile/);
  });
});
