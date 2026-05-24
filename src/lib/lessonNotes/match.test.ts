import { describe, expect, it } from 'vitest';
import { matchNotesToLessons } from './match';
import type { LessonRow } from '$lib/db/types';

function lesson(overrides: Partial<LessonRow> & Pick<LessonRow, 'id' | 'date' | 'sessionKind'>): LessonRow {
	return {
		classId: 'c1',
		durationHours: 5,
		title: 'Lesson',
		done: false,
		...overrides
	};
}

describe('matchNotesToLessons', () => {
	it('marks class session done when lezioni note exists for date', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { lessons: out, warnings } = matchNotesToLessons(
			lessons,
			[{ folder: 'lezioni', fileName: '01.md', dateIso: '2026-03-09', durationHours: 5 }],
			[]
		);
		expect(out[0].done).toBe(true);
		expect(warnings).toHaveLength(0);
	});

	it('hours mismatch is warning only, still done', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class', durationHours: 5 })];
		const { lessons: out, warnings } = matchNotesToLessons(
			lessons,
			[{ folder: 'lezioni', fileName: '01.md', dateIso: '2026-03-09', durationHours: 4.5 }],
			[]
		);
		expect(out[0].done).toBe(true);
		expect(out[0].hoursWarning?.noteHours).toBe(4.5);
		expect(warnings.some((w) => w.code === 'hours_mismatch')).toBe(true);
	});

	it('orphan lezioni note warns', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-16', sessionKind: 'class' })];
		const { warnings } = matchNotesToLessons(
			lessons,
			[{ folder: 'lezioni', fileName: '99.md', dateIso: '2026-03-09', durationHours: 1 }],
			[]
		);
		expect(warnings.some((w) => w.code === 'orphan_note')).toBe(true);
	});

	it('duplicate dates in folder warn', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { warnings } = matchNotesToLessons(
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
		const { lessons: out } = matchNotesToLessons(
			lessons,
			[{ folder: 'lezioni', fileName: '01.md', dateIso: '2026-03-09', durationHours: 1 }],
			[]
		);
		expect(out[0].done).toBe(false);
	});

	it('extra sessions use extra folder', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'extra' })];
		const { lessons: out } = matchNotesToLessons(
			lessons,
			[],
			[{ folder: 'extra', fileName: '01.md', dateIso: '2026-03-09', durationHours: 1 }]
		);
		expect(out[0].done).toBe(true);
	});
});
