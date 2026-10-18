package org.nuanban.assistant.nativehost

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory

enum class PetAction { IDLE, LISTENING, THINKING, SPEAKING, POINTING, CELEBRATING, CONCERNED, PAUSED }
data class Generated2dLayer(val id: String, val kind: String, val sourcePath: String, val left: Int, val top: Int, val width: Int, val height: Int)
data class Generated2dAction(val frames: List<Int>, val durationMs: Int, val loop: Boolean)
data class Generated2dManifest(val assetId: String, val canvasWidth: Int, val canvasHeight: Int, val decodedBytes: Long, val palette: List<String>, val layers: List<Generated2dLayer>, val actions: Map<PetAction, Generated2dAction>, val generated: Boolean = true, val source: String = "generated_2d", val version: String = "1", val kind: String = "animated_2d")
data class Generated2dValidation(val allowed: Boolean, val reason: String)
data class LoadedGenerated2dAsset(val manifest: Generated2dManifest, val bitmap: Bitmap)

object Generated2dAssetValidator {
    private val assetIdPattern = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", RegexOption.IGNORE_CASE)
    private val assetPathPattern = Regex("assets/[A-Za-z0-9_-]{1,80}/[A-Za-z0-9_-]{1,80}\\.(png|webp)", RegexOption.IGNORE_CASE)
    private val colorPattern = Regex("#[0-9a-f]{6}(?:[0-9a-f]{2})?", RegexOption.IGNORE_CASE)

    fun validate(manifest: Generated2dManifest): Generated2dValidation {
        if (manifest.version != "1" || manifest.kind != "animated_2d" || manifest.source != "generated_2d" || !manifest.generated) return Generated2dValidation(false, "manifest_identity_unverified")
        if (!assetIdPattern.matches(manifest.assetId)) return Generated2dValidation(false, "asset_id_invalid")
        if (manifest.canvasWidth !in 1..2048 || manifest.canvasHeight !in 1..2048 || manifest.decodedBytes !in 1..67_108_864) return Generated2dValidation(false, "asset_size_invalid")
        if (manifest.palette.isEmpty() || manifest.palette.size > 32 || manifest.palette.any { !colorPattern.matches(it) }) return Generated2dValidation(false, "palette_invalid")
        if (manifest.layers.isEmpty() || manifest.layers.map { it.id }.distinct().size != manifest.layers.size) return Generated2dValidation(false, "layers_invalid")
        if (manifest.layers.any { it.kind !in setOf("body", "eyes", "mouth", "accessory") || !assetPathPattern.matches(it.sourcePath) || it.left < 0 || it.top < 0 || it.width < 1 || it.height < 1 || it.left + it.width > manifest.canvasWidth || it.top + it.height > manifest.canvasHeight }) return Generated2dValidation(false, "layer_bounds_or_source_invalid")
        if (PetAction.entries.any { action -> manifest.actions[action]?.let { it.frames.isNotEmpty() && it.durationMs in 1..60_000 && it.frames.all { frame -> frame >= 0 } } != true }) return Generated2dValidation(false, "actions_incomplete")
        return Generated2dValidation(true, "verified_structure_only")
    }
}

class Generated2dAssetAdapter(private val context: Context) {
    fun load(manifest: Generated2dManifest): LoadedGenerated2dAsset? {
        if (!Generated2dAssetValidator.validate(manifest).allowed) return null
        val paths = manifest.layers.map { it.sourcePath.removePrefix("assets/") }.distinct()
        if (paths.size != 1) return null
        val path = paths.single()
        return runCatching {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.assets.open(path).use { BitmapFactory.decodeStream(it, null, bounds) }
            if (bounds.outWidth !in 1..manifest.canvasWidth || bounds.outHeight !in 1..manifest.canvasHeight) return null
            val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
            val bitmap = context.assets.open(path).use { BitmapFactory.decodeStream(it, null, options) } ?: return null
            if (bitmap.byteCount.toLong() > manifest.decodedBytes || bitmap.byteCount > 67_108_864) { bitmap.recycle(); return null }
            LoadedGenerated2dAsset(manifest, bitmap)
        }.getOrNull()
    }
}
