import { describe, expect, it, vi } from 'vitest';
import {
	ensureReadPermission,
	ensureReadWritePermission,
	hasFolderPermission,
	listPngFileNamesInSubdir,
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

function mockFile(name: string): FileSystemFileHandle {
	return { kind: 'file', name } as FileSystemFileHandle;
}

function mockDir(entries: [string, FileSystemHandle][]): FileSystemDirectoryHandle {
	return {
		kind: 'directory',
		async *entries() {
			for (const entry of entries) yield entry;
		}
	} as FileSystemDirectoryHandle;
}

function mockRoot(subdirs: Record<string, FileSystemDirectoryHandle>): FileSystemDirectoryHandle {
	return {
		kind: 'directory',
		getDirectoryHandle: async (name: string) => {
			const subdir = subdirs[name];
			if (!subdir) throw new DOMException('Not found', 'NotFoundError');
			return subdir;
		}
	} as FileSystemDirectoryHandle;
}

describe('listPngFileNamesInSubdir', () => {
	it('returns PNG file names from subdir', async () => {
		const root = mockRoot({
			lezioni: mockDir([
				['09-screen.png', mockFile('09-screen.png')],
				['09.md', mockFile('09.md')]
			])
		});
		await expect(listPngFileNamesInSubdir(root, 'lezioni')).resolves.toEqual(
			new Set(['09-screen.png'])
		);
	});

	it('matches .png case-insensitively', async () => {
		const root = mockRoot({
			extra: mockDir([['02-screen.PNG', mockFile('02-screen.PNG')]])
		});
		await expect(listPngFileNamesInSubdir(root, 'extra')).resolves.toEqual(
			new Set(['02-screen.png'])
		);
	});

	it('skips subdirectories', async () => {
		const root = mockRoot({
			lezioni: mockDir([['nested', { kind: 'directory' } as FileSystemDirectoryHandle]])
		});
		await expect(listPngFileNamesInSubdir(root, 'lezioni')).resolves.toEqual(new Set());
	});

	it('returns empty set when subdir is missing', async () => {
		const root = mockRoot({});
		await expect(listPngFileNamesInSubdir(root, 'lezioni')).resolves.toEqual(new Set());
	});
});
