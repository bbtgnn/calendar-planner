import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/db/client';
import { createClass, deleteClassCascade, updateClass } from './classes';

const notifyClassDirty = vi.fn();
vi.mock('$lib/persistence/notify', () => ({
	notifyClassDirty: (...args: unknown[]) => notifyClassDirty(...args)
}));

vi.mock('$lib/persistence/meta', () => ({
	removeFolderHandle: vi.fn()
}));

beforeEach(async () => {
	notifyClassDirty.mockClear();
	await db.delete();
	await db.open();
});

describe('application/classes', () => {
	it('createClass notifies dirty with new class id', async () => {
		const row = await createClass({ name: 'A', totalHoursTarget: 10 });
		expect(notifyClassDirty).toHaveBeenCalledOnce();
		expect(notifyClassDirty).toHaveBeenCalledWith(row.id);
	});

	it('updateClass notifies dirty with class id', async () => {
		const row = await createClass({ name: 'A', totalHoursTarget: 10 });
		notifyClassDirty.mockClear();
		await updateClass(row.id, { name: 'B' });
		expect(notifyClassDirty).toHaveBeenCalledOnce();
		expect(notifyClassDirty).toHaveBeenCalledWith(row.id);
	});

	it('deleteClassCascade does not notify dirty', async () => {
		const row = await createClass({ name: 'A', totalHoursTarget: 10 });
		notifyClassDirty.mockClear();
		await deleteClassCascade(row.id);
		expect(notifyClassDirty).not.toHaveBeenCalled();
	});
});
