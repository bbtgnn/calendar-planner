import type { PageLoad } from './$types';
import { classLoadKey } from '$lib/kit/loadKeys';
import { listLessons } from '$lib/repos/lessons.repo';

export const load: PageLoad = async ({ params, parent, depends }) => {
	depends(classLoadKey(params.classId));
	await parent();
	const lessons = await listLessons(params.classId);
	return { lessons };
};
