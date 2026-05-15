import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invalidate, showToast, withRetry } = vi.hoisted(() => ({
	invalidate: vi.fn(),
	showToast: vi.fn(),
	withRetry: vi.fn(async <T>(fn: () => Promise<T>) => fn())
}));

vi.mock('$app/navigation', () => ({ invalidate }));
vi.mock('$lib/stores/toast', () => ({ showToast }));
vi.mock('$lib/db/withRetry', () => ({ withRetry }));

import { invalidateClassMeta, invalidateLoadKeys, runMutation } from './runMutation';
import { repoErrorMessage } from './repoErrors';

describe('invalidateLoadKeys', () => {
	beforeEach(() => {
		invalidate.mockReset();
	});

	it('invalidates a single key', async () => {
		await invalidateLoadKeys('class:abc');
		expect(invalidate).toHaveBeenCalledWith('class:abc');
	});

	it('invalidates multiple keys', async () => {
		await invalidateLoadKeys(['class:abc', 'lesson:xyz']);
		expect(invalidate).toHaveBeenCalledTimes(2);
	});
});

describe('invalidateClassMeta', () => {
	beforeEach(() => {
		invalidate.mockReset();
	});

	it('uses class meta load key', async () => {
		await invalidateClassMeta('id-1');
		expect(invalidate).toHaveBeenCalledWith('class:meta:id-1');
	});
});

describe('runMutation', () => {
	beforeEach(() => {
		invalidate.mockReset();
		showToast.mockReset();
		withRetry.mockImplementation(async <T>(fn: () => Promise<T>) => fn());
	});

	it('returns value and invalidates on success', async () => {
		const onSuccess = vi.fn();
		const result = await runMutation({
			fn: async () => 'ok',
			invalidate: 'app:classes',
			successToast: 'Done',
			onSuccess
		});

		expect(result).toEqual({ ok: true, value: 'ok' });
		expect(invalidate).toHaveBeenCalledWith('app:classes');
		expect(showToast).toHaveBeenCalledWith('Done');
		expect(onSuccess).toHaveBeenCalledWith('ok');
	});

	it('shows error toast and calls onError on failure', async () => {
		const onError = vi.fn();
		const err = new Error('db down');
		const result = await runMutation({
			fn: async () => {
				throw err;
			},
			errorToast: 'Could not save.',
			onError
		});

		expect(result).toEqual({ ok: false });
		expect(showToast).toHaveBeenCalledWith('Could not save.');
		expect(onError).toHaveBeenCalledWith(err);
		expect(invalidate).not.toHaveBeenCalled();
	});

	it('uses mapError over repo registry and errorToast', async () => {
		await runMutation({
			fn: async () => {
				throw new Error('SESSION_KIND_EXTRA_BLOCKED_ABSENCES');
			},
			errorToast: 'Generic',
			mapError: () => 'Custom override'
		});

		expect(showToast).toHaveBeenCalledWith('Custom override');
	});

	it('uses repo error registry before errorToast', async () => {
		await runMutation({
			fn: async () => {
				throw new Error('SESSION_KIND_EXTRA_BLOCKED_ABSENCES');
			},
			errorToast: 'Generic'
		});

		expect(showToast).toHaveBeenCalledWith(repoErrorMessage(new Error('SESSION_KIND_EXTRA_BLOCKED_ABSENCES')));
	});

	it('surfaces registry message when no errorToast', async () => {
		await runMutation({
			fn: async () => {
				throw new Error('Semester start must be on or before semester end.');
			}
		});

		expect(showToast).toHaveBeenCalledWith('Semester start must be on or before semester end.');
	});
});
