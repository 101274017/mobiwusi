package org.nuanban.contracts

import java.time.Instant

enum class ActiveBridgeMethod(val wireValue: String) {
    CAPABILITIES("capabilities"),
    STOP_ALL("stop_all"),
    REMINDER_SCHEDULE("reminder_schedule"),
    REMINDER_CANCEL("reminder_cancel"),
    REMINDER_NOTIFY_DUE("reminder_notify_due"),
}

data class ActiveBridgeReminderSchedule(val accountId: String, val reminderId: String, val todoId: String, val instanceId: String, val scheduleVersion: Long, val dueAt: String, val timezone: String, val deepLink: String, val repeatRule: String, val channel: String, val updatedAt: String)
data class ActiveBridgeReminderCancel(val accountId: String, val reminderId: String, val todoId: String, val instanceId: String, val scheduleVersion: Long, val cancelledAt: String)
data class ActiveBridgeReminderNotifyDue(val accountId: String, val reminderId: String, val now: String)

data class ActiveBridgeRequest(
    val requestId: String,
    val generation: Long,
    val method: ActiveBridgeMethod,
    val schedule: ActiveBridgeReminderSchedule? = null,
    val cancel: ActiveBridgeReminderCancel? = null,
    val notifyDue: ActiveBridgeReminderNotifyDue? = null,
) {
    init {
        if (!requestIdPattern.matches(requestId) || generation < 0 || generation > MAX_SAFE_INTEGER) throw ContractViolation("bridge", "correlation")
        when (method) {
            ActiveBridgeMethod.REMINDER_SCHEDULE -> if (schedule == null || cancel != null || notifyDue != null) throw ContractViolation("bridge", "schedule payload")
            ActiveBridgeMethod.REMINDER_CANCEL -> if (schedule != null || cancel == null || notifyDue != null) throw ContractViolation("bridge", "cancel payload")
            ActiveBridgeMethod.REMINDER_NOTIFY_DUE -> if (schedule != null || cancel != null || notifyDue == null) throw ContractViolation("bridge", "notify payload")
            else -> if (schedule != null || cancel != null || notifyDue != null) throw ContractViolation("bridge", "unexpected payload")
        }
    }
    fun correlation(): Map<String, Any?> = mapOf("request_id" to requestId, "generation" to generation)
    fun reply(): Map<String, Any?> {
        val correlation = mapOf("request_id" to requestId, "generation" to generation)
        return when (method) {
            ActiveBridgeMethod.CAPABILITIES -> correlation + mapOf("platform" to "android", "externalCapture" to false, "nativeOverlay" to false, "remoteMedia" to false, "status" to "native-skeleton")
            ActiveBridgeMethod.STOP_ALL -> correlation + mapOf("stopped" to true, "captureActive" to false)
            else -> throw ContractViolation("bridge", "reply requires host result")
        }
    }

    companion object {
        private const val MAX_SAFE_INTEGER = 9007199254740991L
        private val requestIdPattern = Regex("^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
        private val accountPattern = Regex("^[a-z0-9-]{1,64}$")
        private val identifierPattern = Regex("^[A-Za-z0-9-]{1,80}$")
        private val uuidPattern = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
        private val instantPattern = Regex("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{3})?Z$")
        private val timezonePattern = Regex("^[A-Za-z_][A-Za-z0-9_+./-]{0,63}$")
        private val deepLinkPattern = Regex("^(?:nuanban://(?:review|todo)/[A-Za-z0-9-]{1,80}|/(?:review|todos)(?:/edit)?/[A-Za-z0-9-]{1,80})$")

        fun fromWire(value: Any?): ActiveBridgeRequest {
            val fields = wireObject(value)
            val common = setOf("version", "request_id", "generation", "method")
            if (!fields.keys.containsAll(common)) throw ContractViolation("bridge", "fields")
            val version = fields["version"]
            if (version !is Number || version.toDouble() != 1.0) throw ContractViolation("bridge", "version")
            val requestId = fields["request_id"]
            if (requestId !is String || !requestIdPattern.matches(requestId)) throw ContractViolation("bridge", "request ID")
            val generation = safeInteger(fields["generation"], "generation")
            val methodValue = fields["method"]
            if (methodValue !is String) throw ContractViolation("bridge", "method")
            val method = ActiveBridgeMethod.entries.firstOrNull { it.wireValue == methodValue } ?: throw ContractViolation("bridge", "method")
            return when (method) {
                ActiveBridgeMethod.CAPABILITIES, ActiveBridgeMethod.STOP_ALL -> {
                    if (fields.keys != common) throw ContractViolation("bridge", "fields")
                    ActiveBridgeRequest(requestId, generation, method)
                }
                ActiveBridgeMethod.REMINDER_SCHEDULE -> ActiveBridgeRequest(requestId, generation, method, schedule = parseSchedule(fields))
                ActiveBridgeMethod.REMINDER_CANCEL -> ActiveBridgeRequest(requestId, generation, method, cancel = parseCancel(fields))
                ActiveBridgeMethod.REMINDER_NOTIFY_DUE -> ActiveBridgeRequest(requestId, generation, method, notifyDue = parseNotifyDue(fields))
            }
        }

        private fun parseSchedule(fields: Map<String, Any?>): ActiveBridgeReminderSchedule {
            val expected = setOf("version", "request_id", "generation", "method", "account_id", "reminder_id", "todo_id", "instance_id", "schedule_version", "due_at", "timezone", "deep_link", "repeat_rule", "channel", "payload", "updated_at")
            if (fields.keys != expected) throw ContractViolation("bridge", "schedule fields")
            val accountId = text(fields["account_id"], accountPattern, "account_id")
            val reminderId = text(fields["reminder_id"], identifierPattern, "reminder_id")
            val todoId = text(fields["todo_id"], uuidPattern, "todo_id")
            val instanceId = text(fields["instance_id"], uuidPattern, "instance_id")
            val scheduleVersion = safeInteger(fields["schedule_version"], "schedule_version")
            if (scheduleVersion < 1) throw ContractViolation("bridge", "schedule_version")
            val dueAt = timestamp(fields["due_at"], "due_at")
            val timezone = text(fields["timezone"], timezonePattern, "timezone")
            val deepLink = text(fields["deep_link"], deepLinkPattern, "deep_link")
            val repeatRule = fields["repeat_rule"] as? String ?: throw ContractViolation("bridge", "repeat_rule")
            if (repeatRule !in setOf("none", "daily", "weekly")) throw ContractViolation("bridge", "repeat_rule")
            val channel = fields["channel"] as? String ?: throw ContractViolation("bridge", "channel")
            if (channel !in setOf("local", "push")) throw ContractViolation("bridge", "channel")
            val payload = wireObject(fields["payload"])
            if (payload.keys != setOf("kind") || payload["kind"] != "review-reminder") throw ContractViolation("bridge", "payload")
            val updatedAt = timestamp(fields["updated_at"], "updated_at")
            return ActiveBridgeReminderSchedule(accountId, reminderId, todoId, instanceId, scheduleVersion, dueAt, timezone, deepLink, repeatRule, channel, updatedAt)
        }

        private fun parseCancel(fields: Map<String, Any?>): ActiveBridgeReminderCancel {
            val expected = setOf("version", "request_id", "generation", "method", "account_id", "reminder_id", "todo_id", "instance_id", "schedule_version", "cancelled_at")
            if (fields.keys != expected) throw ContractViolation("bridge", "cancel fields")
            val accountId = text(fields["account_id"], accountPattern, "account_id")
            val reminderId = text(fields["reminder_id"], identifierPattern, "reminder_id")
            val todoId = text(fields["todo_id"], uuidPattern, "todo_id")
            val instanceId = text(fields["instance_id"], uuidPattern, "instance_id")
            val scheduleVersion = safeInteger(fields["schedule_version"], "schedule_version")
            if (scheduleVersion < 1) throw ContractViolation("bridge", "schedule_version")
            val cancelledAt = timestamp(fields["cancelled_at"], "cancelled_at")
            return ActiveBridgeReminderCancel(accountId, reminderId, todoId, instanceId, scheduleVersion, cancelledAt)
        }

        private fun parseNotifyDue(fields: Map<String, Any?>): ActiveBridgeReminderNotifyDue {
            val expected = setOf("version", "request_id", "generation", "method", "account_id", "reminder_id", "now")
            if (fields.keys != expected) throw ContractViolation("bridge", "notify fields")
            val accountId = text(fields["account_id"], accountPattern, "account_id")
            val reminderId = text(fields["reminder_id"], identifierPattern, "reminder_id")
            val now = timestamp(fields["now"], "now")
            return ActiveBridgeReminderNotifyDue(accountId, reminderId, now)
        }

        private fun text(value: Any?, pattern: Regex, field: String): String = (value as? String)?.takeIf { pattern.matches(it) } ?: throw ContractViolation("bridge", field)
        private fun timestamp(value: Any?, field: String): String {
            val text = value as? String ?: throw ContractViolation("bridge", field)
            if (!instantPattern.matches(text) || runCatching { Instant.parse(text) }.isFailure) throw ContractViolation("bridge", field)
            return text
        }
        private fun safeInteger(value: Any?, field: String): Long {
            if (value !is Number || !value.toDouble().isFinite() || value.toDouble() % 1.0 != 0.0 || value.toDouble() < 0 || value.toDouble() > MAX_SAFE_INTEGER) throw ContractViolation("bridge", field)
            return value.toLong()
        }
    }
}
