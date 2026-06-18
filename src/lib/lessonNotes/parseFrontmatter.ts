const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export type ParseNoteOk = { ok: true; dateIso: string; durationHours: number };
export type ParseNoteErr = { ok: false; error: string };
export type ParseNoteResult = ParseNoteOk | ParseNoteErr;

/** `DD/MM/YYYY` → `YYYY-MM-DD` (UTC calendar day, same as semester map). */
export function italianDateToIso(value: string): string | null {
	const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	if (!m) return null;
	const dd = Number(m[1]);
	const mm = Number(m[2]);
	const yy = Number(m[3]);
	if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
	return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function parseLessonNoteMarkdown(text: string, _fileName: string): ParseNoteResult {
	const fm = text.match(FRONTMATTER_RE);
	if (!fm) return { ok: false, error: 'missing frontmatter' };
	const block = fm[1];
	const dataLine = block.match(/^data:\s*(.+)$/m);
	const durataLine = block.match(/^durata:\s*([\d.]+)\s*$/m);
	if (!dataLine) return { ok: false, error: 'missing data:' };
	if (!durataLine) return { ok: false, error: 'missing durata:' };
	const dateIso = italianDateToIso(dataLine[1]);
	if (!dateIso) return { ok: false, error: 'invalid data:' };
	const durationHours = Number(durataLine[1]);
	if (!Number.isFinite(durationHours) || durationHours < 0) {
		return { ok: false, error: 'invalid durata:' };
	}
	return { ok: true, dateIso, durationHours };
}

export function stripNoteBody(text: string): string {
	const fm = text.match(FRONTMATTER_RE);
	if (!fm) return text.trim();
	return text.slice(fm[0].length).trim();
}
