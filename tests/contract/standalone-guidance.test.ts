import Ajv from 'ajv/dist/2020.js';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { standaloneGuidanceLimits, type StandaloneGuidanceInput, type StandaloneGuidanceResult as RuntimeResult, type StandaloneGuidanceErrorCode as RuntimeErrorCode } from '../../apps/server/src/standalone-guidance.ts';
import openapi from '../../packages/contracts/openapi.json';
import { contractFormats } from '../../packages/contracts/src/formats.ts';
import { operations, schemaVersion } from '../../packages/contracts/src/spec/catalog.ts';
import { standaloneGuidanceErrorCodes } from '../../packages/contracts/src/spec/errors.ts';
import { standaloneGuidanceDefinitions } from '../../packages/contracts/src/spec/standalone-guidance.ts';
import type { StandaloneGuidanceAnalyzeRequest, StandaloneGuidanceResult, StandaloneGuidanceErrorCode } from '../../packages/contracts/src/types.generated.ts';
import { contractValidator } from '../../packages/contracts/src/validation.ts';
import { syntheticValue } from './fixtures.ts';

const correlation = { observation_id: 'observation-a', guide_id: 'guide-a', observation_generation: 1, task_generation: 2, trigger_id: 'trigger-a', frame_id: 'frame-a' };
const requestValue: StandaloneGuidanceAnalyzeRequest = {
  ...correlation,
  trigger_reason: 'question',
  frame_hash: 'a'.repeat(64),
  sanitized_sha256: 'b'.repeat(64),
  captured_at: '2026-10-18T00:00:00.000Z',
  image: { mime: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' },
  redaction_profile: 'all_text_and_faces_v1',
  local_safety: 'safe',
  question: '如何打开显示设置？',
  elements: [{ id: 'settings', label: '设置', rect: { x: 0, y: 0, width: 1, height: 1 } }],
};
const proposal = { remind_at: '2026-10-20T08:30:00+08:00', timezone: 'Asia/Shanghai', reason: '亲手复习打开显示设置。' };
const declared = openapi.paths['/v1/standalone/guidance/analyze'].post;
const request = () => structuredClone(requestValue);
const step = () => ({ ...correlation, kind: 'step' as const, instruction: '请您亲手点击“设置”。', target_id: 'settings', presentation: 'confirmed' as const, expected_labels: ['显示'] });
const completed = () => ({ ...correlation, kind: 'completed' as const, instruction: '当前画面出现预期标签，仍需本机核验。', evidence_labels: ['设置'] });
const validateRequest = (value: unknown) => contractValidator('StandaloneGuidanceAnalyzeRequest')(value);
const validateResult = (value: unknown) => contractValidator('StandaloneGuidanceResult')(value);

function responseValidator(status: number) {
  const responses = declared.responses as Record<string, { content: { 'application/json': { schema: object } } }>;
  const schema = JSON.parse(JSON.stringify({ $defs: openapi.components.schemas, ...responses[status].content['application/json'].schema }).replaceAll('#/components/schemas/', '#/$defs/'));
  const validator = new Ajv({ strict: true, formats: contractFormats });
  validator.addKeyword({ keyword: 'example', valid: true });
  return validator.compile(schema);
}

describe('standalone guidance 公共操作与生成物', () => {
  it('注册实际 POST 路径、Bearer、自身账号授权、200 和可选关联头，不虚构幂等要求', () => {
    expect(operations.find(operation => operation.id === 'standaloneGuidanceAnalyze')).toMatchObject({ method: 'post', path: '/v1/standalone/guidance/analyze', request: 'StandaloneGuidanceAnalyzeRequest', response: 'StandaloneGuidanceResult', authentication: 'bearer', authorization: 'self', successStatus: 200, idempotencyKey: false });
    expect(declared.security).toEqual([{ bearerAuth: [] }]);
    expect(declared['x-object-authorization']).toBe('self');
    expect(declared.parameters).toEqual([{ name: 'X-Request-ID', in: 'header', required: false, schema: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$', example: 'standalone-1' } }]);
    expect(declared.requestBody.content['application/json'].schema).toEqual({ $ref: '#/components/schemas/StandaloneGuidanceAnalyzeRequest' });
    expect(Object.keys(declared.responses)).toEqual(['200', '400', '401', '403', '499', '500', '502', '503', '504']);
  });

  it('其他操作保留原有必填请求标识和写操作幂等头', () => {
    const paths = openapi.paths as Record<string, Record<string, { parameters: Array<{ name: string; required: boolean; schema: { format?: string } }> }>>;
    for (const operation of operations.filter(operation => operation.id !== 'standaloneGuidanceAnalyze')) {
      const parameters = paths[operation.path][operation.method].parameters;
      expect(parameters.find(parameter => parameter.name === 'X-Request-ID')).toMatchObject({ required: true, schema: { format: 'uuid' } });
      if (operation.method !== 'get') expect(parameters.find(parameter => parameter.name === 'Idempotency-Key')).toMatchObject({ required: true });
    }
  });

  it.each(Object.entries(standaloneGuidanceDefinitions))('%s 与现有合成夹具生成方式兼容', (name, schema) => {
    const validate = contractValidator(name);
    expect(validate(syntheticValue(schema)), JSON.stringify(validate.errors)).toBe(true);
    for (const branch of schema.oneOf ?? []) expect(validate(syntheticValue(branch)), JSON.stringify(validate.errors)).toBe(true);
  });

  it('生成 TypeScript 请求/结果兼容服务端接口，错误码类型完整相等', () => {
    expectTypeOf<StandaloneGuidanceAnalyzeRequest>().toExtend<StandaloneGuidanceInput>();
    expectTypeOf<StandaloneGuidanceResult>().toExtend<RuntimeResult>();
    expectTypeOf<StandaloneGuidanceErrorCode>().toEqualTypeOf<RuntimeErrorCode>();
    expect(validateRequest(request())).toBe(true);
    expect(validateResult(step())).toBe(true);
  });

  it('生成 OpenAPI 成功包络保留本机非 UUID 关联标识且拒绝未知数据', () => {
    const validate = responseValidator(200);
    const envelope = { data: step(), request_id: 'standalone-request', schema_version: schemaVersion };
    expect(validate(envelope), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...envelope, raw_frame: 'synthetic' })).toBe(false);
    expect(validate({ ...envelope, data: { ...step(), ocr_text: 'synthetic' } })).toBe(false);
    expect(validate({ ...envelope, request_id: '../invalid' })).toBe(false);
  });
});

describe('standalone guidance 请求静态边界', () => {
  it.each(Object.keys(requestValue))('必填字段 %s 不可缺失', field => {
    const value: Record<string, unknown> = request();
    delete value[field];
    expect(validateRequest(value)).toBe(false);
  });

  it.each(['observation_id', 'guide_id', 'trigger_id', 'frame_id'])('%s 沿用本地标识而非强制 UUID', field => {
    expect(validateRequest({ ...request(), [field]: 'a'.repeat(128) })).toBe(true);
    for (const invalid of ['', 'a'.repeat(129), '../bad', '_first', '含中文', 'id\n']) expect(validateRequest({ ...request(), [field]: invalid })).toBe(false);
  });

  it.each(['observation_generation', 'task_generation'])('%s 必须为正安全整数', field => {
    expect(validateRequest({ ...request(), [field]: Number.MAX_SAFE_INTEGER })).toBe(true);
    for (const invalid of [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, '1', null]) expect(validateRequest({ ...request(), [field]: invalid })).toBe(false);
  });

  it.each(['frame_hash', 'sanitized_sha256'])('%s 只接受 64 位大小写十六进制', field => {
    expect(validateRequest({ ...request(), [field]: 'A'.repeat(64) })).toBe(true);
    for (const invalid of ['', 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64)]) expect(validateRequest({ ...request(), [field]: invalid })).toBe(false);
  });

  it('按触发原因限制空问题且保留服务端 2000 字限制，不混用桌宠输入 500 字', () => {
    expect(validateRequest({ ...request(), question: '问'.repeat(standaloneGuidanceLimits.questionCharacters) })).toBe(true);
    expect(validateRequest({ ...request(), question: '问'.repeat(standaloneGuidanceLimits.questionCharacters + 1) })).toBe(false);
    for (const question of ['', ' \t\n']) expect(validateRequest({ ...request(), question })).toBe(false);
    for (const trigger_reason of ['page_changed', 'verification']) expect(validateRequest({ ...request(), trigger_reason, question: '' })).toBe(true);
    expect(validateRequest({ ...request(), trigger_reason: 'auto_click' })).toBe(false);
  });

  it.each(['2026-02-30T00:00:00Z', '2026-10-18', '2026-10-18T00:00:00.1234Z', '2026-10-18T00:00:00+14:01'])('拒绝非法时间形状 %s', captured_at => expect(validateRequest({ ...request(), captured_at })).toBe(false));

  it('只接受有安全/脱敏前置声明的 PNG 字段，不接受 JPEG 或未知声明', () => {
    expect(validateRequest({ ...request(), local_safety: 'unknown' })).toBe(false);
    expect(validateRequest({ ...request(), redaction_profile: 'none' })).toBe(false);
    expect(validateRequest({ ...request(), image: { ...requestValue.image, mime: 'image/jpeg' } })).toBe(false);
  });

  it.each(['', 'A'.repeat(76), 'data:image/png;base64,' + requestValue.image.base64, requestValue.image.base64 + '\n', requestValue.image.base64.slice(0, -1), requestValue.image.base64.slice(0, -2) + 'x='])('拒绝错误 PNG/base64 编码形状 %s', base64 => expect(validateRequest({ ...request(), image: { mime: 'image/png', base64 } })).toBe(false));

  it('限制 base64 字符数，但形状通过不代表 PNG 解码或像素检查已通过', () => {
    const base64 = 'iVBORw0KGgoA' + 'A'.repeat(standaloneGuidanceLimits.imageBase64Characters - 12);
    expect(validateRequest({ ...request(), image: { mime: 'image/png', base64 } })).toBe(true);
    expect(validateRequest({ ...request(), image: { mime: 'image/png', base64: base64 + 'AAAA' } })).toBe(false);
  });

  it('限制元素数、单个标签长度和矩形各分量', () => {
    const element = requestValue.elements[0];
    const elements = Array.from({ length: standaloneGuidanceLimits.elements }, (_, index) => ({ ...element, id: 'element-' + index }));
    expect(validateRequest({ ...request(), elements })).toBe(true);
    expect(validateRequest({ ...request(), elements: [...elements, { ...element, id: 'extra' }] })).toBe(false);
    expect(validateRequest({ ...request(), elements: [{ ...element, label: '字'.repeat(48) }] })).toBe(true);
    expect(validateRequest({ ...request(), elements: [{ ...element, label: '字'.repeat(49) }] })).toBe(false);
    expect(validateRequest({ ...request(), elements: [{ ...element, label: ' ' }] })).toBe(false);
    expect(validateRequest({ ...request(), elements: [{ ...element, rect: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 } }] })).toBe(true);
    for (const field of ['x', 'y', 'width', 'height']) {
      for (const invalid of [-1, standaloneGuidanceLimits.imageDimension + 1, Infinity, '1']) expect(validateRequest({ ...request(), elements: [{ ...element, rect: { ...element.rect, [field]: invalid } }] })).toBe(false);
    }
    for (const field of ['width', 'height']) expect(validateRequest({ ...request(), elements: [{ ...element, rect: { ...element.rect, [field]: 0 } }] })).toBe(false);
  });

  it('previous_step 可缺失；存在时限制必填字段、600 字和 16 个标签', () => {
    const previous_step = { instruction: '字'.repeat(600), expected_labels: Array.from({ length: 16 }, (_, index) => '标签' + index) };
    expect(validateRequest({ ...request(), previous_step })).toBe(true);
    expect(validateRequest({ ...request(), previous_step: { ...previous_step, instruction: '字'.repeat(601) } })).toBe(false);
    expect(validateRequest({ ...request(), previous_step: { ...previous_step, expected_labels: [...previous_step.expected_labels, '更多'] } })).toBe(false);
    expect(validateRequest({ ...request(), previous_step: { instruction: '设置' } })).toBe(false);
  });

  it('各层 additionalProperties 拒绝主体伪造、原图、OCR 和未约定载荷', () => {
    const value = request();
    const element = value.elements[0];
    const invalid = [
      { ...value, account_id: 'forged-owner' },
      { ...value, raw_frame: 'synthetic' },
      { ...value, image: { ...value.image, raw: 'synthetic' } },
      { ...value, elements: [{ ...element, ocr_text: 'synthetic' }] },
      { ...value, elements: [{ ...element, rect: { ...element.rect, screen_x: 0 } }] },
      { ...value, previous_step: { instruction: '设置', expected_labels: [], blob: 'synthetic' } },
    ];
    for (const candidate of invalid) expect(validateRequest(candidate)).toBe(false);
  });
});

describe('standalone guidance 结果、候选复习与安全界限', () => {
  it('保留 step 两种呈现；有目标时呈现必填，无目标时不得独有呈现', () => {
    expect(validateResult(step())).toBe(true);
    expect(validateResult({ ...step(), presentation: 'uncertain_candidate', instruction: '可能是这里，请您亲手核对。' })).toBe(true);
    const { target_id, presentation, ...untargeted } = step();
    expect(validateResult(untargeted)).toBe(true);
    expect(validateResult({ ...untargeted, target_id })).toBe(false);
    expect(validateResult({ ...untargeted, presentation })).toBe(false);
    expect(validateResult({ ...step(), presentation: 'certain' })).toBe(false);
  });

  it.each(['clarify', 'unsupported'])('%s 只允许讲解和关联字段，不可伪装目标或完成证据', kind => {
    const value = { ...correlation, kind, instruction: '请您描述当前想完成的事情。' };
    expect(validateResult(value)).toBe(true);
    for (const extra of [{ target_id: 'settings' }, { presentation: 'confirmed' }, { expected_labels: [] }, { evidence_labels: [] }, { review_proposal: proposal }]) expect(validateResult({ ...value, ...extra })).toBe(false);
  });

  it('completed 必须含非空证据，可有或没有 review_proposal，不含下一步或目标', () => {
    expect(validateResult(completed())).toBe(true);
    expect(validateResult({ ...completed(), review_proposal: proposal })).toBe(true);
    expect(validateResult({ ...completed(), evidence_labels: [] })).toBe(false);
    const { evidence_labels, ...withoutEvidence } = completed();
    expect(evidence_labels).toEqual(['设置']);
    expect(validateResult(withoutEvidence)).toBe(false);
    for (const extra of [{ target_id: 'settings' }, { presentation: 'confirmed' }, { expected_labels: [] }]) expect(validateResult({ ...completed(), ...extra })).toBe(false);
    expect(validateResult({ ...step(), review_proposal: proposal })).toBe(false);
  });

  it('复习建议严格限制日期形状、IANA 时区、240 字理由及未知字段', () => {
    const validate = contractValidator('StandaloneGuidanceReviewProposal');
    expect(validate({ ...proposal, reason: '字'.repeat(240) })).toBe(true);
    for (const invalid of [{ ...proposal, reason: '字'.repeat(241) }, { ...proposal, reason: ' ' }, { ...proposal, remind_at: '明天' }, { ...proposal, timezone: 'UTC+8' }, { ...proposal, timezone: 'Invented/Nowhere' }, { ...proposal, timezone: 'a'.repeat(65) }, { ...proposal, confirmed: true }, { ...proposal, raw: 'synthetic' }]) expect(validate(invalid)).toBe(false);
    for (const field of Object.keys(proposal)) {
      const invalid: Record<string, unknown> = { ...proposal };
      delete invalid[field];
      expect(validate(invalid)).toBe(false);
    }
  });

  it('结果限制 600 字讲解、16 个标签与 48 字单标签，禁止自动操作/掌握字段', () => {
    expect(validateResult({ ...step(), instruction: '字'.repeat(600) })).toBe(true);
    expect(validateResult({ ...step(), instruction: '字'.repeat(601) })).toBe(false);
    for (const field of ['expected_labels', 'evidence_labels']) {
      expect(validateResult({ ...step(), [field]: Array.from({ length: 16 }, (_, index) => '标签' + index) })).toBe(true);
      expect(validateResult({ ...step(), [field]: Array.from({ length: 17 }, (_, index) => '标签' + index) })).toBe(false);
      expect(validateResult({ ...step(), [field]: ['字'.repeat(49)] })).toBe(false);
    }
    for (const extra of [{ actions: ['click'] }, { rect: { x: 0 } }, { mastered: true }, { raw_frame: 'synthetic' }]) expect(validateResult({ ...step(), ...extra })).toBe(false);
  });

  it('文档明确：形状不是本地安全证明、像素检查、证据核验或提醒送达', () => {
    expect(declared.description).toContain('不能证明本地检测可信');
    for (const limit of [standaloneGuidanceLimits.imageBytes, standaloneGuidanceLimits.imagePixels, standaloneGuidanceLimits.labelsCharacters, standaloneGuidanceLimits.frameAgeMs, standaloneGuidanceLimits.futureSkewMs]) expect(declared.description).toContain(String(limit));
    expect(declared.description).toContain('未获本人确认不得创建提醒');
    expect(declared.description).toContain('不代表提醒已创建、已调度或已送达');
    expect(validateRequest({ ...request(), frame_hash: requestValue.sanitized_sha256, captured_at: '2020-01-01T00:00:00Z' })).toBe(true);
    expect(validateRequest({ ...request(), elements: [{ ...requestValue.elements[0], rect: { x: 4090, y: 0, width: 4096, height: 4096 } }] })).toBe(true);
    expect(validateResult({ ...completed(), review_proposal: { ...proposal, remind_at: '2020-01-01T00:00:00Z' } })).toBe(true);
    expect(validateResult({ ...completed(), review_proposal: { ...proposal, remind_at: '2099-01-01T00:00:00Z' } })).toBe(true);
  });
});

describe('standalone guidance 公共错误包络', () => {
  it.each(standaloneGuidanceErrorCodes)('%s 同时存在于公共枚举、既有错误包络及本接口关联包络', code => {
    expect(contractValidator('ServiceErrorCode')(code)).toBe(true);
    expect(contractValidator('StandaloneGuidanceErrorCode')(code)).toBe(true);
    const error = { code, message: 'synthetic safe failure', retryable: false };
    expect(contractValidator('ErrorEnvelope')({ error, request_id: '00000000-0000-4000-8000-000000000001', schema_version: schemaVersion })).toBe(true);
    expect(contractValidator('StandaloneGuidanceErrorEnvelope')({ error, request_id: 'standalone-request', schema_version: schemaVersion })).toBe(true);
  });

  it('生成响应覆盖实际鉴权、取消、供应、超时错误；拒绝未知错误/原始数据', () => {
    const statuses = { GUIDANCE_AUTH_REQUIRED: 401, GUIDANCE_INVALID_REQUEST: 400, GUIDANCE_UNSAFE_REQUEST: 403, GUIDANCE_UNAVAILABLE: 503, GUIDANCE_PROVIDER_FAILURE: 502, GUIDANCE_INVALID_PROVIDER_RESPONSE: 502, GUIDANCE_UNSAFE_PROVIDER_RESPONSE: 502, GUIDANCE_ABORTED: 499, GUIDANCE_TIMEOUT: 504 } satisfies Record<RuntimeErrorCode, number>;
    expect(Object.keys(statuses).sort()).toEqual([...standaloneGuidanceErrorCodes].sort());
    for (const [code, status] of Object.entries(statuses)) {
      const validate = responseValidator(status);
      expect(validate({ error: { code, message: 'synthetic safe failure', retryable: false }, request_id: 'standalone-request', schema_version: schemaVersion }), JSON.stringify(validate.errors)).toBe(true);
    }
    const validate = responseValidator(401);
    const envelope = { error: { code: 'AUTH_FAILED', message: 'Authentication required', retryable: false }, request_id: 'standalone-request', schema_version: schemaVersion };
    expect(validate(envelope)).toBe(true);
    expect(validate({ ...envelope, error: { ...envelope.error, code: 'GUIDANCE_FAKE_SUCCESS' } })).toBe(false);
    expect(validate({ ...envelope, error: { ...envelope.error, raw: 'synthetic' } })).toBe(false);
  });
});
