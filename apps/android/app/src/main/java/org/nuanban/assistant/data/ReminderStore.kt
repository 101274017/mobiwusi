package org.nuanban.assistant.data

import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.time.temporal.ChronoField
import java.util.UUID
import java.util.concurrent.Callable

data class ReminderScheduleInput(
    val accountId: String,
    val reminderId: String,
    val todoId: String,
    val instanceId: String,
    val scheduleVersion: Long,
    val dueAt: String,
    val timezone: String,
    val deepLink: String,
    val repeatRule: String = "none",
    val channel: String = "local",
    val payloadJson: String = "{}",
    val updatedAt: String,
)

data class ReminderReceiptInput(
    val accountId: String,
    val todoId: String,
    val instanceId: String,
    val scheduleVersion: Long,
    val state: String,
    val observedAt: String,
)

data class ReminderCompletionInput(
    val accountId: String,
    val todoId: String,
    val instanceId: String,
    val scheduleVersion: Long,
    val completedAt: String,
)

data class ReminderCancelInput(
    val accountId: String,
    val todoId: String,
    val instanceId: String,
    val scheduleVersion: Long,
    val cancelledAt: String,
)

data class ReminderScheduleResult(val entity: ReminderEntity, val idempotent: Boolean, val replacedEntity: ReminderEntity? = null)
data class ReminderDueSubmission(val entity: ReminderEntity, val claimed: Boolean)

enum class ReminderStoreErrorCode {
    INVALID_INPUT,
    STALE_SCHEDULE,
    SCHEDULE_CONFLICT,
    INVALID_TRANSITION,
    NOT_FOUND,
}

class ReminderStoreException(
    val code: ReminderStoreErrorCode,
    message: String,
) : IllegalStateException(message)

class RoomReminderStore(
    private val database: ReminderDatabase,
) {
    private val dao: ReminderDao = database.reminderDao()

    fun schedule(input: ReminderScheduleInput): ReminderScheduleResult {
        val normalized = normalizeSchedule(input)
        return database.runInTransaction(Callable {
            val latest = dao.findLatestByTodo(normalized.accountId, normalized.todoId)
            if (latest != null && normalized.scheduleVersion < latest.scheduleVersion) {
                fail(ReminderStoreErrorCode.STALE_SCHEDULE, "旧排程版本不能覆盖较新的提醒。")
            }
            val sameVersion = dao.findByTodoAndVersion(normalized.accountId, normalized.todoId, normalized.scheduleVersion)
            if (sameVersion != null) {
                if (scheduleFingerprint(sameVersion) != scheduleFingerprint(normalized)) {
                    fail(ReminderStoreErrorCode.SCHEDULE_CONFLICT, "同一排程版本的内容不一致，拒绝静默覆盖。")
                }
                val repaired = if (sameVersion.clickToken == null) {
                    sameVersion.copy(clickToken = newClickToken(), updatedAt = normalized.updatedAt).also(dao::update)
                } else {
                    sameVersion
                }
                return@Callable ReminderScheduleResult(repaired, true)
            }
            val existingInstance = dao.findByInstance(normalized.accountId, normalized.instanceId)
            if (existingInstance != null && existingInstance.scheduleVersion >= normalized.scheduleVersion) {
                fail(ReminderStoreErrorCode.SCHEDULE_CONFLICT, "提醒实例已存在但排程版本不一致。")
            }
            val entity = normalized.toEntity(
                createdAt = existingInstance?.createdAt ?: normalized.updatedAt,
                clickToken = newClickToken(),
            )
            dao.insert(entity)
            ReminderScheduleResult(entity, false, latest?.takeIf { it.scheduleVersion < normalized.scheduleVersion })
        })
    }

    fun list(accountId: String): List<ReminderEntity> {
        validateAccountId(accountId)
        return dao.list(accountId)
    }

    fun listDue(accountId: String, now: String): List<ReminderEntity> {
        validateAccountId(accountId)
        return dao.listDue(accountId, normalizeTimestamp(now, "now").epochMillis)
    }

    fun submitDue(accountId: String, now: String, observedAt: String): List<ReminderEntity> {
        validateAccountId(accountId)
        val nowTimestamp = normalizeTimestamp(now, "now")
        val observed = normalizeTimestamp(observedAt, "observedAt")
        return database.runInTransaction(Callable {
            dao.listDue(accountId, nowTimestamp.epochMillis).map { current ->
                val next = current.copy(
                    status = ReminderStatuses.SUBMITTED,
                    submittedAt = observed.canonical,
                    updatedAt = observed.canonical,
                )
                dao.update(next)
                next
            }
        })
    }

    fun submitDue(accountId: String, reminderId: String, now: String, observedAt: String, instanceId: String? = null): ReminderEntity? {
        return claimDue(accountId, reminderId, now, observedAt, instanceId)?.entity
    }

    fun claimDue(accountId: String, reminderId: String, now: String, observedAt: String, instanceId: String? = null): ReminderDueSubmission? {
        validateAccountId(accountId)
        validateIdentifier(reminderId, "reminderId")
        instanceId?.let { validateUuid(it, "instanceId") }
        val nowTimestamp = normalizeTimestamp(now, "now")
        val observed = normalizeTimestamp(observedAt, "observedAt")
        return database.runInTransaction(Callable {
            val existing = dao.findLatestByReminderId(accountId, reminderId)
            if (instanceId != null && existing != null && existing.instanceId != instanceId) return@Callable null
            if (existing != null && existing.status in setOf(ReminderStatuses.SUBMITTED, ReminderStatuses.DELIVERED, ReminderStatuses.OPENED) && existing.submittedAt != null) {
                return@Callable ReminderDueSubmission(existing, false)
            }
            val current = dao.listDue(accountId, nowTimestamp.epochMillis).firstOrNull {
                it.reminderId == reminderId && (instanceId == null || it.instanceId == instanceId)
            } ?: return@Callable null
            val next = current.copy(
                status = ReminderStatuses.SUBMITTED,
                submittedAt = current.submittedAt ?: observed.canonical,
                updatedAt = observed.canonical,
                clickToken = current.clickToken ?: newClickToken(),
            )
            dao.update(next)
            ReminderDueSubmission(next, true)
        })
    }

    fun rollbackDueSubmission(accountId: String, reminderId: String, submittedAt: String, updatedAt: String): ReminderEntity? {
        validateAccountId(accountId)
        validateIdentifier(reminderId, "reminderId")
        val submitted = normalizeTimestamp(submittedAt, "submittedAt")
        val updated = normalizeTimestamp(updatedAt, "updatedAt")
        return database.runInTransaction(Callable {
            val current = dao.findLatestByReminderId(accountId, reminderId)
                ?: return@Callable null
            if (current.status != ReminderStatuses.SUBMITTED || current.submittedAt != submitted.canonical) return@Callable null
            val next = current.copy(
                status = ReminderStatuses.SCHEDULED,
                submittedAt = null,
                updatedAt = updated.canonical,
            )
            dao.update(next)
            next
        })
    }

    fun recordReceipt(input: ReminderReceiptInput): ReminderEntity {
        validateAccountId(input.accountId)
        val observed = normalizeTimestamp(input.observedAt, "observedAt")
        validateTodoAndVersion(input.todoId, input.instanceId, input.scheduleVersion)
        if (input.state !in setOf(ReminderReceipts.SUBMITTED, ReminderReceipts.DELIVERED, ReminderReceipts.OPENED, ReminderReceipts.FAILED, ReminderReceipts.MISSED, ReminderReceipts.UNKNOWN)) {
            fail(ReminderStoreErrorCode.INVALID_INPUT, "不支持的提醒回执状态。")
        }
        return database.runInTransaction(Callable {
            val current = requireCurrent(input.accountId, input.todoId, input.instanceId, input.scheduleVersion)
            if (current.completedAt != null || current.status == ReminderStatuses.CANCELLED) {
                fail(ReminderStoreErrorCode.INVALID_TRANSITION, "已取消或完成的提醒不能继续写入回执。")
            }
            assertReceiptOrder(current, observed.epochMillis)
            if (input.state == current.status) return@Callable current
            if (current.status in setOf(ReminderStatuses.FAILED, ReminderStatuses.MISSED, ReminderStatuses.UNKNOWN, ReminderStatuses.OPENED)) {
                fail(ReminderStoreErrorCode.INVALID_TRANSITION, "终止回执不能被后续状态覆盖。")
            }
            when (input.state) {
                ReminderReceipts.SUBMITTED -> if (current.status != ReminderStatuses.SCHEDULED) fail(ReminderStoreErrorCode.INVALID_TRANSITION, "submitted 只能从 scheduled 产生。")
                ReminderReceipts.DELIVERED -> if (current.status != ReminderStatuses.SUBMITTED) fail(ReminderStoreErrorCode.INVALID_TRANSITION, "delivered 必须先有 submitted。")
                ReminderReceipts.OPENED -> if (current.status != ReminderStatuses.DELIVERED) fail(ReminderStoreErrorCode.INVALID_TRANSITION, "opened 必须先有 delivered。")
            }
            val next = current.withReceipt(input.state, observed.canonical)
            dao.update(next)
            next
        })
    }

    fun complete(input: ReminderCompletionInput): ReminderEntity {
        validateAccountId(input.accountId)
        val completed = normalizeTimestamp(input.completedAt, "completedAt")
        validateTodoAndVersion(input.todoId, input.instanceId, input.scheduleVersion)
        return database.runInTransaction(Callable {
            val current = requireCurrent(input.accountId, input.todoId, input.instanceId, input.scheduleVersion)
            if (current.status in setOf(ReminderStatuses.CANCELLED, ReminderStatuses.FAILED, ReminderStatuses.MISSED, ReminderStatuses.UNKNOWN)) {
                fail(ReminderStoreErrorCode.INVALID_TRANSITION, "取消、失败或未知提醒不能标记为完成。")
            }
            if (current.completedAt != null) return@Callable current
            val next = current.copy(completedAt = completed.canonical, updatedAt = completed.canonical)
            dao.update(next)
            next
        })
    }

    fun cancel(input: ReminderCancelInput): ReminderEntity {
        validateAccountId(input.accountId)
        val cancelled = normalizeTimestamp(input.cancelledAt, "cancelledAt")
        validateTodoAndVersion(input.todoId, input.instanceId, input.scheduleVersion)
        return database.runInTransaction(Callable {
            val current = requireCurrent(input.accountId, input.todoId, input.instanceId, input.scheduleVersion)
            if (current.status == ReminderStatuses.CANCELLED) return@Callable current
            if (current.completedAt != null) fail(ReminderStoreErrorCode.INVALID_TRANSITION, "已完成的提醒不能再次取消。")
            if (current.status != ReminderStatuses.SCHEDULED) fail(ReminderStoreErrorCode.INVALID_TRANSITION, "只有尚未发出的提醒可以取消。")
            val next = current.copy(status = ReminderStatuses.CANCELLED, cancelledAt = cancelled.canonical, updatedAt = cancelled.canonical)
            dao.update(next)
            next
        })
    }

    private fun requireCurrent(accountId: String, todoId: String, instanceId: String, scheduleVersion: Long): ReminderEntity {
        val current = dao.findByInstance(accountId, instanceId)
            ?: fail(ReminderStoreErrorCode.NOT_FOUND, "提醒实例不存在。")
        val latest = dao.findLatestByTodo(accountId, todoId)
        if (current.todoId != todoId || current.scheduleVersion != scheduleVersion || latest?.instanceId != current.instanceId || latest.scheduleVersion != scheduleVersion) {
            fail(ReminderStoreErrorCode.STALE_SCHEDULE, "提醒回执的排程版本已过期。")
        }
        return current
    }
}

private data class NormalizedSchedule(
    val accountId: String,
    val reminderId: String,
    val todoId: String,
    val instanceId: String,
    val scheduleVersion: Long,
    val dueAt: String,
    val dueAtEpochMs: Long,
    val timezone: String,
    val deepLink: String,
    val repeatRule: String,
    val channel: String,
    val payloadJson: String,
    val updatedAt: String,
) {
    fun toEntity(createdAt: String, clickToken: String): ReminderEntity = ReminderEntity(
        accountId = accountId,
        reminderId = reminderId,
        todoId = todoId,
        instanceId = instanceId,
        scheduleVersion = scheduleVersion,
        dueAt = dueAt,
        dueAtEpochMs = dueAtEpochMs,
        timezone = timezone,
        deepLink = deepLink,
        repeatRule = repeatRule,
        channel = channel,
        status = ReminderStatuses.SCHEDULED,
        payloadJson = payloadJson,
        createdAt = createdAt,
        updatedAt = updatedAt,
        clickToken = clickToken,
    )
}

private data class NormalizedTimestamp(val canonical: String, val epochMillis: Long)

private val timestampFormatter: DateTimeFormatter = DateTimeFormatterBuilder()
    .appendPattern("yyyy-MM-dd'T'HH:mm:ss")
    .appendFraction(ChronoField.NANO_OF_SECOND, 3, 3, true)
    .appendLiteral('Z')
    .toFormatter()
    .withZone(ZoneOffset.UTC)

private val accountPattern = Regex("^[a-z0-9-]{1,64}$")
private val identifierPattern = Regex("^[a-zA-Z0-9-]{1,80}$")
private val uuidPattern = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
private val deepLinkPattern = Regex("^(?:nuanban://(?:review|todo)/[a-zA-Z0-9-]{1,80}|/(?:review|todos)(?:/edit)?/[a-zA-Z0-9-]{1,80})$")

private fun newClickToken(): String = UUID.randomUUID().toString()

private fun normalizeSchedule(input: ReminderScheduleInput): NormalizedSchedule {
    validateAccountId(input.accountId)
    validateIdentifier(input.reminderId, "reminderId")
    validateUuid(input.todoId, "todoId")
    validateUuid(input.instanceId, "instanceId")
    if (input.scheduleVersion < 1) fail(ReminderStoreErrorCode.INVALID_INPUT, "scheduleVersion 必须从 1 开始。")
    val dueAt = normalizeTimestamp(input.dueAt, "dueAt")
    val updatedAt = normalizeTimestamp(input.updatedAt, "updatedAt")
    runCatching { ZoneId.of(input.timezone) }.getOrElse { fail(ReminderStoreErrorCode.INVALID_INPUT, "timezone 必须是有效的 IANA 时区。") }
    if (input.repeatRule !in setOf("none", "daily", "weekly")) fail(ReminderStoreErrorCode.INVALID_INPUT, "repeatRule 不受支持。")
    if (input.channel !in setOf("local", "push")) fail(ReminderStoreErrorCode.INVALID_INPUT, "channel 不受支持。")
    if (!deepLinkPattern.matches(input.deepLink)) fail(ReminderStoreErrorCode.INVALID_INPUT, "deepLink 必须是应用内路径。")
    if (input.payloadJson.length > 8192 || input.payloadJson.contains('\u0000')) fail(ReminderStoreErrorCode.INVALID_INPUT, "payloadJson 超出本地提醒允许范围。")
    val expectedInstance = deriveReminderInstanceId(input.todoId, input.scheduleVersion, dueAt.canonical)
    if (expectedInstance != input.instanceId) fail(ReminderStoreErrorCode.INVALID_INPUT, "instanceId 必须由 todoId、scheduleVersion 和 dueAt 稳定生成。")
    return NormalizedSchedule(input.accountId, input.reminderId, input.todoId, input.instanceId, input.scheduleVersion, dueAt.canonical, dueAt.epochMillis, input.timezone, input.deepLink, input.repeatRule, input.channel, input.payloadJson, updatedAt.canonical)
}

private fun scheduleFingerprint(entity: ReminderEntity): String = listOf(entity.todoId, entity.instanceId, entity.scheduleVersion, entity.dueAt, entity.timezone, entity.deepLink, entity.repeatRule, entity.channel, entity.payloadJson).joinToString("\u001f")

private fun scheduleFingerprint(schedule: NormalizedSchedule): String = listOf(schedule.todoId, schedule.instanceId, schedule.scheduleVersion, schedule.dueAt, schedule.timezone, schedule.deepLink, schedule.repeatRule, schedule.channel, schedule.payloadJson).joinToString("\u001f")

private fun ReminderEntity.withReceipt(state: String, observedAt: String): ReminderEntity = when (state) {
    ReminderReceipts.SUBMITTED -> copy(status = ReminderStatuses.SUBMITTED, submittedAt = observedAt, updatedAt = observedAt)
    ReminderReceipts.DELIVERED -> copy(status = ReminderStatuses.DELIVERED, deliveredAt = observedAt, updatedAt = observedAt)
    ReminderReceipts.OPENED -> copy(status = ReminderStatuses.OPENED, openedAt = observedAt, updatedAt = observedAt)
    ReminderReceipts.FAILED -> copy(status = ReminderStatuses.FAILED, failedAt = observedAt, updatedAt = observedAt)
    ReminderReceipts.MISSED -> copy(status = ReminderStatuses.MISSED, missedAt = observedAt, updatedAt = observedAt)
    ReminderReceipts.UNKNOWN -> copy(status = ReminderStatuses.UNKNOWN, unknownAt = observedAt, updatedAt = observedAt)
    else -> fail(ReminderStoreErrorCode.INVALID_INPUT, "不支持的提醒回执状态。")
}

private fun assertReceiptOrder(entity: ReminderEntity, observedAtEpochMs: Long) {
    val latest = listOfNotNull(entity.submittedAt, entity.deliveredAt, entity.openedAt, entity.failedAt, entity.missedAt, entity.unknownAt).mapNotNull { parseTimestamp(it)?.epochMillis }.maxOrNull()
    if (latest != null && observedAtEpochMs < latest) fail(ReminderStoreErrorCode.INVALID_TRANSITION, "回执时间不能早于已记录的回执。")
}

private fun validateAccountId(accountId: String) {
    if (!accountPattern.matches(accountId)) fail(ReminderStoreErrorCode.INVALID_INPUT, "accountId 不符合本地账号命名空间规则。")
}

private fun validateIdentifier(value: String, field: String) {
    if (!identifierPattern.matches(value)) fail(ReminderStoreErrorCode.INVALID_INPUT, "$field 不符合本地标识规则。")
}

private fun validateUuid(value: String, field: String) {
    if (!uuidPattern.matches(value)) fail(ReminderStoreErrorCode.INVALID_INPUT, "$field 必须是 UUID。")
}

private fun validateTodoAndVersion(todoId: String, instanceId: String, scheduleVersion: Long) {
    validateUuid(todoId, "todoId")
    validateUuid(instanceId, "instanceId")
    if (scheduleVersion < 1) fail(ReminderStoreErrorCode.INVALID_INPUT, "scheduleVersion 必须从 1 开始。")
}

private fun normalizeTimestamp(value: String, field: String): NormalizedTimestamp = parseTimestamp(value)
    ?: fail(ReminderStoreErrorCode.INVALID_INPUT, "$field 必须是有效的 RFC3339 时间。")

private fun parseTimestamp(value: String): NormalizedTimestamp? {
    val instant = runCatching { Instant.parse(value) }.getOrNull() ?: return null
    return NormalizedTimestamp(timestampFormatter.format(instant), instant.toEpochMilli())
}

private fun deriveReminderInstanceId(todoId: String, scheduleVersion: Long, dueAt: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest("nuanban:reminder:$todoId:$scheduleVersion:$dueAt".toByteArray(Charsets.UTF_8)).copyOf(16)
    digest[6] = ((digest[6].toInt() and 0x0f) or 0x50).toByte()
    digest[8] = ((digest[8].toInt() and 0x3f) or 0x80).toByte()
    val hex = digest.joinToString("") { "%02x".format(it.toInt() and 0xff) }
    return UUID.fromString("${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}").toString()
}

private fun fail(code: ReminderStoreErrorCode, message: String): Nothing = throw ReminderStoreException(code, message)
