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
        "StandaloneGuidanceRect" to rule402(),
        "StandaloneGuidanceElement" to rule407(),
        "StandaloneGuidanceImage" to rule411(),
        "StandaloneGuidancePreviousStep" to rule414(),
        "StandaloneGuidanceReviewProposal" to rule418(),
        "StandaloneGuidanceAnalyzeRequest" to rule422(),
        "StandaloneGuidanceAnalyzeRequestTriggerReason" to rule425(),
        "StandaloneGuidanceResult" to rule439(),
        "StandaloneGuidanceResultVariant1" to rule440(),
        "StandaloneGuidanceResultVariant1Presentation" to rule443(),
        "StandaloneGuidanceResultVariant2" to rule444(),
        "StandaloneGuidanceResultVariant3" to rule450(),
        "StandaloneGuidanceResultVariant4" to rule453(),
        "StandaloneGuidanceErrorCode" to rule456(),
        "NormalizedRect" to rule457(),
        "ServiceStreamEvent" to rule462(),
        "ServiceStreamEventResponseStarted" to rule463(),
        "ServiceStreamEventResponseStartedPayload" to rule467(),
        "ServiceStreamEventCaptionSegment" to rule468(),
        "ServiceStreamEventCaptionSegmentPayload" to rule470(),
        "ServiceStreamEventResponseCompleted" to rule473(),
        "ServiceStreamEventResponseCompletedPayload" to rule475(),
        "ServiceStreamEventResponseCancelled" to rule477(),
        "ServiceStreamEventResponseCancelledPayload" to rule479(),
        "ServiceStreamEventResponseCancelledPayloadReason" to rule480(),
        "ServiceStreamEventResponseFailed" to rule481(),
        "ServiceStreamEventResponseFailedPayload" to rule483(),
        "ServiceStreamEventResponseFailedPayloadCode" to rule484(),
        "ServiceStreamEventGuidanceStep" to rule485(),
        "ServiceStreamEventGuidanceStepPayload" to rule487(),
        "ServiceStreamEventGuidanceStepPayloadTarget" to rule457(),
        "ServiceStreamEventGuidanceRisk" to rule490(),
        "ServiceStreamEventGuidanceRiskPayload" to rule492(),
        "ServiceStreamEventGuidanceRiskPayloadRisk" to rule493(),
        "ServiceStreamEventGuidanceRiskPayloadAction" to rule494(),
        "ServiceStreamEventGuidanceLowConfidence" to rule495(),
        "ServiceStreamEventGuidanceLowConfidencePayload" to rule497(),
        "ServiceStreamEventGuidanceCompleted" to rule499(),
        "ServiceStreamEventGuidanceCompletedPayload" to rule501(),
        "ServiceStreamEventPetJobProgress" to rule502(),
        "ServiceStreamEventPetJobProgressPayload" to rule504(),
        "ServiceStreamEventPetJobProgressPayloadStatus" to rule505(),
        "ServiceStreamEventPetJobSucceeded" to rule507(),
        "ServiceStreamEventPetJobSucceededPayload" to rule509(),
        "ServiceStreamEventPetJobFailed" to rule512(),
        "ServiceStreamEventPetJobFailedPayload" to rule514(),
        "ServiceStreamEventPetJobFailedPayloadCode" to rule515(),
        "AssistSignal" to rule516(),
        "AssistSignalInvite" to rule517(),
        "AssistSignalInvitePayload" to rule519(),
        "AssistSignalAccept" to rule521(),
        "AssistSignalAcceptPayload" to rule523(),
        "AssistSignalOffer" to rule525(),
        "AssistSignalOfferPayload" to rule527(),
        "AssistSignalAnswer" to rule530(),
        "AssistSignalAnswerPayload" to rule532(),
        "AssistSignalIce" to rule535(),
        "AssistSignalIcePayload" to rule537(),
        "AssistSignalRiskPause" to rule540(),
        "AssistSignalRiskPausePayload" to rule542(),
        "AssistSignalRiskPausePayloadReason" to rule545(),
        "AssistSignalConsentRevoked" to rule546(),
        "AssistSignalConsentRevokedPayload" to rule548(),
        "AssistSignalEnd" to rule550(),
        "AssistSignalEndPayload" to rule552(),
        "AssistSignalEndPayloadReason" to rule553(),
        "VoiceFrameHeader" to rule554(),
        "VoiceFrameHeaderCodec" to rule557(),
        "BridgeRequestV1" to rule560(),
        "BridgeRequestV1CapabilitiesGet" to rule561(),
        "BridgeRequestV1CapabilitiesGetParams" to rule565(),
        "BridgeRequestV1PermissionsRequest" to rule566(),
        "BridgeRequestV1PermissionsRequestParams" to rule570(),
        "BridgeRequestV1PermissionsRequestParamsPermission" to rule571(),
        "BridgeRequestV1CaptureStart" to rule573(),
        "BridgeRequestV1CaptureStartParams" to rule577(),
        "BridgeRequestV1CaptureStartParamsPurpose" to rule578(),
        "BridgeRequestV1CaptureStop" to rule579(),
        "BridgeRequestV1CaptureStopParams" to rule583(),
        "BridgeRequestV1CameraStart" to rule584(),
        "BridgeRequestV1CameraStartParams" to rule588(),
        "BridgeRequestV1CameraStop" to rule589(),
        "BridgeRequestV1CameraStopParams" to rule593(),
        "BridgeRequestV1AudioStart" to rule594(),
        "BridgeRequestV1AudioStartParams" to rule598(),
        "BridgeRequestV1AudioStartParamsPurpose" to rule599(),
        "BridgeRequestV1AudioStop" to rule600(),
        "BridgeRequestV1AudioStopParams" to rule604(),
        "BridgeRequestV1OverlayPresent" to rule605(),
        "BridgeRequestV1OverlayPresentParams" to rule609(),
        "BridgeRequestV1OverlayPresentParamsTarget" to rule457(),
        "BridgeRequestV1OverlayClear" to rule611(),
        "BridgeRequestV1OverlayClearParams" to rule615(),
        "BridgeRequestV1NotificationsSchedule" to rule616(),
        "BridgeRequestV1NotificationsScheduleParams" to rule620(),
        "BridgeRequestV1NotificationsCancel" to rule622(),
        "BridgeRequestV1NotificationsCancelParams" to rule626(),
        "BridgeRequestV1StorageNotesRead" to rule627(),
        "BridgeRequestV1StorageNotesReadParams" to rule631(),
        "BridgeRequestV1StorageDrawingRead" to rule632(),
        "BridgeRequestV1StorageDrawingReadParams" to rule636(),
        "BridgeRequestV1AssetsImport" to rule637(),
        "BridgeRequestV1AssetsImportParams" to rule641(),
        "BridgeRequestV1AssetsImportParamsKind" to rule642(),
        "BridgeRequestV1AssetsPreview" to rule643(),
        "BridgeRequestV1AssetsPreviewParams" to rule647(),
        "BridgeReplyV1" to rule648(),
        "BridgeReplyV1True" to rule649(),
        "BridgeReplyV1TrueResult" to rule652(),
        "BridgeReplyV1TrueResultState" to rule653(),
        "BridgeReplyV1False" to rule656(),
        "BridgeReplyV1FalseError" to rule659(),
        "BridgeReplyV1FalseErrorCode" to rule660(),
        "ServiceErrorCode" to rule662(),
        "ErrorEnvelope" to rule663(),
        "ErrorEnvelopeError" to rule664(),
        "ErrorEnvelopeErrorCode" to rule665(),
        "ErrorEnvelopeErrorDetails" to rule668(),
        "StandaloneGuidanceErrorEnvelope" to rule671(),
        "StandaloneGuidanceErrorEnvelopeError" to rule664(),
        "StandaloneGuidanceErrorEnvelopeErrorCode" to rule665(),
        "StandaloneGuidanceErrorEnvelopeErrorDetails" to rule668()
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
    private fun rule403(): ContractRule = ContractRule(kind = "number", minimum = 0.0, maximum = 4096.0)
    private fun rule404(): ContractRule = ContractRule(kind = "number", minimum = 0.0, maximum = 4096.0)
    private fun rule405(): ContractRule = ContractRule(kind = "number", exclusiveMinimum = 0.0, maximum = 4096.0)
    private fun rule406(): ContractRule = ContractRule(kind = "number", exclusiveMinimum = 0.0, maximum = 4096.0)
    private fun rule407(): ContractRule = ContractRule(kind = "object", properties = mapOf("id" to rule408(), "label" to rule409(), "rect" to rule410()), required = setOf("id", "label", "rect"), additionalProperties = false)
    private fun rule408(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 128, pattern = "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\$")
    private fun rule409(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 48, pattern = "\\S")
    private fun rule410(): ContractRule = ContractRule(reference = "StandaloneGuidanceRect")
    private fun rule411(): ContractRule = ContractRule(kind = "object", properties = mapOf("mime" to rule412(), "base64" to rule413()), required = setOf("mime", "base64"), additionalProperties = false)
    private fun rule412(): ContractRule = ContractRule(constant = WireConstant("image/png"))
    private fun rule413(): ContractRule = ContractRule(kind = "string", minLength = 76, maxLength = 2700000, pattern = "^(?=iVBORw0KGgo)(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/][AQgw]==|[A-Za-z0-9+/]{2}[AEIMQUYcgkosw048]=)?\$")
    private fun rule414(): ContractRule = ContractRule(kind = "object", properties = mapOf("instruction" to rule415(), "expected_labels" to rule416()), required = setOf("instruction", "expected_labels"), additionalProperties = false)
    private fun rule415(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 600, pattern = "\\S")
    private fun rule416(): ContractRule = ContractRule(kind = "array", items = rule417(), minItems = 0, maxItems = 16)
    private fun rule417(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 48, pattern = "\\S")
    private fun rule418(): ContractRule = ContractRule(kind = "object", properties = mapOf("remind_at" to rule419(), "timezone" to rule420(), "reason" to rule421()), required = setOf("remind_at", "timezone", "reason"), additionalProperties = false)
    private fun rule419(): ContractRule = ContractRule(kind = "string", pattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-](?:(?:0\\d|1[0-3]):[0-5]\\d|14:00))\$", format = "date-time")
    private fun rule420(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 64, format = "iana-timezone")
    private fun rule421(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 240, pattern = "\\S")
    private fun rule422(): ContractRule = ContractRule(kind = "object", properties = mapOf("observation_id" to rule408(), "guide_id" to rule408(), "observation_generation" to rule423(), "task_generation" to rule424(), "trigger_id" to rule408(), "frame_id" to rule408(), "trigger_reason" to rule425(), "frame_hash" to rule426(), "sanitized_sha256" to rule426(), "captured_at" to rule419(), "image" to rule427(), "redaction_profile" to rule428(), "local_safety" to rule429(), "question" to rule430(), "elements" to rule431(), "previous_step" to rule433()), required = setOf("observation_id", "guide_id", "observation_generation", "task_generation", "trigger_id", "frame_id", "trigger_reason", "frame_hash", "sanitized_sha256", "captured_at", "image", "redaction_profile", "local_safety", "question", "elements"), additionalProperties = false, anyOf = listOf(rule434(), rule437()))
    private fun rule423(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule424(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule425(): ContractRule = ContractRule(kind = "string", choices = listOf("question", "page_changed", "verification"))
    private fun rule426(): ContractRule = ContractRule(kind = "string", minLength = 64, maxLength = 64, pattern = "^[a-fA-F0-9]{64}\$")
    private fun rule427(): ContractRule = ContractRule(reference = "StandaloneGuidanceImage")
    private fun rule428(): ContractRule = ContractRule(constant = WireConstant("all_text_and_faces_v1"))
    private fun rule429(): ContractRule = ContractRule(constant = WireConstant("safe"))
    private fun rule430(): ContractRule = ContractRule(kind = "string", minLength = 0, maxLength = 2000)
    private fun rule431(): ContractRule = ContractRule(kind = "array", items = rule432(), minItems = 0, maxItems = 80)
    private fun rule432(): ContractRule = ContractRule(reference = "StandaloneGuidanceElement")
    private fun rule433(): ContractRule = ContractRule(reference = "StandaloneGuidancePreviousStep")
    private fun rule434(): ContractRule = ContractRule(kind = "object", properties = mapOf("trigger_reason" to rule435(), "question" to rule436()), required = setOf("trigger_reason", "question"))
    private fun rule435(): ContractRule = ContractRule(constant = WireConstant("question"))
    private fun rule436(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 2000, pattern = "\\S")
    private fun rule437(): ContractRule = ContractRule(kind = "object", properties = mapOf("trigger_reason" to rule438()), required = setOf("trigger_reason"))
    private fun rule438(): ContractRule = ContractRule(kind = "string", choices = listOf("page_changed", "verification"))
    private fun rule439(): ContractRule = ContractRule(oneOf = listOf(rule440(), rule444(), rule450(), rule453()))
    private fun rule440(): ContractRule = ContractRule(kind = "object", properties = mapOf("observation_id" to rule408(), "guide_id" to rule408(), "observation_generation" to rule423(), "task_generation" to rule424(), "trigger_id" to rule408(), "frame_id" to rule408(), "kind" to rule441(), "instruction" to rule442(), "target_id" to rule408(), "presentation" to rule443(), "expected_labels" to rule416(), "evidence_labels" to rule416()), required = setOf("observation_id", "guide_id", "observation_generation", "task_generation", "trigger_id", "frame_id", "kind", "instruction"), additionalProperties = false, dependentRequired = mapOf("target_id" to setOf("presentation"), "presentation" to setOf("target_id")))
    private fun rule441(): ContractRule = ContractRule(constant = WireConstant("step"))
    private fun rule442(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 600, pattern = "\\S")
    private fun rule443(): ContractRule = ContractRule(kind = "string", choices = listOf("confirmed", "uncertain_candidate"))
    private fun rule444(): ContractRule = ContractRule(kind = "object", properties = mapOf("observation_id" to rule408(), "guide_id" to rule408(), "observation_generation" to rule423(), "task_generation" to rule424(), "trigger_id" to rule408(), "frame_id" to rule408(), "kind" to rule445(), "instruction" to rule446(), "evidence_labels" to rule447(), "review_proposal" to rule449()), required = setOf("observation_id", "guide_id", "observation_generation", "task_generation", "trigger_id", "frame_id", "kind", "instruction", "evidence_labels"), additionalProperties = false)
    private fun rule445(): ContractRule = ContractRule(constant = WireConstant("completed"))
    private fun rule446(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 600, pattern = "\\S")
    private fun rule447(): ContractRule = ContractRule(kind = "array", items = rule448(), minItems = 1, maxItems = 16)
    private fun rule448(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 48, pattern = "\\S")
    private fun rule449(): ContractRule = ContractRule(reference = "StandaloneGuidanceReviewProposal")
    private fun rule450(): ContractRule = ContractRule(kind = "object", properties = mapOf("observation_id" to rule408(), "guide_id" to rule408(), "observation_generation" to rule423(), "task_generation" to rule424(), "trigger_id" to rule408(), "frame_id" to rule408(), "kind" to rule451(), "instruction" to rule452()), required = setOf("observation_id", "guide_id", "observation_generation", "task_generation", "trigger_id", "frame_id", "kind", "instruction"), additionalProperties = false)
    private fun rule451(): ContractRule = ContractRule(constant = WireConstant("clarify"))
    private fun rule452(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 600, pattern = "\\S")
    private fun rule453(): ContractRule = ContractRule(kind = "object", properties = mapOf("observation_id" to rule408(), "guide_id" to rule408(), "observation_generation" to rule423(), "task_generation" to rule424(), "trigger_id" to rule408(), "frame_id" to rule408(), "kind" to rule454(), "instruction" to rule455()), required = setOf("observation_id", "guide_id", "observation_generation", "task_generation", "trigger_id", "frame_id", "kind", "instruction"), additionalProperties = false)
    private fun rule454(): ContractRule = ContractRule(constant = WireConstant("unsupported"))
    private fun rule455(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 600, pattern = "\\S")
    private fun rule456(): ContractRule = ContractRule(kind = "string", choices = listOf("GUIDANCE_AUTH_REQUIRED", "GUIDANCE_INVALID_REQUEST", "GUIDANCE_UNSAFE_REQUEST", "GUIDANCE_UNAVAILABLE", "GUIDANCE_PROVIDER_FAILURE", "GUIDANCE_INVALID_PROVIDER_RESPONSE", "GUIDANCE_UNSAFE_PROVIDER_RESPONSE", "GUIDANCE_ABORTED", "GUIDANCE_TIMEOUT"))
    private fun rule457(): ContractRule = ContractRule(kind = "object", properties = mapOf("x" to rule458(), "y" to rule459(), "width" to rule460(), "height" to rule461()), required = setOf("x", "y", "width", "height"), additionalProperties = false)
    private fun rule458(): ContractRule = ContractRule(kind = "number", minimum = 0.0, maximum = 1.0)
    private fun rule459(): ContractRule = ContractRule(kind = "number", minimum = 0.0, maximum = 1.0)
    private fun rule460(): ContractRule = ContractRule(kind = "number", exclusiveMinimum = 0.0, maximum = 1.0)
    private fun rule461(): ContractRule = ContractRule(kind = "number", exclusiveMinimum = 0.0, maximum = 1.0)
    private fun rule462(): ContractRule = ContractRule(oneOf = listOf(rule463(), rule468(), rule473(), rule477(), rule481(), rule485(), rule490(), rule495(), rule499(), rule502(), rule507(), rule512()))
    private fun rule463(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule466(), "payload" to rule467()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule464(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule465(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule466(): ContractRule = ContractRule(constant = WireConstant("response.started"))
    private fun rule467(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule468(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule469(), "payload" to rule470()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule469(): ContractRule = ContractRule(constant = WireConstant("caption.segment"))
    private fun rule470(): ContractRule = ContractRule(kind = "object", properties = mapOf("segment_id" to rule15(), "index" to rule471(), "text" to rule472()), required = setOf("segment_id", "index", "text"), additionalProperties = false)
    private fun rule471(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule472(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 4000)
    private fun rule473(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule474(), "payload" to rule475()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule474(): ContractRule = ContractRule(constant = WireConstant("response.completed"))
    private fun rule475(): ContractRule = ContractRule(kind = "object", properties = mapOf("final_segment_count" to rule476()), required = setOf("final_segment_count"), additionalProperties = false)
    private fun rule476(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 1000.0)
    private fun rule477(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule478(), "payload" to rule479()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule478(): ContractRule = ContractRule(constant = WireConstant("response.cancelled"))
    private fun rule479(): ContractRule = ContractRule(kind = "object", properties = mapOf("reason" to rule480()), required = setOf("reason"), additionalProperties = false)
    private fun rule480(): ContractRule = ContractRule(kind = "string", choices = listOf("user_stop", "risk", "permission_revoked", "consent_revoked"))
    private fun rule481(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule482(), "payload" to rule483()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule482(): ContractRule = ContractRule(constant = WireConstant("response.failed"))
    private fun rule483(): ContractRule = ContractRule(kind = "object", properties = mapOf("code" to rule484(), "retryable" to rule9()), required = setOf("code", "retryable"), additionalProperties = false)
    private fun rule484(): ContractRule = ContractRule(kind = "string", choices = listOf("TIMEOUT", "RATE_LIMITED", "PROVIDER_UNAVAILABLE"))
    private fun rule485(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule486(), "payload" to rule487()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule486(): ContractRule = ContractRule(constant = WireConstant("guidance.step"))
    private fun rule487(): ContractRule = ContractRule(kind = "object", properties = mapOf("step_id" to rule15(), "instruction" to rule488(), "frame_context" to rule489(), "target" to rule457(), "expires_at" to rule23()), required = setOf("step_id", "instruction", "frame_context", "target", "expires_at"), additionalProperties = false)
    private fun rule488(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 500)
    private fun rule489(): ContractRule = ContractRule(reference = "FrameContextDto")
    private fun rule490(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule491(), "payload" to rule492()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule491(): ContractRule = ContractRule(constant = WireConstant("guidance.risk"))
    private fun rule492(): ContractRule = ContractRule(kind = "object", properties = mapOf("risk" to rule493(), "action" to rule494()), required = setOf("risk", "action"), additionalProperties = false)
    private fun rule493(): ContractRule = ContractRule(kind = "string", choices = listOf("private", "transaction", "unknown", "detector_failure"))
    private fun rule494(): ContractRule = ContractRule(kind = "string", choices = listOf("pause_all_related", "stop_teaching_and_media"))
    private fun rule495(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule496(), "payload" to rule497()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule496(): ContractRule = ContractRule(constant = WireConstant("guidance.low_confidence"))
    private fun rule497(): ContractRule = ContractRule(kind = "object", properties = mapOf("action" to rule498()), required = setOf("action"), additionalProperties = false)
    private fun rule498(): ContractRule = ContractRule(constant = WireConstant("request_help"))
    private fun rule499(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule500(), "payload" to rule501()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule500(): ContractRule = ContractRule(constant = WireConstant("guidance.completed"))
    private fun rule501(): ContractRule = ContractRule(kind = "object", properties = mapOf("verification_id" to rule15()), required = setOf("verification_id"), additionalProperties = false)
    private fun rule502(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule503(), "payload" to rule504()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule503(): ContractRule = ContractRule(constant = WireConstant("pet_job.progress"))
    private fun rule504(): ContractRule = ContractRule(kind = "object", properties = mapOf("status" to rule505(), "progress" to rule506()), required = setOf("status", "progress"), additionalProperties = false)
    private fun rule505(): ContractRule = ContractRule(kind = "string", choices = listOf("queued", "processing"))
    private fun rule506(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 99.0)
    private fun rule507(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule508(), "payload" to rule509()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule508(): ContractRule = ContractRule(constant = WireConstant("pet_job.succeeded"))
    private fun rule509(): ContractRule = ContractRule(kind = "object", properties = mapOf("assets" to rule510()), required = setOf("assets"), additionalProperties = false)
    private fun rule510(): ContractRule = ContractRule(kind = "array", items = rule511(), minItems = 1, maxItems = 8)
    private fun rule511(): ContractRule = ContractRule(reference = "AssetDto")
    private fun rule512(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule513(), "payload" to rule514()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule513(): ContractRule = ContractRule(constant = WireConstant("pet_job.failed"))
    private fun rule514(): ContractRule = ContractRule(kind = "object", properties = mapOf("code" to rule515()), required = setOf("code"), additionalProperties = false)
    private fun rule515(): ContractRule = ContractRule(kind = "string", choices = listOf("PROVIDER_UNAVAILABLE", "RATE_LIMITED", "CANCELLED"))
    private fun rule516(): ContractRule = ContractRule(oneOf = listOf(rule517(), rule521(), rule525(), rule530(), rule535(), rule540(), rule546(), rule550()))
    private fun rule517(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule518(), "payload" to rule519()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule518(): ContractRule = ContractRule(constant = WireConstant("invite"))
    private fun rule519(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "expires_at" to rule23(), "grant_revision" to rule520()), required = setOf("assist_id", "expires_at", "grant_revision"), additionalProperties = false)
    private fun rule520(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule521(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule522(), "payload" to rule523()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule522(): ContractRule = ContractRule(constant = WireConstant("accept"))
    private fun rule523(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "grant_revision" to rule524()), required = setOf("assist_id", "grant_revision"), additionalProperties = false)
    private fun rule524(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule525(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule526(), "payload" to rule527()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule526(): ContractRule = ContractRule(constant = WireConstant("offer"))
    private fun rule527(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "sdp" to rule528(), "grant_revision" to rule529()), required = setOf("assist_id", "sdp", "grant_revision"), additionalProperties = false)
    private fun rule528(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 65536, pattern = "^v=0\\r?\\n")
    private fun rule529(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule530(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule531(), "payload" to rule532()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule531(): ContractRule = ContractRule(constant = WireConstant("answer"))
    private fun rule532(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "sdp" to rule533(), "grant_revision" to rule534()), required = setOf("assist_id", "sdp", "grant_revision"), additionalProperties = false)
    private fun rule533(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 65536, pattern = "^v=0\\r?\\n")
    private fun rule534(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule535(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule536(), "payload" to rule537()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule536(): ContractRule = ContractRule(constant = WireConstant("ice"))
    private fun rule537(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "candidate" to rule538(), "grant_revision" to rule539()), required = setOf("assist_id", "candidate", "grant_revision"), additionalProperties = false)
    private fun rule538(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 2048, pattern = "^candidate:")
    private fun rule539(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule540(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule541(), "payload" to rule542()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule541(): ContractRule = ContractRule(constant = WireConstant("risk.pause"))
    private fun rule542(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "screen_paused" to rule543(), "audio_paused" to rule544(), "reason" to rule545()), required = setOf("assist_id", "screen_paused", "audio_paused", "reason"), additionalProperties = false)
    private fun rule543(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule544(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule545(): ContractRule = ContractRule(kind = "string", choices = listOf("transaction", "private", "unknown", "detector_failure"))
    private fun rule546(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule547(), "payload" to rule548()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule547(): ContractRule = ContractRule(constant = WireConstant("consent.revoked"))
    private fun rule548(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "consent_id" to rule15(), "grant_revision" to rule549()), required = setOf("assist_id", "consent_id", "grant_revision"), additionalProperties = false)
    private fun rule549(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule550(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "session_id" to rule15(), "event_id" to rule15(), "seq" to rule464(), "generation" to rule465(), "type" to rule551(), "payload" to rule552()), required = setOf("request_id", "session_id", "event_id", "seq", "generation", "type", "payload"), additionalProperties = false)
    private fun rule551(): ContractRule = ContractRule(constant = WireConstant("end"))
    private fun rule552(): ContractRule = ContractRule(kind = "object", properties = mapOf("assist_id" to rule15(), "reason" to rule553()), required = setOf("assist_id", "reason"), additionalProperties = false)
    private fun rule553(): ContractRule = ContractRule(kind = "string", choices = listOf("user_stop", "expired", "permission_revoked", "consent_revoked", "disconnected"))
    private fun rule554(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "generation" to rule555(), "seq" to rule556(), "codec" to rule557(), "byte_length" to rule558(), "duration_ms" to rule559()), required = setOf("request_id", "generation", "seq", "codec", "byte_length", "duration_ms"), additionalProperties = false)
    private fun rule555(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule556(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule557(): ContractRule = ContractRule(kind = "string", choices = listOf("opus", "pcm_s16le"))
    private fun rule558(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 65536.0)
    private fun rule559(): ContractRule = ContractRule(kind = "integer", minimum = 20.0, maximum = 40.0)
    private fun rule560(): ContractRule = ContractRule(oneOf = listOf(rule561(), rule566(), rule573(), rule579(), rule584(), rule589(), rule594(), rule600(), rule605(), rule611(), rule616(), rule622(), rule627(), rule632(), rule637(), rule643()))
    private fun rule561(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule562(), "request_id" to rule15(), "generation" to rule563(), "method" to rule564(), "params" to rule565()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule562(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule563(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule564(): ContractRule = ContractRule(constant = WireConstant("capabilities.get"))
    private fun rule565(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule566(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule567(), "request_id" to rule15(), "generation" to rule568(), "method" to rule569(), "params" to rule570()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule567(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule568(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule569(): ContractRule = ContractRule(constant = WireConstant("permissions.request"))
    private fun rule570(): ContractRule = ContractRule(kind = "object", properties = mapOf("permission" to rule571(), "purpose" to rule572()), required = setOf("permission", "purpose"), additionalProperties = false)
    private fun rule571(): ContractRule = ContractRule(kind = "string", choices = listOf("screen_capture", "camera", "microphone", "overlay", "notifications"))
    private fun rule572(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 200)
    private fun rule573(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule574(), "request_id" to rule15(), "generation" to rule575(), "method" to rule576(), "params" to rule577()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule574(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule575(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule576(): ContractRule = ContractRule(constant = WireConstant("capture.start"))
    private fun rule577(): ContractRule = ContractRule(kind = "object", properties = mapOf("purpose" to rule578(), "consent_id" to rule15()), required = setOf("purpose", "consent_id"), additionalProperties = false)
    private fun rule578(): ContractRule = ContractRule(kind = "string", choices = listOf("teaching", "assistance"))
    private fun rule579(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule580(), "request_id" to rule15(), "generation" to rule581(), "method" to rule582(), "params" to rule583()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule580(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule581(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule582(): ContractRule = ContractRule(constant = WireConstant("capture.stop"))
    private fun rule583(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule584(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule585(), "request_id" to rule15(), "generation" to rule586(), "method" to rule587(), "params" to rule588()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule585(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule586(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule587(): ContractRule = ContractRule(constant = WireConstant("camera.start"))
    private fun rule588(): ContractRule = ContractRule(kind = "object", properties = mapOf("consent_id" to rule15()), required = setOf("consent_id"), additionalProperties = false)
    private fun rule589(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule590(), "request_id" to rule15(), "generation" to rule591(), "method" to rule592(), "params" to rule593()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule590(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule591(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule592(): ContractRule = ContractRule(constant = WireConstant("camera.stop"))
    private fun rule593(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule594(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule595(), "request_id" to rule15(), "generation" to rule596(), "method" to rule597(), "params" to rule598()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule595(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule596(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule597(): ContractRule = ContractRule(constant = WireConstant("audio.start"))
    private fun rule598(): ContractRule = ContractRule(kind = "object", properties = mapOf("purpose" to rule599(), "consent_id" to rule15()), required = setOf("purpose", "consent_id"), additionalProperties = false)
    private fun rule599(): ContractRule = ContractRule(kind = "string", choices = listOf("question", "assistance"))
    private fun rule600(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule601(), "request_id" to rule15(), "generation" to rule602(), "method" to rule603(), "params" to rule604()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule601(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule602(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule603(): ContractRule = ContractRule(constant = WireConstant("audio.stop"))
    private fun rule604(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule605(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule606(), "request_id" to rule15(), "generation" to rule607(), "method" to rule608(), "params" to rule609()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule606(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule607(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule608(): ContractRule = ContractRule(constant = WireConstant("overlay.present"))
    private fun rule609(): ContractRule = ContractRule(kind = "object", properties = mapOf("step_id" to rule15(), "safe_handle" to rule15(), "frame_context" to rule610(), "target" to rule457(), "expires_at" to rule23()), required = setOf("step_id", "safe_handle", "frame_context", "target", "expires_at"), additionalProperties = false)
    private fun rule610(): ContractRule = ContractRule(reference = "FrameContextDto")
    private fun rule611(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule612(), "request_id" to rule15(), "generation" to rule613(), "method" to rule614(), "params" to rule615()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule612(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule613(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule614(): ContractRule = ContractRule(constant = WireConstant("overlay.clear"))
    private fun rule615(): ContractRule = ContractRule(kind = "object", properties = mapOf(), additionalProperties = false)
    private fun rule616(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule617(), "request_id" to rule15(), "generation" to rule618(), "method" to rule619(), "params" to rule620()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule617(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule618(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule619(): ContractRule = ContractRule(constant = WireConstant("notifications.schedule"))
    private fun rule620(): ContractRule = ContractRule(kind = "object", properties = mapOf("todo_id" to rule15(), "instance_id" to rule15(), "planned_at" to rule23(), "schedule_revision" to rule621()), required = setOf("todo_id", "instance_id", "planned_at", "schedule_revision"), additionalProperties = false)
    private fun rule621(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule622(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule623(), "request_id" to rule15(), "generation" to rule624(), "method" to rule625(), "params" to rule626()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule623(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule624(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule625(): ContractRule = ContractRule(constant = WireConstant("notifications.cancel"))
    private fun rule626(): ContractRule = ContractRule(kind = "object", properties = mapOf("instance_id" to rule15()), required = setOf("instance_id"), additionalProperties = false)
    private fun rule627(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule628(), "request_id" to rule15(), "generation" to rule629(), "method" to rule630(), "params" to rule631()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule628(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule629(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule630(): ContractRule = ContractRule(constant = WireConstant("storage.notes.read"))
    private fun rule631(): ContractRule = ContractRule(kind = "object", properties = mapOf("account_partition" to rule15()), required = setOf("account_partition"), additionalProperties = false)
    private fun rule632(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule633(), "request_id" to rule15(), "generation" to rule634(), "method" to rule635(), "params" to rule636()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule633(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule634(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule635(): ContractRule = ContractRule(constant = WireConstant("storage.drawing.read"))
    private fun rule636(): ContractRule = ContractRule(kind = "object", properties = mapOf("draft_id" to rule15()), required = setOf("draft_id"), additionalProperties = false)
    private fun rule637(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule638(), "request_id" to rule15(), "generation" to rule639(), "method" to rule640(), "params" to rule641()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule638(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule639(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule640(): ContractRule = ContractRule(constant = WireConstant("assets.import"))
    private fun rule641(): ContractRule = ContractRule(kind = "object", properties = mapOf("local_file_handle" to rule15(), "kind" to rule642()), required = setOf("local_file_handle", "kind"), additionalProperties = false)
    private fun rule642(): ContractRule = ContractRule(kind = "string", choices = listOf("vrm", "fbx", "glb"))
    private fun rule643(): ContractRule = ContractRule(kind = "object", properties = mapOf("bridge_version" to rule644(), "request_id" to rule15(), "generation" to rule645(), "method" to rule646(), "params" to rule647()), required = setOf("bridge_version", "request_id", "generation", "method", "params"), additionalProperties = false)
    private fun rule644(): ContractRule = ContractRule(constant = WireConstant("1.0"))
    private fun rule645(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule646(): ContractRule = ContractRule(constant = WireConstant("assets.preview"))
    private fun rule647(): ContractRule = ContractRule(kind = "object", properties = mapOf("asset_handle" to rule15()), required = setOf("asset_handle"), additionalProperties = false)
    private fun rule648(): ContractRule = ContractRule(oneOf = listOf(rule649(), rule656()))
    private fun rule649(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "generation" to rule650(), "ok" to rule651(), "result" to rule652()), required = setOf("request_id", "generation", "ok", "result"), additionalProperties = false)
    private fun rule650(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule651(): ContractRule = ContractRule(constant = WireConstant(true))
    private fun rule652(): ContractRule = ContractRule(kind = "object", properties = mapOf("state" to rule653(), "safe_handle" to rule654()), required = setOf("state", "safe_handle"), additionalProperties = false)
    private fun rule653(): ContractRule = ContractRule(kind = "string", choices = listOf("system_pending", "stopped", "unsupported", "ready"))
    private fun rule654(): ContractRule = ContractRule(anyOf = listOf(rule15(), rule655()))
    private fun rule655(): ContractRule = ContractRule(kind = "null")
    private fun rule656(): ContractRule = ContractRule(kind = "object", properties = mapOf("request_id" to rule15(), "generation" to rule657(), "ok" to rule658(), "error" to rule659()), required = setOf("request_id", "generation", "ok", "error"), additionalProperties = false)
    private fun rule657(): ContractRule = ContractRule(kind = "integer", minimum = 0.0, maximum = 9007199254740991.0)
    private fun rule658(): ContractRule = ContractRule(constant = WireConstant(false))
    private fun rule659(): ContractRule = ContractRule(kind = "object", properties = mapOf("code" to rule660(), "message" to rule661()), required = setOf("code", "message"), additionalProperties = false)
    private fun rule660(): ContractRule = ContractRule(kind = "string", choices = listOf("PERMISSION_DENIED", "CANCELLED", "TARGET_STALE", "PROVIDER_UNAVAILABLE"))
    private fun rule661(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 320)
    private fun rule662(): ContractRule = ContractRule(kind = "string", choices = listOf("AUTH_FAILED", "AUTH_EXPIRED", "SCOPE_DENIED", "CONSENT_REQUIRED", "PERMISSION_DENIED", "RISK_PAUSED", "TARGET_STALE", "LOW_CONFIDENCE", "NEED_TIME_CONFIRMATION", "VERSION_CONFLICT", "RATE_LIMITED", "PROVIDER_UNAVAILABLE", "CANCELLED", "TIMEOUT", "NETWORK_OFFLINE", "STREAM_INTERRUPTED", "INVALID_REQUEST", "PARTIAL_FAILURE", "INVITE_EXPIRED", "GUIDANCE_AUTH_REQUIRED", "GUIDANCE_INVALID_REQUEST", "GUIDANCE_UNSAFE_REQUEST", "GUIDANCE_UNAVAILABLE", "GUIDANCE_PROVIDER_FAILURE", "GUIDANCE_INVALID_PROVIDER_RESPONSE", "GUIDANCE_UNSAFE_PROVIDER_RESPONSE", "GUIDANCE_ABORTED", "GUIDANCE_TIMEOUT"))
    private fun rule663(): ContractRule = ContractRule(kind = "object", properties = mapOf("error" to rule664(), "request_id" to rule15(), "schema_version" to rule670()), required = setOf("error", "request_id", "schema_version"), additionalProperties = false)
    private fun rule664(): ContractRule = ContractRule(kind = "object", properties = mapOf("code" to rule665(), "message" to rule666(), "retryable" to rule667(), "details" to rule668()), required = setOf("code", "message", "retryable"), additionalProperties = false)
    private fun rule665(): ContractRule = ContractRule(kind = "string", choices = listOf("AUTH_FAILED", "AUTH_EXPIRED", "SCOPE_DENIED", "CONSENT_REQUIRED", "PERMISSION_DENIED", "RISK_PAUSED", "TARGET_STALE", "LOW_CONFIDENCE", "NEED_TIME_CONFIRMATION", "VERSION_CONFLICT", "RATE_LIMITED", "PROVIDER_UNAVAILABLE", "CANCELLED", "TIMEOUT", "NETWORK_OFFLINE", "STREAM_INTERRUPTED", "INVALID_REQUEST", "PARTIAL_FAILURE", "INVITE_EXPIRED", "GUIDANCE_AUTH_REQUIRED", "GUIDANCE_INVALID_REQUEST", "GUIDANCE_UNSAFE_REQUEST", "GUIDANCE_UNAVAILABLE", "GUIDANCE_PROVIDER_FAILURE", "GUIDANCE_INVALID_PROVIDER_RESPONSE", "GUIDANCE_UNSAFE_PROVIDER_RESPONSE", "GUIDANCE_ABORTED", "GUIDANCE_TIMEOUT"))
    private fun rule666(): ContractRule = ContractRule(kind = "string", minLength = 1, maxLength = 320)
    private fun rule667(): ContractRule = ContractRule(kind = "boolean")
    private fun rule668(): ContractRule = ContractRule(kind = "object", properties = mapOf("current_version" to rule669(), "conflict_id" to rule15()), required = setOf("current_version", "conflict_id"), additionalProperties = false)
    private fun rule669(): ContractRule = ContractRule(kind = "integer", minimum = 1.0, maximum = 9007199254740991.0)
    private fun rule670(): ContractRule = ContractRule(constant = WireConstant("0.2.0"))
    private fun rule671(): ContractRule = ContractRule(kind = "object", properties = mapOf("error" to rule664(), "request_id" to rule408(), "schema_version" to rule672()), required = setOf("error", "request_id", "schema_version"), additionalProperties = false)
    private fun rule672(): ContractRule = ContractRule(constant = WireConstant("0.2.0"))
}
