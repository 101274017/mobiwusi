package org.nuanban.assistant.nativehost

import kotlin.math.ceil
import kotlin.math.floor

data class AndroidCaptureGeometry(val sourceWidth: Int, val sourceHeight: Int, val frameWidth: Int, val frameHeight: Int) {
    fun valid(): Boolean = sourceWidth in 1..16384 && sourceHeight in 1..16384 && frameWidth in 1..4096 && frameHeight in 1..4096 && frameWidth <= sourceWidth && frameHeight <= sourceHeight && kotlin.math.abs(sourceWidth.toLong() * frameHeight - sourceHeight.toLong() * frameWidth) <= maxOf(sourceWidth, sourceHeight)
    fun matchesSource(width: Int, height: Int): Boolean = valid() && sourceWidth == width && sourceHeight == height
    fun map(rect: LocalScreenRect): LocalScreenRect? {
        if (!valid() || !rect.within(frameWidth, frameHeight)) return null
        val left = floor(rect.x.toDouble() * sourceWidth / frameWidth).toInt()
        val top = floor(rect.y.toDouble() * sourceHeight / frameHeight).toInt()
        val right = ceil((rect.x.toLong() + rect.width).toDouble() * sourceWidth / frameWidth).toInt()
        val bottom = ceil((rect.y.toLong() + rect.height).toDouble() * sourceHeight / frameHeight).toInt()
        return LocalScreenRect(left, top, right - left, bottom - top).takeIf { it.within(sourceWidth, sourceHeight) }
    }
}
