package org.nuanban.assistant.nativehost

object AndroidCaptureGeometryChecks {
    fun run(): List<String> {
        val cases = mutableListOf<String>()
        fun scenario(name: String, action: () -> Unit) { action(); cases.add(name) }
        val geometry = AndroidCaptureGeometry(1080, 2400, 576, 1280)
        scenario("android_geometry_source_is_not_scaled_frame") { check(geometry.matchesSource(1080, 2400)); check(!geometry.matchesSource(576, 1280)) }
        scenario("android_geometry_single_app_mismatch_rejected") { check(!geometry.matchesSource(1080, 1200)) }
        scenario("android_geometry_rotation_mismatch_rejected") { check(!geometry.matchesSource(2400, 1080)) }
        scenario("android_geometry_full_frame_maps_to_source") { check(geometry.map(LocalScreenRect(0, 0, 576, 1280)) == LocalScreenRect(0, 0, 1080, 2400)) }
        scenario("android_geometry_rounds_outward") { check(geometry.map(LocalScreenRect(1, 1, 1, 1)) == LocalScreenRect(1, 1, 3, 3)) }
        scenario("android_geometry_negative_rect_rejected") { check(geometry.map(LocalScreenRect(-1, 1, 10, 10)) == null) }
        scenario("android_geometry_overflow_rect_rejected") { check(geometry.map(LocalScreenRect(Int.MAX_VALUE, 1, 10, 10)) == null) }
        scenario("android_geometry_empty_source_rejected") { check(!AndroidCaptureGeometry(0, 2400, 576, 1280).valid()) }
        scenario("android_geometry_stretched_frame_rejected") { check(!AndroidCaptureGeometry(1080, 2400, 720, 1280).valid()) }
        scenario("android_geometry_unscaled_supported") { check(AndroidCaptureGeometry(720, 1280, 720, 1280).map(LocalScreenRect(20, 40, 100, 50)) == LocalScreenRect(20, 40, 100, 50)) }
        return cases
    }
}
