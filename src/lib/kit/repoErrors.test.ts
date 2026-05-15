import { describe, expect, it } from 'vitest';
import { RepoErrorCode, repoError, repoErrorMessage } from './repoErrors';

describe('repoErrorMessage', () => {
	it('maps known repo codes', () => {
		expect(repoErrorMessage(repoError(RepoErrorCode.SESSION_KIND_EXTRA_BLOCKED_ABSENCES))).toBe(
			'Clear all absences for this session before marking it as Extra.'
		);
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
