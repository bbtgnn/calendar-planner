import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getLesson } from '$lib/repos/lessons.repo';

export const load: PageLoad = async ({ params }) => {
	const lesson = await getLesson(params.lessonId);
	if (!lesson || lesson.classId !== params.classId) throw error(404, 'Lesson not found');
	return { lesson };
};
