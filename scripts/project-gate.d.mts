export type GateMode = 'development' | 'release';
export type DevelopmentVerdict = 'DEV_READY' | 'DEV_READY_WITH_EXTERNAL_PENDING' | 'DEV_BLOCKED';
export type ReleaseVerdict = 'NOT_ASSESSED' | 'EXTERNAL_PENDING' | 'BLOCKED' | 'READY';

export interface ExternalPending {
  id: string;
  capability: string;
  reason: string;
  production_enabled: boolean;
  evidence_refs?: string[];
}

export interface GateFailure {
  id: string;
  reason: string;
  kind: string;
  evidence_refs?: string[];
}

export interface ProjectGateResult {
  mode: GateMode;
  active: { verdict: DevelopmentVerdict | ReleaseVerdict; eligible: boolean };
  development: {
    verdict: DevelopmentVerdict;
    eligible: boolean;
    failedChecks: GateFailure[];
    failed_checks: GateFailure[];
    externalPending: ExternalPending[];
    external_pending: ExternalPending[];
  };
  default: {
    mode: 'development';
    verdict: DevelopmentVerdict;
    eligible: boolean;
    externalPending: ExternalPending[];
    external_pending: ExternalPending[];
  };
  external: {
    verdict: ReleaseVerdict;
    ready: boolean;
    status: string;
    pending: ExternalPending[];
    externalPending: ExternalPending[];
    external_pending: ExternalPending[];
  };
  release: {
    verdict: ReleaseVerdict;
    ready: boolean;
    blockers: GateFailure[];
    reasonRefs: string[];
    reason_refs: string[];
  };
}

export function assertGateMode(mode: string): GateMode;
export function isDevelopmentEligible(report: unknown): boolean;
export function isFormalD07Go(record: unknown): boolean;
export function isAutomatedDevelopmentDecision(record: unknown): boolean;
export function handoffDevelopmentErrors(reports?: Record<string, unknown>): GateFailure[];
export function normalizeExternalPending(items: unknown[], fallbackCapability?: string): ExternalPending[];
export function fingerprintInventory(inventory: unknown[]): string;
export function evaluateProjectGate(context?: Record<string, unknown>, evidence?: Record<string, unknown>): ProjectGateResult;
export function exitCodeForGate(gate: ProjectGateResult): 0 | 1;
