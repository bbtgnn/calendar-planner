import { writable } from 'svelte/store';

export const toastMessage = writable<string | null>(null);

let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string, ms = 4000) {
	if (hideTimer !== undefined) clearTimeout(hideTimer);
	toastMessage.set(message);
	hideTimer = setTimeout(() => {
		toastMessage.set(null);
		hideTimer = undefined;
	}, ms);
}
