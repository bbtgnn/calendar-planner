import { describe, expect, it } from 'vitest';
import { doneLessonCount, remainingHours, scheduledLessonCount, sumScheduledHours } from './stats';

describe('stats', () => {
	it('sumScheduledHours sums durationHours', () => {
		expect(sumScheduledHours([{ durationHours: 2 }, { durationHours: 1.5 }])).toBe(3.5);
		expect(sumScheduledHours([])).toBe(0);
	});

	it('remainingHours is target minus scheduled', () => {
		expect(remainingHours(10, 3)).toBe(7);
		expect(remainingHours(10, 12)).toBe(-2);
	});

	it('scheduledLessonCount and doneLessonCount', () => {
		const lessons = [
			{ done: true, durationHours: 1 },
			{ done: false, durationHours: 2 },
			{ done: true, durationHours: 0.5 }
		];
		expect(scheduledLessonCount(lessons)).toBe(3);
		expect(doneLessonCount(lessons)).toBe(2);
	});
});
