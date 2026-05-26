import type { PageLoad } from './$types';
import { classLessonsLoadKey, classMetaLoadKey } from '$lib/kit/loadKeys';
import {
	excludedClasses,
	includedClasses,
	overviewSpan,
	buildOverviewDayIndex,
	type DayCounts
} from '$lib/logic/overviewCalendar';
import { listLessonsForClassIds } from '$lib/repos/lessons.repo';

export const load: PageLoad = async ({ parent, depends }) => {
	const { classes } = await parent();
	const included = includedClasses(classes);
	const excluded = excludedClasses(classes);
	for (const c of included) {
		depends(classMetaLoadKey(c.id));
		depends(classLessonsLoadKey(c.id));
	}
	const span = overviewSpan(classes);
	if (!span) {
		return {
			classes,
			included,
			excluded,
			span: null,
			dayIndexEntries: null as null
		};
	}
	const lessonsByClassId = await listLessonsForClassIds(included.map((c) => c.id));
	const dayIndexEntries = [...buildOverviewDayIndex(included, lessonsByClassId).entries()] as [
		string,
		DayCounts
	][];
	return { classes, included, excluded, span, dayIndexEntries };
};
