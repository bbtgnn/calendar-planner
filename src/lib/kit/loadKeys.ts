/**
 * Custom keys for SvelteKit `depends()` / `invalidate()`.
 * Use these everywhere so layout and page loads stay aligned.
 *
 * Class-scoped data is split into slices so a Student write does not refetch Lessons.
 *
 * @see https://svelte.dev/docs/kit/load#Rerunning-load-functions-depends
 */
export type CustomLoadKey = `${string}:${string}`;

export const CLASSES_LIST_LOAD_KEY = 'app:classes' satisfies CustomLoadKey;

export function classMetaLoadKey(classId: string): CustomLoadKey {
	return `class:meta:${classId}` as CustomLoadKey;
}

export function classLessonsLoadKey(classId: string): CustomLoadKey {
	return `class:lessons:${classId}` as CustomLoadKey;
}

export function classStudentsLoadKey(classId: string): CustomLoadKey {
	return `class:students:${classId}` as CustomLoadKey;
}

/** Every class-scoped load slice — use for cascades and wide-reaching writes. */
export function classScopeLoadKeys(classId: string): CustomLoadKey[] {
	return [classMetaLoadKey(classId), classLessonsLoadKey(classId), classStudentsLoadKey(classId)];
}

export function lessonLoadKey(lessonId: string): CustomLoadKey {
	return `lesson:${lessonId}` as CustomLoadKey;
}
