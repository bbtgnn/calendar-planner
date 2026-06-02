import { parseCsvGrid } from '$lib/schemas/csv';
import { importNamesFromCsvGrid } from '$lib/schemas/rosterCsv';

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

export function parseCsvNames(content: string): ImportNamesResult {
	return importNamesFromCsvGrid(parseCsvGrid(content));
}
