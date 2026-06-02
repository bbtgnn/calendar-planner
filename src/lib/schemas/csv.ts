import { z } from 'zod';
import { parseCsvGridRaw } from '$lib/csv/parseGrid';

export const csvGridSchema = z.array(z.array(z.string())).min(1, 'empty csv');

export type CsvGrid = z.infer<typeof csvGridSchema>;

export function parseCsvGrid(text: string): CsvGrid {
	return csvGridSchema.parse(parseCsvGridRaw(text));
}

export function safeParseCsvGrid(text: string): { ok: true; grid: CsvGrid } | { ok: false } {
	const parsed = csvGridSchema.safeParse(parseCsvGridRaw(text));
	if (!parsed.success) return { ok: false };
	return { ok: true, grid: parsed.data };
}
