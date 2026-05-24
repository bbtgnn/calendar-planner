import type { LessonRow, LessonSessionKind } from '$lib/db/types';
import { SessionKindErrorCode, sessionKindError } from '$lib/logic/sessionKindErrors';

export type LessonFieldPatch = Partial<
	Pick<LessonRow, 'date' | 'durationHours' | 'title' | 'done' | 'sessionKind'>
>;

export type LessonWriteContext = {
	current: Pick<LessonRow, 'sessionKind' | 'durationHours' | 'done'>;
	patch: LessonFieldPatch;
	absenceCount: number;
};

export type LessonWritePlan = {
	patch: LessonFieldPatch;
	clearAbsences: boolean;
};

export type LessonFormUi = {
	titleLabel: 'Title' | 'Reason';
	kindLabel: 'Class' | 'Extra' | 'Skipped';
	hoursEditable: boolean;
	doneEditable: boolean;
	attendanceVisible: boolean;
	hoursDisabledTitle: string | undefined;
	doneDisabledTitle: string | undefined;
};

export type AddKindForm = { hours: number; title: string };
export type EditorKindForm = { durationHours: number; done: boolean };

export function lessonFormUi(kind: LessonSessionKind): LessonFormUi {
	const skipped = kind === 'skipped';
	return {
		titleLabel: skipped ? 'Reason' : 'Title',
		kindLabel: kind === 'class' ? 'Class' : kind === 'extra' ? 'Extra' : 'Skipped',
		hoursEditable: !skipped,
		doneEditable: false,
		attendanceVisible: kind === 'class',
		hoursDisabledTitle: skipped ? 'Skipped sessions always use 0 teacher hours.' : undefined,
		doneDisabledTitle: skipped
			? 'Skipped sessions cannot be marked done.'
			: 'Done is set from lesson notes in lezioni/ or extra/ on disk.'
	};
}

export function applyKindToForm(
	prevKind: LessonSessionKind,
	nextKind: LessonSessionKind,
	form: AddKindForm
): AddKindForm;
export function applyKindToForm(
	prevKind: LessonSessionKind,
	nextKind: LessonSessionKind,
	form: EditorKindForm
): EditorKindForm;
export function applyKindToForm(
	prevKind: LessonSessionKind,
	nextKind: LessonSessionKind,
	form: AddKindForm | EditorKindForm
): AddKindForm | EditorKindForm {
	if ('hours' in form && 'title' in form) {
		return syncAddFormToKind(nextKind, applyAddKindTransition(prevKind, nextKind, form));
	}
	return syncEditorFormToKind(nextKind, applyEditorKindTransition(nextKind, form));
}

/** Keep add-session fields consistent with the selected kind (call after kind changes). */
export function syncAddFormToKind(kind: LessonSessionKind, form: AddKindForm): AddKindForm {
	const ui = lessonFormUi(kind);
	return {
		hours: ui.hoursEditable ? form.hours : 0,
		title: form.title
	};
}

/** Keep lesson editor fields consistent with the selected kind. */
export function syncEditorFormToKind(kind: LessonSessionKind, form: EditorKindForm): EditorKindForm {
	const ui = lessonFormUi(kind);
	return {
		durationHours: ui.hoursEditable ? form.durationHours : 0,
		done: ui.doneEditable ? form.done : false
	};
}

/**
 * Plan a lesson create/update patch: validation, coercion, and absence side-effects.
 * Repos apply `patch` and run absence cleanup when `clearAbsences` is true.
 */
export function planLessonWrite(ctx: LessonWriteContext): LessonWritePlan {
	const { current, patch, absenceCount } = ctx;
	const nextKind = patch.sessionKind ?? current.sessionKind;

	if (nextKind === 'extra' && current.sessionKind !== 'extra' && absenceCount > 0) {
		throw sessionKindError(SessionKindErrorCode.EXTRA_BLOCKED_ABSENCES);
	}

	const nextPatch: LessonFieldPatch = { ...patch };

	if (nextKind === 'skipped') {
		nextPatch.durationHours = 0;
	}
	if (patch.done !== undefined && !lessonFormUi(nextKind).doneEditable) {
		nextPatch.done = false;
	}
	if (patch.durationHours !== undefined && !lessonFormUi(nextKind).hoursEditable) {
		nextPatch.durationHours = 0;
	}

	const clearAbsences =
		nextKind === 'skipped' && current.sessionKind !== 'skipped';

	return { patch: nextPatch, clearAbsences };
}

function applyAddKindTransition(
	prevKind: LessonSessionKind,
	nextKind: LessonSessionKind,
	form: AddKindForm
): AddKindForm {
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

function applyEditorKindTransition(nextKind: LessonSessionKind, form: EditorKindForm): EditorKindForm {
	return syncEditorFormToKind(nextKind, {
		durationHours: nextKind === 'skipped' ? 0 : form.durationHours,
		done: lessonFormUi(nextKind).doneEditable ? form.done : false
	});
}
