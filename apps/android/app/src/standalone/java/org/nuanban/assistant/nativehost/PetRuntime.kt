package org.nuanban.assistant.nativehost

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings

object PetRuntime {
    val sessions = PetSessions()
    @Volatile var running = false
    @Volatile var inputPanelVisible = false
    private val controls = java.util.Collections.newSetFromMap(java.util.IdentityHashMap<Any, Boolean>())
    const val LOCAL_WAKE = "unavailable_no_offline_wake_engine"

    @Synchronized fun controlVisible(owner: Any, visible: Boolean) { if (visible) controls.add(owner) else controls.remove(owner) }
    @Synchronized fun localControlsVisible(): Boolean = inputPanelVisible || controls.isNotEmpty()

    fun notificationGranted(context: Context): Boolean {
        val permission = Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED
        return permission && context.getSystemService(NotificationManager::class.java).areNotificationsEnabled()
    }

    fun stopWork(context: Context, reason: String = "user_stopped") {
        sessions.stopAll(reason)
        NativeCaptureService.stopFrom(context)
    }

    fun privacyPause(context: Context, reason: String) {
        sessions.privacyPause(reason)
        NativeCaptureService.stopFrom(context)
    }

    fun status(context: Context): String {
        val snapshot = sessions.snapshot()
        return "桌宠：" + (if (running) "已驻留" else "未启动") + "；浮层：" + (if (Settings.canDrawOverlays(context)) "已授权" else "未授权") +
            "\n本地观察：" + snapshot.observation + "（代际 " + snapshot.observationGeneration + "）\n教学：" + snapshot.teaching + "（代际 " + snapshot.teachingGeneration +
            "）\n原因：" + snapshot.reason + "\n本地检测/OCR/脱敏：" + (NativeCaptureRuntime.detector?.status() ?: "未检查，不可捕获或上传") + "；覆盖有限，未知停采\n" + AndroidGuidanceRuntime.status() + "\n本机控制页/输入面板期间暂不取帧，不上传控制页。\n家属媒体：关闭\n离线语音唤醒：不可用，未接入本地库；不录音、不使用可能上云的系统ASR。"
    }
}

class PetStopReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_STOP && intent.action != ACTION_EXIT) return
        PetRuntime.stopWork(context)
        if (intent.action == ACTION_EXIT) context.stopService(Intent(context, PetRuntimeService::class.java))
    }

    companion object {
        const val ACTION_STOP = "org.nuanban.assistant.STOP_PET_WORK"
        const val ACTION_EXIT = "org.nuanban.assistant.EXIT_PET"
    }
}
