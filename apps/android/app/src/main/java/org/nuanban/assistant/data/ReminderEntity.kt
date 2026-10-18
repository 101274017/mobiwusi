package org.nuanban.assistant.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index

@Entity(
    tableName = "reminders",
    primaryKeys = ["account_id", "instance_id"],
    indices = [
        Index(value = ["account_id", "todo_id", "schedule_version"]),
        Index(value = ["account_id", "status", "due_at_epoch_ms"]),
    ],
)
data class ReminderEntity(
    @ColumnInfo(name = "account_id") val accountId: String,
    @ColumnInfo(name = "reminder_id") val reminderId: String,
    @ColumnInfo(name = "todo_id") val todoId: String,
    @ColumnInfo(name = "instance_id") val instanceId: String,
    @ColumnInfo(name = "schedule_version") val scheduleVersion: Long,
    @ColumnInfo(name = "due_at") val dueAt: String,
    @ColumnInfo(name = "due_at_epoch_ms") val dueAtEpochMs: Long,
    @ColumnInfo(name = "timezone") val timezone: String,
    @ColumnInfo(name = "deep_link") val deepLink: String,
    @ColumnInfo(name = "repeat_rule") val repeatRule: String,
    @ColumnInfo(name = "channel") val channel: String,
    @ColumnInfo(name = "status") val status: String,
    @ColumnInfo(name = "payload_json") val payloadJson: String,
    @ColumnInfo(name = "submitted_at") val submittedAt: String? = null,
    @ColumnInfo(name = "delivered_at") val deliveredAt: String? = null,
    @ColumnInfo(name = "opened_at") val openedAt: String? = null,
    @ColumnInfo(name = "failed_at") val failedAt: String? = null,
    @ColumnInfo(name = "missed_at") val missedAt: String? = null,
    @ColumnInfo(name = "unknown_at") val unknownAt: String? = null,
    @ColumnInfo(name = "completed_at") val completedAt: String? = null,
    @ColumnInfo(name = "cancelled_at") val cancelledAt: String? = null,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String,
    @ColumnInfo(name = "click_token") val clickToken: String? = null,
)

object ReminderStatuses {
    const val SCHEDULED = "scheduled"
    const val SUBMITTED = "submitted"
    const val DELIVERED = "delivered"
    const val OPENED = "opened"
    const val CANCELLED = "cancelled"
    const val FAILED = "failed"
    const val MISSED = "missed"
    const val UNKNOWN = "unknown"
}

object ReminderReceipts {
    const val SUBMITTED = "submitted"
    const val DELIVERED = "delivered"
    const val OPENED = "opened"
    const val FAILED = "failed"
    const val MISSED = "missed"
    const val UNKNOWN = "unknown"
}
