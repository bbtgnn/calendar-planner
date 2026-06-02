import { FileText, Image, Users } from '@lucide/svelte';
import type { CriterionDef, CriterionStatus, EvaluateInput } from './types';

export const SESSION_CRITERIA: CriterionDef[] = [
	{
		id: 'note',
		label: 'Lesson note',
		icon: FileText,
		appliesTo: (k) => k === 'class' || k === 'extra'
	},
	{
		id: 'screenshot',
		label: 'Screenshot',
		icon: Image,
		appliesTo: (k) => k === 'class' || k === 'extra'
	},
	{
		id: 'attendance',
		label: 'Attendance',
		icon: Users,
		appliesTo: (k) => k === 'class'
	}
];

function isPast(dateIso: string, todayIso: string): boolean {
	return dateIso <= todayIso;
}

export function evaluateSessionCriteria(input: EvaluateInput): CriterionStatus[] {
	const { lesson, todayIso, hasNote, hasScreenshot, stem, presenzeByStem } = input;
	if (lesson.sessionKind === 'skipped' || !isPast(lesson.date, todayIso)) return [];

	const hasAttendance =
		stem !== null && presenzeByStem.get(stem) === true;

	return SESSION_CRITERIA.filter((c) => c.appliesTo(lesson.sessionKind)).map((c) => {
		let satisfied = false;
		if (c.id === 'note') satisfied = hasNote;
		else if (c.id === 'screenshot') satisfied = hasScreenshot;
		else if (c.id === 'attendance') satisfied = hasAttendance;
		return { id: c.id, satisfied };
	});
}

export function allCriteriaSatisfied(statuses: CriterionStatus[]): boolean {
	return statuses.length > 0 && statuses.every((s) => s.satisfied);
}
