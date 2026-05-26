import { describe, expect, it, vi } from 'vitest';
import {
	ensureReadPermission,
	ensureReadWritePermission,
	hasFolderPermission,
	queryFolderPermission
} from './classFolder';

type MockPermHandle = FileSystemDirectoryHandle & {
	queryPermission: ReturnType<typeof vi.fn>;
	requestPermission: ReturnType<typeof vi.fn>;
};

function mockHandle(
	query: PermissionState | (() => PermissionState | Promise<PermissionState>),
	request?: () => PermissionState | Promise<PermissionState>
): MockPermHandle {
	return {
		queryPermission: vi.fn(async () => (typeof query === 'function' ? query() : query)),
		requestPermission: vi.fn(async () => {
			if (request) return request();
			throw new DOMException('User activation is required', 'SecurityError');
		})
	} as unknown as MockPermHandle;
}

describe('folder permission helpers', () => {
	it('hasFolderPermission returns true when query grants read', async () => {
		const handle = mockHandle('granted');
		await expect(hasFolderPermission(handle, 'read')).resolves.toBe(true);
		expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
	});

	it('hasFolderPermission returns false when query is prompt (no request)', async () => {
		const handle = mockHandle('prompt');
		await expect(hasFolderPermission(handle, 'readwrite')).resolves.toBe(false);
		expect(handle.requestPermission).not.toHaveBeenCalled();
	});

	it('ensureReadWritePermission requests permission on user gesture', async () => {
		const handle = mockHandle('prompt', () => 'granted');
		await expect(ensureReadWritePermission(handle)).resolves.toBe(true);
		expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
	});

	it('ensureReadWritePermission returns false when request throws SecurityError', async () => {
		const handle = mockHandle('prompt');
		await expect(ensureReadWritePermission(handle)).resolves.toBe(false);
	});

	it('ensureReadPermission uses read mode', async () => {
		const handle = mockHandle('prompt', () => 'granted');
		await expect(ensureReadPermission(handle)).resolves.toBe(true);
		expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'read' });
	});

	it('queryFolderPermission forwards mode', async () => {
		const handle = mockHandle('denied');
		await expect(queryFolderPermission(handle, 'read')).resolves.toBe('denied');
	});
});
