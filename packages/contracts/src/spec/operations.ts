export interface OperationSpec {
  id: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary: string;
  request: string | null;
  response: string | null;
  authentication: 'public-challenge' | 'bearer';
  authorization: string;
  versioned: boolean;
  paginated: boolean;
  stream: boolean;
  binary: boolean;
  successStatus: number;
}

function operation(id: string, method: OperationSpec['method'], path: string, summary: string, request: string | null, response: string | null, options: Partial<OperationSpec> = {}): OperationSpec {
  return { id, method, path: '/v1' + path, summary, request, response, authentication: 'bearer', authorization: 'self', versioned: false, paginated: false, stream: false, binary: false, successStatus: method === 'post' ? 201 : 200, ...options };
}

export const operations: OperationSpec[] = [
  operation('carrierExchange', 'post', '/auth/carrier/exchange', '一次性运营商凭证兑换，不记录凭证', 'CarrierExchangeRequest', 'SessionDto', { authentication: 'public-challenge', authorization: 'provider_token_and_single_use_nonce' }),
  operation('claimCreate', 'post', '/auth/claims', '创建待本人或监护确认的认领，不自动激活', 'ClaimRequest', 'ClaimResponse', { authorization: 'authorized_family_or_community_operator' }),
  operation('claimConfirm', 'post', '/auth/claims/{id}/confirm', '核对一次性证明和有效同意后认领', 'ClaimConfirmRequest', 'ClaimConfirmResponse', { authentication: 'public-challenge', authorization: 'single_use_claim_proof_and_subject_consent' }),
  operation('deviceChallenge', 'post', '/auth/device-challenges', '已绑定设备签名挑战', 'BindingChallengeRequest', 'DeviceChallengeResponse', { authentication: 'public-challenge', authorization: 'active_binding' }),
  operation('deviceExchange', 'post', '/auth/device-exchange', '签名挑战兑换；本机解锁不是服务端人脸证明', 'DeviceExchangeRequest', 'SessionResponse', { authentication: 'public-challenge', authorization: 'verified_device_signature' }),
  operation('faceChallenge', 'post', '/auth/face-challenges', '独立服务端人脸验证挑战；供应未就绪时拒绝', 'BindingChallengeRequest', 'FaceChallengeResponse', { authentication: 'public-challenge', authorization: 'enrolled_server_face_binding' }),
  operation('faceExchange', 'post', '/auth/face-exchange', '核验活体与供应证明，不接收浏览器伪造成功', 'FaceExchangeRequest', 'SessionResponse', { authentication: 'public-challenge', authorization: 'provider_verified_liveness_proof' }),
  operation('sessionRefresh', 'post', '/auth/refresh', '轮转刷新凭证；不得盲目自动重试', 'RefreshRequest', 'SessionResponse', { authentication: 'public-challenge', authorization: 'active_rotating_refresh_token' }),
  operation('deviceRevoke', 'delete', '/devices/{id}', '撤销本人设备并终止其新访问', null, 'RevokedResponse'),
  operation('meGet', 'get', '/me', '本人账号与设备', null, 'MeResponse'),
  operation('preferencesUpdate', 'patch', '/me/preferences', '修改偏好不授予设备能力', 'PreferencesRequest', 'PreferencesResponse', { versioned: true }),
  operation('relationInvite', 'post', '/relations/invitations', '邀请家属并明确请求 scopes', 'RelationInvitationRequest', 'RelationInvitationResponse'),
  operation('relationAccept', 'post', '/relations/{id}/accept', '受邀当事人或有效监护确认关系', 'RelationAcceptRequest', 'RelationResponse', { authorization: 'invited_subject_or_valid_guardian' }),
  operation('relationList', 'get', '/relations', '仅列本人参与的关系', null, 'RelationPage', { paginated: true, authorization: 'current_participant' }),
  operation('relationGrantsUpdate', 'patch', '/relations/{id}/grants', '扩权须本人明确确认且校验当前关系版本', 'GrantsRequest', 'GrantsResponse', { versioned: true, authorization: 'subject_or_valid_guardian_with_current_revision' }),
  operation('relationRevoke', 'delete', '/relations/{id}', '双方均可撤关系并立即阻断新增访问', null, 'RelationRevokedResponse', { authorization: 'current_participant' }),
  operation('consentCreate', 'post', '/consents', '用途/范围/告知版本明确的当次同意，不替代 OS grant', 'ConsentRequest', 'ConsentResponse', { authorization: 'subject_or_valid_guardian' }),
  operation('consentWithdraw', 'post', '/consents/{id}/withdraw', '撤回本次同意，立即关闭相关出口', null, 'ConsentWithdrawResponse', { authorization: 'consent_subject_or_valid_guardian' }),
  operation('conversationCreate', 'post', '/conversations', '创建本人对话', 'ConversationCreateRequest', 'ConversationCreateResponse'),
  operation('conversationMessages', 'get', '/conversations/{id}/messages', '只返回本人允许保留的上下文，不授权给档案查看者', null, 'ConversationMessagePage', { paginated: true }),
  operation('conversationRespond', 'post', '/conversations/{id}/responses', '校验输入归属/安全票据后请求流式回答', 'ResponseRequest', 'ResponseAccepted', { authorization: 'self_and_current_media_consent' }),
  operation('requestCancel', 'post', '/requests/{id}/cancel', '停止在本地立即生效，不等待 HTTP 确认', null, 'CancelledResponse', { successStatus: 200 }),
  operation('requestEvents', 'get', '/requests/{id}/events', '有明确终止事件和短期重放窗口的 SSE', null, 'ServiceStreamEvent', { stream: true }),
  operation('uploadCreate', 'post', '/media/uploads', '仅接受本地检测/脱敏后媒体的安全票据', 'UploadRequest', 'UploadResponse', { authorization: 'self_and_current_capture_consent' }),
  operation('uploadBytes', 'put', '/media/uploads/{id}/content', '受限二进制上传，不将原始画面放进 JSON', null, null, { binary: true, successStatus: 204, authorization: 'owner_of_unexpired_safe_upload' }),
  operation('mediaCommit', 'post', '/media/{id}/commit', '校验哈希/大小/归属后提交媒体引用', 'MediaCommitRequest', 'MediaCommitResponse', { authorization: 'owner_of_unexpired_safe_upload' }),
  operation('guidanceCreate', 'post', '/guidance', '创建逐步教学，不注入输入', 'GuidanceCreateRequest', 'GuidanceCreateResponse'),
  operation('guidanceAnalyze', 'post', '/guidance/{id}/analyze', '候选步骤须绑定当前授权与帧代际', 'GuidanceAnalyzeRequest', 'RequestAccepted', { authorization: 'self_and_current_capture_consent' }),
  operation('guidanceVerify', 'post', '/guidance/{id}/verify', '新帧核验；点好了不直接算成功', 'GuidanceVerifyRequest', 'GuidanceVerifyResponse', { authorization: 'self_and_current_capture_consent' }),
  operation('guidanceStop', 'post', '/guidance/{id}/stop', '停止教学并清理标记，HTTP 不阻塞本地清理', null, 'EndedResponse', { successStatus: 200 }),
  operation('guidanceEvents', 'get', '/guidance/{id}/events', '教学候选/风险/低置信 SSE', null, 'ServiceStreamEvent', { stream: true, authorization: 'self_and_current_capture_consent' }),
  operation('noteList', 'get', '/notes', '本人或 learning.read 授权的档案投影', null, 'NotePage', { paginated: true, authorization: 'self_or_current_learning_read_grant' }),
  operation('noteCreate', 'post', '/notes', '仅保存脱敏学习摘要；归档失败不影响讲解完成', 'NoteCreateRequest', 'NoteResponse'),
  operation('noteUpdate', 'patch', '/notes/{id}', '本人或授权家属确认掌握；AI 不能自动设 mastered', 'NoteUpdateRequest', 'NoteResponse', { versioned: true, authorization: 'self_or_current_learning_mastery_write_grant' }),
  operation('noteDelete', 'delete', '/notes/{id}', '删除保留 tombstone，不复活旧版本', null, 'NoteDeletedResponse', { versioned: true }),
  operation('noteReview', 'post', '/notes/{id}/reviews', '复习、练习与掌握确认分别记录', 'ReviewRequest', 'ReviewResponse'),
  operation('todoList', 'get', '/todos', '查询本人待办', null, 'TodoPage', { paginated: true }),
  operation('todoCreate', 'post', '/todos', '精确时间复述确认后才创建提醒', 'TodoCreateRequest', 'TodoResponse', { authorization: 'self_or_current_todo_write_grant' }),
  operation('todoUpdate', 'patch', '/todos/{id}', '改时间撤销旧实例；不允许隐式猜时间', 'TodoUpdateRequest', 'TodoResponse', { versioned: true, authorization: 'self_or_current_todo_write_grant' }),
  operation('todoComplete', 'post', '/todos/{id}/occurrences/{instance_id}/complete', '只完成当前期，不自动更改掌握状态', null, 'OccurrenceCompleteResponse', { successStatus: 200 }),
  operation('todoDelete', 'delete', '/todos/{id}', '撤销未来提醒实例', null, 'TodoCancelledResponse', { versioned: true, authorization: 'self_or_current_todo_write_grant' }),
  operation('reminderReceipt', 'post', '/reminders/{instance_id}/receipts', '只报告真实可观察回执；发出不等于看到', 'ReceiptRequest', 'AcceptedResponse', { successStatus: 200, authorization: 'current_bound_subject_device' }),
  operation('petJobCreate', 'post', '/pet-jobs', '从本人画稿创建异步可动 2D 任务', 'PetJobRequest', 'PetJobCreated'),
  operation('petJobGet', 'get', '/pet-jobs/{id}', '查询本人任务/资产及明确失败状态', null, 'PetJobDto'),
  operation('petJobCancel', 'delete', '/pet-jobs/{id}', '取消后迟到产物不得应用', null, 'PetJobCancelled'),
  operation('petJobEvents', 'get', '/pet-jobs/{id}/events', '生成任务 SSE；没有产物不得伪报成功', null, 'ServiceStreamEvent', { stream: true }),
  operation('petCurrentGet', 'get', '/pets/current', '当前资产和回退可用性', null, 'PetCurrentResponse'),
  operation('petCurrentPut', 'put', '/pets/current', '仅应用已验证且本人预览确认的资产；Android 禁用 3D', 'PetCurrentRequest', 'PetCurrentResponse', { versioned: true }),
  operation('flowManifest', 'get', '/flows/manifest', '仅返回兼容、签名审核的流程包元数据', null, 'ManifestDto'),
  operation('configManifest', 'get', '/configs/manifest', '配置不能关闭客户端安全底线', null, 'ManifestDto'),
  operation('syncMutations', 'post', '/sync/mutations', '逐条授权并返回冲突；权限类对象禁止离线强制覆盖', 'SyncRequest', 'SyncResponse', { successStatus: 200 }),
  operation('syncChanges', 'get', '/sync/changes', '按账号/授权/游标返回更改', null, 'SyncChangesResponse', { paginated: true }),
  operation('assistCreate', 'post', '/assists', '关系和当次同意齐备才创建短期邀请', 'AssistRequest', 'AssistCreated', { authorization: 'current_relation_and_subject_session_consent' }),
  operation('assistAccept', 'post', '/assists/{id}/accept', '家属接听不代表本机共享授权', null, 'AssistStateResponse', { authorization: 'invited_current_helper' }),
  operation('assistJoin', 'post', '/assists/{id}/join', '校验当前关系/同意/设备，短期 relay-only 凭证', 'AssistJoinRequest', 'AssistJoinResponse', { authorization: 'current_participant_device_and_grant_revision' }),
  operation('assistEnd', 'post', '/assists/{id}/end', '任一参与者结束；本地先停止，服务端租约兜底', 'AssistEndRequest', 'AssistEndedResponse', { successStatus: 200, authorization: 'current_participant' }),
  operation('safetyEvent', 'post', '/safety-events', '字段白名单，不收原始文字、媒体或密钥', 'SafetyEventRequest', 'SafetyEventResponse'),
  operation('metricsBatch', 'post', '/metrics/batch', '最小指标去重，练过不等于掌握', 'MetricsRequest', 'MetricsResponse', { successStatus: 200 }),
  operation('provisioningBatch', 'post', '/provisioning/batches', '社区批次逐人确认，拒绝无同意激活', 'ProvisioningRequest', 'ProvisioningResponse', { authorization: 'authorized_community_operator_and_each_subject_consent' }),
  operation('voiceTicket', 'post', '/conversations/{id}/voice-ticket', '一次性短期 WS 票据，不放入 URL', 'VoiceTicketRequest', 'VoiceTicketResponse', { authorization: 'self_and_current_audio_consent' }),
];
