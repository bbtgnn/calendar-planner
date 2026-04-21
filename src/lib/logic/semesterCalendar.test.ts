import { describe, expect, it } from 'vitest';
import type { LessonSessionKind } from '$lib/db/types';
import {
	compareIsoDate,
	isDateInSemester,
	listYearMonthsInRange,
	monthGridMondayFirst,
	formatYearMonthHeading,
	uniqueKindsByDate,
	mergeSemesterFields,
	assertValidSemesterBounds
} from './semesterCalendar';

describe('semesterCalendar', () => {
	it('compareIsoDate orders YYYY-MM-DD lexicographically', () => {
		expect(compareIsoDate('2026-04-01', '2026-04-02')).toBeLessThan(0);
		expect(compareIsoDate('2026-04-02', '2026-04-02')).toBe(0);
		expect(compareIsoDate('2026-05-01', '2026-04-30')).toBeGreaterThan(0);
	});

	it('isDateInSemester is inclusive on start and end', () => {
		expect(isDateInSemester('2026-04-10', '2026-04-10', '2026-04-20')).toBe(true);
		expect(isDateInSemester('2026-04-20', '2026-04-10', '2026-04-20')).toBe(true);
		expect(isDateInSemester('2026-04-09', '2026-04-10', '2026-04-20')).toBe(false);
		expect(isDateInSemester('2026-04-21', '2026-04-10', '2026-04-20')).toBe(false);
	});

	it('listYearMonthsInRange covers partial months and cross-year', () => {
		expect(listYearMonthsInRange('2026-04-05', '2026-04-20')).toEqual(['2026-04']);
		expect(listYearMonthsInRange('2026-01-01', '2026-03-31')).toEqual(['2026-01', '2026-02', '2026-03']);
		expect(listYearMonthsInRange('2025-11-15', '2026-02-10')).toEqual([
			'2025-11',
			'2025-12',
			'2026-01',
			'2026-02'
		]);
	});

	it('monthGridMondayFirst returns 42 cells with inMonth for title month only', () => {
		const cells = monthGridMondayFirst('2026-04');
		expect(cells).toHaveLength(42);
		const inMonth = cells.filter((c) => c.inMonth);
		expect(inMonth).toHaveLength(30);
		expect(inMonth[0].isoDate).toBe('2026-04-01');
		expect(inMonth[inMonth.length - 1].isoDate).toBe('2026-04-30');
		const leadPad = cells.filter((c) => !c.inMonth);
		expect(leadPad).toHaveLength(12);
		expect(leadPad[0].isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('formatYearMonthHeading uses UTC month name', () => {
		expect(formatYearMonthHeading('2026-04')).toBe('April 2026');
	});

	it('uniqueKindsByDate dedupes kinds per date', () => {
		const lessons = [
			{ date: '2026-04-01', sessionKind: 'class' as LessonSessionKind },
			{ date: '2026-04-01', sessionKind: 'class' as LessonSessionKind },
			{ date: '2026-04-01', sessionKind: 'extra' as LessonSessionKind }
		];
		const m = uniqueKindsByDate(lessons);
		expect([...(m.get('2026-04-01') ?? [])].sort()).toEqual(['class', 'extra']);
	});

	it('assertValidSemesterBounds accepts both null', () => {
		expect(() => assertValidSemesterBounds(null, null)).not.toThrow();
	});

	it('assertValidSemesterBounds rejects one-sided set', () => {
		expect(() => assertValidSemesterBounds('2026-04-01', null)).toThrow(/both/);
		expect(() => assertValidSemesterBounds(null, '2026-04-01')).toThrow(/both/);
	});

	it('assertValidSemesterBounds rejects start after end', () => {
		expect(() => assertValidSemesterBounds('2026-04-10', '2026-04-01')).toThrow(/before/);
	});

	it('mergeSemesterFields applies patch over existing', () => {
		const merged = mergeSemesterFields(
			{ semesterStart: '2026-01-01', semesterEnd: '2026-06-01' },
			{ semesterEnd: '2026-05-01' }
		);
		expect(merged).toEqual({ semesterStart: '2026-01-01', semesterEnd: '2026-05-01' });
	});
});
