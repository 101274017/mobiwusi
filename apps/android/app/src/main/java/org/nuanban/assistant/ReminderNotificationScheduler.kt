package org.nuanban.assistant

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings

data class AndroidReminderCapabilityReport(
    val system: Boolean,
    val notificationPermissionGranted: Boolean,
    val notificationsEnabled: Boolean,
    val channelEnabled: Boolean,
    val exactAlarmAllowed: Boolean,
    val reason: String,
)

data class AndroidReminderScheduleRequest(
    val instanceId: String,
    val dueAtEpochMs: Long,
    val deepLink: String,
    val accountId: String? = null,
    val reminderId: String? = null,
    val clickToken: String? = null,
)

data class AndroidReminderScheduleResult(
    val status: String,
    val reason: String,
)

class ReminderNotificationScheduler(context: Context) {
    private val applicationContext = context.applicationContext
    private val alarmManager = applicationContext.getSystemService(AlarmManager::class.java)
    private val notificationManager = applicationContext.getSystemService(NotificationManager::class.java)

    fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        notificationManager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "微光指引复习提醒",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "只提醒用户确认过的复习待办，不承载敏感正文。"
            },
        )
    }

    fun capability(): AndroidReminderCapabilityReport {
        ensureNotificationChannel()
        val permissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || applicationContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        val notificationsEnabled = notificationManager.areNotificationsEnabled()
        val channelEnabled = Build.VERSION.SDK_INT < Build.VERSION_CODES.O || notificationManager.getNotificationChannel(CHANNEL_ID)?.importance != NotificationManager.IMPORTANCE_NONE
        val exactAlarmAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()
        val reason = when {
            !permissionGranted -> "通知权限未授予，未向系统调度器派发。"
            !notificationsEnabled -> "系统通知总开关已关闭，未向系统调度器派发。"
            !channelEnabled -> "提醒通知渠道已关闭，未向系统调度器派发。"
            !exactAlarmAllowed -> "精确闹钟能力不可用，未向系统调度器派发。"
            else -> "通知权限、渠道和精确闹钟能力均已明确可用。"
        }
        return AndroidReminderCapabilityReport(permissionGranted && notificationsEnabled && channelEnabled && exactAlarmAllowed, permissionGranted, notificationsEnabled, channelEnabled, exactAlarmAllowed, reason)
    }

    fun requestNotificationPermission(activity: Activity): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || applicationContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return false
        activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_PERMISSION_REQUEST_CODE)
        return true
    }

    fun openExactAlarmSettings(activity: Activity): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()) return false
        activity.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${applicationContext.packageName}")))
        return true
    }

    fun schedule(request: AndroidReminderScheduleRequest): AndroidReminderScheduleResult {
        if (!isSafeReminderScheduleInput(request)) return AndroidReminderScheduleResult("unsupported", "提醒实例、点击令牌或应用内深链不符合本地校验规则。")
        val capability = capability()
        if (!capability.system) return AndroidReminderScheduleResult("unsupported", capability.reason)
        val pendingIntent = pendingIntent(request, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            ?: return AndroidReminderScheduleResult("unsupported", "系统未能创建提醒句柄，提醒未被确认调度。")
        return try {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, request.dueAtEpochMs, pendingIntent)
            AndroidReminderScheduleResult("scheduled", "已交给 Android 精确闹钟；仍需设备验证实际投递和用户看到回执。")
        } catch (_: SecurityException) {
            AndroidReminderScheduleResult("unsupported", "系统拒绝精确闹钟调用，提醒未被确认调度。")
        }
    }

    fun cancel(request: AndroidReminderScheduleRequest): AndroidReminderScheduleResult {
        if (!isSafeReminderInput(request)) return AndroidReminderScheduleResult("unsupported", "提醒实例或应用内深链不符合本地校验规则。")
        val pendingIntent = pendingIntent(request, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)
        pendingIntent?.let {
            alarmManager.cancel(it)
            it.cancel()
        }
        return AndroidReminderScheduleResult("cancelled", "已取消本地闹钟句柄；通知展示和回执仍需设备验证。")
    }

    private fun pendingIntent(request: AndroidReminderScheduleRequest, flags: Int): PendingIntent? {
        val intent = Intent(applicationContext, ReminderAlarmReceiver::class.java).apply {
            action = ACTION_REMINDER
            data = Uri.parse("nuanban://reminder/${request.instanceId}")
            putExtra(EXTRA_INSTANCE_ID, request.instanceId)
            putExtra(EXTRA_DEEP_LINK, request.deepLink)
            putExtra(EXTRA_ACCOUNT_ID, request.accountId)
            putExtra(EXTRA_REMINDER_ID, request.reminderId)
            putExtra(EXTRA_CLICK_TOKEN, request.clickToken)
        }
        return PendingIntent.getBroadcast(applicationContext, request.instanceId.hashCode(), intent, flags)
    }

    companion object {
        const val CHANNEL_ID = "nuanban.reminders"
        const val ACTION_REMINDER = "org.nuanban.assistant.action.REMINDER"
        const val EXTRA_INSTANCE_ID = "org.nuanban.assistant.extra.INSTANCE_ID"
        const val EXTRA_DEEP_LINK = "org.nuanban.assistant.extra.DEEP_LINK"
        const val EXTRA_ACCOUNT_ID = "org.nuanban.assistant.extra.ACCOUNT_ID"
        const val EXTRA_REMINDER_ID = "org.nuanban.assistant.extra.REMINDER_ID"
        const val EXTRA_CLICK_TOKEN = "org.nuanban.assistant.extra.CLICK_TOKEN"
        const val NOTIFICATION_PERMISSION_REQUEST_CODE = 4101

        fun isSafeReminderInput(request: AndroidReminderScheduleRequest): Boolean {
            return request.instanceId.matches(UUID_PATTERN) && request.deepLink.matches(DEEP_LINK_PATTERN) && request.dueAtEpochMs >= 0
        }

        fun isSafeReminderScheduleInput(request: AndroidReminderScheduleRequest): Boolean {
            return isSafeReminderInput(request) &&
                request.accountId?.matches(ACCOUNT_PATTERN) == true &&
                request.reminderId?.matches(IDENTIFIER_PATTERN) == true &&
                request.clickToken?.matches(CLICK_TOKEN_PATTERN) == true
        }

        fun isSafeReminderAlarmInput(request: AndroidReminderScheduleRequest): Boolean {
            return isSafeReminderInput(request) &&
                request.accountId?.matches(ACCOUNT_PATTERN) == true &&
                request.reminderId?.matches(IDENTIFIER_PATTERN) == true &&
                (request.clickToken == null || request.clickToken.matches(CLICK_TOKEN_PATTERN))
        }

        fun isSafeReminderOpenInput(accountId: String, reminderId: String, instanceId: String, deepLink: String, clickToken: String?): Boolean {
            return accountId.matches(ACCOUNT_PATTERN) &&
                reminderId.matches(IDENTIFIER_PATTERN) &&
                instanceId.matches(UUID_PATTERN) &&
                deepLink.matches(DEEP_LINK_PATTERN) &&
                clickToken?.matches(CLICK_TOKEN_PATTERN) == true
        }

        private val UUID_PATTERN = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
        private val ACCOUNT_PATTERN = Regex("^[a-z0-9-]{1,64}$")
        private val IDENTIFIER_PATTERN = Regex("^[a-zA-Z0-9-]{1,80}$")
        private val CLICK_TOKEN_PATTERN = UUID_PATTERN
        private val DEEP_LINK_PATTERN = Regex("^(?:nuanban://(?:review|todo)/[a-zA-Z0-9-]{1,80}|/(?:review|todos)(?:/edit)?/[a-zA-Z0-9-]{1,80})$")
    }
}
