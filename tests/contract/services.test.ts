import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { operations, serviceDefinitions } from '../../packages/contracts/src/spec/catalog';
import { contractValidator } from '../../packages/contracts/src/validation';
import { validInstant, validTimezone } from '../../packages/contracts/src/formats';
import openapi from '../../packages/contracts/openapi.json';
import { fixture, syntheticValue } from './fixtures';

describe('全量服务契约与可重放合成夹具', () => {
  it.each(Object.entries(serviceDefinitions))('%s 的必填数据可校验', (name, schema) => {
    const validate = contractValidator(name);
    expect(validate(syntheticValue(schema)), JSON.stringify(validate.errors)).toBe(true);
    for (const branch of schema.oneOf ?? []) expect(validate(syntheticValue(branch)), JSON.stringify(validate.errors)).toBe(true);
  });
  it.each(operations)('$id 的请求、响应、授权与协议元数据完整', operation => {
    const paths = openapi.paths as Record<string, Record<string, any>>;
    const declared = paths[operation.path][operation.method];
    expect(declared.operationId).toBe(operation.id);
    expect(declared['x-object-authorization']).toBe(operation.authorization);
    expect(declared.security).toEqual(operation.authentication === 'bearer' ? [{ bearerAuth: [] }] : []);
    if (operation.request) expect(contractValidator(operation.request)(fixture(operation.request))).toBe(true);
    if (operation.response) expect(contractValidator(operation.response)(fixture(operation.response))).toBe(true);
    expect(declared.parameters.some((parameter: any) => parameter.name === 'X-Request-ID' && parameter.required)).toBe(true);
    if (operation.method !== 'get') expect(declared.parameters.some((parameter: any) => parameter.name === 'Idempotency-Key' && parameter.required)).toBe(true);
    if (operation.versioned) expect(declared.parameters.some((parameter: any) => parameter.name === 'If-Match' && parameter.required)).toBe(true);
    if (operation.paginated) expect(declared.parameters.some((parameter: any) => parameter.name === 'cursor')).toBe(true);
    if (operation.stream) expect(declared.responses[operation.successStatus].content['text/event-stream']['x-event-schema']).toEqual({ $ref: '#/components/schemas/ServiceStreamEvent' });
    if (operation.binary) { expect(declared.requestBody.content['application/octet-stream']).toBeDefined(); expect(declared.responses[204].content).toBeUndefined(); }
  });
  it('操作 ID 与路由无重复，生成物没有漂移', () => {
    expect(new Set(operations.map(operation => operation.id)).size).toBe(operations.length);
    expect(new Set(operations.map(operation => operation.method + operation.path)).size).toBe(operations.length);
    const result = spawnSync(process.execPath, ['scripts/generate-contracts.mjs', '--check'], { encoding: 'utf8', cwd: process.cwd() });
    expect(result.status, result.stderr).toBe(0);
  });
  it('拒绝未知字段、伪造主体/授权、缺失确认和混用实体补丁', () => {
    expect(contractValidator('NoteCreateRequest')({ ...fixture('NoteCreateRequest'), owner_id: 'other-account' })).toBe(false);
    expect(contractValidator('BridgeRequestV1')({ ...fixture('BridgeRequestV1'), granted: true })).toBe(false);
    expect(contractValidator('NoteUpdateRequest')({ mastery: 'mastered' })).toBe(false);
    expect(contractValidator('NoteUpdateRequest')({ mastery: 'mastered', mastery_source: 'ai' })).toBe(false);
    expect(contractValidator('NoteUpdateRequest')({})).toBe(false);
    expect(contractValidator('NoteUpdateRequest')({ mastery: 'mastered', mastery_source: 'self' })).toBe(true);
    expect(contractValidator('TodoPatch')({ remind_at: '2026-10-18T01:00:00Z' })).toBe(false);
    expect(contractValidator('TodoPatch')({ remind_at: '2026-10-18T01:00:00Z', timezone: 'Asia/Shanghai', time_confirmed: true })).toBe(true);
    expect(contractValidator('SyncMutationDto')({ ...fixture('SyncMutationDto'), operation: 'delete' })).toBe(false);
    expect(contractValidator('SyncMutationDto')({ ...fixture('SyncMutationDto'), entity_type: 'todo' })).toBe(false);
    expect(contractValidator('SafetyEventRequest')({ ...fixture('SafetyEventRequest'), raw_text: '不得上传' })).toBe(false);
    expect(contractValidator('NoteDto')({ ...fixture('NoteDto'), owner_id: '../invalid' })).toBe(false);
  });
  it.each(['2026-02-29T01:00:00Z', '2026-13-01T00:00:00Z', '2026-10-15', '2026-10-15T24:00:00Z', '2026-10-15T01:00:00+24:00'])('拒绝无效时间 %s', value => expect(validInstant(value)).toBe(false));
  it('严格校验日历、UTC 偏移与 IANA 时区', () => {
    expect(validInstant('2028-02-29T08:30:00+08:00')).toBe(true);
    expect(validInstant('2026-10-15T01:00:00.000Z')).toBe(true);
    expect(validTimezone('Asia/Shanghai')).toBe(true);
    expect(validTimezone('UTC')).toBe(true);
    expect(validTimezone('UTC+8')).toBe(false);
    expect(validTimezone('Invented/Nowhere')).toBe(false);
  });
});
