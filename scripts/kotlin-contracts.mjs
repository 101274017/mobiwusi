const keywords = new Set(['$ref', 'type', 'const', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'oneOf', 'anyOf', 'minLength', 'maxLength', 'minimum', 'exclusiveMinimum', 'maximum', 'minItems', 'maxItems', 'minProperties', 'dependentRequired', 'pattern', 'format', 'example']);
const formats = new Set(['uuid', 'date-time', 'iana-timezone']);
export const kotlinString = value => JSON.stringify(value).replaceAll('$', '\\$');
const pascal = value => String(value).split(/[^a-zA-Z0-9]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join('');
const nullableBranch = schema => schema.anyOf?.length === 2 && schema.anyOf.filter(branch => branch.type === 'null').length === 1 ? schema.anyOf.find(branch => branch.type !== 'null') : undefined;
const kotlinLiteral = value => typeof value === 'string' ? kotlinString(value) : typeof value === 'number' && Number.isInteger(value) ? value + 'L' : String(value);

export function generateKotlinContracts(definitions, version) {
  const descriptors = new Map();
  const topNames = Object.keys(definitions);
  function register(name, schema, kind, parent, target) {
    const existing = descriptors.get(name);
    if (existing) {
      if (JSON.stringify(existing.schema) !== JSON.stringify(schema) || existing.parent !== parent) throw new Error('Kotlin type-name collision: ' + name);
      return existing;
    }
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) throw new Error('Unsupported Kotlin type name: ' + name);
    const descriptor = { name, schema, kind, parent, target };
    descriptors.set(name, descriptor);
    if (kind === 'object') for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) throw new Error('Kotlin field requires an explicit name mapping: ' + name);
      typeOf(child, name + pascal(key));
    }
    if (kind === 'union') {
      descriptor.branches = schema.oneOf.map((branch, index) => {
        const labels = Object.entries(branch.properties ?? {}).filter(([key, value]) => ['type', 'method', 'entity_type', 'operation', 'ok'].includes(key) && 'const' in value).map(([, value]) => pascal(value.const));
        const branchName = name + (labels.join('') || 'Variant' + (index + 1));
        if (branch.$ref) register(branchName, branch, 'wrapper', name, branch.$ref.split('/').at(-1));
        else if (branch.type === 'object') register(branchName, branch, 'object', name);
        else throw new Error('Unsupported Kotlin union branch: ' + branchName);
        return branchName;
      });
    }
    return descriptor;
  }
  function typeOf(schema, name) {
    if (schema.$ref) {
      const target = schema.$ref.split('/').at(-1);
      if (!definitions[target]) throw new Error('Unknown Kotlin reference: ' + target);
      return target;
    }
    const nullable = nullableBranch(schema);
    if (nullable) return typeOf(nullable, name) + '?';
    if (schema.enum) return register(name, schema, 'enum').name;
    if (schema.oneOf) return register(name, schema, 'union').name;
    if (schema.type === 'object') return register(name, schema, 'object').name;
    if (schema.type === 'array') return `List<${typeOf(schema.items, name + 'Item')}>`;
    if ('const' in schema) return schema.const === null ? 'Nothing?' : typeof schema.const === 'number' ? (Number.isInteger(schema.const) ? 'Long' : 'Double') : { string: 'String', boolean: 'Boolean' }[typeof schema.const];
    const type = { string: 'String', integer: 'Long', number: 'Double', boolean: 'Boolean', null: 'Nothing?' }[schema.type];
    if (!type) throw new Error('Unsupported Kotlin schema at ' + name);
    return type;
  }
  for (const [name, schema] of Object.entries(definitions)) typeOf(schema, name);
  if (topNames.some(name => !descriptors.has(name))) throw new Error('Kotlin root aliases require an explicit supported mapping');

  function decode(schema, name, expression) {
    const nullable = nullableBranch(schema);
    if (nullable) return `if (${expression} == null) null else ${decode(nullable, name, expression)}`;
    if (schema.$ref || schema.enum || schema.oneOf || schema.type === 'object') return `${typeOf(schema, name)}.fromWire(${expression})`;
    if (schema.type === 'array') return `(${expression} as List<*>).map { item -> ${decode(schema.items, name + 'Item', 'item')} }`;
    const kind = 'const' in schema ? (schema.const === null ? 'null' : typeof schema.const === 'number' && Number.isInteger(schema.const) ? 'integer' : typeof schema.const) : schema.type;
    if (kind === 'integer') return `(${expression} as Number).toLong()`;
    if (kind === 'number') return `(${expression} as Number).toDouble()`;
    if (kind === 'null') return 'null';
    return `${expression} as ${kind === 'boolean' ? 'Boolean' : 'String'}`;
  }
  function emit(descriptor) {
    const { name, schema, kind, parent } = descriptor;
    const quoted = kotlinString(name);
    if (kind === 'enum') {
      if (schema.enum.some(value => typeof value !== 'string')) throw new Error('Kotlin enum must contain strings: ' + name);
      const names = schema.enum.map(value => 'VALUE_' + value.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase());
      if (new Set(names).size !== names.length) throw new Error('Kotlin enum-name collision: ' + name);
      return `enum class ${name}(val wireValue: String) : WireValue {\n${schema.enum.map((value, index) => `    ${names[index]}(${kotlinString(value)})`).join(',\n')};\n    override fun toWire(): String = wireValue\n    companion object {\n        fun fromWire(value: Any?): ${name} {\n            ContractValidator.validate(${quoted}, value)\n            return entries.first { it.wireValue == value }\n        }\n    }\n}`;
    }
    if (kind === 'union') return `sealed interface ${name} : WireValue {\n    companion object {\n        fun fromWire(value: Any?): ${name} {\n            ContractValidator.validate(${quoted}, value)\n${descriptor.branches.map(branch => `            if (ContractValidator.accepts(${kotlinString(branch)}, value)) return ${branch}.fromWire(value)`).join('\n')}\n            throw ContractViolation(${quoted}, "oneOf")\n        }\n    }\n}`;
    if (kind === 'wrapper') return `data class ${name}(val value: ${descriptor.target}) : ${parent} {\n    init { toWire() }\n    override fun toWire(): Any? = value.toWire().also { ContractValidator.validate(${quoted}, it) }\n    companion object {\n        fun fromWire(value: Any?): ${name} {\n            ContractValidator.validate(${quoted}, value)\n            return ${name}(${descriptor.target}.fromWire(value))\n        }\n    }\n}`;
    const properties = Object.entries(schema.properties ?? {});
    const required = new Set(schema.required ?? []);
    const parameters = properties.filter(([key, child]) => !required.has(key) || !('const' in child));
    const signature = parameters.length ? `data class ${name}(\n${parameters.map(([key, child]) => `    val \`${key}\`: ${required.has(key) ? typeOf(child, name + pascal(key)) : `OptionalField<${typeOf(child, name + pascal(key))}> = OptionalField.Absent`}`).join(',\n')}\n)` : `data object ${name}`;
    const constants = properties.filter(([key, child]) => required.has(key) && 'const' in child).map(([key, child]) => `    val \`${key}\`: ${typeOf(child, name + pascal(key))} get() = ${kotlinLiteral(child.const)}`).join('\n');
    const entries = properties.map(([key]) => `        ${kotlinString(key)} to \`${key}\``).join(',\n');
    const argumentsList = parameters.map(([key, child]) => {
      const expression = decode(child, name + pascal(key), `fields[${kotlinString(key)}]`);
      return `                \`${key}\` = ${required.has(key) ? expression : `if (fields.containsKey(${kotlinString(key)})) OptionalField.Present(${expression}) else OptionalField.Absent`}`;
    }).join(',\n');
    const factory = `        fun fromWire(value: Any?): ${name} {\n            ContractValidator.validate(${quoted}, value)\n${parameters.length ? `            val fields = wireObject(value)\n            return ${name}(\n${argumentsList}\n            )` : `            return ${name}`}\n        }`;
    return `${signature} : WireObject${parent ? ', ' + parent : ''} {\n${constants ? constants + '\n' : ''}${parameters.length ? '    init { toWire() }\n' : ''}    override fun toWire(): Map<String, Any?> = wireBuild(${quoted}, ${properties.length ? 'linkedMapOf(\n' + entries + '\n    )' : 'emptyMap()'})\n${parameters.length ? '    companion object {\n' + factory + '\n    }' : factory}\n}`;
  }

  const rules = [];
  const ruleIds = new WeakMap();
  function rule(schema) {
    if (ruleIds.has(schema)) return `rule${ruleIds.get(schema)}()`;
    const index = rules.length;
    ruleIds.set(schema, index);
    rules.push('');
    for (const key of Object.keys(schema)) if (!keywords.has(key)) throw new Error('Unsupported Kotlin schema keyword: ' + key);
    if (schema.format && !formats.has(schema.format)) throw new Error('Unsupported Kotlin format: ' + schema.format);
    if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') throw new Error('Kotlin additionalProperties requires an explicit supported mapping');
    if (schema.anyOf && !nullableBranch(schema) && !schema.properties) throw new Error('Unsupported Kotlin anyOf mapping');
    const options = [];
    if (schema.$ref) options.push(`reference = ${kotlinString(schema.$ref.split('/').at(-1))}`);
    if (schema.type) {
      if (typeof schema.type !== 'string' || !['object', 'array', 'string', 'integer', 'number', 'boolean', 'null'].includes(schema.type)) throw new Error('Unsupported Kotlin type');
      options.push(`kind = ${kotlinString(schema.type)}`);
    }
    if ('const' in schema) options.push(`constant = WireConstant(${kotlinLiteral(schema.const)})`);
    if (schema.enum) options.push(`choices = listOf(${schema.enum.map(value => typeof value === 'string' ? kotlinString(value) : String(value)).join(', ')})`);
    if (schema.properties) options.push(`properties = mapOf(${Object.entries(schema.properties).map(([key, child]) => `${kotlinString(key)} to ${rule(child)}`).join(', ')})`);
    if (schema.required?.length) options.push(`required = setOf(${schema.required.map(kotlinString).join(', ')})`);
    if (schema.additionalProperties !== undefined) options.push(`additionalProperties = ${schema.additionalProperties}`);
    if (schema.items) options.push(`items = ${rule(schema.items)}`);
    for (const key of ['oneOf', 'anyOf']) if (schema[key]) options.push(`${key} = listOf(${schema[key].map(rule).join(', ')})`);
    for (const key of ['minLength', 'maxLength', 'minimum', 'exclusiveMinimum', 'maximum', 'minItems', 'maxItems', 'minProperties']) if (schema[key] !== undefined) options.push(`${key} = ${schema[key]}${['minimum', 'exclusiveMinimum', 'maximum'].includes(key) && Number.isInteger(schema[key]) ? '.0' : ''}`);
    if (schema.dependentRequired) options.push(`dependentRequired = mapOf(${Object.entries(schema.dependentRequired).map(([key, dependencies]) => `${kotlinString(key)} to setOf(${dependencies.map(kotlinString).join(', ')})`).join(', ')})`);
    for (const key of ['pattern', 'format']) if (schema[key]) options.push(`${key} = ${kotlinString(schema[key])}`);
    rules[index] = `    private fun rule${index}(): ContractRule = ContractRule(${options.join(', ')})`;
    return `rule${index}()`;
  }
  const definitionEntries = [...descriptors.values()].map(descriptor => `        ${kotlinString(descriptor.name)} to ${rule(descriptor.schema)}`);
  const packageName = 'package org.nuanban.contracts\n\n';
  const modelSource = packageName + [...descriptors.values()].map(emit).join('\n\n') + `\n\nobject GeneratedContractDtos {\n    const val schemaVersion: String = ${kotlinString(version)}\n    val definitionNames: Set<String> = setOf(${topNames.map(kotlinString).join(', ')})\n    fun decode(name: String, value: Any?): WireValue = when (name) {\n${topNames.map(name => `        ${kotlinString(name)} -> ${name}.fromWire(value)`).join('\n')}\n        else -> throw ContractViolation("contract", "unknown definition")\n    }\n}\n`;
  const rulesSource = packageName + `internal object GeneratedContractRules {\n    val definitions: Map<String, ContractRule> by lazy { linkedMapOf(\n${definitionEntries.join(',\n')}\n    ) }\n${rules.join('\n')}\n}\n`;
  return new Map([
    ['packages/contracts/kotlin/src/main/kotlin/org/nuanban/contracts/ServiceDtos.generated.kt', modelSource],
    ['packages/contracts/kotlin/src/main/kotlin/org/nuanban/contracts/ContractRules.generated.kt', rulesSource],
  ]);
}
