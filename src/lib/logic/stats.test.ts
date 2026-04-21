import { describe, expect, it } from 'vitest';
import {
	doneClassLessonCount,
	doneExtraSessionCount,
	doneLessonCount,
	maxExtraTeacherHours,
	minimumClassTeacherHoursForStudentLessonHours,
	remainingFlexTeacherHours,
	remainingHours,
	scheduledClassLessonCount,
	scheduledExtraSessionCount,
	scheduledLessonCount,
	studentHoursFromTeacherHours,
	sumScheduledHours,
	totalUnscheduledContractTeacherHours,
	unplannedClassTeacherHours
} from './stats';
import type { LessonForContractStats } from './stats';

describe('stats', () => {
	it('sumScheduledHours sums durationHours', () => {
		expect(sumScheduledHours([{ durationHours: 2 }, { durationHours: 1.5 }])).toBe(3.5);
		expect(sumScheduledHours([])).toBe(0);
	});

	it('remainingHours is target minus scheduled', () => {
		expect(remainingHours(10, 3)).toBe(7);
		expect(remainingHours(10, 12)).toBe(-2);
	});

	it('scheduledLessonCount and doneLessonCount are class-only', () => {
		const lessons: LessonForContractStats[] = [
			{ done: true, durationHours: 1, sessionKind: 'class' },
			{ done: false, durationHours: 2, sessionKind: 'class' },
			{ done: true, durationHours: 0.5, sessionKind: 'extra' }
		];
		expect(scheduledLessonCount(lessons)).toBe(2);
		expect(doneLessonCount(lessons)).toBe(1);
	});

	it('studentHoursFromTeacherHours and minimumClassTeacherHoursForStudentLessonHours', () => {
		expect(studentHoursFromTeacherHours(5)).toBe(6);
		expect(minimumClassTeacherHoursForStudentLessonHours(6)).toBe(5);
	});

	it('unplannedClassTeacherHours', () => {
		expect(unplannedClassTeacherHours(6, 5)).toBe(0);
		expect(unplannedClassTeacherHours(6, 4)).toBe(1);
	});

	it('maxExtraTeacherHours', () => {
		expect(maxExtraTeacherHours(20, 6)).toBe(15);
	});

	it('remainingFlexTeacherHours', () => {
		expect(remainingFlexTeacherHours(10, 6, 6, 1)).toBe(3);
	});

	it('totalUnscheduledContractTeacherHours', () => {
		expect(totalUnscheduledContractTeacherHours(10, 6, 1)).toBe(3);
	});

	it('class vs extra counts', () => {
		const lessons: LessonForContractStats[] = [
			{ done: true, durationHours: 1, sessionKind: 'class' },
			{ done: false, durationHours: 1, sessionKind: 'class' },
			{ done: false, durationHours: 1, sessionKind: 'extra' }
		];
		expect(scheduledClassLessonCount(lessons)).toBe(2);
		expect(doneClassLessonCount(lessons)).toBe(1);
		expect(scheduledExtraSessionCount(lessons)).toBe(1);
		expect(doneExtraSessionCount(lessons)).toBe(0);
	});

	it('skipped sessions do not affect class/extra lesson counts', () => {
		const lessons: LessonForContractStats[] = [
			{ done: true, durationHours: 1, sessionKind: 'class' },
			{ done: false, durationHours: 1, sessionKind: 'extra' },
			{ done: true, durationHours: 0, sessionKind: 'skipped' }
		];
		expect(scheduledLessonCount(lessons)).toBe(1);
		expect(doneLessonCount(lessons)).toBe(1);
		expect(scheduledExtraSessionCount(lessons)).toBe(1);
		expect(doneExtraSessionCount(lessons)).toBe(0);
	});
});
