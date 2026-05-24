import type { LessonRow, LessonSessionKind } from '$lib/db/types';

export type NoteFolder = 'lezioni' | 'extra';

export type LessonNoteWarningCode =
	| 'hours_mismatch'
	| 'duplicate_date'
	| 'orphan_note'
	| 'parse_error';

export type LessonNoteWarning = {
	code: LessonNoteWarningCode;
	message: string;
	lessonId?: string;
	dateIso?: string;
};

export type ScannedNote = {
	folder: NoteFolder;
	fileName: string;
	dateIso: string;
	durationHours: number;
};

export type LessonHoursWarning = {
	plannerHours: number;
	noteHours: number;
	fileName: string;
	folder: NoteFolder;
};

export type EnrichedLesson = LessonRow & {
	hoursWarning?: LessonHoursWarning;
};

export function folderForSessionKind(kind: LessonSessionKind): NoteFolder | null {
	if (kind === 'class') return 'lezioni';
	if (kind === 'extra') return 'extra';
	return null;
}
