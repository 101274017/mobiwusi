package org.nuanban.nativelab

enum class AndroidReminderCapability { SYSTEM, PAGE_ONLY, UNSUPPORTED }

enum class AndroidReminderPermission { UNKNOWN, GRANTED, DENIED, UNSUPPORTED }

data class AndroidReminderEnvironment(
    val apiLevel: Int,
    val notificationsEnabled: Boolean?,
    val channelEnabled: Boolean?,
    val exactAlarmAllowed: Boolean?,
    val backgroundSchedulerAvailable: Boolean,
    val pageSessionActive: Boolean,
)

object AndroidReminderPolicy {
    fun permission(environment: AndroidReminderEnvironment): AndroidReminderPermission {
        if (environment.apiLevel < 26) return AndroidReminderPermission.UNSUPPORTED
        if (environment.notificationsEnabled == false || environment.channelEnabled == false) return AndroidReminderPermission.DENIED
        if (environment.notificationsEnabled == null || environment.channelEnabled == null) return AndroidReminderPermission.UNKNOWN
        return AndroidReminderPermission.GRANTED
    }

    fun capability(environment: AndroidReminderEnvironment): AndroidReminderCapability {
        if (permission(environment) != AndroidReminderPermission.GRANTED) return AndroidReminderCapability.UNSUPPORTED
        if (environment.backgroundSchedulerAvailable && environment.exactAlarmAllowed == true) return AndroidReminderCapability.SYSTEM
        if (environment.pageSessionActive) return AndroidReminderCapability.PAGE_ONLY
        return AndroidReminderCapability.UNSUPPORTED
    }

    fun shouldRequestNotificationPermission(environment: AndroidReminderEnvironment): Boolean {
        return environment.apiLevel >= 33 && environment.notificationsEnabled == null
    }
}
