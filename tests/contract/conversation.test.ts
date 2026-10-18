import { describe, expect, it } from 'vitest';
import Ajv from 'ajv/dist/2020';
import eventSchema from '../../packages/contracts/schemas/conversation-event.schema.json';
import errorSchema from '../../packages/contracts/schemas/service-error.schema.json';
import { isConversationEvent, serviceErrorCodes } from '@nuanban/contracts';
import { ServiceFailure } from '@nuanban/application';

const ajv = new Ajv({ strict: true });
const validateEvent = ajv.compile(eventSchema);
const validateError = ajv.compile(errorSchema);
const valid = { request_id: 'demo-request-1', sequence: 1, type: 'delta', text: '先打开设置。' };

describe('流式事件的 Schema 与运行时校验一致', () => {
  it.each([
    [valid, true],
    [{ request_id: 'request', sequence: 0, type: 'started' }, true],
    [{ request_id: 'request', sequence: 2, type: 'completed' }, true],
    [{ ...valid, text: '' }, false],
    [{ ...valid, text: '字'.repeat(4001) }, false],
    [{ ...valid, sequence: -1 }, false],
    [{ ...valid, sequence: 0.5 }, false],
    [{ ...valid, request_id: '' }, false],
    [{ ...valid, type: 'completed' }, false],
    [{ ...valid, type: 'execute' }, false],
    [{ ...valid, script: 'anything' }, false],
    [null, false],
  ])('验证事件 %#', (event, expected) => {
    expect(validateEvent(event)).toBe(expected);
    expect(isConversationEvent(event)).toBe(expected);
  });
});

describe('安全错误契约', () => {
  it.each(serviceErrorCodes)('错误代码 %s 可被序列化', code => {
    expect(validateError(new ServiceFailure(code, '可读的安全错误', true).envelope('request-1'))).toBe(true);
  });
  it('不接受供应商堆栈或未知字段', () => {
    const error = new ServiceFailure('TIMEOUT', '超时', true).envelope('request-1');
    expect(validateError({ ...error, stack: 'secret' })).toBe(false);
    expect(validateError({ ...error, error: { ...error.error, provider_secret: 'secret' } })).toBe(false);
  });
  it('Schema 与 TypeScript 错误码没有漂移', () => {
    expect(errorSchema.properties.error.properties.code.enum).toEqual([...serviceErrorCodes]);
  });
});
