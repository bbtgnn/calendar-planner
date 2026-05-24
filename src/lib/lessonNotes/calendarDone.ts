import type { LessonSessionKind } from '$lib/db/types';

type LessonDoneSlice = { date: string; sessionKind: LessonSessionKind; done: boolean };

export type KindDoneFlags = { class: boolean; extra: boolean };

export function kindDotsDoneByDate(lessons: LessonDoneSlice[]): Map<string, KindDoneFlags> {
	const map = new Map<string, KindDoneFlags>();

	for (const l of lessons) {
		if (l.sessionKind === 'skipped') continue;

		let flags = map.get(l.date);
		if (!flags) {
			flags = { class: true, extra: true };
			map.set(l.date, flags);
		}

		if (l.sessionKind === 'class' && !l.done) flags.class = false;
		if (l.sessionKind === 'extra' && !l.done) flags.extra = false;
	}

	for (const [date, flags] of map) {
		const hasClass = lessons.some((l) => l.date === date && l.sessionKind === 'class');
		const hasExtra = lessons.some((l) => l.date === date && l.sessionKind === 'extra');
		if (!hasClass) flags.class = false;
		if (!hasExtra) flags.extra = false;
	}

	return map;
}
