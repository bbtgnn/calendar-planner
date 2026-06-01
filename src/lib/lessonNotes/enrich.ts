import type { ClassId, LessonRow } from '$lib/db/types';
import { toUtcIsoCalendarDate } from '$lib/logic/semesterCalendar';
import { hasFolderPermission } from '$lib/persistence/classFolder';
import { getFolderHandle } from '$lib/persistence/meta';
import { matchNotesToLessons } from './match';
import { scanNotesSubdir, scanScreenshotsSubdir } from './scanFolder';
import type { EnrichedLesson, LessonNoteWarning } from './types';
import { upcomingSessionDate } from './upcoming';

export type ClassLessonsEnrichment = {
	lessons: EnrichedLesson[];
	warnings: LessonNoteWarning[];
	upcomingDate: string | null;
	notesScanned: boolean;
};

export async function enrichClassLessonsFromFolder(
	classId: ClassId,
	lessons: LessonRow[]
): Promise<ClassLessonsEnrichment> {
	const handle = await getFolderHandle(classId);
	const todayIso = toUtcIsoCalendarDate(new Date());
	if (!handle) {
		return {
			lessons: lessons.map((l) => ({ ...l })),
			warnings: [],
			upcomingDate: upcomingSessionDate(lessons, todayIso),
			notesScanned: false
		};
	}

	if (!(await hasFolderPermission(handle, 'read'))) {
		return {
			lessons: lessons.map((l) => ({ ...l })),
			warnings: [],
			upcomingDate: upcomingSessionDate(lessons, todayIso),
			notesScanned: false
		};
	}
	const [lezioni, extra, lezioniPng, extraPng] = await Promise.all([
		scanNotesSubdir(handle, 'lezioni'),
		scanNotesSubdir(handle, 'extra'),
		scanScreenshotsSubdir(handle, 'lezioni'),
		scanScreenshotsSubdir(handle, 'extra')
	]);
	const matched = matchNotesToLessons(lessons, lezioni.notes, extra.notes, {
		todayIso,
		screenshots: { lezioni: lezioniPng, extra: extraPng }
	});
	return {
		lessons: matched.lessons,
		warnings: [...lezioni.warnings, ...extra.warnings, ...matched.warnings],
		upcomingDate: upcomingSessionDate(matched.lessons, todayIso),
		notesScanned: true
	};
}
