import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

function generate(definitions: unknown) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', `import {generateKotlinContracts} from './scripts/kotlin-contracts.mjs'; console.log(JSON.stringify([...generateKotlinContracts(${JSON.stringify(definitions)}, 'synthetic-version')]));`], { encoding: 'utf8', cwd: process.cwd() });
}

describe('Kotlin 契约生成器不放松 Schema', () => {
  it('保留必填可空与可缺省非空的区别，常量不能由调用者改写', () => {
    const result = generate({ Example: { type: 'object', additionalProperties: false, properties: { required_nullable: { anyOf: [{ type: 'string' }, { type: 'null' }] }, optional_value: { type: 'string' }, fixed: { const: 0 } }, required: ['required_nullable', 'fixed'] } });
    expect(result.status, result.stderr).toBe(0);
    const source = JSON.parse(result.stdout)[0][1] as string;
    expect(source).toContain('val `required_nullable`: String?');
    expect(source).toContain('val `optional_value`: OptionalField<String> = OptionalField.Absent');
    expect(source).toContain('val `fixed`: Long get() = 0L');
    expect(source).toContain('fields.containsKey("optional_value")');
  });
  it('空对象生成可解码的单例，而不是非法 companion', () => {
    const result = generate({ Empty: { type: 'object', properties: {}, additionalProperties: false } });
    expect(result.status, result.stderr).toBe(0);
    const source = JSON.parse(result.stdout)[0][1] as string;
    expect(source).toContain('data object Empty');
    expect(source).toContain('fun fromWire(value: Any?): Empty');
    expect(source).not.toContain('companion object');
  });
  it('用 sealed 联合保留分支，并转义 Kotlin 字符串插值字符', () => {
    const result = generate({ Choice: { oneOf: [{ type: 'object', properties: { type: { const: 'value$1' } }, required: ['type'], additionalProperties: false }, { type: 'object', properties: { type: { const: 'other' } }, required: ['type'], additionalProperties: false }] } });
    expect(result.status, result.stderr).toBe(0);
    const source = JSON.parse(result.stdout)[0][1] as string;
    expect(source).toContain('sealed interface Choice');
    expect(source).toContain('value\\$1');
    expect(source).toContain('ContractValidator.validate("Choice", value)');
  });
  it.each([
    { type: 'object', properties: {}, not: { type: 'string' } },
    { type: 'object', properties: { unsafe: { type: 'string', format: 'unreviewed-format' } } },
    { type: 'object', properties: {}, additionalProperties: { type: 'string' } },
    { anyOf: [{ type: 'string' }, { type: 'integer' }] },
    { type: 'object', properties: { 'unsafe`field': { type: 'string' } } },
    { type: 'string', enum: ['same-value', 'same_value'] },
  ])('不支持的关键约束或标识必须失败而非降级：%j', schema => {
    const result = generate({ Unsafe: schema });
    expect(result.status).not.toBe(0);
  });
});
