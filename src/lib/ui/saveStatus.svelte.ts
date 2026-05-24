export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

let status = $state<SaveStatus>('idle');

export function getSaveStatus(): SaveStatus {
	return status;
}

export function setSaveStatus(next: SaveStatus): void {
	status = next;
}
