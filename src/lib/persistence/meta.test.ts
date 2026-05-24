import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/db/client';
import { getFolderHandle, listFolderClassIds, putFolderHandle, removeFolderHandle } from './meta';

describe('meta', () => {
	beforeEach(async () => {
		await db.delete();
		await db.open();
	});

	it('put and get handle', async () => {
		const handle = { kind: 'directory' } as FileSystemDirectoryHandle;
		await putFolderHandle('c1', handle);
		expect(await getFolderHandle('c1')).toStrictEqual(handle);
		expect(await listFolderClassIds()).toEqual(['c1']);
		await removeFolderHandle('c1');
		expect(await getFolderHandle('c1')).toBeUndefined();
	});
});
