import type { AiProvider } from './ai-provider.cjs';
import type { AnalysisInput, AnalysisResult } from './runtime-coordinator.cjs';
export function createProviderAnalysisClient(options?: { provider?: Pick<AiProvider, 'answer'>; now?(): number }): {
  capabilities(): { configured: boolean; protocol: string };
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
};
