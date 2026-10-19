export type TextQuestionReply =
  | { ok: true; requestId: string; text: string }
  | { ok: false; requestId: string; code: 'INVALID_REQUEST' | 'RISK_PAUSED' | 'AUTH_FAILED' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'STREAM_INTERRUPTED' | 'TIMEOUT' | 'CANCELLED'; retryable: boolean };
export interface TextQuestionBridge {
  status(): Promise<{ available: boolean }>;
  answer(input: { requestId: string; question: string }): Promise<TextQuestionReply>;
  cancel(requestId: string): Promise<boolean>;
}
