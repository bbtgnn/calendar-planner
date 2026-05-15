import {
	SessionKindErrorCode,
	SESSION_KIND_ERROR_MESSAGES
} from '$lib/logic/sessionKindErrors';

/**
 * Stable error codes/messages thrown from repos and domain validation.
 * Keys match `Error.message` for lookup in {@link repoErrorMessage}.
 */
export const RepoErrorCode = {
	CLASS_NOT_FOUND: 'CLASS_NOT_FOUND'
} as const;

export type RepoErrorCode = (typeof RepoErrorCode)[keyof typeof RepoErrorCode];

/** User-facing copy keyed by error message (code or literal validation text). */
export const REPO_ERROR_MESSAGES: Record<string, string> = {
	...SESSION_KIND_ERROR_MESSAGES,
	[RepoErrorCode.CLASS_NOT_FOUND]: 'Class not found.',
	'Semester start and end must both be set, or both cleared.':
		'Set both semester start and end, or clear both.',
	'Semester start must be on or before semester end.':
		'Semester start must be on or before semester end.'
};

export function repoError(code: RepoErrorCode | string): Error {
	return new Error(code);
}

/** Resolve a user-facing message from a thrown value, or `undefined` if unknown. */
export function repoErrorMessage(error: unknown): string | undefined {
	if (!(error instanceof Error) || !error.message) return undefined;
	return REPO_ERROR_MESSAGES[error.message];
}
