import type { ClassId, ClassRow, LessonRow } from '$lib/db/types';
import { isDateInSemester, listYearMonthsInRange } from '$lib/logic/semesterCalendar';

export type OverviewSpan = { start: string; end: string };

export type ClassDayCount = { classId: ClassId; className: string; count: number };

export type DayCounts = { total: number; byClass: ClassDayCount[] };

export type OverviewDayIndex = Map<string, DayCounts>;

export function hasConfiguredSemester(c: ClassRow): boolean {
	return c.semesterStart != null && c.semesterEnd != null;
}

export function includedClasses(classes: ClassRow[]): ClassRow[] {
	return classes.filter(hasConfiguredSemester);
}

export function excludedClasses(classes: ClassRow[]): ClassRow[] {
	return classes.filter((c) => !hasConfiguredSemester(c));
}

export function overviewSpan(classes: ClassRow[]): OverviewSpan | null {
	const included = includedClasses(classes);
	if (included.length === 0) return null;
	let start = included[0].semesterStart!;
	let end = included[0].semesterEnd!;
	for (const c of included.slice(1)) {
		if (c.semesterStart! < start) start = c.semesterStart!;
		if (c.semesterEnd! > end) end = c.semesterEnd!;
	}
	return { start, end };
}

export function isFullDay(total: number): boolean {
	return total >= 2;
}

export function buildOverviewDayIndex(
	included: ClassRow[],
	lessonsByClassId: Record<ClassId, LessonRow[]>
): OverviewDayIndex {
	const index: OverviewDayIndex = new Map();
	for (const c of included) {
		const start = c.semesterStart!;
		const end = c.semesterEnd!;
		for (const lesson of lessonsByClassId[c.id] ?? []) {
			if (!isDateInSemester(lesson.date, start, end)) continue;
			const existing = index.get(lesson.date);
			if (!existing) {
				index.set(lesson.date, {
					total: 1,
					byClass: [{ classId: c.id, className: c.name, count: 1 }]
				});
				continue;
			}
			existing.total += 1;
			const row = existing.byClass.find((r) => r.classId === c.id);
			if (row) row.count += 1;
			else existing.byClass.push({ classId: c.id, className: c.name, count: 1 });
		}
	}
	for (const counts of index.values()) {
		counts.byClass.sort((a, b) => a.className.localeCompare(b.className));
	}
	return index;
}

export function countsForDate(index: OverviewDayIndex, isoDate: string): DayCounts | null {
	return index.get(isoDate) ?? null;
}

export function defaultOverviewYearMonth(span: OverviewSpan, todayIso: string): string {
	const months = listYearMonthsInRange(span.start, span.end);
	const todayYm = todayIso.slice(0, 7);
	if (months.includes(todayYm)) return todayYm;
	return months[0]!;
}

export function addYearMonth(yearMonth: string, delta: number): string {
	const [y, m] = yearMonth.split('-').map(Number);
	const d = new Date(Date.UTC(y, m - 1 + delta, 1));
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** True if the calendar month intersects [span.start, span.end] inclusively. */
export function yearMonthInOverviewSpan(yearMonth: string, span: OverviewSpan): boolean {
	const months = listYearMonthsInRange(span.start, span.end);
	return months.includes(yearMonth);
}
