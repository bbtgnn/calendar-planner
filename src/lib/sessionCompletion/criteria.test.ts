import { describe, expect, it } from 'vitest';
import {
	evaluateSessionCriteria,
	allCriteriaSatisfied,
	SESSION_CRITERIA
} from './criteria';
import type { LessonRow } from '$lib/db/types';

const lesson = (o: Partial<LessonRow> & Pick<LessonRow, 'sessionKind' | 'date'>): LessonRow => ({
	id: '1',
	classId: 'c1',
	durationHours: 5,
	title: 'L',
	done: false,
	...o
});

describe('evaluateSessionCriteria', () => {
	it('class past: three criteria when note+png+presenze', () => {
		const statuses = evaluateSessionCriteria({
			lesson: lesson({ sessionKind: 'class', date: '2026-03-09' }),
			todayIso: '2026-06-01',
			hasNote: true,
			hasScreenshot: true,
			stem: '09',
			presenzeByStem: new Map([['09', true]])
		});
		expect(statuses).toHaveLength(3);
		expect(allCriteriaSatisfied(statuses)).toBe(true);
	});

	it('extra: no attendance criterion', () => {
		const statuses = evaluateSessionCriteria({
			lesson: lesson({ sessionKind: 'extra', date: '2026-03-09' }),
			todayIso: '2026-06-01',
			hasNote: true,
			hasScreenshot: true,
			stem: '02',
			presenzeByStem: new Map()
		});
		expect(statuses.map((s) => s.id)).toEqual(['note', 'screenshot']);
		expect(allCriteriaSatisfied(statuses)).toBe(true);
	});

	it('future: returns empty (no criteria UI)', () => {
		const statuses = evaluateSessionCriteria({
			lesson: lesson({ sessionKind: 'class', date: '2026-12-01' }),
			todayIso: '2026-06-01',
			hasNote: true,
			hasScreenshot: true,
			stem: '09',
			presenzeByStem: new Map([['09', true]])
		});
		expect(statuses).toEqual([]);
	});
});
