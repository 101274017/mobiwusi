import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readImplementationPlan } from './implementation-plan.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselineRelativePath = 'docs/implementation/baseline.md';
const decisionInputRelativePath = 'docs/implementation/evidence/c16-decision-input.json';
const developmentDefaultsPath = 'docs/implementation/c16-development-defaults.json';
const top20CandidatesPath = 'docs/implementation/c16-top20-candidates.json';
const timeZone = 'Asia/Shanghai';

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function validTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

function readTextSource(absolutePath, relativePath) {
  if (!existsSync(absolutePath)) return { path: relativePath, exists: false, bytes: 0, contentSha256: null, text: '' };
  try {
    const contents = readFileSync(absolutePath);
    return { path: relativePath, exists: true, bytes: contents.byteLength, contentSha256: sha256(contents), text: contents.toString('utf8') };
  } catch (error) {
    return { path: relativePath, exists: true, bytes: 0, contentSha256: null, text: '', readError: error instanceof Error ? error.message : String(error) };
  }
}

function sourceInventory(source) {
  const { text, ...inventory } = source;
  return inventory;
}

function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) return false;
    if (/^<[^>]+>$/.test(normalized)) return false;
    if (['todo', 'tbd', 'pending', '待填写', '待确认', '待指定', '__required__'].includes(normalized)) return false;
  }
  if (Array.isArray(value)) return value.length > 0 && value.every(hasValue);
  if (typeof value === 'object') {
    const values = Object.values(value);
    return values.length > 0 && values.every(hasValue);
  }
  return true;
}

function validDecisionDate(value) {
  if (typeof value !== 'string') return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }
  return validTimestamp(value);
}

export function validateDecisionInput(source) {
  if (!source.exists) return { parseable: false, valid: false, errors: ['c16 decision input file is missing'] };
  let input;
  try {
    input = JSON.parse(source.text);
  } catch (error) {
    return { parseable: false, valid: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { parseable: true, valid: false, errors: ['input must be a JSON object'] };
  if (input.schemaVersion !== 'c16-decision-input/v1') errors.push('schemaVersion must be c16-decision-input/v1');
  if (!validTimestamp(input.generatedAt)) errors.push('generatedAt must be an ISO timestamp with timezone');
  if (!hasValue(input.source)) errors.push('source is required');
  if (!input.decisions || typeof input.decisions !== 'object' || Array.isArray(input.decisions)) {
    errors.push('decisions must be an object keyed by Q id');
  }
  if (!Array.isArray(input.top20Slots) || input.top20Slots.length !== 20) {
    errors.push('top20Slots must contain exactly 20 entries');
  } else {
    input.top20Slots.forEach((slot, index) => {
      if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
        errors.push(`top20Slots[${index}] must be an object`);
        return;
      }
      if (slot.slot !== index + 1) errors.push(`top20Slots[${index}].slot must equal ${index + 1}`);
      for (const field of ['name', 'applicationVersion', 'riskBoundary', 'consent', 'flowPackageVersion', 'fallbackPlan']) {
        if (typeof slot[field] !== 'string' || !hasValue(slot[field])) errors.push(`top20Slots[${index}].${field} is required`);
      }
    });
  }
  if (!input.signoff || typeof input.signoff !== 'object' || Array.isArray(input.signoff)) {
    errors.push('signoff is required');
  } else {
    for (const field of ['owner', 'reviewer', 'pilotPartner']) {
      if (typeof input.signoff[field] !== 'string' || !hasValue(input.signoff[field])) errors.push(`signoff.${field} is required`);
    }
    if (!validTimestamp(input.signoff.signedAt)) errors.push('signoff.signedAt must be an ISO timestamp with timezone');
    if (!Array.isArray(input.signoff.evidenceRefs) || input.signoff.evidenceRefs.length === 0 || !input.signoff.evidenceRefs.every(item => typeof item === 'string' && hasValue(item))) errors.push('signoff.evidenceRefs is required');
  }
  for (const definition of definitions) {
    const decision = input.decisions?.[definition.id];
    if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
      errors.push(`${definition.id} decision entry is required`);
      continue;
    }
    for (const field of definition.requiredFields) {
      if (!hasValue(decision[field])) errors.push(`${definition.id}.${field} is required`);
      if (field === 'owner' && typeof decision[field] !== 'string') errors.push(`${definition.id}.owner must be a string`);
      if (field === 'decisionDate' && !validDecisionDate(decision[field])) errors.push(`${definition.id}.decisionDate must be a valid ISO date or timestamp`);
    }
  }
  return { parseable: true, valid: errors.length === 0, errors };
}

const definitions = [
  {
    id: 'Q-02',
    title: 'Top20 内容、应用版本与风险断点',
    requiredFields: ['approvedTop20List', 'applicationVersions', 'riskBreakpoints', 'owner', 'decisionDate'],
    blocker: '没有负责人确认的 Top20 场景、应用版本、风险断点和签名更新/回退边界。',
  },
  {
    id: 'Q-05',
    title: '监护、认领与授权流程',
    requiredFields: ['guardianVerification', 'consentScopes', 'childDataBoundary', 'owner', 'decisionDate'],
    blocker: '没有确认关系、监护核验、档案 scope、当次共享和系统权限的实际同意人及流程。',
  },
  {
    id: 'Q-10',
    title: '原始媒体、资产、审计与备份期限',
    requiredFields: ['retentionByDataKind', 'deletionAndBackupPurge', 'supplierRetentionTerms', 'owner', 'decisionDate'],
    blocker: '只有原始实时媒体不持久化的候选边界，没有其余数据类别 TTL、备份清除和供应保留批准。',
  },
  {
    id: 'Q-11',
    title: '掌握状态与北极星指标',
    requiredFields: ['masteryConfirmation', 'unpromptedReproductionMetric', 'assistanceExclusion', 'owner', 'decisionDate'],
    blocker: '没有冻结本人/授权家属确认、无 AI 复现单列和协助排除的统计口径，不能发布转化结论。',
  },
  {
    id: 'Q-14',
    title: '基础亲情能力交付范围',
    requiredFields: ['binding', 'archiveAccess', 'delegatedTodo', 'currentSessionMedia', 'deferredFamilyScope', 'owner', 'decisionDate'],
    blocker: '没有签收绑定、档案查看、代设待办、当次屏幕/语音和后续复杂家庭范围的交付边界。',
  },
];

function extractDevelopmentSources(planSource) {
  const lines = planSource.text.split(/\r?\n/u);
  const start = lines.findIndex(line => /^## 5\. /u.test(line));
  const section = [];
  if (start >= 0) {
    for (let index = start + 1; index < lines.length && !/^## /u.test(lines[index]); index += 1) {
      section.push({ text: lines[index].trim(), reference: `${planSource.path}#L${index + 1}` });
    }
  }
  const topics = ['Top20', '监护/亲情权限', '留存/删除', '掌握/指标'];
  const policies = topics.map(topic => {
    const rows = section.filter(line => line.text.startsWith(`| ${topic} |`));
    const columns = rows[0]?.text.split('|').slice(1, -1).map(column => column.trim()) ?? [];
    return { topic, count: rows.length, reference: rows[0]?.reference ?? null, columns };
  });
  const marker = section.findIndex(line => line.text.startsWith('**Top20初始候选'));
  const end = section.findIndex((line, index) => index > marker && line.text.startsWith('以上为'));
  const candidateLines = marker >= 0 && end > marker ? section.slice(marker + 1, end).filter(line => line.text) : [];
  const platformRows = candidateLines.map(line => {
    const match = line.text.match(/^(Android|Windows)[：:]\s*(.+)[。.]$/u);
    return { platform: match?.[1] ?? null, names: match?.[2].split('、').map(name => name.trim()) ?? [], reference: line.reference };
  });
  const candidates = platformRows.flatMap(row => row.names.map((name, index) => ({
    slot: 0,
    id: `c16-${row.platform.toLowerCase()}-${String(index + 1).padStart(2, '0')}`,
    platform: row.platform,
    name,
    generatedBy: 'automated',
    mode: 'development',
    status: 'candidate',
    verification: 'external_pending',
    applicationVersion: null,
    flowPackageVersion: null,
    consent: null,
    consentGranted: false,
    targetVerified: false,
    riskBoundary: '仅提供用户自主操作的安全入口指引；未知页面、凭证、支付、医疗或敏感配对立即暂停，不自动点击。',
    fallbackPlan: '退回上一步或停止；设备/版本不适用时保持 external_pending，不猜测菜单，不扩大权限。',
    sourceReference: row.reference,
    sourceHash: planSource.contentSha256,
  }))).map((candidate, index) => ({ ...candidate, slot: index + 1 }));
  return { policies, platformRows, candidates };
}

function developmentDefaults(decisions, policies, candidates) {
  const choices = [
    {
      selection: 'local_development_candidates_only',
      candidateIds: candidates.map(candidate => candidate.id),
      unknownPageAction: 'pause',
      updateStrategy: 'candidate_then_explicit_promotion_with_rollback',
      realApplicationAdaptationApproved: false,
      requiredPrdFlowsMustBePreserved: true,
    },
    {
      relationshipVerification: 'required_before_real_access',
      consentGranted: false,
      defaultScopes: [],
      relationshipArchiveSessionAndSystemPermissions: 'independent',
      grantChecks: ['scope', 'revocation', 'expiry', 'current_version'],
      childDataMode: 'synthetic_only',
    },
    {
      dataMode: 'synthetic_only',
      rawRealtimeMediaPersistence: false,
      retentionPolicy: 'configurable_by_data_kind',
      deletionPolicy: 'delete_and_replay_backup_purge',
      approvedRetentionPeriods: null,
      supplierRetentionTerms: null,
      supplierProcessingEnabled: false,
    },
    {
      confirmationSubjects: ['self', 'valid_authorized_subject'],
      aiRole: 'suggest_only',
      separateFacts: ['independent_operation', 'practice', 'mastery'],
      unpromptedReproduction: 'separate_from_assisted_practice',
      assistedActionsCountAsUnprompted: false,
      effectivenessClaimsEnabled: false,
    },
    {
      developmentWorkflows: ['binding', 'archive_access', 'delegated_todo', 'current_session_screen_and_voice'],
      defaultScopes: [],
      currentSessionMedia: 'explicit_session_consent_and_system_authorization',
      complexFamilyScope: 'deferred_not_removed',
      realFamilyDataEnabled: false,
    },
  ];
  return decisions.map((decision, index) => {
    const policy = policies[[0, 1, 2, 3, 1][index]];
    return {
      id: decision.id,
      title: decision.title,
      generatedBy: 'automated',
      mode: 'development',
      status: 'candidate',
      choice: choices[index],
      sourceReferences: [decision.sourceReference, ...(policy.reference ? [policy.reference] : [])],
      sourcePolicy: policy.columns.slice(1).join('；'),
      verification: 'external_pending',
      formallyApproved: false,
    };
  });
}

export function runC16DecisionReadinessCheck({ evidencePath, writeDevelopmentFiles = false, rootDirectory = root } = {}) {
  const baselineSource = readTextSource(resolve(rootDirectory, baselineRelativePath), baselineRelativePath);
  const baseline = baselineSource.text;
  const planSource = readImplementationPlan(rootDirectory);
  const inputSource = readTextSource(resolve(rootDirectory, decisionInputRelativePath), decisionInputRelativePath);
  const inputValidation = validateDecisionInput(inputSource);
  const inputProvided = inputSource.exists;
  const declaredBaselineDate = baseline.match(/更新日期：([0-9]{4}-[0-9]{2}-[0-9]{2})/u)?.[1] ?? null;
  const decisions = definitions.map(definition => ({
    id: definition.id,
    title: definition.title,
    status: 'unconfirmed',
    sourcePresent: new RegExp(`\\|\\s*${definition.id}(?:\\s|[^A-Za-z0-9_-]|$)`, 'u').test(baseline),
    sourceReference: `${baselineSource.path}#${definition.id}`,
    sourceHash: baselineSource.contentSha256,
    requiredFields: definition.requiredFields,
    confirmedFields: [],
    missingFields: definition.requiredFields,
    blockerCode: `${definition.id.replace('-', '_')}_UNCONFIRMED`,
    blocker: definition.blocker,
  }));
  const { policies, platformRows, candidates: top20Slots } = extractDevelopmentSources(planSource);
  const checks = [];
  function check(id, passed, reason) {
    checks.push({ id, passed, status: passed ? 'passed' : 'failed', reason });
  }
  check('C16_BASELINE_SOURCE', baselineSource.exists && /^[0-9a-f]{64}$/u.test(baselineSource.contentSha256 ?? '')
    && decisions.every(decision => decision.sourcePresent), '基线必须可读取并实际包含五个 Q 项，缺失是开发缺陷而非外部待项。');
  check('C16_V12_PLAN_SOURCE', planSource.exists && /^[0-9a-f]{64}$/u.test(planSource.contentSha256 ?? '')
    && /^\|\s*版本\s*\|\s*V1\.2[，,\s|]/mu.test(planSource.text)
    && /^\|\s*C16\s+[^\r\n]*20项安全候选[^\r\n]*\|/mu.test(planSource.text), '必须从 V1.2 实施计划及 C16 任务行读取开发候选要求。');
  check('C16_DEFAULT_POLICY_SOURCE', policies.every(policy => policy.count === 1 && policy.columns.length === 3 && policy.columns.every(hasValue))
    && /候选与真实应用适配分开/u.test(policies[0].columns[2] ?? '')
    && /不替真实监护人同意/u.test(policies[1].columns[2] ?? '')
    && /开发期只用合成数据/u.test(policies[2].columns[2] ?? '')
    && /本人\/有效授权主体确认/u.test(policies[3].columns[1] ?? ''), 'Top20、监护、留存和掌握默认策略必须有实际来源及真实边界，不能靠固定通过值。');
  check('C16_CANDIDATE_PLATFORMS', platformRows.length === 2
    && platformRows[0].platform === 'Android' && platformRows[1].platform === 'Windows'
    && platformRows.every(row => row.names.length === 10), '候选来源必须明确包含 Android、Windows 各十项，不能补空槽或截断。');
  check('C16_CANDIDATE_COUNT', top20Slots.length === 20, `从实际来源读取到 ${top20Slots.length} 项候选，要求恰好 20 项。`);
  check('C16_CANDIDATE_UNIQUENESS', top20Slots.length > 0 && top20Slots.every(candidate => hasValue(candidate.name))
    && new Set(top20Slots.map(candidate => `${candidate.platform}:${candidate.name.replace(/\s/gu, '').toLowerCase()}`)).size === top20Slots.length,
  '同一平台候选不得重复、空白或使用占位值。');
  check('C16_CANDIDATE_SAFETY', top20Slots.length > 0 && top20Slots.every(candidate => {
    const topic = candidate.name.replace(/[（(][^）)]*[）)]/gu, '');
    return !/支付|转账|交易|挂号|诊断|处方|密码|验证码|证件|人脸|配对/u.test(topic)
      && (!/Wi-Fi/iu.test(candidate.name) || /不教密码/u.test(candidate.name))
      && (!/蓝牙/u.test(candidate.name) || /不含敏感配对证明/u.test(candidate.name))
      && (!(candidate.platform === 'Windows' && /屏幕亮度/u.test(candidate.name)) || /设备支持时/u.test(candidate.name));
  }), '候选必须保留计划中的凭证、配对及设备支持限制；高风险来源不能自动当成安全流程。');
  const sourceAuditPassed = checks.slice(0, 3).every(item => item.passed);
  const auditPassed = checks.every(item => item.passed);
  const failedChecks = checks.filter(item => !item.passed);
  const generatedAt = new Date().toISOString();
  const artifactMetadata = {
    generatedAt,
    generatedBy: 'automated',
    mode: 'development',
    status: 'candidate',
    validationScope: 'source_and_development_configuration_only',
    developmentValidated: auditPassed,
    sourceInventory: [sourceInventory(baselineSource), sourceInventory(planSource)],
    decisionReady: false,
    top20Approved: false,
    pilotEligible: false,
  };
  const defaultsArtifact = {
    schemaVersion: 'c16-development-defaults/v1',
    ...artifactMetadata,
    scope: '可逆开发技术选择，不是运行时能力、人员同意、供应条款或正式签收证明。',
    decisions: developmentDefaults(decisions, policies, top20Slots),
  };
  const candidatesArtifact = {
    schemaVersion: 'c16-top20-candidates/v1',
    ...artifactMetadata,
    scope: '计划中的初始候选；不替换运行时流程库或 PRD 必做流程，不代表真机适配或合成流程执行通过。',
    candidates: top20Slots,
  };
  const result = {
    schemaVersion: 'c16-decision-readiness/v2',
    generatedAt,
    generatedDate: localDate(),
    generatedTimeZone: timeZone,
    scope: 'C16 Top20, guardian, retention, mastery and family-scope decision readiness',
    status: 'blocked',
    decisionState: 'unconfirmed',
    auditPassed,
    decisionReady: false,
    top20Approved: false,
    pilotEligible: false,
    source: baselineSource.path,
    sourceInventory: [
      {
        path: baselineSource.path,
        exists: baselineSource.exists,
        bytes: baselineSource.bytes,
        contentSha256: baselineSource.contentSha256,
        declaredUpdatedAt: declaredBaselineDate,
        declaredTimeZone: timeZone,
      },
      {
        path: inputSource.path,
        exists: inputSource.exists,
        bytes: inputSource.bytes,
        contentSha256: inputSource.contentSha256,
      },
      sourceInventory(planSource),
    ],
    decisionInputProvided: inputProvided,
    decisionInputParseable: inputValidation.parseable,
    decisionInputValid: inputValidation.valid,
    decisionInputErrors: inputValidation.errors,
    sourceAuditPassed,
    decisionInputQualityPassed: inputValidation.valid,
    development: {
      verdict: auditPassed ? 'DEV_READY_WITH_EXTERNAL_PENDING' : 'DEV_BLOCKED',
      eligible: auditPassed,
      validationScope: artifactMetadata.validationScope,
      failedChecks,
      evidence_refs: [developmentDefaultsPath, top20CandidatesPath],
    },
    verification: {
      automated: auditPassed ? 'passed' : 'failed',
      external: 'external_pending',
      release: auditPassed ? 'EXTERNAL_PENDING' : 'BLOCKED',
      humanConsentOccurred: false,
      independentSignoffVerified: false,
      realApplicationAdaptationVerified: false,
    },
    checks,
    developmentDefaults: defaultsArtifact,
    top20Candidates: candidatesArtifact,
    decisions,
    top20Slots,
    blockers: [
      '没有真实负责人/试点方提交并签收 C16 决策输入。',
      'Top20 的应用名称、版本、风险断点和更新回退规则仍未确认。',
      '监护/授权、数据留存删除、掌握指标和亲情范围仍只有候选假设。',
      '没有试点合作、设备矩阵、对象同意和支持流程，因此不能宣称 C16 或 M07 通过。',
    ],
    blockerRefs: [
      ...decisions.map(decision => ({
        code: decision.blockerCode,
        decisionId: decision.id,
        sourceReference: decision.sourceReference,
        sourceHash: decision.sourceHash,
        missingFields: decision.missingFields,
        reason: decision.blocker,
      })),
      ...(!inputValidation.valid ? [{
        code: inputProvided ? 'C16_DECISION_INPUT_INVALID' : 'C16_DECISION_INPUT_MISSING',
        sourceReference: inputSource.path,
        sourceHash: inputSource.contentSha256,
        reason: inputValidation.errors[0],
      }] : []),
      {
        code: 'C16_INDEPENDENT_SIGNOFF_REQUIRED',
        sourceReference: inputSource.path,
        sourceHash: inputSource.contentSha256,
        reason: '负责人、独立复核者和试点方签收仍未形成可核验的独立决策证据。',
      },
    ],
    allowedUntilDecision: [
      '按 V1.2 自动生成开发技术默认方案和 20 项候选，继续本地代码、Schema、流程模拟和合成风险样例，不等待外部 JSON 或人工签字。',
      '继续运行本地 UI/E2E 与安全边界测试。',
      '不发布 Top20 已适配清单、不处理真实儿童/家庭数据、不启动真实试点。',
    ],
  };
  if (writeDevelopmentFiles && auditPassed) {
    for (const [relativePath, artifact] of [[developmentDefaultsPath, defaultsArtifact], [top20CandidatesPath, candidatesArtifact]]) {
      const absolutePath = resolve(rootDirectory, relativePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    }
  }
  if (evidencePath) {
    const absolutePath = resolve(rootDirectory, evidencePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const evidenceIndex = process.argv.indexOf('--evidence');
  const noWrite = process.argv.includes('--no-write');
  const developmentOnly = process.argv.includes('--development-only');
  const evidencePath = noWrite || developmentOnly
    ? undefined
    : evidenceIndex >= 0 && process.argv[evidenceIndex + 1]
      ? process.argv[evidenceIndex + 1]
      : 'docs/implementation/evidence/c16-decision-readiness-results.json';
  const result = runC16DecisionReadinessCheck({ evidencePath, writeDevelopmentFiles: !noWrite });
  console.log(JSON.stringify(result, null, 2));
  if (!result.auditPassed) process.exitCode = 1;
}
