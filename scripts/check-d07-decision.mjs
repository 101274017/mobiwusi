import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { assertGateMode, evaluateProjectGate, handoffDevelopmentErrors, isFormalD07Go } from './project-gate.mjs';
import { readImplementationPlan } from './implementation-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredReports = [
  ['acceptance', 'docs/implementation/evidence/acceptance-bundle-results.json'],
  ['c15', 'docs/implementation/evidence/c15-nv-readiness-results.json'],
  ['c16', 'docs/implementation/evidence/c16-decision-readiness-results.json'],
  ['c17', 'docs/implementation/evidence/c17-assembly-results.json'],
  ['c14', 'docs/implementation/evidence/c14-handoff-results.json'],
];
const defaultDecisionPath = 'docs/implementation/evidence/d07-decision.json';
const defaultEvidencePath = 'docs/implementation/evidence/d07-decision-check-results.json';
const developmentSchemaPath = 'docs/execution/d07-development-decision.schema.json';
const validateDevelopmentSchema = new Ajv({ strict: true, allErrors: true }).compile(JSON.parse(readFileSync(absolute(developmentSchemaPath), 'utf8')));

export function validateDevelopmentDecision(record) {
  if (!validateDevelopmentSchema(record)) return (validateDevelopmentSchema.errors ?? []).map(error => `${error.instancePath || '/'} ${error.message}`);
  const errors = [];
  const eligible = ['DEV_READY', 'DEV_READY_WITH_EXTERNAL_PENDING'].includes(record.development.verdict);
  if (record.development.eligible !== eligible || record.decision !== (eligible ? 'go' : 'no_go')) errors.push('development verdict, eligible and decision must agree');
  if (record.release.ready !== (record.release.verdict === 'READY')) errors.push('release verdict and ready must agree');
  if (record.release.ready && (record.development.externalPending.length > 0 || record.release.formalDecision !== 'go')) errors.push('release requires formal evidence and no external pending items');
  if (Number.isNaN(Date.parse(record.generatedAt))) errors.push('generatedAt is not a valid timestamp');
  if (record.inputFingerprint !== record.idempotencyKey) errors.push('inputFingerprint and idempotencyKey must agree');
  return errors;
}

function absolute(relativePath) {
  return path.resolve(root, relativePath);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readJson(relativePath) {
  const file = absolute(relativePath);
  if (!existsSync(file)) return { exists: false, value: null, sha256: null };
  const contents = readFileSync(file);
  try {
    return {
      exists: true,
      value: JSON.parse(contents.toString('utf8')),
      sha256: sha256(contents),
    };
  } catch {
    return { exists: true, value: null, sha256: sha256(contents) };
  }
}

function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0
      && !/^<[^>]+>$/.test(normalized)
      && !['todo', 'tbd', 'pending', '待填写', '待确认', '待指定', '__required__'].includes(normalized);
  }
  if (Array.isArray(value)) return value.length > 0 && value.every(hasValue);
  if (typeof value === 'object') return Object.values(value).length > 0 && Object.values(value).every(hasValue);
  return true;
}

function validTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function validSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function loadDecision(decisionPath) {
  const source = readJson(decisionPath);
  return { ...source, path: decisionPath };
}

function loadReports() {
  return Object.fromEntries(requiredReports.map(([id, relativePath]) => [id, { relativePath, ...readJson(relativePath) }]));
}

function validateFormalDecision(record) {
  const errors = [];
  const requiredRoles = ['dOwner', 'independentReviewer', 'productBusinessOwner', 'securityPrivacyReviewer'];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['decision record must be an object'];
  if (record.schemaVersion !== 'd07-decision/v1') errors.push('schemaVersion must be d07-decision/v1');
  if (!['go', 'no_go'].includes(record.decision)) errors.push('decision must be go or no_go');
  if (!hasValue(record.decisionId)) errors.push('decisionId is required');
  if (!validTimestamp(record.signedAt)) errors.push('signedAt must be an ISO timestamp with timezone');
  if (!Array.isArray(record.scope) || record.scope.length === 0 || !record.scope.every(hasValue)) errors.push('scope must contain at least one concrete entry');
  if (!Array.isArray(record.evidenceRefs) || record.evidenceRefs.length === 0 || !record.evidenceRefs.every(hasValue)) errors.push('evidenceRefs is required');
  if (!Array.isArray(record.limitations)) errors.push('limitations must be an array');
  if (!record.signoffs || typeof record.signoffs !== 'object' || Array.isArray(record.signoffs)) {
    errors.push('signoffs is required');
  } else {
    for (const role of requiredRoles) {
      const signoff = record.signoffs[role];
      if (!signoff || typeof signoff !== 'object' || Array.isArray(signoff)) {
        errors.push(`signoffs.${role} is required`);
        continue;
      }
      if (!hasValue(signoff.name)) errors.push(`signoffs.${role}.name is required`);
      if (!hasValue(signoff.decision)) errors.push(`signoffs.${role}.decision is required`);
      if (!validTimestamp(signoff.signedAt)) errors.push(`signoffs.${role}.signedAt must be an ISO timestamp with timezone`);
      if (!Array.isArray(signoff.evidenceRefs) || signoff.evidenceRefs.length === 0 || !signoff.evidenceRefs.every(hasValue)) errors.push(`signoffs.${role}.evidenceRefs is required`);
    }
  }
  if (!record.evidenceHashes || typeof record.evidenceHashes !== 'object' || Array.isArray(record.evidenceHashes)) {
    errors.push('evidenceHashes is required');
  } else {
    for (const reference of record.evidenceRefs ?? []) {
      if (!validSha256(record.evidenceHashes[reference])) errors.push(`evidenceHashes.${reference} must be a SHA-256 hash`);
    }
  }
  return errors;
}

function validateEvidenceHashes(record) {
  const errors = [];
  for (const reference of record?.evidenceRefs ?? []) {
    const file = absolute(reference);
    if (!existsSync(file)) {
      errors.push(`evidence reference is missing: ${reference}`);
      continue;
    }
    const actual = sha256(readFileSync(file));
    if (actual !== record.evidenceHashes[reference]) errors.push(`evidence hash mismatch: ${reference}`);
  }
  return errors;
}

function reportStatus(report) {
  return report?.value?.status ?? null;
}

function developmentBlockers(reports) {
  return handoffDevelopmentErrors(Object.fromEntries(Object.entries(reports).map(([id, report]) => [id, report.value])))
    .map(error => error.reason);
}

function releaseBlockers(reports, decision) {
  const blockers = [];
  if (!decision.exists || decision.value?.schemaVersion !== 'd07-decision/v1') blockers.push('D07 formal decision record is missing');
  else {
    const validationErrors = validateFormalDecision(decision.value);
    blockers.push(...validationErrors);
    if (validationErrors.length === 0) blockers.push(...validateEvidenceHashes(decision.value));
    if (!isFormalD07Go(decision.value)) blockers.push('D07 formal decision does not authorize release');
  }

  const acceptance = reports.acceptance.value;
  if (!reports.acceptance.exists || acceptance?.success !== true || acceptance?.status !== 'preparatory_ready') blockers.push('acceptance bundle is not preparatory_ready');

  const c15 = reports.c15.value;
  if (!reports.c15.exists || c15?.status !== 'ready_for_independent_review' || c15?.evidenceQualityPassed !== true || !Array.isArray(c15?.checks) || !c15.checks.every(check => check.readyForIndependentReview === true)) {
    blockers.push('C15 is not ready_for_independent_review with all NV checks ready');
  }

  const c16 = reports.c16.value;
  if (!reports.c16.exists || c16?.decisionReady !== true || c16?.top20Approved !== true || c16?.pilotEligible !== true) blockers.push('C16 decision input, Top20 approval, or pilot eligibility is not ready');

  const c17 = reports.c17.value;
  if (!reports.c17.exists || c17?.release?.ready !== true || c17?.goNoGoEligible !== true) blockers.push('C17 release evidence is not ready for independent review');

  const c14 = reports.c14.value;
  if (!reports.c14.exists || c14?.status !== 'frozen' || c14?.backendStarted !== false || c14?.release?.ready !== true) blockers.push('C14 release review or backend handoff is not ready');
  return [...new Set(blockers)];
}

export function inspectD07EvidenceInventory(reports, rootDirectory = root) {
  const inventory = [];
  const errors = [];
  for (const [id, report] of Object.entries(reports)) {
    for (const item of [...(report.value?.sourceInventory ?? []), ...(report.value?.evidenceInventory ?? [])]) {
      const file = item.sourcePath ?? item.path ?? item.file;
      if (!file) continue;
      const sourcePath = path.resolve(rootDirectory, file);
      const present = existsSync(sourcePath);
      const actual = present ? sha256(readFileSync(sourcePath)) : null;
      inventory.push({ report: id, path: file, sha256: actual });
      if (item.exists === true && (!present || !validSha256(item.contentSha256) || item.contentSha256 !== actual)) {
        errors.push(`Stale or missing ${id} source evidence: ${file}`);
      }
      if (item.exists === false && present) errors.push(`Changed ${id} external input requires a new audit: ${file}`);
    }
  }
  return { inventory, errors };
}

function inspectInputInventory(reports) {
  const { inventory, errors } = inspectD07EvidenceInventory(reports);
  for (const file of ['scripts/project-gate.mjs', 'scripts/check-d07-decision.mjs', 'scripts/check-d-gate-readiness.mjs', 'scripts/check-acceptance-bundle.mjs', 'scripts/implementation-plan.mjs', developmentSchemaPath]) {
    inventory.push({ report: 'gate', path: file, sha256: sha256(readFileSync(absolute(file))) });
  }
  const plan = readImplementationPlan(root);
  inventory.push({ report: 'plan', path: plan.path, sha256: plan.contentSha256 });
  if (!plan.exists) errors.push('Current V1.2 implementation plan is missing.');
  return { inventory, errors };
}

function reportInputFingerprint(reports, inventory, decision) {
  return sha256(JSON.stringify({
    reports: Object.fromEntries(Object.entries(reports).sort(([left], [right]) => left.localeCompare(right)).map(([id, report]) => [id, report.sha256])),
    sources: inventory,
    formalDecisionSha256: decision.value?.schemaVersion === 'd07-decision/v1' ? decision.sha256 : null,
  }));
}

function externalPending(reports, formalBlockers) {
  const pending = [
    ...(reports.c15.value?.goNoGoEligible !== true ? [{
      id: 'C15_EXTERNAL_EVIDENCE',
      capability: 'device_supplier_verification',
      reason: 'C15 真实设备、供应凭证和独立复核仍为 external_pending。',
      production_enabled: false,
    }] : []),
    ...(reports.c16.value?.pilotEligible !== true ? [{
      id: 'C16_EXTERNAL_AUTHORIZATION',
      capability: 'field_trial_authorization',
      reason: 'C16 真实授权、试点和参与者输入仍为 external_pending。',
      production_enabled: false,
    }] : []),
    ...(reports.c17.value?.release?.ready !== true ? [{
      id: 'C17_EXTERNAL_RUNTIME',
      capability: 'native_platform_verification',
      reason: 'C17 WebView、桌面运行时、系统权限和独立发布复核仍为 external_pending。',
      production_enabled: false,
    }] : []),
    ...(reports.c14.value?.release?.ready !== true ? [{
      id: 'C14_EXTERNAL_REVIEW',
      capability: 'contract_independent_review',
      reason: 'C14 自动技术冻结已完成，但 A02 独立评审仍为 external_pending。',
      production_enabled: false,
    }] : []),
  ];
  if (formalBlockers.length > 0) {
    pending.push({
      id: 'D07_FORMAL_RELEASE_GATE',
      capability: 'formal_release_authorization',
      reason: '正式发布门禁仍有待项；不影响开发门禁继续。',
      production_enabled: false,
      evidence_refs: Object.values(reports).map(report => report.relativePath),
    });
  }
  return pending;
}

function buildGeneratedDecision({ reports, inputFingerprint, development, release, formalDecision }) {
  return {
    schemaVersion: 'd07-decision/v2',
    generatedBy: 'nuanban/scripts/check-d07-decision.mjs',
    generatedAt: new Date().toISOString(),
    decisionId: `d07-development-${inputFingerprint.slice(0, 16)}`,
    decision: development.eligible ? 'go' : 'no_go',
    decisionMode: 'development',
    reviewType: 'automated',
    review_type: 'automated',
    development: {
      verdict: development.verdict,
      eligible: development.eligible,
      evidenceRefs: Object.values(reports).map(report => report.relativePath),
      externalPending: development.externalPending,
    },
    release: {
      verdict: release.verdict,
      ready: release.ready,
      reasonRefs: release.reasonRefs,
      formalDecision: formalDecision ?? null,
    },
    inputFingerprint,
    idempotencyKey: inputFingerprint,
    limitations: [
      '该决定由本机自动检查生成，reviewType=automated，不冒充负责人、独立人员或真人试点签收。',
      'development go 只允许继续代码、契约、夹具和本地验证；release.ready=false 时不得开放真实生产能力。',
      '真实设备、供应凭证、用户同意、试点和正式发布仍由 release 门禁单独验证。',
    ],
  };
}

function writeIfInputChanged(file, value) {
  const existing = readJson(file);
  if (existing.exists && existing.value?.generatedBy !== value.generatedBy) throw new Error(`Refusing to overwrite non-generated evidence: ${file}`);
  const comparable = record => JSON.stringify(record, (key, item) => key === 'generatedAt' ? undefined : item);
  if (existing.value && comparable(existing.value) === comparable(value)) {
    return { written: false, idempotent: true };
  }
  mkdirSync(path.dirname(absolute(file)), { recursive: true });
  writeFileSync(absolute(file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return { written: true, idempotent: false };
}

export function runD07DecisionCheck({ mode = 'development', decisionPath = defaultDecisionPath, evidencePath = null, write = false } = {}) {
  assertGateMode(mode);
  const decision = loadDecision(decisionPath);
  const reports = loadReports();
  const sourceInputs = inspectInputInventory(reports);
  const inputFingerprint = reportInputFingerprint(reports, sourceInputs.inventory, decision);
  const decisionErrors = decision.exists && decision.value?.schemaVersion !== 'd07-decision/v1'
    ? validateDevelopmentDecision(decision.value).map(error => `Invalid existing D07 development decision: ${error}`)
    : [];
  const developmentFailures = [...developmentBlockers(reports), ...sourceInputs.errors, ...decisionErrors];
  const formalBlockers = releaseBlockers(reports, decision);
  const pending = externalPending(reports, formalBlockers);
  const gate = evaluateProjectGate({
    mode,
    codeErrors: developmentFailures.map((reason, index) => ({ id: `D07_DEV_${index + 1}`, reason, kind: 'code' })),
    externalPending: pending,
    release: { assessed: true, ready: formalBlockers.length === 0 && isFormalD07Go(decision.value), blockers: formalBlockers },
  });
  const formalDecision = decision.value?.schemaVersion === 'd07-decision/v1' ? decision.value.decision : null;
  const generatedDecision = buildGeneratedDecision({
    reports,
    inputFingerprint,
    development: gate.development,
    release: gate.release,
    formalDecision,
  });
  const schemaErrors = validateDevelopmentDecision(generatedDecision);
  if (schemaErrors.length > 0) throw new Error(`Generated D07 decision failed schema validation: ${schemaErrors.join('; ')}`);
  const active = mode === 'development' ? gate.development : gate.release;
  const status = mode === 'development'
    ? active.eligible ? 'development_ready' : 'development_blocked'
    : active.ready ? 'go' : 'release_pending';
  const result = {
    reportSchemaVersion: 'd07-decision-check/v2',
    generatedBy: 'nuanban/scripts/check-d07-decision.mjs',
    generatedAt: new Date().toISOString(),
    generatedTimeZone: 'Asia/Shanghai',
    mode,
    scope: 'D07 automated development gate and release readiness validation',
    status,
    eligible: active.eligible ?? active.ready,
    development: gate.development,
    release: gate.release,
    developmentBlockers: developmentFailures,
    releaseBlockers: formalBlockers,
    inputFingerprint,
    idempotencyKey: inputFingerprint,
    decisionPath,
    decisionPresent: decision.exists,
    formalDecisionPresent: decision.exists && decision.value?.schemaVersion === 'd07-decision/v1',
    formalDecisionSha256: formalDecision ? decision.sha256 : null,
    decision: generatedDecision.decision,
    inputInventory: sourceInputs.inventory,
    generatedDecision,
    reports: Object.fromEntries(Object.entries(reports).map(([id, report]) => [id, {
      path: report.relativePath,
      exists: report.exists,
      sha256: report.sha256,
      status: reportStatus(report),
    }])),
    blockers: mode === 'development' ? developmentFailures : formalBlockers,
    limitations: [
      '开发门禁只验证真实源码、契约、自动证据和安全关闭路径，不代替人工、设备、供应、用户同意或正式发布授权。',
      'release.ready 不会因 development.verdict 通过而自动变为 true；外部待项保持 external_pending。',
      '本工具不连接真实设备、供应商、认证、媒体或生产后端。',
    ],
  };

  if (write) {
    if (evidencePath && absolute(evidencePath) === absolute(decisionPath)) throw new Error('Decision and report output paths must differ');
    const decisionWrite = mode === 'development' && decision.value?.schemaVersion !== 'd07-decision/v1'
      ? writeIfInputChanged(decisionPath, generatedDecision)
      : { written: false, idempotent: false };
    result.decisionPresent = decision.exists || decisionWrite.written;
    const evidenceWrite = evidencePath
      ? writeIfInputChanged(evidencePath, { ...result, idempotencyKey: `${mode}:${inputFingerprint}` })
      : { written: false, idempotent: false };
    result.writes = { decision: decisionWrite, evidence: evidenceWrite };
  } else {
    result.writes = { decision: { written: false, idempotent: false }, evidence: { written: false, idempotent: false } };
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  for (const flag of ['--mode', '--decision', '--evidence']) {
    const index = process.argv.indexOf(flag);
    if (index >= 0 && (!process.argv[index + 1] || process.argv[index + 1].startsWith('--'))) throw new Error(`${flag} requires a value`);
  }
  const modeIndex = process.argv.indexOf('--mode');
  const mode = modeIndex >= 0 && process.argv[modeIndex + 1] ? process.argv[modeIndex + 1] : 'development';
  const decisionIndex = process.argv.indexOf('--decision');
  const decisionPath = decisionIndex >= 0 && process.argv[decisionIndex + 1] ? process.argv[decisionIndex + 1] : defaultDecisionPath;
  const evidenceIndex = process.argv.indexOf('--evidence');
  const evidencePath = evidenceIndex >= 0 && process.argv[evidenceIndex + 1] ? process.argv[evidenceIndex + 1] : defaultEvidencePath;
  const noWrite = process.argv.includes('--no-write');
  try {
    const result = runD07DecisionCheck({ mode, decisionPath, evidencePath, write: !noWrite });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.eligible ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
