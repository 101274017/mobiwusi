package org.nuanban.contracts

data object Empty : WireObject {
    override fun toWire(): Map<String, Any?> = wireBuild("Empty", emptyMap())
        fun fromWire(value: Any?): Empty {
            ContractValidator.validate("Empty", value)
            return Empty
        }
}

enum class Mode(val wireValue: String) : WireValue {
    VALUE_ELDER("elder"),
    VALUE_CHILD("child"),
    VALUE_ACCESSIBLE("accessible");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): Mode {
            ContractValidator.validate("Mode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class Scope(val wireValue: String) : WireValue {
    VALUE_LEARNING_READ("learning.read"),
    VALUE_LEARNING_MASTERY_WRITE("learning.mastery.write"),
    VALUE_TODO_WRITE("todo.write"),
    VALUE_ASSIST_REQUEST("assist.request");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): Scope {
            ContractValidator.validate("Scope", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class AppearanceDto(
    val `eyes`: AppearanceDtoEyes,
    val `mouth`: AppearanceDtoMouth,
    val `color`: String,
    val `action`: AppearanceDtoAction
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AppearanceDto", linkedMapOf(
        "eyes" to `eyes`,
        "mouth" to `mouth`,
        "color" to `color`,
        "action" to `action`
    ))
    companion object {
        fun fromWire(value: Any?): AppearanceDto {
            ContractValidator.validate("AppearanceDto", value)
            val fields = wireObject(value)
            return AppearanceDto(
                `eyes` = AppearanceDtoEyes.fromWire(fields["eyes"]),
                `mouth` = AppearanceDtoMouth.fromWire(fields["mouth"]),
                `color` = fields["color"] as String,
                `action` = AppearanceDtoAction.fromWire(fields["action"])
            )
        }
    }
}

enum class AppearanceDtoEyes(val wireValue: String) : WireValue {
    VALUE_ROUND("round"),
    VALUE_HAPPY("happy"),
    VALUE_SLEEPY("sleepy");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): AppearanceDtoEyes {
            ContractValidator.validate("AppearanceDtoEyes", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class AppearanceDtoMouth(val wireValue: String) : WireValue {
    VALUE_SMILE("smile"),
    VALUE_SMALL("small"),
    VALUE_OPEN("open");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): AppearanceDtoMouth {
            ContractValidator.validate("AppearanceDtoMouth", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class AppearanceDtoAction(val wireValue: String) : WireValue {
    VALUE_IDLE("idle"),
    VALUE_GREETING("greeting"),
    VALUE_CELEBRATING("celebrating");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): AppearanceDtoAction {
            ContractValidator.validate("AppearanceDtoAction", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class VoiceDto(
    val `muted`: Boolean,
    val `rate`: Double
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("VoiceDto", linkedMapOf(
        "muted" to `muted`,
        "rate" to `rate`
    ))
    companion object {
        fun fromWire(value: Any?): VoiceDto {
            ContractValidator.validate("VoiceDto", value)
            val fields = wireObject(value)
            return VoiceDto(
                `muted` = fields["muted"] as Boolean,
                `rate` = (fields["rate"] as Number).toDouble()
            )
        }
    }
}

data class PreferencesDto(
    val `mode`: PreferencesDtoMode,
    val `font_scale`: Double,
    val `caption_size`: Long,
    val `reduced_motion`: Boolean,
    val `voice`: PreferencesDtoVoice,
    val `appearance`: PreferencesDtoAppearance
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PreferencesDto", linkedMapOf(
        "mode" to `mode`,
        "font_scale" to `font_scale`,
        "caption_size" to `caption_size`,
        "reduced_motion" to `reduced_motion`,
        "voice" to `voice`,
        "appearance" to `appearance`
    ))
    companion object {
        fun fromWire(value: Any?): PreferencesDto {
            ContractValidator.validate("PreferencesDto", value)
            val fields = wireObject(value)
            return PreferencesDto(
                `mode` = PreferencesDtoMode.fromWire(fields["mode"]),
                `font_scale` = (fields["font_scale"] as Number).toDouble(),
                `caption_size` = (fields["caption_size"] as Number).toLong(),
                `reduced_motion` = fields["reduced_motion"] as Boolean,
                `voice` = PreferencesDtoVoice.fromWire(fields["voice"]),
                `appearance` = PreferencesDtoAppearance.fromWire(fields["appearance"])
            )
        }
    }
}

enum class PreferencesDtoMode(val wireValue: String) : WireValue {
    VALUE_ELDER("elder"),
    VALUE_CHILD("child"),
    VALUE_ACCESSIBLE("accessible");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PreferencesDtoMode {
            ContractValidator.validate("PreferencesDtoMode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class PreferencesDtoVoice(
    val `muted`: Boolean,
    val `rate`: Double
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PreferencesDtoVoice", linkedMapOf(
        "muted" to `muted`,
        "rate" to `rate`
    ))
    companion object {
        fun fromWire(value: Any?): PreferencesDtoVoice {
            ContractValidator.validate("PreferencesDtoVoice", value)
            val fields = wireObject(value)
            return PreferencesDtoVoice(
                `muted` = fields["muted"] as Boolean,
                `rate` = (fields["rate"] as Number).toDouble()
            )
        }
    }
}

data class PreferencesDtoAppearance(
    val `eyes`: PreferencesDtoAppearanceEyes,
    val `mouth`: PreferencesDtoAppearanceMouth,
    val `color`: String,
    val `action`: PreferencesDtoAppearanceAction
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PreferencesDtoAppearance", linkedMapOf(
        "eyes" to `eyes`,
        "mouth" to `mouth`,
        "color" to `color`,
        "action" to `action`
    ))
    companion object {
        fun fromWire(value: Any?): PreferencesDtoAppearance {
            ContractValidator.validate("PreferencesDtoAppearance", value)
            val fields = wireObject(value)
            return PreferencesDtoAppearance(
                `eyes` = PreferencesDtoAppearanceEyes.fromWire(fields["eyes"]),
                `mouth` = PreferencesDtoAppearanceMouth.fromWire(fields["mouth"]),
                `color` = fields["color"] as String,
                `action` = PreferencesDtoAppearanceAction.fromWire(fields["action"])
            )
        }
    }
}

enum class PreferencesDtoAppearanceEyes(val wireValue: String) : WireValue {
    VALUE_ROUND("round"),
    VALUE_HAPPY("happy"),
    VALUE_SLEEPY("sleepy");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PreferencesDtoAppearanceEyes {
            ContractValidator.validate("PreferencesDtoAppearanceEyes", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class PreferencesDtoAppearanceMouth(val wireValue: String) : WireValue {
    VALUE_SMILE("smile"),
    VALUE_SMALL("small"),
    VALUE_OPEN("open");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PreferencesDtoAppearanceMouth {
            ContractValidator.validate("PreferencesDtoAppearanceMouth", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class PreferencesDtoAppearanceAction(val wireValue: String) : WireValue {
    VALUE_IDLE("idle"),
    VALUE_GREETING("greeting"),
    VALUE_CELEBRATING("celebrating");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PreferencesDtoAppearanceAction {
            ContractValidator.validate("PreferencesDtoAppearanceAction", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class UserDto(
    val `user_id`: String,
    val `mode`: UserDtoMode,
    val `profile_label`: String,
    val `preferences`: PreferencesDto,
    val `version`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("UserDto", linkedMapOf(
        "user_id" to `user_id`,
        "mode" to `mode`,
        "profile_label" to `profile_label`,
        "preferences" to `preferences`,
        "version" to `version`
    ))
    companion object {
        fun fromWire(value: Any?): UserDto {
            ContractValidator.validate("UserDto", value)
            val fields = wireObject(value)
            return UserDto(
                `user_id` = fields["user_id"] as String,
                `mode` = UserDtoMode.fromWire(fields["mode"]),
                `profile_label` = fields["profile_label"] as String,
                `preferences` = PreferencesDto.fromWire(fields["preferences"]),
                `version` = (fields["version"] as Number).toLong()
            )
        }
    }
}

enum class UserDtoMode(val wireValue: String) : WireValue {
    VALUE_ELDER("elder"),
    VALUE_CHILD("child"),
    VALUE_ACCESSIBLE("accessible");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): UserDtoMode {
            ContractValidator.validate("UserDtoMode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class DeviceDto(
    val `device_id`: String,
    val `platform`: DeviceDtoPlatform,
    val `status`: DeviceDtoStatus,
    val `last_seen_at`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("DeviceDto", linkedMapOf(
        "device_id" to `device_id`,
        "platform" to `platform`,
        "status" to `status`,
        "last_seen_at" to `last_seen_at`
    ))
    companion object {
        fun fromWire(value: Any?): DeviceDto {
            ContractValidator.validate("DeviceDto", value)
            val fields = wireObject(value)
            return DeviceDto(
                `device_id` = fields["device_id"] as String,
                `platform` = DeviceDtoPlatform.fromWire(fields["platform"]),
                `status` = DeviceDtoStatus.fromWire(fields["status"]),
                `last_seen_at` = if (fields["last_seen_at"] == null) null else fields["last_seen_at"] as String
            )
        }
    }
}

enum class DeviceDtoPlatform(val wireValue: String) : WireValue {
    VALUE_ANDROID("android"),
    VALUE_WINDOWS("windows");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): DeviceDtoPlatform {
            ContractValidator.validate("DeviceDtoPlatform", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class DeviceDtoStatus(val wireValue: String) : WireValue {
    VALUE_BOUND("bound"),
    VALUE_REVOKED("revoked");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): DeviceDtoStatus {
            ContractValidator.validate("DeviceDtoStatus", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class SessionDto(
    val `access_token`: String,
    val `refresh_token`: String,
    val `expires_in`: Long,
    val `account_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SessionDto", linkedMapOf(
        "access_token" to `access_token`,
        "refresh_token" to `refresh_token`,
        "expires_in" to `expires_in`,
        "account_id" to `account_id`
    ))
    companion object {
        fun fromWire(value: Any?): SessionDto {
            ContractValidator.validate("SessionDto", value)
            val fields = wireObject(value)
            return SessionDto(
                `access_token` = fields["access_token"] as String,
                `refresh_token` = fields["refresh_token"] as String,
                `expires_in` = (fields["expires_in"] as Number).toLong(),
                `account_id` = fields["account_id"] as String
            )
        }
    }
}

data class SessionResponse(
    val `session`: SessionDto
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SessionResponse", linkedMapOf(
        "session" to `session`
    ))
    companion object {
        fun fromWire(value: Any?): SessionResponse {
            ContractValidator.validate("SessionResponse", value)
            val fields = wireObject(value)
            return SessionResponse(
                `session` = SessionDto.fromWire(fields["session"])
            )
        }
    }
}

data class CarrierExchangeRequest(
    val `carrier_token`: String,
    val `nonce`: String,
    val `device_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("CarrierExchangeRequest", linkedMapOf(
        "carrier_token" to `carrier_token`,
        "nonce" to `nonce`,
        "device_id" to `device_id`
    ))
    companion object {
        fun fromWire(value: Any?): CarrierExchangeRequest {
            ContractValidator.validate("CarrierExchangeRequest", value)
            val fields = wireObject(value)
            return CarrierExchangeRequest(
                `carrier_token` = fields["carrier_token"] as String,
                `nonce` = fields["nonce"] as String,
                `device_id` = fields["device_id"] as String
            )
        }
    }
}

data class SubjectProfile(
    val `profile_label`: String,
    val `mode`: SubjectProfileMode,
    val `subject_ref`: String,
    val `guardian_consent_id`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SubjectProfile", linkedMapOf(
        "profile_label" to `profile_label`,
        "mode" to `mode`,
        "subject_ref" to `subject_ref`,
        "guardian_consent_id" to `guardian_consent_id`
    ))
    companion object {
        fun fromWire(value: Any?): SubjectProfile {
            ContractValidator.validate("SubjectProfile", value)
            val fields = wireObject(value)
            return SubjectProfile(
                `profile_label` = fields["profile_label"] as String,
                `mode` = SubjectProfileMode.fromWire(fields["mode"]),
                `subject_ref` = fields["subject_ref"] as String,
                `guardian_consent_id` = if (fields["guardian_consent_id"] == null) null else fields["guardian_consent_id"] as String
            )
        }
    }
}

enum class SubjectProfileMode(val wireValue: String) : WireValue {
    VALUE_ELDER("elder"),
    VALUE_CHILD("child"),
    VALUE_ACCESSIBLE("accessible");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): SubjectProfileMode {
            ContractValidator.validate("SubjectProfileMode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ClaimRequest(
    val `method`: ClaimRequestMethod,
    val `subject_profile`: SubjectProfile,
    val `consent_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ClaimRequest", linkedMapOf(
        "method" to `method`,
        "subject_profile" to `subject_profile`,
        "consent_id" to `consent_id`
    ))
    companion object {
        fun fromWire(value: Any?): ClaimRequest {
            ContractValidator.validate("ClaimRequest", value)
            val fields = wireObject(value)
            return ClaimRequest(
                `method` = ClaimRequestMethod.fromWire(fields["method"]),
                `subject_profile` = SubjectProfile.fromWire(fields["subject_profile"]),
                `consent_id` = fields["consent_id"] as String
            )
        }
    }
}

enum class ClaimRequestMethod(val wireValue: String) : WireValue {
    VALUE_FAMILY_ASSISTED("family_assisted"),
    VALUE_COMMUNITY_ASSISTED("community_assisted");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ClaimRequestMethod {
            ContractValidator.validate("ClaimRequestMethod", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ClaimResponse(
    val `claim_id`: String,
    val `expires_at`: String
) : WireObject {
    val `status`: String get() = "pending_confirmation"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ClaimResponse", linkedMapOf(
        "claim_id" to `claim_id`,
        "expires_at" to `expires_at`,
        "status" to `status`
    ))
    companion object {
        fun fromWire(value: Any?): ClaimResponse {
            ContractValidator.validate("ClaimResponse", value)
            val fields = wireObject(value)
            return ClaimResponse(
                `claim_id` = fields["claim_id"] as String,
                `expires_at` = fields["expires_at"] as String
            )
        }
    }
}

data class ClaimConfirmRequest(
    val `proof`: String,
    val `consent_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ClaimConfirmRequest", linkedMapOf(
        "proof" to `proof`,
        "consent_id" to `consent_id`
    ))
    companion object {
        fun fromWire(value: Any?): ClaimConfirmRequest {
            ContractValidator.validate("ClaimConfirmRequest", value)
            val fields = wireObject(value)
            return ClaimConfirmRequest(
                `proof` = fields["proof"] as String,
                `consent_id` = fields["consent_id"] as String
            )
        }
    }
}

data class ClaimConfirmResponse(
    val `account_id`: String,
    val `status`: ClaimConfirmResponseStatus
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ClaimConfirmResponse", linkedMapOf(
        "account_id" to `account_id`,
        "status" to `status`
    ))
    companion object {
        fun fromWire(value: Any?): ClaimConfirmResponse {
            ContractValidator.validate("ClaimConfirmResponse", value)
            val fields = wireObject(value)
            return ClaimConfirmResponse(
                `account_id` = fields["account_id"] as String,
                `status` = ClaimConfirmResponseStatus.fromWire(fields["status"])
            )
        }
    }
}

enum class ClaimConfirmResponseStatus(val wireValue: String) : WireValue {
    VALUE_PENDING_BINDING("pending_binding"),
    VALUE_ACTIVE("active");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ClaimConfirmResponseStatus {
            ContractValidator.validate("ClaimConfirmResponseStatus", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class BindingChallengeRequest(
    val `binding_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BindingChallengeRequest", linkedMapOf(
        "binding_id" to `binding_id`
    ))
    companion object {
        fun fromWire(value: Any?): BindingChallengeRequest {
            ContractValidator.validate("BindingChallengeRequest", value)
            val fields = wireObject(value)
            return BindingChallengeRequest(
                `binding_id` = fields["binding_id"] as String
            )
        }
    }
}

data class DeviceChallengeResponse(
    val `challenge_id`: String,
    val `challenge`: String,
    val `expires_at`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("DeviceChallengeResponse", linkedMapOf(
        "challenge_id" to `challenge_id`,
        "challenge" to `challenge`,
        "expires_at" to `expires_at`
    ))
    companion object {
        fun fromWire(value: Any?): DeviceChallengeResponse {
            ContractValidator.validate("DeviceChallengeResponse", value)
            val fields = wireObject(value)
            return DeviceChallengeResponse(
                `challenge_id` = fields["challenge_id"] as String,
                `challenge` = fields["challenge"] as String,
                `expires_at` = fields["expires_at"] as String
            )
        }
    }
}

data class DeviceExchangeRequest(
    val `challenge_id`: String,
    val `signature`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("DeviceExchangeRequest", linkedMapOf(
        "challenge_id" to `challenge_id`,
        "signature" to `signature`
    ))
    companion object {
        fun fromWire(value: Any?): DeviceExchangeRequest {
            ContractValidator.validate("DeviceExchangeRequest", value)
            val fields = wireObject(value)
            return DeviceExchangeRequest(
                `challenge_id` = fields["challenge_id"] as String,
                `signature` = fields["signature"] as String
            )
        }
    }
}

data class FaceChallengeResponse(
    val `challenge_id`: String,
    val `capture_policy`: FaceChallengeResponseCapturePolicy
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("FaceChallengeResponse", linkedMapOf(
        "challenge_id" to `challenge_id`,
        "capture_policy" to `capture_policy`
    ))
    companion object {
        fun fromWire(value: Any?): FaceChallengeResponse {
            ContractValidator.validate("FaceChallengeResponse", value)
            val fields = wireObject(value)
            return FaceChallengeResponse(
                `challenge_id` = fields["challenge_id"] as String,
                `capture_policy` = FaceChallengeResponseCapturePolicy.fromWire(fields["capture_policy"])
            )
        }
    }
}

data class FaceChallengeResponseCapturePolicy(
    val `policy_version`: String,
    val `expires_at`: String
) : WireObject {
    val `liveness_required`: Boolean get() = true
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("FaceChallengeResponseCapturePolicy", linkedMapOf(
        "policy_version" to `policy_version`,
        "liveness_required" to `liveness_required`,
        "expires_at" to `expires_at`
    ))
    companion object {
        fun fromWire(value: Any?): FaceChallengeResponseCapturePolicy {
            ContractValidator.validate("FaceChallengeResponseCapturePolicy", value)
            val fields = wireObject(value)
            return FaceChallengeResponseCapturePolicy(
                `policy_version` = fields["policy_version"] as String,
                `expires_at` = fields["expires_at"] as String
            )
        }
    }
}

data class FaceExchangeRequest(
    val `challenge_id`: String,
    val `proof_ref`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("FaceExchangeRequest", linkedMapOf(
        "challenge_id" to `challenge_id`,
        "proof_ref" to `proof_ref`
    ))
    companion object {
        fun fromWire(value: Any?): FaceExchangeRequest {
            ContractValidator.validate("FaceExchangeRequest", value)
            val fields = wireObject(value)
            return FaceExchangeRequest(
                `challenge_id` = fields["challenge_id"] as String,
                `proof_ref` = fields["proof_ref"] as String
            )
        }
    }
}

data class RefreshRequest(
    val `refresh_token`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("RefreshRequest", linkedMapOf(
        "refresh_token" to `refresh_token`
    ))
    companion object {
        fun fromWire(value: Any?): RefreshRequest {
            ContractValidator.validate("RefreshRequest", value)
            val fields = wireObject(value)
            return RefreshRequest(
                `refresh_token` = fields["refresh_token"] as String
            )
        }
    }
}

data object RevokedResponse : WireObject {
    val `revoked`: Boolean get() = true
    override fun toWire(): Map<String, Any?> = wireBuild("RevokedResponse", linkedMapOf(
        "revoked" to `revoked`
    ))
        fun fromWire(value: Any?): RevokedResponse {
            ContractValidator.validate("RevokedResponse", value)
            return RevokedResponse
        }
}

data class MeResponse(
    val `user`: UserDto,
    val `devices`: List<DeviceDto>
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("MeResponse", linkedMapOf(
        "user" to `user`,
        "devices" to `devices`
    ))
    companion object {
        fun fromWire(value: Any?): MeResponse {
            ContractValidator.validate("MeResponse", value)
            val fields = wireObject(value)
            return MeResponse(
                `user` = UserDto.fromWire(fields["user"]),
                `devices` = (fields["devices"] as List<*>).map { item -> DeviceDto.fromWire(item) }
            )
        }
    }
}

data class PreferencesRequest(
    val `mode`: PreferencesRequestMode,
    val `preferences`: PreferencesDto
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PreferencesRequest", linkedMapOf(
        "mode" to `mode`,
        "preferences" to `preferences`
    ))
    companion object {
        fun fromWire(value: Any?): PreferencesRequest {
            ContractValidator.validate("PreferencesRequest", value)
            val fields = wireObject(value)
            return PreferencesRequest(
                `mode` = PreferencesRequestMode.fromWire(fields["mode"]),
                `preferences` = PreferencesDto.fromWire(fields["preferences"])
            )
        }
    }
}

enum class PreferencesRequestMode(val wireValue: String) : WireValue {
    VALUE_ELDER("elder"),
    VALUE_CHILD("child"),
    VALUE_ACCESSIBLE("accessible");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PreferencesRequestMode {
            ContractValidator.validate("PreferencesRequestMode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class PreferencesResponse(
    val `user`: UserDto,
    val `version`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PreferencesResponse", linkedMapOf(
        "user" to `user`,
        "version" to `version`
    ))
    companion object {
        fun fromWire(value: Any?): PreferencesResponse {
            ContractValidator.validate("PreferencesResponse", value)
            val fields = wireObject(value)
            return PreferencesResponse(
                `user` = UserDto.fromWire(fields["user"]),
                `version` = (fields["version"] as Number).toLong()
            )
        }
    }
}

data class RelationInvitationRequest(
    val `helper_ref`: String,
    val `requested_scopes`: List<RelationInvitationRequestRequestedScopesItem>
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("RelationInvitationRequest", linkedMapOf(
        "helper_ref" to `helper_ref`,
        "requested_scopes" to `requested_scopes`
    ))
    companion object {
        fun fromWire(value: Any?): RelationInvitationRequest {
            ContractValidator.validate("RelationInvitationRequest", value)
            val fields = wireObject(value)
            return RelationInvitationRequest(
                `helper_ref` = fields["helper_ref"] as String,
                `requested_scopes` = (fields["requested_scopes"] as List<*>).map { item -> RelationInvitationRequestRequestedScopesItem.fromWire(item) }
            )
        }
    }
}

enum class RelationInvitationRequestRequestedScopesItem(val wireValue: String) : WireValue {
    VALUE_LEARNING_READ("learning.read"),
    VALUE_LEARNING_MASTERY_WRITE("learning.mastery.write"),
    VALUE_TODO_WRITE("todo.write"),
    VALUE_ASSIST_REQUEST("assist.request");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): RelationInvitationRequestRequestedScopesItem {
            ContractValidator.validate("RelationInvitationRequestRequestedScopesItem", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class RelationInvitationResponse(
    val `invitation_id`: String,
    val `expires_at`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("RelationInvitationResponse", linkedMapOf(
        "invitation_id" to `invitation_id`,
        "expires_at" to `expires_at`
    ))
    companion object {
        fun fromWire(value: Any?): RelationInvitationResponse {
            ContractValidator.validate("RelationInvitationResponse", value)
            val fields = wireObject(value)
            return RelationInvitationResponse(
                `invitation_id` = fields["invitation_id"] as String,
                `expires_at` = fields["expires_at"] as String
            )
        }
    }
}

data class RelationAcceptRequest(
    val `consent_id`: String,
    val `scopes`: List<RelationAcceptRequestScopesItem>
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("RelationAcceptRequest", linkedMapOf(
        "consent_id" to `consent_id`,
        "scopes" to `scopes`
    ))
    companion object {
        fun fromWire(value: Any?): RelationAcceptRequest {
            ContractValidator.validate("RelationAcceptRequest", value)
            val fields = wireObject(value)
            return RelationAcceptRequest(
                `consent_id` = fields["consent_id"] as String,
                `scopes` = (fields["scopes"] as List<*>).map { item -> RelationAcceptRequestScopesItem.fromWire(item) }
            )
        }
    }
}

enum class RelationAcceptRequestScopesItem(val wireValue: String) : WireValue {
    VALUE_LEARNING_READ("learning.read"),
    VALUE_LEARNING_MASTERY_WRITE("learning.mastery.write"),
    VALUE_TODO_WRITE("todo.write"),
    VALUE_ASSIST_REQUEST("assist.request");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): RelationAcceptRequestScopesItem {
            ContractValidator.validate("RelationAcceptRequestScopesItem", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class RelationDto(
    val `relation_id`: String,
    val `subject_id`: String,
    val `helper_id`: String,
    val `label`: String,
    val `scopes`: List<RelationDtoScopesItem>,
    val `status`: RelationDtoStatus,
    val `grant_revision`: Long,
    val `version`: Long,
    val `created_at`: String,
    val `updated_at`: String,
    val `deleted_at`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("RelationDto", linkedMapOf(
        "relation_id" to `relation_id`,
        "subject_id" to `subject_id`,
        "helper_id" to `helper_id`,
        "label" to `label`,
        "scopes" to `scopes`,
        "status" to `status`,
        "grant_revision" to `grant_revision`,
        "version" to `version`,
        "created_at" to `created_at`,
        "updated_at" to `updated_at`,
        "deleted_at" to `deleted_at`
    ))
    companion object {
        fun fromWire(value: Any?): RelationDto {
            ContractValidator.validate("RelationDto", value)
            val fields = wireObject(value)
            return RelationDto(
                `relation_id` = fields["relation_id"] as String,
                `subject_id` = fields["subject_id"] as String,
                `helper_id` = fields["helper_id"] as String,
                `label` = fields["label"] as String,
                `scopes` = (fields["scopes"] as List<*>).map { item -> RelationDtoScopesItem.fromWire(item) },
                `status` = RelationDtoStatus.fromWire(fields["status"]),
                `grant_revision` = (fields["grant_revision"] as Number).toLong(),
                `version` = (fields["version"] as Number).toLong(),
                `created_at` = fields["created_at"] as String,
                `updated_at` = fields["updated_at"] as String,
                `deleted_at` = if (fields["deleted_at"] == null) null else fields["deleted_at"] as String
            )
        }
    }
}

enum class RelationDtoScopesItem(val wireValue: String) : WireValue {
    VALUE_LEARNING_READ("learning.read"),
    VALUE_LEARNING_MASTERY_WRITE("learning.mastery.write"),
    VALUE_TODO_WRITE("todo.write"),
    VALUE_ASSIST_REQUEST("assist.request");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): RelationDtoScopesItem {
            ContractValidator.validate("RelationDtoScopesItem", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class RelationDtoStatus(val wireValue: String) : WireValue {
    VALUE_ACTIVE("active"),
    VALUE_REVOKED("revoked");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): RelationDtoStatus {
            ContractValidator.validate("RelationDtoStatus", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class RelationResponse(
    val `relation`: RelationDto
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("RelationResponse", linkedMapOf(
        "relation" to `relation`
    ))
    companion object {
        fun fromWire(value: Any?): RelationResponse {
            ContractValidator.validate("RelationResponse", value)
            val fields = wireObject(value)
            return RelationResponse(
                `relation` = RelationDto.fromWire(fields["relation"])
            )
        }
    }
}

data class RelationPage(
    val `items`: List<RelationDto>,
    val `next_cursor`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("RelationPage", linkedMapOf(
        "items" to `items`,
        "next_cursor" to `next_cursor`
    ))
    companion object {
        fun fromWire(value: Any?): RelationPage {
            ContractValidator.validate("RelationPage", value)
            val fields = wireObject(value)
            return RelationPage(
                `items` = (fields["items"] as List<*>).map { item -> RelationDto.fromWire(item) },
                `next_cursor` = if (fields["next_cursor"] == null) null else fields["next_cursor"] as String
            )
        }
    }
}

data class GrantsRequest(
    val `scopes`: List<GrantsRequestScopesItem>,
    val `consent_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("GrantsRequest", linkedMapOf(
        "scopes" to `scopes`,
        "consent_id" to `consent_id`
    ))
    companion object {
        fun fromWire(value: Any?): GrantsRequest {
            ContractValidator.validate("GrantsRequest", value)
            val fields = wireObject(value)
            return GrantsRequest(
                `scopes` = (fields["scopes"] as List<*>).map { item -> GrantsRequestScopesItem.fromWire(item) },
                `consent_id` = fields["consent_id"] as String
            )
        }
    }
}

enum class GrantsRequestScopesItem(val wireValue: String) : WireValue {
    VALUE_LEARNING_READ("learning.read"),
    VALUE_LEARNING_MASTERY_WRITE("learning.mastery.write"),
    VALUE_TODO_WRITE("todo.write"),
    VALUE_ASSIST_REQUEST("assist.request");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): GrantsRequestScopesItem {
            ContractValidator.validate("GrantsRequestScopesItem", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class GrantsResponse(
    val `grant_revision`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("GrantsResponse", linkedMapOf(
        "grant_revision" to `grant_revision`
    ))
    companion object {
        fun fromWire(value: Any?): GrantsResponse {
            ContractValidator.validate("GrantsResponse", value)
            val fields = wireObject(value)
            return GrantsResponse(
                `grant_revision` = (fields["grant_revision"] as Number).toLong()
            )
        }
    }
}

data class RelationRevokedResponse(
    val `revoked_at`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("RelationRevokedResponse", linkedMapOf(
        "revoked_at" to `revoked_at`
    ))
    companion object {
        fun fromWire(value: Any?): RelationRevokedResponse {
            ContractValidator.validate("RelationRevokedResponse", value)
            val fields = wireObject(value)
            return RelationRevokedResponse(
                `revoked_at` = fields["revoked_at"] as String
            )
        }
    }
}

data class ConsentRequest(
    val `purpose`: ConsentRequestPurpose,
    val `scopes`: List<ConsentRequestScopesItem>,
    val `notice_version`: String,
    val `subject_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ConsentRequest", linkedMapOf(
        "purpose" to `purpose`,
        "scopes" to `scopes`,
        "notice_version" to `notice_version`,
        "subject_id" to `subject_id`
    ))
    companion object {
        fun fromWire(value: Any?): ConsentRequest {
            ContractValidator.validate("ConsentRequest", value)
            val fields = wireObject(value)
            return ConsentRequest(
                `purpose` = ConsentRequestPurpose.fromWire(fields["purpose"]),
                `scopes` = (fields["scopes"] as List<*>).map { item -> ConsentRequestScopesItem.fromWire(item) },
                `notice_version` = fields["notice_version"] as String,
                `subject_id` = fields["subject_id"] as String
            )
        }
    }
}

enum class ConsentRequestPurpose(val wireValue: String) : WireValue {
    VALUE_ACCOUNT_CLAIM("account_claim"),
    VALUE_LEARNING_SHARE("learning_share"),
    VALUE_ASSISTANCE("assistance"),
    VALUE_SCREEN_ANALYSIS("screen_analysis"),
    VALUE_GENERATION("generation");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ConsentRequestPurpose {
            ContractValidator.validate("ConsentRequestPurpose", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class ConsentRequestScopesItem(val wireValue: String) : WireValue {
    VALUE_LEARNING_READ("learning.read"),
    VALUE_LEARNING_MASTERY_WRITE("learning.mastery.write"),
    VALUE_TODO_WRITE("todo.write"),
    VALUE_ASSIST_REQUEST("assist.request");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ConsentRequestScopesItem {
            ContractValidator.validate("ConsentRequestScopesItem", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ConsentResponse(
    val `consent_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ConsentResponse", linkedMapOf(
        "consent_id" to `consent_id`
    ))
    companion object {
        fun fromWire(value: Any?): ConsentResponse {
            ContractValidator.validate("ConsentResponse", value)
            val fields = wireObject(value)
            return ConsentResponse(
                `consent_id` = fields["consent_id"] as String
            )
        }
    }
}

data class ConsentWithdrawResponse(
    val `withdrawn_at`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ConsentWithdrawResponse", linkedMapOf(
        "withdrawn_at" to `withdrawn_at`
    ))
    companion object {
        fun fromWire(value: Any?): ConsentWithdrawResponse {
            ContractValidator.validate("ConsentWithdrawResponse", value)
            val fields = wireObject(value)
            return ConsentWithdrawResponse(
                `withdrawn_at` = fields["withdrawn_at"] as String
            )
        }
    }
}

data class ConversationCreateRequest(
    val `mode`: ConversationCreateRequestMode
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ConversationCreateRequest", linkedMapOf(
        "mode" to `mode`
    ))
    companion object {
        fun fromWire(value: Any?): ConversationCreateRequest {
            ContractValidator.validate("ConversationCreateRequest", value)
            val fields = wireObject(value)
            return ConversationCreateRequest(
                `mode` = ConversationCreateRequestMode.fromWire(fields["mode"])
            )
        }
    }
}

enum class ConversationCreateRequestMode(val wireValue: String) : WireValue {
    VALUE_ELDER("elder"),
    VALUE_CHILD("child"),
    VALUE_ACCESSIBLE("accessible");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ConversationCreateRequestMode {
            ContractValidator.validate("ConversationCreateRequestMode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ConversationCreateResponse(
    val `session_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ConversationCreateResponse", linkedMapOf(
        "session_id" to `session_id`
    ))
    companion object {
        fun fromWire(value: Any?): ConversationCreateResponse {
            ContractValidator.validate("ConversationCreateResponse", value)
            val fields = wireObject(value)
            return ConversationCreateResponse(
                `session_id` = fields["session_id"] as String
            )
        }
    }
}

data class ConversationMessageDto(
    val `message_id`: String,
    val `role`: ConversationMessageDtoRole,
    val `text`: String,
    val `state`: ConversationMessageDtoState,
    val `created_at`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ConversationMessageDto", linkedMapOf(
        "message_id" to `message_id`,
        "role" to `role`,
        "text" to `text`,
        "state" to `state`,
        "created_at" to `created_at`
    ))
    companion object {
        fun fromWire(value: Any?): ConversationMessageDto {
            ContractValidator.validate("ConversationMessageDto", value)
            val fields = wireObject(value)
            return ConversationMessageDto(
                `message_id` = fields["message_id"] as String,
                `role` = ConversationMessageDtoRole.fromWire(fields["role"]),
                `text` = fields["text"] as String,
                `state` = ConversationMessageDtoState.fromWire(fields["state"]),
                `created_at` = fields["created_at"] as String
            )
        }
    }
}

enum class ConversationMessageDtoRole(val wireValue: String) : WireValue {
    VALUE_USER("user"),
    VALUE_ASSISTANT("assistant");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ConversationMessageDtoRole {
            ContractValidator.validate("ConversationMessageDtoRole", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class ConversationMessageDtoState(val wireValue: String) : WireValue {
    VALUE_COMPLETED("completed"),
    VALUE_INTERRUPTED("interrupted"),
    VALUE_CANCELLED("cancelled");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ConversationMessageDtoState {
            ContractValidator.validate("ConversationMessageDtoState", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ConversationMessagePage(
    val `items`: List<ConversationMessageDto>,
    val `next_cursor`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ConversationMessagePage", linkedMapOf(
        "items" to `items`,
        "next_cursor" to `next_cursor`
    ))
    companion object {
        fun fromWire(value: Any?): ConversationMessagePage {
            ContractValidator.validate("ConversationMessagePage", value)
            val fields = wireObject(value)
            return ConversationMessagePage(
                `items` = (fields["items"] as List<*>).map { item -> ConversationMessageDto.fromWire(item) },
                `next_cursor` = if (fields["next_cursor"] == null) null else fields["next_cursor"] as String
            )
        }
    }
}

data class ResponseRequest(
    val `input_id`: String,
    val `text`: OptionalField<String> = OptionalField.Absent,
    val `media_refs`: OptionalField<List<String>> = OptionalField.Absent,
    val `generation`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ResponseRequest", linkedMapOf(
        "input_id" to `input_id`,
        "text" to `text`,
        "media_refs" to `media_refs`,
        "generation" to `generation`
    ))
    companion object {
        fun fromWire(value: Any?): ResponseRequest {
            ContractValidator.validate("ResponseRequest", value)
            val fields = wireObject(value)
            return ResponseRequest(
                `input_id` = fields["input_id"] as String,
                `text` = if (fields.containsKey("text")) OptionalField.Present(fields["text"] as String) else OptionalField.Absent,
                `media_refs` = if (fields.containsKey("media_refs")) OptionalField.Present((fields["media_refs"] as List<*>).map { item -> item as String }) else OptionalField.Absent,
                `generation` = (fields["generation"] as Number).toLong()
            )
        }
    }
}

data class ResponseAccepted(
    val `request_id`: String,
    val `stream_path`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ResponseAccepted", linkedMapOf(
        "request_id" to `request_id`,
        "stream_path" to `stream_path`
    ))
    companion object {
        fun fromWire(value: Any?): ResponseAccepted {
            ContractValidator.validate("ResponseAccepted", value)
            val fields = wireObject(value)
            return ResponseAccepted(
                `request_id` = fields["request_id"] as String,
                `stream_path` = fields["stream_path"] as String
            )
        }
    }
}

data object CancelledResponse : WireObject {
    val `status`: String get() = "cancelled"
    override fun toWire(): Map<String, Any?> = wireBuild("CancelledResponse", linkedMapOf(
        "status" to `status`
    ))
        fun fromWire(value: Any?): CancelledResponse {
            ContractValidator.validate("CancelledResponse", value)
            return CancelledResponse
        }
}

data class UploadRequest(
    val `purpose`: UploadRequestPurpose,
    val `mime`: UploadRequestMime,
    val `size`: Long,
    val `hash`: String,
    val `safety_ticket`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("UploadRequest", linkedMapOf(
        "purpose" to `purpose`,
        "mime" to `mime`,
        "size" to `size`,
        "hash" to `hash`,
        "safety_ticket" to `safety_ticket`
    ))
    companion object {
        fun fromWire(value: Any?): UploadRequest {
            ContractValidator.validate("UploadRequest", value)
            val fields = wireObject(value)
            return UploadRequest(
                `purpose` = UploadRequestPurpose.fromWire(fields["purpose"]),
                `mime` = UploadRequestMime.fromWire(fields["mime"]),
                `size` = (fields["size"] as Number).toLong(),
                `hash` = fields["hash"] as String,
                `safety_ticket` = fields["safety_ticket"] as String
            )
        }
    }
}

enum class UploadRequestPurpose(val wireValue: String) : WireValue {
    VALUE_QUESTION("question"),
    VALUE_DRAWING("drawing"),
    VALUE_SAFE_FRAME("safe_frame");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): UploadRequestPurpose {
            ContractValidator.validate("UploadRequestPurpose", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class UploadRequestMime(val wireValue: String) : WireValue {
    VALUE_IMAGE_JPEG("image/jpeg"),
    VALUE_IMAGE_PNG("image/png"),
    VALUE_IMAGE_WEBP("image/webp");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): UploadRequestMime {
            ContractValidator.validate("UploadRequestMime", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class UploadResponse(
    val `upload_id`: String,
    val `upload_path`: String,
    val `expires_at`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("UploadResponse", linkedMapOf(
        "upload_id" to `upload_id`,
        "upload_path" to `upload_path`,
        "expires_at" to `expires_at`
    ))
    companion object {
        fun fromWire(value: Any?): UploadResponse {
            ContractValidator.validate("UploadResponse", value)
            val fields = wireObject(value)
            return UploadResponse(
                `upload_id` = fields["upload_id"] as String,
                `upload_path` = fields["upload_path"] as String,
                `expires_at` = fields["expires_at"] as String
            )
        }
    }
}

data class MediaCommitRequest(
    val `hash`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("MediaCommitRequest", linkedMapOf(
        "hash" to `hash`
    ))
    companion object {
        fun fromWire(value: Any?): MediaCommitRequest {
            ContractValidator.validate("MediaCommitRequest", value)
            val fields = wireObject(value)
            return MediaCommitRequest(
                `hash` = fields["hash"] as String
            )
        }
    }
}

data class MediaCommitResponse(
    val `media_ref`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("MediaCommitResponse", linkedMapOf(
        "media_ref" to `media_ref`
    ))
    companion object {
        fun fromWire(value: Any?): MediaCommitResponse {
            ContractValidator.validate("MediaCommitResponse", value)
            val fields = wireObject(value)
            return MediaCommitResponse(
                `media_ref` = fields["media_ref"] as String
            )
        }
    }
}

data class FrameContextDto(
    val `frame_id`: String,
    val `generation`: Long,
    val `display_id`: String,
    val `window_id`: String,
    val `transform_id`: String,
    val `captured_at`: String,
    val `width`: Long,
    val `height`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("FrameContextDto", linkedMapOf(
        "frame_id" to `frame_id`,
        "generation" to `generation`,
        "display_id" to `display_id`,
        "window_id" to `window_id`,
        "transform_id" to `transform_id`,
        "captured_at" to `captured_at`,
        "width" to `width`,
        "height" to `height`
    ))
    companion object {
        fun fromWire(value: Any?): FrameContextDto {
            ContractValidator.validate("FrameContextDto", value)
            val fields = wireObject(value)
            return FrameContextDto(
                `frame_id` = fields["frame_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `display_id` = fields["display_id"] as String,
                `window_id` = fields["window_id"] as String,
                `transform_id` = fields["transform_id"] as String,
                `captured_at` = fields["captured_at"] as String,
                `width` = (fields["width"] as Number).toLong(),
                `height` = (fields["height"] as Number).toLong()
            )
        }
    }
}

data class LocalFeaturesDto(
    val `scene`: LocalFeaturesDtoScene,
    val `confidence`: Double,
    val `detector_version`: String
) : WireObject {
    val `safety_state`: String get() = "safe"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("LocalFeaturesDto", linkedMapOf(
        "scene" to `scene`,
        "confidence" to `confidence`,
        "detector_version" to `detector_version`,
        "safety_state" to `safety_state`
    ))
    companion object {
        fun fromWire(value: Any?): LocalFeaturesDto {
            ContractValidator.validate("LocalFeaturesDto", value)
            val fields = wireObject(value)
            return LocalFeaturesDto(
                `scene` = LocalFeaturesDtoScene.fromWire(fields["scene"]),
                `confidence` = (fields["confidence"] as Number).toDouble(),
                `detector_version` = fields["detector_version"] as String
            )
        }
    }
}

enum class LocalFeaturesDtoScene(val wireValue: String) : WireValue {
    VALUE_SETTINGS("settings"),
    VALUE_CAMERA("camera"),
    VALUE_OTHER("other"),
    VALUE_UNKNOWN("unknown");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): LocalFeaturesDtoScene {
            ContractValidator.validate("LocalFeaturesDtoScene", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class GuidanceCreateRequest(
    val `goal`: String,
    val `flow_hint`: OptionalField<String> = OptionalField.Absent
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("GuidanceCreateRequest", linkedMapOf(
        "goal" to `goal`,
        "flow_hint" to `flow_hint`
    ))
    companion object {
        fun fromWire(value: Any?): GuidanceCreateRequest {
            ContractValidator.validate("GuidanceCreateRequest", value)
            val fields = wireObject(value)
            return GuidanceCreateRequest(
                `goal` = fields["goal"] as String,
                `flow_hint` = if (fields.containsKey("flow_hint")) OptionalField.Present(fields["flow_hint"] as String) else OptionalField.Absent
            )
        }
    }
}

data class GuidanceCreateResponse(
    val `guide_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("GuidanceCreateResponse", linkedMapOf(
        "guide_id" to `guide_id`
    ))
    companion object {
        fun fromWire(value: Any?): GuidanceCreateResponse {
            ContractValidator.validate("GuidanceCreateResponse", value)
            val fields = wireObject(value)
            return GuidanceCreateResponse(
                `guide_id` = fields["guide_id"] as String
            )
        }
    }
}

data class GuidanceAnalyzeRequest(
    val `frame_ref`: String,
    val `frame_context`: FrameContextDto,
    val `local_features`: LocalFeaturesDto,
    val `consent_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("GuidanceAnalyzeRequest", linkedMapOf(
        "frame_ref" to `frame_ref`,
        "frame_context" to `frame_context`,
        "local_features" to `local_features`,
        "consent_id" to `consent_id`
    ))
    companion object {
        fun fromWire(value: Any?): GuidanceAnalyzeRequest {
            ContractValidator.validate("GuidanceAnalyzeRequest", value)
            val fields = wireObject(value)
            return GuidanceAnalyzeRequest(
                `frame_ref` = fields["frame_ref"] as String,
                `frame_context` = FrameContextDto.fromWire(fields["frame_context"]),
                `local_features` = LocalFeaturesDto.fromWire(fields["local_features"]),
                `consent_id` = fields["consent_id"] as String
            )
        }
    }
}

data class RequestAccepted(
    val `request_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("RequestAccepted", linkedMapOf(
        "request_id" to `request_id`
    ))
    companion object {
        fun fromWire(value: Any?): RequestAccepted {
            ContractValidator.validate("RequestAccepted", value)
            val fields = wireObject(value)
            return RequestAccepted(
                `request_id` = fields["request_id"] as String
            )
        }
    }
}

data class GuidanceVerifyRequest(
    val `step_id`: String,
    val `verification_id`: String,
    val `new_frame_context`: FrameContextDto,
    val `observed_features`: LocalFeaturesDto
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("GuidanceVerifyRequest", linkedMapOf(
        "step_id" to `step_id`,
        "verification_id" to `verification_id`,
        "new_frame_context" to `new_frame_context`,
        "observed_features" to `observed_features`
    ))
    companion object {
        fun fromWire(value: Any?): GuidanceVerifyRequest {
            ContractValidator.validate("GuidanceVerifyRequest", value)
            val fields = wireObject(value)
            return GuidanceVerifyRequest(
                `step_id` = fields["step_id"] as String,
                `verification_id` = fields["verification_id"] as String,
                `new_frame_context` = FrameContextDto.fromWire(fields["new_frame_context"]),
                `observed_features` = LocalFeaturesDto.fromWire(fields["observed_features"])
            )
        }
    }
}

data class GuidanceVerifyResponse(
    val `result`: GuidanceVerifyResponseResult,
    val `next_state`: GuidanceVerifyResponseNextState
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("GuidanceVerifyResponse", linkedMapOf(
        "result" to `result`,
        "next_state" to `next_state`
    ))
    companion object {
        fun fromWire(value: Any?): GuidanceVerifyResponse {
            ContractValidator.validate("GuidanceVerifyResponse", value)
            val fields = wireObject(value)
            return GuidanceVerifyResponse(
                `result` = GuidanceVerifyResponseResult.fromWire(fields["result"]),
                `next_state` = GuidanceVerifyResponseNextState.fromWire(fields["next_state"])
            )
        }
    }
}

enum class GuidanceVerifyResponseResult(val wireValue: String) : WireValue {
    VALUE_MATCHED("matched"),
    VALUE_UNMATCHED("unmatched"),
    VALUE_UNCERTAIN("uncertain");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): GuidanceVerifyResponseResult {
            ContractValidator.validate("GuidanceVerifyResponseResult", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class GuidanceVerifyResponseNextState(val wireValue: String) : WireValue {
    VALUE_ANALYZING("analyzing"),
    VALUE_AWAIT_ACTION("await_action"),
    VALUE_NEED_HELP("need_help"),
    VALUE_RISK_PAUSED("risk_paused"),
    VALUE_COMPLETED("completed");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): GuidanceVerifyResponseNextState {
            ContractValidator.validate("GuidanceVerifyResponseNextState", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data object EndedResponse : WireObject {
    val `ended`: Boolean get() = true
    override fun toWire(): Map<String, Any?> = wireBuild("EndedResponse", linkedMapOf(
        "ended" to `ended`
    ))
        fun fromWire(value: Any?): EndedResponse {
            ContractValidator.validate("EndedResponse", value)
            return EndedResponse
        }
}

data class NoteDto(
    val `note_id`: String,
    val `owner_id`: String,
    val `asked_at`: String,
    val `question`: String,
    val `topic`: String,
    val `answer_summary`: String,
    val `mastery`: NoteDtoMastery,
    val `mastery_source`: NoteDtoMasterySource?,
    val `reviewed_at`: String?,
    val `source`: NoteDtoSource,
    val `source_session_id`: String?,
    val `version`: Long,
    val `created_at`: String,
    val `updated_at`: String,
    val `deleted_at`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("NoteDto", linkedMapOf(
        "note_id" to `note_id`,
        "owner_id" to `owner_id`,
        "asked_at" to `asked_at`,
        "question" to `question`,
        "topic" to `topic`,
        "answer_summary" to `answer_summary`,
        "mastery" to `mastery`,
        "mastery_source" to `mastery_source`,
        "reviewed_at" to `reviewed_at`,
        "source" to `source`,
        "source_session_id" to `source_session_id`,
        "version" to `version`,
        "created_at" to `created_at`,
        "updated_at" to `updated_at`,
        "deleted_at" to `deleted_at`
    ))
    companion object {
        fun fromWire(value: Any?): NoteDto {
            ContractValidator.validate("NoteDto", value)
            val fields = wireObject(value)
            return NoteDto(
                `note_id` = fields["note_id"] as String,
                `owner_id` = fields["owner_id"] as String,
                `asked_at` = fields["asked_at"] as String,
                `question` = fields["question"] as String,
                `topic` = fields["topic"] as String,
                `answer_summary` = fields["answer_summary"] as String,
                `mastery` = NoteDtoMastery.fromWire(fields["mastery"]),
                `mastery_source` = if (fields["mastery_source"] == null) null else NoteDtoMasterySource.fromWire(fields["mastery_source"]),
                `reviewed_at` = if (fields["reviewed_at"] == null) null else fields["reviewed_at"] as String,
                `source` = NoteDtoSource.fromWire(fields["source"]),
                `source_session_id` = if (fields["source_session_id"] == null) null else fields["source_session_id"] as String,
                `version` = (fields["version"] as Number).toLong(),
                `created_at` = fields["created_at"] as String,
                `updated_at` = fields["updated_at"] as String,
                `deleted_at` = if (fields["deleted_at"] == null) null else fields["deleted_at"] as String
            )
        }
    }
}

enum class NoteDtoMastery(val wireValue: String) : WireValue {
    VALUE_UNMASTERED("unmastered"),
    VALUE_MASTERED("mastered");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): NoteDtoMastery {
            ContractValidator.validate("NoteDtoMastery", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class NoteDtoMasterySource(val wireValue: String) : WireValue {
    VALUE_SELF("self"),
    VALUE_AUTHORIZED_FAMILY("authorized_family");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): NoteDtoMasterySource {
            ContractValidator.validate("NoteDtoMasterySource", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class NoteDtoSource(val wireValue: String) : WireValue {
    VALUE_DEMO("demo"),
    VALUE_CONVERSATION("conversation"),
    VALUE_GUIDANCE("guidance");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): NoteDtoSource {
            ContractValidator.validate("NoteDtoSource", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class NoteCreateRequest(
    val `asked_at`: String,
    val `question`: String,
    val `topic`: String,
    val `answer_summary`: String,
    val `source_session_id`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("NoteCreateRequest", linkedMapOf(
        "asked_at" to `asked_at`,
        "question" to `question`,
        "topic" to `topic`,
        "answer_summary" to `answer_summary`,
        "source_session_id" to `source_session_id`
    ))
    companion object {
        fun fromWire(value: Any?): NoteCreateRequest {
            ContractValidator.validate("NoteCreateRequest", value)
            val fields = wireObject(value)
            return NoteCreateRequest(
                `asked_at` = fields["asked_at"] as String,
                `question` = fields["question"] as String,
                `topic` = fields["topic"] as String,
                `answer_summary` = fields["answer_summary"] as String,
                `source_session_id` = if (fields["source_session_id"] == null) null else fields["source_session_id"] as String
            )
        }
    }
}

data class NoteResponse(
    val `note`: NoteDto,
    val `version`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("NoteResponse", linkedMapOf(
        "note" to `note`,
        "version" to `version`
    ))
    companion object {
        fun fromWire(value: Any?): NoteResponse {
            ContractValidator.validate("NoteResponse", value)
            val fields = wireObject(value)
            return NoteResponse(
                `note` = NoteDto.fromWire(fields["note"]),
                `version` = (fields["version"] as Number).toLong()
            )
        }
    }
}

data class NotePage(
    val `items`: List<NoteDto>,
    val `next_cursor`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("NotePage", linkedMapOf(
        "items" to `items`,
        "next_cursor" to `next_cursor`
    ))
    companion object {
        fun fromWire(value: Any?): NotePage {
            ContractValidator.validate("NotePage", value)
            val fields = wireObject(value)
            return NotePage(
                `items` = (fields["items"] as List<*>).map { item -> NoteDto.fromWire(item) },
                `next_cursor` = if (fields["next_cursor"] == null) null else fields["next_cursor"] as String
            )
        }
    }
}

data class NoteUpdateRequest(
    val `answer_summary`: OptionalField<String> = OptionalField.Absent,
    val `mastery`: OptionalField<NoteUpdateRequestMastery> = OptionalField.Absent,
    val `mastery_source`: OptionalField<NoteUpdateRequestMasterySource> = OptionalField.Absent
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("NoteUpdateRequest", linkedMapOf(
        "answer_summary" to `answer_summary`,
        "mastery" to `mastery`,
        "mastery_source" to `mastery_source`
    ))
    companion object {
        fun fromWire(value: Any?): NoteUpdateRequest {
            ContractValidator.validate("NoteUpdateRequest", value)
            val fields = wireObject(value)
            return NoteUpdateRequest(
                `answer_summary` = if (fields.containsKey("answer_summary")) OptionalField.Present(fields["answer_summary"] as String) else OptionalField.Absent,
                `mastery` = if (fields.containsKey("mastery")) OptionalField.Present(NoteUpdateRequestMastery.fromWire(fields["mastery"])) else OptionalField.Absent,
                `mastery_source` = if (fields.containsKey("mastery_source")) OptionalField.Present(NoteUpdateRequestMasterySource.fromWire(fields["mastery_source"])) else OptionalField.Absent
            )
        }
    }
}

enum class NoteUpdateRequestMastery(val wireValue: String) : WireValue {
    VALUE_UNMASTERED("unmastered"),
    VALUE_MASTERED("mastered");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): NoteUpdateRequestMastery {
            ContractValidator.validate("NoteUpdateRequestMastery", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class NoteUpdateRequestMasterySource(val wireValue: String) : WireValue {
    VALUE_SELF("self"),
    VALUE_AUTHORIZED_FAMILY("authorized_family");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): NoteUpdateRequestMasterySource {
            ContractValidator.validate("NoteUpdateRequestMasterySource", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class NoteDeletedResponse(
    val `deleted_at`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("NoteDeletedResponse", linkedMapOf(
        "deleted_at" to `deleted_at`
    ))
    companion object {
        fun fromWire(value: Any?): NoteDeletedResponse {
            ContractValidator.validate("NoteDeletedResponse", value)
            val fields = wireObject(value)
            return NoteDeletedResponse(
                `deleted_at` = fields["deleted_at"] as String
            )
        }
    }
}

data class ReviewRequest(
    val `result`: ReviewRequestResult,
    val `todo_id`: String?,
    val `evidence_kind`: ReviewRequestEvidenceKind
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ReviewRequest", linkedMapOf(
        "result" to `result`,
        "todo_id" to `todo_id`,
        "evidence_kind" to `evidence_kind`
    ))
    companion object {
        fun fromWire(value: Any?): ReviewRequest {
            ContractValidator.validate("ReviewRequest", value)
            val fields = wireObject(value)
            return ReviewRequest(
                `result` = ReviewRequestResult.fromWire(fields["result"]),
                `todo_id` = if (fields["todo_id"] == null) null else fields["todo_id"] as String,
                `evidence_kind` = ReviewRequestEvidenceKind.fromWire(fields["evidence_kind"])
            )
        }
    }
}

enum class ReviewRequestResult(val wireValue: String) : WireValue {
    VALUE_PRACTICED("practiced"),
    VALUE_VERIFIED("verified"),
    VALUE_ABORTED("aborted");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ReviewRequestResult {
            ContractValidator.validate("ReviewRequestResult", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class ReviewRequestEvidenceKind(val wireValue: String) : WireValue {
    VALUE_USER_CONFIRMATION("user_confirmation"),
    VALUE_INDEPENDENT_REPRODUCTION("independent_reproduction"),
    VALUE_NONE("none");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ReviewRequestEvidenceKind {
            ContractValidator.validate("ReviewRequestEvidenceKind", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ReviewResponse(
    val `review_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ReviewResponse", linkedMapOf(
        "review_id" to `review_id`
    ))
    companion object {
        fun fromWire(value: Any?): ReviewResponse {
            ContractValidator.validate("ReviewResponse", value)
            val fields = wireObject(value)
            return ReviewResponse(
                `review_id` = fields["review_id"] as String
            )
        }
    }
}

data class RepeatRule(
    val `frequency`: RepeatRuleFrequency,
    val `interval`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("RepeatRule", linkedMapOf(
        "frequency" to `frequency`,
        "interval" to `interval`
    ))
    companion object {
        fun fromWire(value: Any?): RepeatRule {
            ContractValidator.validate("RepeatRule", value)
            val fields = wireObject(value)
            return RepeatRule(
                `frequency` = RepeatRuleFrequency.fromWire(fields["frequency"]),
                `interval` = (fields["interval"] as Number).toLong()
            )
        }
    }
}

enum class RepeatRuleFrequency(val wireValue: String) : WireValue {
    VALUE_NONE("none"),
    VALUE_DAILY("daily"),
    VALUE_WEEKLY("weekly");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): RepeatRuleFrequency {
            ContractValidator.validate("RepeatRuleFrequency", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class TodoDto(
    val `todo_id`: String,
    val `owner_id`: String,
    val `creator_id`: String,
    val `title`: String,
    val `note_id`: String?,
    val `timezone`: String,
    val `remind_at`: String,
    val `repeat_rule`: RepeatRule,
    val `status`: TodoDtoStatus,
    val `completed_at`: String?,
    val `source`: TodoDtoSource,
    val `next_fire_at`: String?,
    val `version`: Long,
    val `created_at`: String,
    val `updated_at`: String,
    val `deleted_at`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("TodoDto", linkedMapOf(
        "todo_id" to `todo_id`,
        "owner_id" to `owner_id`,
        "creator_id" to `creator_id`,
        "title" to `title`,
        "note_id" to `note_id`,
        "timezone" to `timezone`,
        "remind_at" to `remind_at`,
        "repeat_rule" to `repeat_rule`,
        "status" to `status`,
        "completed_at" to `completed_at`,
        "source" to `source`,
        "next_fire_at" to `next_fire_at`,
        "version" to `version`,
        "created_at" to `created_at`,
        "updated_at" to `updated_at`,
        "deleted_at" to `deleted_at`
    ))
    companion object {
        fun fromWire(value: Any?): TodoDto {
            ContractValidator.validate("TodoDto", value)
            val fields = wireObject(value)
            return TodoDto(
                `todo_id` = fields["todo_id"] as String,
                `owner_id` = fields["owner_id"] as String,
                `creator_id` = fields["creator_id"] as String,
                `title` = fields["title"] as String,
                `note_id` = if (fields["note_id"] == null) null else fields["note_id"] as String,
                `timezone` = fields["timezone"] as String,
                `remind_at` = fields["remind_at"] as String,
                `repeat_rule` = RepeatRule.fromWire(fields["repeat_rule"]),
                `status` = TodoDtoStatus.fromWire(fields["status"]),
                `completed_at` = if (fields["completed_at"] == null) null else fields["completed_at"] as String,
                `source` = TodoDtoSource.fromWire(fields["source"]),
                `next_fire_at` = if (fields["next_fire_at"] == null) null else fields["next_fire_at"] as String,
                `version` = (fields["version"] as Number).toLong(),
                `created_at` = fields["created_at"] as String,
                `updated_at` = fields["updated_at"] as String,
                `deleted_at` = if (fields["deleted_at"] == null) null else fields["deleted_at"] as String
            )
        }
    }
}

enum class TodoDtoStatus(val wireValue: String) : WireValue {
    VALUE_PENDING("pending"),
    VALUE_COMPLETED("completed"),
    VALUE_CANCELLED("cancelled");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): TodoDtoStatus {
            ContractValidator.validate("TodoDtoStatus", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class TodoDtoSource(val wireValue: String) : WireValue {
    VALUE_SELF("self"),
    VALUE_REVIEW("review"),
    VALUE_AUTHORIZED_FAMILY("authorized_family");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): TodoDtoSource {
            ContractValidator.validate("TodoDtoSource", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class TodoCreateRequest(
    val `title`: String,
    val `note_id`: String?,
    val `remind_at`: String,
    val `timezone`: String,
    val `repeat_rule`: RepeatRule
) : WireObject {
    val `time_confirmed`: Boolean get() = true
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("TodoCreateRequest", linkedMapOf(
        "title" to `title`,
        "note_id" to `note_id`,
        "remind_at" to `remind_at`,
        "timezone" to `timezone`,
        "repeat_rule" to `repeat_rule`,
        "time_confirmed" to `time_confirmed`
    ))
    companion object {
        fun fromWire(value: Any?): TodoCreateRequest {
            ContractValidator.validate("TodoCreateRequest", value)
            val fields = wireObject(value)
            return TodoCreateRequest(
                `title` = fields["title"] as String,
                `note_id` = if (fields["note_id"] == null) null else fields["note_id"] as String,
                `remind_at` = fields["remind_at"] as String,
                `timezone` = fields["timezone"] as String,
                `repeat_rule` = RepeatRule.fromWire(fields["repeat_rule"])
            )
        }
    }
}

data class TodoPatch(
    val `title`: OptionalField<String> = OptionalField.Absent,
    val `note_id`: OptionalField<String?> = OptionalField.Absent,
    val `remind_at`: OptionalField<String> = OptionalField.Absent,
    val `timezone`: OptionalField<String> = OptionalField.Absent,
    val `repeat_rule`: OptionalField<RepeatRule> = OptionalField.Absent,
    val `time_confirmed`: OptionalField<Boolean> = OptionalField.Absent
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("TodoPatch", linkedMapOf(
        "title" to `title`,
        "note_id" to `note_id`,
        "remind_at" to `remind_at`,
        "timezone" to `timezone`,
        "repeat_rule" to `repeat_rule`,
        "time_confirmed" to `time_confirmed`
    ))
    companion object {
        fun fromWire(value: Any?): TodoPatch {
            ContractValidator.validate("TodoPatch", value)
            val fields = wireObject(value)
            return TodoPatch(
                `title` = if (fields.containsKey("title")) OptionalField.Present(fields["title"] as String) else OptionalField.Absent,
                `note_id` = if (fields.containsKey("note_id")) OptionalField.Present(if (fields["note_id"] == null) null else fields["note_id"] as String) else OptionalField.Absent,
                `remind_at` = if (fields.containsKey("remind_at")) OptionalField.Present(fields["remind_at"] as String) else OptionalField.Absent,
                `timezone` = if (fields.containsKey("timezone")) OptionalField.Present(fields["timezone"] as String) else OptionalField.Absent,
                `repeat_rule` = if (fields.containsKey("repeat_rule")) OptionalField.Present(RepeatRule.fromWire(fields["repeat_rule"])) else OptionalField.Absent,
                `time_confirmed` = if (fields.containsKey("time_confirmed")) OptionalField.Present(fields["time_confirmed"] as Boolean) else OptionalField.Absent
            )
        }
    }
}

data class TodoUpdateRequest(
    val `patch`: TodoPatch
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("TodoUpdateRequest", linkedMapOf(
        "patch" to `patch`
    ))
    companion object {
        fun fromWire(value: Any?): TodoUpdateRequest {
            ContractValidator.validate("TodoUpdateRequest", value)
            val fields = wireObject(value)
            return TodoUpdateRequest(
                `patch` = TodoPatch.fromWire(fields["patch"])
            )
        }
    }
}

data class TodoResponse(
    val `todo`: TodoDto,
    val `version`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("TodoResponse", linkedMapOf(
        "todo" to `todo`,
        "version" to `version`
    ))
    companion object {
        fun fromWire(value: Any?): TodoResponse {
            ContractValidator.validate("TodoResponse", value)
            val fields = wireObject(value)
            return TodoResponse(
                `todo` = TodoDto.fromWire(fields["todo"]),
                `version` = (fields["version"] as Number).toLong()
            )
        }
    }
}

data class TodoPage(
    val `items`: List<TodoDto>,
    val `next_cursor`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("TodoPage", linkedMapOf(
        "items" to `items`,
        "next_cursor" to `next_cursor`
    ))
    companion object {
        fun fromWire(value: Any?): TodoPage {
            ContractValidator.validate("TodoPage", value)
            val fields = wireObject(value)
            return TodoPage(
                `items` = (fields["items"] as List<*>).map { item -> TodoDto.fromWire(item) },
                `next_cursor` = if (fields["next_cursor"] == null) null else fields["next_cursor"] as String
            )
        }
    }
}

data object TodoCancelledResponse : WireObject {
    val `cancelled`: Boolean get() = true
    override fun toWire(): Map<String, Any?> = wireBuild("TodoCancelledResponse", linkedMapOf(
        "cancelled" to `cancelled`
    ))
        fun fromWire(value: Any?): TodoCancelledResponse {
            ContractValidator.validate("TodoCancelledResponse", value)
            return TodoCancelledResponse
        }
}

data class OccurrenceCompleteResponse(
    val `next_fire_at`: String?
) : WireObject {
    val `result`: String get() = "completed"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("OccurrenceCompleteResponse", linkedMapOf(
        "result" to `result`,
        "next_fire_at" to `next_fire_at`
    ))
    companion object {
        fun fromWire(value: Any?): OccurrenceCompleteResponse {
            ContractValidator.validate("OccurrenceCompleteResponse", value)
            val fields = wireObject(value)
            return OccurrenceCompleteResponse(
                `next_fire_at` = if (fields["next_fire_at"] == null) null else fields["next_fire_at"] as String
            )
        }
    }
}

data class ReceiptRequest(
    val `device_id`: String,
    val `channel`: ReceiptRequestChannel,
    val `state`: ReceiptRequestState
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ReceiptRequest", linkedMapOf(
        "device_id" to `device_id`,
        "channel" to `channel`,
        "state" to `state`
    ))
    companion object {
        fun fromWire(value: Any?): ReceiptRequest {
            ContractValidator.validate("ReceiptRequest", value)
            val fields = wireObject(value)
            return ReceiptRequest(
                `device_id` = fields["device_id"] as String,
                `channel` = ReceiptRequestChannel.fromWire(fields["channel"]),
                `state` = ReceiptRequestState.fromWire(fields["state"])
            )
        }
    }
}

enum class ReceiptRequestChannel(val wireValue: String) : WireValue {
    VALUE_LOCAL("local"),
    VALUE_PUSH("push");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ReceiptRequestChannel {
            ContractValidator.validate("ReceiptRequestChannel", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class ReceiptRequestState(val wireValue: String) : WireValue {
    VALUE_SUBMITTED("submitted"),
    VALUE_DELIVERED("delivered"),
    VALUE_OPENED("opened"),
    VALUE_FAILED("failed"),
    VALUE_MISSED("missed"),
    VALUE_UNKNOWN("unknown");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ReceiptRequestState {
            ContractValidator.validate("ReceiptRequestState", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data object AcceptedResponse : WireObject {
    val `accepted`: Boolean get() = true
    override fun toWire(): Map<String, Any?> = wireBuild("AcceptedResponse", linkedMapOf(
        "accepted" to `accepted`
    ))
        fun fromWire(value: Any?): AcceptedResponse {
            ContractValidator.validate("AcceptedResponse", value)
            return AcceptedResponse
        }
}

data class PetJobRequest(
    val `input_ref`: String,
    val `appearance`: PetJobRequestAppearance
) : WireObject {
    val `source`: String get() = "drawing"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetJobRequest", linkedMapOf(
        "source" to `source`,
        "input_ref" to `input_ref`,
        "appearance" to `appearance`
    ))
    companion object {
        fun fromWire(value: Any?): PetJobRequest {
            ContractValidator.validate("PetJobRequest", value)
            val fields = wireObject(value)
            return PetJobRequest(
                `input_ref` = fields["input_ref"] as String,
                `appearance` = PetJobRequestAppearance.fromWire(fields["appearance"])
            )
        }
    }
}

data class PetJobRequestAppearance(
    val `eyes`: PetJobRequestAppearanceEyes,
    val `mouth`: PetJobRequestAppearanceMouth,
    val `color`: String,
    val `action`: PetJobRequestAppearanceAction
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetJobRequestAppearance", linkedMapOf(
        "eyes" to `eyes`,
        "mouth" to `mouth`,
        "color" to `color`,
        "action" to `action`
    ))
    companion object {
        fun fromWire(value: Any?): PetJobRequestAppearance {
            ContractValidator.validate("PetJobRequestAppearance", value)
            val fields = wireObject(value)
            return PetJobRequestAppearance(
                `eyes` = PetJobRequestAppearanceEyes.fromWire(fields["eyes"]),
                `mouth` = PetJobRequestAppearanceMouth.fromWire(fields["mouth"]),
                `color` = fields["color"] as String,
                `action` = PetJobRequestAppearanceAction.fromWire(fields["action"])
            )
        }
    }
}

enum class PetJobRequestAppearanceEyes(val wireValue: String) : WireValue {
    VALUE_ROUND("round"),
    VALUE_HAPPY("happy"),
    VALUE_SLEEPY("sleepy");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetJobRequestAppearanceEyes {
            ContractValidator.validate("PetJobRequestAppearanceEyes", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class PetJobRequestAppearanceMouth(val wireValue: String) : WireValue {
    VALUE_SMILE("smile"),
    VALUE_SMALL("small"),
    VALUE_OPEN("open");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetJobRequestAppearanceMouth {
            ContractValidator.validate("PetJobRequestAppearanceMouth", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class PetJobRequestAppearanceAction(val wireValue: String) : WireValue {
    VALUE_IDLE("idle"),
    VALUE_GREETING("greeting"),
    VALUE_CELEBRATING("celebrating");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetJobRequestAppearanceAction {
            ContractValidator.validate("PetJobRequestAppearanceAction", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class PetJobCreated(
    val `job_id`: String
) : WireObject {
    val `status`: String get() = "queued"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetJobCreated", linkedMapOf(
        "job_id" to `job_id`,
        "status" to `status`
    ))
    companion object {
        fun fromWire(value: Any?): PetJobCreated {
            ContractValidator.validate("PetJobCreated", value)
            val fields = wireObject(value)
            return PetJobCreated(
                `job_id` = fields["job_id"] as String
            )
        }
    }
}

data class AssetDto(
    val `asset_id`: String,
    val `kind`: AssetDtoKind,
    val `manifest_ref`: String,
    val `hash`: String
) : WireObject {
    val `validated`: Boolean get() = true
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssetDto", linkedMapOf(
        "asset_id" to `asset_id`,
        "kind" to `kind`,
        "manifest_ref" to `manifest_ref`,
        "validated" to `validated`,
        "hash" to `hash`
    ))
    companion object {
        fun fromWire(value: Any?): AssetDto {
            ContractValidator.validate("AssetDto", value)
            val fields = wireObject(value)
            return AssetDto(
                `asset_id` = fields["asset_id"] as String,
                `kind` = AssetDtoKind.fromWire(fields["kind"]),
                `manifest_ref` = fields["manifest_ref"] as String,
                `hash` = fields["hash"] as String
            )
        }
    }
}

enum class AssetDtoKind(val wireValue: String) : WireValue {
    VALUE_ANIMATED_2D("animated_2d"),
    VALUE_LOCAL_3D("local_3d");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): AssetDtoKind {
            ContractValidator.validate("AssetDtoKind", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class PetJobDto(
    val `job_id`: String,
    val `status`: PetJobDtoStatus,
    val `progress`: Long,
    val `assets`: List<AssetDto>,
    val `generation`: Long,
    val `error`: PetJobDtoError?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetJobDto", linkedMapOf(
        "job_id" to `job_id`,
        "status" to `status`,
        "progress" to `progress`,
        "assets" to `assets`,
        "generation" to `generation`,
        "error" to `error`
    ))
    companion object {
        fun fromWire(value: Any?): PetJobDto {
            ContractValidator.validate("PetJobDto", value)
            val fields = wireObject(value)
            return PetJobDto(
                `job_id` = fields["job_id"] as String,
                `status` = PetJobDtoStatus.fromWire(fields["status"]),
                `progress` = (fields["progress"] as Number).toLong(),
                `assets` = (fields["assets"] as List<*>).map { item -> AssetDto.fromWire(item) },
                `generation` = (fields["generation"] as Number).toLong(),
                `error` = if (fields["error"] == null) null else PetJobDtoError.fromWire(fields["error"])
            )
        }
    }
}

enum class PetJobDtoStatus(val wireValue: String) : WireValue {
    VALUE_QUEUED("queued"),
    VALUE_PROCESSING("processing"),
    VALUE_SUCCEEDED("succeeded"),
    VALUE_FAILED("failed"),
    VALUE_CANCELLED("cancelled");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetJobDtoStatus {
            ContractValidator.validate("PetJobDtoStatus", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class PetJobDtoError(
    val `code`: PetJobDtoErrorCode,
    val `message`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetJobDtoError", linkedMapOf(
        "code" to `code`,
        "message" to `message`
    ))
    companion object {
        fun fromWire(value: Any?): PetJobDtoError {
            ContractValidator.validate("PetJobDtoError", value)
            val fields = wireObject(value)
            return PetJobDtoError(
                `code` = PetJobDtoErrorCode.fromWire(fields["code"]),
                `message` = fields["message"] as String
            )
        }
    }
}

enum class PetJobDtoErrorCode(val wireValue: String) : WireValue {
    VALUE_PROVIDER_UNAVAILABLE("PROVIDER_UNAVAILABLE"),
    VALUE_RATE_LIMITED("RATE_LIMITED"),
    VALUE_CANCELLED("CANCELLED");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetJobDtoErrorCode {
            ContractValidator.validate("PetJobDtoErrorCode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data object PetJobCancelled : WireObject {
    val `status`: String get() = "cancelled"
    override fun toWire(): Map<String, Any?> = wireBuild("PetJobCancelled", linkedMapOf(
        "status" to `status`
    ))
        fun fromWire(value: Any?): PetJobCancelled {
            ContractValidator.validate("PetJobCancelled", value)
            return PetJobCancelled
        }
}

data class PetDto(
    val `asset_id`: String,
    val `fallback_2d_id`: String,
    val `appearance`: PetDtoAppearance,
    val `voice`: PetDtoVoice,
    val `version`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetDto", linkedMapOf(
        "asset_id" to `asset_id`,
        "fallback_2d_id" to `fallback_2d_id`,
        "appearance" to `appearance`,
        "voice" to `voice`,
        "version" to `version`
    ))
    companion object {
        fun fromWire(value: Any?): PetDto {
            ContractValidator.validate("PetDto", value)
            val fields = wireObject(value)
            return PetDto(
                `asset_id` = fields["asset_id"] as String,
                `fallback_2d_id` = fields["fallback_2d_id"] as String,
                `appearance` = PetDtoAppearance.fromWire(fields["appearance"]),
                `voice` = PetDtoVoice.fromWire(fields["voice"]),
                `version` = (fields["version"] as Number).toLong()
            )
        }
    }
}

data class PetDtoAppearance(
    val `eyes`: PetDtoAppearanceEyes,
    val `mouth`: PetDtoAppearanceMouth,
    val `color`: String,
    val `action`: PetDtoAppearanceAction
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetDtoAppearance", linkedMapOf(
        "eyes" to `eyes`,
        "mouth" to `mouth`,
        "color" to `color`,
        "action" to `action`
    ))
    companion object {
        fun fromWire(value: Any?): PetDtoAppearance {
            ContractValidator.validate("PetDtoAppearance", value)
            val fields = wireObject(value)
            return PetDtoAppearance(
                `eyes` = PetDtoAppearanceEyes.fromWire(fields["eyes"]),
                `mouth` = PetDtoAppearanceMouth.fromWire(fields["mouth"]),
                `color` = fields["color"] as String,
                `action` = PetDtoAppearanceAction.fromWire(fields["action"])
            )
        }
    }
}

enum class PetDtoAppearanceEyes(val wireValue: String) : WireValue {
    VALUE_ROUND("round"),
    VALUE_HAPPY("happy"),
    VALUE_SLEEPY("sleepy");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetDtoAppearanceEyes {
            ContractValidator.validate("PetDtoAppearanceEyes", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class PetDtoAppearanceMouth(val wireValue: String) : WireValue {
    VALUE_SMILE("smile"),
    VALUE_SMALL("small"),
    VALUE_OPEN("open");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetDtoAppearanceMouth {
            ContractValidator.validate("PetDtoAppearanceMouth", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class PetDtoAppearanceAction(val wireValue: String) : WireValue {
    VALUE_IDLE("idle"),
    VALUE_GREETING("greeting"),
    VALUE_CELEBRATING("celebrating");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetDtoAppearanceAction {
            ContractValidator.validate("PetDtoAppearanceAction", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class PetDtoVoice(
    val `muted`: Boolean,
    val `rate`: Double
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetDtoVoice", linkedMapOf(
        "muted" to `muted`,
        "rate" to `rate`
    ))
    companion object {
        fun fromWire(value: Any?): PetDtoVoice {
            ContractValidator.validate("PetDtoVoice", value)
            val fields = wireObject(value)
            return PetDtoVoice(
                `muted` = fields["muted"] as Boolean,
                `rate` = (fields["rate"] as Number).toDouble()
            )
        }
    }
}

data class PetCurrentRequest(
    val `asset_id`: String,
    val `fallback_2d_id`: String,
    val `appearance`: PetCurrentRequestAppearance,
    val `voice`: PetCurrentRequestVoice
) : WireObject {
    val `preview_confirmed`: Boolean get() = true
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetCurrentRequest", linkedMapOf(
        "asset_id" to `asset_id`,
        "fallback_2d_id" to `fallback_2d_id`,
        "appearance" to `appearance`,
        "voice" to `voice`,
        "preview_confirmed" to `preview_confirmed`
    ))
    companion object {
        fun fromWire(value: Any?): PetCurrentRequest {
            ContractValidator.validate("PetCurrentRequest", value)
            val fields = wireObject(value)
            return PetCurrentRequest(
                `asset_id` = fields["asset_id"] as String,
                `fallback_2d_id` = fields["fallback_2d_id"] as String,
                `appearance` = PetCurrentRequestAppearance.fromWire(fields["appearance"]),
                `voice` = PetCurrentRequestVoice.fromWire(fields["voice"])
            )
        }
    }
}

data class PetCurrentRequestAppearance(
    val `eyes`: PetCurrentRequestAppearanceEyes,
    val `mouth`: PetCurrentRequestAppearanceMouth,
    val `color`: String,
    val `action`: PetCurrentRequestAppearanceAction
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetCurrentRequestAppearance", linkedMapOf(
        "eyes" to `eyes`,
        "mouth" to `mouth`,
        "color" to `color`,
        "action" to `action`
    ))
    companion object {
        fun fromWire(value: Any?): PetCurrentRequestAppearance {
            ContractValidator.validate("PetCurrentRequestAppearance", value)
            val fields = wireObject(value)
            return PetCurrentRequestAppearance(
                `eyes` = PetCurrentRequestAppearanceEyes.fromWire(fields["eyes"]),
                `mouth` = PetCurrentRequestAppearanceMouth.fromWire(fields["mouth"]),
                `color` = fields["color"] as String,
                `action` = PetCurrentRequestAppearanceAction.fromWire(fields["action"])
            )
        }
    }
}

enum class PetCurrentRequestAppearanceEyes(val wireValue: String) : WireValue {
    VALUE_ROUND("round"),
    VALUE_HAPPY("happy"),
    VALUE_SLEEPY("sleepy");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetCurrentRequestAppearanceEyes {
            ContractValidator.validate("PetCurrentRequestAppearanceEyes", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class PetCurrentRequestAppearanceMouth(val wireValue: String) : WireValue {
    VALUE_SMILE("smile"),
    VALUE_SMALL("small"),
    VALUE_OPEN("open");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetCurrentRequestAppearanceMouth {
            ContractValidator.validate("PetCurrentRequestAppearanceMouth", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class PetCurrentRequestAppearanceAction(val wireValue: String) : WireValue {
    VALUE_IDLE("idle"),
    VALUE_GREETING("greeting"),
    VALUE_CELEBRATING("celebrating");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetCurrentRequestAppearanceAction {
            ContractValidator.validate("PetCurrentRequestAppearanceAction", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class PetCurrentRequestVoice(
    val `muted`: Boolean,
    val `rate`: Double
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetCurrentRequestVoice", linkedMapOf(
        "muted" to `muted`,
        "rate" to `rate`
    ))
    companion object {
        fun fromWire(value: Any?): PetCurrentRequestVoice {
            ContractValidator.validate("PetCurrentRequestVoice", value)
            val fields = wireObject(value)
            return PetCurrentRequestVoice(
                `muted` = fields["muted"] as Boolean,
                `rate` = (fields["rate"] as Number).toDouble()
            )
        }
    }
}

data class PetCurrentResponse(
    val `pet`: PetDto,
    val `availability`: PetCurrentResponseAvailability
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("PetCurrentResponse", linkedMapOf(
        "pet" to `pet`,
        "availability" to `availability`
    ))
    companion object {
        fun fromWire(value: Any?): PetCurrentResponse {
            ContractValidator.validate("PetCurrentResponse", value)
            val fields = wireObject(value)
            return PetCurrentResponse(
                `pet` = PetDto.fromWire(fields["pet"]),
                `availability` = PetCurrentResponseAvailability.fromWire(fields["availability"])
            )
        }
    }
}

enum class PetCurrentResponseAvailability(val wireValue: String) : WireValue {
    VALUE_AVAILABLE("available"),
    VALUE_FALLBACK_2D("fallback_2d"),
    VALUE_UNAVAILABLE("unavailable");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): PetCurrentResponseAvailability {
            ContractValidator.validate("PetCurrentResponseAvailability", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ManifestDto(
    val `version`: String,
    val `hash`: String,
    val `signature`: String,
    val `download_path`: String,
    val `min_client`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ManifestDto", linkedMapOf(
        "version" to `version`,
        "hash" to `hash`,
        "signature" to `signature`,
        "download_path" to `download_path`,
        "min_client" to `min_client`
    ))
    companion object {
        fun fromWire(value: Any?): ManifestDto {
            ContractValidator.validate("ManifestDto", value)
            val fields = wireObject(value)
            return ManifestDto(
                `version` = fields["version"] as String,
                `hash` = fields["hash"] as String,
                `signature` = fields["signature"] as String,
                `download_path` = fields["download_path"] as String,
                `min_client` = fields["min_client"] as String
            )
        }
    }
}

sealed interface SyncMutationDto : WireValue {
    companion object {
        fun fromWire(value: Any?): SyncMutationDto {
            ContractValidator.validate("SyncMutationDto", value)
            if (ContractValidator.accepts("SyncMutationDtoNoteCreate", value)) return SyncMutationDtoNoteCreate.fromWire(value)
            if (ContractValidator.accepts("SyncMutationDtoNoteUpdate", value)) return SyncMutationDtoNoteUpdate.fromWire(value)
            if (ContractValidator.accepts("SyncMutationDtoNoteDelete", value)) return SyncMutationDtoNoteDelete.fromWire(value)
            if (ContractValidator.accepts("SyncMutationDtoTodoCreate", value)) return SyncMutationDtoTodoCreate.fromWire(value)
            if (ContractValidator.accepts("SyncMutationDtoTodoUpdate", value)) return SyncMutationDtoTodoUpdate.fromWire(value)
            if (ContractValidator.accepts("SyncMutationDtoTodoDelete", value)) return SyncMutationDtoTodoDelete.fromWire(value)
            throw ContractViolation("SyncMutationDto", "oneOf")
        }
    }
}

data class SyncMutationDtoNoteCreate(
    val `mutation_id`: String,
    val `entity_id`: String,
    val `patch`: NoteCreateRequest
) : WireObject, SyncMutationDto {
    val `entity_type`: String get() = "note"
    val `base_version`: Long get() = 0L
    val `operation`: String get() = "create"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SyncMutationDtoNoteCreate", linkedMapOf(
        "mutation_id" to `mutation_id`,
        "entity_id" to `entity_id`,
        "entity_type" to `entity_type`,
        "base_version" to `base_version`,
        "operation" to `operation`,
        "patch" to `patch`
    ))
    companion object {
        fun fromWire(value: Any?): SyncMutationDtoNoteCreate {
            ContractValidator.validate("SyncMutationDtoNoteCreate", value)
            val fields = wireObject(value)
            return SyncMutationDtoNoteCreate(
                `mutation_id` = fields["mutation_id"] as String,
                `entity_id` = fields["entity_id"] as String,
                `patch` = NoteCreateRequest.fromWire(fields["patch"])
            )
        }
    }
}

data class SyncMutationDtoNoteUpdate(
    val `mutation_id`: String,
    val `entity_id`: String,
    val `base_version`: Long,
    val `patch`: NoteUpdateRequest
) : WireObject, SyncMutationDto {
    val `entity_type`: String get() = "note"
    val `operation`: String get() = "update"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SyncMutationDtoNoteUpdate", linkedMapOf(
        "mutation_id" to `mutation_id`,
        "entity_id" to `entity_id`,
        "entity_type" to `entity_type`,
        "base_version" to `base_version`,
        "operation" to `operation`,
        "patch" to `patch`
    ))
    companion object {
        fun fromWire(value: Any?): SyncMutationDtoNoteUpdate {
            ContractValidator.validate("SyncMutationDtoNoteUpdate", value)
            val fields = wireObject(value)
            return SyncMutationDtoNoteUpdate(
                `mutation_id` = fields["mutation_id"] as String,
                `entity_id` = fields["entity_id"] as String,
                `base_version` = (fields["base_version"] as Number).toLong(),
                `patch` = NoteUpdateRequest.fromWire(fields["patch"])
            )
        }
    }
}

data class SyncMutationDtoNoteDelete(
    val `mutation_id`: String,
    val `entity_id`: String,
    val `base_version`: Long,
    val `patch`: SyncMutationDtoNoteDeletePatch
) : WireObject, SyncMutationDto {
    val `entity_type`: String get() = "note"
    val `operation`: String get() = "delete"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SyncMutationDtoNoteDelete", linkedMapOf(
        "mutation_id" to `mutation_id`,
        "entity_id" to `entity_id`,
        "entity_type" to `entity_type`,
        "base_version" to `base_version`,
        "operation" to `operation`,
        "patch" to `patch`
    ))
    companion object {
        fun fromWire(value: Any?): SyncMutationDtoNoteDelete {
            ContractValidator.validate("SyncMutationDtoNoteDelete", value)
            val fields = wireObject(value)
            return SyncMutationDtoNoteDelete(
                `mutation_id` = fields["mutation_id"] as String,
                `entity_id` = fields["entity_id"] as String,
                `base_version` = (fields["base_version"] as Number).toLong(),
                `patch` = SyncMutationDtoNoteDeletePatch.fromWire(fields["patch"])
            )
        }
    }
}

data object SyncMutationDtoNoteDeletePatch : WireObject {
    override fun toWire(): Map<String, Any?> = wireBuild("SyncMutationDtoNoteDeletePatch", emptyMap())
        fun fromWire(value: Any?): SyncMutationDtoNoteDeletePatch {
            ContractValidator.validate("SyncMutationDtoNoteDeletePatch", value)
            return SyncMutationDtoNoteDeletePatch
        }
}

data class SyncMutationDtoTodoCreate(
    val `mutation_id`: String,
    val `entity_id`: String,
    val `patch`: TodoCreateRequest
) : WireObject, SyncMutationDto {
    val `entity_type`: String get() = "todo"
    val `base_version`: Long get() = 0L
    val `operation`: String get() = "create"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SyncMutationDtoTodoCreate", linkedMapOf(
        "mutation_id" to `mutation_id`,
        "entity_id" to `entity_id`,
        "entity_type" to `entity_type`,
        "base_version" to `base_version`,
        "operation" to `operation`,
        "patch" to `patch`
    ))
    companion object {
        fun fromWire(value: Any?): SyncMutationDtoTodoCreate {
            ContractValidator.validate("SyncMutationDtoTodoCreate", value)
            val fields = wireObject(value)
            return SyncMutationDtoTodoCreate(
                `mutation_id` = fields["mutation_id"] as String,
                `entity_id` = fields["entity_id"] as String,
                `patch` = TodoCreateRequest.fromWire(fields["patch"])
            )
        }
    }
}

data class SyncMutationDtoTodoUpdate(
    val `mutation_id`: String,
    val `entity_id`: String,
    val `base_version`: Long,
    val `patch`: TodoPatch
) : WireObject, SyncMutationDto {
    val `entity_type`: String get() = "todo"
    val `operation`: String get() = "update"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SyncMutationDtoTodoUpdate", linkedMapOf(
        "mutation_id" to `mutation_id`,
        "entity_id" to `entity_id`,
        "entity_type" to `entity_type`,
        "base_version" to `base_version`,
        "operation" to `operation`,
        "patch" to `patch`
    ))
    companion object {
        fun fromWire(value: Any?): SyncMutationDtoTodoUpdate {
            ContractValidator.validate("SyncMutationDtoTodoUpdate", value)
            val fields = wireObject(value)
            return SyncMutationDtoTodoUpdate(
                `mutation_id` = fields["mutation_id"] as String,
                `entity_id` = fields["entity_id"] as String,
                `base_version` = (fields["base_version"] as Number).toLong(),
                `patch` = TodoPatch.fromWire(fields["patch"])
            )
        }
    }
}

data class SyncMutationDtoTodoDelete(
    val `mutation_id`: String,
    val `entity_id`: String,
    val `base_version`: Long,
    val `patch`: SyncMutationDtoTodoDeletePatch
) : WireObject, SyncMutationDto {
    val `entity_type`: String get() = "todo"
    val `operation`: String get() = "delete"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SyncMutationDtoTodoDelete", linkedMapOf(
        "mutation_id" to `mutation_id`,
        "entity_id" to `entity_id`,
        "entity_type" to `entity_type`,
        "base_version" to `base_version`,
        "operation" to `operation`,
        "patch" to `patch`
    ))
    companion object {
        fun fromWire(value: Any?): SyncMutationDtoTodoDelete {
            ContractValidator.validate("SyncMutationDtoTodoDelete", value)
            val fields = wireObject(value)
            return SyncMutationDtoTodoDelete(
                `mutation_id` = fields["mutation_id"] as String,
                `entity_id` = fields["entity_id"] as String,
                `base_version` = (fields["base_version"] as Number).toLong(),
                `patch` = SyncMutationDtoTodoDeletePatch.fromWire(fields["patch"])
            )
        }
    }
}

data object SyncMutationDtoTodoDeletePatch : WireObject {
    override fun toWire(): Map<String, Any?> = wireBuild("SyncMutationDtoTodoDeletePatch", emptyMap())
        fun fromWire(value: Any?): SyncMutationDtoTodoDeletePatch {
            ContractValidator.validate("SyncMutationDtoTodoDeletePatch", value)
            return SyncMutationDtoTodoDeletePatch
        }
}

data class SyncRequest(
    val `mutations`: List<SyncMutationDto>
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SyncRequest", linkedMapOf(
        "mutations" to `mutations`
    ))
    companion object {
        fun fromWire(value: Any?): SyncRequest {
            ContractValidator.validate("SyncRequest", value)
            val fields = wireObject(value)
            return SyncRequest(
                `mutations` = (fields["mutations"] as List<*>).map { item -> SyncMutationDto.fromWire(item) }
            )
        }
    }
}

data class ConflictDto(
    val `conflict_id`: String,
    val `entity_id`: String,
    val `entity_type`: ConflictDtoEntityType,
    val `base_version`: Long,
    val `current_version`: Long,
    val `current`: ConflictDtoCurrent,
    val `reason`: ConflictDtoReason
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ConflictDto", linkedMapOf(
        "conflict_id" to `conflict_id`,
        "entity_id" to `entity_id`,
        "entity_type" to `entity_type`,
        "base_version" to `base_version`,
        "current_version" to `current_version`,
        "current" to `current`,
        "reason" to `reason`
    ))
    companion object {
        fun fromWire(value: Any?): ConflictDto {
            ContractValidator.validate("ConflictDto", value)
            val fields = wireObject(value)
            return ConflictDto(
                `conflict_id` = fields["conflict_id"] as String,
                `entity_id` = fields["entity_id"] as String,
                `entity_type` = ConflictDtoEntityType.fromWire(fields["entity_type"]),
                `base_version` = (fields["base_version"] as Number).toLong(),
                `current_version` = (fields["current_version"] as Number).toLong(),
                `current` = ConflictDtoCurrent.fromWire(fields["current"]),
                `reason` = ConflictDtoReason.fromWire(fields["reason"])
            )
        }
    }
}

enum class ConflictDtoEntityType(val wireValue: String) : WireValue {
    VALUE_NOTE("note"),
    VALUE_TODO("todo");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ConflictDtoEntityType {
            ContractValidator.validate("ConflictDtoEntityType", value)
            return entries.first { it.wireValue == value }
        }
    }
}

sealed interface ConflictDtoCurrent : WireValue {
    companion object {
        fun fromWire(value: Any?): ConflictDtoCurrent {
            ContractValidator.validate("ConflictDtoCurrent", value)
            if (ContractValidator.accepts("ConflictDtoCurrentVariant1", value)) return ConflictDtoCurrentVariant1.fromWire(value)
            if (ContractValidator.accepts("ConflictDtoCurrentVariant2", value)) return ConflictDtoCurrentVariant2.fromWire(value)
            throw ContractViolation("ConflictDtoCurrent", "oneOf")
        }
    }
}

data class ConflictDtoCurrentVariant1(val value: NoteDto) : ConflictDtoCurrent {
    init { toWire() }
    override fun toWire(): Any? = value.toWire().also { ContractValidator.validate("ConflictDtoCurrentVariant1", it) }
    companion object {
        fun fromWire(value: Any?): ConflictDtoCurrentVariant1 {
            ContractValidator.validate("ConflictDtoCurrentVariant1", value)
            return ConflictDtoCurrentVariant1(NoteDto.fromWire(value))
        }
    }
}

data class ConflictDtoCurrentVariant2(val value: TodoDto) : ConflictDtoCurrent {
    init { toWire() }
    override fun toWire(): Any? = value.toWire().also { ContractValidator.validate("ConflictDtoCurrentVariant2", it) }
    companion object {
        fun fromWire(value: Any?): ConflictDtoCurrentVariant2 {
            ContractValidator.validate("ConflictDtoCurrentVariant2", value)
            return ConflictDtoCurrentVariant2(TodoDto.fromWire(value))
        }
    }
}

enum class ConflictDtoReason(val wireValue: String) : WireValue {
    VALUE_UPDATED("updated"),
    VALUE_DELETED("deleted");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ConflictDtoReason {
            ContractValidator.validate("ConflictDtoReason", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class SyncResult(
    val `mutation_id`: String,
    val `status`: SyncResultStatus,
    val `version`: Long?,
    val `conflict`: ConflictDto?,
    val `error_code`: SyncResultErrorCode?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SyncResult", linkedMapOf(
        "mutation_id" to `mutation_id`,
        "status" to `status`,
        "version" to `version`,
        "conflict" to `conflict`,
        "error_code" to `error_code`
    ))
    companion object {
        fun fromWire(value: Any?): SyncResult {
            ContractValidator.validate("SyncResult", value)
            val fields = wireObject(value)
            return SyncResult(
                `mutation_id` = fields["mutation_id"] as String,
                `status` = SyncResultStatus.fromWire(fields["status"]),
                `version` = if (fields["version"] == null) null else (fields["version"] as Number).toLong(),
                `conflict` = if (fields["conflict"] == null) null else ConflictDto.fromWire(fields["conflict"]),
                `error_code` = if (fields["error_code"] == null) null else SyncResultErrorCode.fromWire(fields["error_code"])
            )
        }
    }
}

enum class SyncResultStatus(val wireValue: String) : WireValue {
    VALUE_ACKED("acked"),
    VALUE_CONFLICT("conflict"),
    VALUE_FAILED("failed");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): SyncResultStatus {
            ContractValidator.validate("SyncResultStatus", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class SyncResultErrorCode(val wireValue: String) : WireValue {
    VALUE_VERSION_CONFLICT("VERSION_CONFLICT"),
    VALUE_SCOPE_DENIED("SCOPE_DENIED"),
    VALUE_INVALID_REQUEST("INVALID_REQUEST");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): SyncResultErrorCode {
            ContractValidator.validate("SyncResultErrorCode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class SyncResponse(
    val `results`: List<SyncResult>
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SyncResponse", linkedMapOf(
        "results" to `results`
    ))
    companion object {
        fun fromWire(value: Any?): SyncResponse {
            ContractValidator.validate("SyncResponse", value)
            val fields = wireObject(value)
            return SyncResponse(
                `results` = (fields["results"] as List<*>).map { item -> SyncResult.fromWire(item) }
            )
        }
    }
}

data class SyncChange(
    val `entity_type`: SyncChangeEntityType,
    val `entity_id`: String,
    val `version`: Long,
    val `operation`: SyncChangeOperation,
    val `entity`: SyncChangeEntity?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SyncChange", linkedMapOf(
        "entity_type" to `entity_type`,
        "entity_id" to `entity_id`,
        "version" to `version`,
        "operation" to `operation`,
        "entity" to `entity`
    ))
    companion object {
        fun fromWire(value: Any?): SyncChange {
            ContractValidator.validate("SyncChange", value)
            val fields = wireObject(value)
            return SyncChange(
                `entity_type` = SyncChangeEntityType.fromWire(fields["entity_type"]),
                `entity_id` = fields["entity_id"] as String,
                `version` = (fields["version"] as Number).toLong(),
                `operation` = SyncChangeOperation.fromWire(fields["operation"]),
                `entity` = if (fields["entity"] == null) null else SyncChangeEntity.fromWire(fields["entity"])
            )
        }
    }
}

enum class SyncChangeEntityType(val wireValue: String) : WireValue {
    VALUE_NOTE("note"),
    VALUE_TODO("todo");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): SyncChangeEntityType {
            ContractValidator.validate("SyncChangeEntityType", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class SyncChangeOperation(val wireValue: String) : WireValue {
    VALUE_UPSERT("upsert"),
    VALUE_DELETE("delete");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): SyncChangeOperation {
            ContractValidator.validate("SyncChangeOperation", value)
            return entries.first { it.wireValue == value }
        }
    }
}

sealed interface SyncChangeEntity : WireValue {
    companion object {
        fun fromWire(value: Any?): SyncChangeEntity {
            ContractValidator.validate("SyncChangeEntity", value)
            if (ContractValidator.accepts("SyncChangeEntityVariant1", value)) return SyncChangeEntityVariant1.fromWire(value)
            if (ContractValidator.accepts("SyncChangeEntityVariant2", value)) return SyncChangeEntityVariant2.fromWire(value)
            throw ContractViolation("SyncChangeEntity", "oneOf")
        }
    }
}

data class SyncChangeEntityVariant1(val value: NoteDto) : SyncChangeEntity {
    init { toWire() }
    override fun toWire(): Any? = value.toWire().also { ContractValidator.validate("SyncChangeEntityVariant1", it) }
    companion object {
        fun fromWire(value: Any?): SyncChangeEntityVariant1 {
            ContractValidator.validate("SyncChangeEntityVariant1", value)
            return SyncChangeEntityVariant1(NoteDto.fromWire(value))
        }
    }
}

data class SyncChangeEntityVariant2(val value: TodoDto) : SyncChangeEntity {
    init { toWire() }
    override fun toWire(): Any? = value.toWire().also { ContractValidator.validate("SyncChangeEntityVariant2", it) }
    companion object {
        fun fromWire(value: Any?): SyncChangeEntityVariant2 {
            ContractValidator.validate("SyncChangeEntityVariant2", value)
            return SyncChangeEntityVariant2(TodoDto.fromWire(value))
        }
    }
}

data class SyncChangesResponse(
    val `changes`: List<SyncChange>,
    val `next_cursor`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SyncChangesResponse", linkedMapOf(
        "changes" to `changes`,
        "next_cursor" to `next_cursor`
    ))
    companion object {
        fun fromWire(value: Any?): SyncChangesResponse {
            ContractValidator.validate("SyncChangesResponse", value)
            val fields = wireObject(value)
            return SyncChangesResponse(
                `changes` = (fields["changes"] as List<*>).map { item -> SyncChange.fromWire(item) },
                `next_cursor` = if (fields["next_cursor"] == null) null else fields["next_cursor"] as String
            )
        }
    }
}

data class AssistRequest(
    val `relation_id`: String,
    val `local_consent_id`: String,
    val `requested_media`: List<AssistRequestRequestedMediaItem>
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistRequest", linkedMapOf(
        "relation_id" to `relation_id`,
        "local_consent_id" to `local_consent_id`,
        "requested_media" to `requested_media`
    ))
    companion object {
        fun fromWire(value: Any?): AssistRequest {
            ContractValidator.validate("AssistRequest", value)
            val fields = wireObject(value)
            return AssistRequest(
                `relation_id` = fields["relation_id"] as String,
                `local_consent_id` = fields["local_consent_id"] as String,
                `requested_media` = (fields["requested_media"] as List<*>).map { item -> AssistRequestRequestedMediaItem.fromWire(item) }
            )
        }
    }
}

enum class AssistRequestRequestedMediaItem(val wireValue: String) : WireValue {
    VALUE_SCREEN("screen"),
    VALUE_AUDIO("audio");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): AssistRequestRequestedMediaItem {
            ContractValidator.validate("AssistRequestRequestedMediaItem", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class AssistCreated(
    val `assist_id`: String,
    val `expires_at`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistCreated", linkedMapOf(
        "assist_id" to `assist_id`,
        "expires_at" to `expires_at`
    ))
    companion object {
        fun fromWire(value: Any?): AssistCreated {
            ContractValidator.validate("AssistCreated", value)
            val fields = wireObject(value)
            return AssistCreated(
                `assist_id` = fields["assist_id"] as String,
                `expires_at` = fields["expires_at"] as String
            )
        }
    }
}

data class AssistStateResponse(
    val `state`: AssistStateResponseState
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistStateResponse", linkedMapOf(
        "state" to `state`
    ))
    companion object {
        fun fromWire(value: Any?): AssistStateResponse {
            ContractValidator.validate("AssistStateResponse", value)
            val fields = wireObject(value)
            return AssistStateResponse(
                `state` = AssistStateResponseState.fromWire(fields["state"])
            )
        }
    }
}

enum class AssistStateResponseState(val wireValue: String) : WireValue {
    VALUE_INVITING("inviting"),
    VALUE_ACCEPTED("accepted"),
    VALUE_CONNECTING("connecting"),
    VALUE_ACTIVE("active"),
    VALUE_PAUSED("paused"),
    VALUE_RECONNECTING("reconnecting"),
    VALUE_ENDED("ended");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): AssistStateResponseState {
            ContractValidator.validate("AssistStateResponseState", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class AssistJoinRequest(
    val `device_id`: String,
    val `consent_id`: String,
    val `grant_revision`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistJoinRequest", linkedMapOf(
        "device_id" to `device_id`,
        "consent_id" to `consent_id`,
        "grant_revision" to `grant_revision`
    ))
    companion object {
        fun fromWire(value: Any?): AssistJoinRequest {
            ContractValidator.validate("AssistJoinRequest", value)
            val fields = wireObject(value)
            return AssistJoinRequest(
                `device_id` = fields["device_id"] as String,
                `consent_id` = fields["consent_id"] as String,
                `grant_revision` = (fields["grant_revision"] as Number).toLong()
            )
        }
    }
}

data class AssistJoinResponse(
    val `signal_ticket`: String,
    val `turn_credentials`: AssistJoinResponseTurnCredentials,
    val `expires_at`: String
) : WireObject {
    val `relay_only`: Boolean get() = true
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistJoinResponse", linkedMapOf(
        "signal_ticket" to `signal_ticket`,
        "turn_credentials" to `turn_credentials`,
        "expires_at" to `expires_at`,
        "relay_only" to `relay_only`
    ))
    companion object {
        fun fromWire(value: Any?): AssistJoinResponse {
            ContractValidator.validate("AssistJoinResponse", value)
            val fields = wireObject(value)
            return AssistJoinResponse(
                `signal_ticket` = fields["signal_ticket"] as String,
                `turn_credentials` = AssistJoinResponseTurnCredentials.fromWire(fields["turn_credentials"]),
                `expires_at` = fields["expires_at"] as String
            )
        }
    }
}

data class AssistJoinResponseTurnCredentials(
    val `urls`: List<String>,
    val `username`: String,
    val `credential`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistJoinResponseTurnCredentials", linkedMapOf(
        "urls" to `urls`,
        "username" to `username`,
        "credential" to `credential`
    ))
    companion object {
        fun fromWire(value: Any?): AssistJoinResponseTurnCredentials {
            ContractValidator.validate("AssistJoinResponseTurnCredentials", value)
            val fields = wireObject(value)
            return AssistJoinResponseTurnCredentials(
                `urls` = (fields["urls"] as List<*>).map { item -> item as String },
                `username` = fields["username"] as String,
                `credential` = fields["credential"] as String
            )
        }
    }
}

data class AssistEndRequest(
    val `reason`: AssistEndRequestReason
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistEndRequest", linkedMapOf(
        "reason" to `reason`
    ))
    companion object {
        fun fromWire(value: Any?): AssistEndRequest {
            ContractValidator.validate("AssistEndRequest", value)
            val fields = wireObject(value)
            return AssistEndRequest(
                `reason` = AssistEndRequestReason.fromWire(fields["reason"])
            )
        }
    }
}

enum class AssistEndRequestReason(val wireValue: String) : WireValue {
    VALUE_USER_STOP("user_stop"),
    VALUE_RISK("risk"),
    VALUE_CONSENT_REVOKED("consent_revoked"),
    VALUE_PERMISSION_REVOKED("permission_revoked"),
    VALUE_DISCONNECTED("disconnected"),
    VALUE_EXPIRED("expired");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): AssistEndRequestReason {
            ContractValidator.validate("AssistEndRequestReason", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data object AssistEndedResponse : WireObject {
    val `state`: String get() = "ended"
    override fun toWire(): Map<String, Any?> = wireBuild("AssistEndedResponse", linkedMapOf(
        "state" to `state`
    ))
        fun fromWire(value: Any?): AssistEndedResponse {
            ContractValidator.validate("AssistEndedResponse", value)
            return AssistEndedResponse
        }
}

data class SafetyVersions(
    val `client`: String,
    val `detector`: String,
    val `policy`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SafetyVersions", linkedMapOf(
        "client" to `client`,
        "detector" to `detector`,
        "policy" to `policy`
    ))
    companion object {
        fun fromWire(value: Any?): SafetyVersions {
            ContractValidator.validate("SafetyVersions", value)
            val fields = wireObject(value)
            return SafetyVersions(
                `client` = fields["client"] as String,
                `detector` = fields["detector"] as String,
                `policy` = fields["policy"] as String
            )
        }
    }
}

data class SafetyEventRequest(
    val `kind`: SafetyEventRequestKind,
    val `action`: SafetyEventRequestAction,
    val `versions`: SafetyVersions,
    val `occurred_at`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SafetyEventRequest", linkedMapOf(
        "kind" to `kind`,
        "action" to `action`,
        "versions" to `versions`,
        "occurred_at" to `occurred_at`
    ))
    companion object {
        fun fromWire(value: Any?): SafetyEventRequest {
            ContractValidator.validate("SafetyEventRequest", value)
            val fields = wireObject(value)
            return SafetyEventRequest(
                `kind` = SafetyEventRequestKind.fromWire(fields["kind"]),
                `action` = SafetyEventRequestAction.fromWire(fields["action"]),
                `versions` = SafetyVersions.fromWire(fields["versions"]),
                `occurred_at` = fields["occurred_at"] as String
            )
        }
    }
}

enum class SafetyEventRequestKind(val wireValue: String) : WireValue {
    VALUE_PRIVATE("private"),
    VALUE_TRANSACTION("transaction"),
    VALUE_UNKNOWN("unknown"),
    VALUE_DETECTOR_FAILURE("detector_failure");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): SafetyEventRequestKind {
            ContractValidator.validate("SafetyEventRequestKind", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class SafetyEventRequestAction(val wireValue: String) : WireValue {
    VALUE_PAUSED("paused"),
    VALUE_STOPPED("stopped"),
    VALUE_PHONE_ENTRY("phone_entry");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): SafetyEventRequestAction {
            ContractValidator.validate("SafetyEventRequestAction", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class SafetyEventResponse(
    val `event_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("SafetyEventResponse", linkedMapOf(
        "event_id" to `event_id`
    ))
    companion object {
        fun fromWire(value: Any?): SafetyEventResponse {
            ContractValidator.validate("SafetyEventResponse", value)
            val fields = wireObject(value)
            return SafetyEventResponse(
                `event_id` = fields["event_id"] as String
            )
        }
    }
}

data class MetricEvent(
    val `event_id`: String,
    val `kind`: MetricEventKind,
    val `operation_key`: String,
    val `occurred_at`: String,
    val `assisted`: Boolean
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("MetricEvent", linkedMapOf(
        "event_id" to `event_id`,
        "kind" to `kind`,
        "operation_key" to `operation_key`,
        "occurred_at" to `occurred_at`,
        "assisted" to `assisted`
    ))
    companion object {
        fun fromWire(value: Any?): MetricEvent {
            ContractValidator.validate("MetricEvent", value)
            val fields = wireObject(value)
            return MetricEvent(
                `event_id` = fields["event_id"] as String,
                `kind` = MetricEventKind.fromWire(fields["kind"]),
                `operation_key` = fields["operation_key"] as String,
                `occurred_at` = fields["occurred_at"] as String,
                `assisted` = fields["assisted"] as Boolean
            )
        }
    }
}

enum class MetricEventKind(val wireValue: String) : WireValue {
    VALUE_TEACHING_COMPLETED("teaching_completed"),
    VALUE_REVIEW_PRACTICED("review_practiced"),
    VALUE_MASTERY_CONFIRMED("mastery_confirmed"),
    VALUE_INDEPENDENT_REPRODUCTION("independent_reproduction"),
    VALUE_ASSIST_REQUESTED("assist_requested");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): MetricEventKind {
            ContractValidator.validate("MetricEventKind", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class MetricsRequest(
    val `events`: List<MetricEvent>
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("MetricsRequest", linkedMapOf(
        "events" to `events`
    ))
    companion object {
        fun fromWire(value: Any?): MetricsRequest {
            ContractValidator.validate("MetricsRequest", value)
            val fields = wireObject(value)
            return MetricsRequest(
                `events` = (fields["events"] as List<*>).map { item -> MetricEvent.fromWire(item) }
            )
        }
    }
}

data class MetricsResponse(
    val `accepted_count`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("MetricsResponse", linkedMapOf(
        "accepted_count" to `accepted_count`
    ))
    companion object {
        fun fromWire(value: Any?): MetricsResponse {
            ContractValidator.validate("MetricsResponse", value)
            val fields = wireObject(value)
            return MetricsResponse(
                `accepted_count` = (fields["accepted_count"] as Number).toLong()
            )
        }
    }
}

data class ProvisioningRequest(
    val `authorized_org_ref`: String,
    val `subjects`: List<ProvisioningRequestSubjectsItem>
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ProvisioningRequest", linkedMapOf(
        "authorized_org_ref" to `authorized_org_ref`,
        "subjects" to `subjects`
    ))
    companion object {
        fun fromWire(value: Any?): ProvisioningRequest {
            ContractValidator.validate("ProvisioningRequest", value)
            val fields = wireObject(value)
            return ProvisioningRequest(
                `authorized_org_ref` = fields["authorized_org_ref"] as String,
                `subjects` = (fields["subjects"] as List<*>).map { item -> ProvisioningRequestSubjectsItem.fromWire(item) }
            )
        }
    }
}

data class ProvisioningRequestSubjectsItem(
    val `subject_ref`: String,
    val `consent_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ProvisioningRequestSubjectsItem", linkedMapOf(
        "subject_ref" to `subject_ref`,
        "consent_id" to `consent_id`
    ))
    companion object {
        fun fromWire(value: Any?): ProvisioningRequestSubjectsItem {
            ContractValidator.validate("ProvisioningRequestSubjectsItem", value)
            val fields = wireObject(value)
            return ProvisioningRequestSubjectsItem(
                `subject_ref` = fields["subject_ref"] as String,
                `consent_id` = fields["consent_id"] as String
            )
        }
    }
}

data class ProvisioningResponse(
    val `batch_id`: String,
    val `item_results`: List<ProvisioningResponseItemResultsItem>
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ProvisioningResponse", linkedMapOf(
        "batch_id" to `batch_id`,
        "item_results" to `item_results`
    ))
    companion object {
        fun fromWire(value: Any?): ProvisioningResponse {
            ContractValidator.validate("ProvisioningResponse", value)
            val fields = wireObject(value)
            return ProvisioningResponse(
                `batch_id` = fields["batch_id"] as String,
                `item_results` = (fields["item_results"] as List<*>).map { item -> ProvisioningResponseItemResultsItem.fromWire(item) }
            )
        }
    }
}

data class ProvisioningResponseItemResultsItem(
    val `subject_ref`: String,
    val `status`: ProvisioningResponseItemResultsItemStatus,
    val `claim_id`: String?,
    val `reason`: ProvisioningResponseItemResultsItemReason?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ProvisioningResponseItemResultsItem", linkedMapOf(
        "subject_ref" to `subject_ref`,
        "status" to `status`,
        "claim_id" to `claim_id`,
        "reason" to `reason`
    ))
    companion object {
        fun fromWire(value: Any?): ProvisioningResponseItemResultsItem {
            ContractValidator.validate("ProvisioningResponseItemResultsItem", value)
            val fields = wireObject(value)
            return ProvisioningResponseItemResultsItem(
                `subject_ref` = fields["subject_ref"] as String,
                `status` = ProvisioningResponseItemResultsItemStatus.fromWire(fields["status"]),
                `claim_id` = if (fields["claim_id"] == null) null else fields["claim_id"] as String,
                `reason` = if (fields["reason"] == null) null else ProvisioningResponseItemResultsItemReason.fromWire(fields["reason"])
            )
        }
    }
}

enum class ProvisioningResponseItemResultsItemStatus(val wireValue: String) : WireValue {
    VALUE_PENDING_CONFIRMATION("pending_confirmation"),
    VALUE_REJECTED("rejected");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ProvisioningResponseItemResultsItemStatus {
            ContractValidator.validate("ProvisioningResponseItemResultsItemStatus", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class ProvisioningResponseItemResultsItemReason(val wireValue: String) : WireValue {
    VALUE_CONSENT_REQUIRED("CONSENT_REQUIRED"),
    VALUE_SCOPE_DENIED("SCOPE_DENIED"),
    VALUE_INVALID_REQUEST("INVALID_REQUEST");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ProvisioningResponseItemResultsItemReason {
            ContractValidator.validate("ProvisioningResponseItemResultsItemReason", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class VoiceTicketRequest(
    val `device_id`: String,
    val `consent_id`: String,
    val `generation`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("VoiceTicketRequest", linkedMapOf(
        "device_id" to `device_id`,
        "consent_id" to `consent_id`,
        "generation" to `generation`
    ))
    companion object {
        fun fromWire(value: Any?): VoiceTicketRequest {
            ContractValidator.validate("VoiceTicketRequest", value)
            val fields = wireObject(value)
            return VoiceTicketRequest(
                `device_id` = fields["device_id"] as String,
                `consent_id` = fields["consent_id"] as String,
                `generation` = (fields["generation"] as Number).toLong()
            )
        }
    }
}

data class VoiceTicketResponse(
    val `ticket`: String,
    val `expires_at`: String,
    val `websocket_path`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("VoiceTicketResponse", linkedMapOf(
        "ticket" to `ticket`,
        "expires_at" to `expires_at`,
        "websocket_path" to `websocket_path`
    ))
    companion object {
        fun fromWire(value: Any?): VoiceTicketResponse {
            ContractValidator.validate("VoiceTicketResponse", value)
            val fields = wireObject(value)
            return VoiceTicketResponse(
                `ticket` = fields["ticket"] as String,
                `expires_at` = fields["expires_at"] as String,
                `websocket_path` = fields["websocket_path"] as String
            )
        }
    }
}

data class StandaloneGuidanceRect(
    val `x`: Double,
    val `y`: Double,
    val `width`: Double,
    val `height`: Double
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceRect", linkedMapOf(
        "x" to `x`,
        "y" to `y`,
        "width" to `width`,
        "height" to `height`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceRect {
            ContractValidator.validate("StandaloneGuidanceRect", value)
            val fields = wireObject(value)
            return StandaloneGuidanceRect(
                `x` = (fields["x"] as Number).toDouble(),
                `y` = (fields["y"] as Number).toDouble(),
                `width` = (fields["width"] as Number).toDouble(),
                `height` = (fields["height"] as Number).toDouble()
            )
        }
    }
}

data class StandaloneGuidanceElement(
    val `id`: String,
    val `label`: String,
    val `rect`: StandaloneGuidanceRect
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceElement", linkedMapOf(
        "id" to `id`,
        "label" to `label`,
        "rect" to `rect`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceElement {
            ContractValidator.validate("StandaloneGuidanceElement", value)
            val fields = wireObject(value)
            return StandaloneGuidanceElement(
                `id` = fields["id"] as String,
                `label` = fields["label"] as String,
                `rect` = StandaloneGuidanceRect.fromWire(fields["rect"])
            )
        }
    }
}

data class StandaloneGuidanceImage(
    val `base64`: String
) : WireObject {
    val `mime`: String get() = "image/png"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceImage", linkedMapOf(
        "mime" to `mime`,
        "base64" to `base64`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceImage {
            ContractValidator.validate("StandaloneGuidanceImage", value)
            val fields = wireObject(value)
            return StandaloneGuidanceImage(
                `base64` = fields["base64"] as String
            )
        }
    }
}

data class StandaloneGuidancePreviousStep(
    val `instruction`: String,
    val `expected_labels`: List<String>
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidancePreviousStep", linkedMapOf(
        "instruction" to `instruction`,
        "expected_labels" to `expected_labels`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidancePreviousStep {
            ContractValidator.validate("StandaloneGuidancePreviousStep", value)
            val fields = wireObject(value)
            return StandaloneGuidancePreviousStep(
                `instruction` = fields["instruction"] as String,
                `expected_labels` = (fields["expected_labels"] as List<*>).map { item -> item as String }
            )
        }
    }
}

data class StandaloneGuidanceClarificationReply(
    val `question`: String,
    val `answer`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceClarificationReply", linkedMapOf(
        "question" to `question`,
        "answer" to `answer`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceClarificationReply {
            ContractValidator.validate("StandaloneGuidanceClarificationReply", value)
            val fields = wireObject(value)
            return StandaloneGuidanceClarificationReply(
                `question` = fields["question"] as String,
                `answer` = fields["answer"] as String
            )
        }
    }
}

data class StandaloneGuidanceReviewProposal(
    val `remind_at`: String,
    val `timezone`: String,
    val `reason`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceReviewProposal", linkedMapOf(
        "remind_at" to `remind_at`,
        "timezone" to `timezone`,
        "reason" to `reason`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceReviewProposal {
            ContractValidator.validate("StandaloneGuidanceReviewProposal", value)
            val fields = wireObject(value)
            return StandaloneGuidanceReviewProposal(
                `remind_at` = fields["remind_at"] as String,
                `timezone` = fields["timezone"] as String,
                `reason` = fields["reason"] as String
            )
        }
    }
}

data class StandaloneGuidanceAnalyzeRequest(
    val `observation_id`: String,
    val `guide_id`: String,
    val `observation_generation`: Long,
    val `task_generation`: Long,
    val `trigger_id`: String,
    val `frame_id`: String,
    val `trigger_reason`: StandaloneGuidanceAnalyzeRequestTriggerReason,
    val `frame_hash`: String,
    val `sanitized_sha256`: String,
    val `captured_at`: String,
    val `image`: StandaloneGuidanceImage,
    val `question`: String,
    val `clarification_replies`: OptionalField<List<StandaloneGuidanceClarificationReply>> = OptionalField.Absent,
    val `elements`: List<StandaloneGuidanceElement>,
    val `previous_step`: OptionalField<StandaloneGuidancePreviousStep> = OptionalField.Absent
) : WireObject {
    val `redaction_profile`: String get() = "all_text_and_faces_v1"
    val `local_safety`: String get() = "safe"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceAnalyzeRequest", linkedMapOf(
        "observation_id" to `observation_id`,
        "guide_id" to `guide_id`,
        "observation_generation" to `observation_generation`,
        "task_generation" to `task_generation`,
        "trigger_id" to `trigger_id`,
        "frame_id" to `frame_id`,
        "trigger_reason" to `trigger_reason`,
        "frame_hash" to `frame_hash`,
        "sanitized_sha256" to `sanitized_sha256`,
        "captured_at" to `captured_at`,
        "image" to `image`,
        "redaction_profile" to `redaction_profile`,
        "local_safety" to `local_safety`,
        "question" to `question`,
        "clarification_replies" to `clarification_replies`,
        "elements" to `elements`,
        "previous_step" to `previous_step`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceAnalyzeRequest {
            ContractValidator.validate("StandaloneGuidanceAnalyzeRequest", value)
            val fields = wireObject(value)
            return StandaloneGuidanceAnalyzeRequest(
                `observation_id` = fields["observation_id"] as String,
                `guide_id` = fields["guide_id"] as String,
                `observation_generation` = (fields["observation_generation"] as Number).toLong(),
                `task_generation` = (fields["task_generation"] as Number).toLong(),
                `trigger_id` = fields["trigger_id"] as String,
                `frame_id` = fields["frame_id"] as String,
                `trigger_reason` = StandaloneGuidanceAnalyzeRequestTriggerReason.fromWire(fields["trigger_reason"]),
                `frame_hash` = fields["frame_hash"] as String,
                `sanitized_sha256` = fields["sanitized_sha256"] as String,
                `captured_at` = fields["captured_at"] as String,
                `image` = StandaloneGuidanceImage.fromWire(fields["image"]),
                `question` = fields["question"] as String,
                `clarification_replies` = if (fields.containsKey("clarification_replies")) OptionalField.Present((fields["clarification_replies"] as List<*>).map { item -> StandaloneGuidanceClarificationReply.fromWire(item) }) else OptionalField.Absent,
                `elements` = (fields["elements"] as List<*>).map { item -> StandaloneGuidanceElement.fromWire(item) },
                `previous_step` = if (fields.containsKey("previous_step")) OptionalField.Present(StandaloneGuidancePreviousStep.fromWire(fields["previous_step"])) else OptionalField.Absent
            )
        }
    }
}

enum class StandaloneGuidanceAnalyzeRequestTriggerReason(val wireValue: String) : WireValue {
    VALUE_QUESTION("question"),
    VALUE_PAGE_CHANGED("page_changed"),
    VALUE_VERIFICATION("verification");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceAnalyzeRequestTriggerReason {
            ContractValidator.validate("StandaloneGuidanceAnalyzeRequestTriggerReason", value)
            return entries.first { it.wireValue == value }
        }
    }
}

sealed interface StandaloneGuidanceResult : WireValue {
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceResult {
            ContractValidator.validate("StandaloneGuidanceResult", value)
            if (ContractValidator.accepts("StandaloneGuidanceResultVariant1", value)) return StandaloneGuidanceResultVariant1.fromWire(value)
            if (ContractValidator.accepts("StandaloneGuidanceResultVariant2", value)) return StandaloneGuidanceResultVariant2.fromWire(value)
            if (ContractValidator.accepts("StandaloneGuidanceResultVariant3", value)) return StandaloneGuidanceResultVariant3.fromWire(value)
            if (ContractValidator.accepts("StandaloneGuidanceResultVariant4", value)) return StandaloneGuidanceResultVariant4.fromWire(value)
            throw ContractViolation("StandaloneGuidanceResult", "oneOf")
        }
    }
}

data class StandaloneGuidanceResultVariant1(
    val `observation_id`: String,
    val `guide_id`: String,
    val `observation_generation`: Long,
    val `task_generation`: Long,
    val `trigger_id`: String,
    val `frame_id`: String,
    val `instruction`: String,
    val `target_id`: OptionalField<String> = OptionalField.Absent,
    val `presentation`: OptionalField<StandaloneGuidanceResultVariant1Presentation> = OptionalField.Absent,
    val `expected_labels`: OptionalField<List<String>> = OptionalField.Absent,
    val `evidence_labels`: OptionalField<List<String>> = OptionalField.Absent
) : WireObject, StandaloneGuidanceResult {
    val `kind`: String get() = "step"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceResultVariant1", linkedMapOf(
        "observation_id" to `observation_id`,
        "guide_id" to `guide_id`,
        "observation_generation" to `observation_generation`,
        "task_generation" to `task_generation`,
        "trigger_id" to `trigger_id`,
        "frame_id" to `frame_id`,
        "kind" to `kind`,
        "instruction" to `instruction`,
        "target_id" to `target_id`,
        "presentation" to `presentation`,
        "expected_labels" to `expected_labels`,
        "evidence_labels" to `evidence_labels`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceResultVariant1 {
            ContractValidator.validate("StandaloneGuidanceResultVariant1", value)
            val fields = wireObject(value)
            return StandaloneGuidanceResultVariant1(
                `observation_id` = fields["observation_id"] as String,
                `guide_id` = fields["guide_id"] as String,
                `observation_generation` = (fields["observation_generation"] as Number).toLong(),
                `task_generation` = (fields["task_generation"] as Number).toLong(),
                `trigger_id` = fields["trigger_id"] as String,
                `frame_id` = fields["frame_id"] as String,
                `instruction` = fields["instruction"] as String,
                `target_id` = if (fields.containsKey("target_id")) OptionalField.Present(fields["target_id"] as String) else OptionalField.Absent,
                `presentation` = if (fields.containsKey("presentation")) OptionalField.Present(StandaloneGuidanceResultVariant1Presentation.fromWire(fields["presentation"])) else OptionalField.Absent,
                `expected_labels` = if (fields.containsKey("expected_labels")) OptionalField.Present((fields["expected_labels"] as List<*>).map { item -> item as String }) else OptionalField.Absent,
                `evidence_labels` = if (fields.containsKey("evidence_labels")) OptionalField.Present((fields["evidence_labels"] as List<*>).map { item -> item as String }) else OptionalField.Absent
            )
        }
    }
}

enum class StandaloneGuidanceResultVariant1Presentation(val wireValue: String) : WireValue {
    VALUE_CONFIRMED("confirmed"),
    VALUE_UNCERTAIN_CANDIDATE("uncertain_candidate");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceResultVariant1Presentation {
            ContractValidator.validate("StandaloneGuidanceResultVariant1Presentation", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class StandaloneGuidanceResultVariant2(
    val `observation_id`: String,
    val `guide_id`: String,
    val `observation_generation`: Long,
    val `task_generation`: Long,
    val `trigger_id`: String,
    val `frame_id`: String,
    val `instruction`: String,
    val `evidence_labels`: List<String>,
    val `review_proposal`: OptionalField<StandaloneGuidanceReviewProposal> = OptionalField.Absent
) : WireObject, StandaloneGuidanceResult {
    val `kind`: String get() = "completed"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceResultVariant2", linkedMapOf(
        "observation_id" to `observation_id`,
        "guide_id" to `guide_id`,
        "observation_generation" to `observation_generation`,
        "task_generation" to `task_generation`,
        "trigger_id" to `trigger_id`,
        "frame_id" to `frame_id`,
        "kind" to `kind`,
        "instruction" to `instruction`,
        "evidence_labels" to `evidence_labels`,
        "review_proposal" to `review_proposal`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceResultVariant2 {
            ContractValidator.validate("StandaloneGuidanceResultVariant2", value)
            val fields = wireObject(value)
            return StandaloneGuidanceResultVariant2(
                `observation_id` = fields["observation_id"] as String,
                `guide_id` = fields["guide_id"] as String,
                `observation_generation` = (fields["observation_generation"] as Number).toLong(),
                `task_generation` = (fields["task_generation"] as Number).toLong(),
                `trigger_id` = fields["trigger_id"] as String,
                `frame_id` = fields["frame_id"] as String,
                `instruction` = fields["instruction"] as String,
                `evidence_labels` = (fields["evidence_labels"] as List<*>).map { item -> item as String },
                `review_proposal` = if (fields.containsKey("review_proposal")) OptionalField.Present(StandaloneGuidanceReviewProposal.fromWire(fields["review_proposal"])) else OptionalField.Absent
            )
        }
    }
}

data class StandaloneGuidanceResultVariant3(
    val `observation_id`: String,
    val `guide_id`: String,
    val `observation_generation`: Long,
    val `task_generation`: Long,
    val `trigger_id`: String,
    val `frame_id`: String,
    val `instruction`: String
) : WireObject, StandaloneGuidanceResult {
    val `kind`: String get() = "clarify"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceResultVariant3", linkedMapOf(
        "observation_id" to `observation_id`,
        "guide_id" to `guide_id`,
        "observation_generation" to `observation_generation`,
        "task_generation" to `task_generation`,
        "trigger_id" to `trigger_id`,
        "frame_id" to `frame_id`,
        "kind" to `kind`,
        "instruction" to `instruction`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceResultVariant3 {
            ContractValidator.validate("StandaloneGuidanceResultVariant3", value)
            val fields = wireObject(value)
            return StandaloneGuidanceResultVariant3(
                `observation_id` = fields["observation_id"] as String,
                `guide_id` = fields["guide_id"] as String,
                `observation_generation` = (fields["observation_generation"] as Number).toLong(),
                `task_generation` = (fields["task_generation"] as Number).toLong(),
                `trigger_id` = fields["trigger_id"] as String,
                `frame_id` = fields["frame_id"] as String,
                `instruction` = fields["instruction"] as String
            )
        }
    }
}

data class StandaloneGuidanceResultVariant4(
    val `observation_id`: String,
    val `guide_id`: String,
    val `observation_generation`: Long,
    val `task_generation`: Long,
    val `trigger_id`: String,
    val `frame_id`: String,
    val `instruction`: String
) : WireObject, StandaloneGuidanceResult {
    val `kind`: String get() = "unsupported"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceResultVariant4", linkedMapOf(
        "observation_id" to `observation_id`,
        "guide_id" to `guide_id`,
        "observation_generation" to `observation_generation`,
        "task_generation" to `task_generation`,
        "trigger_id" to `trigger_id`,
        "frame_id" to `frame_id`,
        "kind" to `kind`,
        "instruction" to `instruction`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceResultVariant4 {
            ContractValidator.validate("StandaloneGuidanceResultVariant4", value)
            val fields = wireObject(value)
            return StandaloneGuidanceResultVariant4(
                `observation_id` = fields["observation_id"] as String,
                `guide_id` = fields["guide_id"] as String,
                `observation_generation` = (fields["observation_generation"] as Number).toLong(),
                `task_generation` = (fields["task_generation"] as Number).toLong(),
                `trigger_id` = fields["trigger_id"] as String,
                `frame_id` = fields["frame_id"] as String,
                `instruction` = fields["instruction"] as String
            )
        }
    }
}

enum class StandaloneGuidanceErrorCode(val wireValue: String) : WireValue {
    VALUE_GUIDANCE_AUTH_REQUIRED("GUIDANCE_AUTH_REQUIRED"),
    VALUE_GUIDANCE_INVALID_REQUEST("GUIDANCE_INVALID_REQUEST"),
    VALUE_GUIDANCE_UNSAFE_REQUEST("GUIDANCE_UNSAFE_REQUEST"),
    VALUE_GUIDANCE_UNAVAILABLE("GUIDANCE_UNAVAILABLE"),
    VALUE_GUIDANCE_PROVIDER_FAILURE("GUIDANCE_PROVIDER_FAILURE"),
    VALUE_GUIDANCE_INVALID_PROVIDER_RESPONSE("GUIDANCE_INVALID_PROVIDER_RESPONSE"),
    VALUE_GUIDANCE_UNSAFE_PROVIDER_RESPONSE("GUIDANCE_UNSAFE_PROVIDER_RESPONSE"),
    VALUE_GUIDANCE_ABORTED("GUIDANCE_ABORTED"),
    VALUE_GUIDANCE_TIMEOUT("GUIDANCE_TIMEOUT");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceErrorCode {
            ContractValidator.validate("StandaloneGuidanceErrorCode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class NormalizedRect(
    val `x`: Double,
    val `y`: Double,
    val `width`: Double,
    val `height`: Double
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("NormalizedRect", linkedMapOf(
        "x" to `x`,
        "y" to `y`,
        "width" to `width`,
        "height" to `height`
    ))
    companion object {
        fun fromWire(value: Any?): NormalizedRect {
            ContractValidator.validate("NormalizedRect", value)
            val fields = wireObject(value)
            return NormalizedRect(
                `x` = (fields["x"] as Number).toDouble(),
                `y` = (fields["y"] as Number).toDouble(),
                `width` = (fields["width"] as Number).toDouble(),
                `height` = (fields["height"] as Number).toDouble()
            )
        }
    }
}

sealed interface ServiceStreamEvent : WireValue {
    companion object {
        fun fromWire(value: Any?): ServiceStreamEvent {
            ContractValidator.validate("ServiceStreamEvent", value)
            if (ContractValidator.accepts("ServiceStreamEventResponseStarted", value)) return ServiceStreamEventResponseStarted.fromWire(value)
            if (ContractValidator.accepts("ServiceStreamEventCaptionSegment", value)) return ServiceStreamEventCaptionSegment.fromWire(value)
            if (ContractValidator.accepts("ServiceStreamEventResponseCompleted", value)) return ServiceStreamEventResponseCompleted.fromWire(value)
            if (ContractValidator.accepts("ServiceStreamEventResponseCancelled", value)) return ServiceStreamEventResponseCancelled.fromWire(value)
            if (ContractValidator.accepts("ServiceStreamEventResponseFailed", value)) return ServiceStreamEventResponseFailed.fromWire(value)
            if (ContractValidator.accepts("ServiceStreamEventGuidanceStep", value)) return ServiceStreamEventGuidanceStep.fromWire(value)
            if (ContractValidator.accepts("ServiceStreamEventGuidanceRisk", value)) return ServiceStreamEventGuidanceRisk.fromWire(value)
            if (ContractValidator.accepts("ServiceStreamEventGuidanceLowConfidence", value)) return ServiceStreamEventGuidanceLowConfidence.fromWire(value)
            if (ContractValidator.accepts("ServiceStreamEventGuidanceCompleted", value)) return ServiceStreamEventGuidanceCompleted.fromWire(value)
            if (ContractValidator.accepts("ServiceStreamEventPetJobProgress", value)) return ServiceStreamEventPetJobProgress.fromWire(value)
            if (ContractValidator.accepts("ServiceStreamEventPetJobSucceeded", value)) return ServiceStreamEventPetJobSucceeded.fromWire(value)
            if (ContractValidator.accepts("ServiceStreamEventPetJobFailed", value)) return ServiceStreamEventPetJobFailed.fromWire(value)
            throw ContractViolation("ServiceStreamEvent", "oneOf")
        }
    }
}

data class ServiceStreamEventResponseStarted(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventResponseStartedPayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "response.started"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventResponseStarted", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventResponseStarted {
            ContractValidator.validate("ServiceStreamEventResponseStarted", value)
            val fields = wireObject(value)
            return ServiceStreamEventResponseStarted(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventResponseStartedPayload.fromWire(fields["payload"])
            )
        }
    }
}

data object ServiceStreamEventResponseStartedPayload : WireObject {
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventResponseStartedPayload", emptyMap())
        fun fromWire(value: Any?): ServiceStreamEventResponseStartedPayload {
            ContractValidator.validate("ServiceStreamEventResponseStartedPayload", value)
            return ServiceStreamEventResponseStartedPayload
        }
}

data class ServiceStreamEventCaptionSegment(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventCaptionSegmentPayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "caption.segment"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventCaptionSegment", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventCaptionSegment {
            ContractValidator.validate("ServiceStreamEventCaptionSegment", value)
            val fields = wireObject(value)
            return ServiceStreamEventCaptionSegment(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventCaptionSegmentPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class ServiceStreamEventCaptionSegmentPayload(
    val `segment_id`: String,
    val `index`: Long,
    val `text`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventCaptionSegmentPayload", linkedMapOf(
        "segment_id" to `segment_id`,
        "index" to `index`,
        "text" to `text`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventCaptionSegmentPayload {
            ContractValidator.validate("ServiceStreamEventCaptionSegmentPayload", value)
            val fields = wireObject(value)
            return ServiceStreamEventCaptionSegmentPayload(
                `segment_id` = fields["segment_id"] as String,
                `index` = (fields["index"] as Number).toLong(),
                `text` = fields["text"] as String
            )
        }
    }
}

data class ServiceStreamEventResponseCompleted(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventResponseCompletedPayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "response.completed"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventResponseCompleted", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventResponseCompleted {
            ContractValidator.validate("ServiceStreamEventResponseCompleted", value)
            val fields = wireObject(value)
            return ServiceStreamEventResponseCompleted(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventResponseCompletedPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class ServiceStreamEventResponseCompletedPayload(
    val `final_segment_count`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventResponseCompletedPayload", linkedMapOf(
        "final_segment_count" to `final_segment_count`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventResponseCompletedPayload {
            ContractValidator.validate("ServiceStreamEventResponseCompletedPayload", value)
            val fields = wireObject(value)
            return ServiceStreamEventResponseCompletedPayload(
                `final_segment_count` = (fields["final_segment_count"] as Number).toLong()
            )
        }
    }
}

data class ServiceStreamEventResponseCancelled(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventResponseCancelledPayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "response.cancelled"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventResponseCancelled", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventResponseCancelled {
            ContractValidator.validate("ServiceStreamEventResponseCancelled", value)
            val fields = wireObject(value)
            return ServiceStreamEventResponseCancelled(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventResponseCancelledPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class ServiceStreamEventResponseCancelledPayload(
    val `reason`: ServiceStreamEventResponseCancelledPayloadReason
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventResponseCancelledPayload", linkedMapOf(
        "reason" to `reason`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventResponseCancelledPayload {
            ContractValidator.validate("ServiceStreamEventResponseCancelledPayload", value)
            val fields = wireObject(value)
            return ServiceStreamEventResponseCancelledPayload(
                `reason` = ServiceStreamEventResponseCancelledPayloadReason.fromWire(fields["reason"])
            )
        }
    }
}

enum class ServiceStreamEventResponseCancelledPayloadReason(val wireValue: String) : WireValue {
    VALUE_USER_STOP("user_stop"),
    VALUE_RISK("risk"),
    VALUE_PERMISSION_REVOKED("permission_revoked"),
    VALUE_CONSENT_REVOKED("consent_revoked");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventResponseCancelledPayloadReason {
            ContractValidator.validate("ServiceStreamEventResponseCancelledPayloadReason", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ServiceStreamEventResponseFailed(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventResponseFailedPayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "response.failed"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventResponseFailed", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventResponseFailed {
            ContractValidator.validate("ServiceStreamEventResponseFailed", value)
            val fields = wireObject(value)
            return ServiceStreamEventResponseFailed(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventResponseFailedPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class ServiceStreamEventResponseFailedPayload(
    val `code`: ServiceStreamEventResponseFailedPayloadCode,
    val `retryable`: Boolean
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventResponseFailedPayload", linkedMapOf(
        "code" to `code`,
        "retryable" to `retryable`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventResponseFailedPayload {
            ContractValidator.validate("ServiceStreamEventResponseFailedPayload", value)
            val fields = wireObject(value)
            return ServiceStreamEventResponseFailedPayload(
                `code` = ServiceStreamEventResponseFailedPayloadCode.fromWire(fields["code"]),
                `retryable` = fields["retryable"] as Boolean
            )
        }
    }
}

enum class ServiceStreamEventResponseFailedPayloadCode(val wireValue: String) : WireValue {
    VALUE_TIMEOUT("TIMEOUT"),
    VALUE_RATE_LIMITED("RATE_LIMITED"),
    VALUE_PROVIDER_UNAVAILABLE("PROVIDER_UNAVAILABLE");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventResponseFailedPayloadCode {
            ContractValidator.validate("ServiceStreamEventResponseFailedPayloadCode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ServiceStreamEventGuidanceStep(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventGuidanceStepPayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "guidance.step"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventGuidanceStep", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventGuidanceStep {
            ContractValidator.validate("ServiceStreamEventGuidanceStep", value)
            val fields = wireObject(value)
            return ServiceStreamEventGuidanceStep(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventGuidanceStepPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class ServiceStreamEventGuidanceStepPayload(
    val `step_id`: String,
    val `instruction`: String,
    val `frame_context`: FrameContextDto,
    val `target`: ServiceStreamEventGuidanceStepPayloadTarget,
    val `expires_at`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventGuidanceStepPayload", linkedMapOf(
        "step_id" to `step_id`,
        "instruction" to `instruction`,
        "frame_context" to `frame_context`,
        "target" to `target`,
        "expires_at" to `expires_at`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventGuidanceStepPayload {
            ContractValidator.validate("ServiceStreamEventGuidanceStepPayload", value)
            val fields = wireObject(value)
            return ServiceStreamEventGuidanceStepPayload(
                `step_id` = fields["step_id"] as String,
                `instruction` = fields["instruction"] as String,
                `frame_context` = FrameContextDto.fromWire(fields["frame_context"]),
                `target` = ServiceStreamEventGuidanceStepPayloadTarget.fromWire(fields["target"]),
                `expires_at` = fields["expires_at"] as String
            )
        }
    }
}

data class ServiceStreamEventGuidanceStepPayloadTarget(
    val `x`: Double,
    val `y`: Double,
    val `width`: Double,
    val `height`: Double
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventGuidanceStepPayloadTarget", linkedMapOf(
        "x" to `x`,
        "y" to `y`,
        "width" to `width`,
        "height" to `height`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventGuidanceStepPayloadTarget {
            ContractValidator.validate("ServiceStreamEventGuidanceStepPayloadTarget", value)
            val fields = wireObject(value)
            return ServiceStreamEventGuidanceStepPayloadTarget(
                `x` = (fields["x"] as Number).toDouble(),
                `y` = (fields["y"] as Number).toDouble(),
                `width` = (fields["width"] as Number).toDouble(),
                `height` = (fields["height"] as Number).toDouble()
            )
        }
    }
}

data class ServiceStreamEventGuidanceRisk(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventGuidanceRiskPayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "guidance.risk"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventGuidanceRisk", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventGuidanceRisk {
            ContractValidator.validate("ServiceStreamEventGuidanceRisk", value)
            val fields = wireObject(value)
            return ServiceStreamEventGuidanceRisk(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventGuidanceRiskPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class ServiceStreamEventGuidanceRiskPayload(
    val `risk`: ServiceStreamEventGuidanceRiskPayloadRisk,
    val `action`: ServiceStreamEventGuidanceRiskPayloadAction
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventGuidanceRiskPayload", linkedMapOf(
        "risk" to `risk`,
        "action" to `action`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventGuidanceRiskPayload {
            ContractValidator.validate("ServiceStreamEventGuidanceRiskPayload", value)
            val fields = wireObject(value)
            return ServiceStreamEventGuidanceRiskPayload(
                `risk` = ServiceStreamEventGuidanceRiskPayloadRisk.fromWire(fields["risk"]),
                `action` = ServiceStreamEventGuidanceRiskPayloadAction.fromWire(fields["action"])
            )
        }
    }
}

enum class ServiceStreamEventGuidanceRiskPayloadRisk(val wireValue: String) : WireValue {
    VALUE_PRIVATE("private"),
    VALUE_TRANSACTION("transaction"),
    VALUE_UNKNOWN("unknown"),
    VALUE_DETECTOR_FAILURE("detector_failure");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventGuidanceRiskPayloadRisk {
            ContractValidator.validate("ServiceStreamEventGuidanceRiskPayloadRisk", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class ServiceStreamEventGuidanceRiskPayloadAction(val wireValue: String) : WireValue {
    VALUE_PAUSE_ALL_RELATED("pause_all_related"),
    VALUE_STOP_TEACHING_AND_MEDIA("stop_teaching_and_media");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventGuidanceRiskPayloadAction {
            ContractValidator.validate("ServiceStreamEventGuidanceRiskPayloadAction", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ServiceStreamEventGuidanceLowConfidence(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventGuidanceLowConfidencePayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "guidance.low_confidence"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventGuidanceLowConfidence", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventGuidanceLowConfidence {
            ContractValidator.validate("ServiceStreamEventGuidanceLowConfidence", value)
            val fields = wireObject(value)
            return ServiceStreamEventGuidanceLowConfidence(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventGuidanceLowConfidencePayload.fromWire(fields["payload"])
            )
        }
    }
}

data object ServiceStreamEventGuidanceLowConfidencePayload : WireObject {
    val `action`: String get() = "request_help"
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventGuidanceLowConfidencePayload", linkedMapOf(
        "action" to `action`
    ))
        fun fromWire(value: Any?): ServiceStreamEventGuidanceLowConfidencePayload {
            ContractValidator.validate("ServiceStreamEventGuidanceLowConfidencePayload", value)
            return ServiceStreamEventGuidanceLowConfidencePayload
        }
}

data class ServiceStreamEventGuidanceCompleted(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventGuidanceCompletedPayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "guidance.completed"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventGuidanceCompleted", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventGuidanceCompleted {
            ContractValidator.validate("ServiceStreamEventGuidanceCompleted", value)
            val fields = wireObject(value)
            return ServiceStreamEventGuidanceCompleted(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventGuidanceCompletedPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class ServiceStreamEventGuidanceCompletedPayload(
    val `verification_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventGuidanceCompletedPayload", linkedMapOf(
        "verification_id" to `verification_id`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventGuidanceCompletedPayload {
            ContractValidator.validate("ServiceStreamEventGuidanceCompletedPayload", value)
            val fields = wireObject(value)
            return ServiceStreamEventGuidanceCompletedPayload(
                `verification_id` = fields["verification_id"] as String
            )
        }
    }
}

data class ServiceStreamEventPetJobProgress(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventPetJobProgressPayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "pet_job.progress"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventPetJobProgress", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventPetJobProgress {
            ContractValidator.validate("ServiceStreamEventPetJobProgress", value)
            val fields = wireObject(value)
            return ServiceStreamEventPetJobProgress(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventPetJobProgressPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class ServiceStreamEventPetJobProgressPayload(
    val `status`: ServiceStreamEventPetJobProgressPayloadStatus,
    val `progress`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventPetJobProgressPayload", linkedMapOf(
        "status" to `status`,
        "progress" to `progress`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventPetJobProgressPayload {
            ContractValidator.validate("ServiceStreamEventPetJobProgressPayload", value)
            val fields = wireObject(value)
            return ServiceStreamEventPetJobProgressPayload(
                `status` = ServiceStreamEventPetJobProgressPayloadStatus.fromWire(fields["status"]),
                `progress` = (fields["progress"] as Number).toLong()
            )
        }
    }
}

enum class ServiceStreamEventPetJobProgressPayloadStatus(val wireValue: String) : WireValue {
    VALUE_QUEUED("queued"),
    VALUE_PROCESSING("processing");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventPetJobProgressPayloadStatus {
            ContractValidator.validate("ServiceStreamEventPetJobProgressPayloadStatus", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ServiceStreamEventPetJobSucceeded(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventPetJobSucceededPayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "pet_job.succeeded"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventPetJobSucceeded", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventPetJobSucceeded {
            ContractValidator.validate("ServiceStreamEventPetJobSucceeded", value)
            val fields = wireObject(value)
            return ServiceStreamEventPetJobSucceeded(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventPetJobSucceededPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class ServiceStreamEventPetJobSucceededPayload(
    val `assets`: List<AssetDto>
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventPetJobSucceededPayload", linkedMapOf(
        "assets" to `assets`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventPetJobSucceededPayload {
            ContractValidator.validate("ServiceStreamEventPetJobSucceededPayload", value)
            val fields = wireObject(value)
            return ServiceStreamEventPetJobSucceededPayload(
                `assets` = (fields["assets"] as List<*>).map { item -> AssetDto.fromWire(item) }
            )
        }
    }
}

data class ServiceStreamEventPetJobFailed(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: ServiceStreamEventPetJobFailedPayload
) : WireObject, ServiceStreamEvent {
    val `type`: String get() = "pet_job.failed"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventPetJobFailed", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventPetJobFailed {
            ContractValidator.validate("ServiceStreamEventPetJobFailed", value)
            val fields = wireObject(value)
            return ServiceStreamEventPetJobFailed(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = ServiceStreamEventPetJobFailedPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class ServiceStreamEventPetJobFailedPayload(
    val `code`: ServiceStreamEventPetJobFailedPayloadCode
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ServiceStreamEventPetJobFailedPayload", linkedMapOf(
        "code" to `code`
    ))
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventPetJobFailedPayload {
            ContractValidator.validate("ServiceStreamEventPetJobFailedPayload", value)
            val fields = wireObject(value)
            return ServiceStreamEventPetJobFailedPayload(
                `code` = ServiceStreamEventPetJobFailedPayloadCode.fromWire(fields["code"])
            )
        }
    }
}

enum class ServiceStreamEventPetJobFailedPayloadCode(val wireValue: String) : WireValue {
    VALUE_PROVIDER_UNAVAILABLE("PROVIDER_UNAVAILABLE"),
    VALUE_RATE_LIMITED("RATE_LIMITED"),
    VALUE_CANCELLED("CANCELLED");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ServiceStreamEventPetJobFailedPayloadCode {
            ContractValidator.validate("ServiceStreamEventPetJobFailedPayloadCode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

sealed interface AssistSignal : WireValue {
    companion object {
        fun fromWire(value: Any?): AssistSignal {
            ContractValidator.validate("AssistSignal", value)
            if (ContractValidator.accepts("AssistSignalInvite", value)) return AssistSignalInvite.fromWire(value)
            if (ContractValidator.accepts("AssistSignalAccept", value)) return AssistSignalAccept.fromWire(value)
            if (ContractValidator.accepts("AssistSignalOffer", value)) return AssistSignalOffer.fromWire(value)
            if (ContractValidator.accepts("AssistSignalAnswer", value)) return AssistSignalAnswer.fromWire(value)
            if (ContractValidator.accepts("AssistSignalIce", value)) return AssistSignalIce.fromWire(value)
            if (ContractValidator.accepts("AssistSignalRiskPause", value)) return AssistSignalRiskPause.fromWire(value)
            if (ContractValidator.accepts("AssistSignalConsentRevoked", value)) return AssistSignalConsentRevoked.fromWire(value)
            if (ContractValidator.accepts("AssistSignalEnd", value)) return AssistSignalEnd.fromWire(value)
            throw ContractViolation("AssistSignal", "oneOf")
        }
    }
}

data class AssistSignalInvite(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: AssistSignalInvitePayload
) : WireObject, AssistSignal {
    val `type`: String get() = "invite"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalInvite", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalInvite {
            ContractValidator.validate("AssistSignalInvite", value)
            val fields = wireObject(value)
            return AssistSignalInvite(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = AssistSignalInvitePayload.fromWire(fields["payload"])
            )
        }
    }
}

data class AssistSignalInvitePayload(
    val `assist_id`: String,
    val `expires_at`: String,
    val `grant_revision`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalInvitePayload", linkedMapOf(
        "assist_id" to `assist_id`,
        "expires_at" to `expires_at`,
        "grant_revision" to `grant_revision`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalInvitePayload {
            ContractValidator.validate("AssistSignalInvitePayload", value)
            val fields = wireObject(value)
            return AssistSignalInvitePayload(
                `assist_id` = fields["assist_id"] as String,
                `expires_at` = fields["expires_at"] as String,
                `grant_revision` = (fields["grant_revision"] as Number).toLong()
            )
        }
    }
}

data class AssistSignalAccept(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: AssistSignalAcceptPayload
) : WireObject, AssistSignal {
    val `type`: String get() = "accept"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalAccept", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalAccept {
            ContractValidator.validate("AssistSignalAccept", value)
            val fields = wireObject(value)
            return AssistSignalAccept(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = AssistSignalAcceptPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class AssistSignalAcceptPayload(
    val `assist_id`: String,
    val `grant_revision`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalAcceptPayload", linkedMapOf(
        "assist_id" to `assist_id`,
        "grant_revision" to `grant_revision`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalAcceptPayload {
            ContractValidator.validate("AssistSignalAcceptPayload", value)
            val fields = wireObject(value)
            return AssistSignalAcceptPayload(
                `assist_id` = fields["assist_id"] as String,
                `grant_revision` = (fields["grant_revision"] as Number).toLong()
            )
        }
    }
}

data class AssistSignalOffer(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: AssistSignalOfferPayload
) : WireObject, AssistSignal {
    val `type`: String get() = "offer"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalOffer", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalOffer {
            ContractValidator.validate("AssistSignalOffer", value)
            val fields = wireObject(value)
            return AssistSignalOffer(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = AssistSignalOfferPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class AssistSignalOfferPayload(
    val `assist_id`: String,
    val `sdp`: String,
    val `grant_revision`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalOfferPayload", linkedMapOf(
        "assist_id" to `assist_id`,
        "sdp" to `sdp`,
        "grant_revision" to `grant_revision`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalOfferPayload {
            ContractValidator.validate("AssistSignalOfferPayload", value)
            val fields = wireObject(value)
            return AssistSignalOfferPayload(
                `assist_id` = fields["assist_id"] as String,
                `sdp` = fields["sdp"] as String,
                `grant_revision` = (fields["grant_revision"] as Number).toLong()
            )
        }
    }
}

data class AssistSignalAnswer(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: AssistSignalAnswerPayload
) : WireObject, AssistSignal {
    val `type`: String get() = "answer"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalAnswer", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalAnswer {
            ContractValidator.validate("AssistSignalAnswer", value)
            val fields = wireObject(value)
            return AssistSignalAnswer(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = AssistSignalAnswerPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class AssistSignalAnswerPayload(
    val `assist_id`: String,
    val `sdp`: String,
    val `grant_revision`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalAnswerPayload", linkedMapOf(
        "assist_id" to `assist_id`,
        "sdp" to `sdp`,
        "grant_revision" to `grant_revision`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalAnswerPayload {
            ContractValidator.validate("AssistSignalAnswerPayload", value)
            val fields = wireObject(value)
            return AssistSignalAnswerPayload(
                `assist_id` = fields["assist_id"] as String,
                `sdp` = fields["sdp"] as String,
                `grant_revision` = (fields["grant_revision"] as Number).toLong()
            )
        }
    }
}

data class AssistSignalIce(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: AssistSignalIcePayload
) : WireObject, AssistSignal {
    val `type`: String get() = "ice"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalIce", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalIce {
            ContractValidator.validate("AssistSignalIce", value)
            val fields = wireObject(value)
            return AssistSignalIce(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = AssistSignalIcePayload.fromWire(fields["payload"])
            )
        }
    }
}

data class AssistSignalIcePayload(
    val `assist_id`: String,
    val `candidate`: String,
    val `grant_revision`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalIcePayload", linkedMapOf(
        "assist_id" to `assist_id`,
        "candidate" to `candidate`,
        "grant_revision" to `grant_revision`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalIcePayload {
            ContractValidator.validate("AssistSignalIcePayload", value)
            val fields = wireObject(value)
            return AssistSignalIcePayload(
                `assist_id` = fields["assist_id"] as String,
                `candidate` = fields["candidate"] as String,
                `grant_revision` = (fields["grant_revision"] as Number).toLong()
            )
        }
    }
}

data class AssistSignalRiskPause(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: AssistSignalRiskPausePayload
) : WireObject, AssistSignal {
    val `type`: String get() = "risk.pause"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalRiskPause", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalRiskPause {
            ContractValidator.validate("AssistSignalRiskPause", value)
            val fields = wireObject(value)
            return AssistSignalRiskPause(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = AssistSignalRiskPausePayload.fromWire(fields["payload"])
            )
        }
    }
}

data class AssistSignalRiskPausePayload(
    val `assist_id`: String,
    val `reason`: AssistSignalRiskPausePayloadReason
) : WireObject {
    val `screen_paused`: Boolean get() = true
    val `audio_paused`: Boolean get() = true
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalRiskPausePayload", linkedMapOf(
        "assist_id" to `assist_id`,
        "screen_paused" to `screen_paused`,
        "audio_paused" to `audio_paused`,
        "reason" to `reason`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalRiskPausePayload {
            ContractValidator.validate("AssistSignalRiskPausePayload", value)
            val fields = wireObject(value)
            return AssistSignalRiskPausePayload(
                `assist_id` = fields["assist_id"] as String,
                `reason` = AssistSignalRiskPausePayloadReason.fromWire(fields["reason"])
            )
        }
    }
}

enum class AssistSignalRiskPausePayloadReason(val wireValue: String) : WireValue {
    VALUE_TRANSACTION("transaction"),
    VALUE_PRIVATE("private"),
    VALUE_UNKNOWN("unknown"),
    VALUE_DETECTOR_FAILURE("detector_failure");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): AssistSignalRiskPausePayloadReason {
            ContractValidator.validate("AssistSignalRiskPausePayloadReason", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class AssistSignalConsentRevoked(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: AssistSignalConsentRevokedPayload
) : WireObject, AssistSignal {
    val `type`: String get() = "consent.revoked"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalConsentRevoked", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalConsentRevoked {
            ContractValidator.validate("AssistSignalConsentRevoked", value)
            val fields = wireObject(value)
            return AssistSignalConsentRevoked(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = AssistSignalConsentRevokedPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class AssistSignalConsentRevokedPayload(
    val `assist_id`: String,
    val `consent_id`: String,
    val `grant_revision`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalConsentRevokedPayload", linkedMapOf(
        "assist_id" to `assist_id`,
        "consent_id" to `consent_id`,
        "grant_revision" to `grant_revision`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalConsentRevokedPayload {
            ContractValidator.validate("AssistSignalConsentRevokedPayload", value)
            val fields = wireObject(value)
            return AssistSignalConsentRevokedPayload(
                `assist_id` = fields["assist_id"] as String,
                `consent_id` = fields["consent_id"] as String,
                `grant_revision` = (fields["grant_revision"] as Number).toLong()
            )
        }
    }
}

data class AssistSignalEnd(
    val `request_id`: String,
    val `session_id`: String,
    val `event_id`: String,
    val `seq`: Long,
    val `generation`: Long,
    val `payload`: AssistSignalEndPayload
) : WireObject, AssistSignal {
    val `type`: String get() = "end"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalEnd", linkedMapOf(
        "request_id" to `request_id`,
        "session_id" to `session_id`,
        "event_id" to `event_id`,
        "seq" to `seq`,
        "generation" to `generation`,
        "type" to `type`,
        "payload" to `payload`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalEnd {
            ContractValidator.validate("AssistSignalEnd", value)
            val fields = wireObject(value)
            return AssistSignalEnd(
                `request_id` = fields["request_id"] as String,
                `session_id` = fields["session_id"] as String,
                `event_id` = fields["event_id"] as String,
                `seq` = (fields["seq"] as Number).toLong(),
                `generation` = (fields["generation"] as Number).toLong(),
                `payload` = AssistSignalEndPayload.fromWire(fields["payload"])
            )
        }
    }
}

data class AssistSignalEndPayload(
    val `assist_id`: String,
    val `reason`: AssistSignalEndPayloadReason
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("AssistSignalEndPayload", linkedMapOf(
        "assist_id" to `assist_id`,
        "reason" to `reason`
    ))
    companion object {
        fun fromWire(value: Any?): AssistSignalEndPayload {
            ContractValidator.validate("AssistSignalEndPayload", value)
            val fields = wireObject(value)
            return AssistSignalEndPayload(
                `assist_id` = fields["assist_id"] as String,
                `reason` = AssistSignalEndPayloadReason.fromWire(fields["reason"])
            )
        }
    }
}

enum class AssistSignalEndPayloadReason(val wireValue: String) : WireValue {
    VALUE_USER_STOP("user_stop"),
    VALUE_EXPIRED("expired"),
    VALUE_PERMISSION_REVOKED("permission_revoked"),
    VALUE_CONSENT_REVOKED("consent_revoked"),
    VALUE_DISCONNECTED("disconnected");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): AssistSignalEndPayloadReason {
            ContractValidator.validate("AssistSignalEndPayloadReason", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class VoiceFrameHeader(
    val `request_id`: String,
    val `generation`: Long,
    val `seq`: Long,
    val `codec`: VoiceFrameHeaderCodec,
    val `byte_length`: Long,
    val `duration_ms`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("VoiceFrameHeader", linkedMapOf(
        "request_id" to `request_id`,
        "generation" to `generation`,
        "seq" to `seq`,
        "codec" to `codec`,
        "byte_length" to `byte_length`,
        "duration_ms" to `duration_ms`
    ))
    companion object {
        fun fromWire(value: Any?): VoiceFrameHeader {
            ContractValidator.validate("VoiceFrameHeader", value)
            val fields = wireObject(value)
            return VoiceFrameHeader(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `seq` = (fields["seq"] as Number).toLong(),
                `codec` = VoiceFrameHeaderCodec.fromWire(fields["codec"]),
                `byte_length` = (fields["byte_length"] as Number).toLong(),
                `duration_ms` = (fields["duration_ms"] as Number).toLong()
            )
        }
    }
}

enum class VoiceFrameHeaderCodec(val wireValue: String) : WireValue {
    VALUE_OPUS("opus"),
    VALUE_PCM_S16LE("pcm_s16le");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): VoiceFrameHeaderCodec {
            ContractValidator.validate("VoiceFrameHeaderCodec", value)
            return entries.first { it.wireValue == value }
        }
    }
}

sealed interface BridgeRequestV1 : WireValue {
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1 {
            ContractValidator.validate("BridgeRequestV1", value)
            if (ContractValidator.accepts("BridgeRequestV1CapabilitiesGet", value)) return BridgeRequestV1CapabilitiesGet.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1PermissionsRequest", value)) return BridgeRequestV1PermissionsRequest.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1CaptureStart", value)) return BridgeRequestV1CaptureStart.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1CaptureStop", value)) return BridgeRequestV1CaptureStop.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1CameraStart", value)) return BridgeRequestV1CameraStart.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1CameraStop", value)) return BridgeRequestV1CameraStop.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1AudioStart", value)) return BridgeRequestV1AudioStart.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1AudioStop", value)) return BridgeRequestV1AudioStop.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1OverlayPresent", value)) return BridgeRequestV1OverlayPresent.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1OverlayClear", value)) return BridgeRequestV1OverlayClear.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1NotificationsSchedule", value)) return BridgeRequestV1NotificationsSchedule.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1NotificationsCancel", value)) return BridgeRequestV1NotificationsCancel.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1StorageNotesRead", value)) return BridgeRequestV1StorageNotesRead.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1StorageDrawingRead", value)) return BridgeRequestV1StorageDrawingRead.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1AssetsImport", value)) return BridgeRequestV1AssetsImport.fromWire(value)
            if (ContractValidator.accepts("BridgeRequestV1AssetsPreview", value)) return BridgeRequestV1AssetsPreview.fromWire(value)
            throw ContractViolation("BridgeRequestV1", "oneOf")
        }
    }
}

data class BridgeRequestV1CapabilitiesGet(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1CapabilitiesGetParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "capabilities.get"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1CapabilitiesGet", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1CapabilitiesGet {
            ContractValidator.validate("BridgeRequestV1CapabilitiesGet", value)
            val fields = wireObject(value)
            return BridgeRequestV1CapabilitiesGet(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1CapabilitiesGetParams.fromWire(fields["params"])
            )
        }
    }
}

data object BridgeRequestV1CapabilitiesGetParams : WireObject {
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1CapabilitiesGetParams", emptyMap())
        fun fromWire(value: Any?): BridgeRequestV1CapabilitiesGetParams {
            ContractValidator.validate("BridgeRequestV1CapabilitiesGetParams", value)
            return BridgeRequestV1CapabilitiesGetParams
        }
}

data class BridgeRequestV1PermissionsRequest(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1PermissionsRequestParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "permissions.request"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1PermissionsRequest", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1PermissionsRequest {
            ContractValidator.validate("BridgeRequestV1PermissionsRequest", value)
            val fields = wireObject(value)
            return BridgeRequestV1PermissionsRequest(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1PermissionsRequestParams.fromWire(fields["params"])
            )
        }
    }
}

data class BridgeRequestV1PermissionsRequestParams(
    val `permission`: BridgeRequestV1PermissionsRequestParamsPermission,
    val `purpose`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1PermissionsRequestParams", linkedMapOf(
        "permission" to `permission`,
        "purpose" to `purpose`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1PermissionsRequestParams {
            ContractValidator.validate("BridgeRequestV1PermissionsRequestParams", value)
            val fields = wireObject(value)
            return BridgeRequestV1PermissionsRequestParams(
                `permission` = BridgeRequestV1PermissionsRequestParamsPermission.fromWire(fields["permission"]),
                `purpose` = fields["purpose"] as String
            )
        }
    }
}

enum class BridgeRequestV1PermissionsRequestParamsPermission(val wireValue: String) : WireValue {
    VALUE_SCREEN_CAPTURE("screen_capture"),
    VALUE_CAMERA("camera"),
    VALUE_MICROPHONE("microphone"),
    VALUE_OVERLAY("overlay"),
    VALUE_NOTIFICATIONS("notifications");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1PermissionsRequestParamsPermission {
            ContractValidator.validate("BridgeRequestV1PermissionsRequestParamsPermission", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class BridgeRequestV1CaptureStart(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1CaptureStartParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "capture.start"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1CaptureStart", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1CaptureStart {
            ContractValidator.validate("BridgeRequestV1CaptureStart", value)
            val fields = wireObject(value)
            return BridgeRequestV1CaptureStart(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1CaptureStartParams.fromWire(fields["params"])
            )
        }
    }
}

data class BridgeRequestV1CaptureStartParams(
    val `purpose`: BridgeRequestV1CaptureStartParamsPurpose,
    val `consent_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1CaptureStartParams", linkedMapOf(
        "purpose" to `purpose`,
        "consent_id" to `consent_id`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1CaptureStartParams {
            ContractValidator.validate("BridgeRequestV1CaptureStartParams", value)
            val fields = wireObject(value)
            return BridgeRequestV1CaptureStartParams(
                `purpose` = BridgeRequestV1CaptureStartParamsPurpose.fromWire(fields["purpose"]),
                `consent_id` = fields["consent_id"] as String
            )
        }
    }
}

enum class BridgeRequestV1CaptureStartParamsPurpose(val wireValue: String) : WireValue {
    VALUE_TEACHING("teaching"),
    VALUE_ASSISTANCE("assistance");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1CaptureStartParamsPurpose {
            ContractValidator.validate("BridgeRequestV1CaptureStartParamsPurpose", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class BridgeRequestV1CaptureStop(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1CaptureStopParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "capture.stop"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1CaptureStop", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1CaptureStop {
            ContractValidator.validate("BridgeRequestV1CaptureStop", value)
            val fields = wireObject(value)
            return BridgeRequestV1CaptureStop(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1CaptureStopParams.fromWire(fields["params"])
            )
        }
    }
}

data object BridgeRequestV1CaptureStopParams : WireObject {
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1CaptureStopParams", emptyMap())
        fun fromWire(value: Any?): BridgeRequestV1CaptureStopParams {
            ContractValidator.validate("BridgeRequestV1CaptureStopParams", value)
            return BridgeRequestV1CaptureStopParams
        }
}

data class BridgeRequestV1CameraStart(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1CameraStartParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "camera.start"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1CameraStart", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1CameraStart {
            ContractValidator.validate("BridgeRequestV1CameraStart", value)
            val fields = wireObject(value)
            return BridgeRequestV1CameraStart(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1CameraStartParams.fromWire(fields["params"])
            )
        }
    }
}

data class BridgeRequestV1CameraStartParams(
    val `consent_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1CameraStartParams", linkedMapOf(
        "consent_id" to `consent_id`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1CameraStartParams {
            ContractValidator.validate("BridgeRequestV1CameraStartParams", value)
            val fields = wireObject(value)
            return BridgeRequestV1CameraStartParams(
                `consent_id` = fields["consent_id"] as String
            )
        }
    }
}

data class BridgeRequestV1CameraStop(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1CameraStopParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "camera.stop"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1CameraStop", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1CameraStop {
            ContractValidator.validate("BridgeRequestV1CameraStop", value)
            val fields = wireObject(value)
            return BridgeRequestV1CameraStop(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1CameraStopParams.fromWire(fields["params"])
            )
        }
    }
}

data object BridgeRequestV1CameraStopParams : WireObject {
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1CameraStopParams", emptyMap())
        fun fromWire(value: Any?): BridgeRequestV1CameraStopParams {
            ContractValidator.validate("BridgeRequestV1CameraStopParams", value)
            return BridgeRequestV1CameraStopParams
        }
}

data class BridgeRequestV1AudioStart(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1AudioStartParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "audio.start"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1AudioStart", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1AudioStart {
            ContractValidator.validate("BridgeRequestV1AudioStart", value)
            val fields = wireObject(value)
            return BridgeRequestV1AudioStart(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1AudioStartParams.fromWire(fields["params"])
            )
        }
    }
}

data class BridgeRequestV1AudioStartParams(
    val `purpose`: BridgeRequestV1AudioStartParamsPurpose,
    val `consent_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1AudioStartParams", linkedMapOf(
        "purpose" to `purpose`,
        "consent_id" to `consent_id`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1AudioStartParams {
            ContractValidator.validate("BridgeRequestV1AudioStartParams", value)
            val fields = wireObject(value)
            return BridgeRequestV1AudioStartParams(
                `purpose` = BridgeRequestV1AudioStartParamsPurpose.fromWire(fields["purpose"]),
                `consent_id` = fields["consent_id"] as String
            )
        }
    }
}

enum class BridgeRequestV1AudioStartParamsPurpose(val wireValue: String) : WireValue {
    VALUE_QUESTION("question"),
    VALUE_ASSISTANCE("assistance");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1AudioStartParamsPurpose {
            ContractValidator.validate("BridgeRequestV1AudioStartParamsPurpose", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class BridgeRequestV1AudioStop(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1AudioStopParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "audio.stop"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1AudioStop", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1AudioStop {
            ContractValidator.validate("BridgeRequestV1AudioStop", value)
            val fields = wireObject(value)
            return BridgeRequestV1AudioStop(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1AudioStopParams.fromWire(fields["params"])
            )
        }
    }
}

data object BridgeRequestV1AudioStopParams : WireObject {
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1AudioStopParams", emptyMap())
        fun fromWire(value: Any?): BridgeRequestV1AudioStopParams {
            ContractValidator.validate("BridgeRequestV1AudioStopParams", value)
            return BridgeRequestV1AudioStopParams
        }
}

data class BridgeRequestV1OverlayPresent(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1OverlayPresentParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "overlay.present"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1OverlayPresent", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1OverlayPresent {
            ContractValidator.validate("BridgeRequestV1OverlayPresent", value)
            val fields = wireObject(value)
            return BridgeRequestV1OverlayPresent(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1OverlayPresentParams.fromWire(fields["params"])
            )
        }
    }
}

data class BridgeRequestV1OverlayPresentParams(
    val `step_id`: String,
    val `safe_handle`: String,
    val `frame_context`: FrameContextDto,
    val `target`: BridgeRequestV1OverlayPresentParamsTarget,
    val `expires_at`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1OverlayPresentParams", linkedMapOf(
        "step_id" to `step_id`,
        "safe_handle" to `safe_handle`,
        "frame_context" to `frame_context`,
        "target" to `target`,
        "expires_at" to `expires_at`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1OverlayPresentParams {
            ContractValidator.validate("BridgeRequestV1OverlayPresentParams", value)
            val fields = wireObject(value)
            return BridgeRequestV1OverlayPresentParams(
                `step_id` = fields["step_id"] as String,
                `safe_handle` = fields["safe_handle"] as String,
                `frame_context` = FrameContextDto.fromWire(fields["frame_context"]),
                `target` = BridgeRequestV1OverlayPresentParamsTarget.fromWire(fields["target"]),
                `expires_at` = fields["expires_at"] as String
            )
        }
    }
}

data class BridgeRequestV1OverlayPresentParamsTarget(
    val `x`: Double,
    val `y`: Double,
    val `width`: Double,
    val `height`: Double
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1OverlayPresentParamsTarget", linkedMapOf(
        "x" to `x`,
        "y" to `y`,
        "width" to `width`,
        "height" to `height`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1OverlayPresentParamsTarget {
            ContractValidator.validate("BridgeRequestV1OverlayPresentParamsTarget", value)
            val fields = wireObject(value)
            return BridgeRequestV1OverlayPresentParamsTarget(
                `x` = (fields["x"] as Number).toDouble(),
                `y` = (fields["y"] as Number).toDouble(),
                `width` = (fields["width"] as Number).toDouble(),
                `height` = (fields["height"] as Number).toDouble()
            )
        }
    }
}

data class BridgeRequestV1OverlayClear(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1OverlayClearParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "overlay.clear"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1OverlayClear", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1OverlayClear {
            ContractValidator.validate("BridgeRequestV1OverlayClear", value)
            val fields = wireObject(value)
            return BridgeRequestV1OverlayClear(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1OverlayClearParams.fromWire(fields["params"])
            )
        }
    }
}

data object BridgeRequestV1OverlayClearParams : WireObject {
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1OverlayClearParams", emptyMap())
        fun fromWire(value: Any?): BridgeRequestV1OverlayClearParams {
            ContractValidator.validate("BridgeRequestV1OverlayClearParams", value)
            return BridgeRequestV1OverlayClearParams
        }
}

data class BridgeRequestV1NotificationsSchedule(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1NotificationsScheduleParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "notifications.schedule"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1NotificationsSchedule", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1NotificationsSchedule {
            ContractValidator.validate("BridgeRequestV1NotificationsSchedule", value)
            val fields = wireObject(value)
            return BridgeRequestV1NotificationsSchedule(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1NotificationsScheduleParams.fromWire(fields["params"])
            )
        }
    }
}

data class BridgeRequestV1NotificationsScheduleParams(
    val `todo_id`: String,
    val `instance_id`: String,
    val `planned_at`: String,
    val `schedule_revision`: Long
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1NotificationsScheduleParams", linkedMapOf(
        "todo_id" to `todo_id`,
        "instance_id" to `instance_id`,
        "planned_at" to `planned_at`,
        "schedule_revision" to `schedule_revision`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1NotificationsScheduleParams {
            ContractValidator.validate("BridgeRequestV1NotificationsScheduleParams", value)
            val fields = wireObject(value)
            return BridgeRequestV1NotificationsScheduleParams(
                `todo_id` = fields["todo_id"] as String,
                `instance_id` = fields["instance_id"] as String,
                `planned_at` = fields["planned_at"] as String,
                `schedule_revision` = (fields["schedule_revision"] as Number).toLong()
            )
        }
    }
}

data class BridgeRequestV1NotificationsCancel(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1NotificationsCancelParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "notifications.cancel"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1NotificationsCancel", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1NotificationsCancel {
            ContractValidator.validate("BridgeRequestV1NotificationsCancel", value)
            val fields = wireObject(value)
            return BridgeRequestV1NotificationsCancel(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1NotificationsCancelParams.fromWire(fields["params"])
            )
        }
    }
}

data class BridgeRequestV1NotificationsCancelParams(
    val `instance_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1NotificationsCancelParams", linkedMapOf(
        "instance_id" to `instance_id`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1NotificationsCancelParams {
            ContractValidator.validate("BridgeRequestV1NotificationsCancelParams", value)
            val fields = wireObject(value)
            return BridgeRequestV1NotificationsCancelParams(
                `instance_id` = fields["instance_id"] as String
            )
        }
    }
}

data class BridgeRequestV1StorageNotesRead(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1StorageNotesReadParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "storage.notes.read"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1StorageNotesRead", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1StorageNotesRead {
            ContractValidator.validate("BridgeRequestV1StorageNotesRead", value)
            val fields = wireObject(value)
            return BridgeRequestV1StorageNotesRead(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1StorageNotesReadParams.fromWire(fields["params"])
            )
        }
    }
}

data class BridgeRequestV1StorageNotesReadParams(
    val `account_partition`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1StorageNotesReadParams", linkedMapOf(
        "account_partition" to `account_partition`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1StorageNotesReadParams {
            ContractValidator.validate("BridgeRequestV1StorageNotesReadParams", value)
            val fields = wireObject(value)
            return BridgeRequestV1StorageNotesReadParams(
                `account_partition` = fields["account_partition"] as String
            )
        }
    }
}

data class BridgeRequestV1StorageDrawingRead(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1StorageDrawingReadParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "storage.drawing.read"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1StorageDrawingRead", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1StorageDrawingRead {
            ContractValidator.validate("BridgeRequestV1StorageDrawingRead", value)
            val fields = wireObject(value)
            return BridgeRequestV1StorageDrawingRead(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1StorageDrawingReadParams.fromWire(fields["params"])
            )
        }
    }
}

data class BridgeRequestV1StorageDrawingReadParams(
    val `draft_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1StorageDrawingReadParams", linkedMapOf(
        "draft_id" to `draft_id`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1StorageDrawingReadParams {
            ContractValidator.validate("BridgeRequestV1StorageDrawingReadParams", value)
            val fields = wireObject(value)
            return BridgeRequestV1StorageDrawingReadParams(
                `draft_id` = fields["draft_id"] as String
            )
        }
    }
}

data class BridgeRequestV1AssetsImport(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1AssetsImportParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "assets.import"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1AssetsImport", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1AssetsImport {
            ContractValidator.validate("BridgeRequestV1AssetsImport", value)
            val fields = wireObject(value)
            return BridgeRequestV1AssetsImport(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1AssetsImportParams.fromWire(fields["params"])
            )
        }
    }
}

data class BridgeRequestV1AssetsImportParams(
    val `local_file_handle`: String,
    val `kind`: BridgeRequestV1AssetsImportParamsKind
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1AssetsImportParams", linkedMapOf(
        "local_file_handle" to `local_file_handle`,
        "kind" to `kind`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1AssetsImportParams {
            ContractValidator.validate("BridgeRequestV1AssetsImportParams", value)
            val fields = wireObject(value)
            return BridgeRequestV1AssetsImportParams(
                `local_file_handle` = fields["local_file_handle"] as String,
                `kind` = BridgeRequestV1AssetsImportParamsKind.fromWire(fields["kind"])
            )
        }
    }
}

enum class BridgeRequestV1AssetsImportParamsKind(val wireValue: String) : WireValue {
    VALUE_VRM("vrm"),
    VALUE_FBX("fbx"),
    VALUE_GLB("glb");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1AssetsImportParamsKind {
            ContractValidator.validate("BridgeRequestV1AssetsImportParamsKind", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class BridgeRequestV1AssetsPreview(
    val `request_id`: String,
    val `generation`: Long,
    val `params`: BridgeRequestV1AssetsPreviewParams
) : WireObject, BridgeRequestV1 {
    val `bridge_version`: String get() = "1.0"
    val `method`: String get() = "assets.preview"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1AssetsPreview", linkedMapOf(
        "bridge_version" to `bridge_version`,
        "request_id" to `request_id`,
        "generation" to `generation`,
        "method" to `method`,
        "params" to `params`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1AssetsPreview {
            ContractValidator.validate("BridgeRequestV1AssetsPreview", value)
            val fields = wireObject(value)
            return BridgeRequestV1AssetsPreview(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `params` = BridgeRequestV1AssetsPreviewParams.fromWire(fields["params"])
            )
        }
    }
}

data class BridgeRequestV1AssetsPreviewParams(
    val `asset_handle`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeRequestV1AssetsPreviewParams", linkedMapOf(
        "asset_handle" to `asset_handle`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeRequestV1AssetsPreviewParams {
            ContractValidator.validate("BridgeRequestV1AssetsPreviewParams", value)
            val fields = wireObject(value)
            return BridgeRequestV1AssetsPreviewParams(
                `asset_handle` = fields["asset_handle"] as String
            )
        }
    }
}

sealed interface BridgeReplyV1 : WireValue {
    companion object {
        fun fromWire(value: Any?): BridgeReplyV1 {
            ContractValidator.validate("BridgeReplyV1", value)
            if (ContractValidator.accepts("BridgeReplyV1True", value)) return BridgeReplyV1True.fromWire(value)
            if (ContractValidator.accepts("BridgeReplyV1False", value)) return BridgeReplyV1False.fromWire(value)
            throw ContractViolation("BridgeReplyV1", "oneOf")
        }
    }
}

data class BridgeReplyV1True(
    val `request_id`: String,
    val `generation`: Long,
    val `result`: BridgeReplyV1TrueResult
) : WireObject, BridgeReplyV1 {
    val `ok`: Boolean get() = true
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeReplyV1True", linkedMapOf(
        "request_id" to `request_id`,
        "generation" to `generation`,
        "ok" to `ok`,
        "result" to `result`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeReplyV1True {
            ContractValidator.validate("BridgeReplyV1True", value)
            val fields = wireObject(value)
            return BridgeReplyV1True(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `result` = BridgeReplyV1TrueResult.fromWire(fields["result"])
            )
        }
    }
}

data class BridgeReplyV1TrueResult(
    val `state`: BridgeReplyV1TrueResultState,
    val `safe_handle`: String?
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeReplyV1TrueResult", linkedMapOf(
        "state" to `state`,
        "safe_handle" to `safe_handle`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeReplyV1TrueResult {
            ContractValidator.validate("BridgeReplyV1TrueResult", value)
            val fields = wireObject(value)
            return BridgeReplyV1TrueResult(
                `state` = BridgeReplyV1TrueResultState.fromWire(fields["state"]),
                `safe_handle` = if (fields["safe_handle"] == null) null else fields["safe_handle"] as String
            )
        }
    }
}

enum class BridgeReplyV1TrueResultState(val wireValue: String) : WireValue {
    VALUE_SYSTEM_PENDING("system_pending"),
    VALUE_STOPPED("stopped"),
    VALUE_UNSUPPORTED("unsupported"),
    VALUE_READY("ready");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): BridgeReplyV1TrueResultState {
            ContractValidator.validate("BridgeReplyV1TrueResultState", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class BridgeReplyV1False(
    val `request_id`: String,
    val `generation`: Long,
    val `error`: BridgeReplyV1FalseError
) : WireObject, BridgeReplyV1 {
    val `ok`: Boolean get() = false
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeReplyV1False", linkedMapOf(
        "request_id" to `request_id`,
        "generation" to `generation`,
        "ok" to `ok`,
        "error" to `error`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeReplyV1False {
            ContractValidator.validate("BridgeReplyV1False", value)
            val fields = wireObject(value)
            return BridgeReplyV1False(
                `request_id` = fields["request_id"] as String,
                `generation` = (fields["generation"] as Number).toLong(),
                `error` = BridgeReplyV1FalseError.fromWire(fields["error"])
            )
        }
    }
}

data class BridgeReplyV1FalseError(
    val `code`: BridgeReplyV1FalseErrorCode,
    val `message`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("BridgeReplyV1FalseError", linkedMapOf(
        "code" to `code`,
        "message" to `message`
    ))
    companion object {
        fun fromWire(value: Any?): BridgeReplyV1FalseError {
            ContractValidator.validate("BridgeReplyV1FalseError", value)
            val fields = wireObject(value)
            return BridgeReplyV1FalseError(
                `code` = BridgeReplyV1FalseErrorCode.fromWire(fields["code"]),
                `message` = fields["message"] as String
            )
        }
    }
}

enum class BridgeReplyV1FalseErrorCode(val wireValue: String) : WireValue {
    VALUE_PERMISSION_DENIED("PERMISSION_DENIED"),
    VALUE_CANCELLED("CANCELLED"),
    VALUE_TARGET_STALE("TARGET_STALE"),
    VALUE_PROVIDER_UNAVAILABLE("PROVIDER_UNAVAILABLE");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): BridgeReplyV1FalseErrorCode {
            ContractValidator.validate("BridgeReplyV1FalseErrorCode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

enum class ServiceErrorCode(val wireValue: String) : WireValue {
    VALUE_AUTH_FAILED("AUTH_FAILED"),
    VALUE_AUTH_EXPIRED("AUTH_EXPIRED"),
    VALUE_SCOPE_DENIED("SCOPE_DENIED"),
    VALUE_CONSENT_REQUIRED("CONSENT_REQUIRED"),
    VALUE_PERMISSION_DENIED("PERMISSION_DENIED"),
    VALUE_RISK_PAUSED("RISK_PAUSED"),
    VALUE_TARGET_STALE("TARGET_STALE"),
    VALUE_LOW_CONFIDENCE("LOW_CONFIDENCE"),
    VALUE_NEED_TIME_CONFIRMATION("NEED_TIME_CONFIRMATION"),
    VALUE_VERSION_CONFLICT("VERSION_CONFLICT"),
    VALUE_RATE_LIMITED("RATE_LIMITED"),
    VALUE_PROVIDER_UNAVAILABLE("PROVIDER_UNAVAILABLE"),
    VALUE_CANCELLED("CANCELLED"),
    VALUE_TIMEOUT("TIMEOUT"),
    VALUE_NETWORK_OFFLINE("NETWORK_OFFLINE"),
    VALUE_STREAM_INTERRUPTED("STREAM_INTERRUPTED"),
    VALUE_INVALID_REQUEST("INVALID_REQUEST"),
    VALUE_PARTIAL_FAILURE("PARTIAL_FAILURE"),
    VALUE_INVITE_EXPIRED("INVITE_EXPIRED"),
    VALUE_GUIDANCE_AUTH_REQUIRED("GUIDANCE_AUTH_REQUIRED"),
    VALUE_GUIDANCE_INVALID_REQUEST("GUIDANCE_INVALID_REQUEST"),
    VALUE_GUIDANCE_UNSAFE_REQUEST("GUIDANCE_UNSAFE_REQUEST"),
    VALUE_GUIDANCE_UNAVAILABLE("GUIDANCE_UNAVAILABLE"),
    VALUE_GUIDANCE_PROVIDER_FAILURE("GUIDANCE_PROVIDER_FAILURE"),
    VALUE_GUIDANCE_INVALID_PROVIDER_RESPONSE("GUIDANCE_INVALID_PROVIDER_RESPONSE"),
    VALUE_GUIDANCE_UNSAFE_PROVIDER_RESPONSE("GUIDANCE_UNSAFE_PROVIDER_RESPONSE"),
    VALUE_GUIDANCE_ABORTED("GUIDANCE_ABORTED"),
    VALUE_GUIDANCE_TIMEOUT("GUIDANCE_TIMEOUT");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ServiceErrorCode {
            ContractValidator.validate("ServiceErrorCode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ErrorEnvelope(
    val `error`: ErrorEnvelopeError,
    val `request_id`: String
) : WireObject {
    val `schema_version`: String get() = "0.2.0"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ErrorEnvelope", linkedMapOf(
        "error" to `error`,
        "request_id" to `request_id`,
        "schema_version" to `schema_version`
    ))
    companion object {
        fun fromWire(value: Any?): ErrorEnvelope {
            ContractValidator.validate("ErrorEnvelope", value)
            val fields = wireObject(value)
            return ErrorEnvelope(
                `error` = ErrorEnvelopeError.fromWire(fields["error"]),
                `request_id` = fields["request_id"] as String
            )
        }
    }
}

data class ErrorEnvelopeError(
    val `code`: ErrorEnvelopeErrorCode,
    val `message`: String,
    val `retryable`: Boolean,
    val `details`: OptionalField<ErrorEnvelopeErrorDetails> = OptionalField.Absent
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ErrorEnvelopeError", linkedMapOf(
        "code" to `code`,
        "message" to `message`,
        "retryable" to `retryable`,
        "details" to `details`
    ))
    companion object {
        fun fromWire(value: Any?): ErrorEnvelopeError {
            ContractValidator.validate("ErrorEnvelopeError", value)
            val fields = wireObject(value)
            return ErrorEnvelopeError(
                `code` = ErrorEnvelopeErrorCode.fromWire(fields["code"]),
                `message` = fields["message"] as String,
                `retryable` = fields["retryable"] as Boolean,
                `details` = if (fields.containsKey("details")) OptionalField.Present(ErrorEnvelopeErrorDetails.fromWire(fields["details"])) else OptionalField.Absent
            )
        }
    }
}

enum class ErrorEnvelopeErrorCode(val wireValue: String) : WireValue {
    VALUE_AUTH_FAILED("AUTH_FAILED"),
    VALUE_AUTH_EXPIRED("AUTH_EXPIRED"),
    VALUE_SCOPE_DENIED("SCOPE_DENIED"),
    VALUE_CONSENT_REQUIRED("CONSENT_REQUIRED"),
    VALUE_PERMISSION_DENIED("PERMISSION_DENIED"),
    VALUE_RISK_PAUSED("RISK_PAUSED"),
    VALUE_TARGET_STALE("TARGET_STALE"),
    VALUE_LOW_CONFIDENCE("LOW_CONFIDENCE"),
    VALUE_NEED_TIME_CONFIRMATION("NEED_TIME_CONFIRMATION"),
    VALUE_VERSION_CONFLICT("VERSION_CONFLICT"),
    VALUE_RATE_LIMITED("RATE_LIMITED"),
    VALUE_PROVIDER_UNAVAILABLE("PROVIDER_UNAVAILABLE"),
    VALUE_CANCELLED("CANCELLED"),
    VALUE_TIMEOUT("TIMEOUT"),
    VALUE_NETWORK_OFFLINE("NETWORK_OFFLINE"),
    VALUE_STREAM_INTERRUPTED("STREAM_INTERRUPTED"),
    VALUE_INVALID_REQUEST("INVALID_REQUEST"),
    VALUE_PARTIAL_FAILURE("PARTIAL_FAILURE"),
    VALUE_INVITE_EXPIRED("INVITE_EXPIRED"),
    VALUE_GUIDANCE_AUTH_REQUIRED("GUIDANCE_AUTH_REQUIRED"),
    VALUE_GUIDANCE_INVALID_REQUEST("GUIDANCE_INVALID_REQUEST"),
    VALUE_GUIDANCE_UNSAFE_REQUEST("GUIDANCE_UNSAFE_REQUEST"),
    VALUE_GUIDANCE_UNAVAILABLE("GUIDANCE_UNAVAILABLE"),
    VALUE_GUIDANCE_PROVIDER_FAILURE("GUIDANCE_PROVIDER_FAILURE"),
    VALUE_GUIDANCE_INVALID_PROVIDER_RESPONSE("GUIDANCE_INVALID_PROVIDER_RESPONSE"),
    VALUE_GUIDANCE_UNSAFE_PROVIDER_RESPONSE("GUIDANCE_UNSAFE_PROVIDER_RESPONSE"),
    VALUE_GUIDANCE_ABORTED("GUIDANCE_ABORTED"),
    VALUE_GUIDANCE_TIMEOUT("GUIDANCE_TIMEOUT");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): ErrorEnvelopeErrorCode {
            ContractValidator.validate("ErrorEnvelopeErrorCode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class ErrorEnvelopeErrorDetails(
    val `current_version`: Long,
    val `conflict_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("ErrorEnvelopeErrorDetails", linkedMapOf(
        "current_version" to `current_version`,
        "conflict_id" to `conflict_id`
    ))
    companion object {
        fun fromWire(value: Any?): ErrorEnvelopeErrorDetails {
            ContractValidator.validate("ErrorEnvelopeErrorDetails", value)
            val fields = wireObject(value)
            return ErrorEnvelopeErrorDetails(
                `current_version` = (fields["current_version"] as Number).toLong(),
                `conflict_id` = fields["conflict_id"] as String
            )
        }
    }
}

data class StandaloneGuidanceErrorEnvelope(
    val `error`: StandaloneGuidanceErrorEnvelopeError,
    val `request_id`: String
) : WireObject {
    val `schema_version`: String get() = "0.2.0"
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceErrorEnvelope", linkedMapOf(
        "error" to `error`,
        "request_id" to `request_id`,
        "schema_version" to `schema_version`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceErrorEnvelope {
            ContractValidator.validate("StandaloneGuidanceErrorEnvelope", value)
            val fields = wireObject(value)
            return StandaloneGuidanceErrorEnvelope(
                `error` = StandaloneGuidanceErrorEnvelopeError.fromWire(fields["error"]),
                `request_id` = fields["request_id"] as String
            )
        }
    }
}

data class StandaloneGuidanceErrorEnvelopeError(
    val `code`: StandaloneGuidanceErrorEnvelopeErrorCode,
    val `message`: String,
    val `retryable`: Boolean,
    val `details`: OptionalField<StandaloneGuidanceErrorEnvelopeErrorDetails> = OptionalField.Absent
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceErrorEnvelopeError", linkedMapOf(
        "code" to `code`,
        "message" to `message`,
        "retryable" to `retryable`,
        "details" to `details`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceErrorEnvelopeError {
            ContractValidator.validate("StandaloneGuidanceErrorEnvelopeError", value)
            val fields = wireObject(value)
            return StandaloneGuidanceErrorEnvelopeError(
                `code` = StandaloneGuidanceErrorEnvelopeErrorCode.fromWire(fields["code"]),
                `message` = fields["message"] as String,
                `retryable` = fields["retryable"] as Boolean,
                `details` = if (fields.containsKey("details")) OptionalField.Present(StandaloneGuidanceErrorEnvelopeErrorDetails.fromWire(fields["details"])) else OptionalField.Absent
            )
        }
    }
}

enum class StandaloneGuidanceErrorEnvelopeErrorCode(val wireValue: String) : WireValue {
    VALUE_AUTH_FAILED("AUTH_FAILED"),
    VALUE_AUTH_EXPIRED("AUTH_EXPIRED"),
    VALUE_SCOPE_DENIED("SCOPE_DENIED"),
    VALUE_CONSENT_REQUIRED("CONSENT_REQUIRED"),
    VALUE_PERMISSION_DENIED("PERMISSION_DENIED"),
    VALUE_RISK_PAUSED("RISK_PAUSED"),
    VALUE_TARGET_STALE("TARGET_STALE"),
    VALUE_LOW_CONFIDENCE("LOW_CONFIDENCE"),
    VALUE_NEED_TIME_CONFIRMATION("NEED_TIME_CONFIRMATION"),
    VALUE_VERSION_CONFLICT("VERSION_CONFLICT"),
    VALUE_RATE_LIMITED("RATE_LIMITED"),
    VALUE_PROVIDER_UNAVAILABLE("PROVIDER_UNAVAILABLE"),
    VALUE_CANCELLED("CANCELLED"),
    VALUE_TIMEOUT("TIMEOUT"),
    VALUE_NETWORK_OFFLINE("NETWORK_OFFLINE"),
    VALUE_STREAM_INTERRUPTED("STREAM_INTERRUPTED"),
    VALUE_INVALID_REQUEST("INVALID_REQUEST"),
    VALUE_PARTIAL_FAILURE("PARTIAL_FAILURE"),
    VALUE_INVITE_EXPIRED("INVITE_EXPIRED"),
    VALUE_GUIDANCE_AUTH_REQUIRED("GUIDANCE_AUTH_REQUIRED"),
    VALUE_GUIDANCE_INVALID_REQUEST("GUIDANCE_INVALID_REQUEST"),
    VALUE_GUIDANCE_UNSAFE_REQUEST("GUIDANCE_UNSAFE_REQUEST"),
    VALUE_GUIDANCE_UNAVAILABLE("GUIDANCE_UNAVAILABLE"),
    VALUE_GUIDANCE_PROVIDER_FAILURE("GUIDANCE_PROVIDER_FAILURE"),
    VALUE_GUIDANCE_INVALID_PROVIDER_RESPONSE("GUIDANCE_INVALID_PROVIDER_RESPONSE"),
    VALUE_GUIDANCE_UNSAFE_PROVIDER_RESPONSE("GUIDANCE_UNSAFE_PROVIDER_RESPONSE"),
    VALUE_GUIDANCE_ABORTED("GUIDANCE_ABORTED"),
    VALUE_GUIDANCE_TIMEOUT("GUIDANCE_TIMEOUT");
    override fun toWire(): String = wireValue
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceErrorEnvelopeErrorCode {
            ContractValidator.validate("StandaloneGuidanceErrorEnvelopeErrorCode", value)
            return entries.first { it.wireValue == value }
        }
    }
}

data class StandaloneGuidanceErrorEnvelopeErrorDetails(
    val `current_version`: Long,
    val `conflict_id`: String
) : WireObject {
    init { toWire() }
    override fun toWire(): Map<String, Any?> = wireBuild("StandaloneGuidanceErrorEnvelopeErrorDetails", linkedMapOf(
        "current_version" to `current_version`,
        "conflict_id" to `conflict_id`
    ))
    companion object {
        fun fromWire(value: Any?): StandaloneGuidanceErrorEnvelopeErrorDetails {
            ContractValidator.validate("StandaloneGuidanceErrorEnvelopeErrorDetails", value)
            val fields = wireObject(value)
            return StandaloneGuidanceErrorEnvelopeErrorDetails(
                `current_version` = (fields["current_version"] as Number).toLong(),
                `conflict_id` = fields["conflict_id"] as String
            )
        }
    }
}

object GeneratedContractDtos {
    const val schemaVersion: String = "0.2.0"
    val definitionNames: Set<String> = setOf("Empty", "Mode", "Scope", "AppearanceDto", "VoiceDto", "PreferencesDto", "UserDto", "DeviceDto", "SessionDto", "SessionResponse", "CarrierExchangeRequest", "SubjectProfile", "ClaimRequest", "ClaimResponse", "ClaimConfirmRequest", "ClaimConfirmResponse", "BindingChallengeRequest", "DeviceChallengeResponse", "DeviceExchangeRequest", "FaceChallengeResponse", "FaceExchangeRequest", "RefreshRequest", "RevokedResponse", "MeResponse", "PreferencesRequest", "PreferencesResponse", "RelationInvitationRequest", "RelationInvitationResponse", "RelationAcceptRequest", "RelationDto", "RelationResponse", "RelationPage", "GrantsRequest", "GrantsResponse", "RelationRevokedResponse", "ConsentRequest", "ConsentResponse", "ConsentWithdrawResponse", "ConversationCreateRequest", "ConversationCreateResponse", "ConversationMessageDto", "ConversationMessagePage", "ResponseRequest", "ResponseAccepted", "CancelledResponse", "UploadRequest", "UploadResponse", "MediaCommitRequest", "MediaCommitResponse", "FrameContextDto", "LocalFeaturesDto", "GuidanceCreateRequest", "GuidanceCreateResponse", "GuidanceAnalyzeRequest", "RequestAccepted", "GuidanceVerifyRequest", "GuidanceVerifyResponse", "EndedResponse", "NoteDto", "NoteCreateRequest", "NoteResponse", "NotePage", "NoteUpdateRequest", "NoteDeletedResponse", "ReviewRequest", "ReviewResponse", "RepeatRule", "TodoDto", "TodoCreateRequest", "TodoPatch", "TodoUpdateRequest", "TodoResponse", "TodoPage", "TodoCancelledResponse", "OccurrenceCompleteResponse", "ReceiptRequest", "AcceptedResponse", "PetJobRequest", "PetJobCreated", "AssetDto", "PetJobDto", "PetJobCancelled", "PetDto", "PetCurrentRequest", "PetCurrentResponse", "ManifestDto", "SyncMutationDto", "SyncRequest", "ConflictDto", "SyncResult", "SyncResponse", "SyncChange", "SyncChangesResponse", "AssistRequest", "AssistCreated", "AssistStateResponse", "AssistJoinRequest", "AssistJoinResponse", "AssistEndRequest", "AssistEndedResponse", "SafetyVersions", "SafetyEventRequest", "SafetyEventResponse", "MetricEvent", "MetricsRequest", "MetricsResponse", "ProvisioningRequest", "ProvisioningResponse", "VoiceTicketRequest", "VoiceTicketResponse", "StandaloneGuidanceRect", "StandaloneGuidanceElement", "StandaloneGuidanceImage", "StandaloneGuidancePreviousStep", "StandaloneGuidanceClarificationReply", "StandaloneGuidanceReviewProposal", "StandaloneGuidanceAnalyzeRequest", "StandaloneGuidanceResult", "StandaloneGuidanceErrorCode", "NormalizedRect", "ServiceStreamEvent", "AssistSignal", "VoiceFrameHeader", "BridgeRequestV1", "BridgeReplyV1", "ServiceErrorCode", "ErrorEnvelope", "StandaloneGuidanceErrorEnvelope")
    fun decode(name: String, value: Any?): WireValue = when (name) {
        "Empty" -> Empty.fromWire(value)
        "Mode" -> Mode.fromWire(value)
        "Scope" -> Scope.fromWire(value)
        "AppearanceDto" -> AppearanceDto.fromWire(value)
        "VoiceDto" -> VoiceDto.fromWire(value)
        "PreferencesDto" -> PreferencesDto.fromWire(value)
        "UserDto" -> UserDto.fromWire(value)
        "DeviceDto" -> DeviceDto.fromWire(value)
        "SessionDto" -> SessionDto.fromWire(value)
        "SessionResponse" -> SessionResponse.fromWire(value)
        "CarrierExchangeRequest" -> CarrierExchangeRequest.fromWire(value)
        "SubjectProfile" -> SubjectProfile.fromWire(value)
        "ClaimRequest" -> ClaimRequest.fromWire(value)
        "ClaimResponse" -> ClaimResponse.fromWire(value)
        "ClaimConfirmRequest" -> ClaimConfirmRequest.fromWire(value)
        "ClaimConfirmResponse" -> ClaimConfirmResponse.fromWire(value)
        "BindingChallengeRequest" -> BindingChallengeRequest.fromWire(value)
        "DeviceChallengeResponse" -> DeviceChallengeResponse.fromWire(value)
        "DeviceExchangeRequest" -> DeviceExchangeRequest.fromWire(value)
        "FaceChallengeResponse" -> FaceChallengeResponse.fromWire(value)
        "FaceExchangeRequest" -> FaceExchangeRequest.fromWire(value)
        "RefreshRequest" -> RefreshRequest.fromWire(value)
        "RevokedResponse" -> RevokedResponse.fromWire(value)
        "MeResponse" -> MeResponse.fromWire(value)
        "PreferencesRequest" -> PreferencesRequest.fromWire(value)
        "PreferencesResponse" -> PreferencesResponse.fromWire(value)
        "RelationInvitationRequest" -> RelationInvitationRequest.fromWire(value)
        "RelationInvitationResponse" -> RelationInvitationResponse.fromWire(value)
        "RelationAcceptRequest" -> RelationAcceptRequest.fromWire(value)
        "RelationDto" -> RelationDto.fromWire(value)
        "RelationResponse" -> RelationResponse.fromWire(value)
        "RelationPage" -> RelationPage.fromWire(value)
        "GrantsRequest" -> GrantsRequest.fromWire(value)
        "GrantsResponse" -> GrantsResponse.fromWire(value)
        "RelationRevokedResponse" -> RelationRevokedResponse.fromWire(value)
        "ConsentRequest" -> ConsentRequest.fromWire(value)
        "ConsentResponse" -> ConsentResponse.fromWire(value)
        "ConsentWithdrawResponse" -> ConsentWithdrawResponse.fromWire(value)
        "ConversationCreateRequest" -> ConversationCreateRequest.fromWire(value)
        "ConversationCreateResponse" -> ConversationCreateResponse.fromWire(value)
        "ConversationMessageDto" -> ConversationMessageDto.fromWire(value)
        "ConversationMessagePage" -> ConversationMessagePage.fromWire(value)
        "ResponseRequest" -> ResponseRequest.fromWire(value)
        "ResponseAccepted" -> ResponseAccepted.fromWire(value)
        "CancelledResponse" -> CancelledResponse.fromWire(value)
        "UploadRequest" -> UploadRequest.fromWire(value)
        "UploadResponse" -> UploadResponse.fromWire(value)
        "MediaCommitRequest" -> MediaCommitRequest.fromWire(value)
        "MediaCommitResponse" -> MediaCommitResponse.fromWire(value)
        "FrameContextDto" -> FrameContextDto.fromWire(value)
        "LocalFeaturesDto" -> LocalFeaturesDto.fromWire(value)
        "GuidanceCreateRequest" -> GuidanceCreateRequest.fromWire(value)
        "GuidanceCreateResponse" -> GuidanceCreateResponse.fromWire(value)
        "GuidanceAnalyzeRequest" -> GuidanceAnalyzeRequest.fromWire(value)
        "RequestAccepted" -> RequestAccepted.fromWire(value)
        "GuidanceVerifyRequest" -> GuidanceVerifyRequest.fromWire(value)
        "GuidanceVerifyResponse" -> GuidanceVerifyResponse.fromWire(value)
        "EndedResponse" -> EndedResponse.fromWire(value)
        "NoteDto" -> NoteDto.fromWire(value)
        "NoteCreateRequest" -> NoteCreateRequest.fromWire(value)
        "NoteResponse" -> NoteResponse.fromWire(value)
        "NotePage" -> NotePage.fromWire(value)
        "NoteUpdateRequest" -> NoteUpdateRequest.fromWire(value)
        "NoteDeletedResponse" -> NoteDeletedResponse.fromWire(value)
        "ReviewRequest" -> ReviewRequest.fromWire(value)
        "ReviewResponse" -> ReviewResponse.fromWire(value)
        "RepeatRule" -> RepeatRule.fromWire(value)
        "TodoDto" -> TodoDto.fromWire(value)
        "TodoCreateRequest" -> TodoCreateRequest.fromWire(value)
        "TodoPatch" -> TodoPatch.fromWire(value)
        "TodoUpdateRequest" -> TodoUpdateRequest.fromWire(value)
        "TodoResponse" -> TodoResponse.fromWire(value)
        "TodoPage" -> TodoPage.fromWire(value)
        "TodoCancelledResponse" -> TodoCancelledResponse.fromWire(value)
        "OccurrenceCompleteResponse" -> OccurrenceCompleteResponse.fromWire(value)
        "ReceiptRequest" -> ReceiptRequest.fromWire(value)
        "AcceptedResponse" -> AcceptedResponse.fromWire(value)
        "PetJobRequest" -> PetJobRequest.fromWire(value)
        "PetJobCreated" -> PetJobCreated.fromWire(value)
        "AssetDto" -> AssetDto.fromWire(value)
        "PetJobDto" -> PetJobDto.fromWire(value)
        "PetJobCancelled" -> PetJobCancelled.fromWire(value)
        "PetDto" -> PetDto.fromWire(value)
        "PetCurrentRequest" -> PetCurrentRequest.fromWire(value)
        "PetCurrentResponse" -> PetCurrentResponse.fromWire(value)
        "ManifestDto" -> ManifestDto.fromWire(value)
        "SyncMutationDto" -> SyncMutationDto.fromWire(value)
        "SyncRequest" -> SyncRequest.fromWire(value)
        "ConflictDto" -> ConflictDto.fromWire(value)
        "SyncResult" -> SyncResult.fromWire(value)
        "SyncResponse" -> SyncResponse.fromWire(value)
        "SyncChange" -> SyncChange.fromWire(value)
        "SyncChangesResponse" -> SyncChangesResponse.fromWire(value)
        "AssistRequest" -> AssistRequest.fromWire(value)
        "AssistCreated" -> AssistCreated.fromWire(value)
        "AssistStateResponse" -> AssistStateResponse.fromWire(value)
        "AssistJoinRequest" -> AssistJoinRequest.fromWire(value)
        "AssistJoinResponse" -> AssistJoinResponse.fromWire(value)
        "AssistEndRequest" -> AssistEndRequest.fromWire(value)
        "AssistEndedResponse" -> AssistEndedResponse.fromWire(value)
        "SafetyVersions" -> SafetyVersions.fromWire(value)
        "SafetyEventRequest" -> SafetyEventRequest.fromWire(value)
        "SafetyEventResponse" -> SafetyEventResponse.fromWire(value)
        "MetricEvent" -> MetricEvent.fromWire(value)
        "MetricsRequest" -> MetricsRequest.fromWire(value)
        "MetricsResponse" -> MetricsResponse.fromWire(value)
        "ProvisioningRequest" -> ProvisioningRequest.fromWire(value)
        "ProvisioningResponse" -> ProvisioningResponse.fromWire(value)
        "VoiceTicketRequest" -> VoiceTicketRequest.fromWire(value)
        "VoiceTicketResponse" -> VoiceTicketResponse.fromWire(value)
        "StandaloneGuidanceRect" -> StandaloneGuidanceRect.fromWire(value)
        "StandaloneGuidanceElement" -> StandaloneGuidanceElement.fromWire(value)
        "StandaloneGuidanceImage" -> StandaloneGuidanceImage.fromWire(value)
        "StandaloneGuidancePreviousStep" -> StandaloneGuidancePreviousStep.fromWire(value)
        "StandaloneGuidanceClarificationReply" -> StandaloneGuidanceClarificationReply.fromWire(value)
        "StandaloneGuidanceReviewProposal" -> StandaloneGuidanceReviewProposal.fromWire(value)
        "StandaloneGuidanceAnalyzeRequest" -> StandaloneGuidanceAnalyzeRequest.fromWire(value)
        "StandaloneGuidanceResult" -> StandaloneGuidanceResult.fromWire(value)
        "StandaloneGuidanceErrorCode" -> StandaloneGuidanceErrorCode.fromWire(value)
        "NormalizedRect" -> NormalizedRect.fromWire(value)
        "ServiceStreamEvent" -> ServiceStreamEvent.fromWire(value)
        "AssistSignal" -> AssistSignal.fromWire(value)
        "VoiceFrameHeader" -> VoiceFrameHeader.fromWire(value)
        "BridgeRequestV1" -> BridgeRequestV1.fromWire(value)
        "BridgeReplyV1" -> BridgeReplyV1.fromWire(value)
        "ServiceErrorCode" -> ServiceErrorCode.fromWire(value)
        "ErrorEnvelope" -> ErrorEnvelope.fromWire(value)
        "StandaloneGuidanceErrorEnvelope" -> StandaloneGuidanceErrorEnvelope.fromWire(value)
        else -> throw ContractViolation("contract", "unknown definition")
    }
}
