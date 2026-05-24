import type { PlannerFileV1 } from '$lib/schemas/plannerFile';
import { parsePlannerFile, serializePlannerFile, PLANNER_FILE_NAME } from './plannerFile';

export function isFileStorageSupported(): boolean {
	return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

type PermissionDirectoryHandle = FileSystemDirectoryHandle & {
	queryPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
	requestPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
};

export async function ensureReadWritePermission(
	handle: FileSystemDirectoryHandle
): Promise<boolean> {
	const opts = { mode: 'readwrite' as const };
	const permHandle = handle as PermissionDirectoryHandle;
	if ((await permHandle.queryPermission(opts)) === 'granted') return true;
	return (await permHandle.requestPermission(opts)) === 'granted';
}

export async function readPlannerFile(
	handle: FileSystemDirectoryHandle
): Promise<{ ok: true; value: PlannerFileV1 } | { ok: false; message: string }> {
	const fileHandle = await handle.getFileHandle(PLANNER_FILE_NAME);
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
