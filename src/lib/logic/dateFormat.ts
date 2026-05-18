/** Locale for calendar dates shown in the UI (day/month/year). */
export const DATE_DISPLAY_LOCALE = 'en-GB';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` → `dd/MM/yyyy` (UTC calendar day). */
export function formatIsoDate(iso: string): string {
	const m = ISO_DATE.exec(iso);
	if (!m) return iso;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const d = Number(m[3]);
	return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString(DATE_DISPLAY_LOCALE, {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** `YYYY-MM` → month heading, e.g. `April 2026`. */
export function formatYearMonthHeading(yearMonth: string): string {
	const [y, m] = yearMonth.split('-').map(Number);
	const d = new Date(Date.UTC(y, m - 1, 1));
	return d.toLocaleDateString(DATE_DISPLAY_LOCALE, {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}
