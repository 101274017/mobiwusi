export interface Schema {
  $ref?: string;
  type?: string | string[];
  const?: string | number | boolean | null;
  enum?: readonly (string | number | boolean | null)[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  items?: Schema;
  oneOf?: Schema[];
  anyOf?: Schema[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  dependentRequired?: Record<string, string[]>;
  pattern?: string;
  format?: string;
  example?: unknown;
}

export const schemaVersion = '0.2.0';
export const text = (maximum = 200, minimum = 1): Schema => ({ type: 'string', minLength: minimum, maxLength: maximum });
export const identifier: Schema = { type: 'string', format: 'uuid', example: '00000000-0000-4000-8000-000000000001' };
export const instant: Schema = { type: 'string', format: 'date-time', example: '2026-10-15T01:00:00.000Z' };
export const timezone: Schema = { ...text(80), format: 'iana-timezone', example: 'Asia/Shanghai' };
export const integer = (minimum = 0, maximum = Number.MAX_SAFE_INTEGER): Schema => ({ type: 'integer', minimum, maximum });
export const boolean: Schema = { type: 'boolean' };
export const literal = (value: string | boolean): Schema => ({ const: value });
export const choice = (...values: string[]): Schema => ({ type: 'string', enum: values });
export const ref = (name: string): Schema => ({ $ref: '#/$defs/' + name });
export const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });
export const list = (schema: Schema, maximum = 100, minimum = 0): Schema => ({ type: 'array', items: schema, minItems: minimum, maxItems: maximum });
export function object(properties: Record<string, Schema>, optional: string[] = []): Schema {
  return { type: 'object', additionalProperties: false, properties, required: Object.keys(properties).filter(key => !optional.includes(key)) };
}
export const page = (item: string): Schema => object({ items: list(ref(item)), next_cursor: nullable(text(512)) });
export const relativePath: Schema = { ...text(512), pattern: '^/v1/[a-zA-Z0-9_/?=&.%:-]+$', example: '/v1/synthetic/resource' };
export const digest: Schema = { type: 'string', pattern: '^[a-f0-9]{64}$', example: 'a'.repeat(64) };
