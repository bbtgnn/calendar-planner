import type { LessonRow, LessonSessionKind } from '$lib/db/types';

export function compareIsoDate(a: string, b: string): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

export function isDateInSemester(isoDate: string, start: string, end: string): boolean {
	return compareIsoDate(isoDate, start) >= 0 && compareIsoDate(isoDate, end) <= 0;
}

/** Inclusive list of `YYYY-MM` calendar months from startIso through endIso. */
export function listYearMonthsInRange(startIso: string, endIso: string): string[] {
	const [ys, ms] = startIso.split('-').map(Number);
	const [ye, me] = endIso.split('-').map(Number);
	const out: string[] = [];
	let y = ys;
	let m = ms;
	while (y < ye || (y === ye && m <= me)) {
		out.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`);
		m += 1;
		if (m > 12) {
			m = 1;
			y += 1;
		}
	}
	return out;
}

export type MonthCell = { isoDate: string } | { pad: true };

/** 6×7 grid, Monday-first week row; `pad` cells are outside the requested month. */
export function monthGridMondayFirst(yearMonth: string): MonthCell[] {
	const [Y, M] = yearMonth.split('-').map(Number);
	const first = new Date(Date.UTC(Y, M - 1, 1));
	const dow = first.getUTCDay();
	const mondayOffset = (dow + 6) % 7;
	const gridStart = new Date(Date.UTC(Y, M - 1, 1 - mondayOffset));
	const cells: MonthCell[] = [];
	for (let i = 0; i < 42; i++) {
		const t = gridStart.getTime() + i * 86400000;
		const d = new Date(t);
		const yy = d.getUTCFullYear();
		const mm = d.getUTCMonth() + 1;
		const dd = d.getUTCDate();
		if (yy === Y && mm === M) {
			cells.push({
				isoDate: `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
			});
		} else {
			cells.push({ pad: true });
		}
	}
	return cells;
}

/** e.g. `2026-04` → `April 2026` (UTC, en-US) for month titles. */
export function formatYearMonthHeading(yearMonth: string): string {
	const [y, m] = yearMonth.split('-').map(Number);
	const d = new Date(Date.UTC(y, m - 1, 1));
	return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function uniqueKindsByDate(
	lessons: Pick<LessonRow, 'date' | 'sessionKind'>[]
): Map<string, Set<LessonSessionKind>> {
	const map = new Map<string, Set<LessonSessionKind>>();
	for (const l of lessons) {
		let s = map.get(l.date);
		if (!s) {
			s = new Set();
			map.set(l.date, s);
		}
		s.add(l.sessionKind);
	}
	return map;
}

export function mergeSemesterFields(
	existing: { semesterStart: string | null; semesterEnd: string | null },
	patch: Partial<{ semesterStart: string | null; semesterEnd: string | null }>
): { semesterStart: string | null; semesterEnd: string | null } {
	return {
		semesterStart: patch.semesterStart !== undefined ? patch.semesterStart : existing.semesterStart,
		semesterEnd: patch.semesterEnd !== undefined ? patch.semesterEnd : existing.semesterEnd
	};
}

/** Throws `Error` with a user-facing message if the pair is invalid. */
export function assertValidSemesterBounds(start: string | null, end: string | null): void {
	if (start === null && end === null) return;
	if (start === null || end === null) {
		throw new Error('Semester start and end must both be set, or both cleared.');
	}
	if (compareIsoDate(start, end) > 0) {
		throw new Error('Semester start must be on or before semester end.');
	}
}
