import type { NoteFolder } from './types';

export function screenshotFileNameForNote(noteFileName: string): string | null {
	if (!noteFileName.endsWith('.md')) return null;
	return `${noteFileName.slice(0, -3)}-screen.png`;
}

export function screenshotPathLabel(folder: NoteFolder, pngFileName: string): string {
	return `${folder}/${pngFileName}`;
}
