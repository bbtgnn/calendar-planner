/** Stable codes thrown from session-kind write planning (`Error.message`). */
export const SessionKindErrorCode = {
	EXTRA_BLOCKED_ABSENCES: 'SESSION_KIND_EXTRA_BLOCKED_ABSENCES'
} as const;

export type SessionKindErrorCode =
	(typeof SessionKindErrorCode)[keyof typeof SessionKindErrorCode];

export const SESSION_KIND_ERROR_MESSAGES: Record<SessionKindErrorCode, string> = {
	[SessionKindErrorCode.EXTRA_BLOCKED_ABSENCES]:
		'Clear all absences for this session before marking it as Extra.'
};

export function sessionKindError(code: SessionKindErrorCode): Error {
	return new Error(code);
}
