import type { AdmittedFrame, LocalDetection, ObservationFrame, PixelRect } from './observation-policy.cjs';

export interface RuntimeSnapshot {
  observation: { state: string; id?: string; generation: number; sourceName: string; reason: string | null; captureActive: boolean };
  task: { state: string; id: string | null; generation: number; question: string; instruction: string; explanation: string; presentation: string | null; result: string | null; startedAt?: number };
  analysis: { state: string; message: string }; captions: { enabled: boolean; text: string };
  wake: { state: string; reason: string }; messages: { id: string; role: string; text: string }[]; message: string;
}
export interface TeachingRecord { sourceGuideId: string; question: string; summary: string; result: string; mastery: 'unmastered'; startedAt?: number; endedAt: number }
export interface AnalysisResult {
  observation_id?: string; guide_id: string; observation_generation: number; task_generation: number;
  trigger_id: string; frame_id: string; kind: 'step' | 'completed' | 'clarify' | 'unsupported'; instruction: string;
  target_id?: string; presentation?: 'confirmed' | 'uncertain_candidate'; expected_labels?: string[]; evidence_labels?: string[];
}
export interface AnalysisInput {
  frame: AdmittedFrame; question: string; reason: 'question' | 'page_changed' | 'verification';
  observationId: string; guideId: string; observationGeneration: number; taskGeneration: number; triggerId: string;
  previousStep: { instruction: string; expectedLabels: string[] } | null; signal: AbortSignal; canSend(): boolean;
}
export interface RuntimeOptions {
  source: { capture(input: { sourceId: string; signal: AbortSignal }): Promise<ObservationFrame>; detect(frame: ObservationFrame, input: { signal: AbortSignal }): Promise<LocalDetection>; stop?(): Promise<unknown> | void };
  analyzer?: { analyze(input: AnalysisInput): Promise<AnalysisResult> };
  recordTeaching?(note: TeachingRecord): Promise<unknown> | unknown;
  onState?(snapshot: RuntimeSnapshot): void;
  onTarget?(target: { visible: boolean; rect: PixelRect; label: string; instruction: string; presentation: string; expiresAt: number } | null): void;
  now?(): number; intervalMs?: number; maxAgeMs?: number;
}
export interface ObservationConsent { actor: string; confirmed: boolean; sourceId: string; sourceName?: string; cloudConsent?: boolean }
export interface StopResult { stopped: boolean; captureActive: boolean; mediaActive: boolean; reason: string }
export interface DesktopRuntime {
  snapshot(): RuntimeSnapshot; startObservation(input: ObservationConsent): Promise<RuntimeSnapshot>;
  resumeObservation(input: ObservationConsent): Promise<RuntimeSnapshot>; stopObservation(reason?: string): Promise<StopResult>;
  ask(text: string): Promise<RuntimeSnapshot>; verify(): Promise<RuntimeSnapshot>;
  finishTeaching(result?: string): Promise<RuntimeSnapshot>; repeat(): RuntimeSnapshot; toggleCaptions(): RuntimeSnapshot;
  dispose(reason?: string): Promise<StopResult>; whenIdle(): Promise<void>;
}
export function createDesktopRuntime(options: RuntimeOptions): DesktopRuntime;
