package org.nuanban.assistant.nativehost

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
import android.graphics.Bitmap
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.Display
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import kotlin.math.max
import kotlin.math.min
import java.nio.ByteBuffer

class NativeCaptureService : Service() {
    companion object {
        const val ACTION_START = "org.nuanban.assistant.nativehost.START_CAPTURE"
        const val ACTION_STOP = "org.nuanban.assistant.nativehost.STOP_CAPTURE"
        const val EXTRA_GENERATION = "org.nuanban.assistant.nativehost.GENERATION"
        const val EXTRA_NONCE = "org.nuanban.assistant.nativehost.NONCE"
        const val EXTRA_PROJECTION_RESULT = "org.nuanban.assistant.nativehost.PROJECTION_RESULT"
        const val EXTRA_OVERLAY = "org.nuanban.assistant.nativehost.OVERLAY"
        const val EXTRA_PET_GENERATION = "org.nuanban.assistant.nativehost.PET_GENERATION"
        const val EXTRA_PET_NONCE = "org.nuanban.assistant.nativehost.PET_NONCE"
        private const val CHANNEL = "nuanban-native-capture"
        private const val NOTIFICATION_ID = 9017
        private const val MAX_DURATION_MS = 30_000L

        fun stopFrom(context: Context) {
            AndroidGuidanceRuntime.stopObservation("user_stopped")
            NativeCaptureRuntime.session.stop(CaptureStop.USER)
            NativeCaptureRuntime.gate.stop()
            NativeCaptureRuntime.clearFrames()
            context.stopService(Intent(context, NativeCaptureService::class.java))
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private val frameThread = HandlerThread("nuanban-local-screen-detector").apply { start() }
    private val frameHandler = Handler(frameThread.looper)
    private var ticket: CaptureTicket? = null
    private var petTicket: PetObservationTicket? = null
    private var projection: MediaProjection? = null
    private var reader: ImageReader? = null
    private var display: VirtualDisplay? = null
    private var marker: TextView? = null
    private var stopButton: Button? = null
    private var initialized = false
    @Volatile private var closing = false
    private var receiverRegistered = false
    private var displayListenerRegistered = false
    @Volatile private var captureGeometry: AndroidCaptureGeometry? = null
    @Volatile private var sourceConfirmed = false
    private var frameSequence = 0L
    private var lastDetectionMs = -1L
    private var targetIdentity = ""
    private var overlayRequested = false
    private val deadline = Runnable { finish(CaptureStop.TIME_LIMIT) }
    private val geometryDeadline = Runnable { if (!sourceConfirmed) finish(CaptureStop.DISPLAY_CHANGED) }
    private val screenOff = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) { finish(CaptureStop.SCREEN_OFF) }
    }
    private val displayListener = object : DisplayManager.DisplayListener {
        override fun onDisplayAdded(displayId: Int) = Unit
        override fun onDisplayRemoved(displayId: Int) { if (displayId == Display.DEFAULT_DISPLAY) finish(CaptureStop.DISPLAY_CHANGED) }
        override fun onDisplayChanged(displayId: Int) { if (displayId == Display.DEFAULT_DISPLAY) finish(CaptureStop.DISPLAY_CHANGED) }
    }
    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() { finish(CaptureStop.SYSTEM_REVOKED) }
        override fun onCapturedContentResize(width: Int, height: Int) {
            if (captureGeometry?.matchesSource(width, height) != true) { finish(CaptureStop.DISPLAY_CHANGED); return }
            sourceConfirmed = true
            handler.removeCallbacks(geometryDeadline)
        }
        override fun onCapturedContentVisibilityChanged(isVisible: Boolean) { if (!isVisible) finish(CaptureStop.DISPLAY_CHANGED) }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { finish(CaptureStop.USER); return START_NOT_STICKY }
        val generation = intent?.getLongExtra(EXTRA_GENERATION, -1L) ?: -1L
        val nonce = intent?.getStringExtra(EXTRA_NONCE)
        val candidate = nonce?.let { CaptureTicket(generation, it) }
        if (intent?.action != ACTION_START || candidate == null || !NativeCaptureRuntime.session.mayStart(candidate)) {
            if (!initialized) stopSelf()
            return START_NOT_STICKY
        }
        if (initialized || closing || !NativeCaptureRuntime.session.claim(candidate)) {
            NativeCaptureRuntime.session.stop(CaptureStop.START_FAILED)
            return START_NOT_STICKY
        }
        ticket = candidate
        val petNonce = intent.getStringExtra(EXTRA_PET_NONCE)
        if (petNonce != null) {
            petTicket = PetObservationTicket(intent.getLongExtra(EXTRA_PET_GENERATION, -1L), petNonce)
            if (!PetRuntime.running || !PetRuntime.sessions.mayStart(petTicket!!)) {
                finish(CaptureStop.START_FAILED)
                return START_NOT_STICKY
            }
            NativeCaptureRuntime.petOwnedCapture = true
        }
        initialized = true
        overlayRequested = intent.getBooleanExtra(EXTRA_OVERLAY, false)
        try {
            if (!NativeCaptureRuntime.gate.detectorReady()) { finish(CaptureStop.PRIVACY_BLOCKED); return START_NOT_STICKY }
            if (getSystemService(KeyguardManager::class.java).isKeyguardLocked) { finish(CaptureStop.LOCKED); return START_NOT_STICKY }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "微光指引原生协助", NotificationManager.IMPORTANCE_LOW))
            if (!manager.areNotificationsEnabled() || manager.getNotificationChannel(CHANNEL)?.importance == NotificationManager.IMPORTANCE_NONE) {
                finish(CaptureStop.NOTIFICATION_UNAVAILABLE)
                return START_NOT_STICKY
            }
            val foregroundNotification = notification()
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, foregroundNotification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION) else startForeground(NOTIFICATION_ID, foregroundNotification)
            val result = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(EXTRA_PROJECTION_RESULT, Intent::class.java) else @Suppress("DEPRECATION") intent.getParcelableExtra(EXTRA_PROJECTION_RESULT)
            requireNotNull(result)
            val managerProjection = getSystemService(MediaProjectionManager::class.java)
            projection = requireNotNull(managerProjection.getMediaProjection(Activity.RESULT_OK, result))
            projection!!.registerCallback(projectionCallback, handler)
            val metrics = android.util.DisplayMetrics()
            requireNotNull(getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY)).getRealMetrics(metrics)
            val bounds = if (Build.VERSION.SDK_INT >= 30) getSystemService(WindowManager::class.java).maximumWindowMetrics.bounds else null
            val sourceWidth = bounds?.width() ?: metrics.widthPixels
            val sourceHeight = bounds?.height() ?: metrics.heightPixels
            require(sourceWidth > 0 && sourceHeight > 0)
            val scale = min(1.0, min(720.0 / min(sourceWidth, sourceHeight), 1280.0 / max(sourceWidth, sourceHeight)))
            val width = max(1, (sourceWidth * scale).toInt())
            val height = max(1, (sourceHeight * scale).toInt())
            val geometry = AndroidCaptureGeometry(sourceWidth, sourceHeight, width, height)
            require(geometry.valid())
            captureGeometry = geometry
            sourceConfirmed = Build.VERSION.SDK_INT < 34
            targetIdentity = "android-display:" + sourceWidth + "x" + sourceHeight + ":" + width + "x" + height
            require(NativeCaptureRuntime.gate.authorize(candidate.generation, targetIdentity, true, true))
            val imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
            reader = imageReader
            imageReader.setOnImageAvailableListener({ source -> quarantine(source, candidate) }, frameHandler)
            display = projection!!.createVirtualDisplay("Nuanban-local-quarantine", width, height, metrics.densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, imageReader.surface, null, handler)
            requireNotNull(display)
            if (!NativeCaptureRuntime.session.started(candidate)) { finish(CaptureStop.START_FAILED); return START_NOT_STICKY }
            petTicket?.let { if (!PetRuntime.sessions.captureStarted(it)) { finish(CaptureStop.START_FAILED); return START_NOT_STICKY } }
            if (petTicket != null) AndroidGuidanceRuntime.beginObservation(this, candidate.generation, geometry, PetRuntime.sessions.snapshot().cloudAnalysisConsent)
            if (!sourceConfirmed) handler.postDelayed(geometryDeadline, 2000)
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), Context.RECEIVER_NOT_EXPORTED) else registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF))
            receiverRegistered = true
            getSystemService(DisplayManager::class.java).registerDisplayListener(displayListener, handler)
            displayListenerRegistered = true
            if (overlayRequested) addOverlay()
            if (petTicket == null) handler.postDelayed(deadline, MAX_DURATION_MS)
        } catch (_: Exception) { finish(CaptureStop.START_FAILED) }
        return START_NOT_STICKY
    }

    private fun notification(): Notification {
        val stop = PendingIntent.getBroadcast(this, 1, Intent(this, PetStopReceiver::class.java).setAction(PetStopReceiver.ACTION_STOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val control = if (petTicket != null) PetControlActivity::class.java else NativeCaptureControlActivity::class.java
        val open = PendingIntent.getActivity(this, 2, Intent(this, control), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val description = if (petTicket != null) "持续本地观察；仅当次同意时按需分析脱敏画面；风险/未知立即停止。" else "采集帧只在内存中隔离释放，最多 30 秒；风险/未知立即停止。"
        return Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_menu_view).setContentTitle("微光指引 · 本地隔离协助").setContentText(description).setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null, "立即停止", stop).build()).build()
    }

    private fun quarantine(source: ImageReader, candidate: CaptureTicket) {
        if (closing) return
        try {
            if (getSystemService(KeyguardManager::class.java).isKeyguardLocked) { finish(CaptureStop.LOCKED); return }
            if (petTicket != null && (!PetRuntime.running || !Settings.canDrawOverlays(this) || !PetRuntime.notificationGranted(this))) { finish(CaptureStop.PRIVACY_BLOCKED); return }
            val image = source.acquireLatestImage() ?: return
            if (PetRuntime.localControlsVisible()) { NativeCaptureRuntime.session.releaseFrame(candidate) { image.close() }; return }
            if (!sourceConfirmed) { NativeCaptureRuntime.session.releaseFrame(candidate) { image.close() }; return }
            val geometry = captureGeometry
            if (geometry == null || image.width != geometry.frameWidth || image.height != geometry.frameHeight) { NativeCaptureRuntime.session.releaseFrame(candidate) { image.close() }; finish(CaptureStop.DISPLAY_CHANGED); return }
            val capturedAt = SystemClock.elapsedRealtime()
            if (lastDetectionMs >= 0 && capturedAt - lastDetectionMs < 600) { NativeCaptureRuntime.session.releaseFrame(candidate) { image.close() }; return }
            lastDetectionMs = capturedAt
            val epoch = System.currentTimeMillis()
            val frame = FrameIdentity(candidate.generation, frameSequence++, capturedAt, targetIdentity)
            val bitmap = try {
                val plane = image.planes.single()
                require(plane.pixelStride == 4 && plane.rowStride >= image.width * 4)
                val pixels = ByteBuffer.allocate(image.width * image.height * 4)
                val row = ByteArray(image.width * 4)
                val sourceBuffer = plane.buffer.duplicate()
                for (rowIndex in 0 until image.height) {
                    sourceBuffer.position(rowIndex * plane.rowStride)
                    sourceBuffer.get(row)
                    pixels.put(row)
                }
                row.fill(0)
                pixels.rewind()
                val copied = Bitmap.createBitmap(image.width, image.height, Bitmap.Config.ARGB_8888)
                try {
                    copied.copyPixelsFromBuffer(pixels)
                    copied
                } catch (error: Exception) { copied.recycle(); throw error } finally { pixels.array().fill(0) }
            } finally { NativeCaptureRuntime.session.releaseFrame(candidate) { image.close() } }
            if (closing || NativeCaptureRuntime.session.snapshot().phase != CapturePhase.QUARANTINED) { bitmap.recycle(); return }
            val local = NativeCaptureRuntime.detector
            if (local == null) { bitmap.recycle(); finish(CaptureStop.PRIVACY_BLOCKED); return }
            val detection = local.detect(frame, bitmap, epoch)
            val decision = NativeCaptureRuntime.gate.inspect(frame, detection.proof, SystemClock.elapsedRealtime())
            NativeCaptureRuntime.lastGateReason = decision.reason
            if (!decision.allowed) { local.release(detection.sanitized); finish(CaptureStop.PRIVACY_BLOCKED); return }
            val sanitized = detection.sanitized
            if (closing || sanitized == null || !NativeCaptureRuntime.acceptFrame(sanitized)) { local.release(sanitized); if (!closing) finish(CaptureStop.FRAME_FAILED); return }
            if (petTicket != null) AndroidGuidanceRuntime.onFrame(sanitized)
        } catch (_: Exception) { if (!closing) finish(CaptureStop.FRAME_FAILED) }
    }

    private fun addOverlay() {
        if (!Settings.canDrawOverlays(this)) { finish(CaptureStop.OVERLAY_UNAVAILABLE); return }
        val manager = getSystemService(WindowManager::class.java)
        val markerView = TextView(this).apply { text = "微光指引 · 本地标记"; textSize = 14f; setTextColor(0xff3d2f18.toInt()); setBackgroundColor(0xffffd37a.toInt()); setPadding(12, 8, 12, 8) }
        val buttonView = Button(this).apply { text = "停止"; setOnClickListener { finish(CaptureStop.USER) } }
        val type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        val markerParams = WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.TRANSLUCENT).apply { gravity = Gravity.TOP or Gravity.START; x = 16; y = 64 }
        val buttonParams = WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.TRANSLUCENT).apply { gravity = Gravity.BOTTOM or Gravity.END; x = 16; y = 64 }
        try { manager.addView(markerView, markerParams); manager.addView(buttonView, buttonParams); marker = markerView; stopButton = buttonView } catch (_: Exception) { finish(CaptureStop.OVERLAY_UNAVAILABLE) }
    }

    private fun finish(cause: CaptureStop) {
        if (closing) return
        AndroidGuidanceRuntime.stopObservation("capture_" + cause.name.lowercase(), ticket?.generation)
        if (Looper.myLooper() != Looper.getMainLooper()) {
            NativeCaptureRuntime.gate.stop()
            NativeCaptureRuntime.clearFrames()
            handler.post { finish(cause) }
            return
        }
        if (closing) return
        closing = true
        val owned = ticket
        if (owned != null) NativeCaptureRuntime.session.stop(cause)
        NativeCaptureRuntime.gate.stop()
        NativeCaptureRuntime.clearFrames()
        petTicket?.let { PetRuntime.sessions.captureStopped(it, "capture_" + cause.name.lowercase(), cause != CaptureStop.USER) }
        handler.removeCallbacks(deadline)
        handler.removeCallbacks(geometryDeadline)
        var failures = 0
        fun release(action: () -> Unit) { try { action() } catch (_: Exception) { failures += 1 } }
        release { reader?.setOnImageAvailableListener(null, null) }
        release { display?.release() }
        release { reader?.close() }
        release { frameThread.quitSafely() }
        release { projection?.unregisterCallback(projectionCallback) }
        release { projection?.stop() }
        release { marker?.let { getSystemService(WindowManager::class.java).removeViewImmediate(it) } }
        release { stopButton?.let { getSystemService(WindowManager::class.java).removeViewImmediate(it) } }
        if (receiverRegistered) release { unregisterReceiver(screenOff) }
        if (displayListenerRegistered) release { getSystemService(DisplayManager::class.java).unregisterDisplayListener(displayListener) }
        projection = null; display = null; reader = null; marker = null; stopButton = null
        if (owned != null) NativeCaptureRuntime.session.released(owned, failures)
        if (petTicket != null) NativeCaptureRuntime.petOwnedCapture = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onTaskRemoved(rootIntent: Intent?) { if (petTicket == null) finish(CaptureStop.TASK_REMOVED); super.onTaskRemoved(rootIntent) }
    override fun onConfigurationChanged(newConfig: Configuration) { finish(CaptureStop.DISPLAY_CHANGED); super.onConfigurationChanged(newConfig) }
    override fun onDestroy() { finish(CaptureStop.DESTROYED); super.onDestroy() }
}
