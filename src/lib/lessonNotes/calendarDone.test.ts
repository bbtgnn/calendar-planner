import { describe, expect, it } from 'vitest';
import { kindDotsDoneByDate } from './calendarDone';

describe('kindDotsDoneByDate', () => {
	it('class dot done only if all class sessions that day are done', () => {
		const map = kindDotsDoneByDate([
			{ date: '2026-03-09', sessionKind: 'class', done: true },
			{ date: '2026-03-09', sessionKind: 'class', done: false }
		]);
		expect(map.get('2026-03-09')?.class).toBe(false);
	});

	it('class dot done when single class session is done', () => {
		const map = kindDotsDoneByDate([
			{ date: '2026-03-09', sessionKind: 'class', done: true }
		]);
		expect(map.get('2026-03-09')?.class).toBe(true);
	});

	it('extra dot tracks extra sessions separately', () => {
		const map = kindDotsDoneByDate([
			{ date: '2026-03-09', sessionKind: 'class', done: true },
			{ date: '2026-03-09', sessionKind: 'extra', done: false }
		]);
		expect(map.get('2026-03-09')?.class).toBe(true);
		expect(map.get('2026-03-09')?.extra).toBe(false);
	});
});
