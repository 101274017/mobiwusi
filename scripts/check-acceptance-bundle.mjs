import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { assertGateMode, evaluateProjectGate, exitCodeForGate } from './project-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const evidenceIndex = process.argv.indexOf('--evidence');
const evidencePath = evidenceIndex >= 0 && process.argv[evidenceIndex + 1]
  ? path.resolve(process.cwd(), process.argv[evidenceIndex + 1])
  : null;
const noWrite = process.argv.includes('--no-write');
const modeIndex = process.argv.indexOf('--mode');
const mode = assertGateMode(modeIndex >= 0 ? process.argv[modeIndex + 1] : 'development');

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
  } catch {
    return null;
  }
}

function exists(relativePath) {
  return fs.existsSync(absolute(relativePath));
}

function check(id, title, passed, details = {}, missing = []) {
  return { id, title, status: passed ? 'passed' : 'failed', details, missing };
}

const packageJson = readJson('package.json');
const unit = readJson('docs/implementation/evidence/unit-results.json');
const e2e = readJson('docs/implementation/evidence/e2e-results.json');
const notification = readJson('docs/implementation/evidence/desktop-notification-adapter-results.json');
const room = readJson('docs/implementation/evidence/android-room-results.json');
const roomJvm = readJson('docs/implementation/evidence/android-room-jvm-results.json');
const c17 = readJson('docs/implementation/evidence/c17-assembly-results.json');
const dGate = readJson('docs/implementation/evidence/d-gate-readiness-results.json');
const dGateCheckIds = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08'];
const dGateChecks = Array.isArray(dGate?.checks) ? dGate.checks : [];
const c17Gate = evaluateProjectGate({
  mode: 'development',
  checks: c17?.checks ?? [],
  externalPending: c17?.external?.pending ?? [],
  release: c17?.release ?? { assessed: true, ready: false },
});
const c17Development = c17?.development ?? c17Gate.development;
const c17Release = c17?.release ?? c17Gate.release;
const c17DevelopmentReady = Boolean(c17?.auditPassed)
  && c17Gate.development.eligible === true
  && c17Development?.eligible === true
  && ['DEV_READY', 'DEV_READY_WITH_EXTERNAL_PENDING'].includes(c17Development?.verdict)
  && c17?.checks?.length > 0;
const dGateStateValid = Boolean(dGate?.auditPassed)
  && dGate.status === 'blocked'
  && dGate.acceptance === 'preparatory_not_accepted'
  && dGate.goNoGoEligible === false
  && dGate.eAfterDEligible === false
  && dGate.eStarted === false
  && dGate.fStarted === false
  && dGateChecks.length === dGateCheckIds.length
  && dGateCheckIds.every((id, index) => dGateChecks[index]?.id === id && dGateChecks[index]?.status === 'blocked');
const dGateStateMissing = !dGate
  ? ['docs/implementation/evidence/d-gate-readiness-results.json']
  : dGateStateValid
    ? []
    : ['D01-D08 must remain blocked; D must not authorize E/F'];
const expectedE2eTests = 96;
const asarPath = 'apps/desktop/out/NuanbanDemo-win32-x64/resources/app.asar';
let packagedFiles = [];
try {
  packagedFiles = asar.listPackage(absolute(asarPath)).map(file => file.replaceAll('\\', '/'));
} catch {
  packagedFiles = [];
}

const requiredFiles = [
  'README.md',
  'docs/implementation/status.md',
  'docs/implementation/wbs.md',
  'docs/implementation/acceptance.md',
  'docs/implementation/verification.md',
  'docs/implementation/demo-scenarios.md',
  'docs/implementation/c17-assembly.md',
  'docs/implementation/evidence/unit-results.json',
  'docs/implementation/evidence/e2e-results.json',
  'docs/implementation/evidence/android-room-results.json',
  'docs/implementation/evidence/android-room-jvm-results.json',
  'docs/implementation/evidence/desktop-notification-adapter-results.json',
  'docs/implementation/evidence/c17-assembly-results.json',
  'docs/implementation/evidence/d-gate-readiness-results.json',
  'docs/implementation/evidence/desktop-package-contents.txt',
];

const checks = [
  check(
    'FE13-01',
    '实施文档与证据目录完整',
    requiredFiles.every(relativePath => exists(relativePath)),
    { requiredFiles },
    requiredFiles.filter(relativePath => !exists(relativePath)),
  ),
  check(
    'FE13-02',
    '全量单元与边界验证证据有效',
    Boolean(unit?.success) && unit.numFailedTests === 0 && unit.numPassedTests >= 633,
    { testFiles: unit?.testResults?.length ?? 0, passedTests: unit?.numPassedTests ?? 0, failedTests: unit?.numFailedTests ?? null },
    !unit ? ['docs/implementation/evidence/unit-results.json'] : unit.numFailedTests !== 0 || unit.numPassedTests < 633 ? ['unit test baseline below 633 or has failures'] : [],
  ),
  check(
    'FE13-03',
    '双视口 E2E 证据无失败或跳过',
    Boolean(e2e?.stats) && e2e.stats.unexpected === 0 && e2e.stats.flaky === 0 && e2e.stats.skipped === 0 && e2e.stats.expected === expectedE2eTests,
    { expected: e2e?.stats?.expected ?? 0, unexpected: e2e?.stats?.unexpected ?? null, flaky: e2e?.stats?.flaky ?? null, skipped: e2e?.stats?.skipped ?? null },
    !e2e?.stats ? ['docs/implementation/evidence/e2e-results.json'] : e2e.stats.unexpected !== 0 || e2e.stats.flaky !== 0 || e2e.stats.skipped !== 0 || e2e.stats.expected !== expectedE2eTests ? [`E2E evidence must contain exactly ${expectedE2eTests} tests`] : [],
  ),
  check(
    'FE13-04',
    'Android Room 与桌面提醒预备证据保留真实限制',
    Boolean(room?.success) && room.roomCompileVerified && room.roomMigrationPreflightVerified && room.deviceVerified === false && room.systemSchedulerVerified === false && Boolean(roomJvm?.passed) && roomJvm.roomExecuted === false && roomJvm.deviceVerified === false && roomJvm.systemSchedulerVerified === false && Boolean(notification?.success) && notification.numFailedTests === 0 && notification.numPassedTests >= 9,
    { roomCompileVerified: room?.roomCompileVerified ?? false, roomMigrationPreflightVerified: room?.roomMigrationPreflightVerified ?? false, adbDeviceCount: room?.adbDeviceCount ?? null, deviceVerified: room?.deviceVerified ?? null, systemSchedulerVerified: room?.systemSchedulerVerified ?? null, transitionJvmCases: roomJvm?.cases ?? 0, roomExecuted: roomJvm?.roomExecuted ?? null, notificationTests: notification?.numPassedTests ?? 0 },
    !room || !roomJvm || !notification ? ['Android Room, pure JVM transition, or desktop notification evidence is missing'] : room.deviceVerified !== false || room.systemSchedulerVerified !== false || roomJvm.passed !== true || roomJvm.roomExecuted !== false || roomJvm.deviceVerified !== false || roomJvm.systemSchedulerVerified !== false || notification.numFailedTests !== 0 || notification.numPassedTests < 9 ? ['preparatory evidence does not preserve expected limitations'] : [],
  ),
  check(
    'FE13-05',
    'C17 开发就绪与正式发布待项使用共享双状态判定',
    c17DevelopmentReady && c17?.acceptance === 'preparatory_not_accepted' && c17?.goNoGoEligible === false && c17?.highRiskCapabilitiesEnabled === false,
    {
      auditPassed: c17?.auditPassed ?? false,
      status: c17?.status ?? null,
      acceptance: c17?.acceptance ?? null,
      developmentVerdict: c17Development?.verdict ?? null,
      developmentEligible: c17Development?.eligible ?? null,
      releaseVerdict: c17Release?.verdict ?? null,
      releaseReady: c17Release?.ready ?? null,
      goNoGoEligible: c17?.goNoGoEligible ?? null,
      highRiskCapabilitiesEnabled: c17?.highRiskCapabilitiesEnabled ?? null,
    },
    !c17
      ? ['docs/implementation/evidence/c17-assembly-results.json']
      : !c17DevelopmentReady
        ? ['C17 development verdict is not eligible or release state is incorrectly ready']
        : c17?.highRiskCapabilitiesEnabled !== false
          ? ['C17 high-risk capabilities must remain disabled']
          : [],
  ),
  check(
    'FE13-06',
    '桌面开发包包含受限提醒主进程文件',
    packagedFiles.length > 0 && ['main.cjs', 'preload.cjs', 'reminder-store.cjs', 'notification-adapter.cjs', 'reminder-notification-bridge.cjs'].every(file => packagedFiles.includes(`/${file}`) || packagedFiles.includes(`\\${file}`)),
    { asarPath, packagedFiles: packagedFiles.filter(file => /main\.cjs|preload\.cjs|reminder|notification/.test(file)) },
    !exists(asarPath) ? [asarPath] : ['main.cjs', 'preload.cjs', 'reminder-store.cjs', 'notification-adapter.cjs', 'reminder-notification-bridge.cjs'].filter(file => !packagedFiles.includes(`/${file}`) && !packagedFiles.includes(`\\${file}`)),
  ),
  check(
    'FE13-07',
    '重现命令保留在工程脚本中',
    Boolean(packageJson?.scripts) && ['check', 'build', 'desktop:package', 'android:room:check', 'android:room:jvm:check', 'desktop:notification:check', 'c17:assembly:check', 'acceptance:check', 'd:gate:check'].every(name => typeof packageJson.scripts[name] === 'string'),
    { scripts: packageJson?.scripts ?? {} },
    !packageJson?.scripts ? ['package.json'] : ['check', 'build', 'desktop:package', 'android:room:check', 'android:room:jvm:check', 'desktop:notification:check', 'c17:assembly:check', 'acceptance:check', 'd:gate:check'].filter(name => typeof packageJson.scripts[name] !== 'string'),
  ),
  check(
    'FE13-08',
    'D 正式发布门禁保持待项且未启动 E/F 正式执行',
    dGateStateValid,
    {
      auditPassed: dGate?.auditPassed ?? false,
      status: dGate?.status ?? null,
      acceptance: dGate?.acceptance ?? null,
      goNoGoEligible: dGate?.goNoGoEligible ?? null,
      eAfterDEligible: dGate?.eAfterDEligible ?? null,
      eStarted: dGate?.eStarted ?? null,
      fStarted: dGate?.fStarted ?? null,
      checks: dGateChecks.map(item => ({ id: item?.id ?? null, status: item?.status ?? null })),
    },
    dGateStateMissing,
  ),
];

const success = checks.every(item => item.status === 'passed');
const gate = evaluateProjectGate({
  mode,
  checks,
  externalPending: [
    ...(c17?.external?.pending ?? []),
    { id: 'ACCEPTANCE_EXTERNAL_VERIFICATION', capability: 'formal_acceptance', reason: '前端验收包不代替对应设备、供应、用户授权与正式发布验证。', production_enabled: false },
  ],
  release: { assessed: true, ready: dGate?.release?.ready === true && c17Release?.ready === true },
});
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'FE-13 front-end acceptance bundle, D gate preflight, and C07/C08/C17 packaging preflight',
  success,
  mode,
  development: gate.development,
  release: gate.release,
  status: success ? 'preparatory_ready' : 'blocked',
  acceptance: 'preparatory_not_accepted',
  goNoGoEligible: false,
  checks,
  limitations: [
    '验收包只确认本机文档、合成证据、构建产物和受限桥接文件可重现，不替代人工 B07/B11 演示签收。',
    '没有 Android 设备、Windows Toast/系统权限、真实后台投递、真实 WebView 或独立复核时，C15/D 仍保持阻塞。',
    'D01-D08 的正式结果仍保持未准入，且 eStarted/fStarted 必须为 false；该报告不构成正式发布批准。',
    '该预检不连接真实账号、AI、供应商、远程媒体或生产后端。',
  ],
};

if (evidencePath && !noWrite) {
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify(report, null, 2));
process.exitCode = success ? exitCodeForGate(gate) : 1;
