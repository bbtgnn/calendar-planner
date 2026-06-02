import type { PageLoad } from './$types';
import { classLessonsLoadKey } from '$lib/kit/loadKeys';
import { toUtcIsoCalendarDate } from '$lib/logic/semesterCalendar';
import { enrichClassLessonsFromFolder } from '$lib/lessonNotes/enrich';
import { listLessons } from '$lib/repos/lessons.repo';

export const load: PageLoad = async ({ params, parent, depends }) => {
	depends(classLessonsLoadKey(params.classId));
	await parent();
	const raw = await listLessons(params.classId);
	const enriched = await enrichClassLessonsFromFolder(params.classId, raw);
	return {
		lessons: enriched.lessons,
		noteWarnings: enriched.warnings,
		upcomingDate: enriched.upcomingDate,
		notesScanned: enriched.notesScanned,
		todayIso: toUtcIsoCalendarDate(new Date())
	};
};
