import { legacyBackupSchema, type LegacyBackup } from '$lib/schemas/legacyBackup';
import { plannerFileSchema, type PlannerFileV1 } from '$lib/schemas/plannerFile';

export const PLANNER_FILE_VERSION = 1;
export const PLANNER_FILE_NAME = 'planner.json';

const INVALID = 'Could not load planner.json — file may be damaged.';
const INVALID_BACKUP_STRUCTURE =
	'Not a valid backup file — expected classes, students, lessons, and absences.';
const INVALID_BACKUP_REFERENCES = 'Backup has invalid references — restore cancelled.';

export type ParseResult =
	| { ok: true; value: PlannerFileV1 }
	| { ok: false; message: string };

export type LegacyParseResult =
	| { ok: true; value: LegacyBackup }
	| { ok: false; message: string };

export function parsePlannerFile(json: unknown): ParseResult {
	const r = plannerFileSchema.safeParse(json);
	if (!r.success) return { ok: false, message: INVALID };
	return { ok: true, value: r.data };
}

export function serializePlannerFile(data: PlannerFileV1): string {
	return JSON.stringify(data, null, 2);
}

export function parseLegacyBackup(json: unknown): LegacyParseResult {
	const r = legacyBackupSchema.safeParse(json);
	if (r.success) return { ok: true, value: r.data };

	const hasFkError = r.error.issues.some(
		(issue) =>
			issue.message === 'invalid classId reference' ||
			issue.message === 'invalid absence reference'
	);
	if (hasFkError) return { ok: false, message: INVALID_BACKUP_REFERENCES };
	return { ok: false, message: INVALID_BACKUP_STRUCTURE };
}
