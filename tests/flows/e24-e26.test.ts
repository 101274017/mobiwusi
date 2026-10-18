import { describe, expect, it } from 'vitest';
import { defaultFlowCatalog, LocalFlowLibrary, signFlowBundle } from '../../packages/flow-library/src';

const secret = 'development-only-flow-key';

function bundle(slot: 'active' | 'candidate' = 'active', version = '1.0.0') {
  const unsigned = { slot, bundleVersion: version, flows: defaultFlowCatalog };
  return { ...unsigned, signature: signFlowBundle(unsigned, secret) };
}

describe('E24/E25/E26 流程内容、准入与本地流程库', () => {
  it('维护 20 项流程并拒绝签名错误的更新', () => {
    expect(defaultFlowCatalog).toHaveLength(20);
    const library = new LocalFlowLibrary(secret);
    expect(library.install(bundle())).toEqual({ accepted: true, reason: 'installed' });
    expect(library.install({ ...bundle('candidate', '2.0.0'), signature: 'tampered' })).toEqual({ accepted: false, reason: 'invalid_signature' });
  });

  it('候选槽必须显式提升，坏更新不覆盖当前流程', () => {
    const library = new LocalFlowLibrary(secret);
    library.install(bundle());
    library.install(bundle('candidate', '2.0.0'));
    expect(library.snapshot()).toMatchObject({ activeVersion: '1.0.0', candidateVersion: '2.0.0', activeFlowCount: 20 });
    expect(library.promoteCandidate()).toEqual({ promoted: true, reason: 'promoted' });
    expect(library.snapshot()).toMatchObject({ activeVersion: '2.0.0', candidateVersion: null });
  });

  it('命中只读本地流程，失配或停用不调云、不猜目标', () => {
    const library = new LocalFlowLibrary(secret);
    library.install(bundle());
    expect(library.resolve('flow-01')).toMatchObject({ status: 'hit', source: 'local-active', cloudRequested: false });
    expect(library.resolve('missing')).toMatchObject({ status: 'miss', source: 'none', cloudRequested: false });
    library.disable('flow-01');
    expect(library.resolve('flow-01')).toMatchObject({ status: 'disabled', cloudRequested: false });
  });
});
