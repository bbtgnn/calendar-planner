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
	pngs = PNGS,
	presenzeByStem = new Map<string, boolean>()
) {
	return matchNotesToLessons(lessons, lezioni, extra, {
		todayIso: '2026-06-01',
		screenshots: pngs,
		presenzeByStem
	});
}

const CLASS_PRESENZE = new Map([['09', true]]);

describe('matchNotesToLessons', () => {
	it('marks class session done when note, png, and presenze exist for date', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { lessons: out, warnings } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-03-09', durationHours: 5 }],
			[],
			{ lezioni: new Set(['09-screen.png']), extra: new Set() },
			CLASS_PRESENZE
		);
		expect(out[0].done).toBe(true);
		expect(out[0].screenshotRef).toEqual({ folder: 'lezioni', fileName: '09-screen.png' });
		expect(out[0].criteria?.every((c) => c.satisfied)).toBe(true);
		expect(warnings).toHaveLength(0);
	});

	it('hours mismatch is warning only, still done when criteria met', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class', durationHours: 5 })];
		const { lessons: out, warnings } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-03-09', durationHours: 4.5 }],
			[],
			{ lezioni: new Set(['09-screen.png']), extra: new Set() },
			CLASS_PRESENZE
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
		expect(out[0].criteria).toBeUndefined();
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

	it('class not done without presenze even with note and png', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { lessons: out } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-03-09', durationHours: 5 }],
			[],
			{ lezioni: new Set(['09-screen.png']), extra: new Set() }
		);
		expect(out[0].done).toBe(false);
		expect(out[0].criteria?.find((c) => c.id === 'attendance')?.satisfied).toBe(false);
		expect(out[0].screenshotRef).toEqual({ folder: 'lezioni', fileName: '09-screen.png' });
	});

	it('note without png: not done, screenshot criterion unsatisfied', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { lessons: out } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-03-09', durationHours: 5 }],
			[],
			{ lezioni: new Set(), extra: new Set() },
			CLASS_PRESENZE
		);
		expect(out[0].done).toBe(false);
		expect(out[0].criteria?.find((c) => c.id === 'screenshot')?.satisfied).toBe(false);
	});

	it('past session without note: criteria all unsatisfied', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { lessons: out } = match(lessons, [], []);
		expect(out[0].done).toBe(false);
		expect(out[0].criteria?.length).toBe(3);
		expect(out[0].criteria?.every((c) => !c.satisfied)).toBe(true);
	});

	it('future session with note+png: not done, no criteria', () => {
		const lessons = [lesson({ id: '1', date: '2026-12-01', sessionKind: 'class' })];
		const { lessons: out } = match(
			lessons,
			[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-12-01', durationHours: 5 }],
			[],
			{ lezioni: new Set(['09-screen.png']), extra: new Set() },
			CLASS_PRESENZE
		);
		expect(out[0].done).toBe(false);
		expect(out[0].criteria).toEqual([]);
		expect(out[0].screenshotRef).toEqual({ folder: 'lezioni', fileName: '09-screen.png' });
	});
});
