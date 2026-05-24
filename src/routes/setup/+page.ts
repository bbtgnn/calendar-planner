import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { listClasses } from '$lib/repos/classes.repo';
import { getUnlinkedClassIds, isFileStorageSupported } from '$lib/persistence/setup';

export const load: PageLoad = async () => {
	if (!isFileStorageSupported()) {
		return { unsupported: true as const, classes: [] };
	}
	const unlinked = await getUnlinkedClassIds();
	if (unlinked.length === 0) throw redirect(303, '/');
	const classes = await listClasses();
	return {
		unsupported: false as const,
		classes: classes.filter((c) => unlinked.includes(c.id))
	};
};
