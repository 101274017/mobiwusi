package org.nuanban.contracts

import java.time.LocalDateTime
import java.time.ZoneId

sealed interface OptionalField<out Value> {
    data object Absent : OptionalField<Nothing>
    data class Present<Value>(val value: Value) : OptionalField<Value>
}

interface WireValue {
    fun toWire(): Any?
}

interface WireObject : WireValue {
    override fun toWire(): Map<String, Any?>
}

class ContractViolation(val location: String, val rule: String) :
    IllegalArgumentException("Contract violation at $location: $rule")

data class WireConstant(val value: Any?)

data class ContractRule(
    val reference: String? = null,
    val kind: String? = null,
    val constant: WireConstant? = null,
    val choices: List<Any?>? = null,
    val properties: Map<String, ContractRule> = emptyMap(),
    val required: Set<String> = emptySet(),
    val additionalProperties: Boolean = true,
    val items: ContractRule? = null,
    val oneOf: List<ContractRule> = emptyList(),
    val anyOf: List<ContractRule> = emptyList(),
    val minLength: Int? = null,
    val maxLength: Int? = null,
    val minimum: Double? = null,
    val exclusiveMinimum: Double? = null,
    val maximum: Double? = null,
    val minItems: Int? = null,
    val maxItems: Int? = null,
    val minProperties: Int? = null,
    val dependentRequired: Map<String, Set<String>> = emptyMap(),
    val pattern: String? = null,
    val format: String? = null
)

object ContractValidator {
    private val uuid = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE)
    private val timestamp = Regex("^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.\\d{1,9})?(Z|[+-]\\d{2}:\\d{2})$")
    private val timezoneName = Regex("^[A-Za-z_+-]+/[A-Za-z0-9_+\\-/]+$")
    private val timezoneIds by lazy { ZoneId.getAvailableZoneIds().map { it.lowercase() }.toSet() }

    fun validate(name: String, value: Any?) {
        val schema = GeneratedContractRules.definitions[name] ?: throw ContractViolation("contract", "unknown definition")
        validateRule(schema, value, name, 0)
    }

    fun accepts(name: String, value: Any?): Boolean = try {
        validate(name, value)
        true
    } catch (_: ContractViolation) {
        false
    }

    internal fun acceptsRule(schema: ContractRule, value: Any?): Boolean = try {
        validateRule(schema, value, "variant", 0)
        true
    } catch (_: ContractViolation) {
        false
    }

    private fun reject(location: String, rule: String): Nothing = throw ContractViolation(location, rule)

    private fun equalWire(left: Any?, right: Any?): Boolean =
        if (left is Number && right is Number) left.toDouble() == right.toDouble() else left == right

    private fun validTimestamp(value: String): Boolean {
        val match = timestamp.matchEntire(value) ?: return false
        return try {
            val components = match.groupValues
            LocalDateTime.of(components[1].toInt(), components[2].toInt(), components[3].toInt(), components[4].toInt(), components[5].toInt(), components[6].toInt())
            val offset = components[7]
            offset == "Z" || (offset.substring(1, 3).toInt() <= 23 && offset.substring(4).toInt() <= 59)
        } catch (_: RuntimeException) {
            false
        }
    }

    private fun validFormat(format: String, value: String): Boolean = when (format) {
        "uuid" -> uuid.matches(value)
        "date-time" -> validTimestamp(value)
        "iana-timezone" -> value == "UTC" || (timezoneName.matches(value) && value.lowercase() in timezoneIds)
        else -> false
    }

    private fun validateRule(schema: ContractRule, value: Any?, location: String, depth: Int) {
        if (depth > 64) reject(location, "maximum nesting")
        schema.reference?.let {
            val target = GeneratedContractRules.definitions[it] ?: reject(location, "unknown reference")
            validateRule(target, value, location, depth + 1)
        }
        schema.constant?.let { if (!equalWire(value, it.value)) reject(location, "constant") }
        schema.choices?.let { if (it.none { choice -> equalWire(value, choice) }) reject(location, "enum") }
        when (schema.kind) {
            "object" -> if (value !is Map<*, *> || value.keys.any { it !is String }) reject(location, "object")
            "array" -> if (value !is List<*>) reject(location, "array")
            "string" -> if (value !is String) reject(location, "string")
            "integer" -> if (value !is Number || !value.toDouble().isFinite() || value.toDouble() % 1.0 != 0.0) reject(location, "integer")
            "number" -> if (value !is Number || !value.toDouble().isFinite()) reject(location, "number")
            "boolean" -> if (value !is Boolean) reject(location, "boolean")
            "null" -> if (value != null) reject(location, "null")
            null -> Unit
            else -> reject(location, "unsupported type")
        }
        if (value is String) {
            val length = value.codePointCount(0, value.length)
            if (schema.minLength != null && length < schema.minLength) reject(location, "minLength")
            if (schema.maxLength != null && length > schema.maxLength) reject(location, "maxLength")
            if (schema.pattern != null && !Regex(schema.pattern).containsMatchIn(value)) reject(location, "pattern")
            if (schema.format != null && !validFormat(schema.format, value)) reject(location, "format")
        }
        if (value is Number) {
            val number = value.toDouble()
            if (!number.isFinite()) reject(location, "finite number")
            if (schema.minimum != null && number < schema.minimum) reject(location, "minimum")
            if (schema.exclusiveMinimum != null && number <= schema.exclusiveMinimum) reject(location, "exclusiveMinimum")
            if (schema.maximum != null && number > schema.maximum) reject(location, "maximum")
        }
        if (value is List<*>) {
            if (schema.minItems != null && value.size < schema.minItems) reject(location, "minItems")
            if (schema.maxItems != null && value.size > schema.maxItems) reject(location, "maxItems")
            schema.items?.let { child -> value.forEach { validateRule(child, it, "$location[]", depth + 1) } }
        }
        if (value is Map<*, *>) {
            if (schema.required.any { !value.containsKey(it) }) reject(location, "required")
            if (!schema.additionalProperties && value.keys.any { it !in schema.properties }) reject(location, "additionalProperties")
            if (schema.minProperties != null && value.size < schema.minProperties) reject(location, "minProperties")
            schema.dependentRequired.forEach { (key, dependencies) ->
                if (value.containsKey(key) && dependencies.any { !value.containsKey(it) }) reject(location, "dependentRequired")
            }
            schema.properties.forEach { (key, child) -> if (value.containsKey(key)) validateRule(child, value[key], "$location.$key", depth + 1) }
        }
        fun matches(child: ContractRule): Boolean = try {
            validateRule(child, value, location, depth + 1)
            true
        } catch (_: ContractViolation) {
            false
        }
        if (schema.oneOf.isNotEmpty() && schema.oneOf.count(::matches) != 1) reject(location, "oneOf")
        if (schema.anyOf.isNotEmpty() && schema.anyOf.none(::matches)) reject(location, "anyOf")
    }
}

internal fun wireObject(value: Any?): Map<String, Any?> {
    if (value !is Map<*, *> || value.keys.any { it !is String }) throw ContractViolation("value", "object")
    return value.entries.associate { (key, child) -> (key as String) to child }
}

internal fun wireEncode(value: Any?): Any? = when (value) {
    is WireValue -> value.toWire()
    is List<*> -> value.map(::wireEncode)
    is OptionalField.Present<*> -> wireEncode(value.value)
    OptionalField.Absent -> throw ContractViolation("value", "missing field cannot be encoded as null")
    else -> value
}

internal fun wireBuild(name: String, values: Map<String, Any?>): Map<String, Any?> {
    val result = values.filterValues { it != OptionalField.Absent }.mapValues { wireEncode(it.value) }
    ContractValidator.validate(name, result)
    return result
}
