import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { getClass } from '$lib/repos/classes.repo';

export const load: LayoutLoad = async ({ params }) => {
	const c = await getClass(params.classId);
	if (!c) throw error(404, 'Class not found');
	return { class: c };
};
