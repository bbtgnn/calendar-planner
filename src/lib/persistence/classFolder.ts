import type { PlannerFileV1 } from '$lib/schemas/plannerFile';
import { parsePlannerFile, serializePlannerFile, PLANNER_FILE_NAME } from './plannerFile';

export function isFileStorageSupported(): boolean {
	return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export type FolderPermissionMode = 'read' | 'readwrite';

type PermissionDirectoryHandle = FileSystemDirectoryHandle & {
	queryPermission(descriptor: { mode: FolderPermissionMode }): Promise<PermissionState>;
	requestPermission(descriptor: { mode: FolderPermissionMode }): Promise<PermissionState>;
};

export async function queryFolderPermission(
	handle: FileSystemDirectoryHandle,
	mode: FolderPermissionMode
): Promise<PermissionState> {
	const permHandle = handle as PermissionDirectoryHandle;
	return permHandle.queryPermission({ mode });
}

/** Query only — safe during route load / effects (never calls requestPermission). */
export async function hasFolderPermission(
	handle: FileSystemDirectoryHandle,
	mode: FolderPermissionMode
): Promise<boolean> {
	return (await queryFolderPermission(handle, mode)) === 'granted';
}

async function ensurePermission(
	handle: FileSystemDirectoryHandle,
	mode: FolderPermissionMode
): Promise<boolean> {
	const opts = { mode };
	const permHandle = handle as PermissionDirectoryHandle;
	if ((await permHandle.queryPermission(opts)) === 'granted') return true;
	try {
		return (await permHandle.requestPermission(opts)) === 'granted';
	} catch (err) {
		if (err instanceof DOMException && err.name === 'SecurityError') return false;
		throw err;
	}
}

/** Requires a user gesture when permission is not already granted. */
export async function ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
	return ensurePermission(handle, 'read');
}

/** Requires a user gesture when permission is not already granted. */
export async function ensureReadWritePermission(
	handle: FileSystemDirectoryHandle
): Promise<boolean> {
	return ensurePermission(handle, 'readwrite');
}

export async function readPlannerFile(
	handle: FileSystemDirectoryHandle
): Promise<{ ok: true; value: PlannerFileV1 } | { ok: false; message: string }> {
	let fileHandle: FileSystemFileHandle;
	try {
		fileHandle = await handle.getFileHandle(PLANNER_FILE_NAME);
	} catch {
		return { ok: false, message: 'Could not load planner.json — file may be damaged.' };
	}
	const file = await fileHandle.getFile();
	const text = await file.text();
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return { ok: false, message: 'Could not load planner.json — file may be damaged.' };
	}
	return parsePlannerFile(json);
}

export async function writePlannerFile(
	handle: FileSystemDirectoryHandle,
	data: PlannerFileV1
): Promise<void> {
	const fileHandle = await handle.getFileHandle(PLANNER_FILE_NAME, { create: true });
	const writable = await fileHandle.createWritable();
	await writable.write(serializePlannerFile(data));
	await writable.close();
}

export async function listMarkdownFilesInSubdir(
	root: FileSystemDirectoryHandle,
	subdirName: string
): Promise<{ fileName: string; text: string }[]> {
	let subdir: FileSystemDirectoryHandle;
	try {
		subdir = await root.getDirectoryHandle(subdirName);
	} catch {
		return [];
	}
	const out: { fileName: string; text: string }[] = [];
	for await (const [name, handle] of subdir.entries()) {
		if (handle.kind !== 'file' || !name.endsWith('.md')) continue;
		const file = await handle.getFile();
		out.push({ fileName: name, text: await file.text() });
	}
	return out;
}

export async function listPngFileNamesInSubdir(
	root: FileSystemDirectoryHandle,
	subdirName: string
): Promise<Set<string>> {
	let subdir: FileSystemDirectoryHandle;
	try {
		subdir = await root.getDirectoryHandle(subdirName);
	} catch {
		return new Set();
	}
	const names = new Set<string>();
	for await (const [name, handle] of subdir.entries()) {
		if (handle.kind !== 'file') continue;
		if (!name.toLowerCase().endsWith('.png')) continue;
		names.add(name);
	}
	return names;
}
