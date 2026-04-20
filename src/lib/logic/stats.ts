export type LessonForStats = {
	durationHours: number;
	done: boolean;
};

export function sumScheduledHours(lessons: Pick<LessonForStats, 'durationHours'>[]): number {
	return lessons.reduce((s, l) => s + l.durationHours, 0);
}

export function remainingHours(totalHoursTarget: number, scheduledHours: number): number {
	return totalHoursTarget - scheduledHours;
}

export function scheduledLessonCount(lessons: unknown[]): number {
	return lessons.length;
}

export function doneLessonCount(lessons: LessonForStats[]): number {
	return lessons.filter((l) => l.done).length;
}
