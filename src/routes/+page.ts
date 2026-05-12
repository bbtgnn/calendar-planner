import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getLastClassId } from '$lib/preferences/activeClass';

export const load: PageLoad = async ({ parent }) => {
	const { classes } = await parent();
	if (classes.length === 0) {
		return { empty: true as const };
	}
	const last = getLastClassId();
	const id = last && classes.some((c) => c.id === last) ? last : classes[0].id;
	redirect(303, `/class/${id}`);
};
