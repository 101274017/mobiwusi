import { choice, instant, integer, list, literal, object, ref, text, timezone, type Schema } from './primitives.ts';
import { standaloneGuidanceErrorCodes } from './errors.ts';

export const standaloneGuidanceIdentifier: Schema = { ...text(128), pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$', example: 'standalone-1' };
const hash: Schema = { ...text(64, 64), pattern: '^[a-fA-F0-9]{64}$', example: 'a'.repeat(64) };
const timestamp: Schema = { ...instant, pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-](?:(?:0\\d|1[0-3]):[0-5]\\d|14:00))$' };
const nonblank = (maximum: number): Schema => ({ ...text(maximum), pattern: '\\S' });
const labels = list(nonblank(48), 16);
const correlation = {
  observation_id: standaloneGuidanceIdentifier,
  guide_id: standaloneGuidanceIdentifier,
  observation_generation: integer(1),
  task_generation: integer(1),
  trigger_id: standaloneGuidanceIdentifier,
  frame_id: standaloneGuidanceIdentifier,
};

export const standaloneGuidanceDefinitions: Record<string, Schema> = {
  StandaloneGuidanceRect: object({ x: { type: 'number', minimum: 0, maximum: 4096 }, y: { type: 'number', minimum: 0, maximum: 4096 }, width: { type: 'number', exclusiveMinimum: 0, maximum: 4096 }, height: { type: 'number', exclusiveMinimum: 0, maximum: 4096 } }),
  StandaloneGuidanceElement: object({ id: standaloneGuidanceIdentifier, label: nonblank(48), rect: ref('StandaloneGuidanceRect') }),
  StandaloneGuidanceImage: object({
    mime: literal('image/png'),
    base64: {
      ...text(2_700_000, 76),
      pattern: '^(?=iVBORw0KGgo)(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/][AQgw]==|[A-Za-z0-9+/]{2}[AEIMQUYcgkosw048]=)?$',
      example: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    },
  }),
  StandaloneGuidancePreviousStep: object({ instruction: nonblank(600), expected_labels: labels }),
  StandaloneGuidanceClarificationReply: object({ question: nonblank(600), answer: nonblank(500) }),
  StandaloneGuidanceReviewProposal: object({ remind_at: timestamp, timezone: { ...timezone, maxLength: 64 }, reason: nonblank(240) }),
  StandaloneGuidanceAnalyzeRequest: {
    ...object({
      ...correlation,
      trigger_reason: choice('question', 'page_changed', 'verification'),
      frame_hash: hash,
      sanitized_sha256: hash,
      captured_at: timestamp,
      image: ref('StandaloneGuidanceImage'),
      redaction_profile: literal('all_text_and_faces_v1'),
      local_safety: literal('safe'),
      question: text(2000, 0),
      clarification_replies: list(ref('StandaloneGuidanceClarificationReply'), 3),
      elements: list(ref('StandaloneGuidanceElement'), 80),
      previous_step: ref('StandaloneGuidancePreviousStep'),
    }, ['previous_step', 'clarification_replies']),
    anyOf: [
      { type: 'object', properties: { trigger_reason: literal('question'), question: nonblank(2000) }, required: ['trigger_reason', 'question'] },
      { type: 'object', properties: { trigger_reason: choice('page_changed', 'verification') }, required: ['trigger_reason'] },
    ],
  },
  StandaloneGuidanceResult: {
    oneOf: [
      {
        ...object({ ...correlation, kind: literal('step'), instruction: nonblank(600), target_id: standaloneGuidanceIdentifier, presentation: choice('confirmed', 'uncertain_candidate'), expected_labels: labels, evidence_labels: labels }, ['target_id', 'presentation', 'expected_labels', 'evidence_labels']),
        dependentRequired: { target_id: ['presentation'], presentation: ['target_id'] },
      },
      object({ ...correlation, kind: literal('completed'), instruction: nonblank(600), evidence_labels: list(nonblank(48), 16, 1), review_proposal: ref('StandaloneGuidanceReviewProposal') }, ['review_proposal']),
      object({ ...correlation, kind: literal('clarify'), instruction: nonblank(600) }),
      object({ ...correlation, kind: literal('unsupported'), instruction: nonblank(600) }),
    ],
  },
  StandaloneGuidanceErrorCode: choice(...standaloneGuidanceErrorCodes),
};
