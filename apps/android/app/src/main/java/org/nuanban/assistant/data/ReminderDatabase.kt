package org.nuanban.assistant.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [ReminderEntity::class], version = 3, exportSchema = false)
abstract class ReminderDatabase : RoomDatabase() {
    abstract fun reminderDao(): ReminderDao

    companion object {
        const val DATABASE_NAME = "nuanban-reminders.db"

        val MIGRATION_1_2: Migration = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("ALTER TABLE reminders ADD COLUMN submitted_at TEXT")
                database.execSQL("ALTER TABLE reminders ADD COLUMN delivered_at TEXT")
                database.execSQL("ALTER TABLE reminders ADD COLUMN opened_at TEXT")
                database.execSQL("ALTER TABLE reminders ADD COLUMN failed_at TEXT")
                database.execSQL("ALTER TABLE reminders ADD COLUMN missed_at TEXT")
                database.execSQL("ALTER TABLE reminders ADD COLUMN unknown_at TEXT")
                database.execSQL("ALTER TABLE reminders ADD COLUMN completed_at TEXT")
                database.execSQL("ALTER TABLE reminders ADD COLUMN cancelled_at TEXT")
            }
        }

        val MIGRATION_2_3: Migration = object : Migration(2, 3) {
            override fun migrate(database: SupportSQLiteDatabase) {
                database.execSQL("ALTER TABLE reminders ADD COLUMN click_token TEXT")
            }
        }

        fun create(context: Context, databaseName: String = DATABASE_NAME): ReminderDatabase {
            return Room.databaseBuilder(context.applicationContext, ReminderDatabase::class.java, databaseName)
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                .build()
        }
    }
}
