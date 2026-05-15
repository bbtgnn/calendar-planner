import { invalidate } from '$app/navigation';
import { withRetry } from '$lib/db/withRetry';
import type { CustomLoadKey } from '$lib/kit/loadKeys';
import { classLoadKey } from '$lib/kit/loadKeys';
import { showToast } from '$lib/stores/toast';

export type MutationResult<T> = { ok: true; value: T } | { ok: false };

export type RunMutationOptions<T> = {
	fn: () => Promise<T>;
	invalidate?: CustomLoadKey | CustomLoadKey[];
	successToast?: string;
	errorToast?: string;
	mapError?: (error: unknown) => string | undefined;
	onSuccess?: (value: T) => void | Promise<void>;
	onError?: (error: unknown) => void | Promise<void>;
	retry?: boolean;
};

export async function invalidateLoadKeys(keys: CustomLoadKey | CustomLoadKey[]): Promise<void> {
	const list = Array.isArray(keys) ? keys : [keys];
	await Promise.all(list.map((key) => invalidate(key)));
}

export function invalidateClass(classId: string): Promise<void> {
	return invalidateLoadKeys(classLoadKey(classId));
}

function resolveErrorMessage(
	error: unknown,
	mapError: RunMutationOptions<unknown>['mapError'],
	errorToast: string | undefined
): string {
	const mapped = mapError?.(error);
	if (mapped !== undefined) return mapped;
	if (errorToast !== undefined) return errorToast;
	if (error instanceof Error && error.message) return error.message;
	return 'Something went wrong.';
}

/**
 * Run a persisted write with IndexedDB retry, optional load invalidation, and toast feedback.
 */
export async function runMutation<T>(options: RunMutationOptions<T>): Promise<MutationResult<T>> {
	const {
		fn,
		invalidate: keys,
		successToast,
		errorToast,
		mapError,
		onSuccess,
		onError,
		retry = true
	} = options;

	try {
		const value = retry ? await withRetry(fn) : await fn();
		if (keys) await invalidateLoadKeys(keys);
		if (successToast) showToast(successToast);
		await onSuccess?.(value);
		return { ok: true, value };
	} catch (error) {
		showToast(resolveErrorMessage(error, mapError, errorToast));
		await onError?.(error);
		return { ok: false };
	}
}
