import type { PageLoad } from './$types';
import { classLessonsLoadKey } from '$lib/kit/loadKeys';
import { listLessons } from '$lib/repos/lessons.repo';

export const load: PageLoad = async ({ params, parent, depends }) => {
	depends(classLessonsLoadKey(params.classId));
	await parent();
	const lessons = await listLessons(params.classId);
	return { lessons };
};
