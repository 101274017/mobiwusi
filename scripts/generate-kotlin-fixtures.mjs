import { mkdir, writeFile } from 'node:fs/promises';
import { serviceDefinitions, schemaVersion } from '../packages/contracts/src/spec/catalog.ts';
import { contractValidator } from '../packages/contracts/src/validation.ts';
import { syntheticValue } from '../tests/contract/fixtures.ts';
import { kotlinString } from './kotlin-contracts.mjs';
import Ajv from 'ajv/dist/2020.js';
import { bridgeSchema, androidBridgeReplySchema, isBridgeMessage } from '../packages/contracts/src/active-bridge.ts';

const root = new URL('../', import.meta.url);
const cases = [];
const seen = new Set();
function add(name, label, value) {
  const key = name + ':' + JSON.stringify(value);
  if (seen.has(key)) return;
  seen.add(key);
  cases.push({ name, label, value, valid: contractValidator(name)(value) });
}
function complete(schema) {
  if (schema.$ref) return complete(serviceDefinitions[schema.$ref.split('/').at(-1)]);
  if (schema.oneOf || (schema.anyOf && !schema.properties)) return complete((schema.oneOf ?? schema.anyOf)[0]);
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, child]) => [key, complete(child)]));
  if (schema.type === 'array') return Array.from({ length: Math.max(1, schema.minItems ?? 0) }, () => complete(schema.items));
  return syntheticValue(schema);
}
function replacement(value, path, child) {
  if (!path.length) return child;
  const next = structuredClone(value);
  let current = next;
  for (const key of path.slice(0, -1)) current = current[key];
  current[path.at(-1)] = child;
  return next;
}
function variants(name, schema, rootValue, path = []) {
  if (schema.$ref) return variants(name, serviceDefinitions[schema.$ref.split('/').at(-1)], rootValue, path);
  const label = path.join('.') || 'root';
  for (const branch of schema.oneOf ?? schema.anyOf ?? []) {
    const value = complete(branch);
    add(name, label + ':union', replacement(rootValue, path, value));
    variants(name, branch, replacement(rootValue, path, value), path);
  }
  if (schema.enum) for (const value of [...schema.enum, '__unknown_enum__']) add(name, label + ':enum', replacement(rootValue, path, value));
  if (schema.type === 'object') {
    const current = path.reduce((value, key) => value[key], rootValue);
    if (!current || typeof current !== 'object' || Array.isArray(current)) return;
    add(name, label + ':unknown', replacement(rootValue, path, { ...current, unexpected_secret: 'SYNTHETIC-MUST-NOT-APPEAR-IN-ERROR' }));
    for (const key of schema.required ?? []) {
      const missing = structuredClone(current);
      delete missing[key];
      add(name, label + ':missing:' + key, replacement(rootValue, path, missing));
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (!Object.hasOwn(current, key)) continue;
      add(name, label + ':null:' + key, replacement(rootValue, [...path, key], null));
      variants(name, child, rootValue, [...path, key]);
    }
  }
  if (schema.type === 'array') {
    add(name, label + ':wrong-type', replacement(rootValue, path, {}));
    if (schema.minItems) add(name, label + ':too-short', replacement(rootValue, path, []));
    if (schema.maxItems !== undefined && schema.maxItems <= 100) add(name, label + ':too-long', replacement(rootValue, path, Array.from({ length: schema.maxItems + 1 }, () => complete(schema.items))));
    const current = path.reduce((value, key) => value[key], rootValue);
    if (Array.isArray(current) && current.length) variants(name, schema.items, rootValue, [...path, 0]);
  }
  if (schema.type === 'string') {
    add(name, label + ':wrong-type', replacement(rootValue, path, false));
    if (schema.minLength) add(name, label + ':too-short', replacement(rootValue, path, ''));
    if (schema.maxLength && schema.maxLength <= 200) {
      add(name, label + ':too-long', replacement(rootValue, path, 'x'.repeat(schema.maxLength + 1)));
      add(name, label + ':unicode-boundary', replacement(rootValue, path, '🙂'.repeat(schema.maxLength)));
    }
    const samples = {
      uuid: ['00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', '00000000-0000-8000-8000-000000000001', 'not-an-id', '00000000-0000-4000-8000-000000000001\n'],
      'date-time': ['2026-02-29T00:00:00Z', '2028-02-29T23:59:59.123456789+23:59', '2026-10-15T24:00:00Z', '2026-10-15', '2026-10-15T01:00:00+24:00', '2026-10-15T01:00:00Z\n'],
      'iana-timezone': ['UTC', 'Asia/Shanghai', 'asia/shanghai', 'US/Pacific', 'Asia/Calcutta', 'Etc/UTC', 'Invalid/Zone', '+08:00'],
    };
    for (const sample of samples[schema.format] ?? []) add(name, label + ':format', replacement(rootValue, path, sample));
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    for (const value of ['1', -1, schema.maximum !== undefined ? schema.maximum + 1 : -2]) add(name, label + ':number', replacement(rootValue, path, value));
    if (schema.type === 'integer') add(name, label + ':fraction', replacement(rootValue, path, 0.5));
    if (schema.exclusiveMinimum !== undefined) add(name, label + ':exclusive', replacement(rootValue, path, schema.exclusiveMinimum));
  }
  if (schema.type === 'boolean') add(name, label + ':wrong-type', replacement(rootValue, path, 'true'));
}

for (const [name, schema] of Object.entries(serviceDefinitions)) {
  add(name, 'minimal', syntheticValue(schema));
  add(name, 'complete', complete(schema));
  add(name, 'root-null', null);
  variants(name, schema, complete(schema));
}
add('NoteUpdateRequest', 'mastery-requires-source', { mastery: 'mastered' });
add('NoteUpdateRequest', 'source-requires-mastery', { mastery_source: 'self' });
add('NoteUpdateRequest', 'empty-patch', {});
add('TodoPatch', 'required-confirmation', { remind_at: '2026-10-15T01:00:00Z', timezone: 'Asia/Shanghai' });
add('TodoPatch', 'nullable-optional', { note_id: null });
add('ResponseRequest', 'input-required', { input_id: '00000000-0000-4000-8000-000000000001', generation: 0 });

function literal(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return kotlinString(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number' && !Number.isFinite(value)) return Number.isNaN(value) ? 'Double.NaN' : value > 0 ? 'Double.POSITIVE_INFINITY' : 'Double.NEGATIVE_INFINITY';
  if (typeof value === 'number') return Number.isInteger(value) ? value + 'L' : String(value);
  if (Array.isArray(value)) return `listOf<Any?>(${value.map(literal).join(', ')})`;
  return `linkedMapOf<String, Any?>(${Object.entries(value).map(([key, child]) => `${kotlinString(key)} to ${literal(child)}`).join(', ')})`;
}
const groups = [];
for (let offset = 0; offset < cases.length; offset += 60) groups.push(cases.slice(offset, offset + 60).map((value, index) => '::case' + (offset + index)));
const activeRequest = { version: 1, request_id: 'synthetic-active-request', generation: 0, method: 'capabilities' };
const activeAjv = new Ajv({ strict: true });
const validateActive = activeAjv.compile(bridgeSchema);
const validateReply = activeAjv.compile(androidBridgeReplySchema);
const activeTodoId = '00000000-0000-4000-8000-000000000001';
const activeInstanceId = '00000000-0000-4000-8000-000000000002';
const activeSchedule = { version: 1, request_id: 'synthetic-active-schedule', generation: 0, method: 'reminder_schedule', account_id: 'demo-owner', reminder_id: 'todo-1', todo_id: activeTodoId, instance_id: activeInstanceId, schedule_version: 1, due_at: '2026-10-20T01:00:00.000Z', timezone: 'Asia/Shanghai', deep_link: '/todos/edit/todo-1', repeat_rule: 'none', channel: 'local', payload: { kind: 'review-reminder' }, updated_at: '2026-10-16T01:00:00.000Z' };
const activeCancel = { version: 1, request_id: 'synthetic-active-cancel', generation: 0, method: 'reminder_cancel', account_id: 'demo-owner', reminder_id: 'todo-1', todo_id: activeTodoId, instance_id: activeInstanceId, schedule_version: 1, cancelled_at: '2026-10-16T01:00:00.000Z' };
const activeNotifyDue = { version: 1, request_id: 'synthetic-active-notify', generation: 0, method: 'reminder_notify_due', account_id: 'demo-owner', reminder_id: 'todo-1', now: '2026-10-20T01:00:00.000Z' };
const activeValues = [activeRequest, { ...activeRequest, method: 'stop_all' }, activeSchedule, activeCancel, activeNotifyDue, ...[2147483648, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, -1, 0.5, '1', null, NaN, Infinity].map(generation => ({ ...activeRequest, generation })), ...['1', true, null, 2].map(version => ({ ...activeRequest, version })), ...['', ' ', 'x'.repeat(129), 'synthetic\n', 1, null].map(request_id => ({ ...activeRequest, request_id })), { ...activeRequest, method: 'capture.start' }, { ...activeRequest, granted: true }, { ...activeSchedule, payload: { kind: 'unknown' } }, ...Object.keys(activeRequest).map(key => Object.fromEntries(Object.entries(activeRequest).filter(([name]) => name !== key))), null];
const activeCases = activeValues.map(value => {
  const valid = validateActive(value);
  if (valid !== isBridgeMessage(value)) throw new Error('Active bridge guard/Schema mismatch');
  const reply = valid && (value.method === 'capabilities' || value.method === 'stop_all') ? { request_id: value.request_id, generation: value.generation, ...(value.method === 'capabilities' ? { platform: 'android', externalCapture: false, nativeOverlay: false, remoteMedia: false, status: 'native-skeleton' } : { stopped: true, captureActive: false }) } : null;
  if (reply && !validateReply(reply)) throw new Error('Invalid expected bridge reply');
  return { value, valid, reply };
});
const source = `package org.nuanban.contracts

private data class ContractFixture(val name: String, val value: Any?, val valid: Boolean)
${groups.map((values, groupIndex) => `private object FixtureGroup${groupIndex} {\n${cases.slice(groupIndex * 60, groupIndex * 60 + 60).map((value, index) => `    private fun case${groupIndex * 60 + index}(): ContractFixture = ContractFixture(${kotlinString(value.name)}, ${literal(value.value)}, ${value.valid})`).join('\n')}\n    fun cases(): List<() -> ContractFixture> = listOf(${values.join(', ')})\n}`).join('\n')}

private fun equalJson(left: Any?, right: Any?): Boolean = when {
    left is Number && right is Number -> left.toDouble() == right.toDouble()
    left is Map<*, *> && right is Map<*, *> -> left.keys == right.keys && left.all { (key, value) -> equalJson(value, right[key]) }
    left is List<*> && right is List<*> -> left.size == right.size && left.indices.all { equalJson(left[it], right[it]) }
    else -> left == right
}

fun main() {
    val definitions = mutableSetOf<String>()
    var passed = 0
    var valid = 0
    for (group in listOf(${groups.map((_, index) => 'FixtureGroup' + index + '::cases').join(', ')})) {
        for (factory in group()) {
            val fixture = factory()
            definitions.add(fixture.name)
            check(ContractValidator.accepts(fixture.name, fixture.value) == fixture.valid) { "Kotlin/Ajv mismatch at case " + passed + " (" + fixture.name + ")" }
            if (fixture.valid) {
                val dto = GeneratedContractDtos.decode(fixture.name, fixture.value)
                check(equalJson(dto.toWire(), fixture.value)) { "DTO roundtrip mismatch at case " + passed + " (" + fixture.name + ")" }
                valid += 1
            } else {
                try {
                    GeneratedContractDtos.decode(fixture.name, fixture.value)
                    error("Invalid DTO accepted at case " + passed)
                } catch (error: ContractViolation) {
                    check(!error.message.orEmpty().contains("SYNTHETIC-MUST-NOT-APPEAR-IN-ERROR"))
                }
            }
            passed += 1
        }
    }
    check(definitions == GeneratedContractDtos.definitionNames)
    val explicitNull = TodoPatch(note_id = OptionalField.Present(null)).toWire()
    val absent = TodoPatch(title = OptionalField.Present("synthetic")).toWire()
    check(explicitNull.containsKey("note_id") && explicitNull["note_id"] == null && !absent.containsKey("note_id"))
    try {
        NoteUpdateRequest(mastery = OptionalField.Present(NoteUpdateRequestMastery.VALUE_MASTERED))
        error("Missing mastery source accepted by typed constructor")
    } catch (_: ContractViolation) { }
    try {
        NormalizedRect(x = Double.NaN, y = 0.0, width = 1.0, height = 1.0)
        error("Non-finite coordinate accepted by typed constructor")
    } catch (_: ContractViolation) { }
    val activeCases = listOf(${activeCases.map(value => `Triple<Any?, Boolean, Any?>(${literal(value.value)}, ${value.valid}, ${literal(value.reply)})`).join(', ')})
    for ((index, fixture) in activeCases.withIndex()) {
        val decoded = try { ActiveBridgeRequest.fromWire(fixture.first) } catch (_: ContractViolation) { null }
        check((decoded != null) == fixture.second) { "Active bridge Kotlin/Ajv mismatch at case " + index }
        if (decoded != null && fixture.third != null) check(equalJson(decoded.reply(), fixture.third)) { "Active bridge reply mismatch at case " + index }
    }
    println("{\\"schemaVersion\\":\\"${schemaVersion}\\",\\"definitions\\":" + definitions.size + ",\\"casesPassed\\":" + passed + ",\\"validRoundtrips\\":" + valid + ",\\"invalidRejected\\":" + (passed - valid) + ",\\"typedBoundaryChecks\\":3,\\"activeBridgeCasesPassed\\":" + activeCases.size + ",\\"deviceVerified\\":false}")
}
`;
const output = new URL('.cache/kotlin-contracts/', root);
await mkdir(output, { recursive: true });
await writeFile(new URL('ContractFixtures.generated.kt', output), source, 'utf8');
await writeFile(new URL('fixtures-manifest.json', output), JSON.stringify({ schemaVersion, definitions: Object.keys(serviceDefinitions).length, cases: cases.length, activeBridgeCases: activeCases.length, expectedValid: cases.filter(value => value.valid).length, casesByDefinition: Object.fromEntries(Object.keys(serviceDefinitions).map(name => [name, cases.filter(value => value.name === name).length])) }, null, 2) + '\n');
console.log(`Kotlin/Ajv fixtures: ${cases.length} cases, ${Object.keys(serviceDefinitions).length} definitions`);
