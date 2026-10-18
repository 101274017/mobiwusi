import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertGateMode, evaluateProjectGate, exitCodeForGate, fingerprintInventory } from './project-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function source(relativePath) {
  const file = path.join(root, relativePath);
  try {
    const contents = fs.readFileSync(file);
    return { file, text: contents.toString('utf8'), bytes: contents.byteLength, contentSha256: createHash('sha256').update(contents).digest('hex') };
  } catch {
    return { file, text: null, bytes: 0, contentSha256: null };
  }
}

function check(id, title, requirements) {
  const missing = [];
  const files = new Set();
  for (const requirement of requirements) {
    const loaded = source(requirement.file);
    files.add(requirement.file);
    if (loaded.text === null || !loaded.text.includes(requirement.text)) missing.push(`${requirement.file}: ${requirement.text}`);
  }
  return {
    id,
    title,
    status: missing.length === 0 ? 'passed' : 'failed',
    passed: missing.length === 0,
    kind: 'code',
    files: [...files],
    missing,
  };
}

const checks = [
  check('C17-01', '组合根同时装配本地仓储与平台端口', [
    { file: 'apps/web/src/composition.ts', text: 'new IndexedDbRepository()' },
    { file: 'apps/web/src/composition.ts', text: 'createPlatform()' },
    { file: 'apps/web/src/composition.ts', text: 'ownerId:' },
    { file: 'apps/web/src/bootstrap.tsx', text: 'initialize(services, initialSnapshot)' },
  ]),
  check('C17-02', '本地仓储使用账号命名空间和事务冲突保护', [
    { file: 'packages/local-data/src/index.ts', text: 'export class IndexedDbRepository' },
    { file: 'packages/local-data/src/index.ts', text: 'commitIfUnchanged' },
    { file: 'packages/local-data/src/index.ts', text: "transaction('accounts', 'readwrite')" },
    { file: 'packages/local-data/src/index.ts', text: 'store.put(structuredClone(next), ownerId)' },
    { file: 'packages/local-data/src/index.ts', text: 'this.ownerId + \'/job/\'' },
  ]),
  check('C17-03', 'Android 本地桥接限制来源、主框架、代际和迟到响应', [
    { file: 'packages/platform-ports/src/android-message-host.ts', text: "environment.origin !== 'https://appassets.androidplatform.net'" },
    { file: 'packages/platform-ports/src/android-message-host.ts', text: '!environment.mainFrame' },
    { file: 'packages/platform-ports/src/android-message-host.ts', text: 'isBridgeMessage(message)' },
    { file: 'packages/platform-ports/src/android-message-host.ts', text: 'this.rejectPending' },
    { file: 'packages/platform-ports/src/android-message-host.ts', text: "addEventListener('pagehide', this.dispose)" },
    { file: 'packages/platform-ports/src/android-message-host.ts', text: 'Native bridge timeout' },
    { file: 'packages/platform-ports/src/android-message-host.ts', text: "reminder_schedule" },
    { file: 'packages/platform-ports/src/android-message-host.ts', text: "reminder_notify_due" },
  ]),
  check('C17-04', '未验证的高风险原生能力保持关闭', [
    { file: 'packages/platform-ports/src/index.ts', text: 'externalCapture: false' },
    { file: 'packages/platform-ports/src/index.ts', text: 'remoteMedia: false' },
    { file: 'packages/platform-ports/src/index.ts', text: 'nativeOverlay: false' },
    { file: 'packages/platform-ports/src/index.ts', text: 'notifications: false' },
    { file: 'packages/platform-ports/src/index.ts', text: "status: 'unsupported'" },
    { file: 'packages/platform-ports/src/index.ts', text: "status: 'page_only'" },
  ]),
  check('C17-05', 'C17 关键边界已有本机合成测试入口', [
    { file: 'tests/integration/local-data.test.ts', text: '不同 owner 不能读取彼此资料' },
    { file: 'tests/platform/android-message-host.test.ts', text: '只绑定可信本地 HTTPS 主框架' },
    { file: 'tests/platform/native-host.test.ts', text: '只识别受支持宿主' },
    { file: 'tests/contract/active-bridge.test.ts', text: '活动桥协议独立于未来宽桥草案' },
  ]),
  check('C17-06', '组合根不把真实服务或系统权限伪装成已接入', [
    { file: 'packages/config/src/index.ts', text: "if (production && apiMode === 'mock')" },
    { file: 'apps/web/src/composition.ts', text: 'UnconnectedRepository' },
    { file: 'packages/platform-ports/README.md', text: '真实锁屏、撤权、进程终止' },
    { file: 'packages/contracts/README.md', text: '不等于 Android WebView/系统生命周期真机通过' },
  ]),
  check('C17-07', 'Electron 桌面本地提醒仓储通过受限主进程桥接', [
    { file: 'apps/desktop/reminder-store.cjs', text: 'DatabaseSync' },
    { file: 'apps/desktop/reminder-store.cjs', text: 'account_id' },
    { file: 'apps/desktop/main.cjs', text: 'createDesktopReminderStore' },
    { file: 'apps/desktop/main.cjs', text: "nuanban:reminders:schedule" },
    { file: 'apps/desktop/preload.cjs', text: "nuanban:reminders:schedule" },
  ]),
  check('C17-08', 'Android Room 本地提醒预备层存在且保持系统能力保守回退', [
    { file: 'apps/android/app/build.gradle.kts', text: 'androidx.room:room-runtime:2.8.5' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderEntity.kt', text: 'primaryKeys = ["account_id", "instance_id"]' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderEntity.kt', text: '@ColumnInfo(name = "failed_at")' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDatabase.kt', text: 'MIGRATION_1_2' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'database.runInTransaction' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt', text: 'assertReceiptOrder' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderNotificationScheduler.kt', text: 'setExactAndAllowWhileIdle' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/ReminderNotificationScheduler.kt', text: 'return AndroidReminderScheduleResult("unsupported"' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'RoomReminderStore' },
    { file: 'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt', text: 'bridgeExecutor' },
    { file: 'packages/contracts/kotlin/src/main/kotlin/org/nuanban/contracts/ActiveBridgeProtocol.kt', text: 'REMINDER_SCHEDULE' },
    { file: 'scripts/check-android-room.mjs', text: 'defaultNonNullColumns' },
    { file: 'scripts/check-reminder-transition-jvm.ps1', text: 'systemSchedulerVerified -ne $false' },
    { file: 'tests/native/ReminderTransitionCheck.kt', text: 'failure receipt fields remain terminal and monotonic' },
  ]),
  check('C17-09', 'Electron 桌面通知适配器仅在显式能力与权限通过后提交', [
    { file: 'apps/desktop/notification-adapter.cjs', text: 'Notification.isSupported' },
    { file: 'apps/desktop/notification-adapter.cjs', text: "permission !== 'granted'" },
    { file: 'apps/desktop/notification-adapter.cjs', text: "notification.on('show'" },
    { file: 'apps/desktop/notification-adapter.cjs', text: "notification.on('click'" },
    { file: 'apps/desktop/notification-adapter.cjs', text: "notification.on('failed'" },
    { file: 'apps/desktop/notification-adapter.cjs', text: "return { status: 'unsupported'" },
    { file: 'tests/platform/desktop-notification-adapter.test.ts', text: '只关闭当前适配器持有的通知' },
    { file: 'apps/desktop/reminder-notification-bridge.cjs', text: 'store.submitDue' },
    { file: 'apps/desktop/reminder-notification-bridge.cjs', text: 'store.recordReceipt' },
    { file: 'apps/desktop/reminder-notification-bridge.cjs', text: "status: 'unsupported'" },
    { file: 'apps/desktop/reminder-store.cjs', text: 'failed_at' },
    { file: 'apps/desktop/reminder-store.cjs', text: 'INVALID_RECEIPT_ORDER' },
    { file: 'apps/desktop/native-lab/c07-c08-sqlite-preflight.mjs', text: 'productionStorePreflight: true' },
    { file: 'apps/desktop/native-lab/c07-c08-sqlite-preflight.mjs', text: 'systemSchedulerVerified: false' },
    { file: 'apps/desktop/main.cjs', text: 'nuanban:reminders:notify-due' },
    { file: 'apps/desktop/preload.cjs', text: "nuanban:reminder-open" },
    { file: 'tests/platform/desktop-reminder-bridge.test.ts', text: '到期提醒持久化 submitted/delivered/opened' },
  ]),
];

const inventoryPaths = [
  'scripts/check-c17-assembly.mjs',
  'vitest.config.ts',
  'tests/setup.ts',
  'packages/privacy/src/index.ts',
  'packages/media-relay/src/index.ts',
  'packages/guidance-engine/src/index.ts',
  'packages/provider-sandbox/src/index.ts',
  'packages/config/src/index.ts',
  'packages/config/src/scenarios.ts',
  'tests/privacy/c03-gate.test.ts',
  'tests/privacy/c04-media-relay.test.ts',
  'tests/domain/guidance-platform.test.ts',
  'tests/provider/provider-sandbox.test.ts',
  'apps/web/src/composition.ts',
  'apps/web/src/bootstrap.tsx',
  'packages/local-data/src/index.ts',
  'packages/platform-ports/src/index.ts',
  'packages/platform-ports/src/android-message-host.ts',
  'apps/desktop/reminder-store.cjs',
  'apps/desktop/notification-adapter.cjs',
  'apps/desktop/reminder-notification-bridge.cjs',
  'apps/desktop/main.cjs',
  'apps/desktop/preload.cjs',
  'apps/android/app/build.gradle.kts',
  'apps/android/app/src/main/AndroidManifest.xml',
  'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderEntity.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDao.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderDatabase.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/data/ReminderStore.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/ReminderNotificationScheduler.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/ReminderAlarmReceiver.kt',
  'apps/android/app/src/main/java/org/nuanban/assistant/MainActivity.kt',
  'packages/contracts/kotlin/src/main/kotlin/org/nuanban/contracts/ActiveBridgeProtocol.kt',
  'tests/integration/local-data.test.ts',
  'tests/platform/android-message-host.test.ts',
  'tests/platform/native-host.test.ts',
  'tests/contract/active-bridge.test.ts',
  'tests/platform/desktop-notification-adapter.test.ts',
  'tests/platform/desktop-reminder-bridge.test.ts',
].map(relativePath => {
  const loaded = source(relativePath);
  return {
    file: relativePath,
    exists: loaded.text !== null,
    bytes: loaded.bytes,
    contentSha256: loaded.contentSha256,
  };
});

function runLocalCommand() {
  const testFiles = [
    'tests/privacy/c03-gate.test.ts',
    'tests/privacy/c04-media-relay.test.ts',
    'tests/domain/guidance-platform.test.ts',
    'tests/provider/provider-sandbox.test.ts',
    'tests/integration/local-data.test.ts',
    'tests/platform/android-message-host.test.ts',
    'tests/platform/native-host.test.ts',
    'tests/contract/active-bridge.test.ts',
    'tests/platform/desktop-notification-adapter.test.ts',
    'tests/platform/desktop-reminder-bridge.test.ts',
  ];
  const vitest = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
  const arguments_ = [vitest, 'run', ...testFiles, '--reporter=dot', '--maxWorkers=2', '--no-file-parallelism'];
  const result = spawnSync(process.execPath, arguments_, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  return {
    command: [process.execPath, ...arguments_].join(' '),
    exitCode: typeof result.status === 'number' ? result.status : 1,
    signal: result.signal ?? null,
    passed: result.status === 0,
    stdout: String(result.stdout ?? '').trim().slice(-2000),
    stderr: String(result.stderr ?? '').trim().slice(-2000),
  };
}

function writeGeneratedReport(file, report) {
  const absolutePath = path.resolve(root, file);
  if (fs.existsSync(absolutePath) && !absolutePath.endsWith('-results.json')) return false;
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return true;
}

export function runC17AssemblyCheck({ evidencePath, mode = 'development', runCommands = true } = {}) {
  assertGateMode(mode);
  const commandResults = runCommands ? [runLocalCommand()] : [];
  const auditPassed = checks.every(item => item.status === 'passed');
  const commandFailures = commandResults.filter(item => !item.passed).map(item => ({
    id: 'C17_LOCAL_COMMAND',
    reason: `${item.command} exited with ${item.exitCode}`,
    kind: 'code',
  }));
  const externalPending = [
    {
      id: 'C17_WEBVIEW_DEVICE',
      capability: 'real_webview_and_lifecycle',
      reason: 'No real Android WebView or system lifecycle evidence is present.',
      production_enabled: false,
    },
    {
      id: 'C17_DESKTOP_RUNTIME',
      capability: 'desktop_install_upgrade_and_system_notification',
      reason: 'No installed desktop runtime, system permission or Toast evidence is present.',
      production_enabled: false,
    },
    {
      id: 'C17_INDEPENDENT_REVIEW',
      capability: 'native_assembly_independent_review',
      reason: 'C17 native assembly evidence has not received independent review.',
      production_enabled: false,
    },
  ];
  const gate = evaluateProjectGate({
    mode,
    checks,
    codeErrors: commandFailures,
    externalPending,
    release: { assessed: true, ready: false, blockers: externalPending },
  });
  const sourceRevision = fingerprintInventory(inventoryPaths);
  const report = {
    reportSchemaVersion: 'c17-assembly/v2',
    generatedBy: 'nuanban/scripts/check-c17-assembly.mjs',
    generatedAt: new Date().toISOString(),
    generatedDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()),
    generatedTimeZone: 'Asia/Shanghai',
    mode,
    scope: 'C17 shared storage and bridge assembly preflight',
    sourceRevision,
    status: auditPassed && commandFailures.length === 0 ? 'ready_for_development' : 'blocked',
    acceptance: 'preparatory_not_accepted',
    auditPassed: auditPassed && commandFailures.length === 0,
    browserStorageVerified: auditPassed ? 'synthetic_only' : 'not_ready',
    nativeBridgeVerified: auditPassed ? 'synthetic_only' : 'not_ready',
    androidRoomVerified: auditPassed ? 'compile_only' : 'not_ready',
    desktopStoreVerified: auditPassed ? 'static_only' : 'not_ready',
    desktopNotificationVerified: auditPassed ? 'synthetic_only' : 'not_ready',
    accountIsolationAudited: checks.find(item => item.id === 'C17-02')?.status === 'passed',
    highRiskCapabilitiesEnabled: false,
    goNoGoEligible: gate.release.ready,
    checks,
    commandResults,
    development: gate.development,
    default: gate.default,
    external: gate.external,
    release: gate.release,
    blockers: [...gate.development.failedChecks.map(item => item.reason), ...externalPending.map(item => item.reason)],
    evidenceInventory: inventoryPaths,
    recordSchema: [
      'date_and_timezone',
      'source_files_and_hashes',
      'owner_namespace_and_transaction_boundary',
      'bridge_origin_main_frame_correlation_timeout',
      'capability_flags_and_disabled_paths',
      'synthetic_test_commands',
      'device_webview_room_sqlite_evidence',
      'limitations_executor_independent_reviewer',
    ],
    limitations: [
      'IndexedDB、Chrome 同源消息通道和静态组合根只证明本机预备层，不证明真实 WebView 或 Electron 生产运行时。',
      'Android Room 和 Electron SQLite 的本机预备证据不能替代旧库升级/备份恢复、系统权限、系统投递或应用生命周期回执。',
      '系统权限不得由 Mock 伪造；真实平台端口、设备矩阵和独立复核仍属于外部发布前置条件。',
    ],
  };
  if (evidencePath) writeGeneratedReport(evidencePath, report);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const evidenceIndex = process.argv.indexOf('--evidence');
  const noWrite = process.argv.includes('--no-write');
  const modeIndex = process.argv.indexOf('--mode');
  const mode = modeIndex >= 0 && process.argv[modeIndex + 1] ? process.argv[modeIndex + 1] : 'development';
  const evidencePath = noWrite
    ? undefined
    : evidenceIndex >= 0 && process.argv[evidenceIndex + 1]
      ? process.argv[evidenceIndex + 1]
      : 'docs/implementation/evidence/c17-assembly-results.json';
  try {
    const report = runC17AssemblyCheck({ evidencePath, mode });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = exitCodeForGate({ mode, development: report.development, release: report.release });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
