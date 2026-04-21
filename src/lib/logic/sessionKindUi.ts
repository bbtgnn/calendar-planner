import type { LessonSessionKind } from '$lib/db/types';

export function normalizedHoursForKind(kind: LessonSessionKind, hours: number): number {
	return kind === 'skipped' ? 0 : hours;
}

export function labelForTitleField(kind: LessonSessionKind): 'Title' | 'Reason' {
	return kind === 'skipped' ? 'Reason' : 'Title';
}

export function labelForKind(kind: LessonSessionKind): 'Class' | 'Extra' | 'Skipped' {
	return kind === 'class' ? 'Class' : kind === 'extra' ? 'Extra' : 'Skipped';
}

export function hoursEditableForKind(kind: LessonSessionKind): boolean {
	return kind !== 'skipped';
}

export function doneEditableForKind(kind: LessonSessionKind): boolean {
	return kind !== 'skipped';
}

export function attendanceVisibleForKind(kind: LessonSessionKind): boolean {
	return kind === 'class';
}
