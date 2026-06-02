import type { CsvGrid } from './csv';
import type { ImportNamesResult } from '$lib/logic/rosterImport';

export function importNamesFromCsvGrid(grid: CsvGrid): ImportNamesResult {
	if (grid.length === 0) return { names: [], skipped: 0 };
	let start = 0;
	const head = grid[0][0]?.trim().toLowerCase() ?? '';
	if (head === 'name') start = 1;
	const names: string[] = [];
	let skipped = 0;
	for (let i = start; i < grid.length; i++) {
		const cell = (grid[i][0] ?? '').trim();
		if (cell) names.push(cell);
		else skipped++;
	}
	return { names, skipped };
}
