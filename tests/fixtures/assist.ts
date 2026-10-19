export type AssistFixture = 'normal' | 'unanswered' | 'expired';

export const ASSIST_EXPLICIT_FIXTURE_DELAY_MS = 350;
export const ASSIST_NORMAL_TIMEOUT_MS = 30_000;

export function resolveAssistFixture(queryValue: string | null, apiScenario: string): AssistFixture {
  if (apiScenario === 'invite-expired') return 'expired';
  if (queryValue === 'normal' || queryValue === 'unanswered' || queryValue === 'expired') return queryValue;
  return 'normal';
}

export function assistCanAccept(fixture: AssistFixture): boolean {
  return fixture === 'normal';
}

export function assistInviteTimeoutMs(fixture: AssistFixture): number {
  return fixture === 'normal' ? ASSIST_NORMAL_TIMEOUT_MS : ASSIST_EXPLICIT_FIXTURE_DELAY_MS;
}

export function assistInviteTimeoutState(fixture: AssistFixture): 'unanswered' | 'expired' {
  return fixture === 'expired' ? 'expired' : 'unanswered';
}
