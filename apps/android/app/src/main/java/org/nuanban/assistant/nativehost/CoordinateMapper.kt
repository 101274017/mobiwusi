package org.nuanban.assistant.nativehost

import kotlin.math.min

data class NativeRect(val left: Double, val top: Double, val right: Double, val bottom: Double) {
    val width get() = right - left
    val height get() = bottom - top
    fun valid() = listOf(left, top, right, bottom).all { it.isFinite() } && width > 0 && height > 0
}
data class NativeGeometry(val generation: Long, val revision: Long, val captureWidth: Int, val captureHeight: Int, val rotation: Int, val content: NativeRect, val density: Double, val deviceVerified: Boolean = false)
data class MappedTarget(val rect: NativeRect, val presentation: String)

object CoordinateMapper {
    fun map(target: NativeRect, geometry: NativeGeometry, generation: Long, revision: Long, childMode: Boolean): MappedTarget? {
        if (!geometry.deviceVerified || geometry.generation != generation || geometry.revision != revision || generation < 1 || revision < 1) return null
        if (!target.valid() || target.left < 0 || target.top < 0 || target.right > 1 || target.bottom > 1) return null
        if (geometry.captureWidth !in 1..8192 || geometry.captureHeight !in 1..8192 || !geometry.content.valid() || geometry.content.left < 0 || geometry.content.top < 0 || !geometry.density.isFinite() || geometry.density !in 0.5..8.0) return null
        if (geometry.rotation !in setOf(0, 90, 180, 270)) return null
        fun rotate(horizontal: Double, vertical: Double): Pair<Double, Double> = when (geometry.rotation) {
            90 -> 1 - vertical to horizontal
            180 -> 1 - horizontal to 1 - vertical
            270 -> vertical to 1 - horizontal
            else -> horizontal to vertical
        }
        val corners = listOf(rotate(target.left, target.top), rotate(target.right, target.top), rotate(target.left, target.bottom), rotate(target.right, target.bottom))
        val rotated = geometry.rotation == 90 || geometry.rotation == 270
        val width = if (rotated) geometry.captureHeight else geometry.captureWidth
        val height = if (rotated) geometry.captureWidth else geometry.captureHeight
        val scale = min(geometry.content.width / width, geometry.content.height / height)
        val offsetLeft = geometry.content.left + (geometry.content.width - width * scale) / 2
        val offsetTop = geometry.content.top + (geometry.content.height - height * scale) / 2
        val rect = NativeRect(offsetLeft + corners.minOf { it.first } * width * scale, offsetTop + corners.minOf { it.second } * height * scale, offsetLeft + corners.maxOf { it.first } * width * scale, offsetTop + corners.maxOf { it.second } * height * scale)
        return MappedTarget(rect, if (childMode) "pet_pointing" else "highlight")
    }
}
