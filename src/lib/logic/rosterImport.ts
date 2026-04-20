export type ImportNamesResult = {
	names: string[];
	skipped: number;
};

export function parseTxtNames(content: string): ImportNamesResult {
	const lines = content.split(/\r?\n/);
	const names: string[] = [];
	for (const line of lines) {
		const t = line.trim();
		if (!t) continue;
		names.push(t);
	}
	return { names, skipped: 0 };
}

function firstCell(line: string): string {
	const comma = line.indexOf(',');
	const cell = comma === -1 ? line : line.slice(0, comma);
	return cell.replace(/^"|"$/g, '').trim();
}

export function parseCsvNames(content: string): ImportNamesResult {
	const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length === 0) return { names: [], skipped: 0 };

	let start = 0;
	const head = firstCell(lines[0]).toLowerCase();
	if (head === 'name') start = 1;

	const names: string[] = [];
	let skipped = 0;
	for (let i = start; i < lines.length; i++) {
		const cell = firstCell(lines[i]);
		if (cell) names.push(cell);
		else skipped++;
	}
	return { names, skipped };
}
