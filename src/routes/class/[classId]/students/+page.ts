import type { PageLoad } from './$types';
import { classLoadKey } from '$lib/kit/loadKeys';
import { listStudents } from '$lib/repos/students.repo';

export const load: PageLoad = async ({ params, parent, depends }) => {
	depends(classLoadKey(params.classId));
	await parent();
	const students = await listStudents(params.classId);
	return { students };
};
