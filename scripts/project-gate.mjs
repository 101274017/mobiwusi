import { createHash } from 'node:crypto';

export const GATE_MODES = Object.freeze(['development', 'release']);
export const DEVELOPMENT_VERDICTS = Object.freeze([
  'DEV_READY',
  'DEV_READY_WITH_EXTERNAL_PENDING',
  'DEV_BLOCKED',
]);
export const RELEASE_VERDICTS = Object.freeze([
  'NOT_ASSESSED',
  'EXTERNAL_PENDING',
  'BLOCKED',
  'READY',
]);

export function assertGateMode(mode) {
  if (!GATE_MODES.includes(mode)) throw new Error(`Unknown gate mode: ${String(mode)}. Expected development or release.`);
  return mode;
}

export function isDevelopmentEligible(report) {
  const development = report?.development ?? report;
  return development?.eligible === true
    && ['DEV_READY', 'DEV_READY_WITH_EXTERNAL_PENDING'].includes(development?.verdict)
    && asArray(development?.failedChecks ?? development?.failed_checks).length === 0;
}

export function isFormalD07Go(record) {
  return record?.schemaVersion === 'd07-decision/v1' && record?.decision === 'go';
}

export function isAutomatedDevelopmentDecision(record) {
  return record?.schemaVersion === 'd07-decision/v2'
    && record?.decisionMode === 'development'
    && record?.decision === 'go'
    && record?.reviewType === 'automated'
    && record?.generatedBy === 'nuanban/scripts/check-d07-decision.mjs'
    && /^[0-9a-f]{64}$/i.test(record?.inputFingerprint ?? '')
    && isDevelopmentEligible(record);
}

export function handoffDevelopmentErrors(reports = {}) {
  const errors = [];
  function requireReport(id, passed, reason) {
    if (!passed) errors.push({ id: `${id.toUpperCase()}_DEVELOPMENT_EVIDENCE`, kind: 'evidence', reason });
  }
  function localChecksPassed(report) {
    return Array.isArray(report?.checks) && report.checks.length > 0
      && report.checks.every(check => (check.passed === true || check.status === 'passed')
        && check.passed !== false && !['failed', 'error'].includes(check.status))
      && Array.isArray(report.commandResults) && report.commandResults.length > 0
      && report.commandResults.every(command => command.passed === true && command.exitCode === 0);
  }
  const { acceptance, c14, c15, c16, c17 } = reports;
  requireReport('acceptance', acceptance?.success === true && acceptance?.status === 'preparatory_ready'
    && Array.isArray(acceptance?.checks) && acceptance.checks.length > 0
    && acceptance.checks.every(check => check.status === 'passed'), 'Acceptance bundle local checks are missing or failed.');
  requireReport('c14', c14?.success === true && c14?.status === 'frozen'
    && c14?.technicalFreeze?.freezeType === 'automated_technical'
    && isDevelopmentEligible(c14) && localChecksPassed(c14), 'C14 automated technical freeze is missing or failed.');
  requireReport('c15', c15?.auditPassed === true && c15?.evidenceQualityPassed === true
    && Array.isArray(c15?.checks) && c15.checks.length === 12
    && c15.checks.every(check => check.auditPassed === true && check.evidenceQualityPassed === true),
  'C15 automated evidence audit is missing or failed.');
  requireReport('c16', c16?.auditPassed === true && c16?.sourceAuditPassed === true
    && isDevelopmentEligible(c16)
    && Array.isArray(c16?.checks) && c16.checks.length > 0 && c16.checks.every(check => check.passed === true)
    && c16?.developmentDefaults?.developmentValidated === true
    && Array.isArray(c16?.top20Candidates?.candidates) && c16.top20Candidates.candidates.length === 20,
    'C16 source/default-decision audit is missing or failed.');
  requireReport('c17', c17?.auditPassed === true && isDevelopmentEligible(c17) && localChecksPassed(c17)
    && c17?.highRiskCapabilitiesEnabled === false, 'C17 assembly checks or capability isolation are missing or failed.');
  return errors;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, fallback) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function stableKey(value) {
  return JSON.stringify(value, Object.keys(value ?? {}).sort());
}

function uniqueItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = stableKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeExternalPending(items, fallbackCapability = 'external_verification') {
  return uniqueItems(asArray(items).map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `external-${index + 1}`,
        capability: fallbackCapability,
        reason: item,
        production_enabled: false,
      };
    }
    return {
      id: text(item?.id, `${fallbackCapability}-${index + 1}`),
      capability: text(item?.capability, fallbackCapability),
      reason: text(item?.reason, 'External verification is pending.'),
      production_enabled: item?.production_enabled === true || item?.productionEnabled === true,
      ...(item?.evidenceRefs || item?.evidence_refs ? { evidence_refs: item.evidenceRefs ?? item.evidence_refs } : {}),
    };
  }));
}

function normalizeFailures(items, fallbackKind) {
  return asArray(items).map((item, index) => {
    if (typeof item === 'string') return { id: `${fallbackKind}-${index + 1}`, reason: item, kind: fallbackKind };
    return {
      id: text(item?.id, `${fallbackKind}-${index + 1}`),
      reason: text(item?.reason ?? item?.detail, 'Gate check failed.'),
      kind: text(item?.kind ?? item?.classification, fallbackKind),
      ...(item?.evidenceRefs || item?.evidence_refs ? { evidence_refs: item.evidenceRefs ?? item.evidence_refs } : {}),
    };
  });
}

function failedChecks(checks) {
  return asArray(checks)
    .filter(check => check?.passed === false || check?.status === 'failed' || check?.status === 'error')
    .map((check, index) => ({
      id: text(check?.id ?? check?.name, `check-${index + 1}`),
      reason: text(check?.reason ?? check?.detail ?? check?.title, 'Gate check failed.'),
      kind: text(check?.kind ?? check?.classification, 'code'),
    }));
}

function isExternalFailure(item) {
  return item.kind === 'external' || item.kind === 'external_pending' || item.external === true;
}

export function fingerprintInventory(inventory) {
  const normalized = asArray(inventory)
    .map(item => ({
      path: item?.path ?? item?.file ?? item?.sourcePath ?? null,
      bytes: item?.bytes ?? null,
      sha256: item?.contentSha256 ?? item?.sha256 ?? null,
      exists: item?.exists ?? null,
    }))
    .sort((left, right) => String(left.path).localeCompare(String(right.path)));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function evaluateProjectGate(context = {}, evidence = {}) {
  const mode = assertGateMode(context.mode ?? evidence.mode ?? 'development');
  const checks = asArray(context.checks ?? evidence.checks);
  const checkFailures = failedChecks(checks);
  const externalCheckFailures = checkFailures.filter(isExternalFailure);
  const codeCheckFailures = checkFailures.filter(item => !isExternalFailure(item));
  const codeErrors = [
    ...normalizeFailures(context.codeErrors ?? evidence.codeErrors, 'code'),
    ...normalizeFailures(context.evidenceErrors ?? evidence.evidenceErrors, 'evidence'),
    ...codeCheckFailures,
  ];
  const externalPending = normalizeExternalPending([
    ...(context.externalPending ?? evidence.externalPending ?? []),
    ...externalCheckFailures.map(item => ({ id: item.id, capability: 'external_verification', reason: item.reason })),
  ]);
  for (const item of externalPending.filter(item => item.production_enabled)) {
    codeErrors.push({ id: `${item.id}_UNVERIFIED_PRODUCTION_ENABLED`, kind: 'code', reason: `Unverified capability is enabled: ${item.capability}` });
  }
  const developmentVerdict = codeErrors.length > 0
    ? 'DEV_BLOCKED'
    : externalPending.length > 0
      ? 'DEV_READY_WITH_EXTERNAL_PENDING'
      : 'DEV_READY';

  const releaseInput = context.release ?? evidence.release ?? {};
  const releaseBlockers = normalizeFailures(releaseInput.blockers, 'release');
  const releaseCodeErrors = normalizeFailures(releaseInput.codeErrors, 'release_code');
  const releaseReady = releaseInput.ready === true;
  let releaseVerdict = 'NOT_ASSESSED';
  if (codeErrors.length > 0 || releaseCodeErrors.length > 0 || releaseInput.blocked === true) {
    releaseVerdict = 'BLOCKED';
  } else if (releaseReady && externalPending.length === 0 && releaseBlockers.length === 0) {
    releaseVerdict = 'READY';
  } else if (externalPending.length > 0 || releaseBlockers.length > 0 || releaseInput.assessed === true) {
    releaseVerdict = 'EXTERNAL_PENDING';
  }

  const development = {
    verdict: developmentVerdict,
    eligible: developmentVerdict !== 'DEV_BLOCKED',
    failedChecks: codeErrors,
    failed_checks: codeErrors,
    externalPending,
    external_pending: externalPending,
  };
  const release = {
    verdict: releaseVerdict,
    ready: releaseVerdict === 'READY',
    blockers: [...releaseBlockers, ...releaseCodeErrors],
    reasonRefs: externalPending.map(item => item.id),
    reason_refs: externalPending.map(item => item.id),
  };
  const external = {
    verdict: releaseVerdict,
    ready: release.verdict === 'READY',
    status: releaseVerdict === 'EXTERNAL_PENDING' ? 'external_pending' : releaseVerdict.toLowerCase(),
    pending: externalPending,
    externalPending,
    external_pending: externalPending,
  };
  const defaults = {
    mode: 'development',
    verdict: developmentVerdict,
    eligible: development.eligible,
    externalPending,
    external_pending: externalPending,
  };
  const active = mode === 'development'
    ? { verdict: developmentVerdict, eligible: development.eligible }
    : { verdict: releaseVerdict, eligible: release.ready };

  return {
    mode,
    active,
    development,
    default: defaults,
    external,
    release,
  };
}

export function exitCodeForGate(gate) {
  return gate?.mode === 'release'
    ? gate?.release?.verdict === 'READY' ? 0 : 1
    : gate?.development?.verdict === 'DEV_BLOCKED' ? 1 : 0;
}

