package org.nuanban.contracts

internal object GeneratedContractRules {
    val definitions: Map<String, ContractRule> by lazy { linkedMapOf(
        "Empty" to rule0(),
        "Mode" to rule1(),
        "Scope" to rule2(),
        "AppearanceDto" to rule3(),
        "AppearanceDtoEyes" to rule4(),
        "AppearanceDtoMouth" to rule5(),
        "AppearanceDtoAction" to rule7(),
        "VoiceDto" to rule8(),
        "PreferencesDto" to rule11(),
        "PreferencesDtoMode" to rule1(),
        "PreferencesDtoVoice" to rule8(),
        "PreferencesDtoAppearance" to rule3(),
        "PreferencesDtoAppearanceEyes" to rule4(),
        "PreferencesDtoAppearanceMouth" to rule5(),
        "PreferencesDtoAppearanceAction" to rule7(),
        "UserDto" to rule14(),
        "UserDtoMode" to rule1(),
        "DeviceDto" to rule19(),
        "DeviceDtoPlatform" to rule20(),
        "DeviceDtoStatus" to rule21(),
        "SessionDto" to rule25(),
        "SessionResponse" to rule29(),
        "CarrierExchangeRequest" to rule31(),
        "SubjectProfile" to rule34(),
        "SubjectProfileMode" to rule1(),
        "ClaimRequest" to rule38(),
        "ClaimRequestMethod" to rule39(),
        "ClaimResponse" to rule41(),
        "ClaimConfirmRequest" to rule43(),
        "ClaimConfirmResponse" to rule45(),
        "ClaimConfirmResponseStatus" to rule46(),
        "BindingChallengeRequest" to rule47(),
        "DeviceChallengeResponse" to rule48(),
        "DeviceExchangeRequest" to rule50(),
        "FaceChallengeResponse" to rule52(),
        "FaceChallengeResponseCapturePolicy" to rule53(),
        "FaceExchangeRequest" to rule56(),
        "RefreshRequest" to rule57(),
        "RevokedResponse" to rule59(),
        "MeResponse" to rule61(),
        "PreferencesRequest" to rule65(),
        "PreferencesRequestMode" to rule1(),
        "PreferencesResponse" to rule67(),
        "RelationInvitationRequest" to rule70(),
        "RelationInvitationRequestRequestedScopesItem" to rule2(),
        "RelationInvitationResponse" to rule72(),
        "RelationAcceptRequest" to rule73(),
        "RelationAcceptRequestScopesItem" to rule2(),
        "RelationDto" to rule75(),
        "RelationDtoScopesItem" to rule2(),
        "RelationDtoStatus" to rule78(),
        "RelationResponse" to rule83(),
        "RelationPage" to rule85(),
        "GrantsRequest" to rule91(),
        "GrantsRequestScopesItem" to rule2(),
        "GrantsResponse" to rule93(),
        "RelationRevokedResponse" to rule95(),
        "ConsentRequest" to rule96(),
        "ConsentRequestPurpose" to rule97(),
        "ConsentRequestScopesItem" to rule2(),
        "ConsentResponse" to rule100(),
        "ConsentWithdrawResponse" to rule101(),
        "ConversationCreateRequest" to rule102(),
        "ConversationCreateRequestMode" to rule1(),
        "ConversationCreateResponse" to rule103(),
        "ConversationMessageDto" to rule104(),
        "ConversationMessageDtoRole" to rule105(),
        "ConversationMessageDtoState" to rule107(),
        "ConversationMessagePage" to rule108(),
        "ResponseRequest" to rule114(),
        "ResponseAccepted" to rule122(),
        "CancelledResponse" to rule124(),
        "UploadRequest" to rule126(),
        "UploadRequestPurpose" to rule127(),
        "UploadRequestMime" to rule128(),
        "UploadResponse" to rule132(),
        "MediaCommitRequest" to rule133(),
        "MediaCommitResponse" to rule134(),
        "FrameContextDto" to rule135(),
        "LocalFeaturesDto" to rule139(),
        "LocalFeaturesDtoScene" to rule140(),
        "GuidanceCreateRequest" to rule144(),
        "GuidanceCreateResponse" to rule146(),
        "GuidanceAnalyzeRequest" to rule147(),
        "RequestAccepted" to rule150(),
        "GuidanceVerifyRequest" to rule151(),
        "GuidanceVerifyResponse" to rule154(),
        "GuidanceVerifyResponseResult" to rule155(),
        "GuidanceVerifyResponseNextState" to rule156(),
        "EndedResponse" to rule157(),
        "NoteDto" to rule159(),
        "NoteDtoMastery" to rule163(),
        "NoteDtoMasterySource" to rule165(),
        "NoteDtoSource" to rule169(),
        "NoteCreateRequest" to rule172(),
        "NoteResponse" to rule178(),
        "NotePage" to rule181(),
        "NoteUpdateRequest" to rule187(),
        "NoteUpdateRequestMastery" to rule189(),
        "NoteUpdateRequestMasterySource" to rule190(),
        "NoteDeletedResponse" to rule191(),
        "ReviewRequest" to rule192(),
        "ReviewRequestResult" to rule193(),
        "ReviewRequestEvidenceKind" to rule196(),
        "ReviewResponse" to rule197(),
        "RepeatRule" to rule198(),
        "RepeatRuleFrequency" to rule199(),
        "TodoDto" to rule201(),
        "TodoDtoStatus" to rule207(),
        "TodoDtoSource" to rule210(),
        "TodoCreateRequest" to rule213(),
        "TodoPatch" to rule219(),
        "TodoUpdateRequest" to rule225(),
        "TodoResponse" to rule227(),
        "TodoPage" to rule230(),
        "TodoCancelledResponse" to rule236(),
        "OccurrenceCompleteResponse" to rule238(),
        "ReceiptRequest" to rule242(),
        "ReceiptRequestChannel" to rule243(),
        "ReceiptRequestState" to rule244(),
        "AcceptedResponse" to rule245(),
        "PetJobRequest" to rule247(),
        "PetJobRequestAppearance" to rule3(),
        "PetJobRequestAppearanceEyes" to rule4(),
        "PetJobRequestAppearanceMouth" to rule5(),
        "PetJobRequestAppearanceAction" to rule7(),
        "PetJobCreated" to rule249(),
        "AssetDto" to rule251(),
        "AssetDtoKind" to rule252(),
        "PetJobDto" to rule254(),
        "PetJobDtoStatus" to rule255(),
        "PetJobDtoError" to rule261(),
        "PetJobDtoErrorCode" to rule262(),
        "PetJobCancelled" to rule265(),
        "PetDto" to rule267(),
        "PetDtoAppearance" to rule3(),
        "PetDtoAppearanceEyes" to rule4(),
        "PetDtoAppearanceMouth" to rule5(),
        "PetDtoAppearanceAction" to rule7(),
        "PetDtoVoice" to rule8(),
        "PetCurrentRequest" to rule269(),
        "PetCurrentRequestAppearance" to rule3(),
        "PetCurrentRequestAppearanceEyes" to rule4(),
        "PetCurrentRequestAppearanceMouth" to rule5(),
        "PetCurrentRequestAppearanceAction" to rule7(),
        "PetCurrentRequestVoice" to rule8(),
        "PetCurrentResponse" to rule271(),
        "PetCurrentResponseAvailability" to rule273(),
        "ManifestDto" to rule274(),
        "SyncMutationDto" to rule278(),
        "SyncMutationDtoNoteCreate" to rule279(),
        "SyncMutationDtoNoteUpdate" to rule284(),
        "SyncMutationDtoNoteDelete" to rule289(),
        "SyncMutationDtoNoteDeletePatch" to rule293(),
        "SyncMutationDtoTodoCreate" to rule294(),
        "SyncMutationDtoTodoUpdate" to rule299(),
        "SyncMutationDtoTodoDelete" to rule304(),
        "SyncMutationDtoTodoDeletePatch" to rule308(),
        "SyncRequest" to rule309(),
        "ConflictDto" to rule312(),
        "ConflictDtoEntityType" to rule313(),
        "ConflictDtoCurrent" to rule316(),
        "ConflictDtoCurrentVariant1" to rule317(),
        "ConflictDtoCurrentVariant2" to rule318(),
        "ConflictDtoReason" to rule319(),
        "SyncResult" to rule320(),
        "SyncResultStatus" to rule321(),
        "SyncResultErrorCode" to rule329(),
        "SyncResponse" to rule331(),
        "SyncChange" to rule334(),
        "SyncChangeEntityType" to rule335(),
        "SyncChangeOperation" to rule337(),
        "SyncChangeEntity" to rule339(),
        "SyncChangeEntityVariant1" to rule340(),
        "SyncChangeEntityVariant2" to rule341(),
        "SyncChangesResponse" to rule343(),
        "AssistRequest" to rule349(),
        "AssistRequestRequestedMediaItem" to rule351(),
        "AssistCreated" to rule352(),
        "AssistStateResponse" to rule353(),
        "AssistStateResponseState" to rule354(),
        "AssistJoinRequest" to rule355(),
        "AssistJoinResponse" to rule357(),
        "AssistJoinResponseTurnCredentials" to rule359(),
        "AssistEndRequest" to rule365(),
        "AssistEndRequestReason" to rule366(),
        "AssistEndedResponse" to rule367(),
        "SafetyVersions" to rule369(),
        "SafetyEventRequest" to rule373(),
        "SafetyEventRequestKind" to rule374(),
        "SafetyEventRequestAction" to rule375(),
        "SafetyEventResponse" to rule377(),
        "MetricEvent" to rule378(),
        "MetricEventKind" to rule379(),
        "MetricsRequest" to rule380(),
        "MetricsResponse" to rule383(),
        "ProvisioningRequest" to rule385(),
        "ProvisioningRequestSubjectsItem" to rule387(),
        "ProvisioningResponse" to rule388(),
        "ProvisioningResponseItemResultsItem" to rule390(),
        "ProvisioningResponseItemResultsItemStatus" to rule391(),
        "ProvisioningResponseItemResultsItemReason" to rule395(),
        "VoiceTicketRequest" to rule397(),
        "VoiceTicketResponse" to rule399(),
        "NormalizedRect" to rule402(),
        "ServiceStreamEvent" to rule407(),
        "ServiceStreamEventResponseStarted" to rule408(),
        "ServiceStreamEventResponseStartedPayload" to rule412(),
        "ServiceStreamEventCaptionSegment" to rule413(),
        "ServiceStreamEventCaptionSegmentPayload" to rule415(),
        "ServiceStreamEventResponseCompleted" to rule418(),
        "ServiceStreamEventResponseCompletedPayload" to rule420(),
        "ServiceStreamEventResponseCancelled" to rule422(),
        "ServiceStreamEventResponseCancelledPayload" to rule424(),
        "ServiceStreamEventResponseCancelledPayloadReason" to rule425(),
        "ServiceStreamEventResponseFailed" to rule426(),
        "ServiceStreamEventResponseFailedPayload" to rule428(),
        "ServiceStreamEventResponseFailedPayloadCode" to rule429(),
        "ServiceStreamEventGuidanceStep" to rule430(),
        "ServiceStreamEventGuidanceStepPayload" to rule432(),
        "ServiceStreamEventGuidanceStepPayloadTarget" to rule402(),
        "ServiceStreamEventGuidanceRisk" to rule435(),
        "ServiceStreamEventGuidanceRiskPayload" to rule437(),
        "ServiceStreamEventGuidanceRiskPayloadRisk" to rule438(),
        "ServiceStreamEventGuidanceRiskPayloadAction" to rule439(),
        "ServiceStreamEventGuidanceLowConfidence" to rule440(),
        "ServiceStreamEventGuidanceLowConfidencePayload" to rule442(),
        "ServiceStreamEventGuidanceCompleted" to rule444(),
        "ServiceStreamEventGuidanceCompletedPayload" to rule446(),
        "ServiceStreamEventPetJobProgress" to rule447(),
        "ServiceStreamEventPetJobProgressPayload" to rule449(),
        "ServiceStreamEventPetJobProgressPayloadStatus" to rule450(),
        "ServiceStreamEventPetJobSucceeded" to rule452(),
        "ServiceStreamEventPetJobSucceededPayload" to rule454(),
        "ServiceStreamEventPetJobFailed" to rule457(),
        "ServiceStreamEventPetJobFailedPayload" to rule459(),
        "ServiceStreamEventPetJobFailedPayloadCode" to rule460(),
        "AssistSignal" to rule461(),
        "AssistSignalInvite" to rule462(),
        "AssistSignalInvitePayload" to rule464(),
        "AssistSignalAccept" to rule466(),
        "AssistSignalAcceptPayload" to rule468(),
        "AssistSignalOffer" to rule470(),
        "AssistSignalOfferPayload" to rule472(),
        "AssistSignalAnswer" to rule475(),
        "AssistSignalAnswerPayload" to rule477(),
        "AssistSignalIce" to rule480(),
        "AssistSignalIcePayload" to rule482(),
        "AssistSignalRiskPause" to rule485(),
        "AssistSignalRiskPausePayload" to rule487(),
        "AssistSignalRiskPausePayloadReason" to rule490(),
        "AssistSignalConsentRevoked" to rule491(),
        "AssistSignalConsentRevokedPayload" to rule493(),
        "AssistSignalEnd" to rule495(),
        "AssistSignalEndPayload" to rule497(),
        "AssistSignalEndPayloadReason" to rule498(),
        "VoiceFrameHeader" to rule499(),
        "VoiceFrameHeaderCodec" to rule502(),
        "BridgeRequestV1" to rule505(),
        "BridgeRequestV1CapabilitiesGet" to rule506(),
        "BridgeRequestV1CapabilitiesGetParams" to rule510(),
        "BridgeRequestV1PermissionsRequest" to rule511(),
        "BridgeRequestV1PermissionsRequestParams" to rule515(),
        "BridgeRequestV1PermissionsRequestParamsPermission" to rule516(),
        "BridgeRequestV1CaptureStart" to rule518(),
        "BridgeRequestV1CaptureStartParams" to rule522(),
        "BridgeRequestV1CaptureStartParamsPurpose" to rule523(),
        "BridgeRequestV1CaptureStop" to rule524(),
        "BridgeRequestV1CaptureStopParams" to rule528(),
        "BridgeRequestV1CameraStart" to rule529(),
        "BridgeRequestV1CameraStartParams" to rule533(),
        "BridgeRequestV1CameraStop" to rule534(),
        "BridgeRequestV1CameraStopParams" to rule538(),
        "BridgeRequestV1AudioStart" to rule539(),
        "BridgeRequestV1AudioStartParams" to rule543(),
        "BridgeRequestV1AudioStartParamsPurpose" to rule544(),
        "BridgeRequestV1AudioStop" to rule545(),
        "BridgeRequestV1AudioStopParams" to rule549(),
        "BridgeRequestV1OverlayPresent" to rule550(),
        "BridgeRequestV1OverlayPresentParams" to rule554(),
        "BridgeRequestV1OverlayPresentParamsTarget" to rule402(),
        "BridgeRequestV1OverlayClear" to rule556(),
        "BridgeRequestV1OverlayClearParams" to rule560(),
        "BridgeRequestV1NotificationsSchedule" to rule561(),
        "BridgeRequestV1NotificationsScheduleParams" to rule565(),
        "BridgeRequestV1NotificationsCancel" to rule567(),
        "BridgeRequestV1NotificationsCancelParams" to rule571(),
        "BridgeRequestV1StorageNotesRead" to rule572(),
        "BridgeRequestV1StorageNotesReadParams" to rule576(),
        "BridgeRequestV1StorageDrawingRead" to rule577(),
        "BridgeRequestV1StorageDrawingReadParams" to rule581(),
        "BridgeRequestV1AssetsImport" to rule582(),
        "BridgeRequestV1AssetsImportParams" to rule586(),
        "BridgeRequestV1AssetsImportParamsKind" to rule587(),
        "BridgeRequestV1AssetsPreview" to rule588(),
        "BridgeRequestV1AssetsPreviewParams" to rule592(),
        "BridgeReplyV1" to rule593(),
        "BridgeReplyV1True" to rule594(),
        "BridgeReplyV1TrueResult" to rule597(),
        "BridgeReplyV1TrueResultState" to rule598(),
        "BridgeReplyV1False" to rule601(),
        "BridgeReplyV1FalseError" to rule604(),
        "BridgeReplyV1FalseErrorCode" to rule605(),
        "ServiceErrorCode" to rule607(),
        "ErrorEnvelope" to rule608(),
        "ErrorEnvelopeError" to rule609(),
        "ErrorEnvelopeErrorCode" to rule610(),
        "ErrorEnvelopeErrorDetails" to rule613()
    ) }
    private fun rule0(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule1(): ContractRule = ContractRule(kind = "string", choices = listOf("elder", "child", "accessible"))
    private fun rule2(): ContractRule = ContractRule(kind = "string", choices = listOf("learning.read", "learning.mastery.write", "todo.write", "assist.request"))
    private fun rule3(): ContractRule = ContractRule(kind = "object", properties = mapOf("eyes" to rule4(), "mouth" to rule5(), "color" to rule6(), "action" to rule7()), required = setOf("eyes", "mouth", "color", "action"), additionalProperties = false)
    private fun rule4(): ContractRule = ContractRule(kind = "string", choices = listOf("round", "happy", "sleepy"))
    private fun rule5(): ContractRule = ContractRule(kind = "string", choices = listOf("smile", "small", "open"))
    private fun rule6(): ContractRule = ContractRule(kind = "string", minLength = 7, maxLength = 7, pattern = "^#[a-fA-F0-9]{6}\$")
    private fun rule7(): ContractRule = ContractRule(kind = "string", choices = listOf("idle", "greeting", "celebrating"))
    private fun rule8(): ContractRule = ContractRule(kind = "object", properties = mapOf("muted" to rule9(), "rate" to rule10()), required = setOf("muted", "rate"), additionalProperties = false)
    private fun rule9(): ContractRule = ContractRule(kind = "boolean")
    private fun rule10(): ContractRule = ContractRule(kind = "number", minimum = 0.5, maximum = 1.5)
    private fun rule11(): ContractRule = ContractRule(kind = "object", properties = mapOf("mode" to rule1(), "font_scale" to rule12(), "caption_size" to rule13(), "reduced_motion" to rule9(), "voice" to rule8(), "appearance" to rule3()), required = setOf("mode", "font_scale", "caption_size", "reduced_motion", "voice", "appearance"), additionalProperties = false)
    private fun rule12(): ContractRule = ContractRule(kind = "number", minimum = 1.0, maximum = 2.0)
    private fun rule13(): ContractRule = ContractRule(kind = "integer", minimum = 24.0, maximum = 64.0)
    private fun rule14(): ContractRule = ContractRule(kind = "object", properties = mapOf("user_id" to rule15(), "mode" to rule1(), "profile_label" to rule16(), "preferences" to rule17(), "version" to rule18()), required = setOf("user_id", "mode", "profile_label", "preferences", "version"), additionalProperties = false)
    private fun rule15(): ContractRule = ContractRule(kind = "string", format = "uuid")
    private fun rule16(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 80)
    private fun rule17(): ContractRule = ContractRule(reference = "PreferencesDto")
    private fun rule18(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule19(): ContractRule = ContractRule(kind = "object", properties = mapOf("device_id" to rule15(), "platform" to rule20(), "status" to rule21(), "last_seen_at" to rule22()), required = setOf("device_id", "platform", "status", "last_seen_at"), additionalProperties = false)
    private fun rule20(): ContractRule = ContractRule(kind = "string", choices = listOf("android", "windows"))
    private fun rule21(): ContractRule = ContractRule(kind = "string", choices = listOf("bound", "revoked"))
    private fun rule22(): ContractRule = ContractRule(anyOf = listOf(rule23(), rule24()))
    private fun rule23(): ContractRule = ContractRule(kind = "string", format = "date-time")
    private fun rule24(): ContractRule = ContractRule(kind = "null")
    private fun rule25(): ContractRule = ContractRule(kind = "object", properties = mapOf("access_token" to rule26(), "refresh_token" to rule27(), "expires_in" to rule28(), "account_id" to rule15()), required = setOf("access_token", "refresh_token", "expires_in", "account_id"), additionalProperties = false)
    private fun rule26(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 4096)
    private fun rule27(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 4096)
    private fun rule28(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 86400.0)
    private fun rule29(): ContractRule = ContractRule(kind = "object", properties = mapOf("session" to rule30()), required = setOf("session"), additionalProperties = false)
    private fun rule30(): ContractRule = ContractRule(reference = "SessionDto")
    private fun rule31(): ContractRule = ContractRule(kind = "object", properties = mapOf("carrier_token" to rule32(), "nonce" to rule33(), "device_id" to rule15()), required = setOf("carrier_token", "nonce", "device_id"), additionalProperties = false)
    private fun rule32(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 8192)
    private fun rule33(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 256)
    private fun rule34(): ContractRule = ContractRule(kind = "object", properties = mapOf("profile_label" to rule35(), "mode" to rule1(), "subject_ref" to rule15(), "guardian_consent_id" to rule36()), required = setOf("profile_label", "mode", "subject_ref", "guardian_consent_id"), additionalProperties = false)
    private fun rule35(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 80)
    private fun rule36(): ContractRule = ContractRule(anyOf = listOf(rule15(), rule37()))
    private fun rule37(): ContractRule = ContractRule(kind = "null")
    private fun rule38(): ContractRule = ContractRule(kind = "object", properties = mapOf("method" to rule39(), "subject_profile" to rule40(), "consent_id" to rule15()), required = setOf("method", "subject_profile", "consent_id"), additionalProperties = false)
    private fun rule39(): ContractRule = ContractRule(kind = "string", choices = listOf("family_assisted", "community_assisted"))
    private fun rule40(): ContractRule = ContractRule(reference = "SubjectProfile")
    private fun rule41(): ContractRule = ContractRule(kind = "object", properties = mapOf("claim_id" to rule15(), "expires_at" to rule23(), "status" to rule42()), required = setOf("claim_id", "expires_at", "status"), additionalProperties = false)
    private fun rule42(): ContractRule = ContractRule(constant = WireConstant("pending_confirmation"))
    private fun rule43(): ContractRule = ContractRule(kind = "object", properties = mapOf("proof" to rule44(), "consent_id" to rule15()), required = setOf("proof", "consent_id"), additionalProperties = false)
    private fun rule44(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 4096)
    private fun rule45(): ContractRule = ContractRule(kind = "object", properties = mapOf("account_id" to rule15(), "status" to rule46()), required = setOf("account_id", "status"), additionalProperties = false)
    private fun rule46(): ContractRule = ContractRule(kind = "string", choices = listOf("pending_binding", "active"))
    private fun rule47(): ContractRule = ContractRule(kind = "object", properties = mapOf("binding_id" to rule15()), required = setOf("binding_id"), additionalProperties = false)
    private fun rule48(): ContractRule = ContractRule(kind = "object", properties = mapOf("challenge_id" to rule15(), "challenge" to rule49(), "expires_at" to rule23()), required = setOf("challenge_id", "challenge", "expires_at"), additionalProperties = false)
    private fun rule49(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 512)
    private fun rule50(): ContractRule = ContractRule(kind = "object", properties = mapOf("challenge_id" to rule15(), "signature" to rule51()), required = setOf("challenge_id", "signature"), additionalProperties = false)
    private fun rule51(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 4096)
    private fun rule52(): ContractRule = ContractRule(kind = "object", properties = mapOf("challenge_id" to rule15(), "capture_policy" to rule53()), required = setOf("challenge_id", "capture_policy"), additionalProperties = false)
    private fun rule53(): ContractRule = ContractRule(kind = "object", properties = mapOf("policy_version" to rule54(), "liveness_required" to rule55(), "expires_at" to rule23()), required = setOf("policy_version", "liveness_required", "expires_at"), additionalProperties = false)
    private fun rule54(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 40)
    private fun rule55(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule56(): ContractRule = ContractRule(kind = "object", properties = mapOf("challenge_id" to rule15(), "proof_ref" to rule15()), required = setOf("challenge_id", "proof_ref"), additionalProperties = false)
    private fun rule57(): ContractRule = ContractRule(kind = "object", properties = mapOf("refresh_token" to rule58()), required = setOf("refresh_token"), additionalProperties = false)
    private fun rule58(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 4096)
    private fun rule59(): ContractRule = ContractRule(kind = "object", properties = mapOf("revoked" to rule60()), required = setOf("revoked"), additionalProperties = false)
    private fun rule60(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule61(): ContractRule = ContractRule(kind = "object", properties = mapOf("user" to rule62(), "devices" to rule63()), required = setOf("user", "devices"), additionalProperties = false)
    private fun rule62(): ContractRule = ContractRule(reference = "UserDto")
    private fun rule63(): ContractRule = ContractRule(kind = "array", items = rule64(), minItems = 0, maxItems = 30)
    private fun rule64(): ContractRule = ContractRule(reference = "DeviceDto")
    private fun rule65(): ContractRule = ContractRule(kind = "object", properties = mapOf("mode" to rule1(), "preferences" to rule66()), required = setOf("mode", "preferences"), additionalProperties = false)
    private fun rule66(): ContractRule = ContractRule(reference = "PreferencesDto")
    private fun rule67(): ContractRule = ContractRule(kind = "object", properties = mapOf("user" to rule68(), "version" to rule69()), required = setOf("user", "version"), additionalProperties = false)
    private fun rule68(): ContractRule = ContractRule(reference = "UserDto")
    private fun rule69(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule70(): ContractRule = ContractRule(kind = "object", properties = mapOf("helper_ref" to rule15(), "requested_scopes" to rule71()), required = setOf("helper_ref", "requested_scopes"), additionalProperties = false)
    private fun rule71(): ContractRule = ContractRule(kind = "array", items = rule2(), minItems = 1, maxItems = 4)
    private fun rule72(): ContractRule = ContractRule(kind = "object", properties = mapOf("invitation_id" to rule15(), "expires_at" to rule23()), required = setOf("invitation_id", "expires_at"), additionalProperties = false)
    private fun rule73(): ContractRule = ContractRule(kind = "object", properties = mapOf("consent_id" to rule15(), "scopes" to rule74()), required = setOf("consent_id", "scopes"), additionalProperties = false)
    private fun rule74(): ContractRule = ContractRule(kind = "array", items = rule2(), minItems = 0, maxItems = 4)
    private fun rule75(): ContractRule = ContractRule(kind = "object", properties = mapOf("relation_id" to rule15(), "subject_id" to rule15(), "helper_id" to rule15(), "label" to rule76(), "scopes" to rule77(), "status" to rule78(), "grant_revision" to rule79(), "version" to rule80(), "created_at" to rule23(), "updated_at" to rule23(), "deleted_at" to rule81()), required = setOf("relation_id", "subject_id", "helper_id", "label", "scopes", "status", "grant_revision", "version", "created_at", "updated_at", "deleted_at"), additionalProperties = false)
    private fun rule76(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 80)
    private fun rule77(): ContractRule = ContractRule(kind = "array", items = rule2(), minItems = 0, maxItems = 4)
    private fun rule78(): ContractRule = ContractRule(kind = "string", choices = listOf("active", "revoked"))
    private fun rule79(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule80(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule81(): ContractRule = ContractRule(anyOf = listOf(rule23(), rule82()))
    private fun rule82(): ContractRule = ContractRule(kind = "null")
    private fun rule83(): ContractRule = ContractRule(kind = "object", properties = mapOf("relation" to rule84()), required = setOf("relation"), additionalProperties = false)
    private fun rule84(): ContractRule = ContractRule(reference = "RelationDto")
    private fun rule85(): ContractRule = ContractRule(kind = "object", properties = mapOf("items" to rule86(), "next_cursor" to rule88()), required = setOf("items", "next_cursor"), additionalProperties = false)
    private fun rule86(): ContractRule = ContractRule(kind = "array", items = rule87(), minItems = 0, maxItems = 100)
    private fun rule87(): ContractRule = ContractRule(reference = "RelationDto")
    private fun rule88(): ContractRule = ContractRule(anyOf = listOf(rule89(), rule90()))
    private fun rule89(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 512)
    private fun rule90(): ContractRule = ContractRule(kind = "null")
    private fun rule91(): ContractRule = ContractRule(kind = "object", properties = mapOf("scopes" to rule92(), "consent_id" to rule15()), required = setOf("scopes", "consent_id"), additionalProperties = false)
    private fun rule92(): ContractRule = ContractRule(kind = "array", items = rule2(), minItems = 0, maxItems = 4)
    private fun rule93(): ContractRule = ContractRule(kind = "object", properties = mapOf("grant_revision" to rule94()), required = setOf("grant_revision"), additionalProperties = false)
    private fun rule94(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule95(): ContractRule = ContractRule(kind = "object", properties = mapOf("revoked_at" to rule23()), required = setOf("revoked_at"), additionalProperties = false)
    private fun rule96(): ContractRule = ContractRule(kind = "object", properties = mapOf("purpose" to rule97(), "scopes" to rule98(), "notice_version" to rule99(), "subject_id" to rule15()), required = setOf("purpose", "scopes", "notice_version", "subject_id"), additionalProperties = false)
    private fun rule97(): ContractRule = ContractRule(kind = "string", choices = listOf("account_claim", "learning_share", "assistance", "screen_analysis", "generation"))
    private fun rule98(): ContractRule = ContractRule(kind = "array", items = rule2(), minItems = 0, maxItems = 4)
    private fun rule99(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 40)
    private fun rule100(): ContractRule = ContractRule(kind = "object", properties = mapOf("consent_id" to rule15()), required = setOf("consent_id"), additionalProperties = false)
    private fun rule101(): ContractRule = ContractRule(kind = "object", properties = mapOf("withdrawn_at" to rule23()), required = setOf("withdrawn_at"), additionalProperties = false)
    private fun rule102(): ContractRule = ContractRule(kind = "object", properties = mapOf("mode" to rule1()), required = setOf("mode"), additionalProperties = false)
    private fun rule103(): ContractRule = ContractRule(kind = "object", properties = mapOf("session_id" to rule15()), required = setOf("session_id"), additionalProperties = false)
    private fun rule104(): ContractRule = ContractRule(kind = "object", properties = mapOf("message_id" to rule15(), "role" to rule105(), "text" to rule106(), "state" to rule107(), "created_at" to rule23()), required = setOf("message_id", "role", "text", "state", "created_at"), additionalProperties = false)
    private fun rule105(): ContractRule = ContractRule(kind = "string", choices = listOf("user", "assistant"))
    private fun rule106(): ContractRule = ContractRule(kind = "string", minLength = 0, maxLength = 24000)
    private fun rule107(): ContractRule = ContractRule(kind = "string", choices = listOf("completed", "interrupted", "cancelled"))
    private fun rule108(): ContractRule = ContractRule(kind = "object", properties = mapOf("items" to rule109(), "next_cursor" to rule111()), required = setOf("items", "next_cursor"), additionalProperties = false)
    private fun rule109(): ContractRule = ContractRule(kind = "array", items = rule110(), minItems = 0, maxItems = 100)
    private fun rule110(): ContractRule = ContractRule(reference = "ConversationMessageDto")
    private fun rule111(): ContractRule = ContractRule(anyOf = listOf(rule112(), rule113()))
    private fun rule112(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 512)
    private fun rule113(): ContractRule = ContractRule(kind = "null")
    private fun rule114(): ContractRule = ContractRule(kind = "object", properties = mapOf("input_id" to rule15(), "text" to rule115(), "media_refs" to rule116(), "generation" to rule117()), required = setOf("input_id", "generation"), additionalProperties = false, anyOf = listOf(rule118(), rule120()))
    private fun rule115(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 1500)
    private fun rule116(): ContractRule = ContractRule(kind = "array", items = rule15(), minItems = 1, maxItems = 4)
    private fun rule117(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule118(): ContractRule = ContractRule(kind = "object", properties = mapOf("text" to rule119()), required = setOf("text"))
    private fun rule119(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 1500)
    private fun rule120(): ContractRule = ContractRule(kind = "object", properties = mapOf("media_refs" to rule121()), required = setOf("media_refs"))
    private fun rule121(): ContractRule = ContractRule(kind = "array", items = rule15(), minItems = 1, maxItems = 4)
    private fun rule122(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "stream_path" to rule123()), required = setOf("request_id", "stream_path"), additionalProperties = false)
    private fun rule123(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 512, pattern = "^/v1/[a-zA-Z0-9_/?=&.%:-]+\$")
    private fun rule124(): ContractRule = ContractRule(kind = "object", properties = mapOf("status" to rule125()), required = setOf("status"), additionalProperties = false)
    private fun rule125(): ContractRule = ContractRule(constant = WireConstant("cancelled"))
    private fun rule126(): ContractRule = ContractRule(kind = "object", properties = mapOf("purpose" to rule127(), "mime" to rule128(), "size" to rule129(), "hash" to rule130(), "safety_ticket" to rule131()), required = setOf("purpose", "mime", "size", "hash", "safety_ticket"), additionalProperties = false)
    private fun rule127(): ContractRule = ContractRule(kind = "string", choices = listOf("question", "drawing", "safe_frame"))
    private fun rule128(): ContractRule = ContractRule(kind = "string", choices = listOf("image/jpeg", "image/png", "image/webp"))
    private fun rule129(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 10485760.0)
    private fun rule130(): ContractRule = ContractRule(kind = "string", pattern = "^[a-f0-9]{64}\$")
    private fun rule131(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 2048)
    private fun rule132(): ContractRule = ContractRule(kind = "object", properties = mapOf("upload_id" to rule15(), "upload_path" to rule123(), "expires_at" to rule23()), required = setOf("upload_id", "upload_path", "expires_at"), additionalProperties = false)
    private fun rule133(): ContractRule = ContractRule(kind = "object", properties = mapOf("hash" to rule130()), required = setOf("hash"), additionalProperties = false)
    private fun rule134(): ContractRule = ContractRule(kind = "object", properties = mapOf("media_ref" to rule15()), required = setOf("media_ref"), additionalProperties = false)
    private fun rule135(): ContractRule = ContractRule(kind = "object", properties = mapOf("frame_id" to rule15(), "generation" to rule136(), "display_id" to rule15(), "window_id" to rule15(), "transform_id" to rule15(), "captured_at" to rule23(), "width" to rule137(), "height" to rule138()), required = setOf("frame_id", "generation", "display_id", "window_id", "transform_id", "captured_at", "width", "height"), additionalProperties = false)
    private fun rule136(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule137(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 32768.0)
    private fun rule138(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 32768.0)
    private fun rule139(): ContractRule = ContractRule(kind = "object", properties = mapOf("scene" to rule140(), "confidence" to rule141(), "detector_version" to rule142(), "safety_state" to rule143()), required = setOf("scene", "confidence", "detector_version", "safety_state"), additionalProperties = false)
    private fun rule140(): ContractRule = ContractRule(kind = "string", choices = listOf("settings", "camera", "other", "unknown"))
    private fun rule141(): ContractRule = ContractRule(kind = "number", minimum = 0.0, maximum = 1.0)
    private fun rule142(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 80)
    private fun rule143(): ContractRule = ContractRule(constant = WireConstant("safe"))
    private fun rule144(): ContractRule = ContractRule(kind = "object", properties = mapOf("goal" to rule145(), "flow_hint" to rule15()), required = setOf("goal"), additionalProperties = false)
    private fun rule145(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 500)
    private fun rule146(): ContractRule = ContractRule(kind = "object", properties = mapOf("guide_id" to rule15()), required = setOf("guide_id"), additionalProperties = false)
    private fun rule147(): ContractRule = ContractRule(kind = "object", properties = mapOf("frame_ref" to rule15(), "frame_context" to rule148(), "local_features" to rule149(), "consent_id" to rule15()), required = setOf("frame_ref", "frame_context", "local_features", "consent_id"), additionalProperties = false)
    private fun rule148(): ContractRule = ContractRule(reference = "FrameContextDto")
    private fun rule149(): ContractRule = ContractRule(reference = "LocalFeaturesDto")
    private fun rule150(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15()), required = setOf("request_id"), additionalProperties = false)
    private fun rule151(): ContractRule = ContractRule(kind = "object", properties = mapOf("step_id" to rule15(), "verification_id" to rule15(), "new_frame_context" to rule152(), "observed_features" to rule153()), required = setOf("step_id", "verification_id", "new_frame_context", "observed_features"), additionalProperties = false)
    private fun rule152(): ContractRule = ContractRule(reference = "FrameContextDto")
    private fun rule153(): ContractRule = ContractRule(reference = "LocalFeaturesDto")
    private fun rule154(): ContractRule = ContractRule(kind = "object", properties = mapOf("result" to rule155(), "next_state" to rule156()), required = setOf("result", "next_state"), additionalProperties = false)
    private fun rule155(): ContractRule = ContractRule(kind = "string", choices = listOf("matched", "unmatched", "uncertain"))
    private fun rule156(): ContractRule = ContractRule(kind = "string", choices = listOf("analyzing", "await_action", "need_help", "risk_paused", "completed"))
    private fun rule157(): ContractRule = ContractRule(kind = "object", properties = mapOf("ended" to rule158()), required = setOf("ended"), additionalProperties = false)
    private fun rule158(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule159(): ContractRule = ContractRule(kind = "object", properties = mapOf("note_id" to rule15(), "owner_id" to rule15(), "asked_at" to rule23(), "question" to rule160(), "topic" to rule161(), "answer_summary" to rule162(), "mastery" to rule163(), "mastery_source" to rule164(), "reviewed_at" to rule167(), "source" to rule169(), "source_session_id" to rule170(), "version" to rule80(), "created_at" to rule23(), "updated_at" to rule23(), "deleted_at" to rule81()), required = setOf("note_id", "owner_id", "asked_at", "question", "topic", "answer_summary", "mastery", "mastery_source", "reviewed_at", "source", "source_session_id", "version", "created_at", "updated_at", "deleted_at"), additionalProperties = false)
    private fun rule160(): ContractRule = ContractRule(kind = "string", minLength = 0, maxLength = 1500)
    private fun rule161(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 200)
    private fun rule162(): ContractRule = ContractRule(kind = "string", minLength = 0, maxLength = 10000)
    private fun rule163(): ContractRule = ContractRule(kind = "string", choices = listOf("unmastered", "mastered"))
    private fun rule164(): ContractRule = ContractRule(anyOf = listOf(rule165(), rule166()))
    private fun rule165(): ContractRule = ContractRule(kind = "string", choices = listOf("self", "authorized_family"))
    private fun rule166(): ContractRule = ContractRule(kind = "null")
    private fun rule167(): ContractRule = ContractRule(anyOf = listOf(rule23(), rule168()))
    private fun rule168(): ContractRule = ContractRule(kind = "null")
    private fun rule169(): ContractRule = ContractRule(kind = "string", choices = listOf("demo", "conversation", "guidance"))
    private fun rule170(): ContractRule = ContractRule(anyOf = listOf(rule15(), rule171()))
    private fun rule171(): ContractRule = ContractRule(kind = "null")
    private fun rule172(): ContractRule = ContractRule(kind = "object", properties = mapOf("asked_at" to rule23(), "question" to rule173(), "topic" to rule174(), "answer_summary" to rule175(), "source_session_id" to rule176()), required = setOf("asked_at", "question", "topic", "answer_summary", "source_session_id"), additionalProperties = false)
    private fun rule173(): ContractRule = ContractRule(kind = "string", minLength = 0, maxLength = 1500)
    private fun rule174(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 200)
    private fun rule175(): ContractRule = ContractRule(kind = "string", minLength = 0, maxLength = 10000)
    private fun rule176(): ContractRule = ContractRule(anyOf = listOf(rule15(), rule177()))
    private fun rule177(): ContractRule = ContractRule(kind = "null")
    private fun rule178(): ContractRule = ContractRule(kind = "object", properties = mapOf("note" to rule179(), "version" to rule180()), required = setOf("note", "version"), additionalProperties = false)
    private fun rule179(): ContractRule = ContractRule(reference = "NoteDto")
    private fun rule180(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule181(): ContractRule = ContractRule(kind = "object", properties = mapOf("items" to rule182(), "next_cursor" to rule184()), required = setOf("items", "next_cursor"), additionalProperties = false)
    private fun rule182(): ContractRule = ContractRule(kind = "array", items = rule183(), minItems = 0, maxItems = 100)
    private fun rule183(): ContractRule = ContractRule(reference = "NoteDto")
    private fun rule184(): ContractRule = ContractRule(anyOf = listOf(rule185(), rule186()))
    private fun rule185(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 512)
    private fun rule186(): ContractRule = ContractRule(kind = "null")
    private fun rule187(): ContractRule = ContractRule(kind = "object", properties = mapOf("answer_summary" to rule188(), "mastery" to rule189(), "mastery_source" to rule190()), additionalProperties = false, minProperties = 1, dependentRequired = mapOf("mastery" to setOf("mastery_source"), "mastery_source" to setOf("mastery")))
    private fun rule188(): ContractRule = ContractRule(kind = "string", minLength = 0, maxLength = 10000)
    private fun rule189(): ContractRule = ContractRule(kind = "string", choices = listOf("unmastered", "mastered"))
    private fun rule190(): ContractRule = ContractRule(kind = "string", choices = listOf("self", "authorized_family"))
    private fun rule191(): ContractRule = ContractRule(kind = "object", properties = mapOf("deleted_at" to rule23()), required = setOf("deleted_at"), additionalProperties = false)
    private fun rule192(): ContractRule = ContractRule(kind = "object", properties = mapOf("result" to rule193(), "todo_id" to rule194(), "evidence_kind" to rule196()), required = setOf("result", "todo_id", "evidence_kind"), additionalProperties = false)
    private fun rule193(): ContractRule = ContractRule(kind = "string", choices = listOf("practiced", "verified", "aborted"))
    private fun rule194(): ContractRule = ContractRule(anyOf = listOf(rule15(), rule195()))
    private fun rule195(): ContractRule = ContractRule(kind = "null")
    private fun rule196(): ContractRule = ContractRule(kind = "string", choices = listOf("user_confirmation", "independent_reproduction", "none"))
    private fun rule197(): ContractRule = ContractRule(kind = "object", properties = mapOf("review_id" to rule15()), required = setOf("review_id"), additionalProperties = false)
    private fun rule198(): ContractRule = ContractRule(kind = "object", properties = mapOf("frequency" to rule199(), "interval" to rule200()), required = setOf("frequency", "interval"), additionalProperties = false)
    private fun rule199(): ContractRule = ContractRule(kind = "string", choices = listOf("none", "daily", "weekly"))
    private fun rule200(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 52.0)
    private fun rule201(): ContractRule = ContractRule(kind = "object", properties = mapOf("todo_id" to rule15(), "owner_id" to rule15(), "creator_id" to rule15(), "title" to rule202(), "note_id" to rule203(), "timezone" to rule205(), "remind_at" to rule23(), "repeat_rule" to rule206(), "status" to rule207(), "completed_at" to rule208(), "source" to rule210(), "next_fire_at" to rule211(), "version" to rule80(), "created_at" to rule23(), "updated_at" to rule23(), "deleted_at" to rule81()), required = setOf("todo_id", "owner_id", "creator_id", "title", "note_id", "timezone", "remind_at", "repeat_rule", "status", "completed_at", "source", "next_fire_at", "version", "created_at", "updated_at", "deleted_at"), additionalProperties = false)
    private fun rule202(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 200)
    private fun rule203(): ContractRule = ContractRule(anyOf = listOf(rule15(), rule204()))
    private fun rule204(): ContractRule = ContractRule(kind = "null")
    private fun rule205(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 80, format = "iana-timezone")
    private fun rule206(): ContractRule = ContractRule(reference = "RepeatRule")
    private fun rule207(): ContractRule = ContractRule(kind = "string", choices = listOf("pending", "completed", "cancelled"))
    private fun rule208(): ContractRule = ContractRule(anyOf = listOf(rule23(), rule209()))
    private fun rule209(): ContractRule = ContractRule(kind = "null")
    private fun rule210(): ContractRule = ContractRule(kind = "string", choices = listOf("self", "review", "authorized_family"))
    private fun rule211(): ContractRule = ContractRule(anyOf = listOf(rule23(), rule212()))
    private fun rule212(): ContractRule = ContractRule(kind = "null")
    private fun rule213(): ContractRule = ContractRule(kind = "object", properties = mapOf("title" to rule214(), "note_id" to rule215(), "remind_at" to rule23(), "timezone" to rule205(), "repeat_rule" to rule217(), "time_confirmed" to rule218()), required = setOf("title", "note_id", "remind_at", "timezone", "repeat_rule", "time_confirmed"), additionalProperties = false)
    private fun rule214(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 200)
    private fun rule215(): ContractRule = ContractRule(anyOf = listOf(rule15(), rule216()))
    private fun rule216(): ContractRule = ContractRule(kind = "null")
    private fun rule217(): ContractRule = ContractRule(reference = "RepeatRule")
    private fun rule218(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule219(): ContractRule = ContractRule(kind = "object", properties = mapOf("title" to rule220(), "note_id" to rule221(), "remind_at" to rule23(), "timezone" to rule205(), "repeat_rule" to rule223(), "time_confirmed" to rule224()), additionalProperties = false, minProperties = 1, dependentRequired = mapOf("remind_at" to setOf("timezone", "time_confirmed"), "timezone" to setOf("remind_at", "time_confirmed"), "repeat_rule" to setOf("remind_at", "timezone", "time_confirmed"), "time_confirmed" to setOf("remind_at", "timezone")))
    private fun rule220(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 200)
    private fun rule221(): ContractRule = ContractRule(anyOf = listOf(rule15(), rule222()))
    private fun rule222(): ContractRule = ContractRule(kind = "null")
    private fun rule223(): ContractRule = ContractRule(reference = "RepeatRule")
    private fun rule224(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule225(): ContractRule = ContractRule(kind = "object", properties = mapOf("patch" to rule226()), required = setOf("patch"), additionalProperties = false)
    private fun rule226(): ContractRule = ContractRule(reference = "TodoPatch")
    private fun rule227(): ContractRule = ContractRule(kind = "object", properties = mapOf("todo" to rule228(), "version" to rule229()), required = setOf("todo", "version"), additionalProperties = false)
    private fun rule228(): ContractRule = ContractRule(reference = "TodoDto")
    private fun rule229(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule230(): ContractRule = ContractRule(kind = "object", properties = mapOf("items" to rule231(), "next_cursor" to rule233()), required = setOf("items", "next_cursor"), additionalProperties = false)
    private fun rule231(): ContractRule = ContractRule(kind = "array", items = rule232(), minItems = 0, maxItems = 100)
    private fun rule232(): ContractRule = ContractRule(reference = "TodoDto")
    private fun rule233(): ContractRule = ContractRule(anyOf = listOf(rule234(), rule235()))
    private fun rule234(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 512)
    private fun rule235(): ContractRule = ContractRule(kind = "null")
    private fun rule236(): ContractRule = ContractRule(kind = "object", properties = mapOf("cancelled" to rule237()), required = setOf("cancelled"), additionalProperties = false)
    private fun rule237(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule238(): ContractRule = ContractRule(kind = "object", properties = mapOf("result" to rule239(), "next_fire_at" to rule240()), required = setOf("result", "next_fire_at"), additionalProperties = false)
    private fun rule239(): ContractRule = ContractRule(constant = WireConstant("completed"))
    private fun rule240(): ContractRule = ContractRule(anyOf = listOf(rule23(), rule241()))
    private fun rule241(): ContractRule = ContractRule(kind = "null")
    private fun rule242(): ContractRule = ContractRule(kind = "object", properties = mapOf("device_id" to rule15(), "channel" to rule243(), "state" to rule244()), required = setOf("device_id", "channel", "state"), additionalProperties = false)
    private fun rule243(): ContractRule = ContractRule(kind = "string", choices = listOf("local", "push"))
    private fun rule244(): ContractRule = ContractRule(kind = "string", choices = listOf("submitted", "delivered", "opened", "failed", "missed", "unknown"))
    private fun rule245(): ContractRule = ContractRule(kind = "object", properties = mapOf("accepted" to rule246()), required = setOf("accepted"), additionalProperties = false)
    private fun rule246(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule247(): ContractRule = ContractRule(kind = "object", properties = mapOf("source" to rule248(), "input_ref" to rule15(), "appearance" to rule3()), required = setOf("source", "input_ref", "appearance"), additionalProperties = false)
    private fun rule248(): ContractRule = ContractRule(constant = WireConstant("drawing"))
    private fun rule249(): ContractRule = ContractRule(kind = "object", properties = mapOf("job_id" to rule15(), "status" to rule250()), required = setOf("job_id", "status"), additionalProperties = false)
    private fun rule250(): ContractRule = ContractRule(constant = WireConstant("queued"))
    private fun rule251(): ContractRule = ContractRule(kind = "object", properties = mapOf("asset_id" to rule15(), "kind" to rule252(), "manifest_ref" to rule15(), "validated" to rule253(), "hash" to rule130()), required = setOf("asset_id", "kind", "manifest_ref", "validated", "hash"), additionalProperties = false)
    private fun rule252(): ContractRule = ContractRule(kind = "string", choices = listOf("animated_2d", "local_3d"))
    private fun rule253(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule254(): ContractRule = ContractRule(kind = "object", properties = mapOf("job_id" to rule15(), "status" to rule255(), "progress" to rule256(), "assets" to rule257(), "generation" to rule259(), "error" to rule260()), required = setOf("job_id", "status", "progress", "assets", "generation", "error"), additionalProperties = false)
    private fun rule255(): ContractRule = ContractRule(kind = "string", choices = listOf("queued", "processing", "succeeded", "failed", "cancelled"))
    private fun rule256(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 100.0)
    private fun rule257(): ContractRule = ContractRule(kind = "array", items = rule258(), minItems = 0, maxItems = 8)
    private fun rule258(): ContractRule = ContractRule(reference = "AssetDto")
    private fun rule259(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule260(): ContractRule = ContractRule(anyOf = listOf(rule261(), rule264()))
    private fun rule261(): ContractRule = ContractRule(kind = "object", properties = mapOf("code" to rule262(), "message" to rule263()), required = setOf("code", "message"), additionalProperties = false)
    private fun rule262(): ContractRule = ContractRule(kind = "string", choices = listOf("PROVIDER_UNAVAILABLE", "RATE_LIMITED", "CANCELLED"))
    private fun rule263(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 320)
    private fun rule264(): ContractRule = ContractRule(kind = "null")
    private fun rule265(): ContractRule = ContractRule(kind = "object", properties = mapOf("status" to rule266()), required = setOf("status"), additionalProperties = false)
    private fun rule266(): ContractRule = ContractRule(constant = WireConstant("cancelled"))
    private fun rule267(): ContractRule = ContractRule(kind = "object", properties = mapOf("asset_id" to rule15(), "fallback_2d_id" to rule15(), "appearance" to rule3(), "voice" to rule8(), "version" to rule268()), required = setOf("asset_id", "fallback_2d_id", "appearance", "voice", "version"), additionalProperties = false)
    private fun rule268(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule269(): ContractRule = ContractRule(kind = "object", properties = mapOf("asset_id" to rule15(), "fallback_2d_id" to rule15(), "appearance" to rule3(), "voice" to rule8(), "preview_confirmed" to rule270()), required = setOf("asset_id", "fallback_2d_id", "appearance", "voice", "preview_confirmed"), additionalProperties = false)
    private fun rule270(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule271(): ContractRule = ContractRule(kind = "object", properties = mapOf("pet" to rule272(), "availability" to rule273()), required = setOf("pet", "availability"), additionalProperties = false)
    private fun rule272(): ContractRule = ContractRule(reference = "PetDto")
    private fun rule273(): ContractRule = ContractRule(kind = "string", choices = listOf("available", "fallback_2d", "unavailable"))
    private fun rule274(): ContractRule = ContractRule(kind = "object", properties = mapOf("version" to rule275(), "hash" to rule130(), "signature" to rule276(), "download_path" to rule123(), "min_client" to rule277()), required = setOf("version", "hash", "signature", "download_path", "min_client"), additionalProperties = false)
    private fun rule275(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 40)
    private fun rule276(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 4096)
    private fun rule277(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 40)
    private fun rule278(): ContractRule = ContractRule(oneOf = listOf(rule279(), rule284(), rule289(), rule294(), rule299(), rule304()))
    private fun rule279(): ContractRule = ContractRule(kind = "object", properties = mapOf("mutation_id" to rule15(), "entity_id" to rule15(), "entity_type" to rule280(), "base_version" to rule281(), "operation" to rule282(), "patch" to rule283()), required = setOf("mutation_id", "entity_id", "entity_type", "base_version", "operation", "patch"), additionalProperties = false)
    private fun rule280(): ContractRule = ContractRule(constant = WireConstant("note"))
    private fun rule281(): ContractRule = ContractRule(constant = WireConstant(0L))
    private fun rule282(): ContractRule = ContractRule(constant = WireConstant("create"))
    private fun rule283(): ContractRule = ContractRule(reference = "NoteCreateRequest")
    private fun rule284(): ContractRule = ContractRule(kind = "object", properties = mapOf("mutation_id" to rule15(), "entity_id" to rule15(), "entity_type" to rule285(), "base_version" to rule286(), "operation" to rule287(), "patch" to rule288()), required = setOf("mutation_id", "entity_id", "entity_type", "base_version", "operation", "patch"), additionalProperties = false)
    private fun rule285(): ContractRule = ContractRule(constant = WireConstant("note"))
    private fun rule286(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule287(): ContractRule = ContractRule(constant = WireConstant("update"))
    private fun rule288(): ContractRule = ContractRule(reference = "NoteUpdateRequest")
    private fun rule289(): ContractRule = ContractRule(kind = "object", properties = mapOf("mutation_id" to rule15(), "entity_id" to rule15(), "entity_type" to rule290(), "base_version" to rule291(), "operation" to rule292(), "patch" to rule293()), required = setOf("mutation_id", "entity_id", "entity_type", "base_version", "operation", "patch"), additionalProperties = false)
    private fun rule290(): ContractRule = ContractRule(constant = WireConstant("note"))
    private fun rule291(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule292(): ContractRule = ContractRule(constant = WireConstant("delete"))
    private fun rule293(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule294(): ContractRule = ContractRule(kind = "object", properties = mapOf("mutation_id" to rule15(), "entity_id" to rule15(), "entity_type" to rule295(), "base_version" to rule296(), "operation" to rule297(), "patch" to rule298()), required = setOf("mutation_id", "entity_id", "entity_type", "base_version", "operation", "patch"), additionalProperties = false)
    private fun rule295(): ContractRule = ContractRule(constant = WireConstant("todo"))
    private fun rule296(): ContractRule = ContractRule(constant = WireConstant(0L))
    private fun rule297(): ContractRule = ContractRule(constant = WireConstant("create"))
    private fun rule298(): ContractRule = ContractRule(reference = "TodoCreateRequest")
    private fun rule299(): ContractRule = ContractRule(kind = "object", properties = mapOf("mutation_id" to rule15(), "entity_id" to rule15(), "entity_type" to rule300(), "base_version" to rule301(), "operation" to rule302(), "patch" to rule303()), required = setOf("mutation_id", "entity_id", "entity_type", "base_version", "operation", "patch"), additionalProperties = false)
    private fun rule300(): ContractRule = ContractRule(constant = WireConstant("todo"))
    private fun rule301(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule302(): ContractRule = ContractRule(constant = WireConstant("update"))
    private fun rule303(): ContractRule = ContractRule(reference = "TodoPatch")
    private fun rule304(): ContractRule = ContractRule(kind = "object", properties = mapOf("mutation_id" to rule15(), "entity_id" to rule15(), "entity_type" to rule305(), "base_version" to rule306(), "operation" to rule307(), "patch" to rule308()), required = setOf("mutation_id", "entity_id", "entity_type", "base_version", "operation", "patch"), additionalProperties = false)
    private fun rule305(): ContractRule = ContractRule(constant = WireConstant("todo"))
    private fun rule306(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule307(): ContractRule = ContractRule(constant = WireConstant("delete"))
    private fun rule308(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule309(): ContractRule = ContractRule(kind = "object", properties = mapOf("mutations" to rule310()), required = setOf("mutations"), additionalProperties = false)
    private fun rule310(): ContractRule = ContractRule(kind = "array", items = rule311(), minItems = 1, maxItems = 100)
    private fun rule311(): ContractRule = ContractRule(reference = "SyncMutationDto")
    private fun rule312(): ContractRule = ContractRule(kind = "object", properties = mapOf("conflict_id" to rule15(), "entity_id" to rule15(), "entity_type" to rule313(), "base_version" to rule314(), "current_version" to rule315(), "current" to rule316(), "reason" to rule319()), required = setOf("conflict_id", "entity_id", "entity_type", "base_version", "current_version", "current", "reason"), additionalProperties = false)
    private fun rule313(): ContractRule = ContractRule(kind = "string", choices = listOf("note", "todo"))
    private fun rule314(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule315(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule316(): ContractRule = ContractRule(oneOf = listOf(rule317(), rule318()))
    private fun rule317(): ContractRule = ContractRule(reference = "NoteDto")
    private fun rule318(): ContractRule = ContractRule(reference = "TodoDto")
    private fun rule319(): ContractRule = ContractRule(kind = "string", choices = listOf("updated", "deleted"))
    private fun rule320(): ContractRule = ContractRule(kind = "object", properties = mapOf("mutation_id" to rule15(), "status" to rule321(), "version" to rule322(), "conflict" to rule325(), "error_code" to rule328()), required = setOf("mutation_id", "status", "version", "conflict", "error_code"), additionalProperties = false)
    private fun rule321(): ContractRule = ContractRule(kind = "string", choices = listOf("acked", "conflict", "failed"))
    private fun rule322(): ContractRule = ContractRule(anyOf = listOf(rule323(), rule324()))
    private fun rule323(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule324(): ContractRule = ContractRule(kind = "null")
    private fun rule325(): ContractRule = ContractRule(anyOf = listOf(rule326(), rule327()))
    private fun rule326(): ContractRule = ContractRule(reference = "ConflictDto")
    private fun rule327(): ContractRule = ContractRule(kind = "null")
    private fun rule328(): ContractRule = ContractRule(anyOf = listOf(rule329(), rule330()))
    private fun rule329(): ContractRule = ContractRule(kind = "string", choices = listOf("VERSION_CONFLICT", "SCOPE_DENIED", "INVALID_REQUEST"))
    private fun rule330(): ContractRule = ContractRule(kind = "null")
    private fun rule331(): ContractRule = ContractRule(kind = "object", properties = mapOf("results" to rule332()), required = setOf("results"), additionalProperties = false)
    private fun rule332(): ContractRule = ContractRule(kind = "array", items = rule333(), minItems = 0, maxItems = 100)
    private fun rule333(): ContractRule = ContractRule(reference = "SyncResult")
    private fun rule334(): ContractRule = ContractRule(kind = "object", properties = mapOf("entity_type" to rule335(), "entity_id" to rule15(), "version" to rule336(), "operation" to rule337(), "entity" to rule338()), required = setOf("entity_type", "entity_id", "version", "operation", "entity"), additionalProperties = false)
    private fun rule335(): ContractRule = ContractRule(kind = "string", choices = listOf("note", "todo"))
    private fun rule336(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule337(): ContractRule = ContractRule(kind = "string", choices = listOf("upsert", "delete"))
    private fun rule338(): ContractRule = ContractRule(anyOf = listOf(rule339(), rule342()))
    private fun rule339(): ContractRule = ContractRule(oneOf = listOf(rule340(), rule341()))
    private fun rule340(): ContractRule = ContractRule(reference = "NoteDto")
    private fun rule341(): ContractRule = ContractRule(reference = "TodoDto")
    private fun rule342(): ContractRule = ContractRule(kind = "null")
    private fun rule343(): ContractRule = ContractRule(kind = "object", properties = mapOf("changes" to rule344(), "next_cursor" to rule346()), required = setOf("changes", "next_cursor"), additionalProperties = false)
    private fun rule344(): ContractRule = ContractRule(kind = "array", items = rule345(), minItems = 0, maxItems = 100)
    private fun rule345(): ContractRule = ContractRule(reference = "SyncChange")
    private fun rule346(): ContractRule = ContractRule(anyOf = listOf(rule347(), rule348()))
    private fun rule347(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 512)
    private fun rule348(): ContractRule = ContractRule(kind = "null")
    private fun rule349(): ContractRule = ContractRule(kind = "object", properties = mapOf("relation_id" to rule15(), "local_consent_id" to rule15(), "requested_media" to rule350()), required = setOf("relation_id", "local_consent_id", "requested_media"), additionalProperties = false)
    private fun rule350(): ContractRule = ContractRule(kind = "array", items = rule351(), minItems = 1, maxItems = 2)
    private fun rule351(): ContractRule = ContractRule(kind = "string", choices = listOf("screen", "audio"))
    private fun rule352(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "expires_at" to rule23()), required = setOf("assist_id", "expires_at"), additionalProperties = false)
    private fun rule353(): ContractRule = ContractRule(kind = "object", properties = mapOf("state" to rule354()), required = setOf("state"), additionalProperties = false)
    private fun rule354(): ContractRule = ContractRule(kind = "string", choices = listOf("inviting", "accepted", "connecting", "active", "paused", "reconnecting", "ended"))
    private fun rule355(): ContractRule = ContractRule(kind = "object", properties = mapOf("device_id" to rule15(), "consent_id" to rule15(), "grant_revision" to rule356()), required = setOf("device_id", "consent_id", "grant_revision"), additionalProperties = false)
    private fun rule356(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule357(): ContractRule = ContractRule(kind = "object", properties = mapOf("signal_ticket" to rule358(), "turn_credentials" to rule359(), "expires_at" to rule23(), "relay_only" to rule364()), required = setOf("signal_ticket", "turn_credentials", "expires_at", "relay_only"), additionalProperties = false)
    private fun rule358(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 2048)
    private fun rule359(): ContractRule = ContractRule(kind = "object", properties = mapOf("urls" to rule360(), "username" to rule362(), "credential" to rule363()), required = setOf("urls", "username", "credential"), additionalProperties = false)
    private fun rule360(): ContractRule = ContractRule(kind = "array", items = rule361(), minItems = 1, maxItems = 4)
    private fun rule361(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 256, pattern = "^turns?:[^\\s]+\$")
    private fun rule362(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 256)
    private fun rule363(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 256)
    private fun rule364(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule365(): ContractRule = ContractRule(kind = "object", properties = mapOf("reason" to rule366()), required = setOf("reason"), additionalProperties = false)
    private fun rule366(): ContractRule = ContractRule(kind = "string", choices = listOf("user_stop", "risk", "consent_revoked", "permission_revoked", "disconnected", "expired"))
    private fun rule367(): ContractRule = ContractRule(kind = "object", properties = mapOf("state" to rule368()), required = setOf("state"), additionalProperties = false)
    private fun rule368(): ContractRule = ContractRule(constant = WireConstant("ended"))
    private fun rule369(): ContractRule = ContractRule(kind = "object", properties = mapOf("client" to rule370(), "detector" to rule371(), "policy" to rule372()), required = setOf("client", "detector", "policy"), additionalProperties = false)
    private fun rule370(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 40)
    private fun rule371(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 80)
    private fun rule372(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 80)
    private fun rule373(): ContractRule = ContractRule(kind = "object", properties = mapOf("kind" to rule374(), "action" to rule375(), "versions" to rule376(), "occurred_at" to rule23()), required = setOf("kind", "action", "versions", "occurred_at"), additionalProperties = false)
    private fun rule374(): ContractRule = ContractRule(kind = "string", choices = listOf("private", "transaction", "unknown", "detector_failure"))
    private fun rule375(): ContractRule = ContractRule(kind = "string", choices = listOf("paused", "stopped", "phone_entry"))
    private fun rule376(): ContractRule = ContractRule(reference = "SafetyVersions")
    private fun rule377(): ContractRule = ContractRule(kind = "object", properties = mapOf("event_id" to rule15()), required = setOf("event_id"), additionalProperties = false)
    private fun rule378(): ContractRule = ContractRule(kind = "object", properties = mapOf("event_id" to rule15(), "kind" to rule379(), "operation_key" to rule15(), "occurred_at" to rule23(), "assisted" to rule9()), required = setOf("event_id", "kind", "operation_key", "occurred_at", "assisted"), additionalProperties = false)
    private fun rule379(): ContractRule = ContractRule(kind = "string", choices = listOf("teaching_completed", "review_practiced", "mastery_confirmed", "independent_reproduction", "assist_requested"))
    private fun rule380(): ContractRule = ContractRule(kind = "object", properties = mapOf("events" to rule381()), required = setOf("events"), additionalProperties = false)
    private fun rule381(): ContractRule = ContractRule(kind = "array", items = rule382(), minItems = 1, maxItems = 100)
    private fun rule382(): ContractRule = ContractRule(reference = "MetricEvent")
    private fun rule383(): ContractRule = ContractRule(kind = "object", properties = mapOf("accepted_count" to rule384()), required = setOf("accepted_count"), additionalProperties = false)
    private fun rule384(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 100.0)
    private fun rule385(): ContractRule = ContractRule(kind = "object", properties = mapOf("authorized_org_ref" to rule15(), "subjects" to rule386()), required = setOf("authorized_org_ref", "subjects"), additionalProperties = false)
    private fun rule386(): ContractRule = ContractRule(kind = "array", items = rule387(), minItems = 1, maxItems = 100)
    private fun rule387(): ContractRule = ContractRule(kind = "object", properties = mapOf("subject_ref" to rule15(), "consent_id" to rule15()), required = setOf("subject_ref", "consent_id"), additionalProperties = false)
    private fun rule388(): ContractRule = ContractRule(kind = "object", properties = mapOf("batch_id" to rule15(), "item_results" to rule389()), required = setOf("batch_id", "item_results"), additionalProperties = false)
    private fun rule389(): ContractRule = ContractRule(kind = "array", items = rule390(), minItems = 0, maxItems = 100)
    private fun rule390(): ContractRule = ContractRule(kind = "object", properties = mapOf("subject_ref" to rule15(), "status" to rule391(), "claim_id" to rule392(), "reason" to rule394()), required = setOf("subject_ref", "status", "claim_id", "reason"), additionalProperties = false)
    private fun rule391(): ContractRule = ContractRule(kind = "string", choices = listOf("pending_confirmation", "rejected"))
    private fun rule392(): ContractRule = ContractRule(anyOf = listOf(rule15(), rule393()))
    private fun rule393(): ContractRule = ContractRule(kind = "null")
    private fun rule394(): ContractRule = ContractRule(anyOf = listOf(rule395(), rule396()))
    private fun rule395(): ContractRule = ContractRule(kind = "string", choices = listOf("CONSENT_REQUIRED", "SCOPE_DENIED", "INVALID_REQUEST"))
    private fun rule396(): ContractRule = ContractRule(kind = "null")
    private fun rule397(): ContractRule = ContractRule(kind = "object", properties = mapOf("device_id" to rule15(), "consent_id" to rule15(), "generation" to rule398()), required = setOf("device_id", "consent_id", "generation"), additionalProperties = false)
    private fun rule398(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule399(): ContractRule = ContractRule(kind = "object", properties = mapOf("ticket" to rule400(), "expires_at" to rule23(), "websocket_path" to rule401()), required = setOf("ticket", "expires_at", "websocket_path"), additionalProperties = false)
    private fun rule400(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 2048)
    private fun rule401(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 256, pattern = "^/v1/ws/[a-zA-Z0-9/_-]+\$")
    private fun rule402(): ContractRule = ContractRule(kind = "object", properties = mapOf("x" to rule403(), "y" to rule404(), "width" to rule405(), "height" to rule406()), required = setOf("x", "y", "width", "height"), additionalProperties = false)
    private fun rule403(): ContractRule = ContractRule(kind = "number", minimum = 0.0, maximum = 1.0)
    private fun rule404(): ContractRule = ContractRule(kind = "number", minimum = 0.0, maximum = 1.0)
    private fun rule405(): ContractRule = ContractRule(kind = "number", exclusiveMinimum = 0.0, maximum = 1.0)
    private fun rule406(): ContractRule = ContractRule(kind = "number", exclusiveMinimum = 0.0, maximum = 1.0)
    private fun rule407(): ContractRule = ContractRule(oneOf = listOf(rule408(), rule413(), rule418(), rule422(), rule426(), rule430(), rule435(), rule440(), rule444(), rule447(), rule452(), rule457()))
    private fun rule408(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule411(), "payload" to rule412()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule409(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule410(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule411(): ContractRule = ContractRule(constant = WireConstant("response.started"))
    private fun rule412(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule413(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule414(), "payload" to rule415()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule414(): ContractRule = ContractRule(constant = WireConstant("caption.segment"))
    private fun rule415(): ContractRule = ContractRule(kind = "object", properties = mapOf("segment_id" to rule15(), "index" to rule416(), "text" to rule417()), required = setOf("segment_id", "index", "text"), additionalProperties = false)
    private fun rule416(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule417(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 4000)
    private fun rule418(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule419(), "payload" to rule420()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule419(): ContractRule = ContractRule(constant = WireConstant("response.completed"))
    private fun rule420(): ContractRule = ContractRule(kind = "object", properties = mapOf("final_segment_count" to rule421()), required = setOf("final_segment_count"), additionalProperties = false)
    private fun rule421(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 1000.0)
    private fun rule422(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule423(), "payload" to rule424()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule423(): ContractRule = ContractRule(constant = WireConstant("response.cancelled"))
    private fun rule424(): ContractRule = ContractRule(kind = "object", properties = mapOf("reason" to rule425()), required = setOf("reason"), additionalProperties = false)
    private fun rule425(): ContractRule = ContractRule(kind = "string", choices = listOf("user_stop", "risk", "permission_revoked", "consent_revoked"))
    private fun rule426(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule427(), "payload" to rule428()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule427(): ContractRule = ContractRule(constant = WireConstant("response.failed"))
    private fun rule428(): ContractRule = ContractRule(kind = "object", properties = mapOf("code" to rule429(), "retryable" to rule9()), required = setOf("code", "retryable"), additionalProperties = false)
    private fun rule429(): ContractRule = ContractRule(kind = "string", choices = listOf("TIMEOUT", "RATE_LIMITED", "PROVIDER_UNAVAILABLE"))
    private fun rule430(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule431(), "payload" to rule432()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule431(): ContractRule = ContractRule(constant = WireConstant("guidance.step"))
    private fun rule432(): ContractRule = ContractRule(kind = "object", properties = mapOf("step_id" to rule15(), "instruction" to rule433(), "frame_context" to rule434(), "target" to rule402(), "expires_at" to rule23()), required = setOf("step_id", "instruction", "frame_context", "target", "expires_at"), additionalProperties = false)
    private fun rule433(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 500)
    private fun rule434(): ContractRule = ContractRule(reference = "FrameContextDto")
    private fun rule435(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule436(), "payload" to rule437()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule436(): ContractRule = ContractRule(constant = WireConstant("guidance.risk"))
    private fun rule437(): ContractRule = ContractRule(kind = "object", properties = mapOf("risk" to rule438(), "action" to rule439()), required = setOf("risk", "action"), additionalProperties = false)
    private fun rule438(): ContractRule = ContractRule(kind = "string", choices = listOf("private", "transaction", "unknown", "detector_failure"))
    private fun rule439(): ContractRule = ContractRule(kind = "string", choices = listOf("pause_all_related", "stop_teaching_and_media"))
    private fun rule440(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule441(), "payload" to rule442()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule441(): ContractRule = ContractRule(constant = WireConstant("guidance.low_confidence"))
    private fun rule442(): ContractRule = ContractRule(kind = "object", properties = mapOf("action" to rule443()), required = setOf("action"), additionalProperties = false)
    private fun rule443(): ContractRule = ContractRule(constant = WireConstant("request_help"))
    private fun rule444(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule445(), "payload" to rule446()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule445(): ContractRule = ContractRule(constant = WireConstant("guidance.completed"))
    private fun rule446(): ContractRule = ContractRule(kind = "object", properties = mapOf("verification_id" to rule15()), required = setOf("verification_id"), additionalProperties = false)
    private fun rule447(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule448(), "payload" to rule449()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule448(): ContractRule = ContractRule(constant = WireConstant("pet_job.progress"))
    private fun rule449(): ContractRule = ContractRule(kind = "object", properties = mapOf("status" to rule450(), "progress" to rule451()), required = setOf("status", "progress"), additionalProperties = false)
    private fun rule450(): ContractRule = ContractRule(kind = "string", choices = listOf("queued", "processing"))
    private fun rule451(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 99.0)
    private fun rule452(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule453(), "payload" to rule454()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule453(): ContractRule = ContractRule(constant = WireConstant("pet_job.succeeded"))
    private fun rule454(): ContractRule = ContractRule(kind = "object", properties = mapOf("assets" to rule455()), required = setOf("assets"), additionalProperties = false)
    private fun rule455(): ContractRule = ContractRule(kind = "array", items = rule456(), minItems = 1, maxItems = 8)
    private fun rule456(): ContractRule = ContractRule(reference = "AssetDto")
    private fun rule457(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule458(), "payload" to rule459()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule458(): ContractRule = ContractRule(constant = WireConstant("pet_job.failed"))
    private fun rule459(): ContractRule = ContractRule(kind = "object", properties = mapOf("code" to rule460()), required = setOf("code"), additionalProperties = false)
    private fun rule460(): ContractRule = ContractRule(kind = "string", choices = listOf("PROVIDER_UNAVAILABLE", "RATE_LIMITED", "CANCELLED"))
    private fun rule461(): ContractRule = ContractRule(oneOf = listOf(rule462(), rule466(), rule470(), rule475(), rule480(), rule485(), rule491(), rule495()))
    private fun rule462(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule463(), "payload" to rule464()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule463(): ContractRule = ContractRule(constant = WireConstant("invite"))
    private fun rule464(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "expires_at" to rule23(), "grant_revision" to rule465()), required = setOf("assist_id", "expires_at", "grant_revision"), additionalProperties = false)
    private fun rule465(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule466(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule467(), "payload" to rule468()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule467(): ContractRule = ContractRule(constant = WireConstant("accept"))
    private fun rule468(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "grant_revision" to rule469()), required = setOf("assist_id", "grant_revision"), additionalProperties = false)
    private fun rule469(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule470(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule471(), "payload" to rule472()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule471(): ContractRule = ContractRule(constant = WireConstant("offer"))
    private fun rule472(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "sdp" to rule473(), "grant_revision" to rule474()), required = setOf("assist_id", "sdp", "grant_revision"), additionalProperties = false)
    private fun rule473(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 65536, pattern = "^v=0\\r?\\n")
    private fun rule474(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule475(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule476(), "payload" to rule477()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule476(): ContractRule = ContractRule(constant = WireConstant("answer"))
    private fun rule477(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "sdp" to rule478(), "grant_revision" to rule479()), required = setOf("assist_id", "sdp", "grant_revision"), additionalProperties = false)
    private fun rule478(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 65536, pattern = "^v=0\\r?\\n")
    private fun rule479(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule480(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule481(), "payload" to rule482()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule481(): ContractRule = ContractRule(constant = WireConstant("ice"))
    private fun rule482(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "candidate" to rule483(), "grant_revision" to rule484()), required = setOf("assist_id", "candidate", "grant_revision"), additionalProperties = false)
    private fun rule483(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 2048, pattern = "^candidate:")
    private fun rule484(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule485(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule486(), "payload" to rule487()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule486(): ContractRule = ContractRule(constant = WireConstant("risk.pause"))
    private fun rule487(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "screen_paused" to rule488(), "audio_paused" to rule489(), "reason" to rule490()), required = setOf("assist_id", "screen_paused", "audio_paused", "reason"), additionalProperties = false)
    private fun rule488(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule489(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule490(): ContractRule = ContractRule(kind = "string", choices = listOf("transaction", "private", "unknown", "detector_failure"))
    private fun rule491(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule492(), "payload" to rule493()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule492(): ContractRule = ContractRule(constant = WireConstant("consent.revoked"))
    private fun rule493(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "consent_id" to rule15(), "grant_revision" to rule494()), required = setOf("assist_id", "consent_id", "grant_revision"), additionalProperties = false)
    private fun rule494(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule495(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule409(), "generation" to rule410(), "type" to rule496(), "payload" to rule497()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule496(): ContractRule = ContractRule(constant = WireConstant("end"))
    private fun rule497(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "reason" to rule498()), required = setOf("assist_id", "reason"), additionalProperties = false)
    private fun rule498(): ContractRule = ContractRule(kind = "string", choices = listOf("user_stop", "expired", "permission_revoked", "consent_revoked", "disconnected"))
    private fun rule499(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "generation" to rule500(), "seq" to rule501(), "codec" to rule502(), "byte_length" to rule503(), "duration_ms" to rule504()), required = setOf("request_id", "generation", "seq", "codec", "byte_length", "duration_ms"), additionalProperties = false)
    private fun rule500(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule501(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule502(): ContractRule = ContractRule(kind = "string", choices = listOf("opus", "pcm_s16le"))
    private fun rule503(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 65536.0)
    private fun rule504(): ContractRule = ContractRule(kind = "integer", minimum = 20.0, maximum = 40.0)
    private fun rule505(): ContractRule = ContractRule(oneOf = listOf(rule506(), rule511(), rule518(), rule524(), rule529(), rule534(), rule539(), rule545(), rule550(), rule556(), rule561(), rule567(), rule572(), rule577(), rule582(), rule588()))
    private fun rule506(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule507(), "request_id" to rule15(), "generation" to rule508(), "method" to rule509(), "params" to rule510()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule507(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule508(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule509(): ContractRule = ContractRule(constant = WireConstant("capabilities.get"))
    private fun rule510(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule511(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule512(), "request_id" to rule15(), "generation" to rule513(), "method" to rule514(), "params" to rule515()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule512(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule513(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule514(): ContractRule = ContractRule(constant = WireConstant("permissions.request"))
    private fun rule515(): ContractRule = ContractRule(kind = "object", properties = mapOf("permission" to rule516(), "purpose" to rule517()), required = setOf("permission", "purpose"), additionalProperties = false)
    private fun rule516(): ContractRule = ContractRule(kind = "string", choices = listOf("screen_capture", "camera", "microphone", "overlay", "notifications"))
    private fun rule517(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 200)
    private fun rule518(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule519(), "request_id" to rule15(), "generation" to rule520(), "method" to rule521(), "params" to rule522()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule519(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule520(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule521(): ContractRule = ContractRule(constant = WireConstant("capture.start"))
    private fun rule522(): ContractRule = ContractRule(kind = "object", properties = mapOf("purpose" to rule523(), "consent_id" to rule15()), required = setOf("purpose", "consent_id"), additionalProperties = false)
    private fun rule523(): ContractRule = ContractRule(kind = "string", choices = listOf("teaching", "assistance"))
    private fun rule524(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule525(), "request_id" to rule15(), "generation" to rule526(), "method" to rule527(), "params" to rule528()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule525(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule526(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule527(): ContractRule = ContractRule(constant = WireConstant("capture.stop"))
    private fun rule528(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule529(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule530(), "request_id" to rule15(), "generation" to rule531(), "method" to rule532(), "params" to rule533()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule530(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule531(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule532(): ContractRule = ContractRule(constant = WireConstant("camera.start"))
    private fun rule533(): ContractRule = ContractRule(kind = "object", properties = mapOf("consent_id" to rule15()), required = setOf("consent_id"), additionalProperties = false)
    private fun rule534(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule535(), "request_id" to rule15(), "generation" to rule536(), "method" to rule537(), "params" to rule538()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule535(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule536(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule537(): ContractRule = ContractRule(constant = WireConstant("camera.stop"))
    private fun rule538(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule539(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule540(), "request_id" to rule15(), "generation" to rule541(), "method" to rule542(), "params" to rule543()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule540(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule541(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule542(): ContractRule = ContractRule(constant = WireConstant("audio.start"))
    private fun rule543(): ContractRule = ContractRule(kind = "object", properties = mapOf("purpose" to rule544(), "consent_id" to rule15()), required = setOf("purpose", "consent_id"), additionalProperties = false)
    private fun rule544(): ContractRule = ContractRule(kind = "string", choices = listOf("question", "assistance"))
    private fun rule545(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule546(), "request_id" to rule15(), "generation" to rule547(), "method" to rule548(), "params" to rule549()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule546(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule547(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule548(): ContractRule = ContractRule(constant = WireConstant("audio.stop"))
    private fun rule549(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule550(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule551(), "request_id" to rule15(), "generation" to rule552(), "method" to rule553(), "params" to rule554()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule551(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule552(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule553(): ContractRule = ContractRule(constant = WireConstant("overlay.present"))
    private fun rule554(): ContractRule = ContractRule(kind = "object", properties = mapOf("step_id" to rule15(), "safe_handle" to rule15(), "frame_context" to rule555(), "target" to rule402(), "expires_at" to rule23()), required = setOf("step_id", "safe_handle", "frame_context", "target", "expires_at"), additionalProperties = false)
    private fun rule555(): ContractRule = ContractRule(reference = "FrameContextDto")
    private fun rule556(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule557(), "request_id" to rule15(), "generation" to rule558(), "method" to rule559(), "params" to rule560()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule557(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule558(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule559(): ContractRule = ContractRule(constant = WireConstant("overlay.clear"))
    private fun rule560(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule561(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule562(), "request_id" to rule15(), "generation" to rule563(), "method" to rule564(), "params" to rule565()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule562(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule563(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule564(): ContractRule = ContractRule(constant = WireConstant("notifications.schedule"))
    private fun rule565(): ContractRule = ContractRule(kind = "object", properties = mapOf("todo_id" to rule15(), "instance_id" to rule15(), "planned_at" to rule23(), "schedule_revision" to rule566()), required = setOf("todo_id", "instance_id", "planned_at", "schedule_revision"), additionalProperties = false)
    private fun rule566(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule567(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule568(), "request_id" to rule15(), "generation" to rule569(), "method" to rule570(), "params" to rule571()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule568(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule569(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule570(): ContractRule = ContractRule(constant = WireConstant("notifications.cancel"))
    private fun rule571(): ContractRule = ContractRule(kind = "object", properties = mapOf("instance_id" to rule15()), required = setOf("instance_id"), additionalProperties = false)
    private fun rule572(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule573(), "request_id" to rule15(), "generation" to rule574(), "method" to rule575(), "params" to rule576()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule573(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule574(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule575(): ContractRule = ContractRule(constant = WireConstant("storage.notes.read"))
    private fun rule576(): ContractRule = ContractRule(kind = "object", properties = mapOf("account_partition" to rule15()), required = setOf("account_partition"), additionalProperties = false)
    private fun rule577(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule578(), "request_id" to rule15(), "generation" to rule579(), "method" to rule580(), "params" to rule581()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule578(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule579(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule580(): ContractRule = ContractRule(constant = WireConstant("storage.drawing.read"))
    private fun rule581(): ContractRule = ContractRule(kind = "object", properties = mapOf("draft_id" to rule15()), required = setOf("draft_id"), additionalProperties = false)
    private fun rule582(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule583(), "request_id" to rule15(), "generation" to rule584(), "method" to rule585(), "params" to rule586()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule583(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule584(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule585(): ContractRule = ContractRule(constant = WireConstant("assets.import"))
    private fun rule586(): ContractRule = ContractRule(kind = "object", properties = mapOf("local_file_handle" to rule15(), "kind" to rule587()), required = setOf("local_file_handle", "kind"), additionalProperties = false)
    private fun rule587(): ContractRule = ContractRule(kind = "string", choices = listOf("vrm", "fbx", "glb"))
    private fun rule588(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule589(), "request_id" to rule15(), "generation" to rule590(), "method" to rule591(), "params" to rule592()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule589(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule590(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule591(): ContractRule = ContractRule(constant = WireConstant("assets.preview"))
    private fun rule592(): ContractRule = ContractRule(kind = "object", properties = mapOf("asset_handle" to rule15()), required = setOf("asset_handle"), additionalProperties = false)
    private fun rule593(): ContractRule = ContractRule(oneOf = listOf(rule594(), rule601()))
    private fun rule594(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "generation" to rule595(), "ok" to rule596(), "result" to rule597()), required = setOf("request_id", "generation", "ok", "result"), additionalProperties = false)
    private fun rule595(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule596(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule597(): ContractRule = ContractRule(kind = "object", properties = mapOf("state" to rule598(), "safe_handle" to rule599()), required = setOf("state", "safe_handle"), additionalProperties = false)
    private fun rule598(): ContractRule = ContractRule(kind = "string", choices = listOf("system_pending", "stopped", "unsupported", "ready"))
    private fun rule599(): ContractRule = ContractRule(anyOf = listOf(rule15(), rule600()))
    private fun rule600(): ContractRule = ContractRule(kind = "null")
    private fun rule601(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "generation" to rule602(), "ok" to rule603(), "error" to rule604()), required = setOf("request_id", "generation", "ok", "error"), additionalProperties = false)
    private fun rule602(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule603(): ContractRule = ContractRule(constant = WireConstant(false))
    private fun rule604(): ContractRule = ContractRule(kind = "object", properties = mapOf("code" to rule605(), "message" to rule606()), required = setOf("code", "message"), additionalProperties = false)
    private fun rule605(): ContractRule = ContractRule(kind = "string", choices = listOf("PERMISSION_DENIED", "CANCELLED", "TARGET_STALE", "PROVIDER_UNAVAILABLE"))
    private fun rule606(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 320)
    private fun rule607(): ContractRule = ContractRule(kind = "string", choices = listOf("AUTH_FAILED", "AUTH_EXPIRED", "SCOPE_DENIED", "CONSENT_REQUIRED", "PERMISSION_DENIED", "RISK_PAUSED", "TARGET_STALE", "LOW_CONFIDENCE", "NEED_TIME_CONFIRMATION", "VERSION_CONFLICT", "RATE_LIMITED", "PROVIDER_UNAVAILABLE", "CANCELLED", "TIMEOUT", "NETWORK_OFFLINE", "STREAM_INTERRUPTED", "INVALID_REQUEST", "PARTIAL_FAILURE", "INVITE_EXPIRED"))
    private fun rule608(): ContractRule = ContractRule(kind = "object", properties = mapOf("error" to rule609(), "request_id" to rule15(), "schema_version" to rule615()), required = setOf("error", "request_id", "schema_version"), additionalProperties = false)
    private fun rule609(): ContractRule = ContractRule(kind = "object", properties = mapOf("code" to rule610(), "message" to rule611(), "retryable" to rule612(), "details" to rule613()), required = setOf("code", "message", "retryable"), additionalProperties = false)
    private fun rule610(): ContractRule = ContractRule(kind = "string", choices = listOf("AUTH_FAILED", "AUTH_EXPIRED", "SCOPE_DENIED", "CONSENT_REQUIRED", "PERMISSION_DENIED", "RISK_PAUSED", "TARGET_STALE", "LOW_CONFIDENCE", "NEED_TIME_CONFIRMATION", "VERSION_CONFLICT", "RATE_LIMITED", "PROVIDER_UNAVAILABLE", "CANCELLED", "TIMEOUT", "NETWORK_OFFLINE", "STREAM_INTERRUPTED", "INVALID_REQUEST", "PARTIAL_FAILURE", "INVITE_EXPIRED"))
    private fun rule611(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 320)
    private fun rule612(): ContractRule = ContractRule(kind = "boolean")
    private fun rule613(): ContractRule = ContractRule(kind = "object", properties = mapOf("current_version" to rule614(), "conflict_id" to rule15()), required = setOf("current_version", "conflict_id"), additionalProperties = false)
    private fun rule614(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule615(): ContractRule = ContractRule(constant = WireConstant("0.2.0"))
}
