import { describe, expect, it } from 'vitest';
import type { ClassRow, LessonRow } from '$lib/db/types';
import {
	overviewSpan,
	includedClasses,
	excludedClasses,
	isFullDay,
	buildOverviewDayIndex,
	countsForDate,
	defaultOverviewYearMonth,
	yearMonthInOverviewSpan,
	addYearMonth
} from './overviewCalendar';

const classA = (semester: { start: string; end: string } | null): ClassRow => ({
	id: 'a',
	name: 'Class A',
	totalHoursTarget: 40,
	requiredStudentLessonHours: 0,
	createdAt: 0,
	semesterStart: semester?.start ?? null,
	semesterEnd: semester?.end ?? null
});

describe('overviewCalendar', () => {
	it('overviewSpan returns min start and max end across configured classes', () => {
		const classes = [
			classA({ start: '2026-09-01', end: '2026-12-20' }),
			classA({ start: '2026-01-15', end: '2026-06-30' })
		];
		classes[1].id = 'b';
		expect(overviewSpan(classes)).toEqual({ start: '2026-01-15', end: '2026-12-20' });
	});

	it('overviewSpan is null when no class has both semester dates', () => {
		expect(overviewSpan([classA(null)])).toBeNull();
	});

	it('overviewSpan ignores classes without semester', () => {
		const without = classA(null);
		without.id = 'x';
		expect(
			overviewSpan([classA({ start: '2026-01-01', end: '2026-06-01' }), without])
		).toEqual({ start: '2026-01-01', end: '2026-06-01' });
	});

	it('includedClasses / excludedClasses partition by semester pair', () => {
		const configured = classA({ start: '2026-01-01', end: '2026-06-01' });
		const without = classA(null);
		without.id = 'x';
		expect(includedClasses([configured, without]).map((c) => c.id)).toEqual(['a']);
		expect(excludedClasses([configured, without]).map((c) => c.id)).toEqual(['x']);
	});

	it('isFullDay is true at 2+', () => {
		expect(isFullDay(0)).toBe(false);
		expect(isFullDay(1)).toBe(false);
		expect(isFullDay(2)).toBe(true);
	});

	it('buildOverviewDayIndex counts lessons only inside each class semester', () => {
		const classes = [classA({ start: '2026-04-01', end: '2026-04-30' })];
		const lessons: LessonRow[] = [
			{
				id: '1',
				classId: 'a',
				date: '2026-03-31',
				durationHours: 2,
				title: 'Out',
				done: false,
				sessionKind: 'class'
			},
			{
				id: '2',
				classId: 'a',
				date: '2026-04-01',
				durationHours: 2,
				title: 'In1',
				done: false,
				sessionKind: 'class'
			},
			{
				id: '3',
				classId: 'a',
				date: '2026-04-01',
				durationHours: 2,
				title: 'In2',
				done: false,
				sessionKind: 'skipped'
			}
		];
		const index = buildOverviewDayIndex(classes, { a: lessons });
		expect(countsForDate(index, '2026-03-31')).toBeNull();
		const apr1 = countsForDate(index, '2026-04-01');
		expect(apr1?.total).toBe(2);
		expect(apr1?.byClass).toEqual([{ classId: 'a', className: 'Class A', count: 2 }]);
		expect(isFullDay(apr1!.total)).toBe(true);
	});

	it('buildOverviewDayIndex aggregates across two classes on same day', () => {
		const c1 = classA({ start: '2026-04-01', end: '2026-04-30' });
		const c2 = classA({ start: '2026-04-01', end: '2026-04-30' });
		c2.id = 'b';
		c2.name = 'Class B';
		const index = buildOverviewDayIndex([c1, c2], {
			a: [
				{
					id: '1',
					classId: 'a',
					date: '2026-04-10',
					durationHours: 2,
					title: 'A',
					done: false,
					sessionKind: 'class'
				}
			],
			b: [
				{
					id: '2',
					classId: 'b',
					date: '2026-04-10',
					durationHours: 2,
					title: 'B',
					done: false,
					sessionKind: 'class'
				}
			]
		});
		expect(countsForDate(index, '2026-04-10')?.total).toBe(2);
	});

	it('defaultOverviewYearMonth picks today month when in span', () => {
		expect(
			defaultOverviewYearMonth({ start: '2026-04-01', end: '2026-06-30' }, '2026-05-15')
		).toBe('2026-05');
	});

	it('defaultOverviewYearMonth picks first month when today outside span', () => {
		expect(
			defaultOverviewYearMonth({ start: '2026-04-01', end: '2026-06-30' }, '2026-01-01')
		).toBe('2026-04');
	});

	it('yearMonthInOverviewSpan and addYearMonth', () => {
		const span = { start: '2026-04-05', end: '2026-06-10' };
		expect(yearMonthInOverviewSpan('2026-03', span)).toBe(false);
		expect(yearMonthInOverviewSpan('2026-04', span)).toBe(true);
		expect(yearMonthInOverviewSpan('2026-07', span)).toBe(false);
		expect(addYearMonth('2026-04', 1)).toBe('2026-05');
		expect(addYearMonth('2026-12', 1)).toBe('2027-01');
	});
});
