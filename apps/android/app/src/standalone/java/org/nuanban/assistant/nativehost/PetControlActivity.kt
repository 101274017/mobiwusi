package org.nuanban.assistant.nativehost

import android.app.Activity
import android.app.KeyguardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.nuanban.assistant.MainActivity

class PetControlActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var consent: CheckBox
    private lateinit var cloudConsent: CheckBox
    private var pendingPet: PetObservationTicket? = null
    private var pendingCapture: CaptureTicket? = null
    private var startAfterNotification = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
        if (Build.VERSION.SDK_INT >= 31) window.setHideOverlayWindows(true)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(28, 24, 28, 24) }
        fun label(value: String) { root.addView(TextView(this).apply { text = value; textSize = 18f; setPadding(0, 12, 0, 12) }) }
        fun button(value: String, action: () -> Unit) { root.addView(Button(this).apply { text = value; filterTouchesWhenObscured = true; setOnClickListener { action() } }) }
        label("微光指引 · 独立桌宠控制")
        label("启动桌宠不会抓屏或录音。管理界面关闭不退出桌宠；屏幕观察须本人当次同意和 Android 系统授权。系统杀进程、撤权或隐私暂停后不自动恢复。")
        status = TextView(this).also { root.addView(it) }
        button("打开悬浮窗授权") { startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + packageName))) }
        button("启动独立桌宠（不采集）") { requestPet() }
        button("检查本地 OCR 与隐私模型（不抓屏）") {
            status.text = "正在校验随包模型并用内存合成图预热；没有读取屏幕。"
            NativeCaptureRuntime.prepareDetector(this) { success -> runOnUiThread { if (!isFinishing && !isDestroyed) { render(); if (!success) status.append("\n本地检测未就绪，观察仍关闭。") } } }
        }
        consent = CheckBox(this).apply {
            text = "我是本人，同意本次在本机观察屏幕；风险或未知时立即停采，恢复需要我再次授权。"
            isSaveEnabled = false
            filterTouchesWhenObscured = true
        }.also { root.addView(it) }
        cloudConsent = CheckBox(this).apply {
            text = "可选：我是本人，同意本次在提问、页面变化或核验时，将已脱敏必要画面送往我配置的微光指引服务；不连续上传。"
            isSaveEnabled = false
            filterTouchesWhenObscured = true
        }.also { root.addView(it) }
        button("本人开启观察 / 继续共享") { requestObservation() }
        button("停止本次教学（保留已授权观察）") { AndroidGuidanceRuntime.finishTeaching(); render() }
        button("立即停止观察与教学") { PetRuntime.stopWork(this); render() }
        button("打开管理界面") { startActivity(Intent(this, MainActivity::class.java)) }
        button("配置真实教学服务（不采集）") { startActivity(Intent(this, GuidanceConnectionActivity::class.java)) }
        button("关闭控制页，保留桌宠") { finish() }
        button("退出桌宠并清理") { PetRuntime.stopWork(this, "user_exited"); stopService(Intent(this, PetRuntimeService::class.java)); render() }
        setContentView(ScrollView(this).apply { addView(root, ViewGroup.LayoutParams(-1, -2)) })
        render()
    }

    private fun requestPet() {
        if (!Settings.canDrawOverlays(this)) { status.text = "请本人先授予悬浮窗权限，再点击启动；未自动申请。"; return }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            startAfterNotification = true
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
            return
        }
        if (!PetRuntime.notificationGranted(this)) { status.text = "停止通知不可用，桌宠未启动。"; return }
        try { startForegroundService(Intent(this, PetRuntimeService::class.java).setAction(PetRuntimeService.ACTION_START)) }
        catch (_: Exception) { status.text = "系统不允许当前条件下启动前台桌宠；未绕过限制。"; return }
        status.text = "已请求启动原生桌宠；未开启观察或录音。"
    }

    private fun requestObservation() {
        val nativeConsent = consent.isChecked
        val nativeCloudConsent = cloudConsent.isChecked
        consent.isChecked = false
        cloudConsent.isChecked = false
        if (!PetRuntime.running) { status.text = "请先启动桌宠；没有启动任何采集。"; return }
        if (getSystemService(KeyguardManager::class.java).isKeyguardLocked) { PetRuntime.privacyPause(this, "device_locked"); render(); return }
        val petTicket = PetRuntime.sessions.requestObservation(nativeConsent, Settings.canDrawOverlays(this), PetRuntime.notificationGranted(this), NativeCaptureRuntime.gate.detectorReady(), nativeCloudConsent)
        if (petTicket == null) { render(); return }
        val captureTicket = NativeCaptureRuntime.session.requestConsent()
        if (captureTicket == null) { PetRuntime.sessions.captureStopped(petTicket, "capture_cleanup_pending", true); render(); return }
        pendingPet = petTicket
        pendingCapture = captureTicket
        try { startActivityForResult(getSystemService(MediaProjectionManager::class.java).createScreenCaptureIntent(), REQUEST_CAPTURE) }
        catch (_: Exception) { cancelPending("system_authorization_unavailable"); render() }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_NOTIFICATIONS || !startAfterNotification) return
        startAfterNotification = false
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) requestPet()
        else { status.text = "通知授权被拒绝；桌宠未启动。" }
    }

    @Deprecated("Activity result bridge for the current minimum SDK")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_CAPTURE) return
        val petTicket = pendingPet ?: return
        val captureTicket = pendingCapture ?: return
        pendingPet = null
        pendingCapture = null
        val granted = resultCode == RESULT_OK && data != null
        val petGranted = PetRuntime.sessions.resolveConsent(petTicket, granted)
        val captureGranted = NativeCaptureRuntime.session.resolveConsent(captureTicket, granted && petGranted)
        if (!petGranted || !captureGranted || data == null) {
            PetRuntime.sessions.captureStopped(petTicket, "system_authorization_denied_or_stale", true)
            render()
            return
        }
        val intent = Intent(this, NativeCaptureService::class.java).setAction(NativeCaptureService.ACTION_START)
            .putExtra(NativeCaptureService.EXTRA_GENERATION, captureTicket.generation)
            .putExtra(NativeCaptureService.EXTRA_NONCE, captureTicket.nonce)
            .putExtra(NativeCaptureService.EXTRA_PROJECTION_RESULT, data)
            .putExtra(NativeCaptureService.EXTRA_PET_GENERATION, petTicket.generation)
            .putExtra(NativeCaptureService.EXTRA_PET_NONCE, petTicket.nonce)
        try { startForegroundService(intent); finish() } catch (_: Exception) { PetRuntime.privacyPause(this, "foreground_capture_start_denied") }
        render()
    }

    private fun cancelPending(reason: String) {
        pendingPet?.let { PetRuntime.sessions.captureStopped(it, reason, true) }
        pendingCapture?.let { NativeCaptureRuntime.session.resolveConsent(it, false) }
        pendingPet = null
        pendingCapture = null
    }

    override fun onResume() { super.onResume(); PetRuntime.controlVisible(this, true); AndroidGuidanceRuntime.pauseForControls(); if (::status.isInitialized) render() }
    override fun onPause() { PetRuntime.controlVisible(this, false); super.onPause() }
    override fun onDestroy() { PetRuntime.controlVisible(this, false); startAfterNotification = false; cancelPending("authorization_activity_destroyed"); super.onDestroy() }
    private fun render() { status.text = PetRuntime.status(this) }

    companion object {
        private const val REQUEST_NOTIFICATIONS = 7311
        private const val REQUEST_CAPTURE = 7312
    }
}
