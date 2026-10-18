import { randomUUID } from 'node:crypto';
import type { ConsentResponse, ConsentWithdrawResponse, RelationDto, RelationInvitationResponse, RelationResponse, Scope } from '@nuanban/contracts';
import { consentRequired, DomainError, permissionDenied, scopeDenied } from './errors.ts';
import type { AccountRecord, ConsentRecord, InvitationRecord, RelationRecord, ServerRepositories } from './repositories.ts';
import type { Clock } from './auth.ts';

export interface RelationInvitationInput {
  helper_ref: string;
  requested_scopes: Scope[];
}

export interface RelationAcceptInput {
  consent_id: string;
  scopes: Scope[];
}

export interface ConsentInput {
  purpose: ConsentRecord['purpose'];
  scopes: Scope[];
  notice_version: string;
  subject_id: string;
}

export interface FamilyOptions {
  now?: Clock;
  invitationTtlMs?: number;
}

export const supportedScopes: readonly Scope[] = ['learning.read', 'learning.mastery.write', 'todo.write', 'assist.request'];

const defaultClock: Clock = () => Date.now();

function instant(now: Clock, offsetMs = 0): string {
  return new Date(now() + offsetMs).toISOString();
}

function uniqueScopes(scopes: Scope[]): Scope[] {
  return [...new Set(scopes)];
}

function hasAllScopes(granted: Scope[], requested: Scope[]): boolean {
  return requested.every(scope => granted.includes(scope));
}

function equalScopes(left: Scope[], right: Scope[]): boolean {
  return left.length === right.length && hasAllScopes(left, right) && hasAllScopes(right, left);
}

function toRelationDto(relation: RelationRecord): RelationDto {
  return {
    relation_id: relation.relation_id,
    subject_id: relation.subject_id,
    helper_id: relation.helper_id,
    label: relation.label,
    scopes: relation.scopes,
    status: relation.status,
    grant_revision: relation.grant_revision,
    version: relation.version,
    created_at: relation.created_at,
    updated_at: relation.updated_at,
    deleted_at: relation.deleted_at,
  };
}

export class FamilyService {
  private readonly now: Clock;
  private readonly invitationTtlMs: number;

  constructor(private readonly repositories: ServerRepositories, options: FamilyOptions = {}) {
    this.now = options.now ?? defaultClock;
    this.invitationTtlMs = options.invitationTtlMs ?? 7 * 24 * 60 * 60 * 1000;
  }

  createConsent(actorId: string, input: ConsentInput): ConsentResponse {
    if (input.subject_id !== actorId) throw permissionDenied('Only the consent subject can create this consent');
    this.requireAccount(actorId);
    const scopes = this.validateScopes(input.scopes);
    const existing = this.repositories.consents.findActive(actorId, input.purpose, input.notice_version, scopes);
    if (existing) return { consent_id: existing.consent_id };
    const consent: ConsentRecord = {
      consent_id: randomUUID(),
      subject_id: actorId,
      purpose: input.purpose,
      scopes,
      notice_version: input.notice_version,
      created_at: instant(this.now),
      withdrawn_at: null,
    };
    this.repositories.consents.save(consent);
    return { consent_id: consent.consent_id };
  }

  withdrawConsent(actorId: string, consentId: string): ConsentWithdrawResponse {
    const consent = this.repositories.consents.get(consentId);
    if (!consent || consent.subject_id !== actorId) throw permissionDenied('Only the consent subject can withdraw this consent');
    if (consent.withdrawn_at === null) {
      consent.withdrawn_at = instant(this.now);
      this.repositories.consents.save(consent);
    }
    return { withdrawn_at: consent.withdrawn_at };
  }

  invite(actorId: string, input: RelationInvitationInput): RelationInvitationResponse {
    this.requireAccount(actorId);
    const helper = this.requireAccount(input.helper_ref);
    if (helper.account_id === actorId) throw permissionDenied('An account cannot invite itself');
    const scopes = this.validateScopes(input.requested_scopes);
    if (scopes.length === 0) throw new DomainError(400, 'INVALID_REQUEST', 'At least one requested scope is required');
    const existing = this.repositories.invitations.findPending(actorId, helper.account_id, scopes);
    if (existing && Date.parse(existing.expires_at) > this.now()) return { invitation_id: existing.invitation_id, expires_at: existing.expires_at };
    const invitation: InvitationRecord = {
      invitation_id: randomUUID(),
      subject_id: actorId,
      helper_id: helper.account_id,
      requested_scopes: scopes,
      expires_at: instant(this.now, this.invitationTtlMs),
      status: 'pending',
      accepted_relation_id: null,
    };
    this.repositories.invitations.save(invitation);
    return { invitation_id: invitation.invitation_id, expires_at: invitation.expires_at };
  }

  accept(actorId: string, invitationId: string, input: RelationAcceptInput): RelationResponse {
    const invitation = this.repositories.invitations.get(invitationId);
    if (!invitation || invitation.helper_id !== actorId) throw permissionDenied('Only the invited helper can accept this invitation');
    if (invitation.status === 'accepted' && invitation.accepted_relation_id) {
      const relation = this.repositories.relations.get(invitation.accepted_relation_id);
      if (!relation) throw new DomainError(409, 'VERSION_CONFLICT', 'Accepted invitation has no relation');
      if (!equalScopes(relation.scopes, input.scopes) || relation.consent_id !== input.consent_id) throw new DomainError(409, 'VERSION_CONFLICT', 'Invitation was already accepted', false, { current_version: relation.version, conflict_id: relation.relation_id });
      return { relation: toRelationDto(relation) };
    }
    if (invitation.status !== 'pending') throw permissionDenied('Invitation is not active');
    if (Date.parse(invitation.expires_at) <= this.now()) throw new DomainError(410, 'INVITE_EXPIRED', 'Invitation expired');
    const scopes = this.validateScopes(input.scopes);
    if (!hasAllScopes(invitation.requested_scopes, scopes)) throw scopeDenied('Accepted scopes exceed the invitation');
    const consent = this.requireCurrentConsent(input.consent_id, invitation.subject_id);
    if (!hasAllScopes(consent.scopes, scopes)) throw scopeDenied('Accepted scopes exceed the current consent');
    const subject = this.requireAccount(invitation.subject_id);
    const relation: RelationRecord = {
      relation_id: randomUUID(),
      subject_id: invitation.subject_id,
      helper_id: actorId,
      label: subject.profile_label,
      scopes,
      consent_id: consent.consent_id,
      status: 'active',
      grant_revision: 1,
      version: 1,
      created_at: instant(this.now),
      updated_at: instant(this.now),
      deleted_at: null,
      revoked_at: null,
    };
    this.repositories.relations.save(relation);
    invitation.status = 'accepted';
    invitation.accepted_relation_id = relation.relation_id;
    this.repositories.invitations.save(invitation);
    return { relation: toRelationDto(relation) };
  }

  list(actorId: string): RelationDto[] {
    this.requireAccount(actorId);
    return this.repositories.relations.listByParticipant(actorId).map(toRelationDto);
  }

  updateGrants(actorId: string, relationId: string, scopes: Scope[], consentId: string, expectedRevision?: number): { grant_revision: number } {
    const relation = this.requireRelation(relationId);
    if (relation.subject_id !== actorId) throw permissionDenied('Only the subject can update relation grants');
    if (relation.status !== 'active') throw permissionDenied('Relation has been revoked');
    if (expectedRevision !== undefined && expectedRevision !== relation.grant_revision) throw new DomainError(409, 'VERSION_CONFLICT', 'Relation grant revision is stale', false, { current_version: relation.grant_revision, conflict_id: relation.relation_id });
    const normalizedScopes = this.validateScopes(scopes);
    const consent = this.requireCurrentConsent(consentId, relation.subject_id);
    if (!hasAllScopes(consent.scopes, normalizedScopes)) throw scopeDenied('Granted scopes exceed the current consent');
    if (equalScopes(relation.scopes, normalizedScopes) && relation.consent_id === consentId) return { grant_revision: relation.grant_revision };
    relation.scopes = normalizedScopes;
    relation.consent_id = consentId;
    relation.grant_revision += 1;
    relation.version += 1;
    relation.updated_at = instant(this.now);
    this.repositories.relations.save(relation);
    return { grant_revision: relation.grant_revision };
  }

  revoke(actorId: string, relationId: string): { revoked_at: string } {
    const relation = this.requireRelation(relationId);
    if (relation.subject_id !== actorId && relation.helper_id !== actorId) throw permissionDenied('Only a relation participant can revoke it');
    if (relation.status === 'revoked' && relation.revoked_at) return { revoked_at: relation.revoked_at };
    relation.status = 'revoked';
    relation.revoked_at = instant(this.now);
    relation.updated_at = relation.revoked_at;
    relation.version += 1;
    this.repositories.relations.save(relation);
    return { revoked_at: relation.revoked_at };
  }

  authorize(actorId: string, subjectId: string, scope: Scope): RelationDto {
    if (actorId === subjectId) {
      this.requireAccount(actorId);
      return {
        relation_id: 'self',
        subject_id: subjectId,
        helper_id: actorId,
        label: 'self',
        scopes: [scope],
        status: 'active',
        grant_revision: 1,
        version: 1,
        created_at: instant(this.now),
        updated_at: instant(this.now),
        deleted_at: null,
      };
    }
    const relation = this.requireRelationByParticipants(subjectId, actorId);
    if (relation.status !== 'active') throw permissionDenied('Relation has been revoked');
    if (!relation.scopes.includes(scope)) throw scopeDenied();
    const consent = this.repositories.consents.get(relation.consent_id);
    if (!consent || consent.withdrawn_at !== null) throw consentRequired('Consent was withdrawn');
    if (!consent.scopes.includes(scope)) throw scopeDenied('Current consent does not include this scope');
    return toRelationDto(relation);
  }

  private requireAccount(accountId: string): AccountRecord {
    const account = this.repositories.accounts.get(accountId);
    if (!account) throw permissionDenied('Account is not available');
    return account;
  }

  private requireRelation(relationId: string): RelationRecord {
    const relation = this.repositories.relations.get(relationId);
    if (!relation) throw permissionDenied('Relation is not available');
    return relation;
  }

  private requireRelationByParticipants(subjectId: string, helperId: string): RelationRecord {
    const relation = this.repositories.relations.find(subjectId, helperId);
    if (!relation) throw permissionDenied('Relation is not available');
    return relation;
  }

  private requireCurrentConsent(consentId: string, subjectId: string): ConsentRecord {
    const consent = this.repositories.consents.get(consentId);
    if (!consent || consent.subject_id !== subjectId || consent.withdrawn_at !== null) throw consentRequired();
    return consent;
  }

  private validateScopes(scopes: Scope[]): Scope[] {
    if (!Array.isArray(scopes) || scopes.some(scope => !supportedScopes.includes(scope))) throw new DomainError(400, 'INVALID_REQUEST', 'Unsupported relation scope');
    return uniqueScopes(scopes);
  }
}

