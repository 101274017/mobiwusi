import type { ImageQuestionStatus, ImageQuestionSubmission } from '../../packages/application/src/image-question';
import type { NativeImageApi, ObservationFrame, DetectionResult } from './observation/observation-types.cjs';

export interface ImageQuestionProvider {
  answer(input: {
    requestId: string;
    question: string;
    image: { mime: 'image/png'; bytes: Buffer; width: number; height: number };
    signal: AbortSignal;
  }): Promise<{ text: string }>;
}
export interface ImageQuestionService {
  status(): ImageQuestionStatus;
  answer(input: ImageQuestionSubmission, options?: { signal?: AbortSignal }): Promise<string>;
}
export function createImageQuestionService(options?: {
  nativeImage?: NativeImageApi;
  provider?: ImageQuestionProvider;
  detector?: { detectAttachment(frame: ObservationFrame, options?: { signal?: AbortSignal }): Promise<DetectionResult> };
  now?: () => number;
  timeoutMs?: number;
}): ImageQuestionService;
export class ImageQuestionError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, retryable?: boolean);
}
