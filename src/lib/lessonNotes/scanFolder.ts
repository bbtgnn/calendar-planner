import { listMarkdownFilesInSubdir } from '$lib/persistence/classFolder';
import { parseLessonNoteMarkdown } from './parseFrontmatter';
import type { LessonNoteWarning, NoteFolder, ScannedNote } from './types';

export async function scanNotesSubdir(
	root: FileSystemDirectoryHandle,
	folder: NoteFolder
): Promise<{ notes: ScannedNote[]; warnings: LessonNoteWarning[] }> {
	const files = await listMarkdownFilesInSubdir(root, folder);
	const notes: ScannedNote[] = [];
	const warnings: LessonNoteWarning[] = [];
	for (const { fileName, text } of files) {
		const parsed = parseLessonNoteMarkdown(text, fileName);
		if (!parsed.ok) {
			warnings.push({
				code: 'parse_error',
				message: `Could not parse ${folder}/${fileName} (${parsed.error})`
			});
			continue;
		}
		notes.push({
			folder,
			fileName,
			dateIso: parsed.dateIso,
			durationHours: parsed.durationHours
		});
	}
	return { notes, warnings };
}
