import Ajv from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import { contractFormats } from './formats.ts';
import { serviceSchema } from './spec/catalog.ts';

let ajv: Ajv | undefined;
const validators = new Map<string, ValidateFunction>();

export function contractValidator(name: string): ValidateFunction {
  let validate = validators.get(name);
  if (!validate) {
    if (!ajv) {
      ajv = new Ajv({ strict: true, formats: contractFormats });
      ajv.addKeyword({ keyword: 'example', valid: true });
      ajv.addSchema(serviceSchema);
    }
    validate = ajv.getSchema(serviceSchema.$id + '#/$defs/' + name);
    if (!validate) throw new Error('未知契约定义：' + name);
    validators.set(name, validate);
  }
  return validate;
}

export function assertContract(name: string, value: unknown): void {
  if (!contractValidator(name)(value)) throw new Error('服务数据不符合契约：' + name);
}
