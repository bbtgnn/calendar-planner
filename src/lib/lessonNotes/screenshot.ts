import type { NoteFolder } from './types';

export function screenshotFileNameForNote(noteFileName: string): string | null {
	if (!noteFileName.endsWith('.md')) return null;
	return `${noteFileName.slice(0, -3)}-screen.png`;
}

/** All paired screenshots for a note, sorted: `{stem}-screen.png` first, then `{stem}-screen-{n}.png`. */
export function screenshotFileNamesForNote(
	noteFileName: string,
	pngSet: Set<string>
): string[] {
	if (!noteFileName.endsWith('.md')) return [];
	const stem = noteFileName.slice(0, -3);
	const primary = `${stem}-screen.png`;
	const numbered: { fileName: string; n: number }[] = [];
	for (const fileName of pngSet) {
		if (fileName === primary) continue;
		const m = fileName.match(new RegExp(`^${escapeRegExp(stem)}-screen-(\\d+)\\.png$`, 'i'));
		if (m) numbered.push({ fileName, n: Number(m[1]) });
	}
	numbered.sort((a, b) => a.n - b.n);
	const out = numbered.map((x) => x.fileName);
	if (pngSet.has(primary)) out.unshift(primary);
	return out;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function screenshotPathLabel(folder: NoteFolder, pngFileName: string): string {
	return `${folder}/${pngFileName}`;
}
