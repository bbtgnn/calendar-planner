import { RepoErrorCode, repoError } from '$lib/kit/repoErrors';
import type { LessonRow, LessonSessionKind } from '$lib/db/types';

export type LessonFieldPatch = Partial<
	Pick<LessonRow, 'date' | 'durationHours' | 'title' | 'done' | 'sessionKind'>
>;

// —— Display / form rules (read-only policy) ——

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

/** Local form state when the user picks a session kind on “add session”. */
export function newSessionFormAfterKindChange(
	prevKind: LessonSessionKind,
	nextKind: LessonSessionKind,
	form: { hours: number; title: string }
): { hours: number; title: string } {
	if (nextKind === 'skipped') {
		return {
			hours: 0,
			title: form.title === 'Lesson' ? '' : form.title
		};
	}
	if (prevKind === 'skipped' && form.hours === 0) {
		return { hours: 2, title: form.title };
	}
	return form;
}

/** Optimistic lesson editor fields when session kind changes. */
export function lessonFieldsForSessionKindChange(
	nextKind: LessonSessionKind,
	current: { durationHours: number; done: boolean }
): { durationHours: number; done: boolean } {
	return {
		durationHours: normalizedHoursForKind(nextKind, current.durationHours),
		done: doneEditableForKind(nextKind) ? current.done : false
	};
}

// —— Write-time policy (repos) ——

export function assertCanChangeSessionKind(
	currentKind: LessonSessionKind,
	nextKind: LessonSessionKind,
	absenceCount: number
): void {
	if (nextKind === 'extra' && currentKind !== 'extra' && absenceCount > 0) {
		throw repoError(RepoErrorCode.SESSION_KIND_EXTRA_BLOCKED_ABSENCES);
	}
}

export function shouldClearAbsencesOnSessionKindChange(
	currentKind: LessonSessionKind,
	nextKind: LessonSessionKind
): boolean {
	return nextKind === 'skipped' && currentKind !== 'skipped';
}

export function coerceLessonPatchForSessionKind(
	currentKind: LessonSessionKind,
	patch: LessonFieldPatch
): LessonFieldPatch {
	const nextKind = patch.sessionKind ?? currentKind;
	const nextPatch: LessonFieldPatch = { ...patch };

	if (nextKind === 'skipped') {
		nextPatch.durationHours = 0;
	}
	if (patch.done !== undefined && !doneEditableForKind(nextKind)) {
		nextPatch.done = false;
	}

	return nextPatch;
}

export function durationHoursForNewLesson(
	sessionKind: LessonSessionKind,
	durationHours: number
): number {
	return normalizedHoursForKind(sessionKind, durationHours);
}
