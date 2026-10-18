package org.nuanban.assistant.nativehost

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.provider.Settings

object NativeCaptureRuntime {
    val session = CaptureSession()
    val gate = LocalFrameGate()
    @Volatile var lastGateReason: String = "detector_or_target_unavailable"

    fun report(context: Context): Map<String, Any?> {
        val notification = context.getSystemService(NotificationManager::class.java)
        val projection = context.getSystemService(MediaProjectionManager::class.java)
        val alarm = context.getSystemService(AlarmManager::class.java)
        val notificationPermission = Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED
        val notificationsEnabled = notification?.areNotificationsEnabled() == true
        val exactAlarm = Build.VERSION.SDK_INT < 31 || alarm?.canScheduleExactAlarms() == true
        val overlay = Settings.canDrawOverlays(context)
        val snapshot = session.snapshot()
        return mapOf(
            "externalCapture" to false,
            "nativeOverlay" to (snapshot.phase == CapturePhase.QUARANTINED && overlay),
            "remoteMedia" to false,
            "captureStatus" to if (snapshot.phase == CapturePhase.QUARANTINED) "quarantined_local_only" else "requires_explicit_system_authorization",
            "captureActive" to (snapshot.phase == CapturePhase.QUARANTINED),
            "captureGeneration" to snapshot.generation,
            "framesReleased" to snapshot.framesReleased,
            "lateFrames" to snapshot.lateFrames,
            "captureStopReason" to snapshot.stopReason?.name,
            "systemProjectionAvailable" to (projection != null),
            "notificationPermission" to if (notificationPermission) "granted" else "needs_authorization",
            "notificationsEnabled" to notificationsEnabled,
            "exactAlarm" to if (exactAlarm) "available_or_not_required" else "needs_authorization",
            "overlay" to if (overlay) "granted" else "needs_authorization",
            "gate" to "unknown_risk_blocked",
            "gateReason" to lastGateReason,
            "deviceVerified" to false,
        )
    }
}
