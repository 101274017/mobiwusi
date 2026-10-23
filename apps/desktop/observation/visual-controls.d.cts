import type { Rect } from './observation-types.cjs';

export interface VisualControl { label: '未标注图标'; surface: 'visual'; rect: Rect; appearance: string }
export function extractVisualControls(input: { bitmap: Buffer; width: number; height: number; exclusions?: Rect[]; signal?: AbortSignal }): VisualControl[];
export function matchesVisualControl(original: { surface?: string; appearance?: string; rect: Rect }, current: { surface?: string; appearance?: string; rect: Rect }): boolean;
