import { boolean, choice, identifier, instant, integer, list, literal, nullable, object, ref, text, type Schema } from './primitives.ts';

const eventMetadata = { request_id: identifier, session_id: identifier, event_id: identifier, seq: integer(), generation: integer() };
const rect = object({ x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 }, width: { type: 'number', exclusiveMinimum: 0, maximum: 1 }, height: { type: 'number', exclusiveMinimum: 0, maximum: 1 } });
function event(type: string, payload: Schema): Schema { return object({ ...eventMetadata, type: literal(type), payload }); }
function bridge(method: string, params: Schema): Schema { return object({ bridge_version: literal('1.0'), request_id: identifier, generation: integer(), method: literal(method), params }); }

export const eventDefinitions: Record<string, Schema> = {
  NormalizedRect: rect,
  ServiceStreamEvent: { oneOf: [
    event('response.started', object({})),
    event('caption.segment', object({ segment_id: identifier, index: integer(), text: text(4000) })),
    event('response.completed', object({ final_segment_count: integer(1, 1000) })),
    event('response.cancelled', object({ reason: choice('user_stop', 'risk', 'permission_revoked', 'consent_revoked') })),
    event('response.failed', object({ code: choice('TIMEOUT', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE'), retryable: boolean })),
    event('guidance.step', object({ step_id: identifier, instruction: text(500), frame_context: ref('FrameContextDto'), target: rect, expires_at: instant })),
    event('guidance.risk', object({ risk: choice('private', 'transaction', 'unknown', 'detector_failure'), action: choice('pause_all_related', 'stop_teaching_and_media') })),
    event('guidance.low_confidence', object({ action: literal('request_help') })),
    event('guidance.completed', object({ verification_id: identifier })),
    event('pet_job.progress', object({ status: choice('queued', 'processing'), progress: integer(0, 99) })),
    event('pet_job.succeeded', object({ assets: list(ref('AssetDto'), 8, 1) })),
    event('pet_job.failed', object({ code: choice('PROVIDER_UNAVAILABLE', 'RATE_LIMITED', 'CANCELLED') })),
  ] },
  AssistSignal: { oneOf: [
    event('invite', object({ assist_id: identifier, expires_at: instant, grant_revision: integer(1) })),
    event('accept', object({ assist_id: identifier, grant_revision: integer(1) })),
    event('offer', object({ assist_id: identifier, sdp: { ...text(65536), pattern: '^v=0\\r?\\n', example: 'v=0\r\ns=synthetic\r\n' }, grant_revision: integer(1) })),
    event('answer', object({ assist_id: identifier, sdp: { ...text(65536), pattern: '^v=0\\r?\\n', example: 'v=0\r\ns=synthetic\r\n' }, grant_revision: integer(1) })),
    event('ice', object({ assist_id: identifier, candidate: { ...text(2048), pattern: '^candidate:', example: 'candidate:synthetic-no-network' }, grant_revision: integer(1) })),
    event('risk.pause', object({ assist_id: identifier, screen_paused: literal(true), audio_paused: literal(true), reason: choice('transaction', 'private', 'unknown', 'detector_failure') })),
    event('consent.revoked', object({ assist_id: identifier, consent_id: identifier, grant_revision: integer(1) })),
    event('end', object({ assist_id: identifier, reason: choice('user_stop', 'expired', 'permission_revoked', 'consent_revoked', 'disconnected') })),
  ] },
  VoiceFrameHeader: object({ request_id: identifier, generation: integer(), seq: integer(), codec: choice('opus', 'pcm_s16le'), byte_length: integer(1, 65536), duration_ms: integer(20, 40) }),
  BridgeRequestV1: { oneOf: [
    bridge('capabilities.get', object({})),
    bridge('permissions.request', object({ permission: choice('screen_capture', 'camera', 'microphone', 'overlay', 'notifications'), purpose: text(200) })),
    bridge('capture.start', object({ purpose: choice('teaching', 'assistance'), consent_id: identifier })),
    bridge('capture.stop', object({})),
    bridge('camera.start', object({ consent_id: identifier })),
    bridge('camera.stop', object({})),
    bridge('audio.start', object({ purpose: choice('question', 'assistance'), consent_id: identifier })),
    bridge('audio.stop', object({})),
    bridge('overlay.present', object({ step_id: identifier, safe_handle: identifier, frame_context: ref('FrameContextDto'), target: rect, expires_at: instant })),
    bridge('overlay.clear', object({})),
    bridge('notifications.schedule', object({ todo_id: identifier, instance_id: identifier, planned_at: instant, schedule_revision: integer(1) })),
    bridge('notifications.cancel', object({ instance_id: identifier })),
    bridge('storage.notes.read', object({ account_partition: identifier })),
    bridge('storage.drawing.read', object({ draft_id: identifier })),
    bridge('assets.import', object({ local_file_handle: identifier, kind: choice('vrm', 'fbx', 'glb') })),
    bridge('assets.preview', object({ asset_handle: identifier })),
  ] },
  BridgeReplyV1: { oneOf: [
    object({ request_id: identifier, generation: integer(), ok: literal(true), result: object({ state: choice('system_pending', 'stopped', 'unsupported', 'ready'), safe_handle: nullable(identifier) }) }),
    object({ request_id: identifier, generation: integer(), ok: literal(false), error: object({ code: choice('PERMISSION_DENIED', 'CANCELLED', 'TARGET_STALE', 'PROVIDER_UNAVAILABLE'), message: text(320) }) }),
  ] },
};
