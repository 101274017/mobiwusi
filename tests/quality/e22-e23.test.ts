import { describe, expect, it } from 'vitest';
import { auditModelArtifact, evaluateIncrementalTasks, hasReleaseBlockingFinding, hashModelBytes, redactAuditLog } from '../../packages/quality-gates/src';

describe('E22/E23 增量测试与安全审计', () => {
  it('开发绕过只放开代码测试，不把未就绪依赖宣称为发布通过', () => {
    const [blocked, implemented] = evaluateIncrementalTasks([
      { id: 'E22', codePresent: true, testsPresent: true, dependencyReady: false, dependencyMode: 'FS' },
      { id: 'E23', codePresent: true, testsPresent: true, dependencyReady: false, dependencyMode: 'development_override' },
    ]);
    expect(blocked.status).toBe('blocked');
    expect(implemented.status).toBe('implemented');
  });

  it('模型必须有大小、路径、哈希和来源边界', () => {
    const bytes = new TextEncoder().encode('model');
    const result = auditModelArtifact({ name: 'safe.onnx', bytes: bytes.byteLength, sha256: hashModelBytes(bytes), format: 'onnx', path: 'models/safe.onnx', metadata: { license: 'internal', source: 'fixture', version: '1' } });
    expect(result.accepted).toBe(true);
    expect(auditModelArtifact({ name: 'bad', bytes: 51 * 1024 * 1024, sha256: 'bad', format: 'onnx', path: '../secret', metadata: { license: '', source: '', version: '' } }).accepted).toBe(false);
  });

  it('审计日志脱敏且高危开放问题阻断发布候选', () => {
    expect(redactAuditLog('Bearer abc token=secret 6222001234567890')).toBe('Bearer [REDACTED] token=[REDACTED] [REDACTED_NUMBER]');
    expect(hasReleaseBlockingFinding([{ id: 'SEC-1', severity: 'high', message: 'unsafe', status: 'open' }])).toBe(true);
    expect(hasReleaseBlockingFinding([{ id: 'SEC-2', severity: 'high', message: 'fixed', status: 'mitigated' }])).toBe(false);
  });
});
