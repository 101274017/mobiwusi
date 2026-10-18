import { createHash } from 'node:crypto';

export type ETaskId = `E${string}`;
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface IncrementalTaskState {
  id: ETaskId;
  codePresent: boolean;
  testsPresent: boolean;
  dependencyReady: boolean;
  dependencyMode: 'FS' | 'SS' | 'FF' | 'development_override';
}

export interface IncrementalTaskResult extends IncrementalTaskState {
  status: 'implemented' | 'blocked' | 'not_started';
  reasons: string[];
}

export interface ModelArtifactInput {
  name: string;
  bytes: number;
  sha256: string;
  format: 'onnx' | 'tflite' | 'safetensors' | 'json';
  path: string;
  metadata: { license: string; source: string; version: string };
}

export interface ModelArtifactAudit {
  accepted: boolean;
  findings: string[];
  contentAddressed: boolean;
  bounded: boolean;
}

export interface SecurityFinding {
  id: string;
  severity: FindingSeverity;
  message: string;
  status: 'open' | 'mitigated' | 'accepted';
}

export function evaluateIncrementalTasks(tasks: IncrementalTaskState[]): IncrementalTaskResult[] {
  return tasks.map(task => {
    const reasons: string[] = [];
    if (!task.codePresent) reasons.push('code_missing');
    if (!task.testsPresent) reasons.push('tests_missing');
    if (!task.dependencyReady && task.dependencyMode !== 'development_override') reasons.push('dependency_not_ready');
    const status = reasons.length > 0
      ? task.codePresent || task.testsPresent ? 'blocked' : 'not_started'
      : 'implemented';
    return { ...task, status, reasons };
  });
}

export function auditModelArtifact(artifact: ModelArtifactInput): ModelArtifactAudit {
  const findings: string[] = [];
  if (!artifact.name.trim()) findings.push('name_required');
  if (!Number.isInteger(artifact.bytes) || artifact.bytes <= 0 || artifact.bytes > 50 * 1024 * 1024) findings.push('size_out_of_bounds');
  if (!/^[0-9a-f]{64}$/i.test(artifact.sha256)) findings.push('sha256_required');
  if (artifact.path.includes('..') || artifact.path.startsWith('/') || /^[A-Za-z]:/.test(artifact.path)) findings.push('unsafe_path');
  if (!artifact.metadata.license.trim() || !artifact.metadata.source.trim() || !artifact.metadata.version.trim()) findings.push('provenance_incomplete');
  return { accepted: findings.length === 0, findings, contentAddressed: /^[0-9a-f]{64}$/i.test(artifact.sha256), bounded: !findings.includes('size_out_of_bounds') };
}

export function hashModelBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function redactAuditLog(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\b\d{15,19}\b/g, '[REDACTED_NUMBER]');
}

export function hasReleaseBlockingFinding(findings: SecurityFinding[]): boolean {
  return findings.some(finding => (finding.severity === 'critical' || finding.severity === 'high') && finding.status === 'open');
}
