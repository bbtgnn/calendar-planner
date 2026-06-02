import type { CsvGrid } from './csv';
import { safeParseCsvGrid } from './csv';

export function buildPresenzeStemIndex(grid: CsvGrid): Map<string, boolean> {
	const headers = grid[0].map((h) => h.trim());
	const map = new Map<string, boolean>();
	for (let col = 1; col < headers.length; col++) {
		const stem = headers[col];
		if (!stem) continue;
		let hasData = false;
		for (let row = 1; row < grid.length; row++) {
			const cell = (grid[row][col] ?? '').trim();
			if (cell) {
				hasData = true;
				break;
			}
		}
		map.set(stem, hasData);
	}
	return map;
}

export function loadPresenzeStemIndex(text: string): Map<string, boolean> {
	const parsed = safeParseCsvGrid(text);
	if (!parsed.ok) return new Map();
	return buildPresenzeStemIndex(parsed.grid);
}
