export async function withRetry<T>(fn: () => Promise<T>, opts?: { retries?: number }): Promise<T> {
	const retries = opts?.retries ?? 1;
	let last: unknown;
	for (let i = 0; i <= retries; i++) {
		try {
			return await fn();
		} catch (e) {
			last = e;
			if (i === retries) break;
		}
	}
	throw last;
}
