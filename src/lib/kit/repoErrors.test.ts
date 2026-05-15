import { describe, expect, it } from 'vitest';
import {
	SessionKindErrorCode,
	sessionKindError
} from '$lib/logic/sessionKindErrors';
import { RepoErrorCode, repoError, repoErrorMessage } from './repoErrors';

describe('repoErrorMessage', () => {
	it('maps session kind error codes', () => {
		expect(
			repoErrorMessage(sessionKindError(SessionKindErrorCode.EXTRA_BLOCKED_ABSENCES))
		).toBe('Clear all absences for this session before marking it as Extra.');
	});

	it('maps known repo codes', () => {
		expect(repoErrorMessage(repoError(RepoErrorCode.CLASS_NOT_FOUND))).toBe('Class not found.');
	});

	it('maps semester validation messages', () => {
		expect(
			repoErrorMessage(new Error('Semester start must be on or before semester end.'))
		).toBe('Semester start must be on or before semester end.');
	});

	it('returns undefined for unknown errors', () => {
		expect(repoErrorMessage(new Error('something else'))).toBeUndefined();
	});
});
