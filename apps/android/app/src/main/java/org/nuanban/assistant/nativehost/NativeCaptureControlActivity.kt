package org.nuanban.assistant.nativehost

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class NativeCaptureControlActivity : Activity() {
    private var pending: CaptureTicket? = null
    private var waitingForNotificationPermission = false
    private lateinit var status: TextView
    private lateinit var consent: CheckBox
    private lateinit var overlay: CheckBox

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(24, 32, 24, 32); setBackgroundColor(Color.rgb(255, 249, 239)) }
        setContentView(ScrollView(this).apply { addView(root, ViewGroup.LayoutParams(-1, -1)) })
        fun text(value: String, size: Float = 17f) { root.addView(TextView(this).apply { text = value; textSize = size; setTextColor(Color.rgb(45, 52, 48)); setPadding(0, 10, 0, 10) }) }
        text("暖伴 · Android 原生控制", 24f)
        text("默认不启用捕获、浮层或流程指引。只有本页勾选本次说明并通过系统授权，才会短时启动本地隔离实验。原生帧不读像素、不编码、不保存、不上传；未验证检测器和目标版本始终阻断。")
        status = TextView(this).also { root.addView(it) }
        consent = CheckBox(this).apply { text = "我确认只使用合成内容，并同意本次 30 秒本地隔离实验。"; textSize = 17f }; root.addView(consent)
        overlay = CheckBox(this).apply { text = "同时显示可选本地标记和停止按钮（需要单独浮层授权）。"; textSize = 17f }; root.addView(overlay)
        root.addView(Button(this).apply { text = "打开浮层授权（可选）"; setOnClickListener { runCatching { startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:$packageName"))) } } })
        root.addView(Button(this).apply { text = "申请系统屏幕授权并开始"; setOnClickListener { requestCapture() } })
        root.addView(Button(this).apply { text = "立即停止"; setOnClickListener { NativeCaptureService.stopFrom(this@NativeCaptureControlActivity); render() } })
        render()
    }

    private fun requestCapture() {
        if (!consent.isChecked) { status.text = "必须先确认本次合成内容说明；未开始。"; return }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            waitingForNotificationPermission = true
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
            status.text = "需要先明确授予前台停止通知权限；拒绝则不开始。"
            return
        }
        launchCaptureConsent()
    }

    private fun launchCaptureConsent() {
        val ticket = NativeCaptureRuntime.session.requestConsent()
        if (ticket == null) { status.text = "已有会话、待清理资源或清理失败；未重新授权。"; return }
        pending = ticket
        val manager = getSystemService(MediaProjectionManager::class.java)
        startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CAPTURE)
        status.text = "等待 Android 系统屏幕授权；取消或拒绝不会自动重试。"
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_NOTIFICATIONS || !waitingForNotificationPermission) return
        waitingForNotificationPermission = false
        if (grantResults.firstOrNull() == android.content.pm.PackageManager.PERMISSION_GRANTED) launchCaptureConsent()
        else status.text = "通知权限未授予；为避免无停止入口，本次捕获未开始。"
    }

    @Deprecated("Android activity result bridge retained for minSdk compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_CAPTURE) return
        val ticket = pending ?: return
        pending = null
        if (data == null || !NativeCaptureRuntime.session.resolveConsent(ticket, resultCode == RESULT_OK)) { render(); return }
        val intent = Intent(this, NativeCaptureService::class.java).setAction(NativeCaptureService.ACTION_START).putExtra(NativeCaptureService.EXTRA_GENERATION, ticket.generation).putExtra(NativeCaptureService.EXTRA_NONCE, ticket.nonce).putExtra(NativeCaptureService.EXTRA_PROJECTION_RESULT, data).putExtra(NativeCaptureService.EXTRA_OVERLAY, overlay.isChecked)
        try { if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent) else startService(intent) } catch (_: Exception) { NativeCaptureRuntime.session.stop(CaptureStop.START_FAILED) }
        render()
    }

    override fun onResume() { super.onResume(); render() }

    private fun render() {
        if (::status.isInitialized) {
            val snapshot = NativeCaptureRuntime.session.snapshot()
            status.text = "状态：${snapshot.phase}\n代际：${snapshot.generation}\n释放帧：${snapshot.framesReleased}\n停止原因：${snapshot.stopReason?.name ?: "无"}\n门控：${NativeCaptureRuntime.lastGateReason}"
        }
    }

    companion object {
        private const val REQUEST_CAPTURE = 7017
        private const val REQUEST_NOTIFICATIONS = 7018
    }
}
