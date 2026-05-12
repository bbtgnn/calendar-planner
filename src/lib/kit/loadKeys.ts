/**
 * Custom keys for SvelteKit `depends()` / `invalidate()`.
 * Use these everywhere so layout and page loads stay aligned.
 *
 * @see https://svelte.dev/docs/kit/load#Rerunning-load-functions-depends
 */
export type CustomLoadKey = `${string}:${string}`;

export const CLASSES_LIST_LOAD_KEY = 'app:classes' satisfies CustomLoadKey;

export function classLoadKey(classId: string): CustomLoadKey {
	return `class:${classId}` as CustomLoadKey;
}

export function lessonLoadKey(lessonId: string): CustomLoadKey {
	return `lesson:${lessonId}` as CustomLoadKey;
}
