import type { LessonRow } from '$lib/db/types';
import { compareIsoDate } from '$lib/logic/semesterCalendar';

export function upcomingSessionDate(
	lessons: Pick<LessonRow, 'date' | 'sessionKind'>[],
	todayIso: string
): string | null {
	const candidates = lessons
		.filter((l) => l.sessionKind === 'class' || l.sessionKind === 'extra')
		.filter((l) => compareIsoDate(l.date, todayIso) >= 0)
		.map((l) => l.date)
		.sort(compareIsoDate);
	return candidates[0] ?? null;
}
