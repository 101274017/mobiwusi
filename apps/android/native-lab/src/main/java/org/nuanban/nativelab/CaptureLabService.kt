package org.nuanban.nativelab

import android.app.Activity
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.Display
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import kotlin.math.min

class CaptureLabService : Service() {
    companion object {
        const val ACTION_START = "org.nuanban.nativelab.START"
        const val ACTION_STOP = "org.nuanban.nativelab.STOP"
        private const val CHANNEL = "c01-local-capture"
    }

    private val handler = Handler(Looper.getMainLooper())
    private var ticket: LabTicket? = null
    private var projection: MediaProjection? = null
    private var imageReader: ImageReader? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var marker: TextView? = null
    private var stopButton: Button? = null
    private var initialized = false
    private var closing = false
    private var receiverRegistered = false
    private var displayRegistered = false
    private var captureSize: Pair<Int, Int>? = null
    private var expiresAt = 0L
    private var overlayRequested = false
    private val deadline = Runnable { finish(LabStopReason.TIME_LIMIT) }
    private val screenOff = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) { finish(LabStopReason.SCREEN_OFF) }
    }
    private val displayListener = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(displayId: Int) = Unit
        override fun onDisplayRemoved(displayId: Int) { if (displayId == Display.DEFAULT_DISPLAY) finish(LabStopReason.DISPLAY_CHANGED) }
        override fun onDisplayChanged(displayId: Int) { if (displayId == Display.DEFAULT_DISPLAY) finish(LabStopReason.DISPLAY_CHANGED) }
    }
    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() { finish(LabStopReason.PROJECTION_REVOKED) }
        override fun onCapturedContentResize(width: Int, height: Int) {
            val next = width to height
            if (captureSize != null && captureSize != next) finish(LabStopReason.DISPLAY_CHANGED)
            captureSize = next
        }
        override fun onCapturedContentVisibilityChanged(isVisible: Boolean) { if (!isVisible) finish(LabStopReason.DISPLAY_CHANGED) }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { finish(LabStopReason.USER); return START_NOT_STICKY }
        val nonce = intent?.getStringExtra("nonce")
        val candidate = nonce?.let { LabTicket(intent.getLongExtra("generation", -1), it) }
        if (intent?.action != ACTION_START || candidate == null || !LabRuntime.session.mayStart(candidate)) {
            if (!initialized) stopSelf()
            return START_NOT_STICKY
        }
        if (initialized || closing) {
            LabRuntime.session.stop(candidate, LabStopReason.START_FAILED)
            return START_NOT_STICKY
        }
        if (!LabRuntime.session.claimService(candidate)) { stopSelf(); return START_NOT_STICKY }
        ticket = candidate
        initialized = true
        try {
            if (getSystemService(KeyguardManager::class.java).isKeyguardLocked) { finish(LabStopReason.DEVICE_LOCKED); return START_NOT_STICKY }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(NotificationChannel(CHANNEL, "C01 本地隔离采集", NotificationManager.IMPORTANCE_LOW))
            if (!notificationManager.areNotificationsEnabled() || notificationManager.getNotificationChannel(CHANNEL).importance == NotificationManager.IMPORTANCE_NONE) {
                finish(LabStopReason.NOTIFICATION_UNAVAILABLE)
                return START_NOT_STICKY
            }
            val notification = notification()
            if (Build.VERSION.SDK_INT >= 29) startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
            else startForeground(1, notification)
            val result = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra("projection_result", Intent::class.java)
                else intent.getParcelableExtra<Intent>("projection_result")
            requireNotNull(result)
            val manager = getSystemService(MediaProjectionManager::class.java)
            val activeProjection = requireNotNull(manager.getMediaProjection(Activity.RESULT_OK, result))
            projection = activeProjection
            activeProjection.registerCallback(projectionCallback, handler)
            val metrics = resources.displayMetrics
            val bounds = if (Build.VERSION.SDK_INT >= 30) getSystemService(WindowManager::class.java).maximumWindowMetrics.bounds else null
            val sourceWidth = bounds?.width() ?: metrics.widthPixels
            val sourceHeight = bounds?.height() ?: metrics.heightPixels
            require(sourceWidth > 0 && sourceHeight > 0)
            val scale = min(1.0, min(720.0 / min(sourceWidth, sourceHeight), 1280.0 / maxOf(sourceWidth, sourceHeight)))
            val width = maxOf(1, (sourceWidth * scale).toInt())
            val height = maxOf(1, (sourceHeight * scale).toInt())
            val reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
            imageReader = reader
            reader.setOnImageAvailableListener({ source -> quarantine(source, candidate) }, handler)
            virtualDisplay = activeProjection.createVirtualDisplay("Nuanban-C01-quarantine", width, height, metrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader.surface, null, handler)
            requireNotNull(virtualDisplay)
            if (!LabRuntime.session.started(candidate)) { finish(LabStopReason.START_FAILED); return START_NOT_STICKY }
            expiresAt = SystemClock.elapsedRealtime() + LabRuntime.MAX_DURATION_MS
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), Context.RECEIVER_NOT_EXPORTED)
            else registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF))
            receiverRegistered = true
            getSystemService(DisplayManager::class.java).registerDisplayListener(displayListener, handler)
            displayRegistered = true
            overlayRequested = intent.getBooleanExtra("overlay", false)
            if (overlayRequested) addOverlay()
            if (closing) return START_NOT_STICKY
            handler.postDelayed(deadline, LabRuntime.MAX_DURATION_MS)
        } catch (_: Exception) {
            finish(LabStopReason.START_FAILED)
        }
        return START_NOT_STICKY
    }

    private fun notification(): Notification {
        val stop = PendingIntent.getService(this, 1, Intent(this, CaptureLabService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val open = PendingIntent.getActivity(this, 2, Intent(this, CaptureLabActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle("暖伴 C01 · 本地隔离采集")
            .setContentText("30 秒自动停止计时；不读取像素、不保存、不上传。")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null, "立即停止", stop).build())
            .build()
    }

    private fun quarantine(source: ImageReader, candidate: LabTicket) {
        if (closing) return
        try {
            if (SystemClock.elapsedRealtime() >= expiresAt) { finish(LabStopReason.TIME_LIMIT); return }
            if (overlayRequested && !Settings.canDrawOverlays(this)) { finish(LabStopReason.OVERLAY_UNAVAILABLE); return }
            if (getSystemService(KeyguardManager::class.java).isKeyguardLocked) { finish(LabStopReason.DEVICE_LOCKED); return }
            val frame = source.acquireLatestImage() ?: return
            val accepted = LabRuntime.session.quarantineFrame(candidate) { frame.close() }
            if (!accepted) finish(LabStopReason.FRAME_FAILED)
        } catch (_: Exception) {
            if (!closing) finish(LabStopReason.FRAME_FAILED)
        }
    }

    private fun addOverlay() {
        if (!Settings.canDrawOverlays(this)) { finish(LabStopReason.OVERLAY_UNAVAILABLE); return }
        val windows = getSystemService(WindowManager::class.java)
        val density = resources.displayMetrics.density
        val label = TextView(this).apply {
            text = "C01 穿透标记"
            textSize = 16f
            setBackgroundColor(0xFFFFCF78.toInt())
            setTextColor(0xFF292E2A.toInt())
            setPadding(12, 12, 12, 12)
        }
        val labelParams = WindowManager.LayoutParams((180 * density).toInt(), (56 * density).toInt(), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE, PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.TOP or Gravity.START
            x = (18 * density).toInt()
            y = (150 * density).toInt()
            alpha = 0.35f
        }
        windows.addView(label, labelParams)
        marker = label
        val stop = Button(this).apply { text = "停止 C01"; setOnClickListener { finish(LabStopReason.USER) } }
        val stopParams = WindowManager.LayoutParams((136 * density).toInt(), (60 * density).toInt(), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL, PixelFormat.TRANSLUCENT).apply {
            gravity = Gravity.TOP or Gravity.END
            y = (24 * density).toInt()
        }
        windows.addView(stop, stopParams)
        stopButton = stop
    }

    private fun finish(reason: LabStopReason) {
        if (closing) return
        closing = true
        val owned = ticket
        if (owned != null) LabRuntime.session.stop(owned, reason)
        handler.removeCallbacks(deadline)
        var failures = 0
        fun release(action: () -> Unit) { try { action() } catch (_: Exception) { failures += 1 } }
        release { imageReader?.setOnImageAvailableListener(null, null) }
        release { virtualDisplay?.release() }
        release { imageReader?.close() }
        release { projection?.unregisterCallback(projectionCallback) }
        release { projection?.stop() }
        release { marker?.let { getSystemService(WindowManager::class.java).removeViewImmediate(it) } }
        release { stopButton?.let { getSystemService(WindowManager::class.java).removeViewImmediate(it) } }
        if (receiverRegistered) release { unregisterReceiver(screenOff) }
        if (displayRegistered) release { getSystemService(DisplayManager::class.java).unregisterDisplayListener(displayListener) }
        projection = null
        virtualDisplay = null
        imageReader = null
        marker = null
        stopButton = null
        if (owned != null) LabRuntime.session.serviceReleased(owned, failures)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onTaskRemoved(rootIntent: Intent?) { finish(LabStopReason.TASK_REMOVED); super.onTaskRemoved(rootIntent) }
    override fun onConfigurationChanged(newConfig: Configuration) { finish(LabStopReason.DISPLAY_CHANGED); super.onConfigurationChanged(newConfig) }
    override fun onDestroy() { finish(LabStopReason.SERVICE_DESTROYED); super.onDestroy() }
}
