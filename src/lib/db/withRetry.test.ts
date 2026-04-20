import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './withRetry';

describe('withRetry', () => {
	it('retries once then succeeds', async () => {
		let n = 0;
		const fn = vi.fn(async () => {
			n++;
			if (n === 1) throw new Error('fail');
			return 42;
		});
		await expect(withRetry(fn, { retries: 1 })).resolves.toBe(42);
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('throws after retries exhausted', async () => {
		const fn = vi.fn(async () => {
			throw new Error('x');
		});
		await expect(withRetry(fn, { retries: 1 })).rejects.toThrow('x');
		expect(fn).toHaveBeenCalledTimes(2);
	});
});
