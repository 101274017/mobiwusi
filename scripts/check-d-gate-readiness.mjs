import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertGateMode, evaluateProjectGate, exitCodeForGate, handoffDevelopmentErrors } from './project-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceIndex = process.argv.indexOf('--evidence');
const evidencePath = evidenceIndex >= 0 && process.argv[evidenceIndex + 1]
  ? path.resolve(root, process.argv[evidenceIndex + 1])
  : null;
const noWrite = process.argv.includes('--no-write');
const modeIndex = process.argv.indexOf('--mode');
const mode = assertGateMode(modeIndex >= 0 ? process.argv[modeIndex + 1] : 'development');

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return existsSync(absolute(relativePath));
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(absolute(relativePath), 'utf8'));
  } catch {
    return null;
  }
}

function hasValue(value) {
  return value !== undefined && value !== null && typeof value === 'string' && value.trim().length > 0;
}

function validTimestamp(value) {
  return typeof value === 'string' && /^(?:\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2}))$/.test(value) && !Number.isNaN(Date.parse(value));
}

function validSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function validManualSignoff(record) {
  if (!record || record.schemaVersion !== 'b07-b11-signoff/v1' || !Array.isArray(record.scenarios) || record.scenarios.length === 0) return false;
  if (!record.signoff || !hasValue(record.signoff.owner) || !hasValue(record.signoff.reviewer) || !validTimestamp(record.signoff.signedAt) || !hasValue(record.signoff.decision)) return false;
  return record.scenarios.every(scenario => (
    scenario
    && hasValue(scenario.scenarioId)
    && validSha256(scenario.packageHash)
    && validTimestamp(scenario.performedAt)
    && hasValue(scenario.operator)
    && hasValue(scenario.reviewer)
    && ['passed', 'conditional', 'failed', 'not_run'].includes(scenario.outcome)
    && Array.isArray(scenario.evidenceRefs)
    && scenario.evidenceRefs.length > 0
    && Array.isArray(scenario.limitations)
  ));
}

function validC14IndependentReview(record) {
  return Boolean(
    record
    && record.schemaVersion === 'c14-independent-review/v1'
    && hasValue(record.reviewId)
    && validSha256(record.snapshotSha256)
    && hasValue(record.independentReviewer)
    && validTimestamp(record.signedAt)
    && ['freeze_recommended', 'conditional_freeze', 'not_recommended', 'unable_to_recommend'].includes(record.freezeRecommendation)
    && Array.isArray(record.evidenceRefs)
    && record.evidenceRefs.length > 0,
  );
}

function blocked(id, title, details, missing) {
  return { id, title, status: 'blocked', details, missing };
}

const acceptance = readJson('docs/implementation/evidence/acceptance-bundle-results.json');
const c14 = readJson('docs/implementation/evidence/c14-handoff-results.json');
const c15 = readJson('docs/implementation/evidence/c15-nv-readiness-results.json');
const c16 = readJson('docs/implementation/evidence/c16-decision-readiness-results.json');
const c17 = readJson('docs/implementation/evidence/c17-assembly-results.json');
const room = readJson('docs/implementation/evidence/android-room-results.json');
const roomJvm = readJson('docs/implementation/evidence/android-room-jvm-results.json');
const androidLab = readJson('docs/implementation/evidence/android-lab.json');
const desktopSmoke = readJson('docs/implementation/evidence/desktop-lab-smoke.json');
const desktopPackage = readJson('docs/implementation/evidence/desktop-lab-package.json');
const media = readJson('docs/implementation/evidence/media-c04-results.json');
const c12 = readJson('docs/implementation/evidence/c12-sandbox-scope.json');
const accessibilitySpec = exists('tests/e2e/accessibility.spec.ts');
const manualSignoffRecord = readJson('docs/implementation/evidence/b07-b11-signoff.json');
const manualSignoff = validManualSignoff(manualSignoffRecord);
const c14IndependentReviewRecord = readJson('docs/implementation/evidence/c14-independent-review.json');
const c14IndependentReview = validC14IndependentReview(c14IndependentReviewRecord);

const requiredArtifacts = [
  'README.md',
  'docs/implementation/acceptance.md',
  'docs/implementation/verification.md',
  'docs/implementation/demo-scenarios.md',
  'docs/implementation/evidence/acceptance-bundle-results.json',
  'docs/implementation/evidence/c14-handoff-results.json',
  'docs/implementation/evidence/c15-nv-readiness-results.json',
  'docs/implementation/evidence/c16-decision-readiness-results.json',
  'docs/implementation/evidence/c17-assembly-results.json',
];
const missingArtifacts = requiredArtifacts.filter(relativePath => !exists(relativePath));
const localPackageReady = Boolean(acceptance?.success) && acceptance?.status === 'preparatory_ready';
const c15Ready = c15?.status === 'ready_for_independent_review' && c15?.goNoGoEligible === true;
const c16Ready = c16?.decisionReady === true && c16?.top20Approved === true && c16?.pilotEligible === true;
const c14Frozen = (c14?.technicalFreeze?.status === 'frozen' || c14?.status === 'frozen') && c14?.backendStarted === false;
const c17DevelopmentReady = c17?.auditPassed === true
  && c17?.development?.eligible === true
  && ['DEV_READY', 'DEV_READY_WITH_EXTERNAL_PENDING'].includes(c17?.development?.verdict)
  && c17?.release?.ready !== true;
const c17Ready = c17DevelopmentReady;
const externalPending = [
  {
    id: 'B07_B10_B11_HUMAN_SIGNOFF',
    capability: 'human_acceptance',
    reason: 'B07/B10/B11 人工演示、读屏和体验签收仍未形成外部记录。',
    production_enabled: false,
  },
  {
    id: 'C15_EXTERNAL_NV_EVIDENCE',
    capability: 'device_supplier_verification',
    reason: 'C15 真实设备、供应凭证和独立复核仍待外部验证。',
    production_enabled: false,
  },
  {
    id: 'C16_EXTERNAL_DECISION_INPUT',
    capability: 'field_trial_authorization',
    reason: 'C16 真实授权、试点和参与者输入仍未发生。',
    production_enabled: false,
  },
  {
    id: 'C14_INDEPENDENT_REVIEW',
    capability: 'contract_independent_review',
    reason: 'C14 自动技术冻结已完成，但 A02 独立评审仍为发布待项。',
    production_enabled: false,
  },
  {
    id: 'C17_PLATFORM_RUNTIME_EVIDENCE',
    capability: 'native_platform_verification',
    reason: 'C17 WebView、桌面运行时和系统权限证据仍为外部待项。',
    production_enabled: false,
  },
];
const gate = evaluateProjectGate({
  mode: 'development',
  codeErrors: [
    ...missingArtifacts.map(file => ({ id: 'D_MISSING_ARTIFACT', reason: `Missing artifact: ${file}`, kind: 'evidence' })),
    ...handoffDevelopmentErrors({ acceptance, c14, c15, c16, c17 }),
  ],
  externalPending,
  release: { assessed: true, ready: false, blockers: externalPending },
});

const checks = [
  blocked(
    'D01',
    '前端与原生验收复核',
    { localPackageReady, manualSignoff, c15Status: c15?.status ?? null, c16DecisionState: c16?.decisionState ?? null },
    [
      ...(!localPackageReady ? ['FE-13 交接包预检未达到 preparatory_ready'] : []),
      ...(!manualSignoff ? ['缺少 B07/B10/B11 负责人和参与者人工签收记录'] : []),
      ...(!c15Ready ? ['C15 尚未达到独立复核就绪或 Go/No-Go 条件'] : []),
      ...(!c16Ready ? ['C16 决策输入、Top20 和试点资格尚未确认'] : []),
    ],
  ),
  blocked(
    'D02',
    '契约冻结与后端交接',
    {
      c14Success: c14?.success ?? false,
      c14Status: c14?.status ?? null,
      c14DevelopmentVerdict: c14?.development?.verdict ?? null,
      c14ReleaseVerdict: c14?.release?.verdict ?? null,
      contractsFrozen: c14Frozen,
      independentReviewRecord: c14IndependentReview,
      realBackendConnected: c14?.backendStarted === true,
      realBackendRequiredForD02: false,
    },
    [
      ...(!c14Frozen ? ['C14 自动技术冻结检查未通过，不能形成可追踪的契约交接'] : []),
      ...(!c14IndependentReview ? ['缺少 A02/C14 独立评审记录或签收字段'] : []),
      ...(!c16Ready ? ['C16 决策边界未确认，不能冻结后端交接范围'] : []),
    ],
  ),
  blocked(
    'D03',
    '前端候选包与重置说明',
    { localPackageReady, desktopPackagePresent: Boolean(desktopPackage), resetScenariosPresent: exists('docs/implementation/demo-scenarios.md') },
    [
      ...(!localPackageReady ? ['验收交接包预检未通过'] : []),
      '缺少候选包负责人签收和发布范围批准',
      '自动化 E2E 证据不能替代候选包负责人签收和人工复核',
    ],
  ),
  blocked(
    'D04',
    'Android 证据与限制交接',
    { roomCompileVerified: room?.roomCompileVerified ?? false, roomMigrationPreflightVerified: room?.roomMigrationPreflightVerified ?? false, roomExecuted: roomJvm?.roomExecuted ?? null, deviceVerified: room?.deviceVerified ?? null, androidLabDeviceVerified: androidLab?.deviceVerified ?? null },
    [
      ...((room?.deviceVerified !== true || roomJvm?.roomExecuted !== true) ? ['没有真实 Room 设备执行、旧库升级/恢复和系统调度记录'] : []),
      ...(androidLab?.deviceVerified !== true ? ['没有 Android 真机授权、跨应用捕获、浮层和生命周期记录'] : []),
    ],
  ),
  blocked(
    'D05',
    'Windows 证据与限制交接',
    { packagePresent: Boolean(desktopPackage), smokePassed: desktopSmoke?.passed ?? false, actualDisplayCaptureVerified: desktopSmoke?.actualDisplayCaptureVerified ?? false, independentAcceptance: desktopSmoke?.independentAcceptance ?? false },
    [
      ...(desktopSmoke?.actualDisplayCaptureVerified !== true ? ['没有真实桌面捕获、双屏/混合 DPI、穿透和系统资源释放记录'] : []),
      ...(desktopSmoke?.independentAcceptance !== true ? ['缺少 Windows 独立复核和人工签收'] : []),
    ],
  ),
  blocked(
    'D06',
    '媒体与供应能力结论交接',
    { mediaSyntheticSuccess: media?.success ?? false, c12Status: c12?.status ?? null, realCredentialState: c12?.realCredentialState ?? null },
    [
      'C04 只有合成内存 relay，没有真实编码器、WebRTC、接收端 canary 或抓包证据',
      ...(c12?.realCredentialState !== 'available' ? ['C12 没有真实供应凭证、区域/价格/配额、保留条款和质量结论'] : []),
    ],
  ),
  blocked(
    'D07',
    'D 关口范围与启动决策',
    { c15GoNoGoEligible: c15?.goNoGoEligible ?? null, c16DecisionReady: c16?.decisionReady ?? null, c17GoNoGoEligible: c17?.goNoGoEligible ?? null },
    [
      'C15 NV-01～NV-12 仍全部 blocked，缺少真实设备/供应与独立复核',
      'C16 decisionReady=false，真实授权、试点和参与者输入仍为外部待项',
      '开发门禁可继续本地代码与自动检查；E/F 正式联调、试点和发布仍不得启动',
    ],
  ),
  blocked(
    'D08',
    '体验与无障碍签收',
    { accessibilityAutomationPresent: accessibilitySpec, manualSignoff, e2eEvidenceExpected: acceptance?.checks?.[2]?.details?.expected ?? null },
    [
      ...(!accessibilitySpec ? ['缺少可访问性自动化入口'] : []),
      '缺少真实读屏、键盘/大字号人工复核、双端原生字幕和负责人签收',
    ],
  ),
];

const report = {
  generatedAt: new Date().toISOString(),
  generatedDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()),
  generatedTimeZone: 'Asia/Shanghai',
  scope: 'D01-D08 gate readiness and handoff preflight',
  mode,
  status: 'blocked',
  acceptance: 'preparatory_not_accepted',
  developmentStatus: gate.development.verdict,
  releaseStatus: gate.release.verdict,
  development: gate.development,
  release: gate.release,
  formalStatus: 'blocked',
  formalAcceptance: 'preparatory_not_accepted',
  auditPassed: missingArtifacts.length === 0 && gate.development.eligible && checks.every(check => check.status === 'blocked'),
  goNoGoEligible: false,
  eAfterDEligible: false,
  eStarted: false,
  fStarted: false,
  requiredArtifacts,
  missingArtifacts,
  checks,
  blockers: [
    'B07/B10/B11 人工演示、体验和无障碍签收尚未形成独立记录。',
    'C15 的真实设备/供应/独立复核信号尚未满足，C16 的决策输入尚未确认。',
    'C14 自动技术冻结和 C17 开发装配已分栏记录；独立评审、设备/供应和系统权限仍为 release external_pending。',
    '开发检查通过不等于正式发布；真实联调、试点、生产网络和正式交付仍保持关闭。',
  ],
  limitations: [
    '本报告只检查文件、状态和可复现的本机预备证据，不构成 D 负责人批准。',
    'formalStatus=blocked 只表示正式发布未准入；自动化、静态、合成、打包或 E2E 证据不能替代人工/真机/供应层签收。',
  ],
  nextAllowed: [
    '补齐 B07/B10/B11 人工演示、读屏和体验签收记录。',
    '在设备、供应凭证和独立复核者到位后重新执行 C15 NV 实测。',
    '补齐真实 C16 授权/试点、A02/C14 独立评审、C17 平台运行时和设备/供应证据后再评估 release。',
  ],
};

if (evidencePath && !noWrite) {
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify(report, null, 2));
process.exitCode = report.auditPassed ? exitCodeForGate({ ...gate, mode }) : 1;
