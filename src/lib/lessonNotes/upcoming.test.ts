import { describe, expect, it } from 'vitest';
import { upcomingSessionDate } from './upcoming';

describe('upcomingSessionDate', () => {
	it('returns earliest class/extra date on or after today', () => {
		expect(
			upcomingSessionDate(
				[
					{ date: '2026-03-01', sessionKind: 'class' },
					{ date: '2026-03-10', sessionKind: 'class' },
					{ date: '2026-03-10', sessionKind: 'extra' }
				],
				'2026-03-09'
			)
		).toBe('2026-03-10');
	});

	it('returns null when no future class/extra', () => {
		expect(
			upcomingSessionDate([{ date: '2026-01-01', sessionKind: 'class' }], '2026-03-09')
		).toBeNull();
	});

	it('ignores skipped when picking upcoming', () => {
		expect(
			upcomingSessionDate(
				[
					{ date: '2026-03-10', sessionKind: 'skipped' },
					{ date: '2026-03-15', sessionKind: 'class' }
				],
				'2026-03-09'
			)
		).toBe('2026-03-15');
	});
});
