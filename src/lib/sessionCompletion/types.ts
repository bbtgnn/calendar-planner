import type { Icon } from '@lucide/svelte';
import type { LessonSessionKind } from '$lib/db/types';

export type CriterionStatus = { id: string; satisfied: boolean };

export type CriterionDef = {
	id: string;
	label: string;
	icon: typeof Icon;
	appliesTo: (kind: LessonSessionKind) => boolean;
};

export type EvaluateInput = {
	lesson: { sessionKind: LessonSessionKind; date: string };
	todayIso: string;
	hasNote: boolean;
	hasScreenshot: boolean;
	stem: string | null;
	presenzeByStem: Map<string, boolean>;
};
