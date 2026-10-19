export type ImageQuestionMime = 'image/png' | 'image/jpeg' | 'image/webp';
export type ImageQuestionStatus = {
  available: boolean;
  reason: 'ready' | 'model_not_configured' | 'host_unavailable';
};
export interface ImageQuestionInput {
  question: string;
  image: Blob;
  confirmed: boolean;
}
export interface ImageQuestionPort {
  status(): Promise<ImageQuestionStatus>;
  answer(input: ImageQuestionInput, signal: AbortSignal): Promise<string>;
}
export interface ImageQuestionSubmission {
  requestId: string;
  question: string;
  image: { mime: ImageQuestionMime; bytes: Uint8Array };
  confirmed: boolean;
}
export type ImageQuestionReply =
  | { ok: true; requestId: string; text: string }
  | { ok: false; requestId: string; code: 'INVALID_REQUEST' | 'CONSENT_REQUIRED' | 'RISK_PAUSED' | 'PROVIDER_UNAVAILABLE' | 'TIMEOUT' | 'CANCELLED'; retryable: boolean };
export interface ImageQuestionBridge {
  status(): Promise<ImageQuestionStatus>;
  answer(input: ImageQuestionSubmission): Promise<ImageQuestionReply>;
  cancel(requestId: string): Promise<boolean>;
}
