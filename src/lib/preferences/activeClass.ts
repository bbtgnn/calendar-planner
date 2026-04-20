const KEY = 'lesson-planner:last-class-id';

export function getLastClassId(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(KEY);
}

export function setLastClassId(id: string): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(KEY, id);
}

export function clearLastClassId(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(KEY);
}
