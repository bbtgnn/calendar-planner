import type { LayoutLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { CLASSES_LIST_LOAD_KEY } from '$lib/kit/loadKeys';
import { listClasses } from '$lib/repos/classes.repo';
import { needsSetup, isFileStorageSupported } from '$lib/persistence/setup';
import { hydrateAllLinkedClassesFromFiles } from '$lib/persistence/hydrate';

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async ({ depends, url }) => {
	depends(CLASSES_LIST_LOAD_KEY);
	if (!isFileStorageSupported()) {
		return { classes: await listClasses(), fileStorageUnsupported: true };
	}
	if (url.pathname !== '/setup' && (await needsSetup())) {
		throw redirect(303, '/setup');
	}
	if (!(await needsSetup())) {
		await hydrateAllLinkedClassesFromFiles();
	}
	return { classes: await listClasses(), fileStorageUnsupported: false };
};
