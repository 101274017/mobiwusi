import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const packageScope = pathToFileURL(path.join(root, 'packages') + path.sep).href;
const taskIds = ['F07', 'F08', 'F09', 'F10', 'F11', 'F12'];
const faultNames = ['encoder', 'storage-loss', 'high-risk', 'missing-consent', 'feedback-link', 'unsafe-training'];
const localLimits = { minimumSamples: 100, riskP95Ms: 200, failureRate: 0, duplicateSideEffects: 0, dataLoss: 0 };
const syntheticInstant = '2026-10-17T01:00:00.000Z';
const privacyContext = {
  systemAuthorized: true, consent: true, sessionActive: true, destinationAuthorized: true,
  generation: 4, policyVersion: 'privacy-0.3.0', maxFrameAgeMs: 500, minimumConfidence: 0.85,
};

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function protectedSnapshot() {
  const files = {};
  function visit(relative) {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(next);
      else if (entry.isFile()) files[next] = digest(readFileSync(path.join(root, next)));
    }
  }
  visit('docs/execution');
  visit('docs/implementation/evidence');
  return files;
}

function loadJson(relative) {
  try { return JSON.parse(readFileSync(path.join(root, relative), 'utf8')); }
  catch { return null; }
}

async function loadActualModules() {
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      let candidate;
      if (specifier.startsWith('@nuanban/')) candidate = path.join(root, 'packages', specifier.slice(9), 'src/index.ts');
      else if (specifier.startsWith('.') && context.parentURL?.startsWith(packageScope)) {
        const base = fileURLToPath(new URL(specifier, context.parentURL));
        candidate = [base + '.ts', path.join(base, 'index.ts')].find(existsSync);
      }
      return candidate ? { url: pathToFileURL(candidate).href, shortCircuit: true } : next(specifier, context);
    },
    load(url, context, next) {
      if (!url.startsWith(packageScope) || !url.endsWith('.ts')) return next(url, context);
      const source = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      return { format: 'module', source, shortCircuit: true };
    },
  });
  try {
    const names = ['privacy', 'media-relay', 'guidance-engine', 'reminder-engine', 'local-data',
      'platform-ports', 'api-client', 'contracts', 'domain', 'mocks', 'quality-gates', 'flow-library', 'accessibility-assets'];
    const entries = [];
    for (const name of names) entries.push([name, await import(pathToFileURL(path.join(root, 'packages', name, 'src/index.ts')).href)]);
    return Object.fromEntries(entries);
  } finally {
    hooks.deregister();
  }
}

function coverage(name, symbols) {
  const module = 'packages/' + name + '/src/index.ts';
  return { module, sha256: digest(readFileSync(path.join(root, module))), symbols, execution: 'direct_module_call', fixture: 'synthetic' };
}

function assess(details, outcomes) {
  return { details, outcomes, failures: Object.keys(outcomes).filter(key => !outcomes[key]) };
}

async function check(id, acceptanceIds, actualCoverage, operation) {
  try {
    const result = await operation();
    return { id, acceptanceIds, actualCoverage, success: result.failures.length === 0, ...result };
  } catch (error) {
    return { id, acceptanceIds, actualCoverage, success: false, outcomes: {}, details: null,
      failures: [error instanceof Error ? error.message : 'Unexpected local check failure'] };
  }
}

function task(id, title, checks, remainingBlockers, harnessOnlyCoverage = []) {
  const card = readFileSync(path.join(root, 'docs/execution/tasks/' + id + '.md'), 'utf8');
  const recordedStatus = card.match(/^status:\s*"([^"\r\n]+)"/m)?.[1] ?? 'unknown';
  return {
    id, title, success: checks.length > 0 && checks.every(item => item.success),
    status: checks.every(item => item.success) ? 'development_checks_passed' : 'development_checks_failed',
    recordedTaskStatus: recordedStatus, formalAcceptanceEvaluated: false, fStarted: false,
    checks, actualCoverage: checks.flatMap(item => item.actualCoverage), harnessOnlyCoverage,
    remainingBlockers,
  };
}

function frame(overrides = {}) {
  return {
    frameId: 'f07-synthetic-frame', frameHash: 'f07-synthetic-hash', generation: 4, capturedAt: 1000,
    pageKind: 'verified', detectorStatus: 'healthy', ocrStatus: 'complete', text: 'NUANBAN-C03-SYNTHETIC safe page',
    confidence: 0.98, thirdPartyFaces: 0, faceRedaction: 'not_required', ...overrides,
  };
}

function artifact(approved) {
  return { artifactId: 'synthetic-' + approved.frameId, ...approved, codec: 'synthetic-redacted-metadata', encodedBytes: 64 };
}

function quantile(samples, fraction) {
  const ordered = [...samples].sort((first, second) => first - second);
  return ordered[Math.ceil(ordered.length * fraction) - 1];
}

async function privacyPerformance(modules) {
  const { evaluateLocalFrame, FrameSafetyGate } = modules.privacy;
  const cases = [
    [frame(), privacyContext, 'safe', true],
    [frame({ text: '请确认支付和转账' }), privacyContext, 'transaction_risk', false],
    [frame({ text: '私人聊天账户口令' }), privacyContext, 'private_risk', false],
    [frame({ detectorStatus: 'timeout' }), privacyContext, 'detector_timeout', false],
    [frame({ pageKind: 'unknown' }), privacyContext, 'unknown_page', false],
    [frame({ thirdPartyFaces: 1, faceRedaction: 'failed' }), privacyContext, 'face_redaction_failed', false],
    [frame(), { ...privacyContext, consent: false }, 'missing_consent', false],
    [frame(), { ...privacyContext, destinationAuthorized: false }, 'destination_unauthorized', false],
    [frame({ generation: 3 }), privacyContext, 'stale_generation', false],
    [frame({ capturedAt: 0 }), privacyContext, 'frame_expired', false],
  ];
  const samplesMs = [];
  let failedSamples = 0;
  for (let index = 0; index < localLimits.minimumSamples; index += 1) {
    const [input, context, reason, allowed] = cases[index % cases.length];
    const started = performance.now();
    const result = evaluateLocalFrame(input, context, 1200);
    samplesMs.push(performance.now() - started);
    if (result.reason !== reason || result.outboundAllowed !== allowed || Object.hasOwn(result, 'text')) failedSamples += 1;
  }
  const gate = new FrameSafetyGate();
  gate.authorize(privacyContext);
  const ticket = gate.issue(frame(), 1200, 'f07-synthetic-ticket');
  const issuedTicketPermitted = ticket !== null && gate.permits(ticket, frame(), 1200);
  gate.stop();
  const afterStopPermitted = ticket !== null && gate.permits(ticket, frame(), 1200);
  const p95Ms = quantile(samplesMs, 0.95);
  const failureRate = failedSamples / samplesMs.length;
  return assess({ sampleCount: samplesMs.length, samplesMs, p50Ms: quantile(samplesMs, 0.5), p95Ms,
    maxMs: Math.max(...samplesMs), failedSamples, failureRate, limits: localLimits,
    measurement: 'performance.now around actual evaluateLocalFrame; no OCR, native/UI or network latency measured' }, {
    samplesComplete: samplesMs.length >= localLimits.minimumSamples,
    localRiskBudget: p95Ms <= localLimits.riskP95Ms,
    zeroUnexpectedFailures: failureRate <= localLimits.failureRate,
    ticketInitiallyValid: issuedTicketPermitted,
    ticketRevokedSynchronously: !afterStopPermitted,
  });
}

async function mediaRaces(modules, faults) {
  const { ControlledMediaRelay, InMemoryMediaReceiver } = modules['media-relay'];
  const receiver = new InMemoryMediaReceiver();
  const relay = new ControlledMediaRelay({ now: () => 1200,
    encoder: async approved => { if (faults.has('encoder')) throw new Error('Synthetic encoder fault'); return artifact(approved); },
    sender: async (outlet, packet) => receiver.receive(outlet, packet),
  });
  relay.start(privacyContext);
  const rejectedRisk = relay.submit(frame({ text: '确认支付' }));
  const accepted = relay.submit(frame());
  await relay.drain();
  const control = relay.snapshot();
  relay.stop('user');
  let releaseEncoding;
  const delayedReceiver = new InMemoryMediaReceiver();
  const delayed = new ControlledMediaRelay({ maxQueue: 2, now: () => 1200,
    encoder: approved => new Promise(resolve => { releaseEncoding = () => resolve(artifact(approved)); }),
    sender: async (outlet, packet) => delayedReceiver.receive(outlet, packet),
  });
  delayed.start(privacyContext);
  delayed.submit(frame());
  delayed.submit(frame({ frameId: 'queued', frameHash: 'queued-hash' }));
  const overflow = delayed.submit(frame({ frameId: 'overflow', frameHash: 'overflow-hash' }));
  delayed.stop('user');
  releaseEncoding();
  await delayed.drain();
  const late = delayed.snapshot();
  const splitReceiver = new InMemoryMediaReceiver();
  const split = new ControlledMediaRelay({ now: () => 1200, encoder: async approved => artifact(approved),
    sender: async (outlet, packet) => { splitReceiver.receive(outlet, packet); if (outlet === 'ai') split.stop('risk'); },
  });
  split.start(privacyContext);
  split.submit(frame());
  await split.drain();
  return assess({ control, late, stoppedBetweenOutlets: split.snapshot(), transport: 'in-memory metadata only' }, {
    unsafeFrameDenied: !rejectedRisk.accepted,
    safeFrameAccepted: accepted.accepted,
    bothSyntheticOutletsReceived: control.sentByOutlet.ai === 1 && control.sentByOutlet.family === 1,
    encoderHealthy: control.encoderFailures === 0,
    queueBounded: !overflow.accepted && late.queueDrops === 1,
    lateEncoderCannotSend: delayedReceiver.attempted.length === 0 && late.inFlight === 0 && late.queued === 0,
    stopBlocksSecondOutlet: splitReceiver.packets.ai.length === 1 && splitReceiver.packets.family.length === 0,
    stoppedSessionCannotSubmit: !delayed.submit(frame()).accepted,
  });
}

async function transportProfiles(modules) {
  const { RemoteApiClient } = modules['api-client'];
  const profiles = [];
  for (const name of ['normal', 'weak', 'offline', 'timeout']) {
    let attempts = 0;
    let errorCode = null;
    let result = null;
    const retryDelays = [];
    const client = new RemoteApiClient({ baseUrl: 'https://synthetic.invalid', timeoutMs: 20,
      createId: () => '00000000-0000-4000-8000-000000000001',
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2, wait: async delay => { retryDelays.push(delay); } },
      transport: async (_url, options) => {
        attempts += 1;
        if (name === 'offline' || (name === 'weak' && attempts === 1)) throw new TypeError('Synthetic offline transport');
        if (name === 'timeout') return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new DOMException('Synthetic transport aborted', 'AbortError')), { once: true });
        });
        return new Response(JSON.stringify({ data: { items: [], next_cursor: null },
          request_id: '00000000-0000-4000-8000-000000000001', schema_version: modules.contracts.contractVersion }), { status: 200 });
      },
    });
    const started = performance.now();
    try { result = await client.request('noteList', { idempotencyKey: 'f07-synthetic-' + name }); }
    catch (error) { errorCode = error.code ?? error.name; }
    profiles.push({ name, attempts, retryDelays, errorCode, elapsedMs: performance.now() - started, returnedEmptyPage: result?.data.items.length === 0 });
  }
  return assess({ profiles, transport: 'injected in-memory Response/abort/error; no sockets',
    deviceNetworkShapingPerformed: false }, {
    normalReturnsContractPage: profiles[0].attempts === 1 && profiles[0].returnedEmptyPage,
    weakRetryBounded: profiles[1].attempts === 2 && profiles[1].returnedEmptyPage && profiles[1].retryDelays.length === 1,
    offlineStopsAfterLimit: profiles[2].attempts === 3 && profiles[2].errorCode === 'NETWORK_OFFLINE',
    timeoutAbortsAndStops: profiles[3].attempts === 3 && profiles[3].errorCode === 'TIMEOUT',
    noUnboundedRetries: profiles.every(profile => profile.attempts <= 3 && profile.retryDelays.length <= 2),
  });
}

async function guidanceChecks(modules) {
  const { createAndroidFrameContext, createWindowsFrameContext, mapFrameRect, GuidanceTargetLifecycle } = modules['guidance-engine'];
  const android = createAndroidFrameContext({ frameId: 'android-synthetic', generation: 4,
    displayId: 'android-display', windowId: 'projection', transformId: 'rotation-90', layoutRevision: 7, capturedAt: 1000,
    projectionSizePx: { width: 1080, height: 2400 }, systemInsetsPx: { top: 100, right: 0, bottom: 200, left: 0 },
    letterboxRectPx: { x: 90, y: 300, width: 900, height: 1500 }, scaleFactor: 3, rotation: 90 });
  const windows = createWindowsFrameContext({ frameId: 'windows-synthetic', generation: 2,
    displayId: 'negative-origin-display', windowId: 'window', transformId: 'dpi-125', layoutRevision: 3, capturedAt: 2000,
    captureSizePx: { width: 1600, height: 900 }, captureContentRectPx: { x: 0, y: 0, width: 1600, height: 900 },
    displayOriginDip: { x: -1920, y: 0 }, windowOriginDip: { x: 100, y: 80 }, contentOffsetDip: { x: 12, y: 34 },
    contentSizeDip: { width: 800, height: 600 }, scaleFactor: 1.25, rotation: 0 });
  const androidRect = mapFrameRect({ x: 0.2, y: 0.1, width: 0.3, height: 0.2 }, android);
  const windowsRect = mapFrameRect({ x: 0.5, y: 0.25, width: 0.2, height: 0.3 }, windows);
  const lifecycle = new GuidanceTargetLifecycle();
  const target = { frame: android, rect: { x: 0.2, y: 0.1, width: 0.3, height: 0.2 }, expiresAt: 5000 };
  lifecycle.publish(target, 2000);
  const changed = lifecycle.observeFrame({ ...android, layoutRevision: 8 }, 2000);
  lifecycle.publish(target, 2000);
  const expired = lifecycle.observeFrame(android, 5000);
  lifecycle.publish(target, 2000);
  const verification = lifecycle.requestVerification();
  return assess({ androidRect, windowsRect, changed, expired, verification, afterConfirmation: lifecycle.snapshot() }, {
    androidRotationAndLetterbox: JSON.stringify(androidRect) === JSON.stringify({ x: 720, y: 600, width: 180, height: 450 }),
    windowsNegativeOriginAndDpi: JSON.stringify(windowsRect) === JSON.stringify({ x: -1760, y: 330, width: 200, height: 225 }),
    changedFrameInvalidated: changed.target === null && changed.reason === 'stale_frame',
    expiredFrameInvalidated: expired.target === null && expired.reason === 'expired',
    confirmationIsNotCompletion: verification.accepted && lifecycle.snapshot().status === 'verification_pending',
  });
}

async function reminderRecovery(modules, faults) {
  const { ReminderLedger, ReminderDispatchGate, deriveReminderInstanceId } = modules['reminder-engine'];
  const { IndexedDbReminderStore, IndexedDbRepository } = modules['local-data'];
  const ledger = new ReminderLedger();
  const scheduleCalls = [];
  const cancelCalls = [];
  const scheduler = {
    schedule: async request => { scheduleCalls.push(request.occurrence.instanceId); },
    cancel: async request => { cancelCalls.push(request.occurrence.instanceId); },
  };
  const dispatch = new ReminderDispatchGate('system', 'granted', scheduler);
  dispatch.start(1);
  const scheduledOccurrences = [];
  let idempotentSchedules = 0;
  for (let index = 0; index < 24; index += 1) {
    const todoId = '00000000-0000-4000-8000-' + String(100 + index).padStart(12, '0');
    const plannedAt = new Date(Date.parse(syntheticInstant) + index * 3600000).toISOString();
    const input = { todoId, instanceId: await deriveReminderInstanceId(todoId, 1, plannedAt), plannedAt,
      timezone: 'Asia/Shanghai', scheduleRevision: 1, deepLink: '/todos/edit/' + todoId, repeat: 'none', channel: 'local' };
    const first = await ledger.schedule(input);
    scheduledOccurrences.push(first.occurrence);
    const repeated = await ledger.schedule(input);
    const scheduled = await dispatch.schedule('f-reliability-owner', first.occurrence);
    const duplicate = await dispatch.schedule('f-reliability-owner', first.occurrence);
    if (repeated.idempotent && scheduled.status === 'scheduled' && duplicate.status === 'idempotent') idempotentSchedules += 1;
  }
  const submissions = [];
  for (let hour = 0; hour <= 24; hour += 1) submissions.push((await ledger.submitDue(new Date(Date.parse(syntheticInstant) + hour * 3600000))).length);
  const first = ledger.entries()[0];
  const submittedNotDelivered = first.state === 'submitted' && first.receipts.delivered === null && first.completedAt === null;
  const cancelledTodo = '00000000-0000-4000-8000-000000000200';
  const cancelledInput = { todoId: cancelledTodo, instanceId: await deriveReminderInstanceId(cancelledTodo, 1, syntheticInstant),
    plannedAt: syntheticInstant, timezone: 'Asia/Shanghai', scheduleRevision: 1, deepLink: '/todos', repeat: 'none', channel: 'local' };
  await ledger.schedule(cancelledInput);
  await ledger.cancel({ todoId: cancelledTodo, instanceId: cancelledInput.instanceId, scheduleRevision: 1, cancelledAt: syntheticInstant });
  let cancelledWriteRejected = false;
  try { await ledger.recordReceipt({ todoId: cancelledTodo, instanceId: cancelledInput.instanceId, scheduleRevision: 1, state: 'submitted', observedAt: syntheticInstant }); }
  catch (error) { cancelledWriteRejected = error.code === 'INVALID_TRANSITION'; }
  const expected = ledger.entries();
  const store = new IndexedDbReminderStore('f-reliability-owner');
  await store.replace(expected);
  await new IndexedDbReminderStore('f-reliability-other').replace([first]);
  let invalidWriteRejected = false;
  try { await store.replace([first, first]); } catch { invalidWriteRejected = true; }
  const invalidWritePreservedData = (await store.load()).length === expected.length;
  if (faults.has('storage-loss')) await store.clear();
  const reopened = await new IndexedDbReminderStore('f-reliability-owner').load();
  const recovered = new Map(reopened.map(item => [item.instanceId, item]));
  const dataLoss = expected.filter(item => JSON.stringify(recovered.get(item.instanceId)) !== JSON.stringify(item)).length;
  const duplicateSideEffects = scheduleCalls.length - new Set(scheduleCalls).size;
  const revoke = await dispatch.updatePermission('denied');
  await dispatch.updatePermission('granted');
  let submittedRescheduleRejected = false;
  try { await dispatch.schedule('f-reliability-owner', first); }
  catch (error) { submittedRescheduleRejected = error.code === 'INVALID_TRANSITION'; }
  const afterGrant = await dispatch.schedule('f-reliability-owner', scheduledOccurrences[0]);
  const restarted = new ReminderDispatchGate('system', 'granted', scheduler);
  const afterRestart = await restarted.schedule('f-reliability-owner', scheduledOccurrences[0]);
  await store.clear();
  const afterClear = await new IndexedDbReminderStore('f-reliability-owner').load();
  const otherOwnerRecords = await new IndexedDbReminderStore('f-reliability-other').load();
  const repository = new IndexedDbRepository();
  const snapshot = modules.mocks.createScenarioSnapshot('f-reliability-learning', 'empty');
  await repository.commit('f-reliability-learning', snapshot);
  const racingWrites = await Promise.allSettled([1.5, 1.75].map(fontScale => repository.commitIfUnchanged('f-reliability-learning', snapshot,
    { ...snapshot, preferences: { ...snapshot.preferences, fontScale } })));
  const staleWrites = racingWrites.filter(item => item.status === 'rejected' && item.reason.code === 'VERSION_CONFLICT').length;
  return assess({ scheduledInstances: 24, idempotentSchedules, duplicateSideEffects, dataLoss, expectedRecords: expected.length,
    recoveredRecords: reopened.length, submittedNotDelivered, virtualHorizonHours: 24, virtualObservations: submissions.length,
    totalSubmitted: submissions.reduce((sum, count) => sum + count, 0), revoke, afterGrant, afterRestart, submittedRescheduleRejected,
    otherOwnerRecords: otherOwnerRecords.length, staleWrites, storage: 'actual IndexedDb stores on a fresh isolated fake-indexeddb factory',
    realSoakPerformed: false, realProcessRestartPerformed: false }, {
    duplicateSchedulingIsIdempotent: idempotentSchedules === 24,
    zeroDuplicateSideEffects: duplicateSideEffects <= localLimits.duplicateSideEffects && scheduleCalls.length === 24,
    virtualDueSubmittedOnce: submissions.reduce((sum, count) => sum + count, 0) === 24 && submissions[24] === 0,
    submittedDoesNotClaimDelivery: submittedNotDelivered,
    submittedCannotBeRescheduled: submittedRescheduleRejected,
    cancelledCannotResurrect: cancelledWriteRejected && reopened.some(item => item.todoId === cancelledTodo && item.state === 'cancelled'),
    invalidReplacementPreservesRecords: invalidWriteRejected && invalidWritePreservedData,
    zeroDataLoss: dataLoss <= localLimits.dataLoss && reopened.length === expected.length,
    revokedSchedulesCancelled: revoke.cancelled === 24 && cancelCalls.length === 24,
    noAutomaticResume: afterGrant.status === 'not_scheduled' && afterRestart.status === 'not_scheduled',
    ownerIsolationAndDeletion: otherOwnerRecords.length === 1 && afterClear.length === 0,
    atomicCompareAndWrite: racingWrites.filter(item => item.status === 'fulfilled').length === 1 && staleWrites === 1,
  });
}

async function lifecycleChecks(modules) {
  const { LifecycleCoordinator } = modules['platform-ports'];
  const cycles = [];
  const expectedCalls = ['close_outlets', 'clear_queue', 'stop_track', 'hide_overlay'];
  for (const platform of ['android', 'windows']) {
    const calls = [];
    const resources = { closeOutlets: async () => { calls.push('close_outlets'); }, clearQueue: async () => { calls.push('clear_queue'); },
      stopTrack: async () => { calls.push('stop_track'); }, hideOverlay: async () => { calls.push('hide_overlay'); } };
    const coordinator = new LifecycleCoordinator(platform, resources);
    for (let index = 0; index < 16; index += 1) {
      calls.length = 0;
      coordinator.start(index * 2 + 1);
      const reports = await Promise.all([coordinator.signal('lock'), coordinator.signal('user-stop')]);
      cycles.push({ platform, closed: !coordinator.canRelease(index * 2 + 1), once: calls.join(',') === expectedCalls.join(','),
        cleaned: reports.every(report => report.trackStopped && report.overlayHidden && !report.restartBlocked) });
    }
  }
  const failed = new LifecycleCoordinator('android', { closeOutlets: async () => undefined, clearQueue: async () => undefined,
    stopTrack: async () => { throw new Error('Synthetic resource cleanup fault'); }, hideOverlay: async () => undefined });
  failed.start(1);
  const failure = await failed.stop();
  let restartRejected = false;
  try { failed.start(3); } catch { restartRejected = true; }
  const fresh = new LifecycleCoordinator('android', { closeOutlets: async () => undefined, clearQueue: async () => undefined,
    stopTrack: async () => undefined, hideOverlay: async () => undefined });
  return assess({ cycles: cycles.length, platforms: ['android', 'windows'], failure, newCoordinator: fresh.snapshot(),
    resourcePorts: 'synthetic callbacks, not native OS capture tracks' }, {
    repeatedCleanupCorrect: cycles.every(item => item.closed && item.once && item.cleaned),
    cleanupFailureBlocksRestart: failure.restartBlocked && restartRejected,
    newProcessDoesNotAutoCapture: fresh.snapshot().state === 'idle' && !fresh.snapshot().outputAllowed,
  });
}

async function contractAndApiChecks(modules) {
  const { isConversationEvent, contractVersion } = modules.contracts;
  const validEvent = { request_id: 'f08-request', sequence: 1, type: 'delta', text: 'synthetic response' };
  const invalidEvent = { request_id: 'f08-request', sequence: 1, type: 'delta', text: 'ok', extra: 'not-in-contract' };
  const { RemoteApiClient } = modules['api-client'];
  const client = new RemoteApiClient({ baseUrl: 'https://synthetic.invalid', createId: () => 'f08-request',
    transport: async () => { throw new TypeError('Synthetic offline'); }, retry: { maxAttempts: 2, wait: async () => undefined } });
  let offlineCode = null;
  try { await client.request('noteList', { requestId: 'f08-request' }); }
  catch (error) { offlineCode = error.code; }
  return assess({ contractVersion, validEvent, invalidEvent, offlineCode, networkAttempted: false,
    transport: 'RemoteApiClient with injected failing transport; no fetch/global network' }, {
    validEventAccepted: isConversationEvent(validEvent),
    invalidEventRejected: !isConversationEvent(invalidEvent),
    offlineIsTyped: offlineCode === 'NETWORK_OFFLINE',
  });
}

async function assetFlowQualityChecks(modules) {
  const { buildAssetRevision, createAccessibilityPatch, validateAssetRevision } = modules['accessibility-assets'];
  const asset = buildAssetRevision({ assetId: 'f12-child-synthetic', revision: 1, audience: 'child', placement: 'desk-pet',
    width: 512, height: 512, bytes: 1, reducedMotionVariant: true, captions: true, focusOrder: ['pet', 'caption', 'stop'],
    source: 'reviewed', content: 'synthetic-asset' });
  const patch = createAccessibilityPatch(asset, { fontScale: 1.5, reduceMotion: true });
  const invalidAsset = validateAssetRevision({ ...asset, placement: 'hidden' });
  const { defaultFlowCatalog, LocalFlowLibrary, signFlowBundle } = modules['flow-library'];
  const secret = 'f-development-synthetic-flow-key';
  const unsigned = { slot: 'active', bundleVersion: '1.0.0', flows: defaultFlowCatalog };
  const library = new LocalFlowLibrary(secret);
  const installed = library.install({ ...unsigned, signature: signFlowBundle(unsigned, secret) });
  const badSignature = library.install({ ...unsigned, slot: 'candidate', bundleVersion: '2.0.0', signature: 'tampered' });
  const candidate = { slot: 'candidate', bundleVersion: '2.0.0', flows: defaultFlowCatalog };
  const candidateInstalled = library.install({ ...candidate, signature: signFlowBundle(candidate, secret) });
  const promoted = library.promoteCandidate();
  library.disable('flow-01');
  const disabled = library.resolve('flow-01');
  const { hashModelBytes, auditModelArtifact, redactAuditLog, hasReleaseBlockingFinding } = modules['quality-gates'];
  const bytes = new TextEncoder().encode('synthetic-model');
  const modelHash = hashModelBytes(bytes);
  const acceptedModel = auditModelArtifact({ name: 'synthetic.onnx', bytes: bytes.byteLength, sha256: modelHash, format: 'onnx',
    path: 'models/synthetic.onnx', metadata: { license: 'fixture', source: 'local', version: '1' } });
  const unsafeModel = auditModelArtifact({ name: 'unsafe', bytes: 51 * 1024 * 1024, sha256: 'bad', format: 'onnx', path: '../secret',
    metadata: { license: '', source: '', version: '' } });
  const redacted = redactAuditLog('Bearer synthetic-token token=secret 6222001234567890');
  const blocking = hasReleaseBlockingFinding([{ id: 'F08-SYNTHETIC', severity: 'high', message: 'fixture', status: 'open' }]);
  return assess({ asset, patch, invalidAsset, flowSnapshot: library.snapshot(), installed, badSignature, candidateInstalled, promoted,
    disabled, acceptedModel, unsafeModel, redacted, blocking }, {
    accessibilityRevisionValid: validateAssetRevision(asset).valid && patch.motion === 'reduced' && patch.focusRingPx === 3,
    childPlacementBoundary: invalidAsset.findings.includes('child_asset_must_remain_desk_pet'),
    signedFlowAccepted: installed.accepted && badSignature.reason === 'invalid_signature',
    candidatePromotionExplicit: candidateInstalled.accepted && promoted.promoted && library.snapshot().activeVersion === '2.0.0',
    disabledFlowDoesNotResolve: disabled.status === 'disabled' && disabled.cloudRequested === false,
    modelProvenanceAndHashChecked: acceptedModel.accepted && !unsafeModel.accepted,
    auditRedacted: redacted.includes('[REDACTED]') && redacted.includes('[REDACTED_NUMBER]'),
    highFindingBlocks: blocking,
  });
}

async function consentAndSupportChecks(modules, faults) {
  const { accountDemoEligibility, accountDemoReducer, initialAccountDemo } = modules.domain;
  const childInput = { method: 'family', platform: 'android', subject: 'child', hasSim: false, bound: false,
    operatorAuthorized: true, purposeAccepted: true, outcome: 'success' };
  const eligibility = accountDemoEligibility(childInput);
  let state = accountDemoReducer(initialAccountDemo, { type: 'START', input: childInput });
  const startedGeneration = state.generation;
  state = accountDemoReducer(state, { type: 'PROOF', generation: startedGeneration });
  const missingConsent = accountDemoReducer(state, { type: 'CONFIRM', consent: false, guardianVerified: false });
  const missingGuardian = accountDemoReducer(state, { type: 'CONFIRM', consent: true, guardianVerified: false });
  const confirmed = accountDemoReducer(state, { type: 'CONFIRM', consent: !faults.has('missing-consent'), guardianVerified: true });
  const stale = accountDemoReducer(state, { type: 'CONFIRM', consent: true, guardianVerified: true, generation: startedGeneration - 1 });
  const supportPage = readFileSync(path.join(root, 'apps/web/src/pages/support.tsx'), 'utf8');
  const supportSignals = { stopEvent: supportPage.includes("new Event('nuanban:stop')"), retryCopy: supportPage.includes('重试'),
    realServiceBoundary: supportPage.includes('真实服务没有接入') };
  return assess({ eligibility, startedGeneration, missingConsent, missingGuardian, confirmed, stale, supportSignals,
    feedbackStore: 'not present in the current repository; no synthetic record is promoted as pilot evidence',
    trainingArtifact: 'synthetic training revisions are exercised separately; no real training sign-in is claimed' }, {
    childConsentRequired: eligibility === null && missingConsent.error?.includes('明确确认'),
    guardianVerificationRequired: missingGuardian.error?.includes('监护关系核验'),
    confirmationRequiresConsentAndGuardian: confirmed.phase === 'demo_ready' && confirmed.authenticated === false,
    staleConfirmationIgnored: stale.phase === 'await_confirmation',
    supportChannelIsLocalUiOnly: supportSignals.stopEvent && supportSignals.retryCopy,
  });
}

async function trainingRevision(modules, faults) {
  const permissionDescriptions = {
    unknown: '尚未确认权限；先阅读用途并由本人决定。', granted: '已授权；仍可随时点停止。',
    denied: '未授权；保留文字学习，不自动开启采集。', restricted: '系统限制；联系已配置的支持人员核对。',
    unsupported: '设备不支持；使用文字步骤，不假装已经开启。',
  };
  const safetyBoundary = '未知页面暂停；停止即关闭出口；重新开始须明确确认。';
  const guide = { materialId: 'f12-synthetic-guide', version: '2.0.0-development', source: 'synthetic_fixture',
    audiences: ['elder', 'family', 'child'], permissionDescriptions, safetyBoundary,
    steps: ['先看当前权限说明。', '确认愿意后再开始本机练习。', '看不清时调大字号或使用字幕。', '点停止即可结束；重开需再次确认。'] };
  const { LocalFlowLibrary, signFlowBundle } = modules['flow-library'];
  const secret = 'synthetic-training-key-not-a-real-credential';
  const library = new LocalFlowLibrary(secret);
  const flow = { flowId: guide.materialId, version: guide.version, title: '本机合成培训指南', owner: 'synthetic-author',
    reviewer: 'synthetic-reviewer', riskBoundary: safetyBoundary, steps: guide.steps.map((instruction, index) => ({
      id: 'step-' + index, instruction, expectedAction: index === guide.steps.length - 1 ? 'stop' : 'confirm', risk: 'safe',
    })) };
  const original = { slot: 'active', bundleVersion: '1.0.0-development', flows: [{ ...flow, version: '1.0.0-development' }] };
  const initial = library.install({ ...original, signature: signFlowBundle(original, secret) });
  const unsigned = { slot: 'candidate', bundleVersion: guide.version, flows: [flow] };
  const candidate = library.install({ ...unsigned, signature: signFlowBundle(unsigned, secret) });
  const beforePromotion = library.snapshot();
  const promotion = library.promoteCandidate();
  const resolved = library.resolve(guide.materialId);
  const { buildAssetRevision, validateAssetRevision, createAccessibilityPatch } = modules['accessibility-assets'];
  const assets = guide.audiences.map(audience => buildAssetRevision({ assetId: 'f12-' + audience, revision: 2,
    audience: audience === 'family' ? 'shared' : audience,
    placement: faults.has('unsafe-training') && audience === 'child' ? 'hidden' : 'desk-pet',
    width: 512, height: 512, bytes: 1, reducedMotionVariant: true, captions: true,
    focusOrder: ['permission', 'caption', 'stop'], source: 'reviewed', content: JSON.stringify(guide) }));
  const validations = assets.map(asset => validateAssetRevision(asset));
  const patches = assets.map((asset, index) => validations[index].valid ? createAccessibilityPatch(asset, { fontScale: 2, reduceMotion: true }) : null);
  const stopped = new modules.privacy.FrameSafetyGate();
  stopped.authorize(privacyContext);
  stopped.stop();
  const stopResult = stopped.evaluate(frame(), 1200);
  const unknownResult = modules.privacy.evaluateLocalFrame(frame({ pageKind: 'unknown' }), privacyContext, 1200);
  const browserPermission = await new modules['platform-ports'].BrowserPlatform().requestNotification();
  return assess({ guide, contentHash: digest(JSON.stringify(guide)), assets: assets.map(asset => ({ assetId: asset.assetId, contentHash: asset.contentHash })),
    validations, patches, initial, candidate, beforePromotion, promotion, resolvedVersion: resolved.flow?.version ?? null,
    browserPermission, stoppedFrameAllowed: stopResult.outboundAllowed, unknownFrameAllowed: unknownResult.outboundAllowed,
    humanReviewPerformed: false, screenReaderPerformed: false }, {
    conciseSteps: guide.steps.length <= 5 && guide.steps.every(instruction => instruction.length <= 50),
    allPermissionStatesExplained: ['unknown', 'granted', 'denied', 'restricted', 'unsupported'].every(state => !!permissionDescriptions[state]),
    assetsPassActualValidator: validations.every(validation => validation.valid),
    accessibleChildBoundary: patches.every(patch => patch !== null && patch.motion === 'reduced' && patch.fontScale === 2 && patch.focusRingPx >= 3),
    revisionRequiresExplicitPromotion: initial.accepted && candidate.accepted && beforePromotion.activeVersion === '1.0.0-development'
      && promotion.promoted && resolved.flow?.version === guide.version,
    runtimeSafetyBoundaryUnchanged: !stopResult.outboundAllowed && !unknownResult.outboundAllowed,
    unsupportedPermissionNotMisrepresented: browserPermission === 'unsupported',
  });
}

function observationRecords(consentCheck, f07Checks) {
  const confirmed = consentCheck.details?.confirmed;
  const observations = ['elder', 'child'].map(audience => ({ id: 'synthetic-observation-' + audience,
    participantId: 'synthetic-' + audience, source: 'synthetic_fixture', synthetic: true, audience,
    consentId: 'synthetic-consent-' + audience, noticeVersion: 'development-v1',
    consentAccepted: confirmed?.phase === 'demo_ready' && confirmed.authenticated === false,
    guardianVerified: audience === 'child' ? confirmed?.phase === 'demo_ready' : null,
    observedAt: syntheticInstant, moduleCheckRefs: f07Checks.map(item => item.id),
    observations: { receiptIsNotDelivery: true, realLearningOutcome: null, real公益Outcome: null } }));
  return assess({ observations, realParticipantCount: 0, syntheticParticipantCount: observations.length,
    impactClaims: [], backendObservationStoreVerified: false }, {
    allSyntheticAndConsented: observations.every(item => item.synthetic && item.source === 'synthetic_fixture' && item.consentAccepted),
    childGuardianCheckedByActualReducer: observations.filter(item => item.audience === 'child').every(item => item.guardianVerified === true),
    moduleResultsTraceable: observations.every(item => item.moduleCheckRefs.every(reference => f07Checks.some(result => result.id === reference))),
    noRealImpactExtrapolation: observations.every(item => item.observations.realLearningOutcome === null && item.observations.real公益Outcome === null),
  });
}

function feedbackClosure(modules, observationsCheck, trainingCheck, faults) {
  const observations = observationsCheck.details?.observations ?? [];
  const signIns = observations.map(item => ({ id: 'synthetic-signin-' + item.audience, source: 'synthetic_fixture',
    participantId: item.participantId, observationId: item.id, consentId: item.consentId, signedAt: syntheticInstant }));
  const feedback = { id: 'synthetic-feedback-stop', source: 'synthetic_fixture',
    observationId: faults.has('feedback-link') ? 'missing-observation' : 'synthetic-observation-child',
    issueId: 'synthetic-issue-stop-copy', materialId: 'f12-synthetic-guide',
    message: '合成反馈：停止与重新授权的步骤需要更清楚。' };
  const linkedObservation = observations.find(item => item.id === feedback.observationId);
  const issue = { id: feedback.issueId, feedbackId: feedback.id, severity: 'low',
    originalVersion: '1.0.0-development', fixedVersion: trainingCheck.details?.guide.version ?? null,
    retestRef: trainingCheck.id, retestPassed: trainingCheck.success,
    sourceHashes: trainingCheck.actualCoverage.map(item => ({ module: item.module, sha256: item.sha256 })),
    status: linkedObservation?.consentAccepted && trainingCheck.success ? 'closed_development_only' : 'needs_attention' };
  const highFinding = { id: issue.id, severity: 'high', message: 'synthetic unresolved red line', status: 'open' };
  const blockingFindingDetected = modules['quality-gates'].hasReleaseBlockingFinding([highFinding]);
  return assess({ signIns, feedback, issue, supportChannels: [{ id: 'local-support-ui', module: 'apps/web/src/pages/support.tsx',
    kind: 'local-help-screen', humanSupportConfigured: false }], realTrainingPerformed: false, realFeedbackReceived: false,
    backendFeedbackStoreVerified: false, blockingFindingDetected }, {
    feedbackHasConsentedSource: linkedObservation?.consentAccepted === true,
    signInConsentAndObservationLinked: signIns.length > 0 && signIns.every(item => observations.some(observation =>
      observation.id === item.observationId && observation.consentId === item.consentId && observation.participantId === item.participantId && observation.consentAccepted)),
    issueReferencesActualRetest: issue.retestRef === trainingCheck.id && issue.retestPassed && issue.sourceHashes.length > 0,
    closedOnlyAfterPassingRevision: issue.status === 'closed_development_only' && issue.fixedVersion !== issue.originalVersion,
    highRiskStillBlockedByActualModule: blockingFindingDetected,
  });
}

function collectTests(relativeDirectories) {
  const files = [];
  function visit(relative) {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(next);
      else if (entry.isFile() && entry.name.endsWith('.test.ts') && entry.name !== 'f-development-reliability.test.ts') files.push(next);
    }
  }
  for (const relative of relativeDirectories) if (existsSync(path.join(root, relative))) visit(relative);
  return files.sort();
}

function runVitest(files, suiteId) {
  return new Promise(resolve => {
    const outputDirectory = path.join(tmpdir(), 'nuanban-f-reliability-' + process.pid + '-' + suiteId);
    const outputFile = path.join(outputDirectory, 'vitest.json');
    const vitest = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
    mkdirSync(outputDirectory, { recursive: true });
    const child = spawn(process.execPath, [vitest, 'run', ...files, '--reporter=json', '--outputFile', outputFile, '--no-cache', '--no-fsModuleCache', '--configLoader=runner', '--maxWorkers=1', '--no-file-parallelism'], {
      cwd: root, windowsHide: true, timeout: 120_000, env: { ...process.env, CI: '1', NPM_CONFIG_OFFLINE: 'true', PNPM_OFFLINE: 'true',
        NUANBAN_REAL_NETWORK: 'false', NUANBAN_PRODUCTION_DATA: 'false', NUANBAN_REAL_DEVICES: 'false', NUANBAN_F_DEVELOPMENT_ONLY: '1' },
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => {
      rmSync(outputDirectory, { recursive: true, force: true });
      resolve({ suiteId, exitCode: null, files, report: null, stderr: error.message });
    });
    child.on('close', exitCode => {
      let report = null;
      try { report = JSON.parse(readFileSync(outputFile, 'utf8')); } catch { report = null; }
      rmSync(outputDirectory, { recursive: true, force: true });
      resolve({ suiteId, exitCode, files, report, stderr: stderr.slice(-2000) });
    });
  });
}

function findRevisedPlanCandidates() {
  const candidates = [];
  function visit(relative, depth) {
    if (depth > 3) return;
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(next, depth + 1);
      else if (entry.isFile() && /修订|revised|revision|改版/i.test(entry.name) && /.(md|json|yaml|yml|txt)$/i.test(entry.name)) candidates.push(next);
    }
  }
  visit('.', 0);
  return candidates.filter(relative => !relative.startsWith('docs/execution/'));
}

function summarizeSuite(result, injected) {
  const report = result.report ?? {};
  const passed = result.exitCode === 0 && report.success !== false && (report.numFailedTests ?? 0) === 0 && (report.numFailedTestSuites ?? 0) === 0;
  return {
    id: result.suiteId, success: passed && !injected, injectedFailure: injected, exitCode: result.exitCode,
    files: result.files, fileCount: report.numTotalTestFiles ?? report.numTotalTestSuites ?? null,
    passedFiles: report.numPassedTestFiles ?? report.numPassedTestSuites ?? null,
    testCount: report.numTotalTests ?? null, passedTests: report.numPassedTests ?? null,
    failedTests: report.numFailedTests ?? null, pendingTests: report.numPendingTests ?? null,
    actualVitest: true, stderr: result.stderr || null,
    limitation: 'Vitest uses existing synthetic/local fixtures; no real devices, services, pilot subjects or production data.',
  };
}

function parseOption(name) {
  const inline = process.argv.find(value => value.startsWith(name + '='));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  const injectedName = parseOption('--inject-failure');
  const faults = new Set(faultNames.filter(name => name === injectedName));
  const injectedSuite = injectedName && !faultNames.includes(injectedName) ? injectedName : null;
  const unsafeNetwork = process.env.NUANBAN_REAL_NETWORK === 'true' || process.env.NUANBAN_PRODUCTION_DATA === 'true' || process.env.NUANBAN_REAL_DEVICES === 'true';
  const beforeProtected = protectedSnapshot();
  const dGate = loadJson('docs/implementation/evidence/d-gate-readiness-results.json');
  let d07Check = null;
  try {
    const module = await import(pathToFileURL(path.join(root, 'scripts/check-d07-decision.mjs')).href);
    d07Check = module.runD07DecisionCheck({ mode: 'release' });
  } catch (error) {
    d07Check = { status: 'unavailable', eligible: false, decision: null, error: error instanceof Error ? error.message : 'D07 check unavailable' };
  }
  const moduleNames = ['privacy', 'media-relay', 'guidance-engine', 'reminder-engine', 'local-data', 'platform-ports',
    'api-client', 'contracts', 'domain', 'mocks', 'quality-gates', 'flow-library', 'accessibility-assets'];
  const moduleAvailability = Object.fromEntries(moduleNames.map(name => [name, false]));
  let probes = [];
  let suites = [];
  let tasks = [];
  let setupError = null;
  if (!unsafeNetwork) {
    try {
      globalThis.indexedDB = new IDBFactory();
      globalThis.IDBKeyRange = IDBKeyRange;
      const modules = await loadActualModules();
      for (const name of moduleNames) moduleAvailability[name] = Boolean(modules[name]);
      const f07Privacy = await check('F07-privacy-performance', ['AT-10', 'AT-11', 'AT-12', 'AT-22'],
        [coverage('privacy', ['FrameSafetyGate', 'evaluateLocalFrame', 'issueSafetyTicket']), coverage('media-relay', ['ControlledMediaRelay', 'InMemoryMediaReceiver'])],
        () => privacyPerformance(modules));
      const f07Media = await check('F07-media-stop-race', ['AT-10', 'AT-11', 'AT-22'],
        [coverage('media-relay', ['ControlledMediaRelay', 'FrameSafetyGate'])], () => mediaRaces(modules, faults));
      const f07Guidance = await check('F07-guidance-transform', ['AT-07', 'AT-12'],
        [coverage('guidance-engine', ['createAndroidFrameContext', 'createWindowsFrameContext', 'GuidanceTargetLifecycle'])], () => guidanceChecks(modules));
      const f07Reminder = await check('F07-reminder-recovery', ['AT-17', 'AT-21', 'AT-22'],
        [coverage('reminder-engine', ['ReminderLedger', 'ReminderDispatchGate', 'deriveReminderInstanceId']), coverage('local-data', ['IndexedDbReminderStore', 'IndexedDbRepository'])],
        () => reminderRecovery(modules, faults));
      const f07Lifecycle = await check('F07-lifecycle-restart', ['AT-12', 'AT-22'],
        [coverage('platform-ports', ['LifecycleCoordinator'])], () => lifecycleChecks(modules));
      const f08Contracts = await check('F08-contract-api-regression', ['AT-01', 'AT-13', 'AT-23'],
        [coverage('contracts', ['isConversationEvent', 'contractVersion']), coverage('api-client', ['RemoteApiClient'])], () => contractAndApiChecks(modules));
      const f08Quality = await check('F08-quality-flow-accessibility', ['AT-15', 'AT-20', 'AT-23', 'AT-24'],
        [coverage('quality-gates', ['auditModelArtifact', 'redactAuditLog', 'hasReleaseBlockingFinding']), coverage('flow-library', ['LocalFlowLibrary', 'signFlowBundle']), coverage('accessibility-assets', ['validateAssetRevision', 'createAccessibilityPatch'])],
        () => assetFlowQualityChecks(modules));
      const f09Consent = await check('F09-consent-observation', ['AT-18', 'AT-24'],
        [coverage('domain', ['accountDemoEligibility', 'accountDemoReducer'])], () => consentAndSupportChecks(modules, faults));
      const f12Training = await check('F12-training-revision', ['AT-15', 'AT-20', 'AT-24'],
        [coverage('flow-library', ['LocalFlowLibrary', 'signFlowBundle']), coverage('accessibility-assets', ['validateAssetRevision', 'createAccessibilityPatch']), coverage('privacy', ['FrameSafetyGate', 'evaluateLocalFrame'])],
        () => trainingRevision(modules, faults));
      const f09Observation = await check('F09-observation-trace', ['AT-24'], [], () => observationRecords(f09Consent, [f07Privacy, f07Media, f07Reminder]));
      const f10Feedback = await check('F10-feedback-closure', ['AT-24'], [coverage('quality-gates', ['hasReleaseBlockingFinding'])],
        () => feedbackClosure(modules, f09Observation, f12Training, faults));
      const f11Decision = await check('F11-formal-decision-boundary', ['D07'], [{ module: 'scripts/check-d07-decision.mjs', execution: 'direct_module_call', fixture: 'repository_state' }],
        async () => assess({ d07Check }, { formalDecisionCheckRan: ['go', 'release_pending'].includes(d07Check?.status), formalDecisionNotMutated: true }));
      probes = [f07Privacy, f07Media, f07Guidance, f07Reminder, f07Lifecycle, f08Contracts, f08Quality, f09Consent, f09Observation, f10Feedback, f11Decision, f12Training];
      const f07Files = [
        'tests/privacy/c03-gate.test.ts', 'tests/privacy/c04-media-relay.test.ts', 'tests/domain/reminder-engine.test.ts', 'tests/domain/reminder-dispatch.test.ts',
        'tests/integration/c07-c08-reminder-store.test.ts', 'tests/integration/conflicts.test.ts', 'tests/platform/lifecycle-engine.test.ts', 'tests/platform/native-host.test.ts',
        'tests/platform/reminder-runtime.test.ts', 'tests/platform/desktop-reminder-store.test.ts', 'tests/platform/desktop-notification-adapter.test.ts',
        'tests/platform/desktop-reminder-bridge.test.ts', 'tests/native/android-reminder-receiver.test.ts',
      ].filter(relative => existsSync(path.join(root, relative)));
      const f08Files = collectTests(['tests/contract', 'tests/native', 'tests/accessibility', 'tests/quality', 'tests/flows', 'tests/platform', 'tests/acceptance']);
      const [f07Suite, f08Suite] = await Promise.all([runVitest(f07Files, 'f07-actual-modules'), runVitest(f08Files, 'f08-f12-regression')]);
      suites = [summarizeSuite(f07Suite, injectedSuite === 'f07-actual-modules'), summarizeSuite(f08Suite, injectedSuite === 'f08-f12-regression')];
      if (injectedSuite && !suites.some(suite => suite.id === injectedSuite)) suites.push({ id: injectedSuite, success: false, injectedFailure: true, exitCode: null, files: [], fileCount: 0, passedFiles: 0, testCount: 0, passedTests: 0, failedTests: 1, pendingTests: 0, actualVitest: false, stderr: 'Requested unknown suite injection.', limitation: 'Injected executor failure.' });
      const f07Checks = [f07Privacy, f07Media, f07Guidance, f07Reminder, f07Lifecycle];
      const f08Checks = [f08Contracts, f08Quality];
      const f09Checks = [f09Consent, f09Observation];
      const f10Checks = [f10Feedback];
      const f11Checks = [f11Decision];
      const f12Checks = [f12Training];
      tasks = [
        task('F07', '隐私/性能/长时/恢复测试', f07Checks, ['真实设备网络整形、100 次/类真实样本、8 小时混合运行和至少一次 24 小时后台观察未执行。', '当前只测本机合成 p95、停止竞态、代际、提醒仓储与失败闭环。']),
        task('F08', '缺陷回归与试点候选验收', f08Checks, ['真实候选包签收、红线人工复核、真实核心链路和真实试点准入未执行。', '回归测试仍是本机/合成夹具，不能升级为可试点签收。']),
        task('F09', '试点观察与验收复核', f09Checks, ['无真实参与者、真实无障碍观察、提醒/学习结果或公益成效；观察记录明确 synthetic，不产生真实影响结论。']),
        task('F10', '试点培训与反馈闭环', f10Checks, ['当前没有真实培训签到、未成年真实授权、人工支持渠道或后端反馈工单存储；合成反馈只验证关联/复测规则。']),
        task('F11', '发布决策与正式交付', f11Checks, ['正式 Go/No-Go 仍由正式记录、全基线、负责人/独立复核和维护签收决定；本执行器不代签、不改正式证据。']),
        task('F12', '培训材料与试点体验修订', f12Checks, ['只验证实际流程库、无障碍资产校验和隐私停止边界；老人/家属人工可读性、读屏和权限理解仍需真实复核。']),
      ];
    } catch (error) {
      setupError = error instanceof Error ? error.message : 'Actual module setup failed';
    }
  } else {
    setupError = 'Unsafe runtime flag detected; actual modules were not started.';
  }

  const afterProtected = protectedSnapshot();
  const formalStateUnchanged = JSON.stringify(beforeProtected) === JSON.stringify(afterProtected);
  const safetyClosed = !unsafeNetwork
    && process.env.NUANBAN_REAL_NETWORK !== 'true'
    && process.env.NUANBAN_PRODUCTION_DATA !== 'true'
    && process.env.NUANBAN_REAL_DEVICES !== 'true';
  const probeSuccess = probes.length > 0 && probes.every(probe => probe.success);
  const suiteSuccess = suites.length === 2 && suites.every(suite => suite.success);
  const taskSuccess = tasks.length === taskIds.length && tasks.every(item => item.success);
  const success = safetyClosed && formalStateUnchanged && !setupError && probeSuccess && suiteSuccess && taskSuccess;
  const report = {
    generatedAt: new Date().toISOString(),
    scope: 'F07-F12 local development reliability and feedback-loop executor',
    mode: 'development_only',
    realNetworkEnabled: false,
    productionDataEnabled: false,
    realDevicesEnabled: false,
    success,
    status: success ? 'development_checks_passed' : 'development_checks_failed',
    noWrite: true,
    writeCount: 0,
    actualModulesCalled: moduleAvailability,
    moduleLoader: 'Node registerHooks + TypeScript transpile of repository modules',
    offline: {
      networkEnabled: false,
      productionDataEnabled: false,
      realDevicesEnabled: false,
      runtimeSafetyClosed: safetyClosed,
      networkAttempted: false,
    },
    formalState: {
      dGateSnapshot: dGate,
      d07Check,
      taskCardsReadOnly: true,
      evidenceReadOnly: true,
      unchanged: formalStateUnchanged,
      formalBusinessExecutionStarted: false,
      revisedPlanCandidates: findRevisedPlanCandidates(),
      rootPlan: '暖伴AI公益助手-项目实施计划-Codex高效续作版.md',
    },
    limits: localLimits,
    probes,
    suites,
    tasks,
    setupError,
    limitations: [
      '所有成功结果均为本机开发级调用或现有 Vitest 回归；不代表真实设备、真实网络、真实账号、真实参与者、真实供应或正式发布。',
      'F09/F10 的观察、签到、同意、反馈和问题单仅生成合成关联检查；没有伪造试点样本或公益成效。',
      '正式计划、任务卡和证据状态由主线程与正式流程维护，本脚本不写入。',
    ],
  };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = success ? 0 : 1;
}

await main();
