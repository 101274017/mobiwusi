import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertGateMode, evaluateProjectGate, exitCodeForGate, fingerprintInventory } from './project-gate.mjs';
import { operations } from '../packages/contracts/src/spec/operations.ts';
import { eventDefinitions } from '../packages/contracts/src/spec/events.ts';
import { serviceDefinitions } from '../packages/contracts/src/spec/catalog.ts';
import { schemaVersion } from '../packages/contracts/src/spec/primitives.ts';
import { serviceErrorCodes } from '../packages/contracts/src/spec/errors.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const openapiPath = resolve(root, 'packages/contracts/openapi.json');
const sourceFiles = [
  ['generated_openapi', 'packages/contracts/openapi.json'],
  ['operations', 'packages/contracts/src/spec/operations.ts'],
  ['events', 'packages/contracts/src/spec/events.ts'],
  ['catalog', 'packages/contracts/src/spec/catalog.ts'],
  ['primitives', 'packages/contracts/src/spec/primitives.ts'],
  ['errors', 'packages/contracts/src/spec/errors.ts'],
  ['standalone_guidance', 'packages/contracts/src/spec/standalone-guidance.ts'],
];

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function readSource(role, relativePath) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) return { role, path: relativePath, exists: false, bytes: 0, contentSha256: null };
  const contents = readFileSync(absolutePath);
  return { role, path: relativePath, exists: true, bytes: contents.byteLength, contentSha256: sha256(contents) };
}

function operation(id) {
  const result = operations.find(item => item.id === id);
  assert.ok(result, `missing operation ${id}`);
  return result;
}

function openApiOperation(openapi, currentOperation) {
  const pathItem = openapi.paths[currentOperation.path];
  assert.ok(pathItem, `missing OpenAPI path ${currentOperation.path}`);
  const result = pathItem[currentOperation.method];
  assert.ok(result, `missing OpenAPI operation ${currentOperation.id}`);
  return result;
}

function hasParameter(openapiOperationValue, name) {
  return Array.isArray(openapiOperationValue.parameters) && openapiOperationValue.parameters.some(parameter => parameter.name === name && parameter.required === true);
}

function check(name, callback, checks) {
  try {
    checks.push({ name, passed: true, detail: callback() });
  } catch (error) {
    checks.push({ name, passed: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

function runContractCommand() {
  const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(executable, ['contracts:check'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    shell: process.platform === 'win32',
    maxBuffer: 2 * 1024 * 1024,
  });
  return {
    command: 'pnpm contracts:check',
    exitCode: typeof result.status === 'number' ? result.status : 1,
    signal: result.signal ?? null,
    passed: result.status === 0,
    stdout: String(result.stdout ?? '').trim().slice(-2000),
    stderr: String(result.stderr ?? '').trim().slice(-2000),
  };
}

function writeGeneratedReport(file, report) {
  const absolutePath = resolve(root, file);
  if (existsSync(absolutePath) && !file.endsWith('-results.json')) return false;
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return true;
}

export function runC14HandoffCheck({ evidencePath, mode = 'development', runCommands = true } = {}) {
  assertGateMode(mode);
  const openapi = JSON.parse(readFileSync(openapiPath, 'utf8'));
  const sourceInventory = sourceFiles.map(([role, relativePath]) => readSource(role, relativePath));
  const checks = [];

  check('contract counts and generated version', () => {
    assert.ok(sourceInventory.every(item => item.exists && /^[0-9a-f]{64}$/.test(item.contentSha256)), 'contract source inventory is incomplete or unhashed');
    assert.equal(schemaVersion, '0.2.0');
    assert.equal(operations.length, 61);
    assert.equal(Object.keys(serviceDefinitions).length, 127);
    assert.equal(openapi.info.version, schemaVersion);
    const operationCount = Object.values(openapi.paths).reduce((count, pathItem) => count + Object.keys(pathItem).filter(method => ['get', 'post', 'put', 'patch', 'delete'].includes(method)).length, 0);
    assert.equal(operationCount, 61);
    return '0.2.0, 61 operations, 127 definitions and 61 generated operations are aligned';
  }, checks);

  check('authentication and object authorization metadata', () => {
    assert.ok(operations.every(item => ['bearer', 'public-challenge'].includes(item.authentication) && typeof item.authorization === 'string' && item.authorization.length > 0));
    assert.ok(operations.filter(item => item.authentication === 'public-challenge').every(item => item.path.startsWith('/v1/auth/')));
    assert.equal(operation('assistJoin').authorization, 'current_participant_device_and_grant_revision');
    assert.equal(operation('consentWithdraw').authorization, 'consent_subject_or_valid_guardian');
    assert.equal(operation('relationGrantsUpdate').authorization, 'subject_or_valid_guardian_with_current_revision');
    return 'public challenges stay in auth paths and critical relation/consent operations retain explicit object authorization';
  }, checks);

  check('mutation idempotency and optimistic version guards', () => {
    for (const currentOperation of operations) {
      const generated = openApiOperation(openapi, currentOperation);
      if (currentOperation.method !== 'get') {
        const requiresIdempotency = currentOperation.id !== 'standaloneGuidanceAnalyze';
        assert.equal(hasParameter(generated, 'Idempotency-Key'), requiresIdempotency, `${currentOperation.id} has incorrect Idempotency-Key policy`);
        if (!requiresIdempotency) assert.equal(currentOperation.idempotencyKey, false);
      }
      if (currentOperation.versioned) {
        assert.equal(hasParameter(generated, 'If-Match'), true, `${currentOperation.id} lacks If-Match`);
        assert.ok(generated.responses['200']?.headers?.ETag || generated.responses[String(currentOperation.successStatus)]?.headers?.ETag, `${currentOperation.id} lacks ETag`);
      }
    }
    return 'mutations carry idempotency metadata; standalone read-only analysis does not claim idempotency; versioned writes carry If-Match/ETag';
  }, checks);

  check('error envelope and safety statuses', () => {
    const requiredErrors = ['AUTH_FAILED', 'AUTH_EXPIRED', 'SCOPE_DENIED', 'CONSENT_REQUIRED', 'PERMISSION_DENIED', 'RISK_PAUSED', 'TARGET_STALE', 'VERSION_CONFLICT', 'CANCELLED', 'TIMEOUT', 'PROVIDER_UNAVAILABLE'];
    assert.ok(requiredErrors.every(code => serviceErrorCodes.includes(code)));
    for (const currentOperation of operations) {
      const generated = openApiOperation(openapi, currentOperation);
      const standalone = currentOperation.id === 'standaloneGuidanceAnalyze';
      const statuses = standalone ? ['400', '401', '403', '499', '500', '502', '503', '504'] : ['400', '401', '403', '404', '409', '410', '422', '429', '503', '504'];
      for (const status of statuses) assert.ok(generated.responses[status], `${currentOperation.id} lacks safe ${status} response`);
      assert.ok(generated.responses['400'].content['application/json'].schema.$ref.endsWith(standalone ? '/StandaloneGuidanceErrorEnvelope' : '/ErrorEnvelope'));
    }
    return 'all operations expose the shared safe error envelope and required refusal categories';
  }, checks);

  check('standalone current-frame guidance and owner-confirmed review boundary', () => {
    const standalone = operation('standaloneGuidanceAnalyze');
    assert.equal(standalone.path, '/v1/standalone/guidance/analyze');
    assert.equal(standalone.method, 'post');
    assert.equal(standalone.authentication, 'bearer');
    assert.equal(standalone.authorization, 'self');
    assert.equal(standalone.successStatus, 200);
    assert.equal(standalone.request, 'StandaloneGuidanceAnalyzeRequest');
    assert.equal(standalone.response, 'StandaloneGuidanceResult');
    assert.equal(standalone.requestId.required, false);
    assert.equal(standalone.errorEnvelope, 'StandaloneGuidanceErrorEnvelope');
    const request = serviceDefinitions.StandaloneGuidanceAnalyzeRequest;
    assert.equal(request.additionalProperties, false);
    for (const name of ['observation_id', 'guide_id', 'observation_generation', 'task_generation', 'trigger_id', 'frame_id', 'frame_hash', 'sanitized_sha256', 'local_safety', 'redaction_profile']) assert.ok(request.required.includes(name));
    assert.equal(request.properties.local_safety.const, 'safe');
    assert.equal(request.properties.redaction_profile.const, 'all_text_and_faces_v1');
    const variants = serviceDefinitions.StandaloneGuidanceResult.oneOf;
    assert.equal(variants.length, 4);
    for (const variant of variants) {
      assert.equal(variant.additionalProperties, false);
      if (variant.properties.kind.const === 'completed') assert.ok(variant.properties.review_proposal);
      else assert.equal(variant.properties.review_proposal, undefined);
    }
    assert.match(standalone.description, /本人确认不得创建提醒/);
    assert.match(standalone.description, /不能证明本地检测可信/);
    return 'bearer-authenticated same-frame analysis retains strict correlation, client privacy checks, local completion verification and owner-confirmed review';
  }, checks);

  check('capture and upload consent boundary', () => {
    assert.equal(operation('uploadCreate').authorization, 'self_and_current_capture_consent');
    assert.equal(operation('guidanceAnalyze').authorization, 'self_and_current_capture_consent');
    assert.equal(operation('guidanceVerify').authorization, 'self_and_current_capture_consent');
    assert.equal(operation('conversationRespond').authorization, 'self_and_current_media_consent');
    const uploadBytes = openApiOperation(openapi, operation('uploadBytes'));
    assert.equal(uploadBytes.requestBody['x-maximum-bytes'], 10 * 1024 * 1024);
    assert.equal(operation('uploadBytes').binary, true);
    return 'screen/media analysis and binary upload require current consent, with a 10MiB generated limit';
  }, checks);

  check('assist lease and stop boundary', () => {
    assert.equal(operation('assistJoin').authorization, 'current_participant_device_and_grant_revision');
    assert.equal(operation('assistJoin').response, 'AssistJoinResponse');
    assert.match(operation('assistEnd').summary, /本地先停止/);
    assert.match(operation('assistEnd').summary, /服务端租约兜底/);
    assert.equal(operation('voiceTicket').authorization, 'self_and_current_audio_consent');
    return 'assist join is device/grant scoped and assist end requires local stop before server lease fallback';
  }, checks);

  check('stream and event termination coverage', () => {
    assert.ok(Object.hasOwn(eventDefinitions, 'ServiceStreamEvent'));
    assert.ok(Object.hasOwn(eventDefinitions, 'AssistSignal'));
    assert.ok(operation('requestEvents').stream && operation('guidanceEvents').stream && operation('petJobEvents').stream);
    assert.equal(operation('requestCancel').method, 'post');
    assert.equal(operation('guidanceStop').method, 'post');
    assert.equal(operation('petJobCancel').method, 'delete');
    return 'stream operations and explicit cancel/stop operations are represented separately';
  }, checks);

  check('pet and reminder safety boundaries', () => {
    assert.match(operation('petCurrentPut').summary, /预览确认/);
    assert.equal(operation('petCurrentPut').versioned, true);
    assert.match(operation('reminderReceipt').summary, /真实可观察回执/);
    assert.equal(operation('reminderReceipt').authorization, 'current_bound_subject_device');
    return 'pet application remains preview-confirmed/versioned and reminder receipts do not equate send with seen';
  }, checks);

  check('all operations await D before implementation', () => {
    for (const currentOperation of operations) {
      const generated = openApiOperation(openapi, currentOperation);
      assert.equal(generated['x-implementation-stage'], 'E-after-D-approval');
    }
    return 'generated operations are marked E-after-D-approval and cannot be read as deployed backend behavior';
  }, checks);

  const commandResults = runCommands ? [runContractCommand()] : [];
  const passed = checks.filter(item => item.passed).length;
  const localChecksPassed = passed === checks.length;
  const commandFailures = commandResults.filter(item => !item.passed).map(item => ({
    id: 'C14_CONTRACT_COMMAND',
    reason: `${item.command} exited with ${item.exitCode}`,
    kind: 'code',
  }));
  const externalPending = [
    {
      id: 'A02_INDEPENDENT_REVIEW',
      capability: 'contract_independent_review',
      reason: 'A02/C14 independent review and human protocol freeze are not present.',
      production_enabled: false,
    },
    {
      id: 'C12_REAL_SUPPLIER_EVIDENCE',
      capability: 'supplier_contract_and_credentials',
      reason: 'Real supplier credentials, terms and quality evidence are not present.',
      production_enabled: false,
    },
    {
      id: 'BACKEND_NOT_CONNECTED',
      capability: 'backend_service_connection',
      reason: 'No real HTTP, SSE, WS, authentication, media relay or production database service is connected.',
      production_enabled: false,
    },
  ];
  const gate = evaluateProjectGate({
    mode,
    checks: checks.map(item => ({ ...item, kind: 'code' })),
    codeErrors: commandFailures,
    externalPending,
    release: { assessed: true, ready: false, blockers: externalPending },
  });
  const sourceRevision = fingerprintInventory(sourceInventory);
  const blockerDefinitions = [
    ...externalPending.map(item => ({ code: item.id, reason: item.reason })),
  ];
  const result = {
    reportSchemaVersion: 'c14-handoff/v2',
    generatedBy: 'nuanban/scripts/check-c14-handoff.mjs',
    generatedAt: new Date().toISOString(),
    generatedDate: localDate(),
    generatedTimeZone: 'Asia/Shanghai',
    mode,
    scope: 'C14 backend contract handoff preparation',
    sourceInventory,
    sourceRevision,
    schemaVersion,
    operations: operations.length,
    definitions: Object.keys(serviceDefinitions).length,
    status: localChecksPassed && commandFailures.length === 0 ? 'frozen' : 'technical_blocked',
    success: localChecksPassed && commandFailures.length === 0,
    checks,
    passed,
    failed: checks.length - passed,
    commandResults,
    technicalFreeze: {
      status: localChecksPassed && commandFailures.length === 0 ? 'frozen' : 'blocked',
      freezeType: 'automated_technical',
      independentReviewPresent: false,
      independentReviewRequired: true,
      sourceRevision,
    },
    backendStarted: false,
    development: gate.development,
    default: gate.default,
    external: gate.external,
    release: gate.release,
    limitations: [
      '仅覆盖本机源契约、生成物和静态安全边界审查，不连接真实后端或供应商。',
      '没有真实 HTTP、SSE、WS、认证、媒体中继、生产数据库或独立协议签收记录。',
      'frozen 仅表示自动技术冻结，不表示人类独立评审或正式发布批准。',
    ],
    blockers: blockerDefinitions.map(item => item.reason),
    blockerRefs: blockerDefinitions,
  };
  if (evidencePath) {
    writeGeneratedReport(evidencePath, result);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const evidenceIndex = process.argv.indexOf('--evidence');
  const noWrite = process.argv.includes('--no-write');
  const modeIndex = process.argv.indexOf('--mode');
  const mode = modeIndex >= 0 && process.argv[modeIndex + 1] ? process.argv[modeIndex + 1] : 'development';
  const evidencePath = noWrite
    ? undefined
    : evidenceIndex >= 0 && process.argv[evidenceIndex + 1]
    ? process.argv[evidenceIndex + 1]
    : 'docs/implementation/evidence/c14-handoff-results.json';
  try {
    const result = runC14HandoffCheck({ evidencePath, mode });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = exitCodeForGate({ mode, development: result.development, release: result.release });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
