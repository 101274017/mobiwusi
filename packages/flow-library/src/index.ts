import { createHmac, timingSafeEqual } from 'node:crypto';

export interface FlowStep {
  id: string;
  instruction: string;
  expectedAction: 'read' | 'tap' | 'type' | 'confirm' | 'stop';
  risk: 'safe' | 'unknown' | 'transaction' | 'private' | 'medical';
}

export interface FlowDefinition {
  flowId: string;
  version: string;
  title: string;
  owner: string;
  reviewer: string;
  riskBoundary: string;
  steps: FlowStep[];
  disabled?: boolean;
}

export interface SignedFlowBundle {
  slot: 'active' | 'candidate';
  bundleVersion: string;
  flows: FlowDefinition[];
  signature: string;
}

export interface FlowResolution {
  status: 'hit' | 'miss' | 'disabled';
  flow: FlowDefinition | null;
  source: 'local-active' | 'local-candidate' | 'none';
  cloudRequested: false;
}

function canonical(bundle: Omit<SignedFlowBundle, 'signature'>): string {
  return JSON.stringify({ slot: bundle.slot, bundleVersion: bundle.bundleVersion, flows: bundle.flows });
}

export function signFlowBundle(bundle: Omit<SignedFlowBundle, 'signature'>, secret: string): string {
  return createHmac('sha256', secret).update(canonical(bundle)).digest('base64url');
}

export function verifyFlowBundle(bundle: SignedFlowBundle, secret: string): boolean {
  const expected = signFlowBundle({ slot: bundle.slot, bundleVersion: bundle.bundleVersion, flows: bundle.flows }, secret);
  const actualBytes = Buffer.from(bundle.signature);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function validateFlow(flow: FlowDefinition): void {
  if (!flow.flowId || !flow.version || !flow.title || !flow.owner || !flow.reviewer || !flow.steps.length) throw new Error('流程字段不完整');
  if (flow.steps.some(step => !step.id || !step.instruction || (step.risk === 'unknown' && step.expectedAction === 'tap'))) throw new Error('流程风险边界不完整');
}

export class LocalFlowLibrary {
  private active: SignedFlowBundle | null = null;
  private candidate: SignedFlowBundle | null = null;

  constructor(private readonly secret: string) {}

  install(bundle: SignedFlowBundle): { accepted: boolean; reason: string } {
    if (!verifyFlowBundle(bundle, this.secret)) return { accepted: false, reason: 'invalid_signature' };
    try { bundle.flows.forEach(validateFlow); } catch { return { accepted: false, reason: 'invalid_flow' }; }
    if (bundle.slot === 'candidate') this.candidate = structuredClone(bundle);
    else this.active = structuredClone(bundle);
    return { accepted: true, reason: 'installed' };
  }

  promoteCandidate(): { promoted: boolean; reason: string } {
    if (!this.candidate) return { promoted: false, reason: 'candidate_missing' };
    const promoted = { ...structuredClone(this.candidate), slot: 'active' as const };
    this.active = { ...promoted, signature: signFlowBundle(promoted, this.secret) };
    this.candidate = null;
    return { promoted: true, reason: 'promoted' };
  }

  rollback(previous: SignedFlowBundle): { rolledBack: boolean; reason: string } {
    const result = this.install({ ...previous, slot: 'active' });
    return { rolledBack: result.accepted, reason: result.reason };
  }

  disable(flowId: string): void {
    if (this.active) this.active = { ...this.active, flows: this.active.flows.map(flow => flow.flowId === flowId ? { ...flow, disabled: true } : flow), signature: '' };
  }

  resolve(flowId: string): FlowResolution {
    const flow = this.active?.flows.find(item => item.flowId === flowId) ?? null;
    if (!flow) return { status: 'miss', flow: null, source: 'none', cloudRequested: false };
    if (flow.disabled) return { status: 'disabled', flow: null, source: 'local-active', cloudRequested: false };
    return { status: 'hit', flow: structuredClone(flow), source: 'local-active', cloudRequested: false };
  }

  snapshot(): { activeVersion: string | null; candidateVersion: string | null; activeFlowCount: number } {
    return { activeVersion: this.active?.bundleVersion ?? null, candidateVersion: this.candidate?.bundleVersion ?? null, activeFlowCount: this.active?.flows.length ?? 0 };
  }
}

export const defaultFlowCatalog: FlowDefinition[] = Array.from({ length: 20 }, (_, index) => ({
  flowId: `flow-${String(index + 1).padStart(2, '0')}`,
  version: '1.0.0',
  title: `暖伴基础流程 ${index + 1}`,
  owner: 'content-team',
  reviewer: 'safety-review',
  riskBoundary: '命中本地流程；未知页面暂停并要求用户确认',
  steps: [{ id: 'start', instruction: '确认当前页面和下一步', expectedAction: 'confirm', risk: 'safe' }],
}));
