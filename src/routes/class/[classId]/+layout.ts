import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { classMetaLoadKey } from '$lib/kit/loadKeys';
import { getClass } from '$lib/repos/classes.repo';
import { isFileStorageSupported } from '$lib/persistence/setup';

export const load: LayoutLoad = async ({ params, depends }) => {
	depends(classMetaLoadKey(params.classId));
	const c = await getClass(params.classId);
	if (!c) throw error(404, 'Class not found');
	return { class: c, fileStorageSupported: isFileStorageSupported() };
};
