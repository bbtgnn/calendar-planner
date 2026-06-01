import { describe, expect, it } from 'vitest';
import { matchNotesToLessons } from './match';
import type { LessonRow } from '$lib/db/types';
import type { ScannedNote } from './types';

function lesson(overrides: Partial<LessonRow> & Pick<LessonRow, 'id' | 'date' | 'sessionKind'>): LessonRow {
	return {
		classId: 'c1',
		durationHours: 5,
		title: 'Lesson',
		done: false,
		...overrides
	};
}

const PNGS = {
	lezioni: new Set<string>(),
	extra: new Set<string>()
};

function match(
	lessons: LessonRow[],
	lezioni: ScannedNote[],
	extra: ScannedNote[],
	pngs = PNGS
) {
	return matchNotesToLessons(lessons, lezioni, extra, {
		todayIso: '2026-06-01',
		screenshots: pngs
	});
}

describe('matchNotesToLessons', () => {
	it('marks class session done when lezioni note and paired png exist for date', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { lessons: out, warnings } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-03-09', durationHours: 5 }],
			[],
			{ lezioni: new Set(['09-screen.png']), extra: new Set() }
		);
		expect(out[0].done).toBe(true);
		expect(out[0].screenshotRef).toEqual({ folder: 'lezioni', fileName: '09-screen.png' });
		expect(warnings).toHaveLength(0);
	});

	it('hours mismatch is warning only, still done', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class', durationHours: 5 })];
		const { lessons: out, warnings } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-03-09', durationHours: 4.5 }],
			[],
			{ lezioni: new Set(['09-screen.png']), extra: new Set() }
		);
		expect(out[0].done).toBe(true);
		expect(out[0].hoursWarning?.noteHours).toBe(4.5);
		expect(warnings.some((w) => w.code === 'hours_mismatch')).toBe(true);
	});

	it('orphan lezioni note warns', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-16', sessionKind: 'class' })];
		const { warnings } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '99.md', dateIso: '2026-03-09', durationHours: 1 }],
			[]
		);
		expect(warnings.some((w) => w.code === 'orphan_note')).toBe(true);
	});

	it('duplicate dates in folder warn', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { warnings } = match(
			lessons,
			[
				{ folder: 'lezioni', fileName: '01.md', dateIso: '2026-03-09', durationHours: 5 },
				{ folder: 'lezioni', fileName: '02.md', dateIso: '2026-03-09', durationHours: 5 }
			],
			[]
		);
		expect(warnings.some((w) => w.code === 'duplicate_date')).toBe(true);
	});

	it('skipped sessions stay not done', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'skipped' })];
		const { lessons: out } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '01.md', dateIso: '2026-03-09', durationHours: 1 }],
			[]
		);
		expect(out[0].done).toBe(false);
		expect(out[0].screenshotMissing).toBeUndefined();
	});

	it('extra sessions use extra folder', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'extra' })];
		const { lessons: out } = match(
			lessons,
			[],
			[{ folder: 'extra', fileName: '01.md', dateIso: '2026-03-09', durationHours: 1 }],
			{ lezioni: new Set(), extra: new Set(['01-screen.png']) }
		);
		expect(out[0].done).toBe(true);
		expect(out[0].screenshotRef).toEqual({ folder: 'extra', fileName: '01-screen.png' });
	});

	it('done only when note and paired png exist (past)', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { lessons: out } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-03-09', durationHours: 5 }],
			[],
			{ lezioni: new Set(['09-screen.png']), extra: new Set() }
		);
		expect(out[0].done).toBe(true);
		expect(out[0].screenshotRef).toEqual({ folder: 'lezioni', fileName: '09-screen.png' });
	});

	it('note without png: not done, screenshotMissing', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { lessons: out } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-03-09', durationHours: 5 }],
			[],
			{ lezioni: new Set(), extra: new Set() }
		);
		expect(out[0].done).toBe(false);
		expect(out[0].screenshotMissing).toBe(true);
	});

	it('past session without note: screenshotMissing', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { lessons: out } = match(lessons, [], []);
		expect(out[0].screenshotMissing).toBe(true);
	});

	it('future session with note+png: not done, no screenshotMissing', () => {
		const lessons = [lesson({ id: '1', date: '2026-12-01', sessionKind: 'class' })];
		const { lessons: out } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-12-01', durationHours: 5 }],
			[],
			{ lezioni: new Set(['09-screen.png']), extra: new Set() }
		);
		expect(out[0].done).toBe(false);
		expect(out[0].screenshotMissing).toBeUndefined();
		expect(out[0].screenshotRef).toEqual({ folder: 'lezioni', fileName: '09-screen.png' });
	});
});
