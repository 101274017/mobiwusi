package org.nuanban.assistant.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update

@Dao
interface ReminderDao {
    @Query("SELECT * FROM reminders WHERE account_id = :accountId AND instance_id = :instanceId LIMIT 1")
    fun findByInstance(accountId: String, instanceId: String): ReminderEntity?

    @Query("SELECT * FROM reminders WHERE account_id = :accountId AND todo_id = :todoId ORDER BY schedule_version DESC, updated_at DESC LIMIT 1")
    fun findLatestByTodo(accountId: String, todoId: String): ReminderEntity?

    @Query("SELECT * FROM reminders WHERE account_id = :accountId AND todo_id = :todoId AND schedule_version = :scheduleVersion ORDER BY instance_id LIMIT 1")
    fun findByTodoAndVersion(accountId: String, todoId: String, scheduleVersion: Long): ReminderEntity?

    @Query("SELECT * FROM reminders WHERE account_id = :accountId AND reminder_id = :reminderId ORDER BY schedule_version DESC, updated_at DESC LIMIT 1")
    fun findLatestByReminderId(accountId: String, reminderId: String): ReminderEntity?

    @Query("""
        SELECT reminder.* FROM reminders AS reminder
        WHERE reminder.account_id = :accountId
          AND reminder.status = 'scheduled'
          AND reminder.completed_at IS NULL
          AND reminder.due_at_epoch_ms <= :nowEpochMs
          AND NOT EXISTS (
              SELECT 1 FROM reminders AS newer
              WHERE newer.account_id = reminder.account_id
                AND newer.todo_id = reminder.todo_id
                AND newer.schedule_version > reminder.schedule_version
          )
        ORDER BY reminder.due_at_epoch_ms ASC, reminder.instance_id ASC
    """)
    fun listDue(accountId: String, nowEpochMs: Long): List<ReminderEntity>

    @Query("SELECT * FROM reminders WHERE account_id = :accountId ORDER BY due_at_epoch_ms ASC, instance_id ASC")
    fun list(accountId: String): List<ReminderEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun insert(entity: ReminderEntity)

    @Update
    fun update(entity: ReminderEntity)

    @Query("DELETE FROM reminders WHERE account_id = :accountId AND instance_id = :instanceId")
    fun delete(accountId: String, instanceId: String)
}
