import { describe, expect, it } from 'vitest';
import { db } from './client';

describe('db', () => {
	it('opens and writes a class', async () => {
		const id = crypto.randomUUID();
		await db.classes.put({
			id,
			name: 'Test',
			totalHoursTarget: 10,
			createdAt: Date.now()
		});
		const row = await db.classes.get(id);
		expect(row?.name).toBe('Test');
		await db.classes.delete(id);
	});
});
