import type { AnalysisInput, AnalysisResult } from './runtime-coordinator.cjs';
export interface DesktopAnalysisOptions { env?: Record<string, string | undefined>; fetch?: typeof globalThis.fetch; now?(): number; timeoutMs?: number }
export function analysisEndpoint(baseUrl?: string): string | null;
export function createDesktopAnalysisClient(options?: DesktopAnalysisOptions): { capabilities(): { configured: boolean; protocol: string }; analyze(input: AnalysisInput): Promise<AnalysisResult> };
