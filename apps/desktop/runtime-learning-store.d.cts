export interface LearningPayloadCodec {
  readonly encrypted: boolean;
  encode(json: string): string;
  decode(encoded: string): string;
}

export type TeachingResult = 'completed' | 'unfinished' | 'interrupted' | 'risk_blocked' | 'failed';
export type Mastery = 'unmastered' | 'mastered';

export interface TeachingInput {
  sourceGuideId: string;
  question: string;
  summary: string;
  result: TeachingResult;
  mastery: 'unmastered';
  startedAt: number;
  endedAt: number;
}

export interface TeachingNote {
  noteId: string;
  ownerId: string;
  sourceGuideId: string;
  question: string;
  summary: string;
  result: TeachingResult;
  mastery: Mastery;
  startedAt: number;
  endedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface ReviewSuggestion {
  sourceGuideId: string;
  remindAt: string;
  timezone: string;
  reason: string;
  source: 'ai';
}

export interface ReviewProposal {
  proposalId: string;
  noteId: string;
  sourceGuideId: string;
  remindAt: string;
  timezone: string;
  reason: string;
  source: 'ai';
  state: 'suggested' | 'accepted' | 'declined';
  reminderId: string | null;
  instanceId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ReviewReminder {
  accountId: string;
  reminderId: string;
  instanceId: string;
  scheduleVersion: 1;
  dueAt: string;
  updatedAt: string;
  deepLink: string;
  payload: {
    title: string;
    safeSummary: string;
    noteId: string;
    sourceGuideId: string;
  };
  proposalId: string;
  status: 'pending' | 'scheduled';
  scheduledAt: number | null;
}

export interface RuntimeLearningStore {
  recordTeaching(input: TeachingInput): TeachingNote;
  getNote(noteId: string): TeachingNote | null;
  listNotes(options?: { limit?: number }): TeachingNote[];
  confirmMastery(input: { actor: 'owner'; noteId: string; mastered: boolean }): TeachingNote;
  getOwnerId(): string;
  suggestReview(input: ReviewSuggestion): ReviewProposal;
  confirmReview(input: { actor: 'owner'; proposalId: string }): ReviewProposal;
  declineReview(input: { actor: 'owner'; proposalId: string }): ReviewProposal;
  pendingReminders(): ReviewReminder[];
  markReminderScheduled(reminderId: string): ReviewReminder;
  getLatest(): { note: TeachingNote | null; proposal: ReviewProposal | null };
  close(): void;
}

export function createRuntimeLearningStore(options: {
  databasePath: string;
  payloadCodec: LearningPayloadCodec;
  now?: () => number;
}): RuntimeLearningStore;
