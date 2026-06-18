import { describe, expect, it } from 'vitest';
import {
	buildHourProgressRows,
	contractCompletionPercent,
	contractScheduledFillPercent,
	doneClassLessonCount,
	doneExtraSessionCount,
	doneLessonCount,
	effectiveExtraTeacherHourCap,
	maxExtraTeacherHours,
	minimumClassTeacherHoursForStudentLessonHours,
	remainingFlexTeacherHours,
	remainingHours,
	scheduledClassLessonCount,
	scheduledExtraSessionCount,
	scheduledLessonCount,
	studentHoursFromTeacherHours,
	sumDoneTeacherHours,
	sumDoneTeacherHoursForKind,
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

	it('sumDoneTeacherHours counts done class and extra only', () => {
		const lessons: LessonForContractStats[] = [
			{ done: true, durationHours: 2, sessionKind: 'class' },
			{ done: false, durationHours: 3, sessionKind: 'class' },
			{ done: true, durationHours: 1, sessionKind: 'extra' },
			{ done: true, durationHours: 0, sessionKind: 'skipped' }
		];
		expect(sumDoneTeacherHours(lessons)).toBe(3);
	});

	it('sumDoneTeacherHoursForKind counts done hours for one kind only', () => {
		const lessons: LessonForContractStats[] = [
			{ done: true, durationHours: 2, sessionKind: 'class' },
			{ done: false, durationHours: 3, sessionKind: 'class' },
			{ done: true, durationHours: 1, sessionKind: 'extra' },
			{ done: true, durationHours: 0, sessionKind: 'skipped' }
		];
		expect(sumDoneTeacherHoursForKind(lessons, 'class')).toBe(2);
		expect(sumDoneTeacherHoursForKind(lessons, 'extra')).toBe(1);
	});

	it('contractCompletionPercent is done hours over contract N', () => {
		const lessons: LessonForContractStats[] = [
			{ done: true, durationHours: 40, sessionKind: 'class' },
			{ done: false, durationHours: 47, sessionKind: 'class' }
		];
		expect(contractCompletionPercent(100, lessons)).toBe(40);
	});

	it('contractScheduledFillPercent is scheduled hours over contract N', () => {
		expect(contractScheduledFillPercent(100, 87)).toBe(87);
		expect(contractScheduledFillPercent(100, 105)).toBe(105);
		expect(contractScheduledFillPercent(0, 10)).toBe(100);
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

	describe('effectiveExtraTeacherHourCap', () => {
		it('equals static pool when class is at minimum', () => {
			expect(effectiveExtraTeacherHourCap(100, 60, 50)).toBe(50);
		});

		it('shrinks when class exceeds minimum', () => {
			expect(effectiveExtraTeacherHourCap(100, 60, 60)).toBe(40);
		});
	});

	describe('buildHourProgressRows', () => {
		const lessons: LessonForContractStats[] = [
			{ done: true, durationHours: 30, sessionKind: 'class' },
			{ done: false, durationHours: 30, sessionKind: 'class' },
			{ done: true, durationHours: 10, sessionKind: 'extra' },
			{ done: false, durationHours: 5, sessionKind: 'extra' },
			{ done: true, durationHours: 99, sessionKind: 'skipped' }
		];

		it('builds contract, class, extra, and student rows', () => {
			const rows = buildHourProgressRows(100, 60, lessons);
			expect(rows).toHaveLength(4);

			const contract = rows.find((r) => r.key === 'contract')!;
			expect(contract.contract).toBe(100);
			expect(contract.planned).toBe(75);
			expect(contract.done).toBe(40);

			const classRow = rows.find((r) => r.key === 'class')!;
			expect(classRow.contract).toBe(50);
			expect(classRow.planned).toBe(60);
			expect(classRow.done).toBe(30);

			const extra = rows.find((r) => r.key === 'extra')!;
			expect(extra.contract).toBe(40);
			expect(extra.planned).toBe(15);
			expect(extra.done).toBe(10);

			const student = rows.find((r) => r.key === 'student')!;
			expect(student.contract).toBe(60);
			expect(student.planned).toBe(72);
			expect(student.done).toBe(36);
		});

		it('excludes skipped hours from planned and done', () => {
			const rows = buildHourProgressRows(200, 0, lessons);
			expect(rows.find((r) => r.key === 'contract')!.planned).toBe(75);
			expect(rows.find((r) => r.key === 'contract')!.done).toBe(40);
		});

		it('warns when contract cannot cover M', () => {
			const rows = buildHourProgressRows(40, 60, []);
			const extra = rows.find((r) => r.key === 'extra')!;
			expect(extra.warning).toContain('below the minimum');
		});

		it('uses null contract when N is zero', () => {
			const rows = buildHourProgressRows(0, 0, []);
			expect(rows.find((r) => r.key === 'contract')!.contract).toBeNull();
		});
	});
});
