package org.nuanban.assistant

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import org.nuanban.assistant.data.ReminderDatabase
import org.nuanban.assistant.data.ReminderReceiptInput
import org.nuanban.assistant.data.ReminderReceipts
import org.nuanban.assistant.data.ReminderStatuses
import org.nuanban.assistant.data.RoomReminderStore
import java.time.Instant
import java.util.concurrent.Executors

class ReminderAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val instanceId = intent.getStringExtra(ReminderNotificationScheduler.EXTRA_INSTANCE_ID) ?: return
        val deepLink = intent.getStringExtra(ReminderNotificationScheduler.EXTRA_DEEP_LINK) ?: return
        val accountId = intent.getStringExtra(ReminderNotificationScheduler.EXTRA_ACCOUNT_ID) ?: return
        val reminderId = intent.getStringExtra(ReminderNotificationScheduler.EXTRA_REMINDER_ID) ?: return
        val clickToken = intent.getStringExtra(ReminderNotificationScheduler.EXTRA_CLICK_TOKEN)
        val request = AndroidReminderScheduleRequest(instanceId, 0, deepLink, accountId, reminderId, clickToken)
        if (!ReminderNotificationScheduler.isSafeReminderAlarmInput(request)) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.getNotificationChannel(ReminderNotificationScheduler.CHANNEL_ID)?.importance == NotificationManager.IMPORTANCE_NONE) return
        val pendingResult = goAsync()
        val executor = Executors.newSingleThreadExecutor()
        executor.execute {
            try {
                val observedAt = Instant.now().toString()
                val database = ReminderDatabase.create(context)
                try {
                    val store = RoomReminderStore(database)
                    val submission = store.claimDue(accountId, reminderId, observedAt, observedAt, instanceId)
                    val submitted = submission?.entity ?: return@execute
                    if (submitted.status != ReminderStatuses.SUBMITTED) return@execute
                    val submittedAt = submitted.submittedAt ?: observedAt
                    fun rollbackClaim() {
                        if (submission.claimed) {
                            runCatching {
                                store.rollbackDueSubmission(accountId, reminderId, submittedAt, Instant.now().toString())
                            }
                        }
                    }
                    if (
                        submitted.accountId != accountId ||
                        submitted.reminderId != reminderId ||
                        submitted.instanceId != instanceId ||
                        submitted.deepLink != deepLink ||
                        (clickToken != null && submitted.clickToken != clickToken)
                    ) {
                        rollbackClaim()
                        return@execute
                    }
                    val notificationClickToken = submitted.clickToken ?: run {
                        rollbackClaim()
                        return@execute
                    }
                    try {
                        showNotification(context, manager, submitted.instanceId, submitted.deepLink, submitted.accountId, submitted.reminderId, notificationClickToken)
                    } catch (_: Exception) {
                        rollbackClaim()
                        return@execute
                    }
                    runCatching {
                        store.recordReceipt(
                            ReminderReceiptInput(
                                accountId = submitted.accountId,
                                todoId = submitted.todoId,
                                instanceId = submitted.instanceId,
                                scheduleVersion = submitted.scheduleVersion,
                                state = ReminderReceipts.DELIVERED,
                                observedAt = Instant.now().toString(),
                            ),
                        )
                    }
                } finally {
                    database.close()
                }
            } catch (_: Exception) {
                Unit
            } finally {
                pendingResult.finish()
                executor.shutdown()
            }
        }
    }

    private fun showNotification(context: Context, manager: NotificationManager, instanceId: String, deepLink: String, accountId: String, reminderId: String, clickToken: String) {
        val openIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("nuanban://reminder/open/$instanceId")
            putExtra(ReminderNotificationScheduler.EXTRA_DEEP_LINK, deepLink)
            putExtra(ReminderNotificationScheduler.EXTRA_INSTANCE_ID, instanceId)
            putExtra(ReminderNotificationScheduler.EXTRA_ACCOUNT_ID, accountId)
            putExtra(ReminderNotificationScheduler.EXTRA_REMINDER_ID, reminderId)
            putExtra(ReminderNotificationScheduler.EXTRA_CLICK_TOKEN, clickToken)
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val openPendingIntent = PendingIntent.getActivity(context, instanceId.hashCode(), openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, ReminderNotificationScheduler.CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("微光指引复习提醒")
                .setContentText("打开微光指引，继续刚才确认的复习事项。")
                .setContentIntent(openPendingIntent)
                .setAutoCancel(true)
                .build()
        } else {
            Notification.Builder(context)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("微光指引复习提醒")
                .setContentText("打开微光指引，继续刚才确认的复习事项。")
                .setContentIntent(openPendingIntent)
                .setAutoCancel(true)
                .build()
        }
        manager.notify(instanceId, instanceId.hashCode(), notification)
    }
}
