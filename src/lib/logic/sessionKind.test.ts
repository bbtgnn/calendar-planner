import { describe, expect, it } from 'vitest';
import { SessionKindErrorCode } from '$lib/logic/sessionKindErrors';
import {
	applyKindToForm,
	lessonFormUi,
	planLessonWrite,
	syncAddFormToKind,
	syncEditorFormToKind
} from './sessionKind';

describe('lessonFormUi', () => {
	it('forces skipped hours to zero in sync helpers', () => {
		expect(syncEditorFormToKind('skipped', { durationHours: 2, done: true })).toEqual({
			durationHours: 0,
			done: false
		});
		expect(syncAddFormToKind('skipped', { hours: 2, title: 'x' })).toEqual({ hours: 0, title: 'x' });
	});

	it('marks skipped title label as reason', () => {
		expect(lessonFormUi('skipped').titleLabel).toBe('Reason');
		expect(lessonFormUi('class').titleLabel).toBe('Title');
	});

	it('returns display labels for each session kind', () => {
		expect(lessonFormUi('class').kindLabel).toBe('Class');
		expect(lessonFormUi('extra').kindLabel).toBe('Extra');
		expect(lessonFormUi('skipped').kindLabel).toBe('Skipped');
	});

	it('disables hours and done for skipped', () => {
		const skipped = lessonFormUi('skipped');
		expect(skipped.hoursEditable).toBe(false);
		expect(skipped.doneEditable).toBe(false);
		expect(lessonFormUi('extra').hoursEditable).toBe(true);
	});

	it('hides attendance for non-class kinds', () => {
		expect(lessonFormUi('class').attendanceVisible).toBe(true);
		expect(lessonFormUi('extra').attendanceVisible).toBe(false);
		expect(lessonFormUi('skipped').attendanceVisible).toBe(false);
	});
});

describe('planLessonWrite', () => {
	it('blocks class to extra when absences exist', () => {
		expect(() =>
			planLessonWrite({
				current: { sessionKind: 'class', durationHours: 1, done: false },
				patch: { sessionKind: 'extra' },
				absenceCount: 1
			})
		).toThrow(SessionKindErrorCode.EXTRA_BLOCKED_ABSENCES);
		expect(() =>
			planLessonWrite({
				current: { sessionKind: 'class', durationHours: 1, done: false },
				patch: { sessionKind: 'extra' },
				absenceCount: 0
			})
		).not.toThrow();
	});

	it('coerces skipped patch hours to zero', () => {
		expect(
			planLessonWrite({
				current: { sessionKind: 'class', durationHours: 2, done: false },
				patch: { sessionKind: 'skipped', durationHours: 2 },
				absenceCount: 0
			})
		).toEqual({
			patch: { sessionKind: 'skipped', durationHours: 0 },
			clearAbsences: true
		});
	});

	it('clears absences when entering skipped', () => {
		expect(
			planLessonWrite({
				current: { sessionKind: 'class', durationHours: 1, done: false },
				patch: { sessionKind: 'skipped' },
				absenceCount: 0
			}).clearAbsences
		).toBe(true);
		expect(
			planLessonWrite({
				current: { sessionKind: 'skipped', durationHours: 0, done: false },
				patch: { sessionKind: 'skipped' },
				absenceCount: 0
			}).clearAbsences
		).toBe(false);
	});

	it('stores zero hours for new skipped lessons', () => {
		expect(
			planLessonWrite({
				current: { sessionKind: 'skipped', durationHours: 2, done: false },
				patch: { sessionKind: 'skipped', durationHours: 2 },
				absenceCount: 0
			}).patch.durationHours
		).toBe(0);
	});

	it('keeps skipped duration at 0 when duration patch is provided', () => {
		expect(
			planLessonWrite({
				current: { sessionKind: 'skipped', durationHours: 0, done: false },
				patch: { durationHours: 4 },
				absenceCount: 0
			}).patch.durationHours
		).toBe(0);
	});
});

describe('applyKindToForm', () => {
	it('derives editor fields on kind change', () => {
		expect(applyKindToForm('skipped', 'class', { durationHours: 2, done: true })).toEqual({
			durationHours: 2,
			done: true
		});
		expect(applyKindToForm('class', 'skipped', { durationHours: 2, done: true })).toEqual({
			durationHours: 0,
			done: false
		});
	});

	it('resets add-session form when choosing skipped', () => {
		expect(applyKindToForm('class', 'skipped', { hours: 2, title: 'Lesson' })).toEqual({
			hours: 0,
			title: ''
		});
	});
});
