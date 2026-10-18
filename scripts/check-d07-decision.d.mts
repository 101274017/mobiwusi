export interface D07DecisionReport {
  status: 'development_ready' | 'development_blocked' | 'go' | 'release_pending';
  mode: 'development' | 'release';
  eligible: boolean;
  decisionPath: string;
  decisionPresent: boolean;
  decisionSha256: string | null;
  decision: 'go' | 'no_go' | null;
  reports: Record<string, { path: string; exists: boolean; sha256: string | null; status: string | null }>;
  blockers: string[];
  developmentBlockers: string[];
  releaseBlockers: string[];
  formalDecisionPresent: boolean;
  inputFingerprint: string;
  idempotencyKey: string;
  development: { verdict: string; eligible: boolean };
  release: { verdict: string; ready: boolean };
  generatedDecision: Record<string, unknown>;
  writes: { decision: { written: boolean; idempotent: boolean }; evidence: { written: boolean; idempotent: boolean } };
  limitations: string[];
}

export function runD07DecisionCheck(options?: {
  mode?: 'development' | 'release';
  decisionPath?: string;
  evidencePath?: string | null;
  write?: boolean;
}): D07DecisionReport;
export function validateDevelopmentDecision(record: unknown): string[];
export function inspectD07EvidenceInventory(reports: Record<string, { value: Record<string, unknown> | null }>, rootDirectory?: string): {
  inventory: Array<{ report: string; path: string; sha256: string | null }>;
  errors: string[];
};
