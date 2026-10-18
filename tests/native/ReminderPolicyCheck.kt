package org.nuanban.nativelab

private val completed = mutableListOf<String>()

private fun scenario(name: String, verify: () -> Unit) {
    verify()
    completed += name
}

private fun environment(
    apiLevel: Int = 35,
    notificationsEnabled: Boolean? = true,
    channelEnabled: Boolean? = true,
    exactAlarmAllowed: Boolean? = true,
    backgroundSchedulerAvailable: Boolean = true,
    pageSessionActive: Boolean = false,
) = AndroidReminderEnvironment(apiLevel, notificationsEnabled, channelEnabled, exactAlarmAllowed, backgroundSchedulerAvailable, pageSessionActive)

fun main() {
    scenario("unsupported API cannot claim reminder permission") {
        check(AndroidReminderPolicy.permission(environment(apiLevel = 25)) == AndroidReminderPermission.UNSUPPORTED)
        check(AndroidReminderPolicy.capability(environment(apiLevel = 25)) == AndroidReminderCapability.UNSUPPORTED)
    }
    scenario("unknown Android 13 notification permission remains unknown") {
        val state = environment(notificationsEnabled = null)
        check(AndroidReminderPolicy.permission(state) == AndroidReminderPermission.UNKNOWN)
        check(AndroidReminderPolicy.shouldRequestNotificationPermission(state))
        check(AndroidReminderPolicy.capability(state) == AndroidReminderCapability.UNSUPPORTED)
    }
    scenario("denied notification permission blocks system scheduling") {
        val state = environment(notificationsEnabled = false)
        check(AndroidReminderPolicy.permission(state) == AndroidReminderPermission.DENIED)
        check(AndroidReminderPolicy.capability(state) == AndroidReminderCapability.UNSUPPORTED)
        check(!AndroidReminderPolicy.shouldRequestNotificationPermission(state))
    }
    scenario("disabled notification channel blocks system scheduling") {
        val state = environment(channelEnabled = false)
        check(AndroidReminderPolicy.permission(state) == AndroidReminderPermission.DENIED)
        check(AndroidReminderPolicy.capability(state) == AndroidReminderCapability.UNSUPPORTED)
    }
    scenario("granted notification without exact alarm remains non-system") {
        val state = environment(exactAlarmAllowed = false, pageSessionActive = false)
        check(AndroidReminderPolicy.permission(state) == AndroidReminderPermission.GRANTED)
        check(AndroidReminderPolicy.capability(state) == AndroidReminderCapability.UNSUPPORTED)
    }
    scenario("active page can report page-only without claiming background delivery") {
        val state = environment(exactAlarmAllowed = false, pageSessionActive = true)
        check(AndroidReminderPolicy.capability(state) == AndroidReminderCapability.PAGE_ONLY)
    }
    scenario("missing background scheduler cannot claim system capability") {
        val state = environment(backgroundSchedulerAvailable = false, pageSessionActive = false)
        check(AndroidReminderPolicy.capability(state) == AndroidReminderCapability.UNSUPPORTED)
    }
    scenario("all explicitly verified inputs are required for system capability") {
        val state = environment()
        check(AndroidReminderPolicy.permission(state) == AndroidReminderPermission.GRANTED)
        check(AndroidReminderPolicy.capability(state) == AndroidReminderCapability.SYSTEM)
        check(!AndroidReminderPolicy.shouldRequestNotificationPermission(state))
    }
    scenario("pre Android 13 does not request runtime notification permission") {
        val state = environment(apiLevel = 32, notificationsEnabled = true)
        check(!AndroidReminderPolicy.shouldRequestNotificationPermission(state))
        check(AndroidReminderPolicy.permission(state) == AndroidReminderPermission.GRANTED)
    }
    scenario("unknown channel state remains conservative") {
        val state = environment(channelEnabled = null)
        check(AndroidReminderPolicy.permission(state) == AndroidReminderPermission.UNKNOWN)
        check(AndroidReminderPolicy.capability(state) == AndroidReminderCapability.UNSUPPORTED)
    }
    println("{\"passed\":true,\"cases\":${completed.size},\"scope\":\"android-reminder-permission-policy-only\",\"deviceVerified\":false,\"systemSchedulerVerified\":false}")
}
