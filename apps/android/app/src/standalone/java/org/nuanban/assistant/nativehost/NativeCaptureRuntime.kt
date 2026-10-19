package org.nuanban.assistant.nativehost

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.provider.Settings

object NativeCaptureRuntime {
    val session = CaptureSession()
    @Volatile var detector: AndroidLocalScreenDetector? = null
        private set
    val gate = LocalFrameGate(AndroidScreenPolicy.MODEL_FINGERPRINT, detectorVerifier = { detector?.ready() == true })
    @Volatile var latestFrame: LocallySanitizedFrame? = null
        private set
    @Volatile var lastGateReason: String = "detector_or_target_unavailable"
    @Volatile var petOwnedCapture = false

    @Synchronized fun prepareDetector(context: Context, completed: (Boolean) -> Unit) {
        val local = detector ?: AndroidLocalScreenDetector(context.applicationContext).also { detector = it }
        local.prepare(completed)
    }

    @Synchronized fun acceptFrame(frame: LocallySanitizedFrame): Boolean {
        val local = detector ?: return false
        val snapshot = session.snapshot()
        if (!local.isAdmitted(frame, android.os.SystemClock.elapsedRealtime()) || snapshot.phase != CapturePhase.QUARANTINED || snapshot.generation != frame.identity.generation) { local.release(frame); return false }
        val previous = latestFrame
        latestFrame = frame
        local.release(previous)
        return true
    }

    @Synchronized fun clearFrames() { latestFrame = null; detector?.clear() }

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
            "gate" to if (gate.detectorReady()) "verified_local_detector_fail_closed" else "unknown_risk_blocked",
            "localDetector" to (detector?.status() ?: "not_initialized"),
            "gateReason" to lastGateReason,
            "deviceVerified" to false,
        )
    }
}
