import type { LessonRow } from '$lib/db/types';
import type { EnrichedLesson, LessonNoteWarning, NoteFolder, ScannedNote } from './types';
import { folderForSessionKind } from './types';
import { screenshotFileNameForNote } from './screenshot';

export type ScreenshotIndex = {
	lezioni: Set<string>;
	extra: Set<string>;
};

export type MatchContext = {
	todayIso: string;
	screenshots: ScreenshotIndex;
};

export type MatchResult = {
	lessons: EnrichedLesson[];
	warnings: LessonNoteWarning[];
};

function groupByDate(notes: ScannedNote[]): Map<string, ScannedNote[]> {
	const map = new Map<string, ScannedNote[]>();
	for (const n of notes) {
		const list = map.get(n.dateIso) ?? [];
		list.push(n);
		map.set(n.dateIso, list);
	}
	return map;
}

function duplicateWarnings(folder: NoteFolder, byDate: Map<string, ScannedNote[]>): LessonNoteWarning[] {
	const out: LessonNoteWarning[] = [];
	for (const [dateIso, list] of byDate) {
		if (list.length > 1) {
			const names = list.map((n) => n.fileName).join(', ');
			out.push({
				code: 'duplicate_date',
				message: `Duplicate notes for ${dateIso} in ${folder}/ (${names})`,
				dateIso
			});
		}
	}
	return out;
}

function orphanWarnings(
	lessons: LessonRow[],
	folder: NoteFolder,
	kind: 'class' | 'extra',
	byDate: Map<string, ScannedNote[]>
): LessonNoteWarning[] {
	const sessionDates = new Set(
		lessons.filter((l) => l.sessionKind === kind).map((l) => l.date)
	);
	const out: LessonNoteWarning[] = [];
	for (const [dateIso, list] of byDate) {
		if (!sessionDates.has(dateIso)) {
			for (const n of list) {
				out.push({
					code: 'orphan_note',
					message: `Orphan note: ${folder}/${n.fileName} dated ${dateIso} (no matching session)`,
					dateIso
				});
			}
		}
	}
	return out;
}

function isPastSession(dateIso: string, todayIso: string): boolean {
	return dateIso <= todayIso;
}

export function matchNotesToLessons(
	lessons: LessonRow[],
	lezioniNotes: ScannedNote[],
	extraNotes: ScannedNote[],
	ctx: MatchContext
): MatchResult {
	const lezioniByDate = groupByDate(lezioniNotes);
	const extraByDate = groupByDate(extraNotes);

	const warnings: LessonNoteWarning[] = [
		...duplicateWarnings('lezioni', lezioniByDate),
		...duplicateWarnings('extra', extraByDate),
		...orphanWarnings(lessons, 'lezioni', 'class', lezioniByDate),
		...orphanWarnings(lessons, 'extra', 'extra', extraByDate)
	];

	const enriched: EnrichedLesson[] = lessons.map((lesson) => {
		if (lesson.sessionKind === 'skipped') {
			return { ...lesson, done: false };
		}
		const folder = folderForSessionKind(lesson.sessionKind);
		if (!folder) {
			return { ...lesson, done: false };
		}

		const byDate = folder === 'lezioni' ? lezioniByDate : extraByDate;
		const notes = byDate.get(lesson.date) ?? [];
		const past = isPastSession(lesson.date, ctx.todayIso);

		if (notes.length === 0) {
			if (past) {
				return { ...lesson, done: false, screenshotMissing: true };
			}
			return { ...lesson, done: false };
		}

		const note = notes[0];
		const pngName = screenshotFileNameForNote(note.fileName);
		const pngSet = folder === 'lezioni' ? ctx.screenshots.lezioni : ctx.screenshots.extra;
		const hasPng = pngName !== null && pngSet.has(pngName);

		const row: EnrichedLesson = {
			...lesson,
			done: past && hasPng,
			matchedNote: { folder, fileName: note.fileName }
		};
		if (hasPng && pngName) {
			row.screenshotRef = { folder, fileName: pngName };
		}
		if (past && !hasPng) {
			row.screenshotMissing = true;
		}
		if (note.durationHours !== lesson.durationHours) {
			row.hoursWarning = {
				plannerHours: lesson.durationHours,
				noteHours: note.durationHours,
				fileName: note.fileName,
				folder
			};
			warnings.push({
				code: 'hours_mismatch',
				message: `Hours: planner ${lesson.durationHours}h vs ${folder}/${note.fileName} ${note.durationHours}h (${lesson.date})`,
				lessonId: lesson.id,
				dateIso: lesson.date
			});
		}
		return row;
	});

	return { lessons: enriched, warnings };
}
