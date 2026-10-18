import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { serviceDefinitions, serviceSchema, schemaVersion, operations, successEnvelope } from '../packages/contracts/src/spec/catalog.ts';
import { serviceErrorCodes } from '../packages/contracts/src/spec/errors.ts';
import { object, text, choice, boolean } from '../packages/contracts/src/spec/primitives.ts';
import { generateKotlinContracts } from './kotlin-contracts.mjs';
import { bridgeSchema, androidBridgeReplySchema } from '../packages/contracts/src/active-bridge.ts';

const json = value => JSON.stringify(value, null, 2) + '\n';
const root = new URL('../', import.meta.url);
const reference = name => ({ $ref: '#/components/schemas/' + name });

function componentRefs(value) {
  if (Array.isArray(value)) return value.map(componentRefs);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === '$ref' ? child.replace('#/$defs/', '#/components/schemas/') : componentRefs(child)]));
}

function typeOf(schema) {
  if (schema.$ref) return schema.$ref.split('/').at(-1);
  if ('const' in schema) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map(value => JSON.stringify(value)).join(' | ');
  if (schema.anyOf && schema.properties) return typeOf({ ...schema, anyOf: undefined }) + ' & (' + schema.anyOf.map(typeOf).join(' | ') + ')';
  if (schema.oneOf || schema.anyOf) return (schema.oneOf ?? schema.anyOf).map(typeOf).join(' | ');
  if (schema.type === 'array') return `Array<${typeOf(schema.items)}>`;
  if (schema.type === 'object') {
    const properties = Object.entries(schema.properties ?? {});
    if (!properties.length) return 'Record<string, never>';
    return '{ ' + properties.map(([key, child]) => `${key}${schema.required?.includes(key) ? '' : '?'}: ${typeOf(child)}`).join('; ') + ' }';
  }
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  return schema.type ?? 'unknown';
}

export function generateArtifacts() {
  const paths = {};
  for (const operation of operations) {
    const parameters = [{ name: 'X-Request-ID', in: 'header', required: true, schema: { type: 'string', format: 'uuid' } }];
    for (const match of operation.path.matchAll(/\{([^}]+)\}/g)) parameters.push({ name: match[1], in: 'path', required: true, schema: { type: 'string', format: 'uuid' } });
    if (operation.method !== 'get') parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', format: 'uuid' } });
    if (operation.versioned) parameters.push({ name: 'If-Match', in: 'header', required: true, schema: { type: 'string', pattern: '^"[1-9][0-9]*"$' } });
    if (operation.paginated) parameters.push({ name: 'cursor', in: 'query', required: false, schema: { type: 'string', minLength: 1, maxLength: 512 } }, { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 30 } });
    const response = { description: operation.stream ? '带终止事件的 SSE；关闭连接不代表成功' : '操作成功' };
    if (operation.response) response.content = operation.stream
      ? { 'text/event-stream': { schema: { type: 'string' }, 'x-event-schema': reference(operation.response) } }
      : { 'application/json': { schema: componentRefs(successEnvelope(operation.response)) } };
    if (operation.versioned) response.headers = { ETag: { description: '当前对象版本，用于后续 If-Match', schema: { type: 'string', pattern: '^"[1-9][0-9]*"$' } } };
    const responses = { [operation.successStatus]: response };
    for (const status of [400, 401, 403, 404, 409, 410, 422, 429, 503, 504]) responses[status] = { description: '安全错误包络；不返回原始媒体、凭证或堆栈', content: { 'application/json': { schema: reference('ErrorEnvelope') } } };
    const spec = { operationId: operation.id, summary: operation.summary, security: operation.authentication === 'bearer' ? [{ bearerAuth: [] }] : [], parameters, responses, 'x-object-authorization': operation.authorization, 'x-implementation-stage': 'E-after-D-approval' };
    if (operation.authentication === 'public-challenge') spec['x-challenge-proof-required'] = operation.authorization;
    if (operation.binary) spec.requestBody = { required: true, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } }, 'x-maximum-bytes': 10485760 };
    else if (operation.request) spec.requestBody = { required: true, content: { 'application/json': { schema: reference(operation.request) } } };
    (paths[operation.path] ??= {})[operation.method] = spec;
  }
  const openapi = { openapi: '3.1.0', info: { title: '暖伴服务契约（待独立评审的前端交接草案）', version: schemaVersion, description: '单一来源生成；不是已部署 API。真实鉴权、供应和媒体能力待 D 后实现。' }, servers: [{ url: 'https://api.example.invalid', description: '不可访问的文档占位地址' }], paths, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } }, schemas: componentRefs(serviceDefinitions) } };
  const noteNames = ['NoteDto'];
  const legacyError = { $schema: serviceSchema.$schema, ...object({ request_id: text(128), schema_version: { const: schemaVersion }, error: object({ code: choice(...serviceErrorCodes), message: text(320), retryable: boolean }) }) };
  return new Map([
    ['packages/contracts/schemas/bridge.schema.json', json(bridgeSchema)],
    ['packages/contracts/schemas/android-bridge-reply.schema.json', json(androidBridgeReplySchema)],
    ['packages/contracts/schemas/services.schema.json', json(serviceSchema)],
    ['packages/contracts/schemas/note.schema.json', json({ $schema: serviceSchema.$schema, $defs: Object.fromEntries(noteNames.map(name => [name, serviceDefinitions[name]])), $ref: '#/$defs/NoteDto' })],
    ['packages/contracts/schemas/service-error.schema.json', json(legacyError)],
    ['packages/contracts/openapi.json', json(openapi)],
    ['packages/contracts/src/types.generated.ts', Object.entries(serviceDefinitions).map(([name, schema]) => `export type ${name} = ${typeOf(schema)};`).join('\n') + '\n'],
    ...generateKotlinContracts(serviceDefinitions, schemaVersion),
  ]);
}

export async function writeContracts(check = false) {
  const changed = [];
  for (const [path, content] of generateArtifacts()) {
    const url = new URL(path, root);
    let current;
    try { current = await readFile(url, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (current === content) continue;
    changed.push(path);
    if (!check) { await mkdir(new URL('.', url), { recursive: true }); await writeFile(url, content, 'utf8'); }
  }
  if (check && changed.length) throw new Error('契约生成物漂移，请运行 pnpm contracts:generate: ' + changed.join(', '));
  return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const changed = await writeContracts(process.argv.includes('--check'));
  console.log(`契约 ${schemaVersion}: ${operations.length} 个操作，${Object.keys(serviceDefinitions).length} 个定义，${changed.length} 个文件更新`);
}
