export interface DecisionInputSource {
  exists: boolean;
  text: string;
}

export interface DecisionInputValidation {
  parseable: boolean;
  valid: boolean;
  errors: string[];
}

export function validateDecisionInput(source: DecisionInputSource): DecisionInputValidation;

export interface C16SourceInventory {
  path: string;
  exists: boolean;
  bytes: number;
  contentSha256: string | null;
  readError?: string;
  declaredUpdatedAt?: string | null;
  declaredTimeZone?: string;
}

export interface C16DevelopmentCheck {
  id: string;
  passed: boolean;
  status: 'passed' | 'failed';
  reason: string;
}

export interface C16Candidate {
  slot: number;
  id: string;
  platform: 'Android' | 'Windows';
  name: string;
  generatedBy: 'automated';
  mode: 'development';
  status: 'candidate';
  verification: 'external_pending';
  applicationVersion: null;
  flowPackageVersion: null;
  consent: null;
  consentGranted: false;
  targetVerified: false;
  riskBoundary: string;
  fallbackPlan: string;
  sourceReference: string;
  sourceHash: string | null;
}

export interface C16ArtifactMetadata {
  generatedAt: string;
  generatedBy: 'automated';
  mode: 'development';
  status: 'candidate';
  validationScope: 'source_and_development_configuration_only';
  developmentValidated: boolean;
  sourceInventory: C16SourceInventory[];
  decisionReady: false;
  top20Approved: false;
  pilotEligible: false;
  scope: string;
}

export interface C16DevelopmentDecision {
  id: string;
  title: string;
  generatedBy: 'automated';
  mode: 'development';
  status: 'candidate';
  choice: Record<string, unknown>;
  sourceReferences: string[];
  sourcePolicy: string;
  verification: 'external_pending';
  formallyApproved: false;
}

export interface C16DevelopmentDefaults extends C16ArtifactMetadata {
  schemaVersion: 'c16-development-defaults/v1';
  decisions: C16DevelopmentDecision[];
}

export interface C16Top20Candidates extends C16ArtifactMetadata {
  schemaVersion: 'c16-top20-candidates/v1';
  candidates: C16Candidate[];
}

export interface C16FormalDecision {
  id: string;
  title: string;
  status: 'unconfirmed';
  sourcePresent: boolean;
  sourceReference: string;
  sourceHash: string | null;
  requiredFields: string[];
  confirmedFields: string[];
  missingFields: string[];
  blockerCode: string;
  blocker: string;
}

export interface C16DecisionReadinessResult {
  schemaVersion: 'c16-decision-readiness/v2';
  generatedAt: string;
  generatedDate: string;
  generatedTimeZone: string;
  scope: string;
  status: 'blocked';
  decisionState: 'unconfirmed';
  auditPassed: boolean;
  sourceAuditPassed: boolean;
  decisionReady: false;
  top20Approved: false;
  pilotEligible: false;
  source: string;
  sourceInventory: C16SourceInventory[];
  decisionInputProvided: boolean;
  decisionInputParseable: boolean;
  decisionInputValid: boolean;
  decisionInputErrors: string[];
  decisionInputQualityPassed: boolean;
  development: {
    verdict: 'DEV_READY_WITH_EXTERNAL_PENDING' | 'DEV_BLOCKED';
    eligible: boolean;
    validationScope: string;
    failedChecks: C16DevelopmentCheck[];
    evidence_refs: string[];
  };
  verification: {
    automated: 'passed' | 'failed';
    external: 'external_pending';
    release: 'EXTERNAL_PENDING' | 'BLOCKED';
    humanConsentOccurred: false;
    independentSignoffVerified: false;
    realApplicationAdaptationVerified: false;
  };
  checks: C16DevelopmentCheck[];
  developmentDefaults: C16DevelopmentDefaults;
  top20Candidates: C16Top20Candidates;
  decisions: C16FormalDecision[];
  top20Slots: C16Candidate[];
  blockers: string[];
  blockerRefs: {
    code: string;
    sourceReference: string;
    sourceHash: string | null;
    reason: string;
    decisionId?: string;
    missingFields?: string[];
  }[];
  allowedUntilDecision: string[];
}

export function runC16DecisionReadinessCheck(options?: {
  evidencePath?: string;
  writeDevelopmentFiles?: boolean;
  rootDirectory?: string;
}): C16DecisionReadinessResult;
