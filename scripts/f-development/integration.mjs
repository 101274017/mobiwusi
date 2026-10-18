import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import http2 from 'node:http2';
import dgram from 'node:dgram';
import dns from 'node:dns';
import childProcess from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixtureTime = '2026-10-17T01:00:00.000Z';
const fixtureNow = Date.parse(fixtureTime);
const ownerId = 'synthetic-f-integration-owner';
const helperId = 'synthetic-f-integration-helper';
const taskDefinitions = [
  ['F01', '共享输入→教学→笔记→提醒→协助', '真实 UI、账号、设备、同步副作用和人工签收仍待正式验收。'],
  ['F02', 'Android 受限桥与生命周期', 'Android 设备、Room/AlarmManager、通知权限、MediaProjection 和原生回执仍待真机验证。'],
  ['F03', 'Windows/图形受限宿主', 'Windows 原生宿主、GPU/捕获、DPI、多显示器、系统通知和进程恢复仍待设备验证。'],
  ['F04', '后端/运维失败关闭', '真实后端、生产数据库、部署鉴权、备份恢复、监控和运维签收仍待外部验证。'],
  ['F05', 'AI/媒体合成出口', '真实供应授权、条款、质量、配额、取消延迟、音视频和 TURN 仍待供应验证。'],
  ['F06', '安全/停止/冲突复核', '独立安全复核、真实权限撤销、隐私审计、人工验收和完整 AT 矩阵仍待外部验证。'],
];
const tasks = taskDefinitions.map(([id, title, blocker]) => ({
  id,
  title,
  status: 'development_pending',
  developmentStatus: 'not_run',
  formalStatus: 'pending_external_verification',
  completed: false,
  developmentExecutionStarted: false,
  formalExecutionStarted: false,
  realExecutionAllowed: false,
  development: { status: 'planned' },
  verification: { status: 'external_pending', blockers: [blocker] },
  blockers: [blocker],
  assertions: [],
  observations: {},
}));
const assertions = [];

function parseArguments() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some(argument => argument !== '--no-write')) throw new Error('Only --no-write is supported; this executor always emits JSON without writing evidence.');
}

function check(task, id, actual, expected, category = 'success') {
  const legacyBoolean = arguments.length < 4;
  const assertion = { id: `${task.id}.${id}`, taskId: task.id, category, passed: legacyBoolean ? Boolean(actual) : isDeepStrictEqual(actual, expected), actual, expected: legacyBoolean ? true : expected };
  assertions.push(assertion);
  task.assertions.push(assertion.id);
  return assertion.passed;
}

async function captureFailure(operation) {
  try {
    await operation();
    return null;
  } catch (error) {
    return { name: error?.name ?? 'Error', code: error?.code ?? null, message: String(error?.message ?? 'Operation failed').slice(0, 240) };
  }
}

function createReport() {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    fixtureTime,
    scope: 'F01-F06 offline synthetic business-module integration',
    mode: 'development_only',
    status: 'development_checks_failed',
    developmentStatus: 'not_run',
    formalStatus: 'pending_external_verification',
    acceptance: 'development_verified_formal_pending',
    success: false,
    offline: true,
    syntheticOnly: true,
    productionReady: false,
    developmentExecutionStarted: true,
    formalFExecutionStarted: false,
    realExecutionAllowed: false,
    realNetworkEnabled: false,
    realDevicesEnabled: false,
    realAccountsEnabled: false,
    realCredentialsEnabled: false,
    productionDataEnabled: false,
    writes: [],
    tasks,
    paths: {},
    assertions,
    blockers: taskDefinitions.map(([id, , blocker]) => ({ id, blocker })),
    limitations: [
      'success 只表示既有业务模块在本机合成夹具下的开发断言通过，不表示 F01-F06 正式完成。',
      '本执行器不读取或修改 D07、F 任务卡、正式验收记录或既有 run-f-development.mjs。',
      '不连接真实网络、真实账号、生产数据、供应商、设备、系统权限、试点或发布环境。',
      '合成宿主回执、内存服务和本机 IndexedDB 只能证明代码路径可运行，不能升级为真实联调证据。',
    ],
  };
}

async function loadModules() {
  await import('fake-indexeddb/auto');
  const sourceScope = pathToFileURL(root + path.sep).href;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      let candidate;
      if (specifier.startsWith('@nuanban/')) candidate = path.join(root, 'packages', specifier.slice(9), 'src/index.ts');
      else if (specifier.startsWith('.') && context.parentURL?.startsWith(sourceScope)) {
        const base = fileURLToPath(new URL(specifier, context.parentURL));
        candidate = [base, base + '.ts', path.join(base, 'index.ts')].find(filename => filename.endsWith('.ts') && existsSync(filename));
      }
      return candidate ? { url: pathToFileURL(candidate).href, shortCircuit: true } : next(specifier, context);
    },
    load(url, context, next) {
      if (!url.startsWith(sourceScope) || !url.endsWith('.ts')) return next(url, context);
      const source = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      return { format: 'module', source, shortCircuit: true };
    },
  });
  const load = specifier => import(pathToFileURL(path.join(root, specifier)).href);
  try {
    return {
      application: await load('packages/application/src/index.ts'),
      domain: await load('packages/domain/src/index.ts'),
      mocks: await load('packages/mocks/src/index.ts'),
      localData: await load('packages/local-data/src/index.ts'),
      platform: await load('packages/platform-ports/src/index.ts'),
      guidance: await load('packages/guidance-engine/src/index.ts'),
      privacy: await load('packages/privacy/src/index.ts'),
      reminder: await load('packages/reminder-engine/src/index.ts'),
      provider: await load('packages/provider-sandbox/src/index.ts'),
      media: await load('packages/media-relay/src/index.ts'),
      apiClient: await load('packages/api-client/src/index.ts'),
      config: await load('packages/config/src/index.ts'),
      serverAuth: await load('apps/server/src/auth.ts'),
      serverFamily: await load('apps/server/src/family.ts'),
      serverRepositories: await load('apps/server/src/repositories.ts'),
      mediaSession: await load('packages/media-session/src/index.ts'),
      contracts: await load('packages/contracts/src/index.ts'),
      syncServices: await load('packages/sync-engine/src/services.ts'),
      syncMemory: await load('packages/sync-engine/src/memory.ts'),
      assistFixture: await load('apps/web/src/assist-fixture.ts'),
    };
  } finally {
    hooks.deregister();
  }
}

function syntheticFrame(overrides = {}) {
  return {
    frameId: 'synthetic-f-frame',
    frameHash: 'synthetic-sha256-f-frame',
    generation: 8,
    capturedAt: 1000,
    pageKind: 'verified',
    detectorStatus: 'healthy',
    ocrStatus: 'complete',
    text: 'NUANBAN-F-DEVELOPMENT-SYNTHETIC safe page',
    confidence: 0.98,
    thirdPartyFaces: 0,
    faceRedaction: 'not_required',
    ...overrides,
  };
}

function syntheticGate(overrides = {}) {
  return {
    systemAuthorized: true,
    consent: true,
    sessionActive: true,
    destinationAuthorized: true,
    generation: 8,
    policyVersion: 'privacy-0.3.0',
    maxFrameAgeMs: 500,
    minimumConfidence: 0.85,
    ...overrides,
  };
}

function encodeSafeFrame(approved) {
  return {
    artifactId: `synthetic-artifact-${approved.frameId}`,
    frameId: approved.frameId,
    frameHash: approved.frameHash,
    generation: approved.generation,
    policyVersion: approved.policyVersion,
    codec: 'synthetic-redacted-metadata',
    encodedBytes: 64,
    redactionApplied: approved.redactionApplied,
    canary: approved.canary,
  };
}

async function runTask(task, operation) {
  task.developmentExecutionStarted = true;
  task.development.status = 'in_progress';
  try {
    task.observations = await operation(task);
  } catch (error) {
    check(task, 'execution', { name: error?.name ?? 'Error', code: error?.code ?? null, message: String(error?.message ?? 'Execution failed').slice(0, 240) }, 'completed', 'unexpected_failure');
  }
  task.developmentStatus = task.assertions.length > 0 && task.assertions.every(id => assertions.find(item => item.id === id)?.passed) ? 'passed' : 'failed';
  task.development.status = task.developmentStatus === 'passed' ? 'verified' : 'blocked_by_code';
  task.status = task.development.status;
}

async function runSharedPath(task, modules) {
  const { application, domain, mocks, localData, platform, assistFixture } = modules;
  const repository = new localData.IndexedDbRepository();
  const initial = mocks.createScenarioSnapshot(ownerId, 'empty');
  await repository.commit(ownerId, initial);
  const question = '字体怎么调大？';
  const events = [];
  const conversation = {
    async *stream(text, signal) {
      for await (const event of new mocks.DemoConversation('success').stream(text, signal)) {
        events.push({ type: event.type, sequence: event.sequence });
        yield event;
      }
    },
  };
  const deltas = [];
  const answer = await application.readConversation(conversation, question, new AbortController().signal, segment => deltas.push(segment));
  check(task, 'input.ordered-stream', JSON.stringify(events), JSON.stringify([
    { type: 'started', sequence: 0 }, { type: 'delta', sequence: 1 }, { type: 'delta', sequence: 2 },
    { type: 'delta', sequence: 3 }, { type: 'completed', sequence: 4 },
  ]));
  check(task, 'input.answer-and-deltas', answer.includes('大字体') && deltas.length === 3, true);

  let guide = domain.guideReducer(domain.initialGuide, { type: 'START' });
  check(task, 'guide.requires-consent', guide.state, 'await_consent');
  const beforeConsentTarget = domain.guideReducer(guide, { type: 'TARGET', generation: guide.generation });
  check(task, 'guide.target-before-consent-ignored', JSON.stringify(beforeConsentTarget), JSON.stringify(guide), 'security');
  guide = domain.guideReducer(guide, { type: 'CONSENT' });
  guide = domain.guideReducer(guide, { type: 'TARGET', generation: guide.generation });
  guide = domain.guideReducer(guide, { type: 'USER_DONE' });
  guide = domain.guideReducer(guide, { type: 'VERIFY', matched: true, final: true, generation: guide.generation });
  check(task, 'guide.completed', { state: guide.state, step: guide.step }, { state: 'completed', step: 1 });

  const note = {
    id: 'synthetic-note-f01', ownerId, question, topic: '合成练习：调大字体', summary: answer,
    mastery: 'unmastered', masterySource: null, reviewedAt: null, source: 'conversation',
    createdAt: fixtureTime, updatedAt: fixtureTime, version: 1, deletedAt: null,
  };
  const todo = application.buildReviewTodo(note, '2026-10-17T01:30:00.000Z', 'Asia/Shanghai');
  await repository.commit(ownerId, { ...initial, notes: [note], todos: [todo] });
  const stored = await repository.load(ownerId);
  check(task, 'notes.persisted-with-todo-link', stored?.notes.length === 1 && stored.todos.length === 1 && stored.todos[0].noteId === note.id, true);

  const dueEvents = [];
  const runtime = new platform.ReminderRuntime(ownerId, new platform.BrowserPlatform(), { onDue: event => dueEvents.push(event) });
  const beforeDue = await runtime.sync(stored.todos, new Date(fixtureTime));
  const atDue = await runtime.sync(stored.todos, new Date(todo.dueAt));
  const replay = await runtime.sync(stored.todos, new Date(todo.dueAt));
  check(task, 'reminders.schedule-due-idempotent', {
    scheduled: beforeDue.scheduled, due: atDue.due, replayDue: replay.due, replayUnchanged: replay.unchanged,
    events: dueEvents.length, result: dueEvents[0]?.result.status,
  }, { scheduled: 1, due: 1, replayDue: 0, replayUnchanged: 1, events: 1, result: 'page_only' });
  const stoppedRuntime = await runtime.stop();
  check(task, 'reminders.stop-cancels-registration', {
    stopped: stoppedRuntime.stopped, cancelled: stoppedRuntime.cancelled, registered: runtime.snapshot().registered,
  }, { stopped: true, cancelled: 1, registered: 0 }, 'stop');

  const account = await new mocks.DemoAccountFlow().attempt({
    method: 'family', platform: 'android', subject: 'adult', hasSim: false, bound: false,
    operatorAuthorized: true, purposeAccepted: true, outcome: 'success',
  }, new AbortController().signal);
  check(task, 'assist.synthetic-success-not-authenticated', account, { source: 'mock', authenticated: false });
  const expiredFixture = assistFixture.resolveAssistFixture('normal', 'invite-expired');
  check(task, 'assist.expired-fixture-fails-closed', {
    fixture: expiredFixture, canAccept: assistFixture.assistCanAccept(expiredFixture), state: assistFixture.assistInviteTimeoutState(expiredFixture),
  }, { fixture: 'expired', canAccept: false, state: 'expired' }, 'failure');

  for (const [scenario, expectedCode] of [['offline', 'NETWORK_OFFLINE'], ['stream-interrupted', 'STREAM_INTERRUPTED'], ['partial-failure', 'PARTIAL_FAILURE'], ['provider-quota', 'RATE_LIMITED']]) {
    const failure = await captureFailure(() => application.readConversation(new mocks.DemoConversation(scenario), question, new AbortController().signal, () => {}));
    check(task, `failure.${scenario}`, failure?.code, expectedCode, 'failure');
  }
  const stopController = new AbortController();
  let stoppedSegments = 0;
  const stoppedConversation = application.readConversation(new mocks.DemoConversation('success'), question, stopController.signal, () => {
    stoppedSegments += 1;
    stopController.abort();
  });
  const stopFailure = await captureFailure(() => stoppedConversation);
  check(task, 'input.stop-aborts-stream', { name: stopFailure?.name, stoppedSegments }, { name: 'AbortError', stoppedSegments: 1 }, 'stop');
  check(task, 'failure.does-not-write-incomplete-note', (await repository.load(ownerId)).notes.length, 1, 'failure');
  return { noteId: note.id, todoId: todo.id, stages: ['input', 'teaching', 'note', 'reminder', 'assistance'], reminderStatus: dueEvents[0]?.result.status, assist: account, repository, todo, dueRequest: dueEvents[0]?.request };
}

async function runAndroidPath(task, modules, shared) {
  const { platform, guidance } = modules;
  const sent = [];
  let failNotify = false;
  let requestSequence = 0;
  let reply;
  const channel = {
    onmessage: undefined,
    postMessage(serialized) {
      const request = JSON.parse(serialized);
      sent.push(request);
      reply(request);
    },
  };
  reply = request => {
    const correlation = { request_id: request.request_id, generation: request.generation };
    const result = request.method === 'capabilities'
      ? { platform: 'android', externalCapture: false, nativeOverlay: false, remoteMedia: false, status: 'native-skeleton' }
      : request.method === 'stop_all'
        ? { stopped: true, captureActive: false }
        : request.method === 'reminder_schedule'
          ? { outcome: 'created', status: 'unsupported', reason: 'synthetic_store_only' }
          : request.method === 'reminder_cancel'
            ? { status: 'cancelled', reason: 'synthetic_cancelled' }
            : failNotify
              ? { error_code: 'scheduler_error', message: 'synthetic_dispatch_failure' }
              : { status: 'submitted', reason: 'synthetic_receipt_only' };
    channel.onmessage?.({ data: JSON.stringify({ ...correlation, ...result }) });
  };
  const rejected = platform.createAndroidMessageHost({ channel: { postMessage() {} }, origin: 'https://synthetic.invalid', mainFrame: true });
  check(task, 'bridge.foreign-origin-rejected', rejected, undefined, 'security');
  const host = platform.createAndroidMessageHost({
    channel,
    origin: 'https://appassets.androidplatform.net',
    mainFrame: true,
    timeoutMs: 100,
    requestId: () => `synthetic-f-android-${++requestSequence}`,
  });
  if (!host) throw new Error('Synthetic Android host was rejected');
  const native = new platform.NativeHostPlatform(host);
  try {
    await host.capabilities();
    check(task, 'bridge.capabilities-closed', native.capabilities, { platform: 'android', externalCapture: false, remoteMedia: false, nativeOverlay: false, notifications: false });
    check(task, 'bridge.notifications-unsupported', await native.requestNotification(), 'unsupported', 'security');
    const todoId = '00000000-0000-4000-8000-000000000202';
    const instanceId = '00000000-0000-4000-8000-000000000203';
    const request = { accountId: 'synthetic-android-owner', todoId, instanceId, plannedAt: '2026-10-17T01:30:00.000Z', timezone: 'Asia/Shanghai', scheduleRevision: 1, deepLink: `/review/${todoId}`, repeat: 'none', channel: 'local' };
    const scheduled = await native.scheduleReminder(request);
    const due = await native.notifyReminderDue(request, new Date(request.plannedAt));
    const cancelled = await native.cancelReminder(request);
    check(task, 'bridge.reminder-roundtrip', { schedule: scheduled.status, persisted: scheduled.persisted, due: due.nativeStatus, cancel: cancelled.nativeStatus }, { schedule: 'unsupported', persisted: true, due: 'submitted', cancel: 'cancelled' });
    failNotify = true;
    const failed = await captureFailure(() => native.notifyReminderDue(request, new Date(request.plannedAt)));
    check(task, 'bridge.failure-reported', failed?.message, 'synthetic_dispatch_failure', 'failure');
    await native.stopAll();
    check(task, 'bridge.stop-confirmed', sent.some(message => message.method === 'stop_all'), true, 'stop');
    const frame = guidance.createAndroidFrameContext({
      frameId: 'synthetic-android-frame', generation: 8, displayId: 'synthetic-display', windowId: 'synthetic-window', transformId: 'synthetic-android-transform', layoutRevision: 1, capturedAt: 1000,
      projectionSizePx: { width: 1080, height: 2400 }, systemInsetsPx: { top: 100, right: 0, bottom: 200, left: 0 }, letterboxRectPx: { x: 90, y: 300, width: 900, height: 1500 }, scaleFactor: 3, rotation: 90,
    });
    const target = { frame, rect: { x: 0.2, y: 0.1, width: 0.3, height: 0.2 }, expiresAt: 5000 };
    check(task, 'guidance.android-mapping', guidance.mapTargetRect(target, frame, 1200), { x: 720, y: 600, width: 180, height: 450 });
    const lifecycle = new guidance.GuidanceTargetLifecycle();
    lifecycle.publish(target, 1200);
    check(task, 'guidance.layout-stale-clears-target', lifecycle.observeFrame({ ...frame, layoutRevision: 2 }, 1300).status, 'low_confidence', 'stop');
    check(task, 'guidance.target-expiry', guidance.evaluateTarget(target, frame, 5000).code, 'expired', 'failure');
  } finally {
    host.dispose();
  }
  return { methods: sent.map(message => message.method), noteId: shared.noteId, todoId: shared.todoId, actualDeviceConnected: false, systemNotificationVerified: false };
}

async function runWindowsPath(task, modules, shared) {
  const { platform, guidance } = modules;
  const methods = [];
  const host = {
    platform: 'windows',
    async capabilities() { methods.push('capabilities'); return { platform: 'windows', externalCapture: false, nativeOverlay: false, remoteMedia: false }; },
    async stopAll() { methods.push('stop_all'); return { stopped: true, captureActive: false, mediaActive: false }; },
  };
  const native = new platform.NativeHostPlatform(host);
  await native.stopAll();
  check(task, 'host.capabilities-closed', native.capabilities, { platform: 'windows', externalCapture: false, remoteMedia: false, nativeOverlay: false, notifications: false });
  const frame = guidance.createWindowsFrameContext({
    frameId: 'synthetic-windows-frame', generation: 8, displayId: 'synthetic-negative-display', windowId: 'synthetic-window', transformId: 'synthetic-dpi-125', layoutRevision: 1, capturedAt: 1000,
    captureSizePx: { width: 1600, height: 900 }, captureContentRectPx: { x: 0, y: 0, width: 1600, height: 900 }, displayOriginDip: { x: -1920, y: 0 }, windowOriginDip: { x: 100, y: 80 }, contentOffsetDip: { x: 12, y: 34 }, contentSizeDip: { width: 800, height: 600 }, scaleFactor: 1.25, rotation: 0,
  });
  check(task, 'guidance.negative-origin-dpi', frame.viewportRectPx, { x: -2260, y: 142.5, width: 1000, height: 750 });
  const target = { frame, rect: { x: 0.55, y: 0.35, width: 0.2, height: 0.2 }, expiresAt: 5000 };
  const pointer = guidance.planChildPointer({ target, currentFrame: frame, start: { x: -2100, y: 200 }, bounds: frame.viewportRectPx, now: 1200 });
  check(task, 'guidance.pointer-is-plan-only', { status: pointer.status, path: pointer.path.length > 1 }, { status: 'ready', path: true });
  const stale = guidance.planChildPointer({ target, currentFrame: { ...frame, transformId: 'synthetic-dpi-200', scaleFactor: 2 }, start: { x: -2100, y: 200 }, bounds: frame.viewportRectPx, now: 1300 });
  check(task, 'guidance.dpi-change-invalidates-target', { status: stale.status, path: stale.path }, { status: 'stale', path: [] }, 'stop');
  const calls = [];
  const resources = {
    closeOutlets: async () => { calls.push('close_outlets'); },
    clearQueue: async () => { calls.push('clear_queue'); },
    stopTrack: async () => { calls.push('stop_track'); },
    hideOverlay: async () => { calls.push('hide_overlay'); },
  };
  const lifecycle = new platform.LifecycleCoordinator('windows', resources);
  lifecycle.start(8);
  const cleanup = await lifecycle.signal('window-moved');
  check(task, 'lifecycle.stop-order-invalidates-generation', { order: cleanup.order, state: lifecycle.snapshot().state, outputAllowed: lifecycle.canRelease(8), generation: cleanup.generationAfter }, { order: ['close_outlets', 'invalidate_generation', 'clear_queue', 'stop_track', 'hide_overlay'], state: 'stopped', outputAllowed: false, generation: 9 }, 'stop');
  const failedLifecycle = new platform.LifecycleCoordinator('windows', { ...resources, clearQueue: async () => { calls.push('clear_queue'); throw new Error('synthetic cleanup failure'); } });
  failedLifecycle.start(8);
  const failedCleanup = await failedLifecycle.signal('recursive-capture');
  check(task, 'lifecycle.cleanup-failure-blocks-restart', { state: failedLifecycle.snapshot().state, failedSteps: failedCleanup.failedSteps, restart: (await captureFailure(() => failedLifecycle.start(9))) !== null }, { state: 'cleanup_failed', failedSteps: ['clear_queue'], restart: true }, 'failure');
  return { methods, noteId: shared.noteId, todoId: shared.todoId, actualDeviceConnected: false, systemNotificationVerified: false, inputInjected: false };
}

async function runBackendPath(task, modules, shared) {
  const { application, apiClient, config, mocks, serverAuth, serverFamily, serverRepositories } = modules;
  const repositories = serverRepositories.createInMemoryRepositories();
  const auth = new serverAuth.AuthService(repositories, { now: () => fixtureNow });
  const family = new serverFamily.FamilyService(repositories, { now: () => fixtureNow, invitationTtlMs: 60_000 });
  const subject = auth.createAccount({ account_id: 'synthetic-backend-subject' });
  const helper = auth.createAccount({ account_id: 'synthetic-backend-helper' });
  const other = auth.createAccount({ account_id: 'synthetic-backend-other' });
  const scopes = ['learning.read', 'assist.request'];
  const consent = family.createConsent(subject.account_id, { subject_id: subject.account_id, purpose: 'learning_share', scopes, notice_version: 'synthetic-v1' });
  const invitation = family.invite(subject.account_id, { helper_ref: helper.account_id, requested_scopes: scopes });
  const relation = family.accept(helper.account_id, invitation.invitation_id, { consent_id: consent.consent_id, scopes }).relation;
  check(task, 'family.authorized-relation', family.authorize(helper.account_id, subject.account_id, 'assist.request').relation_id, relation.relation_id);
  check(task, 'family.cross-owner-denied', (await captureFailure(() => family.authorize(other.account_id, subject.account_id, 'assist.request'))) !== null, true, 'security');
  family.revoke(subject.account_id, relation.relation_id);
  check(task, 'family.revoke-denies-immediately', (await captureFailure(() => family.authorize(helper.account_id, subject.account_id, 'assist.request'))) !== null, true, 'stop');

  const unconnectedConversation = new apiClient.UnconnectedConversation();
  const serviceFailure = await captureFailure(() => application.readConversation(unconnectedConversation, '合成问题', new AbortController().signal, () => {}));
  const unconnectedRepository = new apiClient.UnconnectedRepository();
  const repositoryFailures = await Promise.all([
    captureFailure(() => unconnectedRepository.load(shared.noteId)),
    captureFailure(() => unconnectedRepository.commit(shared.noteId, mocks.createScenarioSnapshot(shared.noteId, 'empty'))),
    captureFailure(() => unconnectedRepository.clear(shared.noteId)),
  ]);
  check(task, 'unconnected-service-no-mock-fallback', serviceFailure?.message.includes('不会回退'), true, 'failure');
  check(task, 'unconnected-repository-no-data-side-effects', repositoryFailures.every(error => error !== null), true, 'failure');
  check(task, 'memory-service-not-production', { storage: repositories.storage, production: repositories.isProductionDatabase }, { storage: 'memory', production: false }, 'security');
  const localConfiguration = config.configuration({ VITE_API_MODE: 'mock', VITE_PLATFORM_MODE: 'browser', VITE_MOCK_SCENARIO: 'success' }, false);
  check(task, 'configuration-explicit-local-mode', localConfiguration, { apiMode: 'mock', platformMode: 'browser', scenario: 'success' });
  for (const [name, environment, production] of [
    ['production-mock', { VITE_API_MODE: 'mock' }, true],
    ['real-with-scenario', { VITE_API_MODE: 'real', VITE_MOCK_SCENARIO: 'offline' }, false],
    ['unknown-scenario', { VITE_MOCK_SCENARIO: 'not-a-scenario' }, false],
  ]) check(task, `configuration.${name}-closed`, (await captureFailure(() => config.configuration(environment, production))) !== null, true, 'security');
  return { transport: 'none', serverStarted: false, database: 'in_memory', accountCount: 3, relation: relation.relation_id, serviceFailure: serviceFailure.code, repositoryFailures: repositoryFailures.length, deploymentVerified: false };
}

async function runAiMediaPath(task, modules, shared) {
  const { media, privacy, provider } = modules;
  const sandboxReport = await provider.verifyProviderSandbox();
  for (const item of sandboxReport.checks) {
    check(task, `provider.${item.id}`, { passed: item.passed, status: item.result.status, network: item.result.networkAttempted, raw: item.result.rawPayloadsRetained }, { passed: true, status: item.expected, network: false, raw: 0 }, item.expected === 'passed' ? 'success' : item.expected === 'cancelled' ? 'stop' : 'failure');
  }
  check(task, 'provider.formal-boundary', { status: sandboxReport.status, credentialState: sandboxReport.realCredentialState, productionReady: sandboxReport.productionReady }, { status: 'blocked', credentialState: 'missing', productionReady: false }, 'security');

  const receiver = new media.InMemoryMediaReceiver();
  let ticket = 0;
  const relay = new media.ControlledMediaRelay({
    now: () => 1200,
    nextTicketId: () => `synthetic-f-ticket-${++ticket}`,
    encoder: async approved => encodeSafeFrame(approved),
    sender: async (outlet, packet) => receiver.receive(outlet, packet),
  });
  relay.start(syntheticGate());
  const accepted = relay.submit(syntheticFrame());
  await relay.drain();
  check(task, 'media.safe-frame-to-both-outlets', { accepted: accepted.accepted, sent: relay.snapshot().sentByOutlet }, { accepted: true, sent: { ai: 1, family: 1 } });
  const transaction = relay.submit(syntheticFrame({ text: '合成页面：支付转账' }));
  const detector = relay.submit(syntheticFrame({ ocrStatus: 'failed' }));
  check(task, 'media.risk-and-detector-fail-closed', [transaction, detector], [{ accepted: false, reason: 'transaction_risk' }, { accepted: false, reason: 'ocr_failed' }], 'security');
  const packets = Object.values(receiver.snapshot()).flat();
  check(task, 'media.metadata-only-no-payload', packets.every(packet => packet.codec === 'synthetic-redacted-metadata' && !('text' in packet) && !('raw' in packet) && !('pixels' in packet)), true, 'security');
  relay.stop('user');
  check(task, 'media.submit-after-stop-denied', relay.submit(syntheticFrame()), { accepted: false, reason: 'inactive' }, 'stop');

  let release;
  const stoppedReceiver = new media.InMemoryMediaReceiver();
  const delayed = new media.ControlledMediaRelay({
    now: () => 1200, maxQueue: 2, nextTicketId: () => `synthetic-f-delayed-${++ticket}`,
    encoder: approved => new Promise(resolve => { release = () => resolve(encodeSafeFrame(approved)); }),
    sender: async (outlet, packet) => stoppedReceiver.receive(outlet, packet),
  });
  delayed.start(syntheticGate());
  delayed.submit(syntheticFrame());
  delayed.submit(syntheticFrame({ frameId: 'synthetic-queued' }));
  check(task, 'media.queue-is-bounded', delayed.submit(syntheticFrame({ frameId: 'synthetic-overflow' })), { accepted: false, reason: 'queue_full' }, 'failure');
  delayed.stop('user');
  release?.();
  await delayed.drain();
  check(task, 'media.stop-drops-queued-and-late-encode', { active: delayed.snapshot().active, queued: delayed.snapshot().queued, inFlight: delayed.snapshot().inFlight, staleDrops: delayed.snapshot().staleDrops, sent: stoppedReceiver.attempted.length }, { active: false, queued: 0, inFlight: 0, staleDrops: 2, sent: 0 }, 'stop');
  const failed = new media.ControlledMediaRelay({ now: () => 1200, nextTicketId: () => 'synthetic-f-encoder-failed', encoder: async () => { throw new Error('synthetic encoder failure'); }, sender: async () => { throw new Error('unreachable sender'); } });
  failed.start(syntheticGate());
  failed.submit(syntheticFrame());
  await failed.drain();
  check(task, 'media.encoder-failure-stops', { active: failed.snapshot().active, failures: failed.snapshot().encoderFailures, reason: failed.snapshot().lastStopReason }, { active: false, failures: 1, reason: 'encoder-failed' }, 'failure');
  return { providerStatus: sandboxReport.status, checks: sandboxReport.checks.length, networkAttempted: sandboxReport.networkAttempted, rawPayloadsRetained: sandboxReport.rawPayloadsRetained, mediaSent: relay.snapshot().sentByOutlet, actualProviderConnected: false, noteId: shared.noteId };
}

async function runSecurityPath(task, modules) {
  const { domain, localData, mocks, privacy, reminder } = modules;
  let guide = domain.guideReducer(domain.guideReducer(domain.initialGuide, { type: 'START' }), { type: 'CONSENT' });
  const lowConfidence = domain.guideReducer(guide, { type: 'LOW_CONFIDENCE', generation: guide.generation });
  check(task, 'guide.low-confidence-pauses', { state: lowConfidence.state, lateTargetIgnored: JSON.stringify(domain.guideReducer(lowConfidence, { type: 'TARGET', generation: guide.generation })) === JSON.stringify(lowConfidence) }, { state: 'need_help', lateTargetIgnored: true }, 'security');
  const riskPaused = domain.guideReducer(guide, { type: 'RISK', risk: 'transaction' });
  const resumed = domain.guideReducer(riskPaused, { type: 'RESUME' });
  check(task, 'guide.risk-requires-renewed-consent', { paused: riskPaused.state, resumed: resumed.state, generationAdvanced: resumed.generation > guide.generation }, { paused: 'risk_paused', resumed: 'await_consent', generationAdvanced: true }, 'security');
  const ended = domain.guideReducer(guide, { type: 'STOP' });
  check(task, 'guide.stop-rejects-late-events', JSON.stringify(domain.guideReducer(ended, { type: 'TARGET', generation: guide.generation })) === JSON.stringify(ended) && JSON.stringify(domain.guideReducer(ended, { type: 'RISK', risk: 'transaction' })) === JSON.stringify(ended), true, 'stop');

  const secret = '验证码: SYNTHETICCODE';
  const redacted = domain.redactSecrets(secret);
  check(task, 'privacy.redacts-secret', { risk: domain.detectTextRisk(secret), removed: !redacted.includes('SYNTHETICCODE') }, { risk: 'transaction', removed: true }, 'security');
  const safety = new privacy.FrameSafetyGate();
  safety.authorize(syntheticGate());
  const safeFrame = syntheticFrame();
  const ticket = safety.issue(safeFrame, 1200, 'synthetic-f-security-ticket');
  check(task, 'privacy.ticket-allows-authorized-frame', ticket !== null && safety.permits(ticket, safeFrame, 1200), true, 'security');
  safety.stop();
  check(task, 'privacy.stop-revokes-ticket', safety.permits(ticket, safeFrame, 1200), false, 'stop');
  for (const [name, changes, contextChanges, reason] of [
    ['consent', {}, { consent: false }, 'missing_consent'],
    ['system', {}, { systemAuthorized: false }, 'missing_system_authorization'],
    ['destination', {}, { destinationAuthorized: false }, 'destination_unauthorized'],
    ['stopped', {}, { sessionActive: false }, 'session_stopped'],
    ['stale', { generation: 7 }, {}, 'stale_generation'],
    ['detector', { detectorStatus: 'failed' }, {}, 'detector_failed'],
    ['unknown', { pageKind: 'unknown' }, {}, 'unknown_page'],
    ['confidence', { confidence: 0.1 }, {}, 'low_confidence'],
    ['face', { thirdPartyFaces: 1, faceRedaction: 'failed' }, {}, 'face_redaction_failed'],
    ['private', { text: '合成页面：密码' }, {}, 'private_risk'],
    ['medical', { text: '合成页面：用药方案' }, {}, 'medical_risk'],
    ['investment', { text: '合成页面：投资建议' }, {}, 'investment_risk'],
  ]) {
    const decision = privacy.evaluateLocalFrame(syntheticFrame(changes), syntheticGate(contextChanges), 1200);
    check(task, `privacy.${name}-denied`, { reason: decision.reason, outboundAllowed: decision.outboundAllowed }, { reason, outboundAllowed: false }, 'security');
  }

  const conflictResults = [];
  for (const choice of ['local', 'other']) {
    const conflictOwner = `synthetic-f-conflict-${choice}`;
    const base = mocks.createScenarioSnapshot(conflictOwner, 'empty');
    base.notes = [{ id: 'synthetic-conflict-note', ownerId: conflictOwner, question: 'q', topic: 't', summary: 'original', mastery: 'unmastered', masterySource: null, reviewedAt: null, source: 'conversation', createdAt: fixtureTime, updatedAt: fixtureTime, version: 1, deletedAt: null }];
    base.todos = [{ id: 'synthetic-conflict-todo', ownerId: conflictOwner, title: 'original todo', dueAt: '2026-10-18T01:00:00.000Z', timezone: 'Asia/Shanghai', noteId: 'synthetic-conflict-note', completedAt: null, repeat: 'none', source: 'review', createdAt: fixtureTime, updatedAt: fixtureTime, version: 1, deletedAt: null }];
    const repository = new mocks.ScenarioRepository(new localData.IndexedDbRepository(), 'version-conflict');
    await repository.commit(conflictOwner, base);
    const proposed = structuredClone(base);
    proposed.notes[0].summary = 'synthetic local note';
    proposed.todos[0].title = 'synthetic local todo';
    const conflict = await captureFailure(() => repository.commit(conflictOwner, proposed));
    const preserved = await repository.load(conflictOwner);
    check(task, `conflict.${choice}.preserved`, { code: conflict?.code, originalNote: preserved.notes[0].summary, originalTodo: preserved.todos[0].title, drafts: preserved.conflicts?.length }, { code: 'VERSION_CONFLICT', originalNote: 'original', originalTodo: 'original todo', drafts: 2 }, 'conflict');
    const foreignResolution = await captureFailure(() => repository.resolveConflict('synthetic-foreign-owner', preserved.conflicts[0].id, choice));
    check(task, `conflict.${choice}.foreign-owner-denied`, foreignResolution?.code, 'VERSION_CONFLICT', 'security');
    let resolved = preserved;
    for (const draft of preserved.conflicts) resolved = await repository.resolveConflict(conflictOwner, draft.id, choice);
    check(task, `conflict.${choice}.explicit-resolution`, { drafts: resolved.conflicts?.length, outbox: resolved.outbox.length, note: resolved.notes[0].summary, todo: resolved.todos[0].title }, { drafts: 0, outbox: choice === 'local' ? 2 : 0, note: choice === 'local' ? 'synthetic local note' : 'original\n合成另一版本：复习前先核对手机菜单。', todo: choice === 'local' ? 'synthetic local todo' : '另一处演示版本：original todo' }, 'conflict');
    conflictResults.push({ choice, rejectedWrite: conflict.code, preservedDrafts: preserved.conflicts.length, remainingDrafts: resolved.conflicts.length, pendingOutbox: resolved.outbox.length });
  }

  const reminderTodoId = '00000000-0000-4000-8000-000000000301';
  const reminderPlan = { todoId: reminderTodoId, plannedAt: '2026-10-17T01:30:00.000Z', timezone: 'Asia/Shanghai', scheduleRevision: 1, deepLink: `/review/${reminderTodoId}`, repeat: 'none', channel: 'local' };
  const instanceId = await reminder.deriveReminderInstanceId(reminderTodoId, 1, reminderPlan.plannedAt);
  const ledger = new reminder.ReminderLedger();
  const first = await ledger.schedule({ ...reminderPlan, instanceId });
  const replay = await ledger.schedule({ ...reminderPlan, instanceId });
  const sameVersionConflict = await captureFailure(() => ledger.schedule({ ...reminderPlan, instanceId, deepLink: `/todos/edit/${reminderTodoId}` }));
  check(task, 'reminder.idempotent-and-conflict-safe', { first: first.idempotent, replay: replay.idempotent, conflict: sameVersionConflict?.code }, { first: false, replay: true, conflict: 'SCHEDULE_CONFLICT' }, 'conflict');
  let scheduled = 0;
  let cancelled = 0;
  const dispatch = new reminder.ReminderDispatchGate('system', 'unknown', { schedule: async () => { scheduled += 1; }, cancel: async () => { cancelled += 1; } });
  dispatch.start(8);
  const unknownPermission = await dispatch.schedule(ownerId, first.occurrence);
  await dispatch.updatePermission('granted');
  await dispatch.schedule(ownerId, first.occurrence);
  const revoke = await dispatch.updatePermission('denied');
  const late = await dispatch.schedule(ownerId, first.occurrence);
  check(task, 'reminder.permission-stop-fence', { unknown: unknownPermission.status, unknownReason: unknownPermission.reason, scheduled, cancelled, revoke: revoke.cancelled, active: dispatch.snapshot().active, late: late.status, generation: dispatch.snapshot().generation }, { unknown: 'not_scheduled', unknownReason: 'permission_unknown', scheduled: 1, cancelled: 1, revoke: 1, active: false, late: 'not_scheduled', generation: 9 }, 'stop');
  return { conflictResults, safetyGeneration: safety.generation, stoppedGuideState: ended.state, reminderConflict: sameVersionConflict.code, permissionAfterStop: dispatch.snapshot().permission, independentReview: false };
}

function installOfflineGuard() {
  const attempts = [];
  const restorations = [];
  function deny(target, name, label = name) {
    const original = target[name];
    target[name] = () => {
      attempts.push(label);
      throw new Error(`F_INTEGRATION_OFFLINE: ${label}`);
    };
    restorations.push(() => { target[name] = original; });
  }
  for (const [target, names] of [
    [net, ['connect', 'createConnection']], [tls, ['connect']],
    [http, ['request', 'get']], [https, ['request', 'get']], [http2, ['connect']],
    [childProcess, ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']],
    [globalThis, ['fetch', 'WebSocket', 'EventSource']],
  ]) for (const name of names) deny(target, name);
  deny(net.Socket.prototype, 'connect', 'socket.connect');
  deny(net.Server.prototype, 'listen', 'server.listen');
  for (const name of ['bind', 'send', 'connect']) deny(dgram.Socket.prototype, name, `dgram.${name}`);
  for (const target of [dns, dns.promises]) {
    for (const name of Object.keys(target)) if (name === 'lookup' || name.startsWith('resolve')) deny(target, name, `dns.${name}`);
  }
  syncBuiltinESMExports();
  return { attempts, restore() { for (const restore of restorations.reverse()) restore(); syncBuiltinESMExports(); } };
}

async function main() {
  parseArguments();
  const report = createReport();
  const guard = installOfflineGuard();
  try {
    if (['NUANBAN_REAL_NETWORK', 'NUANBAN_PRODUCTION_DATA', 'NUANBAN_REAL_DEVICES'].some(name => process.env[name] === 'true')) {
      throw new Error('Unsafe runtime flag detected; synthetic integration was not started.');
    }
    const modules = await loadModules();
    await runTask(tasks[0], task => runSharedPath(task, modules));
    const shared = tasks[0].observations;
    for (const [index, operation] of [runAndroidPath, runWindowsPath, runBackendPath, runAiMediaPath, runSecurityPath].entries()) {
      await runTask(tasks[index + 1], task => operation(task, modules, shared));
    }
    report.paths = Object.fromEntries(tasks.map(task => [task.id, { status: task.developmentStatus, assertions: task.assertions.length }]));
  } catch (error) {
    report.setupError = String(error?.message ?? 'Integration setup failed');
  } finally {
    guard.restore();
  }
  report.networkAttempts = guard.attempts;
  report.success = !report.setupError && guard.attempts.length === 0 && tasks.every(task => task.developmentStatus === 'passed');
  report.status = report.success ? 'development_checks_passed' : 'development_checks_failed';
  report.developmentStatus = report.success ? 'passed' : 'failed';
  report.development = { status: report.success ? 'verified' : 'blocked_by_code' };
  report.verification = { status: 'external_pending', blockers: report.blockers };
  report.assertionSummary = { total: assertions.length, passed: assertions.filter(item => item.passed).length, failed: assertions.filter(item => !item.passed).length };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.success ? 0 : 1;
}

await main();
