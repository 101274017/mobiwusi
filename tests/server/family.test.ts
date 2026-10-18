import { describe, expect, it } from 'vitest';
import { AuthService } from '../../apps/server/src/auth.ts';
import { FamilyService } from '../../apps/server/src/family.ts';
import { createInMemoryRepositories } from '../../apps/server/src/repositories.ts';

function setup() {
  let now = Date.parse('2026-10-17T00:00:00.000Z');
  const repositories = createInMemoryRepositories();
  const auth = new AuthService(repositories);
  const subject = auth.createAccount({ account_id: 'subject' });
  const helper = auth.createAccount({ account_id: 'helper' });
  const other = auth.createAccount({ account_id: 'other' });
  const family = new FamilyService(repositories, { now: () => now, invitationTtlMs: 1_000 });
  const scopes = ['learning.read', 'todo.write'] as const;
  const consent = family.createConsent(subject.account_id, { purpose: 'learning_share', scopes: [...scopes], notice_version: 'v1', subject_id: subject.account_id });
  return { repositories, family, subject, helper, other, scopes, consent, advance: (milliseconds: number) => { now += milliseconds; } };
}

describe('FamilyService', () => {
  it('rejects cross-owner consent creation, acceptance, and revocation', () => {
    const { family, subject, helper, other, scopes, consent } = setup();
    expect(() => family.createConsent(other.account_id, { purpose: 'learning_share', scopes: [...scopes], notice_version: 'v1', subject_id: subject.account_id })).toThrow('consent subject');
    const invitation = family.invite(subject.account_id, { helper_ref: helper.account_id, requested_scopes: [...scopes] });
    expect(() => family.accept(other.account_id, invitation.invitation_id, { consent_id: consent.consent_id, scopes: [...scopes] })).toThrow('invited helper');
    const relation = family.accept(helper.account_id, invitation.invitation_id, { consent_id: consent.consent_id, scopes: [...scopes] }).relation;
    expect(() => family.revoke(other.account_id, relation.relation_id)).toThrow('participant');
    expect(() => family.authorize(other.account_id, subject.account_id, 'learning.read')).toThrow('Relation is not available');
  });

  it('rejects expired invitations', () => {
    const { family, subject, helper, scopes, consent, advance } = setup();
    const invitation = family.invite(subject.account_id, { helper_ref: helper.account_id, requested_scopes: [...scopes] });
    advance(1_000);
    expect(() => family.accept(helper.account_id, invitation.invitation_id, { consent_id: consent.consent_id, scopes: [...scopes] })).toThrow('expired');
  });

  it('keeps invitation and consent creation idempotent', () => {
    const { family, subject, helper, scopes, consent } = setup();
    const consentAgain = family.createConsent(subject.account_id, { purpose: 'learning_share', scopes: [...scopes], notice_version: 'v1', subject_id: subject.account_id });
    expect(consentAgain).toEqual(consent);
    const invitation = family.invite(subject.account_id, { helper_ref: helper.account_id, requested_scopes: [...scopes] });
    expect(family.invite(subject.account_id, { helper_ref: helper.account_id, requested_scopes: [...scopes] })).toEqual(invitation);
  });

  it('accepts an invitation idempotently and enforces scopes', () => {
    const { family, subject, helper, scopes, consent } = setup();
    const invitation = family.invite(subject.account_id, { helper_ref: helper.account_id, requested_scopes: [...scopes] });
    const input = { consent_id: consent.consent_id, scopes: [...scopes] };
    const first = family.accept(helper.account_id, invitation.invitation_id, input);
    expect(family.accept(helper.account_id, invitation.invitation_id, input)).toEqual(first);
    expect(() => family.authorize(helper.account_id, subject.account_id, 'assist.request')).toThrow('scope');
  });

  it('blocks access immediately after relation revoke or consent withdrawal', () => {
    const { family, subject, helper, scopes, consent } = setup();
    const invitation = family.invite(subject.account_id, { helper_ref: helper.account_id, requested_scopes: [...scopes] });
    const relation = family.accept(helper.account_id, invitation.invitation_id, { consent_id: consent.consent_id, scopes: [...scopes] }).relation;
    expect(family.authorize(helper.account_id, subject.account_id, 'learning.read').status).toBe('active');
    const revoked = family.revoke(subject.account_id, relation.relation_id);
    expect(() => family.authorize(helper.account_id, subject.account_id, 'learning.read')).toThrow('revoked');
    expect(family.revoke(subject.account_id, relation.relation_id)).toEqual(revoked);

    const secondInvitation = family.invite(subject.account_id, { helper_ref: helper.account_id, requested_scopes: [...scopes] });
    const secondRelation = family.accept(helper.account_id, secondInvitation.invitation_id, { consent_id: consent.consent_id, scopes: [...scopes] }).relation;
    family.withdrawConsent(subject.account_id, consent.consent_id);
    expect(() => family.authorize(helper.account_id, subject.account_id, 'learning.read')).toThrow('withdrawn');
    expect(() => family.updateGrants(subject.account_id, secondRelation.relation_id, [...scopes], consent.consent_id)).toThrow('consent');
  });

  it('requires consent scope coverage for invitation acceptance', () => {
    const { family, subject, helper } = setup();
    const narrowConsent = family.createConsent(subject.account_id, { purpose: 'learning_share', scopes: ['learning.read'], notice_version: 'v2', subject_id: subject.account_id });
    const invitation = family.invite(subject.account_id, { helper_ref: helper.account_id, requested_scopes: ['learning.read', 'todo.write'] });
    expect(() => family.accept(helper.account_id, invitation.invitation_id, { consent_id: narrowConsent.consent_id, scopes: ['learning.read', 'todo.write'] })).toThrow('consent');
  });
});

