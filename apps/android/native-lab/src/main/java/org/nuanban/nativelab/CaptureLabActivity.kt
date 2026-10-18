package org.nuanban.nativelab

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.WindowInsets
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class CaptureLabActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var status: TextView
    private lateinit var consent: CheckBox
    private lateinit var overlay: CheckBox
    private lateinit var start: Button
    private var pending: LabTicket? = null
    private var requestedOverlay = false
    private var message = "尚未申请任何屏幕或浮层权限。"
    private val refresh = object : Runnable {
        override fun run() {
            renderStatus()
            handler.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState?.containsKey("pending_generation") == true) {
            savedInstanceState.getString("pending_nonce")?.let { nonce ->
                pending = LabTicket(savedInstanceState.getLong("pending_generation"), nonce)
            }
            requestedOverlay = savedInstanceState.getBoolean("requested_overlay")
        }
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 32, 24, 32)
            setBackgroundColor(Color.rgb(255, 249, 239))
        }
        setContentView(ScrollView(this).apply {
            addView(column)
            setOnApplyWindowInsetsListener { _, insets ->
                if (Build.VERSION.SDK_INT >= 30) {
                    val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                    column.setPadding(24 + bars.left, 16 + bars.top, 24 + bars.right, 16 + bars.bottom)
                } else {
                    column.setPadding(24 + insets.systemWindowInsetLeft, 16 + insets.systemWindowInsetTop, 24 + insets.systemWindowInsetRight, 16 + insets.systemWindowInsetBottom)
                }
                insets
            }
        })
        fun text(content: String, size: Float = 17f) = TextView(this).apply {
            text = content
            textSize = size
            setTextColor(Color.rgb(45, 52, 48))
            setPadding(0, 10, 0, 10)
            column.addView(this)
        }
        text("暖伴 · C01 原生验证", 25f)
        text("仅供开发验证，不是教学或屏幕共享产品功能。\n请只打开合成测试页面，不要打开真实账号、聊天、支付或验证码页面。")
        text("本样例不读取帧像素、不编码、不保存、不上传；只统计内存帧隔离释放次数，不能判定内容安全。设有 30 秒自动停止计时（调度延迟待设备验证），停止后必须重新申请系统授权。")
        text("合成标记：NUANBAN-C01-SYNTHETIC", 19f)
        listOf("A", "B").forEach { label ->
            var count = 0
            Button(this).apply {
                text = "合成按钮 $label：0 次"
                setOnClickListener { count += 1; text = "合成按钮 $label：$count 次" }
                column.addView(this)
            }
        }
        consent = CheckBox(this).apply {
            text = "我了解这是本地隔离实验，只使用合成内容，同意本次有自动停止计时的采集。"
            textSize = 17f
            column.addView(this)
        }
        overlay = CheckBox(this).apply {
            text = "同时测试触摸穿透标记与浮动停止按钮（需另行授权，可不选）"
            textSize = 17f
            column.addView(this)
        }
        Button(this).apply {
            text = "申请浮层权限（可选，不会自动开始）"
            setOnClickListener {
                runCatching { startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))) }
                    .onFailure { message = "此设备无法打开浮层权限页；可不选浮层继续验证采集。" }
            }
            column.addView(this)
        }
        start = Button(this).apply {
            text = "申请系统授权并开始本次实验"
            setOnClickListener { requestCapture() }
            column.addView(this)
        }
        Button(this).apply {
            text = "立即停止 / 取消待授权请求"
            setOnClickListener {
                LabRuntime.session.stop(LabStopReason.USER)
                pending = null
                stopService(Intent(this@CaptureLabActivity, CaptureLabService::class.java))
                message = "本次请求已关闭，不会自动恢复。"
                renderStatus()
            }
            column.addView(this)
        }
        status = text("").apply { accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
    }

    private fun requestCapture() {
        if (!consent.isChecked) { message = "请先阅读并勾选本次实验说明。"; renderStatus(); return }
        if (overlay.isChecked && !Settings.canDrawOverlays(this)) {
            message = "浮层权限未允许；请单独授权，或取消浮层选项。"
            renderStatus()
            return
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 102)
            message = "请允许可见的停止通知；允许后仍需再次点击开始。"
            renderStatus()
            return
        }
        if (!getSystemService(NotificationManager::class.java).areNotificationsEnabled()) {
            message = "通知已关闭，本样例不开始采集。请在系统设置允许通知后重试。"
            renderStatus()
            return
        }
        val ticket = LabRuntime.session.beginConsent() ?: return
        pending = ticket
        requestedOverlay = overlay.isChecked
        consent.isChecked = false
        try {
            startActivityForResult(getSystemService(MediaProjectionManager::class.java).createScreenCaptureIntent(), 101)
            message = "等待本次系统授权；取消或拒绝都不会采集。"
        } catch (_: Exception) {
            pending = null
            LabRuntime.session.stop(LabStopReason.START_FAILED)
            message = "无法打开系统授权；未开始采集。"
        }
        renderStatus()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 101) return
        val ticket = pending ?: return
        pending = null
        if (!LabRuntime.session.resolveConsent(ticket, resultCode == RESULT_OK && data != null)) {
            message = "授权未通过或请求已停止；没有开始新采集。"
            return
        }
        try {
            startForegroundService(Intent(this, CaptureLabService::class.java).apply {
                action = CaptureLabService.ACTION_START
                putExtra("generation", ticket.generation)
                putExtra("nonce", ticket.nonce)
                putExtra("projection_result", data)
                putExtra("overlay", requestedOverlay)
            })
            message = "正在启动本地隔离采集；未检测的帧不会发送。"
        } catch (_: Exception) {
            LabRuntime.session.stop(LabStopReason.START_FAILED)
            message = "系统未允许启动前台服务；已关闭本次请求。"
        }
    }

    private fun renderStatus() {
        val snapshot = LabRuntime.session.snapshot()
        start.isEnabled = (snapshot.phase == LabPhase.IDLE || snapshot.phase == LabPhase.STOPPED) && !snapshot.cleanupPending && snapshot.cleanupFailures == 0L
        status.text = "$message\n状态：${snapshot.phase}；代际：${snapshot.generation}\n本次隔离帧：${snapshot.frames}；已释放（含迟到）：${snapshot.released}\n迟到帧：${snapshot.lateFrames}；释放失败：${snapshot.releaseFailures}\n清理待确认：${snapshot.cleanupPending}；清理失败：${snapshot.cleanupFailures}\n停止原因：${snapshot.stopReason ?: "无"}\n清理异常时请通过系统停止投影，并结束本样例进程；不要继续采集。\n没有内容安全结论，也不构成 C01/NV 真机验收。"
    }

    override fun onResume() { super.onResume(); handler.post(refresh) }
    override fun onPause() { handler.removeCallbacks(refresh); super.onPause() }
    override fun onSaveInstanceState(outState: Bundle) {
        pending?.let { ticket ->
            outState.putLong("pending_generation", ticket.generation)
            outState.putString("pending_nonce", ticket.nonce)
            outState.putBoolean("requested_overlay", requestedOverlay)
        }
        super.onSaveInstanceState(outState)
    }
}
