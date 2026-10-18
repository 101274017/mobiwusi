import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateProjectGate } from './project-gate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = resolve(root, 'docs/implementation/evidence');
const timeZone = 'Asia/Shanghai';

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function validGeneratedAt(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && !Number.isNaN(Date.parse(value));
}

function hasTimeZone(value, evidence) {
  return (typeof value === 'string' && (value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value)))
    || evidence?.generatedTimeZone === timeZone;
}

function sourceDescriptor(value) {
  for (const key of ['source', 'testReport', 'scope']) {
    if (typeof value?.[key] === 'string' && value[key].trim().length > 0) return value[key].trim();
  }
  return null;
}

function inspectMetadata(value) {
  const generatedAt = value?.generatedAt ?? null;
  const descriptor = sourceDescriptor(value);
  const issues = [];
  if (!validGeneratedAt(generatedAt)) issues.push('MISSING_OR_INVALID_GENERATED_AT');
  else if (!hasTimeZone(generatedAt, value)) issues.push('GENERATED_AT_MISSING_TIMEZONE');
  if (!descriptor) issues.push('MISSING_SOURCE_DESCRIPTOR');
  if (!Array.isArray(value?.limitations) || value.limitations.length === 0) issues.push('MISSING_LIMITATIONS');
  return {
    declaredGeneratedAt: generatedAt,
    generatedAtValid: validGeneratedAt(generatedAt),
    declaredGeneratedTimeZone: value?.generatedTimeZone ?? null,
    generatedAtHasTimeZone: hasTimeZone(generatedAt, value),
    sourceDescriptor: descriptor,
    limitationsPresent: Array.isArray(value?.limitations) && value.limitations.length > 0,
    qualityIssues: issues,
  };
}

function readEvidence(file) {
  const absolutePath = resolve(evidenceRoot, file);
  const sourcePath = `docs/implementation/evidence/${file}`;
  if (!existsSync(absolutePath)) {
    return {
      file,
      sourcePath,
      exists: false,
      parseable: false,
      value: null,
      bytes: 0,
      contentSha256: null,
      error: 'evidence file is missing',
      ...inspectMetadata(null),
      qualityIssues: ['MISSING_EVIDENCE_FILE'],
    };
  }
  const contents = readFileSync(absolutePath);
  try {
    const value = JSON.parse(contents.toString('utf8'));
    return {
      file,
      sourcePath,
      exists: true,
      parseable: true,
      value,
      bytes: contents.byteLength,
      contentSha256: sha256(contents),
      error: null,
      ...inspectMetadata(value),
    };
  } catch (error) {
    return {
      file,
      sourcePath,
      exists: true,
      parseable: false,
      value: null,
      bytes: contents.byteLength,
      contentSha256: sha256(contents),
      error: error instanceof Error ? error.message : String(error),
      ...inspectMetadata(null),
      qualityIssues: ['UNPARSEABLE_EVIDENCE'],
    };
  }
}

function valueAt(value, path) {
  return path.split('.').reduce((current, key) => current && typeof current === 'object' ? current[key] : undefined, value);
}

function signal(evidence, path, expected) {
  const observed = valueAt(evidence.value, path);
  return {
    file: evidence.file,
    sourcePath: evidence.sourcePath,
    contentSha256: evidence.contentSha256,
    path,
    expected,
    observed: observed === undefined ? null : observed,
    passed: evidence.exists && evidence.parseable && Object.is(observed, expected),
  };
}

const definitions = [
  {
    id: 'NV-01',
    title: 'Android 跨应用捕获与浮层',
    layer: 'device_verified',
    artifacts: ['android-lab.json'],
    signals: [
      ['android-lab.json', 'deviceVerified', true],
      ['android-lab.json', 'captureVerified', true],
      ['android-lab.json', 'overlayVerified', true],
      ['android-lab.json', 'systemPermissionGranted', true],
      ['android-lab.json', 'independentAcceptance', true],
    ],
    blockers: ['没有连接 Android 设备、系统授权、真实捕获来源和底层可点击记录。'],
  },
  {
    id: 'NV-02',
    title: '服务、通知与自启动',
    layer: 'device_verified',
    artifacts: ['android-lab.json', 'reminder-c07-c08-scope.json'],
    signals: [
      ['android-lab.json', 'deviceVerified', true],
      ['android-lab.json', 'systemPermissionGranted', true],
      ['reminder-c07-c08-scope.json', 'androidRoom', 'integrated'],
      ['reminder-c07-c08-scope.json', 'androidSystemScheduler', 'integrated'],
    ],
    blockers: ['没有权限拒绝、强停、后台、退出、睡眠、重启和真实系统提醒回执记录。'],
  },
  {
    id: 'NV-03',
    title: 'Windows 窗口、捕获与多屏',
    layer: 'device_verified',
    artifacts: ['desktop-lab-smoke.json', 'desktop-lab-package.json'],
    signals: [
      ['desktop-lab-smoke.json', 'actualDisplayCaptureVerified', true],
      ['desktop-lab-smoke.json', 'externalApplicationCaptureVerified', true],
      ['desktop-lab-smoke.json', 'mousePassThroughVerified', true],
      ['desktop-lab-smoke.json', 'mixedDpiMovementVerified', true],
      ['desktop-lab-smoke.json', 'negativeOriginMovementVerified', true],
      ['desktop-lab-smoke.json', 'independentAcceptance', true],
    ],
    blockers: ['当前仅有隐藏 Electron 合成窗口和单显示器几何记录，没有真实桌面捕获、双屏、混合 DPI、负坐标、穿透和独立复核。'],
  },
  {
    id: 'NV-04',
    title: '采集生命周期',
    layer: 'device_verified',
    artifacts: ['lifecycle-c09-c10-scope.json'],
    signals: [['lifecycle-c09-c10-scope.json', 'deviceVerified', true]],
    blockers: ['没有 stop、revoke、lock、kill、reboot 后的真实轨道、队列、出口和资源释放计数。'],
  },
  {
    id: 'NV-05',
    title: '自身浮层污染',
    layer: 'device_verified',
    artifacts: ['lifecycle-c09-c10-scope.json', 'desktop-lab-smoke.json'],
    signals: [
      ['lifecycle-c09-c10-scope.json', 'deviceVerified', true],
      ['desktop-lab-smoke.json', 'independentAcceptance', true],
    ],
    blockers: ['没有 Android/Windows 真实捕获对照、浮层排除/隐藏/屏蔽结果和人工复核。'],
  },
  {
    id: 'NV-06',
    title: '本地检测与脱敏',
    layer: 'device_verified',
    artifacts: ['privacy-c03-results.json'],
    signals: [['privacy-c03-results.json', 'realModelEvidenceVerified', true]],
    blockers: ['C03 只有合成门控测试；没有真实 OCR/检测模型、人脸测试素材、坏模型/超时质量和逐帧设备证据。'],
  },
  {
    id: 'NV-07',
    title: '安全媒体出口',
    layer: 'device_verified',
    artifacts: ['media-c04-results.json'],
    signals: [['media-c04-results.json', 'realEncoderAndRelayVerified', true]],
    blockers: ['C04 只有本地内存 relay；没有真实编码器、双出口接收 canary、抓包、WebRTC/TURN 和停止竞态记录。'],
  },
  {
    id: 'NV-08',
    title: '用户自行操作与核验',
    layer: 'device_verified',
    artifacts: ['guidance-c05-c06-scope.json'],
    signals: [
      ['guidance-c05-c06-scope.json', 'androidDeviceVerified', true],
      ['guidance-c05-c06-scope.json', 'windowsDeviceVerified', true],
      ['guidance-c05-c06-scope.json', 'inputInjection', 'device_verified'],
    ],
    blockers: ['共享坐标引擎只有合成向量；没有 Android/Windows 设备调用、真实页面核验或人工操作轨迹。'],
  },
  {
    id: 'NV-09',
    title: '儿童指向',
    layer: 'device_verified',
    artifacts: ['guidance-c05-c06-scope.json', 'pet-c13-scope.json'],
    signals: [
      ['guidance-c05-c06-scope.json', 'androidDeviceVerified', true],
      ['guidance-c05-c06-scope.json', 'windowsDeviceVerified', true],
      ['guidance-c05-c06-scope.json', 'childPointerManualAcceptance', true],
      ['pet-c13-scope.json', 'status', 'accepted'],
    ],
    blockers: ['没有原生桌宠路径、真实动画/遮挡、替代停靠、儿童可理解性和人工可达性记录。'],
  },
  {
    id: 'NV-10',
    title: '2D、画布与 3D 规格',
    layer: 'device_verified',
    artifacts: ['c11-3d-scope.json', 'pet-c13-scope.json'],
    signals: [
      ['c11-3d-scope.json', 'status', 'accepted'],
      ['pet-c13-scope.json', 'status', 'accepted'],
      ['pet-c13-scope.json', 'publishEligible', true],
    ],
    blockers: ['C11/C13 仅有结构门控；没有真实 VRM/FBX/GLB、渲染器、供应资产、设备帧率/内存、视觉和儿童质量验收。'],
  },
  {
    id: 'NV-11',
    title: '语音、多模态与生成',
    layer: 'supplier_verified',
    artifacts: ['c12-sandbox-scope.json'],
    signals: [
      ['c12-sandbox-scope.json', 'status', 'accepted'],
      ['c12-sandbox-scope.json', 'realCredentialState', 'available'],
      ['c12-sandbox-scope.json', 'productionReady', true],
    ],
    blockers: ['C12 合成场景通过但真实凭证缺失；没有真实区域、价格/配额、数据保留、合同、首片段、取消延迟和质量证据。'],
  },
  {
    id: 'NV-12',
    title: '免密、人脸与无 SIM',
    layer: 'supplier_verified',
    artifacts: ['c12-sandbox-scope.json', 'c14-handoff-results.json'],
    signals: [
      ['c12-sandbox-scope.json', 'realCredentialState', 'available'],
      ['c14-handoff-results.json', 'serverProofVerified', true],
      ['c14-handoff-results.json', 'replayProtectionVerified', true],
    ],
    blockers: ['没有服务端证明、防重放、真实失败替代、认领和供应凭证实测；本机解锁或契约元数据不构成服务端人脸证明。'],
  },
];

export function runC15NvReadinessCheck({ evidencePath } = {}) {
  const cache = new Map();
  const load = file => {
    if (!cache.has(file)) cache.set(file, readEvidence(file));
    return cache.get(file);
  };
  const checks = definitions.map(definition => {
    const artifacts = definition.artifacts.map(file => load(file));
    const signals = definition.signals.map(([file, path, expected]) => signal(load(file), path, expected));
    const parseErrors = artifacts.filter(item => !item.parseable).map(item => `${item.file}: ${item.error}`);
    const failedSignals = signals.filter(item => !item.passed);
    const qualityIssues = artifacts.flatMap(item => item.qualityIssues.map(code => ({ file: item.file, code })));
    const evidenceQualityPassed = qualityIssues.length === 0;
    const blockerRefs = [];
    if (failedSignals.length > 0) {
      blockerRefs.push({
        code: `${definition.id.replace('-', '_')}_EVIDENCE_GAP`,
        reason: definition.blockers[0],
        signalPaths: failedSignals.map(item => `${item.file}:${item.path}`),
      });
    }
    if (qualityIssues.length > 0) {
      blockerRefs.push({
        code: 'EVIDENCE_PROVENANCE_GAP',
        reason: '证据文件的日期/时区、来源描述、限制或可追溯哈希字段不完整。',
        signalPaths: [],
        qualityIssues,
      });
    }
    const readyForReview = signals.every(item => item.passed) && parseErrors.length === 0 && evidenceQualityPassed;
    return {
      id: definition.id,
      title: definition.title,
      layer: definition.layer,
      status: readyForReview ? 'ready_for_independent_review' : 'blocked',
      auditPassed: parseErrors.length === 0,
      evidenceQualityPassed,
      readyForIndependentReview: readyForReview,
      artifacts: artifacts.map(item => ({
        file: item.file,
        sourcePath: item.sourcePath,
        exists: item.exists,
        parseable: item.parseable,
        bytes: item.bytes,
        contentSha256: item.contentSha256,
        declaredGeneratedAt: item.declaredGeneratedAt,
        declaredGeneratedTimeZone: item.declaredGeneratedTimeZone,
        generatedAtValid: item.generatedAtValid,
        generatedAtHasTimeZone: item.generatedAtHasTimeZone,
        sourceDescriptor: item.sourceDescriptor,
        limitationsPresent: item.limitationsPresent,
        qualityIssues: item.qualityIssues,
      })),
      signals,
      failedSignals: failedSignals.map(item => ({ file: item.file, path: item.path, expected: item.expected, observed: item.observed })),
      blockerRefs,
      blockers: blockerRefs.map(item => item.reason),
    };
  });
  const evidenceInventory = [...cache.values()].map(item => ({
    file: item.file,
    sourcePath: item.sourcePath,
    exists: item.exists,
    parseable: item.parseable,
    bytes: item.bytes,
    contentSha256: item.contentSha256,
    declaredGeneratedAt: item.declaredGeneratedAt,
    declaredGeneratedTimeZone: item.declaredGeneratedTimeZone,
    generatedAtValid: item.generatedAtValid,
    generatedAtHasTimeZone: item.generatedAtHasTimeZone,
    sourceDescriptor: item.sourceDescriptor,
    limitationsPresent: item.limitationsPresent,
    qualityIssues: item.qualityIssues,
    scope: item.value?.scope ?? null,
    status: item.value?.status ?? null,
  }));
  const allReady = checks.every(check => check.readyForIndependentReview);
  const blockerRefs = checks.flatMap(check => check.blockerRefs.map(ref => ({ checkId: check.id, ...ref })));
  const auditPassed = checks.every(check => check.auditPassed);
  const externalPending = checks.filter(check => !check.readyForIndependentReview).map(check => ({
    id: `C15_${check.id}`, capability: check.id,
    reason: check.blockers.join('; '), production_enabled: false,
  }));
  externalPending.push({ id: 'C15_INDEPENDENT_REVIEW', capability: 'independent_device_supplier_review',
    reason: '自动证据审计不替代真实设备、供应及独立复核。', production_enabled: false });
  const gate = evaluateProjectGate({
    codeErrors: checks.filter(check => !check.auditPassed).map(check => ({ id: `C15_${check.id}_AUDIT`, reason: 'Evidence source cannot be audited.' })),
    externalPending, release: { assessed: true, ready: false },
  });
  const result = {
    generatedAt: new Date().toISOString(),
    generatedDate: localDate(),
    generatedTimeZone: timeZone,
    scope: 'C15 NV-01..NV-12 evidence readiness and safety side-effect audit',
    status: allReady ? 'ready_for_independent_review' : 'blocked',
    acceptance: 'preparatory_not_accepted',
    auditPassed,
    development: { ...gate.development, validationScope: 'evidence_source_audit_only' },
    verification: { automated: auditPassed ? 'checks_passed' : 'failed', native: 'external_pending', live_provider: 'external_pending', field_trial: 'not_applicable' },
    external: gate.external,
    release: gate.release,
    evidenceQualityPassed: checks.every(check => check.evidenceQualityPassed),
    goNoGoEligible: false,
    deviceVerified: false,
    supplierVerified: false,
    checks,
    evidenceInventory,
    blockerRefs,
    blockers: [
      '当前没有 Android/Windows 真实设备记录、系统权限回执、跨应用捕获或多屏/生命周期计数。',
      '当前没有真实 OCR/人脸/编码/WebRTC/AI/语音/生成供应凭证或服务端证明。',
      '合成测试、契约审查、打包和单屏几何记录不能替代 C15 的设备/供应层证据。',
      '在所有必要 NV 记录完成并经独立复核前，不得进入 D Go/No-Go，也不得启动真实 E/F 交付。',
    ],
    recordSchema: [
      'date_and_timezone',
      'build_and_package_hash',
      'device_model_os_dpi',
      'case_and_synthetic_material_hash',
      'permissions_and_consent',
      'steps_expected_actual',
      'frame_encoding_send_receive_cache_counters',
      'screenshots_or_video_reference',
      'limitations_executor_independent_reviewer',
    ],
    provenanceSchema: [
      'source_path',
      'content_sha256',
      'declared_generated_at',
      'declared_generated_time_zone',
      'declared_source_descriptor',
      'metadata_quality_issues',
    ],
  };
  if (evidencePath) {
    const absolutePath = resolve(root, evidencePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const evidenceIndex = process.argv.indexOf('--evidence');
  const noWrite = process.argv.includes('--no-write');
  const evidencePath = noWrite
    ? undefined
    : evidenceIndex >= 0 && process.argv[evidenceIndex + 1]
      ? process.argv[evidenceIndex + 1]
      : 'docs/implementation/evidence/c15-nv-readiness-results.json';
  const result = runC15NvReadinessCheck({ evidencePath });
  console.log(JSON.stringify(result, null, 2));
  if (!result.auditPassed) process.exitCode = 1;
}
