import type { Schema } from '../../packages/contracts/src/spec/primitives.ts';
import { serviceDefinitions } from '../../packages/contracts/src/spec/catalog.ts';

export function syntheticValue(schema: Schema): unknown {
  if (schema.example !== undefined) return structuredClone(schema.example);
  if (schema.$ref) return syntheticValue(serviceDefinitions[schema.$ref.split('/').at(-1)! as keyof typeof serviceDefinitions]);
  if ('const' in schema) return schema.const;
  if (schema.enum) return schema.enum[0];
  if (schema.oneOf || (schema.anyOf && !schema.properties)) return syntheticValue((schema.oneOf ?? schema.anyOf)![0]);
  if (schema.type === 'object') {
    const keys = schema.required?.length ? schema.required : Object.keys(schema.properties ?? {}).slice(0, schema.minProperties ?? 0);
    const value = Object.fromEntries(keys.map(key => [key, syntheticValue(schema.properties![key])]));
    return schema.anyOf ? { ...value, ...syntheticValue(schema.anyOf[0]) as object } : value;
  }
  if (schema.type === 'array') return Array.from({ length: schema.minItems ?? 0 }, () => syntheticValue(schema.items!));
  if (schema.type === 'boolean') return false;
  if (schema.type === 'null') return null;
  if (schema.type === 'number' || schema.type === 'integer') return schema.minimum ?? ((schema.exclusiveMinimum ?? -1) + 1);
  return 'synthetic'.padEnd(schema.minLength ?? 1, 'x').slice(0, schema.maxLength ?? 80);
}

export function fixture(name: string): Record<string, unknown> {
  return syntheticValue(serviceDefinitions[name as keyof typeof serviceDefinitions]) as Record<string, unknown>;
}
