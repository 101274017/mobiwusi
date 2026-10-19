import type { LocalSnapshot } from '@nuanban/application';

export function emptyLocalSnapshot(): LocalSnapshot {
  return { initialized: true, notes: [], todos: [], family: [], outbox: [], conflicts: [],
    preferences: { mode: 'elder', fontScale: 1, captionSize: 32, muted: false, speechRate: 0.75, reducedMotion: false, pet: 'cat', petColor: '#D98347' } };
}
