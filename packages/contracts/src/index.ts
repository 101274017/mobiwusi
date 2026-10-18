export { schemaVersion as contractVersion } from './spec/primitives';
export { validInstant, validTimezone } from './formats';
import { schemaVersion } from './spec/primitives';
export { serviceErrorCodes } from './spec/errors';
import { serviceErrorCodes } from './spec/errors';
export { definitions } from './spec/models';
export { eventDefinitions } from './spec/events';
export { operations } from './spec/operations';
export { serviceDefinitions, serviceSchema } from './spec/catalog';
export type * from './types.generated';
export type ConversationEvent = { request_id: string; sequence: number } & (
  { type: 'started' | 'completed'; text?: never } | { type: 'delta'; text: string }
);
export type ServiceErrorCode = typeof serviceErrorCodes[number];
export interface ServiceErrorEnvelope {
  error: { code: ServiceErrorCode; message: string; retryable: boolean };
  request_id: string;
  schema_version: typeof schemaVersion;
}
export function isConversationEvent(value: unknown): value is ConversationEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  if (Object.keys(event).some(key => !['request_id', 'sequence', 'type', 'text'].includes(key))) return false;
  if (typeof event.request_id !== 'string' || !event.request_id.length || event.request_id.length > 128) return false;
  if (!Number.isSafeInteger(event.sequence) || (event.sequence as number) < 0) return false;
  if (event.type === 'delta') return typeof event.text === 'string' && event.text.length > 0 && event.text.length <= 4000;
  return (event.type === 'started' || event.type === 'completed') && !('text' in event);
}
export interface Envelope<T> { data: T; request_id: string; schema_version: string; }
export type { ErrorEnvelope as ApiError } from './types.generated';
export { bridgeSchema, androidBridgeReplySchema, isBridgeMessage, isAndroidBridgeReply } from './active-bridge';
export type { BridgeMessage, BridgeCorrelation, ActiveBridgeMethod, AndroidBridgeReply, AndroidBridgeErrorReply } from './active-bridge';
