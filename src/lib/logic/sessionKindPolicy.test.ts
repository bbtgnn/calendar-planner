import { describe, expect, it } from 'vitest';
import { RepoErrorCode } from '$lib/kit/repoErrors';
import {
	assertCanChangeSessionKind,
	attendanceVisibleForKind,
	coerceLessonPatchForSessionKind,
	doneEditableForKind,
	durationHoursForNewLesson,
	hoursEditableForKind,
	labelForKind,
	labelForTitleField,
	lessonFieldsForSessionKindChange,
	newSessionFormAfterKindChange,
	normalizedHoursForKind,
	shouldClearAbsencesOnSessionKindChange
} from './sessionKindPolicy';

describe('sessionKindPolicy display', () => {
	it('forces skipped hours to zero', () => {
		expect(normalizedHoursForKind('skipped', 2)).toBe(0);
		expect(normalizedHoursForKind('class', 2)).toBe(2);
	});

	it('marks skipped title label as reason', () => {
		expect(labelForTitleField('skipped')).toBe('Reason');
		expect(labelForTitleField('class')).toBe('Title');
	});

	it('returns display labels for each session kind', () => {
		expect(labelForKind('class')).toBe('Class');
		expect(labelForKind('extra')).toBe('Extra');
		expect(labelForKind('skipped')).toBe('Skipped');
	});

	it('disables hours and done for skipped', () => {
		expect(hoursEditableForKind('skipped')).toBe(false);
		expect(doneEditableForKind('skipped')).toBe(false);
		expect(hoursEditableForKind('extra')).toBe(true);
	});

	it('hides attendance for non-class kinds', () => {
		expect(attendanceVisibleForKind('class')).toBe(true);
		expect(attendanceVisibleForKind('extra')).toBe(false);
		expect(attendanceVisibleForKind('skipped')).toBe(false);
	});
});

describe('sessionKindPolicy write', () => {
	it('blocks class to extra when absences exist', () => {
		expect(() => assertCanChangeSessionKind('class', 'extra', 1)).toThrow(
			RepoErrorCode.SESSION_KIND_EXTRA_BLOCKED_ABSENCES
		);
		expect(() => assertCanChangeSessionKind('class', 'extra', 0)).not.toThrow();
	});

	it('coerces skipped patch hours to zero', () => {
		expect(coerceLessonPatchForSessionKind('class', { sessionKind: 'skipped', durationHours: 2 })).toEqual({
			sessionKind: 'skipped',
			durationHours: 0
		});
	});

	it('clears absences when entering skipped', () => {
		expect(shouldClearAbsencesOnSessionKindChange('class', 'skipped')).toBe(true);
		expect(shouldClearAbsencesOnSessionKindChange('skipped', 'skipped')).toBe(false);
	});

	it('stores zero hours for new skipped lessons', () => {
		expect(durationHoursForNewLesson('skipped', 2)).toBe(0);
	});

	it('derives editor fields on kind change', () => {
		expect(lessonFieldsForSessionKindChange('skipped', { durationHours: 2, done: true })).toEqual({
			durationHours: 0,
			done: false
		});
	});

	it('resets add-session form when choosing skipped', () => {
		expect(newSessionFormAfterKindChange('class', 'skipped', { hours: 2, title: 'Lesson' })).toEqual({
			hours: 0,
			title: ''
		});
	});
});
