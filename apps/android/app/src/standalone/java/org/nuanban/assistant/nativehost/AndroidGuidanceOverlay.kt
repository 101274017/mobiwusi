package org.nuanban.assistant.nativehost

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.PixelFormat
import android.os.Build
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.TextView

class AndroidGuidanceOverlay(private val context: Context) {
    private val manager = context.getSystemService(WindowManager::class.java)
    private var marker: View? = null
    private var caption: TextView? = null
    private var lastTarget: LocalScreenRect? = null
    private var lastUncertain = false

    fun render(view: AndroidTeachingView, target: LocalScreenRect?, source: AndroidCaptureGeometry?, visible: Boolean) {
        if (!visible || source == null || view.phase !in setOf("waiting", "analyzing", "verifying", "guiding", "needs_verification", "completed", "clarify", "unsupported", "unavailable")) { clear(); return }
        if (target == null || !target.within(source.sourceWidth, source.sourceHeight)) hideMarker()
        else if (marker == null || lastTarget != target || lastUncertain != view.uncertain) {
            hideMarker()
            val border = object : View(context) {
                private val brush = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = if (view.uncertain) 0xffffa000.toInt() else 0xff006b45.toInt()
                    strokeWidth = 4 * resources.displayMetrics.density
                    style = Paint.Style.STROKE
                    if (view.uncertain) pathEffect = DashPathEffect(floatArrayOf(12f, 8f), 0f)
                }
                override fun onDraw(canvas: Canvas) {
                    val actual = IntArray(2)
                    getLocationOnScreen(actual)
                    if (actual[0] != target.x || actual[1] != target.y || width != target.width || height != target.height) return
                    val inset = brush.strokeWidth / 2
                    if (width > brush.strokeWidth && height > brush.strokeWidth) canvas.drawRoundRect(inset, inset, width - inset, height - inset, inset, inset, brush)
                }
            }.apply { importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO }
            manager.addView(border, parameters(target.width, target.height).apply { x = target.x; y = target.y; alpha = 0.3f })
            marker = border
            lastTarget = target
            lastUncertain = view.uncertain
        }
        val subtitle = caption ?: TextView(context).apply {
            textSize = 19f
            setTextColor(Color.BLACK)
            setBackgroundColor(0xfffffbef.toInt())
            setPadding(20, 12, 20, 12)
            maxLines = 5
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            val width = minOf(source.sourceWidth - 32, (360 * resources.displayMetrics.density).toInt()).coerceAtLeast(1)
            manager.addView(this, parameters(width, WindowManager.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.BOTTOM or Gravity.START
                x = 16
                y = (64 * resources.displayMetrics.density).toInt()
                alpha = 0.7f
            })
            caption = this
        }
        val instruction = view.instruction + "\n请您亲手操作；核验请点桌宠。"
        if (subtitle.text.toString() != instruction) subtitle.text = instruction
    }

    private fun parameters(width: Int, height: Int) = WindowManager.LayoutParams(width, height, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_SECURE,
        PixelFormat.TRANSLUCENT).apply {
        gravity = Gravity.TOP or Gravity.START
        if (Build.VERSION.SDK_INT >= 30) setFitInsetsTypes(0)
        if (Build.VERSION.SDK_INT >= 28) layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }

    private fun hideMarker() {
        marker?.let { manager.removeViewImmediate(it) }
        marker = null
        lastTarget = null
    }

    fun clear() {
        hideMarker()
        caption?.let { manager.removeViewImmediate(it) }
        caption = null
    }
}
