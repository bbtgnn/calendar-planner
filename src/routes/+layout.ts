import type { LayoutLoad } from './$types';
import { CLASSES_LIST_LOAD_KEY } from '$lib/kit/loadKeys';
import { listClasses } from '$lib/repos/classes.repo';

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async ({ depends }) => {
	depends(CLASSES_LIST_LOAD_KEY);
	return { classes: await listClasses() };
};
