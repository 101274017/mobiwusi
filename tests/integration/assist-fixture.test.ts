import { describe, expect, it } from 'vitest';
import {
  ASSIST_EXPLICIT_FIXTURE_DELAY_MS,
  ASSIST_NORMAL_TIMEOUT_MS,
  assistCanAccept,
  assistInviteTimeoutMs,
  assistInviteTimeoutState,
  resolveAssistFixture,
} from '../../apps/web/src/assist-fixture';

describe('前端亲情协助验收夹具', () => {
  it('默认走正常接听路径，显式夹具可选择无人接听或过期', () => {
    expect(resolveAssistFixture(null, 'success')).toBe('normal');
    expect(resolveAssistFixture('normal', 'success')).toBe('normal');
    expect(resolveAssistFixture('unanswered', 'success')).toBe('unanswered');
    expect(resolveAssistFixture('expired', 'success')).toBe('expired');
    expect(resolveAssistFixture('unknown', 'success')).toBe('normal');
  });

  it('全局邀请过期场景不能被查询参数改回正常接听', () => {
    expect(resolveAssistFixture('normal', 'invite-expired')).toBe('expired');
    expect(resolveAssistFixture('unanswered', 'invite-expired')).toBe('expired');
  });

  it('无人接听和过期夹具快速结束且都不允许接听', () => {
    expect(assistCanAccept('normal')).toBe(true);
    expect(assistCanAccept('unanswered')).toBe(false);
    expect(assistCanAccept('expired')).toBe(false);
    expect(assistInviteTimeoutMs('unanswered')).toBe(ASSIST_EXPLICIT_FIXTURE_DELAY_MS);
    expect(assistInviteTimeoutMs('expired')).toBe(ASSIST_EXPLICIT_FIXTURE_DELAY_MS);
    expect(assistInviteTimeoutMs('normal')).toBe(ASSIST_NORMAL_TIMEOUT_MS);
    expect(assistInviteTimeoutState('unanswered')).toBe('unanswered');
    expect(assistInviteTimeoutState('expired')).toBe('expired');
    expect(assistInviteTimeoutState('normal')).toBe('unanswered');
  });
});
