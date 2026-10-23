import type { ScreenElement } from './observation-policy.cjs';

export function selectAnalysisElements(input: {
  frame: { elements: ScreenElement[] }; question: string;
  clarificationReplies?: { answer: string }[];
  previousStep?: { expectedLabels: string[] } | null;
}, limit?: number): ScreenElement[];
