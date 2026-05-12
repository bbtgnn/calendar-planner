import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { classLoadKey } from '$lib/kit/loadKeys';
import { getClass } from '$lib/repos/classes.repo';

export const load: LayoutLoad = async ({ params, depends }) => {
	depends(classLoadKey(params.classId));
	const c = await getClass(params.classId);
	if (!c) throw error(404, 'Class not found');
	return { class: c };
};
